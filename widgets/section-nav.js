// section-nav.js — floating right-side "On this page" section navigation.
// A tiny anywidget that builds a Contents menu from the page's headings
// (h2/h3 with ids). Works where the hosted theme drops its native outline.
//
// Behaviour:
//  • Defers automatically if a native outline is already visible (so it adds
//    nothing on local `myst start`, but appears on the deployed site).
//  • A continuous "reading spine": a faint rail with an accent fill + sliding
//    dot that tracks your exact position, gliding smoothly to the last item at
//    the bottom (no snap). Inactive items fade to grey with distance.
//  • Scroll-position read works whether the page scrolls <window> or an inner
//    container (scroller detected from scroll events).
//  • Theme-aware (light/dark, instant via observer), smooth scroll on click.
//  • prefers-reduced-motion: keeps the indicator but drops the easing.
//  • Idempotent: the theme toggle re-runs render(); we tear down first so we
//    never stack duplicates. Returns a cleanup fn for unmount.
//  • Hidden on narrow viewports (no room for a right rail).
//
// Pure ESM, no dependencies. Place once per page:
//   :::{anywidget} .../section-nav.js
//   {}
//   :::

const NAV_ID = "colab-section-nav";
const STYLE_ID = "colab-section-nav-style";

function detectDark() {
  const de = document.documentElement;
  if (de.classList.contains("dark")) return true;
  if (de.classList.contains("light")) return false;
  const dt = de.getAttribute("data-theme") || de.getAttribute("data-mode");
  if (dt) return /dark/i.test(dt);
  try {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    if (m && m.length >= 3) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
  } catch (e) {}
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// If the theme already renders a working right-hand outline, don't duplicate it.
function nativeOutlineVisible() {
  const sel = '.myst-outline, nav[aria-label*="ontents" i], nav[aria-label*="utline" i]';
  for (const o of document.querySelectorAll(sel)) {
    if (o.id === NAV_ID) continue;
    if (o.offsetParent !== null && o.getBoundingClientRect().width > 4 && o.querySelector('a[href^="#"]')) return true;
  }
  return false;
}

function collectHeadings(maxLevel) {
  const out = [];
  const seen = new Set();
  for (const h of document.querySelectorAll("h2[id], h3[id], h4[id]")) {
    const lvl = +h.tagName[1];
    if (lvl > maxLevel) continue;
    if (h.closest('nav, aside, header, footer, [class*="outline"], [class*="toc"]')) continue;
    const text = (h.textContent || "").replace(/[¶#]/g, "").trim();
    if (!h.id || !text || seen.has(h.id)) continue;
    seen.add(h.id);
    out.push({ id: h.id, text, level: lvl, el: h });
  }
  return out;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function render({ el, model }) {
  // Hide this widget's own inline footprint — the menu floats from <body>.
  try { el.style.display = "none"; } catch (e) {}

  const opt = (k, d) => { const v = model && model.get && model.get(k); return (v === undefined || v === null) ? d : v; };
  const title = opt("title", "On this page");
  const minWidth = +opt("min_width", 1100);
  const maxLevel = +opt("max_level", 3);
  const accentLight = opt("accent", "#8C1515");
  const accentDark = opt("accent_dark", "#d24a52");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  teardown();

  let nav = null, items = null, fillEl = null, dotEl = null, links = [], builtItems = [];
  let onScroll = null, onResize = null, themeTimer = null, themeObserver = null, themeMedia = null, onThemeChange = null, retryTimers = [];
  let scroller = document.scrollingElement || document.documentElement;
  let footEl = null, mainEl = null, refsTries = 0;

  function teardown() {
    const prevNav = document.getElementById(NAV_ID);
    if (prevNav && prevNav.__cleanup) prevNav.__cleanup();
    else if (prevNav) prevNav.remove();
    const prevStyle = document.getElementById(STYLE_ID);
    if (prevStyle) prevStyle.remove();
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${NAV_ID} {
        position: fixed; top: 88px; right: max(16px, calc((100vw - 1280px) / 2 - 40px));
        width: 200px; max-height: calc(100vh - 140px); overflow-y: auto;
        z-index: 40; box-sizing: border-box;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      #${NAV_ID}::-webkit-scrollbar { width: 6px; }
      #${NAV_ID}::-webkit-scrollbar-thumb { background: var(--cn-rule); border-radius: 3px; }
      #${NAV_ID} .cn-title {
        font-size: 11px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase;
        color: var(--cn-dim); margin: 0 0 10px; padding-left: 18px;
      }
      #${NAV_ID} .cn-items { position: relative; padding-left: 18px; }
      #${NAV_ID} .cn-rail { position: absolute; left: 7px; top: 0; bottom: 0; width: 1px; background: var(--cn-rule); }
      #${NAV_ID} .cn-fill { position: absolute; left: 7px; top: 0; width: 2px; height: 0; background: var(--cn-accent); transition: height .1s linear; }
      #${NAV_ID} .cn-dot {
        position: absolute; left: 4.5px; top: 0; width: 6px; height: 6px; border-radius: 50%;
        background: var(--cn-accent); transform: translateY(-3px); transition: transform .1s linear;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--cn-accent) 22%, transparent);
      }
      #${NAV_ID} a {
        display: block; text-decoration: none; color: var(--cn-fg);
        font-size: 13px; line-height: 1.45; padding: 3.5px 0;
        transition: color .15s ease, opacity .2s ease, font-weight .15s ease;
      }
      #${NAV_ID} a.cn-l3 { padding-left: 12px; font-size: 12px; }
      #${NAV_ID} a.cn-l4 { padding-left: 24px; font-size: 12px; }
      #${NAV_ID} a:hover { color: var(--cn-active); opacity: 1 !important; }
      @media (max-width: ${minWidth}px) { #${NAV_ID} { display: none !important; } }
      @media (prefers-reduced-motion: reduce) {
        #${NAV_ID} .cn-fill, #${NAV_ID} .cn-dot, #${NAV_ID} a { transition: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  function applyTheme() {
    if (!nav) return;
    const dark = detectDark();
    nav.style.setProperty("--cn-fg", dark ? "#aab3bd" : "#4b5563");
    nav.style.setProperty("--cn-dim", dark ? "#6b7280" : "#9aa3ad");
    nav.style.setProperty("--cn-active", dark ? "#f3f4f6" : "#111827");
    nav.style.setProperty("--cn-rule", dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)");
    nav.style.setProperty("--cn-accent", dark ? accentDark : accentLight);
  }

  // Track which element actually scrolls (window/document vs an inner container).
  function noteScroller(e) {
    const t = e && e.target;
    if (!t || t === document || t === window || t === document.documentElement || t === document.body) {
      scroller = document.scrollingElement || document.documentElement;
    } else if (t.scrollHeight - t.clientHeight > 8) {
      scroller = t;
    }
  }
  function metrics() {
    const root = scroller === (document.scrollingElement || document.documentElement) || scroller === document.body;
    const re = document.scrollingElement || document.documentElement;
    const sTop = root ? (window.scrollY || re.scrollTop || 0) : scroller.scrollTop;
    const sMax = root ? Math.max(1, re.scrollHeight - window.innerHeight) : Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    return { root, sTop, sMax };
  }
  function headOffset(h, root) {
    const r = h.getBoundingClientRect();
    return root ? r.top + (window.scrollY || 0) : r.top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }
  const linkCenter = (i) => links[i].offsetTop + links[i].offsetHeight / 2;

  // The outline is position:fixed, so near the page bottom it would ride down
  // over the site footer. Cache the footer (what to clear) and the main-content
  // element (its bottom edge also marks where the footer region begins); the
  // outline later hides once the higher of the two rises under it.
  function cacheRefs() {
    const f = document.querySelector('footer, [role="contentinfo"]');
    footEl = (f && f.offsetParent !== null && f.id !== NAV_ID) ? f : null;
    mainEl = document.querySelector('main, article, [role="main"]') || null;
    refsTries++;
  }

  function update() {
    if (!nav || !builtItems.length || !links.length) return;
    const m = metrics(), trig = 100, p = clamp01(m.sTop / m.sMax), n = builtItems.length;
    const bp = builtItems.map((it) => clamp01((headOffset(it.el, m.root) - trig) / m.sMax));
    bp[0] = 0;
    for (let i = 1; i < n; i++) if (bp[i] < bp[i - 1]) bp[i] = bp[i - 1];
    let act = 0;
    for (let i = 0; i < n; i++) { if (bp[i] <= p + 1e-6) act = i; else break; }
    let markerY;
    if (act >= n - 1) markerY = linkCenter(n - 1);
    else {
      const seg = bp[act + 1] - bp[act], t = seg > 1e-6 ? clamp01((p - bp[act]) / seg) : 1;
      markerY = linkCenter(act) + (linkCenter(act + 1) - linkCenter(act)) * t;
    }
    fillEl.style.height = markerY.toFixed(1) + "px";
    dotEl.style.transform = "translateY(" + (markerY - 3).toFixed(1) + "px)";
    for (let i = 0; i < links.length; i++) {
      const on = i === act;
      links[i].style.color = on ? "var(--cn-active)" : "var(--cn-fg)";
      links[i].style.fontWeight = on ? "600" : "400";
      links[i].style.opacity = Math.max(0.6, 1 - 0.14 * Math.abs(i - act));
    }
    // Fade + disable the outline as the footer (or the end of the main
    // content) scrolls up under it, so it never overlays the footer.
    if (!footEl && !mainEl && refsTries < 40) cacheRefs();
    let refTop = Infinity;
    if (footEl) refTop = Math.min(refTop, footEl.getBoundingClientRect().top);
    if (mainEl) refTop = Math.min(refTop, mainEl.getBoundingClientRect().bottom);
    if (refTop !== Infinity) {
      const navTop = parseFloat(getComputedStyle(nav).top) || 88;
      const gap = refTop - (navTop + nav.offsetHeight);
      const fade = Math.max(0, Math.min(1, (gap - 24) / 80));
      nav.style.opacity = fade.toFixed(2);
      nav.style.pointerEvents = fade < 0.05 ? "none" : "";
    }
  }

  function build() {
    if (document.getElementById(NAV_ID)) return true;
    if (nativeOutlineVisible()) return false;
    const its = collectHeadings(maxLevel);
    if (its.length < 2) return false;
    builtItems = its;

    ensureStyle();
    nav = document.createElement("nav");
    nav.id = NAV_ID;
    nav.setAttribute("aria-label", "Section navigation");
    nav.innerHTML =
      `<div class="cn-title">${title}</div>` +
      `<div class="cn-items"><div class="cn-rail"></div><div class="cn-fill"></div><div class="cn-dot"></div>` +
      its.map((it) => `<a href="#${it.id}" data-id="${it.id}" class="cn-l${it.level}">${it.text.replace(/</g, "&lt;")}</a>`).join("") +
      `</div>`;
    document.body.appendChild(nav);
    items = nav.querySelector(".cn-items");
    fillEl = nav.querySelector(".cn-fill");
    dotEl = nav.querySelector(".cn-dot");
    links = [].slice.call(nav.querySelectorAll("a"));
    applyTheme();

    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const target = document.getElementById(a.dataset.id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", "#" + a.dataset.id);
      }
    });

    onScroll = (e) => { noteScroller(e); update(); };
    // capture:true so we catch scroll from an inner scroll container too
    // (scroll events don't bubble; the hosted layout may not scroll <window>).
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    onResize = () => update();
    window.addEventListener("resize", onResize, { passive: true });

    // theme: react instantly to class/attr/media changes; poll as a backstop
    let lastDark = detectDark();
    onThemeChange = () => {
      const d = detectDark();
      if (d !== lastDark) { lastDark = d; applyTheme(); }
    };
    themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode"] });
    themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
    if (themeMedia.addEventListener) themeMedia.addEventListener("change", onThemeChange);
    themeTimer = setInterval(onThemeChange, 600);

    update();
    nav.__cleanup = cleanup;
    return true;
  }

  function cleanup() {
    if (onScroll) window.removeEventListener("scroll", onScroll, { capture: true });
    if (onResize) window.removeEventListener("resize", onResize);
    if (themeTimer) clearInterval(themeTimer);
    if (themeObserver) themeObserver.disconnect();
    if (themeMedia && onThemeChange && themeMedia.removeEventListener) themeMedia.removeEventListener("change", onThemeChange);
    retryTimers.forEach(clearTimeout);
    const nd = document.getElementById(NAV_ID);
    if (nd) nd.remove();
    const st = document.getElementById(STYLE_ID);
    if (st) st.remove();
    nav = null;
  }

  // Build now; retry a few times in case the SPA hydrates headings late.
  if (!build()) {
    [150, 500, 1200, 2500].forEach((ms) =>
      retryTimers.push(setTimeout(() => { if (!document.getElementById(NAV_ID)) build(); }, ms))
    );
  }

  return cleanup;
}

export default { render };
