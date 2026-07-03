#!/usr/bin/env python3
"""Build data/papers_hover.json — pre-baked hover-card data for the publications
list, keyed by lowercased DOI: {"<doi>": {"abstract": "...", "image": "..."}}.

  abstract  OpenAlex, batched OR-filter by DOI, reconstructed from the inverted
            index (~90% coverage across the list).
  image     og:image (graphical abstract) from the publisher landing page. Only
            Springer Nature (10.1038) reliably serves it to a scripted fetch --
            every other publisher returns a bot-challenge page -- so only those
            get an image automatically. To feature a figure on any other paper,
            add an "image": "<url>" by hand to that DOI's entry in the output.

Kept OUT of papers.json on purpose so the main list stays lean; the widget
lazy-loads this file only when a reader hovers.

Re-run after adding papers:  python3 scripts/build_papers_hover.py
"""
import html, json, re, sys, time, urllib.request, urllib.parse, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPERS = os.path.join(ROOT, "data", "papers.json")
OUT = os.path.join(ROOT, "data", "papers_hover.json")
MAILTO = "cophus@gmail.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120 Safari/537.36")


def norm_doi(u):
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", (u or "").strip(), flags=re.I).lower()


def fetch(url, timeout=30, as_json=True):
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Accept": "application/json" if as_json else "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read().decode("utf-8", "replace")
    return json.loads(body) if as_json else body


def reconstruct(inv):
    if not inv:
        return None
    pos = sorted((p, w) for w, ps in inv.items() for p in ps)
    return " ".join(w for _, w in pos).strip() or None


papers = json.load(open(PAPERS))
dois = [norm_doi(p["url"]) for p in papers]

# Incremental: keep whatever was already harvested (and any hand-added images).
hover = {}
if os.path.exists(OUT):
    try:
        hover = json.load(open(OUT))
    except Exception:
        hover = {}


def fetch_one_abstract(doi):
    url = ("https://api.openalex.org/works/doi:" + urllib.parse.quote(doi, safe="")
           + "?select=abstract_inverted_index&mailto=" + MAILTO)
    try:
        return reconstruct(fetch(url).get("abstract_inverted_index"))
    except Exception:
        return None


# --- abstracts: OpenAlex batched, per-DOI fallback on batch failure; only DOIs still missing ---
need = [d for d in dois if d and "abstract" not in hover.get(d, {})]
BATCH, got = 40, 0
for i in range(0, len(need), BATCH):
    chunk = need[i:i + BATCH]
    url = "https://api.openalex.org/works?" + urllib.parse.urlencode({
        "filter": "doi:" + "|".join(chunk),
        "per-page": len(chunk),
        "select": "doi,abstract_inverted_index",
        "mailto": MAILTO,
    })
    ok = False
    try:
        for w in fetch(url).get("results", []):
            d = norm_doi(w.get("doi") or "")
            a = reconstruct(w.get("abstract_inverted_index"))
            if d and a:
                hover.setdefault(d, {})["abstract"] = a
                got += 1
        ok = True
    except Exception as e:
        print(f"  batch @{i} failed ({e}); retrying per-DOI", file=sys.stderr)
    if not ok:
        for d in chunk:
            a = fetch_one_abstract(d)
            if a:
                hover.setdefault(d, {})["abstract"] = a
                got += 1
            time.sleep(0.2)
    time.sleep(0.4)
print(f"abstracts: +{got} this run, "
      f"{sum('abstract' in v for v in hover.values())}/{len(dois)} total", file=sys.stderr)

# --- images: og:image from Springer Nature (others block scripted fetches); only missing ---
og = re.compile(r"<meta[^>]+(?:property|name)=[\"']og:image[\"'][^>]*>", re.I)
con = re.compile(r"content=[\"']([^\"']+)[\"']", re.I)
springer = [d for d in dois if d.startswith("10.1038/") and "image" not in hover.get(d, {})]
imgs = 0
for d in springer:
    try:
        m = og.search(fetch("https://doi.org/" + d, timeout=25, as_json=False))
        if m:
            c = con.search(m.group(0))
            if c:
                hover.setdefault(d, {})["image"] = html.unescape(c.group(1))
                imgs += 1
    except Exception:
        pass
    time.sleep(0.25)
print(f"images: +{imgs} this run, {sum('image' in v for v in hover.values())} total", file=sys.stderr)

json.dump(hover, open(OUT, "w"), ensure_ascii=False, indent=1, sort_keys=True)
print(f"wrote {OUT}: {len(hover)} entries "
      f"({sum('abstract' in v for v in hover.values())} abstracts, "
      f"{sum('image' in v for v in hover.values())} images)", file=sys.stderr)
