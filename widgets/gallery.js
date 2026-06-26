// COLab Gallery — anywidget ESM module.
//
// Renders a list of photo "albums" (newest-first) as: a full-width hero image per
// album with the album title + optional one-sentence caption overlaid on a dark
// gradient scrim (for readability), followed by a responsive thumbnail grid of the
// remaining photos. Images lazy-load and fade in; clicking any photo opens a
// full-screen lightbox with keyboard / arrow navigation across the whole gallery.
//
// Data is supplied via the anywidget directive body (the model state):
//   {
//     "intro": "A short line shown above the albums.",
//     "image_base": "https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/images/gallery",
//     "albums": [
//       { "folder": "2026_painting", "title": "Painting (2026)",
//         "caption": "Optional one sentence.", "cover": "b.jpg",
//         "images": ["a.jpg", "b.jpg"] },
//       ...
//     ]
//   }
// `title` falls back to a prettified folder name; `caption` is optional.
// The hero (large, captioned) image is `cover` if given, otherwise images[0];
// the rest tile below it. Album order in the array == display order (newest first).

const CSS = `
:host { display:block; color:inherit; }
* { box-sizing:border-box; }
.intro { margin:0 0 22px; font-size:1.02rem; line-height:1.45; opacity:.85; }
.album { margin:0 0 34px; }
.hero { position:relative; margin:0; overflow:hidden; border-radius:14px; cursor:zoom-in;
  background:rgba(127,127,127,.12); }
.hero img { width:100%; aspect-ratio:16/9; max-height:56vh; min-height:220px;
  object-fit:cover; display:block; }
.hero .cap { position:absolute; left:0; right:0; bottom:0; padding:46px 22px 18px; color:#fff;
  background:linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.44) 34%, rgba(0,0,0,0) 76%);
  text-shadow:0 1px 4px rgba(0,0,0,.6); pointer-events:none; }
.hero .cap .t { display:block; font-size:1.55rem; font-weight:700; line-height:1.15; letter-spacing:.2px; }
.hero .cap .c { display:block; margin-top:5px; font-size:1rem; line-height:1.35; opacity:.95; max-width:62ch; }
.grid { display:grid; gap:10px; margin-top:10px;
  grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); }
.tile { position:relative; margin:0; overflow:hidden; border-radius:11px; cursor:zoom-in;
  background:rgba(127,127,127,.12); }
.tile img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; }
.hero img, .tile img { transition:transform .5s ease; }
.hero:hover img, .tile:hover img { transform:scale(1.04); }
@media (prefers-reduced-motion: reduce){
  .hero:hover img, .tile:hover img { transform:none; }
}
/* lightbox (rendered in a body-level shadow root so position:fixed is viewport-anchored) */
.lb { position:fixed; inset:0; z-index:2147483000; display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.93); }
.lb[hidden]{ display:none; }
.lb-img { max-width:92vw; max-height:86vh; object-fit:contain; border-radius:6px;
  box-shadow:0 12px 48px rgba(0,0,0,.55); }
.lb-cap { position:absolute; left:0; right:0; bottom:18px; text-align:center; color:#fff;
  font-size:.95rem; line-height:1.4; text-shadow:0 1px 3px #000; padding:0 64px; pointer-events:none; }
.lb-btn { position:absolute; background:rgba(20,20,20,.45); color:#fff; border:1px solid rgba(255,255,255,.28);
  border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;
  line-height:1; transition:background .15s ease; padding:0; }
.lb-btn:hover { background:rgba(255,255,255,.2); }
.lb-close { top:16px; right:16px; width:42px; height:42px; font-size:24px; }
.lb-prev, .lb-next { top:50%; transform:translateY(-50%); width:48px; height:48px; font-size:30px; }
.lb-prev { left:16px; } .lb-next { right:16px; }
@media (max-width:600px){
  .hero .cap .t { font-size:1.3rem; }
  .lb-prev, .lb-next { width:40px; height:40px; font-size:26px; }
  .lb-cap { padding:0 46px; }
}
`;

function render({ model, el }) {
  function opt(k, d) {
    try { var v = model.get(k); return (v === undefined || v === null) ? d : v; }
    catch (e) { return d; }
  }

  var base = String(opt("image_base",
    "https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/images/gallery")).replace(/\/+$/, "");
  var intro = opt("intro", "");
  var albums = opt("albums", null);
  var dataUrl = opt("data_url", "");

  // Tear down any lightbox host left behind by a previous render of this widget.
  try {
    var stale = document.querySelectorAll(".colab-gallery-lb-host");
    Array.prototype.forEach.call(stale, function (n) { n.remove(); });
  } catch (e) {}

  var root;
  try { root = el.shadowRoot || el.attachShadow({ mode: "open" }); }
  catch (e) { root = el; }
  root.innerHTML = "";
  var style = document.createElement("style"); style.textContent = CSS; root.appendChild(style);
  var wrap = document.createElement("div"); root.appendChild(wrap);

  var flat = [];        // flattened {src, title, caption} in display order, for the lightbox
  var keyHandler = null;

  function srcFor(folder, file) {
    // encode each path segment so spaces/parens/etc. in filenames resolve on dev + CDN
    return base + "/" + encodeURIComponent(folder) + "/" + encodeURIComponent(file);
  }

  function prettify(folder) {
    var m = /^(\d{4})[_-]?(.*)$/.exec(folder || "");
    var year = m ? m[1] : "";
    var rest = m ? m[2] : (folder || "");
    var t = rest.replace(/[_-]+/g, " ").trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    if (!t) t = folder || "";
    return year ? (t + " (" + year + ")") : t;
  }
  function titleOf(a) { return a.title ? a.title : prettify(a.folder); }

  function makeImg(src, alt) {
    var img = document.createElement("img");
    img.alt = alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = src;
    return img;
  }

  function build(list) {
    list = Array.isArray(list) ? list : [];
    list.forEach(function (a) {
      var folder = a.folder || "";
      var imgs = Array.isArray(a.images) ? a.images : [];
      if (!imgs.length) return;
      var title = titleOf(a), caption = a.caption || "";

      var section = document.createElement("section"); section.className = "album";

      // Hero = the album's `cover` image if given, else its first image, with the
      // title/caption overlaid. The remaining images go to the grid (hero excluded).
      var heroFile = (a.cover && imgs.indexOf(a.cover) !== -1) ? a.cover : imgs[0];
      var rest = imgs.filter(function (f) { return f !== heroFile; });
      var heroIdx = flat.length;
      var heroSrc = srcFor(folder, heroFile);
      flat.push({ src: heroSrc, title: title, caption: caption });
      var hero = document.createElement("figure"); hero.className = "hero";
      hero.appendChild(makeImg(heroSrc, title));
      var cap = document.createElement("figcaption"); cap.className = "cap";
      var t = document.createElement("span"); t.className = "t"; t.textContent = title; cap.appendChild(t);
      if (caption) {
        var c = document.createElement("span"); c.className = "c"; c.textContent = caption; cap.appendChild(c);
      }
      hero.appendChild(cap);
      hero.addEventListener("click", function () { openLb(heroIdx); });
      section.appendChild(hero);

      // Remaining images in a responsive thumbnail grid.
      if (rest.length) {
        var grid = document.createElement("div"); grid.className = "grid";
        rest.forEach(function (file) {
          var idx = flat.length;
          var src = srcFor(folder, file);
          flat.push({ src: src, title: title, caption: caption });
          var tile = document.createElement("figure"); tile.className = "tile";
          tile.appendChild(makeImg(src, title));
          tile.addEventListener("click", function () { openLb(idx); });
          grid.appendChild(tile);
        });
        section.appendChild(grid);
      }
      wrap.appendChild(section);
    });
    buildLightbox();
  }

  // ---- lightbox (lives in its own shadow host on <body>) ----
  var lbHost, lb, lbImg, lbCap, cur = 0, prevOverflow = "";

  function btn(cls, label, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "lb-btn " + cls; b.textContent = label;
    b.setAttribute("aria-label", cls.replace("lb-", ""));
    b.addEventListener("click", fn);
    return b;
  }
  function buildLightbox() {
    lbHost = document.createElement("div"); lbHost.className = "colab-gallery-lb-host";
    document.body.appendChild(lbHost);
    var lbRoot;
    try { lbRoot = lbHost.attachShadow({ mode: "open" }); } catch (e) { lbRoot = lbHost; }
    var st = document.createElement("style"); st.textContent = CSS; lbRoot.appendChild(st);

    lb = document.createElement("div"); lb.className = "lb"; lb.hidden = true;
    lbImg = document.createElement("img"); lbImg.className = "lb-img"; lbImg.alt = "";
    lbCap = document.createElement("div"); lbCap.className = "lb-cap";
    lbImg.addEventListener("click", function (e) { e.stopPropagation(); });
    lb.addEventListener("click", closeLb); // click backdrop to close
    lb.appendChild(lbImg);
    lb.appendChild(lbCap);
    lb.appendChild(btn("lb-close", "×", closeLb));
    var prev = btn("lb-prev", "‹", function (e) { e.stopPropagation(); step(-1); });
    var next = btn("lb-next", "›", function (e) { e.stopPropagation(); step(1); });
    lb.appendChild(prev); lb.appendChild(next);
    if (flat.length <= 1) { prev.style.display = "none"; next.style.display = "none"; }
    lbRoot.appendChild(lb);
  }
  function showLb() {
    var item = flat[cur];
    lbImg.src = item.src;
    lbImg.alt = item.title || "";
    lbCap.textContent = item.caption ? (item.title + " — " + item.caption) : item.title;
    preload(cur + 1); preload(cur - 1);
  }
  function preload(i) { if (i >= 0 && i < flat.length) { var im = new Image(); im.src = flat[i].src; } }
  function openLb(i) {
    cur = i; showLb(); lb.hidden = false;
    prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    keyHandler = function (e) {
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", keyHandler);
  }
  function closeLb() {
    lb.hidden = true;
    document.body.style.overflow = prevOverflow;
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
  }
  function step(d) { cur = (cur + d + flat.length) % flat.length; showLb(); }

  // ---- assemble ----
  if (intro) {
    var p = document.createElement("p"); p.className = "intro"; p.textContent = intro; wrap.appendChild(p);
  }
  if (albums && albums.length) {
    build(albums);
  } else if (dataUrl) {
    fetch(dataUrl)
      .then(function (r) { return r.json(); })
      .then(function (d) { build(Array.isArray(d) ? d : (d.albums || [])); })
      .catch(function () { build([]); });
  } else {
    build([]);
  }

  return function cleanup() {
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
    if (lbHost && lbHost.parentNode) lbHost.parentNode.removeChild(lbHost);
    document.body.style.overflow = prevOverflow;
  };
}

export default { render };
