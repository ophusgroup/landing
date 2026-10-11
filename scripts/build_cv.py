#!/usr/bin/env python3
"""Build cv.md (the web CV) from Colin's LaTeX CV.

The LaTeX file in Dropbox/Overleaf is the source of truth for now. Re-run after
editing it:

    python3 scripts/build_cv.py [path/to/main.tex]

Commented-out LaTeX is ignored. The phone number and home address in the LaTeX
header are deliberately left off the public page.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TEX = os.path.expanduser(
    "~/Library/CloudStorage/Dropbox/Apps/ShareLaTeX/ColinOphusCV/main.tex")
OUT = os.path.join(ROOT, "cv.md")

ACCENTS = {
    ("'", "a"): "á", ("'", "e"): "é", ("'", "i"): "í", ("'", "o"): "ó",
    ("'", "u"): "ú", ("'", "A"): "Á", ("'", "E"): "É", ("'", "c"): "ć",
    ("'", "n"): "ń", ("'", "s"): "ś", ("'", "z"): "ź",
    ('"', "a"): "ä", ('"', "o"): "ö", ('"', "u"): "ü", ('"', "A"): "Ä",
    ('"', "O"): "Ö", ('"', "U"): "Ü",
    ("`", "a"): "à", ("`", "e"): "è", ("~", "n"): "ñ", ("~", "a"): "ã",
    ("^", "o"): "ô", ("^", "e"): "ê", ("c", "c"): "ç", ("v", "c"): "č",
    ("v", "s"): "š", ("v", "z"): "ž", ("v", "r"): "ř",
}
GREEK = {"alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "pi": "π",
         "omega": "ω", "mu": "μ", "circ": "°", "sigma": "σ", "theta": "θ"}


def strip_comments(tex):
    return "\n".join(re.sub(r"(?<!\\)%.*", "", line) for line in tex.splitlines())


def braced(s, i):
    """Return (content, end) of the {...} group starting at s[i] == '{'."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == "{" and (j == 0 or s[j - 1] != "\\"):
            depth += 1
        elif s[j] == "}" and s[j - 1] != "\\":
            depth -= 1
            if depth == 0:
                return s[i + 1:j], j + 1
    raise ValueError("unbalanced braces: " + s[i:i + 80])


def replace_cmd(s, name, fn, nargs=1):
    """Replace \\name{a}{b}... with fn(a, b, ...), handling nested braces."""
    pat = re.compile(r"\\" + name + r"\s*(?=\{)")
    while True:
        m = pat.search(s)
        if not m:
            return s
        args, k = [], m.end()
        for _ in range(nargs):
            a, k = braced(s, k)
            args.append(a)
        s = s[:m.start()] + fn(*args) + s[k:]


def math_to_md(m):
    body = m.group(1).strip()
    if body == r"\sqbullet" or re.fullmatch(r"(\\:)+", body):
        return ""
    for k, v in GREEK.items():
        body = re.sub(r"\\" + k + r"\b", v, body)
    out = ""
    for sym, arg in re.findall(r"([_^])(\{[^}]*\}|.)", body) or []:
        arg = arg.strip("{}")
        if sym == "^" and arg == "*":
            out += "\\*"
        elif sym == "^" and arg == "°":
            out += "°"
        else:
            out += "\x00%s\x01%s\x02" % ("sub" if sym == "_" else "sup", arg)
    rest = re.sub(r"([_^])(\{[^}]*\}|.)", "", body)
    return rest + out


def link_url(url):
    """MyST turns any doi.org link into a citation and fetches its metadata at build
    time (minutes for ~270 papers, plus a giant bibliography). The Handle resolver
    with an encoded slash redirects to the same article but stays a plain link."""
    m = re.match(r"https?://(?:dx\.)?(?:www\.)?doi\.org/(?:doi:)?(10\.\d+)/(.+)", url)
    return "https://hdl.handle.net/%s%%2F%s" % m.groups() if m else url


def tex_to_md(s):
    s = re.sub(r"\\(vspace|hspace)\*?\{[^}]*\}", "", s)
    s = re.sub(r"\\(extraSpace|hline|noindent|justifying|newline)\b", " ", s)
    s = re.sub(r"\$([^$]*)\$", math_to_md, s)
    s = re.sub(r"\\([\"'`~^])\{?([A-Za-z])\}?",
               lambda m: ACCENTS.get((m.group(1), m.group(2)), m.group(2)), s)
    s = re.sub(r"\\([cv])\{([A-Za-z])\}",
               lambda m: ACCENTS.get((m.group(1), m.group(2)), m.group(2)), s)
    s = re.sub(r"\{?\\ss\}?", "ß", s)
    s = re.sub(r"\\AA(\{\})?", "Å", s)
    s = s.replace(r"\ldots", "…").replace("``", "“").replace("''", "”")
    s = s.replace("---", "—").replace("--", "–")
    s = replace_cmd(s, "underline", lambda a: "**%s**" % a)
    s = replace_cmd(s, "emph", lambda a: "*%s*" % a)
    s = replace_cmd(s, "textbf", lambda a: "**%s**" % a)
    s = re.sub(r"\{\s*\\bf\s+([^{}]*)\}", lambda m: "**%s**" % m.group(1).strip(), s)
    s = re.sub(r"\{\s*\\it\s+([^{}]*)\}", lambda m: "*%s*" % m.group(1).strip(), s)
    s = replace_cmd(s, "href", lambda u, t: "[%s](%s)" % (t.strip(), link_url(u.replace(r"\&", "&"))), 2)
    s = s.replace(r"\&", "&").replace(r"\%", "%").replace(r"\$", "\\$").replace(r"\_", "_")
    s = s.replace("~", "\u00a0")
    s = re.sub(r"(?<!\\)[{}]", "", s)
    s = re.sub(r"\*\*\s*\*\*", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+([,.;])", r"\1", s)
    s = re.sub(r"\s*–\s*(?=\d)", "–", s)  # "2010 --2012" -> "2010–2012"
    s = s.replace("\x00", "{").replace("\x01", "}`").replace("\x02", "`")
    return s


def section(tex, title):
    m = re.search(r"\\section\*\{" + re.escape(title) + r"[^}]*\}(.*?)(?=\\section\*|\\end\{document\})",
                  tex, re.S)
    return m.group(1)


def table_rows(body):
    """Rows of the first tabularx in body, each a list of cell strings."""
    i = body.index(r"\begin{tabularx}") + len(r"\begin{tabularx}")
    _, i = braced(body, i)  # width
    _, i = braced(body, i)  # column spec (may nest braces)
    inner = body[i:body.index(r"\end{tabularx}", i)]
    rows = []
    for raw in re.split(r"\\\\", inner):
        if not raw.strip():
            continue
        cells = [c.strip() for c in re.split(r"(?<!\\)&", raw)]
        if any(cells):
            rows.append(cells)
    return rows


def dated_entries(rows):
    """Collapse (date, text) rows; rows with an empty date continue the previous entry."""
    entries = []
    for cells in rows:
        date, text = tex_to_md(cells[0]), cells[1] if len(cells) > 1 else ""
        bullet = r"\sqbullet" in text
        text = tex_to_md(text)
        if not text:
            continue
        if date or not entries:
            entries.append([date, [text], []])
        elif bullet:
            entries[-1][2].append(text)
        else:
            entries[-1][1].append(text)
    return entries


def dated_list(entries):
    out = []
    for date, lines, bullets in entries:
        out.append("- **%s** · %s" % (date, "  \n  ".join(lines)))
        for b in bullets:
            out.append("  - " + b)
    return "\n".join(out) + "\n"


def numbered(rows, counter_start):
    """Single-column rows numbered downward (matches the LaTeX \\pubnumrev counter)."""
    items, n = [], counter_start
    for cells in rows:
        n -= 1
        items.append((n, tex_to_md(cells[-1])))
    return items


def by_year(items, year_of):
    groups = {}
    for it in items:
        groups.setdefault(year_of(it), []).append(it)
    return sorted(groups.items(), key=lambda kv: -int(kv[0]) if kv[0].isdigit() else 0)


def main():
    tex_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TEX
    tex = strip_comments(open(tex_path, encoding="utf-8").read())

    interests = tex_to_md(" ".join(" ".join(r) for r in table_rows(section(tex, "Research Interests"))))
    experience = dated_entries(table_rows(section(tex, "Professional Experience")))
    education = dated_entries(table_rows(section(tex, "Education")))
    support = tex_to_md(" ".join(" ".join(r) for r in table_rows(section(tex, "Current Research Support"))))
    grants = dated_entries(table_rows(section(tex, "Selected Grants, Awards, and Scholarships")))
    academic = dated_entries(table_rows(section(tex, "Academic Experience")))

    pub_sec = section(tex, "Peer-Reviewed Publications")
    pubs = numbered(table_rows(pub_sec), int(re.search(r"\\setcounter\{pubno\}\{(\d+)\}", pub_sec).group(1)))
    talk_sec = section(tex, "Selected Conference Presentations")
    talks = numbered(table_rows(talk_sec), int(re.search(r"\\setcounter\{pubno\}\{(\d+)\}", talk_sec).group(1)))

    def pub_year(it):
        tail = it[1].rsplit("](", 1)[-1].split(")", 1)[-1]  # text after the title link
        ys = re.findall(r"\b((?:19|20)\d\d)\b", tail)
        return ys[-1] if ys else "Other"

    def talk_year(it):
        m = re.match(r"(\d{4})", it[1])
        return m.group(1) if m else "Other"

    md = []
    md.append("---\ntitle: Curriculum Vitae\ndescription: Curriculum vitae of Colin Ophus, "
              "Associate Professor of Materials Science and Engineering at Stanford University.\n---\n")
    md.append(":::{anywidget} ./widgets/section-nav.js\n{}\n:::\n")
    md.append("**Colin Ophus**  \nAssociate Professor, Materials Science and Engineering, Stanford University  \n"
              "[cophus@stanford.edu](mailto:cophus@stanford.edu) · "
              "[Google Scholar](https://scholar.google.com/citations?hl=en&user=h5MPYJAAAAAJ&view_op=list_works&sortby=pubdate) · "
              "[ORCID](https://orcid.org/0000-0003-2348-8558) · [GitHub](https://github.com/cophus) · "
              "[Group website](https://colab.stanford.edu/)\n")
    md.append("## Research Interests\n\n" + interests + "\n")
    md.append("## Professional Experience\n\n" + dated_list(experience))
    md.append("## Education\n\n" + dated_list(education))
    md.append("## Current Research Support\n\n" + support + "\n")
    md.append("## Grants and Awards\n\n" + dated_list(grants))
    md.append("## Academic Service and Teaching\n\n" + dated_list(academic))

    md.append("## Peer-Reviewed Publications\n")
    for year, items in by_year(pubs, pub_year):
        md.append("**%s**\n" % year)
        # Markdown ordered lists renumber upward, so the descending CV numbers are written as text.
        md.append("\n".join("- **%d.** %s" % (n, t) for n, t in items) + "\n")

    md.append("## Invited Talks\n")
    for year, items in by_year(talks, talk_year):
        md.append("**%s**\n" % year)
        md.append("\n".join("- " + re.sub(r"^%s\s*" % year, "", t).lstrip(", ") for _, t in items) + "\n")

    open(OUT, "w", encoding="utf-8").write("\n".join(md))
    print("wrote %s: %d publications, %d talks" % (OUT, len(pubs), len(talks)))


if __name__ == "__main__":
    main()
