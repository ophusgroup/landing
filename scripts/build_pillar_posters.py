#!/usr/bin/env python3
"""Regenerate the poster stills for widgets/research-pillars.js.

The research pillars show a sharp still of each live panel while Three.js and the sibling
widgets download on a slow connection, then fade to the live widget. The stills are
native-resolution webp files (captured at the real panel size on a 2x screen) in images/research/ (poster-<kind>-<theme>.webp), captured at
each widget's first frame so the fade is seamless.

1. Start any static server at the repo root (e.g. the "static" config, port 8123).
2. python3 scripts/build_pillar_posters.py      (listens on 127.0.0.1:8799)
3. Open http://localhost:8123/test-pillar-posters.html and then ?dark. Each page posts
   its three panel captures here; once all six arrive the files are written.

Needs Pillow (any of the repo .venvs that has it, e.g. ~/repos/abTEM/.venv).
"""
import base64, http.server, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "research")
KINDS, THEMES = ["stem", "comp", "materials"], ["light", "dark"]
PAGE_BG = {"light": (255, 255, 255), "dark": (28, 25, 23)}  # book-theme body background (stone-900 in dark)
raw = {}


def write_all():
    for k in KINDS:
        for t in THEMES:
            if k == "comp" and t == "dark":
                continue  # comp-experiment looks the same in both themes; the widget falls back to light
            path = os.path.join(OUT, f"poster-{k}-{t}.webp")
            # Flatten onto the page background: transparency doubles the file size (the
            # semi-transparent tetrahedra are expensive to encode) and the theme colours are fixed.
            im = raw[f"{k}-{t}"].convert("RGBA")
            flat = Image.new("RGBA", im.size, PAGE_BG[t] + (255,))
            flat.alpha_composite(im)
            flat.convert("RGB").save(path, "WEBP", quality=80, method=6)
            print("wrote", os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, "kB")


class Recv(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        for name, url in body.items():
            raw[name.rsplit(".", 1)[0]] = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1])))
            print("got", name)
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if all(f"{k}-{t}" in raw for k in KINDS for t in THEMES):
            write_all()
            sys.exit(0)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print("waiting for captures on 127.0.0.1:8799 ...")
    try:
        http.server.HTTPServer(("127.0.0.1", 8799), Recv).serve_forever()
    except SystemExit:
        pass
