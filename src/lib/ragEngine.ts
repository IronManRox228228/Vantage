import kbData from '../data/rag_knowledge_base.json';
import { ExtractedFeatures } from './workerExtractor';

export interface GroundedRegulation {
  id: string;
  standard: 'ANSI/ISA-101.01-2015' | 'NUREG-0700 Rev. 1' | string;
  section: string;
  title: string;
  category: string;
  text: string;
  citation: string;
  score?: number;
}

export interface GroundedContext {
  regulations: GroundedRegulation[];
  triggeredCategories: string[];
  groundedPromptContext: string;
}

interface BM25Metadata {
  num_docs: number;
  avg_doc_len: number;
  idf: Record<string, number>;
}

const chunks: GroundedRegulation[] = (kbData as any).chunks || [];
const bm25Meta: BM25Metadata = (kbData as any).bm25_metadata || {
  num_docs: chunks.length,
  avg_doc_len: 150,
  idf: {},
};

// Okapi BM25 parameters
const K1 = 1.5;
const B = 0.75;
// Hybrid retrieval weights: normalized BM25 + lexical cosine overlap
const HYBRID_WEIGHTS = { bm25: 0.65, cosine: 0.35 };
const CATEGORY_BOOST = 1.35;

/**
 * Normalizes text into lowercase alphanumeric word tokens.
 * Pure word tokens (no punctuation/dot runs) so standard references,
 * section numbers and prose are tokenized consistently.
 */
function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  return tokens.filter((t) => t.length > 1);
}

type SparseVector = Map<string, number>;

function binaryVector(tokens: string[]): SparseVector {
  const vec: SparseVector = new Map();
  for (const t of tokens) vec.set(t, 1);
  return vec;
}

function cosineSimilarity(vecA: SparseVector, vecB: SparseVector): number {
  if (vecA.size === 0 || vecB.size === 0) return 0;
  let dotProduct = 0;
  for (const [t, v] of vecA) {
    const w = vecB.get(t);
    if (w) dotProduct += v * w;
  }
  let normA = 0;
  for (const v of vecA.values()) normA += v * v;
  let normB = 0;
  for (const v of vecB.values()) normB += v * v;
  if (normA === 0 || normB === 0) return 0;
  const magA = Math.sqrt(normA);
  const magB = Math.sqrt(normB);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

interface IndexedChunk {
  chunk: GroundedRegulation;
  tokens: string[];
  docLen: number;
}

const indexedChunks: IndexedChunk[] = chunks.map((chunk) => {
  const tokens = tokenize(
    `${chunk.standard} ${chunk.section} ${chunk.title} ${chunk.category} ${chunk.text}`
  );
  return { chunk, tokens, docLen: tokens.length };
});

const NUM_DOCS = indexedChunks.length;
const AVG_DOC_LEN =
  bm25Meta.avg_doc_len && bm25Meta.avg_doc_len > 0
    ? bm25Meta.avg_doc_len
    : indexedChunks.reduce((sum, c) => sum + c.docLen, 0) / Math.max(1, indexedChunks.length);

// Compute Okapi BM25 IDF over the corpus at runtime (immune to stale index metadata).
const DOC_FREQ: Record<string, number> = {};
for (const { tokens } of indexedChunks) {
  const unique = Array.from(new Set(tokens));
  for (const t of unique) DOC_FREQ[t] = (DOC_FREQ[t] || 0) + 1;
}
const IDF: Record<string, number> = {};
for (const [term, df] of Object.entries(DOC_FREQ)) {
  IDF[term] = Math.log(1 + (NUM_DOCS - df + 0.5) / (df + 0.5));
}

/**
 * High-Precision Hybrid Retrieval:
 * Combines normalized BM25 Lexical Matching and Lexical Cosine Similarity,
 * with category-specific feature boosting. Only chunks with verified
 * relevance above zero are returned, preventing irrelevant filler clauses.
 */
export function retrieveGroundedRegulations(
  query: string,
  categoryFilter?: string,
  topK: number = 6
): GroundedRegulation[] {
  const qTokens = tokenize(query);
  const queryVec = binaryVector(qTokens);

  const scored: Array<{ chunk: GroundedRegulation; score: number; bm25: number; cosine: number }> = [];

  for (const { chunk, tokens, docLen } of indexedChunks) {
    let bm25Score = 0;
    for (const t of qTokens) {
      const idfVal = IDF[t] || 0;
      if (idfVal > 0) {
        let tf = 0;
        for (const dt of tokens) {
          if (dt === t) tf++;
        }
        if (tf > 0) {
          const numerator = idfVal * tf * (K1 + 1);
          const denominator = tf + K1 * (1 - B + B * (docLen / AVG_DOC_LEN));
          bm25Score += numerator / denominator;
        }
      }
    }

    const cosine = cosineSimilarity(queryVec, binaryVector(tokens));
    scored.push({ chunk, score: 0, bm25: bm25Score, cosine });
  }

  const maxBm25 = scored.reduce((max, s) => Math.max(max, s.bm25), 0) || 1;
  for (const s of scored) {
    const bm25Norm = s.bm25 / maxBm25;
    let score = HYBRID_WEIGHTS.bm25 * bm25Norm + HYBRID_WEIGHTS.cosine * s.cosine;
    if (categoryFilter && s.chunk.category === categoryFilter) {
      score *= CATEGORY_BOOST;
    }
    s.score = score;
  }

  scored.sort((a, b) => b.score - a.score);

  // Grounding quality gate: only return chunks with verified relevance.
  return scored
    .filter((s) => s.score > 0)
    .slice(0, topK)
    .map((s) => ({
      ...s.chunk,
      score: +s.score.toFixed(3),
    }));
}

/**
 * Builds Grounded Audit Context from detected HMI features and retrieves relevant clauses.
 */
export function buildGroundedContextForAudit(features: ExtractedFeatures): GroundedContext {
  const targetClauses: GroundedRegulation[] = [];
  const triggeredCategories: string[] = [];
  const seenIds = new Set<string>();

  const addTriggeredRules = (category: string, query: string, topK: number) => {
    if (!triggeredCategories.includes(category)) {
      triggeredCategories.push(category);
    }
    const rules = retrieveGroundedRegulations(query, category, topK);
    rules.forEach((r) => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        targetClauses.push(r);
      }
    });
  };

  // 1. Check for Color Overuse / Grayscale Violations
  if (features.colorEntropy > 2.8 || features.distinctColors > 6) {
    addTriggeredRules(
      'color-overuse',
      'color overuse grayscale normal background decorative colors palette abnormal coding ISA-101 NUREG-0700',
      3
    );
  }

  // 2. Check for Alarm Density / Clutter
  if (features.alarmDensity > 0.04) {
    addTriggeredRules('alarm-clutter', 'alarm flood annunciator density priority grouping matrix max 50 alarms ISA-101 NUREG-0700', 3);
  }

  // 3. Check for Contrast Legibility
  if (features.minContrastRatio < 5.0) {
    addTriggeredRules('contrast-legibility', 'text background contrast ratio 4.5:1 luminance legibility font VDU display NUREG-0700', 3);
  }

  // 4. Check for Information Density / Layout Clutter
  if (features.ids > 0.25) {
    addTriggeredRules('information-density', 'display density visual clutter information layout crowding whitespace grouping ISA-101 NUREG-0700', 3);
  }

  // 5. Always include baseline Display Hierarchy & Situational Awareness standards
  const hierarchyRules = retrieveGroundedRegulations(
    'display hierarchy Level 1 overview Level 2 unit Level 3 detail navigation ISA-101',
    'navigation-clutter',
    2
  );
  hierarchyRules.forEach((r) => {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      targetClauses.push(r);
    }
  });

  // Build markdown context block
  let groundedPromptContext = '=== GROUNDED REGULATORY KNOWLEDGE BASE (ISA-101 & NUREG-0700) ===\n';
  groundedPromptContext +=
    'The following normative standard clauses are retrieved specifically for this screen. Every violation MUST cite and quote from these sources:\n\n';

  targetClauses.forEach((r, idx) => {
    groundedPromptContext += `[REGULATION REF #${idx + 1}]: ${r.citation} - ${r.title}\n`;
    groundedPromptContext += `Standard: ${r.standard} | Category: ${r.category} | Relevance Score: ${r.score ?? 'n/a'}\n`;
    groundedPromptContext += `Grounded Requirement: "${r.text.replace(/\n+/g, ' ').trim()}"\n\n`;
  });

  groundedPromptContext +=
    'SOURCE INTEGRITY RULES:\n' +
    '- Only the regulation references provided above may be cited in the audit output.\n' +
    '- The grounded_quote MUST be copied verbatim (whitespace-normalized) from the retrieved Grounded Requirement text.\n' +
    '- Do NOT invent, paraphrase-fabricate, or reference any clause outside this retrieved context.\n';

  return {
    regulations: targetClauses,
    triggeredCategories,
    groundedPromptContext,
  };
}
