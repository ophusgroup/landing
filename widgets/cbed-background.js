// cbed-background.js — fixed full-window LACBED diffraction background.
//
// A slowly precessing β-Si3N4 (hexagonal, a=7.608 Å, c=2.911 Å) large-angle
// convergent-beam pattern, drawn as gnomonic Kikuchi / HOLZ excess+deficiency
// line pairs behind all page content. The zone axis sweeps side to side from
// ⟨0001⟩ through the equatorial axes and slowly precesses, so the pattern
// morphs without obviously repeating. Pinned (does not scroll), theme-aware,
// throttled, pauses when the tab is hidden, static under reduced-motion.
//
// Pure ESM anywidget. Place once on a page:
//   :::{anywidget} .../cbed-background.js
//   {}
//   :::
// Optional model knobs: sweep (deg), speed, zoom, gamma, emph, fps, blur.

const BG_ID = "colab-cbed-bg";
const STYLE_ID = "colab-cbed-bg-style";
const HTML_FLAG = "cbed-bg-on";

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

function teardown() {
  const prev = document.getElementById(BG_ID);
  if (prev && prev.__cleanup) prev.__cleanup();
  else if (prev) prev.remove();
  const st = document.getElementById(STYLE_ID);
  if (st) st.remove();
  document.documentElement.classList.remove(HTML_FLAG);
  document.documentElement.style.removeProperty("background-color");
}

function render({ el, model }) {
  try { el.style.display = "none"; } catch (e) {}

  const opt = (k, d) => { const v = model && model.get && model.get(k); return (v === undefined || v === null) ? d : v; };
  const P = {
    sweep: +opt("sweep", 60),
    speed: +opt("speed", 40),
    zoom: +opt("zoom", 60),
    gamma: +opt("gamma", 0.45),
    emph: +opt("emph", 2.1),
    fps: +opt("fps", 30),
    blur: +opt("blur", 0.8),
  };

  teardown();

  // ---- reciprocal lattice of β-Si3N4 (1/d units, Å^-1) ----
  const A = 7.608, C = 2.911;
  const b1 = [1 / A, 1 / (A * Math.sqrt(3)), 0], b2 = [0, 2 / (A * Math.sqrt(3)), 0], b3 = [0, 0, 1 / C];
  const gmax = 1.7, g0 = 0.85;
  let gs = [], maxW = 0;
  for (let h = -8; h <= 8; h++) for (let k = -8; k <= 8; k++) for (let l = -5; l <= 5; l++) {
    if (h === 0 && k === 0 && l === 0) continue;
    if (h === 0 && k === 0 && (l & 1)) continue;            // P6_3: 000l only l=2n
    const x = h * b1[0] + k * b2[0] + l * b3[0], y = h * b1[1] + k * b2[1] + l * b3[1], z = h * b1[2] + k * b2[2] + l * b3[2];
    const gm = Math.sqrt(x * x + y * y + z * z);
    if (gm < 1e-6 || gm > gmax) continue;
    const w = Math.exp(-(gm / g0) * (gm / g0)); if (w > maxW) maxW = w;
    gs.push({ x, y, z, m: gm, w });
  }
  gs.sort((a, b) => b.w - a.w); gs = gs.slice(0, 360);
  for (let i = 0; i < gs.length; i++) gs[i].wn = gs[i].w / maxW;
  const N = gs.length, M2 = 2 * N;
  const La = new Float64Array(M2), Lb = new Float64Array(M2), Lc = new Float64Array(M2), Lu = new Float64Array(M2), Lw = new Float64Array(M2);

  // ---- canvas pinned behind content; page bg made transparent so it shows ----
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent =
    `#${BG_ID}{position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:block;}` +
    `html.${HTML_FLAG} body{background-color:transparent !important;}`;
  document.head.appendChild(style);
  const cv = document.createElement("canvas");
  cv.id = BG_ID;
  cv.setAttribute("aria-hidden", "true");
  cv.style.filter = "blur(" + P.blur + "px)";
  document.body.appendChild(cv);
  document.documentElement.classList.add(HTML_FLAG);
  const ctx = cv.getContext("2d");

  let light = !detectDark();
  const WH = [255, 255, 255], BK = [0, 0, 0], PK = [223, 203, 203], DG = [52, 52, 52];
  let PG = light ? WH : BK, SG = light ? PK : DG;

  // quantized colour cache (avoids per-line string allocation each frame)
  const cache = new Array(65);
  function buildCache() {
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      cache[i] = "rgb(" + Math.round(PG[0] + (SG[0] - PG[0]) * u) + "," + Math.round(PG[1] + (SG[1] - PG[1]) * u) + "," + Math.round(PG[2] + (SG[2] - PG[2]) * u) + ")";
    }
  }
  buildCache();
  // explicit page-colour backdrop on <html> so a theme/OS-scheme mismatch can
  // never reveal the wrong UA backdrop below short content (canvas sits over it)
  const applyBackdrop = () => document.documentElement.style.setProperty("background-color", light ? "#ffffff" : "#000000", "important");
  applyBackdrop();
  const col = (u) => cache[u < 0 ? 0 : u > 1 ? 64 : (u * 64 + 0.5) | 0];

  function rotToZ(ux, uy, uz) {
    let ax = uy, ay = -ux; const an = Math.sqrt(ax * ax + ay * ay);
    if (an < 1e-7) return uz > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : [1, 0, 0, 0, -1, 0, 0, 0, -1];
    ax /= an; ay /= an; const c = uz, s = an, t = 1 - c;
    return [1 - t * ay * ay, t * ax * ay, s * ay, t * ax * ay, 1 - t * ax * ax, -s * ax, -s * ay, s * ax, c];
  }

  let W, H, cx, cy, minD, maxD, R, dpr;
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2; minD = Math.min(W, H); maxD = Math.max(W, H); R = 0.7 * minD * (P.zoom / 100);
  }
  layout();

  function segLine(a, b, c) {
    let p0x, p0y, p1x, p1y, n = 0, x, y;
    if (Math.abs(b) > 1e-6) {
      y = -c / b; if (y >= 0 && y <= H) { p0x = 0; p0y = y; n = 1; }
      y = -(a * W + c) / b; if (y >= 0 && y <= H) { if (n === 0) { p0x = W; p0y = y; n = 1; } else { p1x = W; p1y = y; n = 2; } }
    }
    if (n < 2 && Math.abs(a) > 1e-6) {
      x = -c / a; if (x >= 0 && x <= W) { if (n === 0) { p0x = x; p0y = 0; n = 1; } else { p1x = x; p1y = 0; n = 2; } }
      if (n < 2) { x = -(b * H + c) / a; if (x >= 0 && x <= W) { if (n === 0) { p0x = x; p0y = H; n = 1; } else { p1x = x; p1y = H; n = 2; } } }
    }
    if (n === 2 && (Math.abs(p0x - p1x) > 0.5 || Math.abs(p0y - p1y) > 0.5)) {
      ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.lineTo(p1x, p1y); ctx.stroke();
    }
  }

  let t0 = 0;
  function drawFrame(now) {
    // self-heal: relayout if the viewport size or DPR drifted (covers missed
    // resize events, DPR changes from monitor moves / browser zoom)
    const wdpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (W !== window.innerWidth || H !== window.innerHeight || dpr !== wdpr) layout();
    if (t0 === 0) t0 = now;
    const T = (now - t0) / 1000, sf = P.speed / 100, gamma = P.gamma, emF = P.emph;
    const amp = Math.min(1, emF * 0.18), u0 = 0.5 * amp;
    const li = light;
    const sw = P.sweep * Math.PI / 180;
    const ax = sw * Math.sin(T * (2 * Math.PI / 200) * sf), by = sw * 0.32 * Math.sin(T * (2 * Math.PI / 320) * sf), psi = T * (2 * Math.PI / 1100) * sf;
    const vx = Math.sin(ax), vy = -Math.sin(by) * Math.cos(ax), vz = Math.cos(by) * Math.cos(ax);
    const cpz = Math.cos(psi), spz = Math.sin(psi);
    const M = rotToZ(cpz * vx - spz * vy, spz * vx + cpz * vy, vz);

    let m = 0;
    for (let i = 0; i < N; i++) {
      const g = gs[i];
      const Gx = M[0] * g.x + M[1] * g.y + M[2] * g.z, Gy = M[3] * g.x + M[4] * g.y + M[5] * g.z, Gz = M[6] * g.x + M[7] * g.y + M[8] * g.z;
      const nrm = Math.sqrt(Gx * Gx + Gy * Gy); if (nrm < 1e-6) continue;
      const Cc = Gz * R - Gx * cx - Gy * cy, dC = (Gx * cx + Gy * cy + Cc) / nrm, asym = Math.tanh(dC / 38);
      const wp = Math.pow(g.wn, gamma), off = nrm * Math.min(7, Math.max(1, 2.4 * g.m)), s = 0.5 * amp * wp * asym, lw = 0.6 + 2.0 * wp;
      La[m] = Gx; Lb[m] = Gy; Lc[m] = Cc - off; Lu[m] = li ? u0 - s : u0 + s; Lw[m] = lw; m++;
      La[m] = Gx; Lb[m] = Gy; Lc[m] = Cc + off; Lu[m] = li ? u0 + s : u0 - s; Lw[m] = lw; m++;
    }

    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.fillStyle = col(u0); ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";

    ctx.globalCompositeOperation = "darken";
    for (let k = 0; k < m; k++) if (li ? Lu[k] > u0 + 1e-4 : Lu[k] < u0 - 1e-4) { ctx.lineWidth = Lw[k]; ctx.strokeStyle = col(Lu[k]); segLine(La[k], Lb[k], Lc[k]); }
    ctx.globalCompositeOperation = "lighten";
    for (let k = 0; k < m; k++) if (li ? Lu[k] < u0 - 1e-4 : Lu[k] > u0 + 1e-4) { ctx.lineWidth = Lw[k]; ctx.strokeStyle = col(Lu[k]); segLine(La[k], Lb[k], Lc[k]); }

    ctx.globalCompositeOperation = "source-over";
    const vg = ctx.createRadialGradient(cx, cy, maxD * 0.50, cx, cy, maxD * 0.92);
    vg.addColorStop(0, li ? "rgba(255,255,255,0)" : "rgba(0,0,0,0)");
    vg.addColorStop(1, li ? "#fff" : "#000");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ---- animation: throttled rAF, pause when hidden, static if reduced-motion ----
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0, lastDraw = -1e9;
  const interval = 1000 / Math.max(1, P.fps);
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (now - lastDraw < interval) return;
    lastDraw = now;
    drawFrame(now);
  }
  function start() { if (!raf && !reduced && !document.hidden) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  if (reduced) drawFrame(performance.now()); else start();

  // ---- theme reactivity (instant via observer + media, poll backstop) ----
  let lastDark = !light;
  const onTheme = () => {
    const d = detectDark();
    if (d !== lastDark) {
      lastDark = d; light = !d;
      PG = light ? WH : BK; SG = light ? PK : DG; buildCache(); applyBackdrop();
      drawFrame(performance.now());
    }
  };
  const themeObs = new MutationObserver(onTheme);
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", onTheme);
  const themeTimer = setInterval(onTheme, 800);

  const onVis = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener("visibilitychange", onVis);
  let rT;
  const onResize = () => { clearTimeout(rT); rT = setTimeout(() => { layout(); if (reduced) drawFrame(performance.now()); }, 150); };
  window.addEventListener("resize", onResize);

  function cleanup() {
    stop();
    themeObs.disconnect();
    if (mq.removeEventListener) mq.removeEventListener("change", onTheme);
    clearInterval(themeTimer);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("resize", onResize);
    clearTimeout(rT);
    const n = document.getElementById(BG_ID); if (n) n.remove();
    const s = document.getElementById(STYLE_ID); if (s) s.remove();
    document.documentElement.classList.remove(HTML_FLAG);
    document.documentElement.style.removeProperty("background-color");
  }
  cv.__cleanup = cleanup;
  return cleanup;
}

export default { render };
