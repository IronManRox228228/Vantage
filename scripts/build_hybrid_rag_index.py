import os
import re
import json
import time
import math
import pypdf
import requests
import dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

dotenv.load_dotenv()
API_KEY = os.environ.get('GEMINI_API_KEY')

print("=" * 60)
print("  Vantage HMI Auditor - Hybrid RAG Index Builder")
print("  Sources: ANSI/ISA-101.01-2015 + NUREG-0700 Rev. 1")
print("=" * 60)

chunks = []

# ----------------------------------------------------------------------
# 1. PARSE ANSI/ISA-101.01-2015
# ----------------------------------------------------------------------
print("\n[1/3] Parsing ANSI/ISA-101.01-2015 transcription...")
with open('data/isa101_transcribed.json', 'r', encoding='utf-8') as f:
    isa_pages = json.load(f)

# Reconstruct full text with page markers
full_isa_text = ""
for p_num in sorted([int(k) for k in isa_pages.keys()]):
    full_isa_text += f"\n\n--- [ISA-101 Page {p_num}] ---\n" + isa_pages[str(p_num)]

# Regex for ISA-101 sections e.g. "4.1 ...", "5.2 Display Hierarchy", "5.3 Use of Color"
isa_section_regex = re.compile(r'\n(?=(\d+\.\d+(?:\.\d+)?)\s+([A-Z][^\n\r]+))')
sections = isa_section_regex.split(full_isa_text)

# Break into section chunks
i = 1
while i < len(sections):
    sec_num = sections[i].strip()
    sec_title = sections[i+1].strip() if i+1 < len(sections) else "Section"
    sec_body = sections[i+2].strip() if i+2 < len(sections) else ""
    i += 3

    if len(sec_body) < 50:
        continue

    # Categorization heuristics
    combined_header = f"{sec_num} {sec_title}".lower()
    cat = "general"
    if "color" in combined_header:
        cat = "color-overuse"
    elif "alarm" in combined_header:
        cat = "alarm-clutter"
    elif "density" in combined_header or "layout" in combined_header or "information" in combined_header:
        cat = "information-density"
    elif "navigat" in combined_header or "hierarchy" in combined_header:
        cat = "navigation-clutter"
    elif "contrast" in combined_header or "legib" in combined_header:
        cat = "contrast-legibility"
    elif "trend" in combined_header or "analog" in combined_header or "graphic" in combined_header:
        cat = "trends-and-analog"

    # Further split long sections (> 1500 chars) into sub-chunks for high retrieval precision
    sub_paragraphs = [p.strip() for p in sec_body.split('\n\n') if len(p.strip()) > 40]
    current_sub = ""
    sub_idx = 1
    for p in sub_paragraphs:
        if len(current_sub) + len(p) > 1200 and len(current_sub) > 200:
            chunks.append({
                "id": f"ISA101_{sec_num.replace('.', '_')}_{sub_idx}",
                "standard": "ANSI/ISA-101.01-2015",
                "section": sec_num,
                "title": f"{sec_title} (Part {sub_idx})",
                "category": cat,
                "text": current_sub.strip(),
                "citation": f"ANSI/ISA-101.01-2015 §{sec_num}"
            })
            sub_idx += 1
            current_sub = p + "\n"
        else:
            current_sub += p + "\n"
    if len(current_sub.strip()) > 40:
        chunks.append({
            "id": f"ISA101_{sec_num.replace('.', '_')}_{sub_idx}",
            "standard": "ANSI/ISA-101.01-2015",
            "section": sec_num,
            "title": sec_title if sub_idx == 1 else f"{sec_title} (Part {sub_idx})",
            "category": cat,
            "text": current_sub.strip(),
            "citation": f"ANSI/ISA-101.01-2015 §{sec_num}"
        })

print(f"  Extracted {len(chunks)} high-precision chunks from ANSI/ISA-101.01-2015.")

# ----------------------------------------------------------------------
# 2. PARSE NUREG-0700 Rev. 1
# ----------------------------------------------------------------------
print("\n[2/3] Parsing NUREG-0700 Rev. 1 PDF...")
nureg_reader = pypdf.PdfReader(r'C:\Users\Ashman Das\Downloads\29013055.pdf')
full_nureg_text = ""
for page_idx in range(len(nureg_reader.pages)):
    txt = nureg_reader.pages[page_idx].extract_text() or ''
    full_nureg_text += f"\n\n--- [NUREG-0700 Page {page_idx+1}] ---\n" + txt

# Pattern for NUREG-0700 individual guidelines: e.g. "1.1-1 Continuous Display of Critical Information" or "1.3.4-2"
nureg_guideline_regex = re.compile(r'\n(?=(\d+\.[\d\.\-]+)\s+([A-Z][^\n\r]+))')
nureg_splits = nureg_guideline_regex.split(full_nureg_text)

nureg_count = 0
j = 1
while j < len(nureg_splits):
    g_num = nureg_splits[j].strip()
    g_title = nureg_splits[j+1].strip() if j+1 < len(nureg_splits) else "Guideline"
    g_body = nureg_splits[j+2].strip() if j+2 < len(nureg_splits) else ""
    j += 3

    if len(g_body) < 60 or len(g_num) < 3 or ('-' not in g_num and '.' not in g_num):
        continue

    # Filter only relevant HMI / SCADA sections (Sections 1, 2, 3, 4, 5, 6, 7, 8, 10)
    top_sec = g_num.split('.')[0]
    if top_sec not in ['1', '2', '3', '4', '5', '6', '7', '8', '10']:
        continue

    cat = "general"
    lower_title = f"{g_num} {g_title} {g_body[:300]}".lower()
    if "color" in lower_title or "chromatic" in lower_title:
        cat = "color-overuse"
    elif "alarm" in lower_title or "annunciator" in lower_title:
        cat = "alarm-clutter"
    elif "density" in lower_title or "clutter" in lower_title or "crowd" in lower_title or "grouping" in lower_title:
        cat = "information-density"
    elif "navigat" in lower_title or "menu" in lower_title or "hierarchy" in lower_title or "window" in lower_title:
        cat = "navigation-clutter"
    elif "contrast" in lower_title or "luminance" in lower_title or "legib" in lower_title or "font" in lower_title or "size" in lower_title:
        cat = "contrast-legibility"
    elif "trend" in lower_title or "graph" in lower_title or "scale" in lower_title or "dial" in lower_title:
        cat = "trends-and-analog"

    # Truncate clean guideline text
    clean_text = g_body[:1800].strip()
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
print(f"  Total knowledge base chunks: {len(chunks)}")

# ----------------------------------------------------------------------
# 3. BUILD BM25 LEXICAL INDEX & TOKENIZATION
# ----------------------------------------------------------------------
print("\n[3/3] Generating BM25 Index & Gemini Embeddings...")

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
# 4. GENERATE GEMINI EMBEDDINGS (Batch concurrent)
# ----------------------------------------------------------------------
print(f"  Generating semantic vectors for {len(chunks)} chunks using gemini-embedding-2 (768-dim)...")

def get_embedding(chunk_item):
    text_to_embed = f"{chunk_item['citation']}: {chunk_item['title']}. {chunk_item['text'][:1000]}"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={API_KEY}"
    payload = {
        "model": "models/gemini-embedding-2",
        "content": {"parts": [{"text": text_to_embed}]},
        "outputDimensionality": 768
    }
    for attempt in range(5):
        try:
            resp = requests.post(url, json=payload, timeout=30)
            if resp.status_code == 200:
                emb = resp.json()['embedding']['values']
                return chunk_item['id'], emb
            elif resp.status_code == 429:
                time.sleep(2 * (attempt + 1))
            else:
                time.sleep(1)
        except Exception:
            time.sleep(1)
    return chunk_item['id'], [0.0] * 768

embeddings_map = {}
batch_size = 8
chunk_list = list(chunks)

with ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(get_embedding, c) for c in chunk_list]
    completed = 0
    for f in as_completed(futures):
        cid, emb = f.result()
        embeddings_map[cid] = emb
        completed += 1
        if completed % 50 == 0 or completed == len(chunk_list):
            print(f"    Embedded {completed}/{len(chunk_list)} chunks...")

for c in chunks:
    c['embedding'] = embeddings_map.get(c['id'], [0.0] * 768)

# ----------------------------------------------------------------------
# 5. EXPORT UNIFIED RAG KNOWLEDGE BASE
# ----------------------------------------------------------------------
final_output = {
    "version": "1.0",
    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "standards": ["ANSI/ISA-101.01-2015", "NUREG-0700 Rev. 1"],
    "total_chunks": len(chunks),
    "bm25_metadata": bm25_metadata,
    "chunks": chunks
}

os.makedirs('src/data', exist_ok=True)
os.makedirs('src-tauri', exist_ok=True)

with open('src/data/rag_knowledge_base.json', 'w', encoding='utf-8') as f:
    json.dump(final_output, f, ensure_ascii=False)

with open('src-tauri/rag_knowledge_base.json', 'w', encoding='utf-8') as f:
    json.dump(final_output, f, ensure_ascii=False)

print("\n" + "=" * 60)
print(f"  SUCCESS! Hybrid RAG Knowledge Base built with {len(chunks)} grounded chunks.")
print("  Saved to: src/data/rag_knowledge_base.json & src-tauri/rag_knowledge_base.json")
print("=" * 60)
