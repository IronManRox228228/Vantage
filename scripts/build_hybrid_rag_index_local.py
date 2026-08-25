import os
import re
import json
import time
import math
import pypdf
import torch
import numpy as np
from transformers import AutoTokenizer, AutoModel

print("=" * 65)
print("  Vantage HMI Auditor - High-Accuracy Hybrid RAG Index Builder")
print("  Sources: ANSI/ISA-101.01-2015 + NUREG-0700 Rev. 1")
print("  Engine: Semantic Embeddings (CUDA) + BM25 Lexical Index")
print("=" * 65)

chunks = []

# ----------------------------------------------------------------------
# 1. PARSE ANSI/ISA-101.01-2015
# ----------------------------------------------------------------------
print("\n[1/4] Parsing ANSI/ISA-101.01-2015 (64 pages)...")
with open('data/isa101_transcribed.json', 'r', encoding='utf-8') as f:
    isa_pages = json.load(f)

full_isa_text = ""
for p_num in sorted([int(k) for k in isa_pages.keys()]):
    full_isa_text += f"\n\n--- [ISA-101 Page {p_num}] ---\n" + isa_pages[str(p_num)]

# Split by section headers e.g. "4.1 ...", "5.2 Display Hierarchy", "5.3 Use of Color"
isa_section_regex = re.compile(r'\n(?=(\d+\.\d+(?:\.\d+)?)\s+([A-Z][^\n\r]+))')
sections = isa_section_regex.split(full_isa_text)

i = 1
while i < len(sections):
    sec_num = sections[i].strip()
    sec_title = sections[i+1].strip() if i+1 < len(sections) else "Section"
    sec_body = sections[i+2].strip() if i+2 < len(sections) else ""
    i += 3

    if len(sec_body) < 50:
        continue

    combined_header = f"{sec_num} {sec_title} {sec_body[:200]}".lower()
    cat = "general"
    if "color" in combined_header or "grayscale" in combined_header or "palette" in combined_header:
        cat = "color-overuse"
    elif "alarm" in combined_header or "annunciator" in combined_header or "priority" in combined_header:
        cat = "alarm-clutter"
    elif "density" in combined_header or "layout" in combined_header or "clutter" in combined_header or "information" in combined_header:
        cat = "information-density"
    elif "navigat" in combined_header or "hierarchy" in combined_header or "level 1" in combined_header or "level 2" in combined_header:
        cat = "navigation-clutter"
    elif "contrast" in combined_header or "legib" in combined_header or "font" in combined_header or "text" in combined_header:
        cat = "contrast-legibility"
    elif "trend" in combined_header or "analog" in combined_header or "graphic" in combined_header or "sparkline" in combined_header:
        cat = "trends-and-analog"

    # Split into focused paragraphs (max 1000 chars) for precise chunk retrieval
    paras = [p.strip() for p in sec_body.split('\n\n') if len(p.strip()) > 30]
    curr = ""
    sub = 1
    for p in paras:
        if len(curr) + len(p) > 900 and len(curr) > 150:
            chunks.append({
                "id": f"ISA101_{sec_num.replace('.', '_')}_{sub}",
                "standard": "ANSI/ISA-101.01-2015",
                "section": sec_num,
                "title": f"{sec_title} (Part {sub})" if sub > 1 else sec_title,
                "category": cat,
                "text": curr.strip(),
                "citation": f"ANSI/ISA-101.01-2015 §{sec_num}"
            })
            sub += 1
            curr = p + "\n\n"
        else:
            curr += p + "\n\n"
    if len(curr.strip()) > 30:
        chunks.append({
            "id": f"ISA101_{sec_num.replace('.', '_')}_{sub}",
            "standard": "ANSI/ISA-101.01-2015",
            "section": sec_num,
            "title": f"{sec_title} (Part {sub})" if sub > 1 else sec_title,
            "category": cat,
            "text": curr.strip(),
            "citation": f"ANSI/ISA-101.01-2015 §{sec_num}"
        })

print(f"  Extracted {len(chunks)} high-precision chunks from ANSI/ISA-101.01-2015.")

# ----------------------------------------------------------------------
# 2. PARSE NUREG-0700 Rev. 1
# ----------------------------------------------------------------------
print("\n[2/4] Parsing NUREG-0700 Rev. 1 (491 pages)...")
nureg_reader = pypdf.PdfReader(r'C:\Users\Ashman Das\Downloads\29013055.pdf')
full_nureg_text = ""
for page_idx in range(len(nureg_reader.pages)):
    txt = nureg_reader.pages[page_idx].extract_text() or ''
    full_nureg_text += f"\n\n--- [NUREG-0700 Page {page_idx+1}] ---\n" + txt

# Pattern matching specific NUREG-0700 guidelines e.g. "1.1-1 Continuous Display...", "1.3.4-1..."
nureg_guideline_regex = re.compile(r'\n(?=(\d+\.[\d\.\-]+)\s+([A-Z][A-Za-z0-9\s\,\-\(\)\/\:]+))')
nureg_splits = nureg_guideline_regex.split(full_nureg_text)

nureg_count = 0
j = 1
while j < len(nureg_splits):
    g_num = nureg_splits[j].strip()
    g_title = nureg_splits[j+1].strip() if j+1 < len(nureg_splits) else "Guideline"
    g_body = nureg_splits[j+2].strip() if j+2 < len(nureg_splits) else ""
    j += 3

    if len(g_body) < 50 or len(g_num) < 3 or ('-' not in g_num and '.' not in g_num):
        continue

    top_sec = g_num.split('.')[0]
    if top_sec not in ['1', '2', '3', '4', '5', '6', '7', '8', '10']:
        continue

    cat = "general"
    lower_title = f"{g_num} {g_title} {g_body[:300]}".lower()
    if "color" in lower_title or "chromatic" in lower_title:
        cat = "color-overuse"
    elif "alarm" in lower_title or "annunciator" in lower_title:
        cat = "alarm-clutter"
    elif "density" in lower_title or "clutter" in lower_title or "crowd" in lower_title or "grouping" in lower_title or "spacing" in lower_title:
        cat = "information-density"
    elif "navigat" in lower_title or "menu" in lower_title or "hierarchy" in lower_title or "window" in lower_title:
        cat = "navigation-clutter"
    elif "contrast" in lower_title or "luminance" in lower_title or "legib" in lower_title or "font" in lower_title or "size" in lower_title:
        cat = "contrast-legibility"
    elif "trend" in lower_title or "graph" in lower_title or "scale" in lower_title or "dial" in lower_title or "gauge" in lower_title:
        cat = "trends-and-analog"

    clean_text = g_body[:1500].strip()
    clean_id = f"NUREG0700_{g_num.replace('.', '_').replace('-', '_')}"

    chunks.append({
        "id": clean_id,
        "standard": "NUREG-0700 Rev. 1",
        "section": g_num,
        "title": g_title,
        "category": cat,
        "text": clean_text,
        "citation": f"NUREG-0700 Rev. 1 §{g_num}"
    })
    nureg_count += 1

print(f"  Extracted {nureg_count} grounded guideline chunks from NUREG-0700.")
print(f"  Total knowledge base corpus: {len(chunks)} chunks.")

# ----------------------------------------------------------------------
# 3. BUILD BM25 LEXICAL INVERTED INDEX
# ----------------------------------------------------------------------
print("\n[3/4] Building BM25 Inverted Index & Term Statistics...")

def tokenize(text):
    return [w.lower() for w in re.findall(r'[A-Za-z0-9\-\.\_]+', text) if len(w) > 1]

doc_lengths = []
doc_freqs = {}
num_docs = len(chunks)

for c in chunks:
    tokens = tokenize(f"{c['standard']} {c['section']} {c['title']} {c['category']} {c['text']}")
    c['tokens'] = tokens
    doc_lengths.append(len(tokens))
    unique_tokens = set(tokens)
    for t in unique_tokens:
        doc_freqs[t] = doc_freqs.get(t, 0) + 1

avg_doc_len = sum(doc_lengths) / max(1, num_docs)
idf = {}
for term, df in doc_freqs.items():
    idf[term] = math.log((num_docs - df + 0.5) / (df + 0.5) + 1.0)

bm25_metadata = {
    "num_docs": num_docs,
    "avg_doc_len": avg_doc_len,
    "idf": idf
}

# ----------------------------------------------------------------------
# 4. GENERATE GPU SEMANTIC EMBEDDINGS
# ----------------------------------------------------------------------
print("\n[4/4] Computing 384-dimensional Semantic Embeddings on GPU (CUDA)...")

device = "cuda" if torch.cuda.is_available() else "cpu"
model_name = "sentence-transformers/all-MiniLM-L6-v2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name).to(device)
model.eval()

batch_size = 64
texts = [f"{c['citation']}: {c['title']}. {c['text'][:600]}" for c in chunks]
all_embeddings = []

start_time = time.time()
with torch.no_grad():
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i+batch_size]
        inputs = tokenizer(batch_texts, padding=True, truncation=True, max_length=512, return_tensors="pt").to(device)
        outputs = model(**inputs)
        # Mean pooling with attention mask
        token_embeddings = outputs.last_hidden_state
        input_mask_expanded = inputs['attention_mask'].unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        pooled = sum_embeddings / sum_mask
        normalized = torch.nn.functional.normalize(pooled, p=2, dim=1)
        all_embeddings.extend(normalized.cpu().numpy().tolist())

elapsed = time.time() - start_time
print(f"  Embedded all {len(chunks)} chunks in {elapsed:.2f} seconds!")

for idx, c in enumerate(chunks):
    c['embedding'] = [round(v, 5) for v in all_embeddings[idx]]
    # Remove raw token list to keep JSON compact
    if 'tokens' in c:
        del c['tokens']

# ----------------------------------------------------------------------
# 5. SAVE COMPILED HYBRID RAG KNOWLEDGE BASE
# ----------------------------------------------------------------------
output_data = {
    "version": "2.0.0",
    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "standards": ["ANSI/ISA-101.01-2015", "NUREG-0700 Rev. 1"],
    "embedding_model": model_name,
    "embedding_dim": 384,
    "total_chunks": len(chunks),
    "bm25_metadata": bm25_metadata,
    "chunks": chunks
}

os.makedirs('src/data', exist_ok=True)
os.makedirs('src-tauri', exist_ok=True)

with open('src/data/rag_knowledge_base.json', 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False)

with open('src-tauri/rag_knowledge_base.json', 'w', encoding='utf-8') as f:
    json.dump(output_data, f, ensure_ascii=False)

size_mb = os.path.getsize('src/data/rag_knowledge_base.json') / (1024 * 1024)
print("\n" + "=" * 65)
print(f"  HYBRID RAG KNOWLEDGE BASE COMPILED SUCCESSFULLY ({size_mb:.2f} MB)")
print(f"  Total Grounded Regulations: {len(chunks)}")
print("  Target Files:")
print("    - src/data/rag_knowledge_base.json")
print("    - src-tauri/rag_knowledge_base.json")
print("=" * 65)
