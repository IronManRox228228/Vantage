import json
import re
import math
import numpy as np

with open('src/data/rag_knowledge_base.json', 'r', encoding='utf-8') as f:
    kb = json.load(f)

print(f"Loaded Knowledge Base with {len(kb['chunks'])} chunks from {kb['standards']}.")

test_queries = [
    ("color overuse red yellow non-alarm elements background grayscale ISA-101", "color-overuse"),
    ("excessive alarm flood annunciator density priority grouping NUREG-0700", "alarm-clutter"),
    ("text contrast ratio minimum 4.5:1 luminance legibility font size", "contrast-legibility"),
    ("navigation hierarchy Level 1 overview Level 2 unit detail display", "navigation-clutter")
]

def tokenize(text):
    return [w.lower() for w in re.findall(r'[A-Za-z0-9\-\.\_]+', text) if len(w) > 1]

bm25_meta = kb['bm25_metadata']
avg_dl = bm25_meta['avg_doc_len']
idf = bm25_meta['idf']
k1 = 1.5
b = 0.75

for query, cat in test_queries:
    print("\n" + "=" * 65)
    print(f"Query: {query}")
    print("=" * 65)
    q_tokens = tokenize(query)
    
    scores = []
    for idx, chunk in enumerate(kb['chunks']):
        doc_tokens = tokenize(f"{chunk['standard']} {chunk['section']} {chunk['title']} {chunk['category']} {chunk['text']}")
        doc_len = len(doc_tokens)
        score = 0.0
        for t in q_tokens:
            if t in idf:
                tf = doc_tokens.count(t)
                if tf > 0:
                    numerator = idf[t] * tf * (k1 + 1)
                    denominator = tf + k1 * (1 - b + b * (doc_len / avg_dl))
                    score += numerator / denominator
        if chunk['category'] == cat:
            score *= 1.3
        scores.append((score, chunk))
    
    scores.sort(key=lambda x: x[0], reverse=True)
    print("Top Grounded Regulations Retrieved:")
    for rank, (score, chunk) in enumerate(scores[:3]):
        print(f"  #{rank+1} [{chunk['citation']}] {chunk['title']} (Score: {score:.2f})")
        print(f"      Grounded Clause: {chunk['text'][:180]}...\n")
