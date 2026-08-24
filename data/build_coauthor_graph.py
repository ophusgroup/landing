#!/usr/bin/env python3
"""Extract co-author network from papers.json for visualization widget."""
import json, re
from collections import defaultdict

with open("papers.json") as f:
    papers = json.load(f)

# Normalize author names.
# Keys are the *normalized* form (output of normalize() before this map is applied);
# values are the canonical display name. Used to merge initial-only / variant spellings
# of the same person so they don't appear as separate, sometimes disconnected, nodes.
MERGE_MAP = {
    # --- pre-existing ---
    "J Ciston": "Jim Ciston",
    "M Scott": "Mary Scott",
    "M.C. Scott": "Mary Scott",
    "D Mitlin": "David Mitlin",
    "E Luber": "Erik Luber",
    "E.J. Luber": "Erik Luber",
    "U Dahmen": "Ulrich Dahmen",
    "U. Dahmen": "Ulrich Dahmen",
    # --- Radmilovic (former "V Radmilovic"->"V Radmilovic" identity bug; also unify accents) ---
    "V Radmilovic": "Velimir Radmilovic",
    "V.R. Radmilovic": "Velimir Radmilovic",
    "Velimir Radmilović": "Velimir Radmilovic",
    "V.R. Radmilović": "Velimir Radmilovic",
    # --- nanoindentation-defect paper cluster (Minor group) ---
    "A Minor": "Andrew Minor",
    "A.M. Minor": "Andrew Minor",
    "C Gammer": "Christoph Gammer",
    "B Ozdol": "Burak Ozdol",
    "V Ozdol": "Burak Ozdol",
    "V.B. Ozdol": "Burak Ozdol",
    "J Morris": "J.W. Morris",
    "R.P. Sankaran": "Rohini Sankaran",
    # --- group members / frequent collaborators (initial or extra-name variants) ---
    "B.H. Savitzky": "Benjamin Savitzky",
    "Steven Eric Zeltmann": "Steven Zeltmann",
    "Arthur R.C. McCray": "Arthur McCray",
    "Arthur RC McCray": "Arthur McCray",
    "Ellis Rae Kennedy": "Ellis Kennedy",
    "P Ercius": "Peter Ercius",
    "R Dhall": "Rohan Dhall",
    "P Pelz": "Philipp Pelz",
    "M Asta": "Mark Asta",
    "D Muller": "David Muller",
    "R Ramesh": "Ramamoorthy Ramesh",
    "L Martin": "Lane Martin",
    "D Schlom": "Darrell Schlom",
    "M Danaie": "Mohsen Danaie",
    "D Dye": "David Dye",
    "C Nelson": "Christopher Nelson",
    "Chris Nelson": "Christopher Nelson",
    "Michele Shelly Conroy": "Michele Conroy",
    "Michael Thompson Pettes": "Michael Pettes",
    # --- other unambiguous initial/variant duplicates ---
    "A.K. Ackerman": "Abigail Ackerman",
    "A.L. Clauser": "Arielle Clauser",
    "L.A. Hughes": "Lauren Hughes",
    "M.K. Santala": "Melissa Santala",
    "R.M. Glaeser": "Robert Glaeser",
    "C Harrower": "Chris Harrower",
    "C.T. Harrower": "Chris Harrower",
    "L Fischer": "L.M. Fischer",
    "A Bostwick": "Aaron Bostwick",
    "E Rotenberg": "Eli Rotenberg",
    "P Denes": "Peter Denes",
    "M Weyland": "Matthew Weyland",
    "S Findlay": "Scott Findlay",
    "T Petersen": "Timothy Petersen",
    "L Allen": "Leslie Allen",
    "D Durham": "Daniel Durham",
    "D Filippetto": "Daniele Filippetto",
    "W Theis": "Wolfgang Theis",
    "M Huijben": "Mark Huijben",
    "M McCarter": "Margaret McCarter",
    "E Terzoudis-Lumsden": "Emmanuel Terzoudis-Lumsden",
    "F Gómez-Ortiz": "Fernando Gómez-Ortiz",
    "P García-Fernández": "Pablo García-Fernández",
    "J Junquera": "Javier Junquera",
    "R Giulian": "Raquel Giulian",
    "M Saoudi": "Mouna Saoudi",
    "H Fritzsche": "Helmut Fritzsche",
    "L Árnadóttir": "Líney Árnadóttir",
    "K Oware Sarfo": "Kofi Oware Sarfo",
    "K Siddiqui": "Khalid Siddiqui",
    "J Haagsma": "Julian Haagsma",
    "R dos Reis": "Roberto dos Reis",
    "A N’Diaye": "Alpha N’Diaye",
    "A Zettl": "Alex Zettl",
    "B Olsen": "Brian Olsen",
    "L Marks": "Laurence Marks",
    "H Brown": "Hamish Brown",
    "L Jin": "Lei Jin",
    "Z Hong": "Zijian Hong",
    "J Turner": "John Turner",
    "Yin-Hao Chu": "Ying-Hao Chu",
    "Shanglin Hsu": "Shang-Lin Hsu",
    "S.-L. Hsu": "Shang-Lin Hsu",
    "Despoina Maria Kepaptsoglou": "Demie Kepaptsoglou",
    "Andre Fernandes Cauduro": "André Fernandes Cauduro",
    "Chirranjeevi Balaji Gopal": "Chirranjeevi Gopal",
    "Theresa Marie Kucinski": "Theresa Kucinski",
    "Han‐Ming Hau": "Han-Ming Hau",
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
