#!/usr/bin/env python3
"""Extract co-author network from papers.json for visualization widget."""
import json, re
from collections import defaultdict

with open("papers.json") as f:
    papers = json.load(f)

# Normalize author names
MERGE_MAP = {
    "J Ciston": "Jim Ciston",
    "M Scott": "Mary Scott",
    "D Mitlin": "David Mitlin",
    "E Luber": "Erik Luber",
    "V Radmilovic": "V Radmilovic",
    "U Dahmen": "Ulrich Dahmen",
    "U. Dahmen": "Ulrich Dahmen",
}

def normalize(name):
    name = name.strip()
    # Remove trailing periods from initials: "V." -> "V"
    parts = name.split()
    parts = [p.rstrip('.') if len(p.rstrip('.')) <= 2 else p for p in parts]
    # Remove single-letter middle initials
    if len(parts) >= 3:
        parts = [p for i, p in enumerate(parts) if i == 0 or i == len(parts)-1 or len(p) > 1]
    result = " ".join(parts)
    # Apply explicit merges
    return MERGE_MAP.get(result, result)

# Count co-authorships
pair_counts = defaultdict(int)  # (a, b) -> count
author_papers = defaultdict(int)  # author -> paper count
colin_coauthors = defaultdict(int)  # coauthor -> count with Colin

COLIN = "Colin Ophus"

for paper in papers:
    authors = paper.get("authors", [])
    if not authors:
        continue

    # Normalize
    normed = list(dict.fromkeys(normalize(a) for a in authors))  # dedup preserving order

    for a in normed:
        author_papers[a] += 1

    # Check if Colin is on this paper
    has_colin = any("ophus" in a.lower() for a in normed)

    if has_colin:
        for a in normed:
            if "ophus" not in a.lower():
                colin_coauthors[normalize(a)] += 1

    # Count all pairs
    for i in range(len(normed)):
        for j in range(i+1, len(normed)):
            a, b = normed[i], normed[j]
            key = tuple(sorted([a, b]))
            pair_counts[key] += 1

# Build node list: Colin + top N co-authors
MIN_PAPERS = 1  # minimum papers with Colin to be included
top_coauthors = sorted(
    [(name, count) for name, count in colin_coauthors.items() if count >= MIN_PAPERS],
    key=lambda x: -x[1]
)

# Include up to 80 co-authors for readability
MAX_NODES = 500
top_coauthors = top_coauthors[:MAX_NODES-1]

# Build node list
nodes = [{"name": COLIN, "papers": author_papers.get(COLIN, len(papers)), "colinPapers": len(papers)}]
name_to_id = {COLIN: 0}

for name, count in top_coauthors:
    nid = len(nodes)
    name_to_id[name] = nid
    nodes.append({
        "name": name,
        "papers": author_papers[name],
        "colinPapers": count,
    })

# Build edge list
edges = []
included_names = set(name_to_id.keys())
for (a, b), count in pair_counts.items():
    if a in included_names and b in included_names:
        edges.append({
            "source": name_to_id[a],
            "target": name_to_id[b],
            "weight": count,
        })

# Sort edges by weight for rendering (thin first, thick on top)
edges.sort(key=lambda e: e["weight"])

graph = {"nodes": nodes, "edges": edges}

with open("coauthors.json", "w") as f:
    json.dump(graph, f, indent=2, ensure_ascii=False)

print(f"Nodes: {len(nodes)}")
print(f"Edges: {len(edges)}")
print(f"\nTop 20 co-authors:")
for name, count in top_coauthors[:20]:
    print(f"  {name}: {count} papers")
print(f"\nEdge weight range: {min(e['weight'] for e in edges)} - {max(e['weight'] for e in edges)}")
