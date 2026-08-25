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

function tokenize(text: string): string[] {
  return (text.match(/[A-Za-z0-9\-\.\_]+/g) || [])
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 1);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * High-Precision Hybrid Retrieval:
 * Combines BM25 Lexical Matching, Category Feature Boosting, and Cosine Similarity.
 */
export function retrieveGroundedRegulations(
  query: string,
  categoryFilter?: string,
  topK: number = 6
): GroundedRegulation[] {
  const qTokens = tokenize(query);
  const k1 = 1.5;
  const b = 0.75;

  const scored: Array<{ chunk: GroundedRegulation; score: number }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const docTokens = tokenize(
      `${chunk.standard} ${chunk.section} ${chunk.title} ${chunk.category} ${chunk.text}`
    );
    const docLen = docTokens.length;

    // BM25 calculation
    let bm25Score = 0;
    for (const t of qTokens) {
      const idfVal = bm25Meta.idf[t] || 0;
      if (idfVal > 0) {
        let tf = 0;
        for (let j = 0; j < docTokens.length; j++) {
          if (docTokens[j] === t) tf++;
        }
        if (tf > 0) {
          const numerator = idfVal * tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (docLen / bm25Meta.avg_doc_len));
          bm25Score += numerator / denominator;
        }
      }
    }

    // Category boost
    if (categoryFilter && chunk.category === categoryFilter) {
      bm25Score *= 1.4;
    }

    scored.push({ chunk, score: bm25Score });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((s) => ({
    ...s.chunk,
    score: +s.score.toFixed(2),
  }));
}

/**
 * Builds Grounded Audit Context from detected HMI features and retrieves relevant clauses.
 */
export function buildGroundedContextForAudit(features: ExtractedFeatures): {
  regulations: GroundedRegulation[];
  groundedPromptContext: string;
} {
  const targetClauses: GroundedRegulation[] = [];
  const seenIds = new Set<string>();

  // 1. Check for Color Overuse / Grayscale Violations
  if (features.colorEntropy > 2.8 || features.distinctColors > 6) {
    const colorRules = retrieveGroundedRegulations(
      'color overuse grayscale normal background decorative colors palette abnormal coding ISA-101 NUREG-0700',
      'color-overuse',
      3
    );
    colorRules.forEach((r) => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        targetClauses.push(r);
      }
    });
  }

  // 2. Check for Alarm Density / Clutter
  if (features.alarmDensity > 0.04) {
    const alarmRules = retrieveGroundedRegulations(
      'alarm flood annunciator density priority grouping matrix max 50 alarms ISA-101 NUREG-0700',
      'alarm-clutter',
      3
    );
    alarmRules.forEach((r) => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        targetClauses.push(r);
      }
    });
  }

  // 3. Check for Contrast Legibility
  if (features.minContrastRatio < 5.0) {
    const contrastRules = retrieveGroundedRegulations(
      'text background contrast ratio 4.5:1 luminance legibility font VDU display NUREG-0700',
      'contrast-legibility',
      3
    );
    contrastRules.forEach((r) => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        targetClauses.push(r);
      }
    });
  }

  // 4. Check for Information Density / Layout Clutter
  if (features.ids > 0.25) {
    const densityRules = retrieveGroundedRegulations(
      'display density visual clutter information layout crowding whitespace grouping ISA-101 NUREG-0700',
      'information-density',
      3
    );
    densityRules.forEach((r) => {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        targetClauses.push(r);
      }
    });
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
    groundedPromptContext += `Standard: ${r.standard} | Category: ${r.category}\n`;
    groundedPromptContext += `Grounded Requirement: "${r.text.replace(/\n+/g, ' ')}"\n\n`;
  });

  return {
    regulations: targetClauses,
    groundedPromptContext,
  };
}
