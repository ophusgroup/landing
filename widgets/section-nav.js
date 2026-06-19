// section-nav.js — floating right-side "On this page" section navigation.
// A tiny anywidget that builds a Contents menu from the page's headings
// (h2/h3 with ids). Works where the hosted theme drops its native outline.
//
// Behaviour:
//  • Defers automatically if a native outline is already visible (so it adds
//    nothing on local `myst start`, but appears on the deployed site).
//  • Theme-aware (light/dark), scroll-spy active highlighting, smooth scroll.
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

function render({ el, model }) {
  // Hide this widget's own inline footprint — the menu floats from <body>.
  try { el.style.display = "none"; } catch (e) {}

  const title = (model && model.get && model.get("title")) || "On this page";
  const minWidth = (model && model.get && model.get("min_width")) || 1100;
  const maxLevel = (model && model.get && model.get("max_level")) || 3;
  const accent = (model && model.get && model.get("accent")) || "#8C1515";

  // ---- Tear down any prior instance (idempotent across re-renders) ----
  teardown();

  let nav = null;
  let onScroll = null,
    onResize = null,
    themeTimer = null,
    builtItems = [],
    retryTimers = [];

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
        z-index: 40; box-sizing: border-box; padding-left: 12px;
        border-left: 1px solid var(--cn-rule);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      #${NAV_ID}::-webkit-scrollbar { width: 6px; }
      #${NAV_ID}::-webkit-scrollbar-thumb { background: var(--cn-rule); border-radius: 3px; }
      #${NAV_ID} .cn-title {
        font-size: 11px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase;
        color: var(--cn-dim); margin-bottom: 8px;
      }
      #${NAV_ID} a {
        display: block; text-decoration: none; color: var(--cn-fg);
        font-size: 13px; line-height: 1.35; padding: 3px 0 3px 0; margin-left: -13px;
        padding-left: 13px; border-left: 2px solid transparent;
        transition: color .15s ease, border-color .15s ease;
      }
      #${NAV_ID} a.cn-l3 { padding-left: 26px; font-size: 12px; }
      #${NAV_ID} a.cn-l4 { padding-left: 38px; font-size: 12px; }
      #${NAV_ID} a:hover { color: var(--cn-active); }
      #${NAV_ID} a.cn-active { color: var(--cn-active); border-left-color: var(--cn-accent); font-weight: 600; }
      @media (max-width: ${minWidth}px) { #${NAV_ID} { display: none !important; } }
    `;
    document.head.appendChild(s);
  }

  function applyTheme() {
    if (!nav) return;
    const dark = detectDark();
    nav.style.setProperty("--cn-fg", dark ? "#9aa3ad" : "#6b7280");
    nav.style.setProperty("--cn-dim", dark ? "#6b7280" : "#9aa3ad");
    nav.style.setProperty("--cn-active", dark ? "#f3f4f6" : "#111827");
    nav.style.setProperty("--cn-rule", dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)");
    nav.style.setProperty("--cn-accent", accent);
  }

  function updateActive() {
    if (!nav || !builtItems.length) return;
    const trigger = 130;
    let activeId = builtItems[0].id;
    for (const it of builtItems) {
      const top = it.el.getBoundingClientRect().top;
      if (top <= trigger) activeId = it.id;
      else break;
    }
    // If scrolled to the very bottom, activate the last item.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4)
      activeId = builtItems[builtItems.length - 1].id;
    for (const a of nav.querySelectorAll("a"))
      a.classList.toggle("cn-active", a.dataset.id === activeId);
  }

  function build() {
    if (document.getElementById(NAV_ID)) return true;
    if (nativeOutlineVisible()) return false;
    const items = collectHeadings(maxLevel);
    if (items.length < 2) return false;
    builtItems = items;

    ensureStyle();
    nav = document.createElement("nav");
    nav.id = NAV_ID;
    nav.setAttribute("aria-label", "Section navigation");
    nav.innerHTML =
      `<div class="cn-title">${title}</div>` +
      items
        .map(
          (it) =>
            `<a href="#${it.id}" data-id="${it.id}" class="cn-l${it.level}">${it.text.replace(/</g, "&lt;")}</a>`
        )
        .join("");
    document.body.appendChild(nav);
    applyTheme();

    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const target = document.getElementById(a.dataset.id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#" + a.dataset.id);
      }
    });

    onScroll = () => updateActive();
    // capture:true so we catch scroll from an inner scroll container too
    // (scroll events don't bubble; the hosted layout may not scroll <window>).
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    onResize = onScroll;
    window.addEventListener("resize", onResize, { passive: true });

    // theme: poll (robust across class/attr/media switches)
    let lastDark = detectDark();
    themeTimer = setInterval(() => {
      const d = detectDark();
      if (d !== lastDark) { lastDark = d; applyTheme(); }
    }, 600);

    updateActive();
    nav.__cleanup = cleanup;
    return true;
  }

  function cleanup() {
    if (onScroll) window.removeEventListener("scroll", onScroll, { capture: true });
    if (onResize) window.removeEventListener("resize", onResize);
    if (themeTimer) clearInterval(themeTimer);
    retryTimers.forEach(clearTimeout);
    const n = document.getElementById(NAV_ID);
    if (n) n.remove();
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
