#!/usr/bin/env python3
"""Regenerate the inlined poster stills in widgets/research-pillars.js.

The research pillars show a tiny still of each live panel immediately, so the landing page
is not blank while Three.js and the sibling widgets download on a slow connection.

1. Start any static server at the repo root (e.g. the "static" config, port 8123).
2. python3 scripts/build_pillar_posters.py      (listens on 127.0.0.1:8799)
3. Open http://localhost:8123/test-pillar-posters.html and then ?dark. Each page posts
   its three panel captures here after ~15 s. Once all six arrive, this script
   compresses them and rewrites the POSTERS block between the markers.

Needs Pillow (any of the repo .venvs that has it, e.g. ~/repos/abTEM/.venv).
"""
import base64, http.server, io, json, os, re, sys
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDGET = os.path.join(ROOT, "widgets", "research-pillars.js")
KINDS, THEMES = ["stem", "comp", "materials"], ["light", "dark"]
SIZE = 160
raw = {}


def encode(im, kind):
    im = im.convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    if kind == "materials":  # thousands of thin edges compress badly; a slight blur halves the size
        im = im.filter(ImageFilter.GaussianBlur(0.8))
    b = io.BytesIO()
    im.save(b, "WEBP", quality=35, method=6, alpha_quality=40)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()


def inject():
    posters = {}
    for k in KINDS:
        light = encode(raw[f"{k}-light"], k)
        posters[k] = {"light": light}
        if k != "comp":  # comp-experiment looks the same in both themes; the widget falls back to light
            posters[k]["dark"] = encode(raw[f"{k}-dark"], k)
    block = "const POSTERS = " + json.dumps(posters, indent=1) + ";"
    src = open(WIDGET, encoding="utf-8").read()
    src = re.sub(r"(// POSTERS-BEGIN\n).*?(\n// POSTERS-END)", lambda m: m.group(1) + block + m.group(2), src, flags=re.S)
    open(WIDGET, "w", encoding="utf-8").write(src)
    print("wrote POSTERS (%d kB inlined)" % (len(block) // 1024))


class Recv(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        for name, url in body.items():
            raw[name.replace(".webp", "")] = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1])))
            print("got", name)
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if all(f"{k}-{t}" in raw for k in KINDS for t in THEMES):
            inject()
            sys.exit(0)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("waiting for captures on 127.0.0.1:8799 ...")
    try:
        http.server.HTTPServer(("127.0.0.1", 8799), Recv).serve_forever()
    except SystemExit:
        pass
