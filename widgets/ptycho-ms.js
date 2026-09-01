// ptycho-ms.js — interactive multislice electron ptychography demo (MyST anywidget).
//
// Left panel: 4D-STEM acquisition. A decahedral metal nanoparticle (five twinned
// wedges, 111-like layers, base embedded in an amorphous carbon substrate) in a
// 6-slice volume (empty top/bottom slices). Drag the probe anywhere (relative
// drag), serpentine Scan, defocus slider (C1 = -dF, -200..+200 A, re-simulates
// on release), dose slider (Poisson noise), BF/DF linear contrast, and a toggle
// between the 3D atomic model and the greyscale potential slices.
//
// Right panel: mini-batch gradient-descent multislice ptychography (pixelated
// forward model as in quantEM; probe known, object-only, Adam, batch of 11 of
// the 15x15 positions, capped at 50 iterations). Six 15 A slices are displayed;
// two extra hidden headroom slices above absorb top-of-volume artifacts. The
// model diffraction pattern shares the measured pattern's display scaling.
//
// Display: both panels share one camera (mild perspective, fl=45) with slice
// stacks at identical pitch and DP planes at identical height; quads render
// perspective-correct via banded affine maps. The dataset is simulated live in
// the browser (~2-4 s) and cached page-globally (globalThis.__pmsCache) so
// theme/zoom re-mounts never re-simulate or reset the reconstruction.
//
// Conventions (empirically calibrated, see project memory): chi = -pi*lam*dF*k^2
// with propagator exp(-i*pi*lam*dz*k^2); probe shift phase includes +BOX/2 so
// probe(0,0) is CENTERED on the grid (without it everything sits half a box
// off); dF<0 = overfocus = inverted shadow, dF>0 = underfocus = upright.

"use strict";

// ---------------------------------------------------------------------------
// FFT machinery (radix-2, split re/im, precomputed twiddles + bit reversal)
// ---------------------------------------------------------------------------
function makeFFT(n) {
  const rev = new Uint32Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit; rev[i] = j;
  }
  const cosT = new Float32Array(n / 2), sinT = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) { const a = -2 * Math.PI * i / n; cosT[i] = Math.cos(a); sinT[i] = Math.sin(a); }
  return function fft1d(re, im, off, inv) {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        const a = off + i, b = off + j;
        let t = re[a]; re[a] = re[b]; re[b] = t; t = im[a]; im[a] = im[b]; im[b] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const tw = k * step, wr = cosT[tw], wi = inv ? -sinT[tw] : sinT[tw];
          const a = off + i + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inv) { const s = 1 / n; for (let i = off; i < off + n; i++) { re[i] *= s; im[i] *= s; } }
  };
}

// 2D FFT on N x N split arrays (row-major), in place.
function makeFFT2D(N) {
  const fft1d = makeFFT(N);
  const tr = new Float32Array(N), ti = new Float32Array(N);
  return function fft2d(re, im, inv) {
    for (let r = 0; r < N; r++) fft1d(re, im, r * N, inv);
    for (let c = 0; c < N; c++) {
      for (let r = 0, i = c; r < N; r++, i += N) { tr[r] = re[i]; ti[r] = im[i]; }
      fft1d(tr, ti, 0, inv);
      for (let r = 0, i = c; r < N; r++, i += N) { re[i] = tr[r]; im[i] = ti[r]; }
    }
  };
}

// ---------------------------------------------------------------------------
// Colormaps
// ---------------------------------------------------------------------------
// Google turbo polynomial approximation, ramped to true black at the bottom.
function turboBlack(t) {
  t = Math.max(0, Math.min(1, t));
  const r = Math.round(255 * Math.min(1, Math.max(0, 0.1357 + t * (4.5974 + t * (-42.3277 + t * (130.5887 + t * (-150.5666 + t * 58.1375)))))));
  const g = Math.round(255 * Math.min(1, Math.max(0, 0.0914 + t * (2.1856 + t * (4.8052 + t * (-14.0195 + t * (4.2109 + t * 4.5468)))))));
  const b = Math.round(255 * Math.min(1, Math.max(0, 0.1067 + t * (12.5925 + t * (-60.1097 + t * (109.0745 + t * (-88.5066 + t * 26.8183)))))));
  const w = Math.min(1, t / 0.125); // quantEM turbo_black: linear fade to black over the first eighth
  return [r * w | 0, g * w | 0, b * w | 0];
}

// ---------------------------------------------------------------------------
// Deterministic RNG for the amorphous carbon (reproducible sample)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Sample: decahedral nanoparticle on amorphous carbon, NS slices
// ---------------------------------------------------------------------------
function buildSample(cfg) {
  const { N, PX, NS, DZ, PHI_M, PHI_C, SIG_M, SIG_C } = cfg;
  const atoms = []; // {x, y, z, kind (0 metal, 1 carbon), slice}
  const a = 2.4; // wedge lattice constant (A)

  // A REAL decahedron viewed along its five-fold axis: five twinned wedges, each
  // carrying a triangular lattice whose rows run PARALLEL to that wedge's outer
  // facet. The row spacing is strained to a/(2 tan 36) so the five wedges close
  // exactly; atoms ON the twin boundaries are shared (added once). Layers stack
  // ABAB along the axis (B rows sit in the hollows between A rows). Six layers,
  // two per slice (s1..s3), with a mirror-symmetric row-count profile so the top
  // and bottom show clean tapered triangular facets. s0 and s5 stay empty.
  const layers = [ // slice, fraction within slice, rows per wedge
    { sl: 1, f: 0.28, R: 2 }, { sl: 1, f: 0.72, R: 3 },
    { sl: 2, f: 0.28, R: 4 }, { sl: 2, f: 0.72, R: 4 },
    { sl: 3, f: 0.28, R: 4 }, { sl: 3, f: 0.72, R: 3 },
    { sl: 4, f: 0.28, R: 2 }, // truncated base leaks into the substrate slice
  ];
  const hrow = a / (2 * Math.tan(36 * Math.PI / 180));
  for (let k = 0; k < layers.length; k++) {
    const Rk = layers[k].R;
    const sl = layers[k].sl;
    const zA = (sl + layers[k].f) * DZ;
    const isB = k % 2 === 1;
    if (!isB) atoms.push({ x: 0, y: 0, z: zA, kind: 0, slice: sl }); // shared axis atom
    for (let w = 0; w < 5; w++) {
      const t0 = (w * 72 - 90) * Math.PI / 180;
      const u = [Math.cos(t0), Math.sin(t0)];       // wedge bisector (outward)
      const v = [-u[1], u[0]];
      if (!isB) {
        for (let r = 1; r <= Rk; r++) {
          for (let j = 0; j < r; j++) {             // j = r seam atom belongs to the next wedge
            const pu = r * hrow, pv = (j - r / 2) * a;
            atoms.push({ x: u[0] * pu + v[0] * pv, y: u[1] * pu + v[1] * pv, z: zA, kind: 0, slice: sl });
          }
        }
      } else {
        for (let r = 0; r < Rk; r++) {              // B rows in the hollows between A rows
          for (let j = 0; j <= r; j++) {
            const pu = (r + 0.5) * hrow, pv = (j - r / 2) * a;
            atoms.push({ x: u[0] * pu + v[0] * pv, y: u[1] * pu + v[1] * pv, z: zA, kind: 0, slice: sl });
          }
        }
      }
    }
  }

  // amorphous carbon: sparse random atoms, min separation enforced.
  const rng = mulberry32(20260901);
  const halfBox = N * PX / 2;
  function addCarbon(slice, count, avoidR) {
    const placed = [];
    let guard = 0;
    while (placed.length < count && guard++ < 9000) {
      const x = (rng() * 2 - 1) * (halfBox - 0.1);
      const y = (rng() * 2 - 1) * (halfBox - 0.1);
      if (avoidR && Math.hypot(x, y) < avoidR) continue; // keep clear of the particle core
      let ok = true;
      for (const p of placed) if ((p.x - x) ** 2 + (p.y - y) ** 2 < 1.65 * 1.65) { ok = false; break; }
      if (!ok) continue;
      const z = (slice + 0.2 + rng() * 0.6) * DZ;
      placed.push({ x, y, z });
      atoms.push({ x, y, z, kind: 1, slice });
    }
  }
  addCarbon(3, 70, 5.0);   // substrate surface, wrapping around the embedded lower cap
  addCarbon(4, 125, 3.2);  // substrate fills the field of view around the leaked base; s5 stays empty

  // rasterize each slice's projected phase (spiky Gaussians)
  const phase = new Float32Array(NS * N * N);
  for (const at of atoms) {
    const phi = at.kind === 0 ? PHI_M : PHI_C;
    const sig = at.kind === 0 ? SIG_M : SIG_C;
    const sp = sig / PX, rad = Math.ceil(sp * 3.2);
    const cx = at.x / PX + N / 2, cy = at.y / PX + N / 2;
    const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(N - 1, Math.ceil(cx + rad));
    const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(N - 1, Math.ceil(cy + rad));
    const base = at.slice * N * N, inv2s = 1 / (2 * sp * sp);
    for (let yy = y0; yy <= y1; yy++) {
      const dy = yy - cy;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - cx;
        phase[base + yy * N + xx] += phi * Math.exp(-(dx * dx + dy * dy) * inv2s);
      }
    }
  }
  return { atoms, phase };
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------
function render({ model, el }) {
  if (el.__pmsCleanup) { try { el.__pmsCleanup(); } catch (e) { } }
  const id = "pms_" + Math.random().toString(36).slice(2, 7);
  const opt = (k, d) => { try { const v = model && model.get && model.get(k); return v == null ? d : v; } catch (e) { return d; } };

  // ---- physics configuration -------------------------------------------------
  const N = 128;                     // grid (power of 2)
  const PX = opt("pixel_size", 0.2); // A / px
  const BOX = N * PX;                // 25.6 A
  const DK = 1 / BOX;
  const LAM = opt("lambda", 0.019687);          // 300 kV
  const ALPHA = opt("alpha", 0.033);            // rad (33 mrad: depth resolution ~36 A = ~2.4 recon slices)
  const KAP = ALPHA / LAM;                      // aperture radius, 1/A
  const DZ = opt("slice_thickness", 4.7);       // A
  const NS = 6;                                 // sample slices (empty, 3 particle, 2 carbon, empty)
  const NR_SHOW = Math.max(3, opt("recon_slices", 6)); // displayed reconstruction slices
  const NR_HID = 2;                             // hidden headroom slices ABOVE (absorb top artifacts)
  const NR = NR_SHOW + NR_HID;                  // total solved slices
  const ZPAD = 30.9;                            // recon pad above/below the sample -> 15 A recon slices
  let DF = opt("defocus", -200);                // A; C1 = -DF. Negative = overfocus (inverted shadow), positive = underfocus (upright)
  const DOSES = [1e3, 1e4, 1e5, 1e6, Infinity];
  let doseIdx = 4;
  const SCAN_N = 15;
  const SCAN_EXT = opt("scan_extent", 11.0);    // A, full width of scan grid
  const STEP = SCAN_EXT / (SCAN_N - 1);
  const PHI_M = opt("phi_metal", 0.6);          // peak phase per metal atom (rad)
  const PHI_C = opt("phi_carbon", 0.25);
  const BATCH = opt("batch", 11);
  const LR = opt("learning_rate", 0.01);
  const MAX_ITER = opt("max_iterations", 50);
  const KMAX_AL = 0.95 / (2 * PX);              // band limit, 1/A: pushed near the grid ceiling for maximum visible dark field

  const cfg = { N, PX, NS, DZ, PHI_M, PHI_C, SIG_M: 0.5, SIG_C: 0.6 };

  // ---- DOM -------------------------------------------------------------------
  // Each panel is ONE stem4d-style scene canvas: probe cone from the top, the
  // sample in the middle, and the diffraction pattern as a tilted plane below.
  const CW = 372, CH = 485;             // CSS size; internal canvases are 2x
  const SW = CW * 2, SH = CH * 2;
  el.innerHTML = `
  <style>
    .${id}-wrap { --bg:#ffffff; --fg:#1a1a1a; --dim:#666; --line:#d8d8d8; --accent:#8C1515;
      background: var(--bg); color: var(--fg); border-radius: 10px; padding: 12px 12px 8px;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; max-width: 820px; margin: 0 auto;
      position: relative; }
    .${id}-wrap.${id}-dark { --bg:#000000; --fg:#e8e8e8; --dim:#9aa; --line:#2c2c2c; }
    .${id}-cols { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
    .${id}-panel { flex: 1 1 320px; max-width: ${CW + 10}px; min-width: 280px; }
    .${id}-ptitle { font-size: 13px; font-weight: 600; margin: 2px 0 6px; letter-spacing: 0.2px; }
    .${id}-panel canvas { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 6px; touch-action: none; }
    .${id}-row { display: flex; gap: 6px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
    .${id}-btn { padding: 4px 12px; border: 1px solid var(--line); border-radius: 6px; background: transparent;
      color: var(--fg); cursor: pointer; font-size: 12px; font-weight: 600; }
    .${id}-btn:hover { border-color: var(--accent); color: var(--accent); }
    .${id}-btn.${id}-on { background: var(--accent); border-color: var(--accent); color: #fff; }
    .${id}-dplab { text-align: center; font-size: 13px; font-weight: 600; margin: 4px 0 2px;
      color: #0a8a50; }
    .${id}-wrap.${id}-dark .${id}-dplab { color: #00d878; }
    .${id}-slider { flex: 1; min-width: 70px; accent-color: var(--accent); }
    .${id}-lab { font-size: 12px; color: var(--dim); white-space: nowrap; min-width: 52px; }
    .${id}-stat { font-size: 13px; color: var(--dim); font-variant-numeric: tabular-nums; margin-left: 4px; }
    .${id}-load { position: absolute; top: 64px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 12px; align-items: center; background: var(--bg); z-index: 5;
      border: 1px solid var(--line); border-radius: 8px; padding: 9px 16px;
      box-shadow: 0 3px 14px rgba(0,0,0,0.18); white-space: nowrap; }
    .${id}-bar { width: 220px; height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
    .${id}-bar > div { height: 100%; width: 0%; background: var(--accent); transition: width 0.1s; }
  </style>
  <div class="${id}-wrap">
    <div class="${id}-load"><div style="font-size:12px">Simulating the 15×15 4D-STEM dataset…</div><div class="${id}-bar"><div></div></div></div>
    <div class="${id}-cols">
      <div class="${id}-panel">
        <div class="${id}-ptitle">Experiment: 4D-STEM acquisition</div>
        <canvas class="${id}-sceneL" width="${SW}" height="${SH}"></canvas>
        <div class="${id}-dplab">measured diffraction pattern</div>
        <div class="${id}-row">
          <button class="${id}-btn ${id}-tgl">Slices</button>
          <button class="${id}-btn ${id}-scan">▶ Scan</button>
          <button class="${id}-btn ${id}-dpm">Scale: BF disk</button>
        </div>
        <div class="${id}-row">
          <span class="${id}-lab">defocus</span>
          <input class="${id}-slider ${id}-dfs" type="range" min="-200" max="200" step="10" value="-200">
          <span class="${id}-lab ${id}-dfsl">130 Å</span>
        </div>
        <div class="${id}-row">
          <span class="${id}-lab">dose</span>
          <input class="${id}-slider ${id}-dss" type="range" min="0" max="4" step="1" value="4">
          <span class="${id}-lab ${id}-dssl">∞ e⁻/pattern</span>
        </div>
      </div>
      <div class="${id}-panel">
        <div class="${id}-ptitle">Reconstruction: multislice ptychography</div>
        <canvas class="${id}-sceneR" width="${SW}" height="${SH}"></canvas>
        <div class="${id}-dplab">model diffraction pattern</div>
        <div class="${id}-row">
          <button class="${id}-btn ${id}-run">▶ Reconstruct</button>
          <button class="${id}-btn ${id}-rst">Reset</button>
          <span class="${id}-stat ${id}-stat1">iteration 0</span>
        </div>
      </div>
    </div>
  </div>`;

  const wrap = el.querySelector(`.${id}-wrap`);
  const loadEl = el.querySelector(`.${id}-load`), loadBar = loadEl.querySelector(`.${id}-bar > div`);
  const sceneL = el.querySelector(`.${id}-sceneL`), sceneR = el.querySelector(`.${id}-sceneR`);
  const tglBtn = el.querySelector(`.${id}-tgl`), scanBtn = el.querySelector(`.${id}-scan`);
  const runBtn = el.querySelector(`.${id}-run`), rstBtn = el.querySelector(`.${id}-rst`);
  const dpmBtn = el.querySelector(`.${id}-dpm`);
  const dfSlider = el.querySelector(`.${id}-dfs`), dfLab = el.querySelector(`.${id}-dfsl`);
  const dsSlider = el.querySelector(`.${id}-dss`), dsLab = el.querySelector(`.${id}-dssl`);
  const statEl = el.querySelector(`.${id}-stat1`);

  // ---- theme -----------------------------------------------------------------
  function detectDark() {
    const de = document.documentElement;
    if (de.classList.contains("dark")) return true;
    if (de.classList.contains("light")) return false;
    const dt = de.getAttribute("data-theme") || de.getAttribute("data-mode");
    if (dt === "dark") return true;
    if (dt === "light") return false;
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const m = bg && bg.match(/\d+(\.\d+)?/g);
      if (m && m.length >= 3 && (m.length < 4 || +m[3] > 0.1))
        return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
    } catch (e) { }
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  let dark = detectDark();
  function applyTheme() {
    const d = detectDark();
    if (d !== dark) { dark = d; wrap.classList.toggle(`${id}-dark`, dark); paintAll(); }
    else wrap.classList.toggle(`${id}-dark`, dark);
  }
  wrap.classList.toggle(`${id}-dark`, dark);
  const mo = new MutationObserver(() => applyTheme());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode"] });
  const themeIv = setInterval(applyTheme, 900);

  // ---- physics engine --------------------------------------------------------
  const fft2d = makeFFT2D(N);
  const NN = N * N;
  const { atoms, phase } = buildSample(cfg);

  // spatial frequency arrays
  const kxA = new Float32Array(N), kyA = new Float32Array(N);
  for (let i = 0; i < N; i++) { const v = (i < N / 2 ? i : i - N) * DK; kxA[i] = v; kyA[i] = v; }

  // transmission functions t = exp(i*phi), and band-limit mask
  const tRe = new Float32Array(NS * NN), tIm = new Float32Array(NS * NN);
  for (let s = 0; s < NS; s++) for (let i = 0; i < NN; i++) {
    const p = phase[s * NN + i]; tRe[s * NN + i] = Math.cos(p); tIm[s * NN + i] = Math.sin(p);
  }
  const mask = new Float32Array(NN);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = Math.hypot(kxA[c], kyA[r]);
    mask[r * N + c] = k < KMAX_AL ? 1 : 0;
  }
  // Fresnel propagators: sim slices (DZ) and recon slices (DZR), + adjoint
  const DZR = (NS * DZ + 2 * ZPAD) / NR_SHOW;   // recon slice thickness (15 A)
  const ZPAD_TOP = ZPAD + NR_HID * DZR;         // headroom pad above the sample
  function makeProp(dz) {
    const pr = new Float32Array(NN), pi = new Float32Array(NN);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k2 = kxA[c] * kxA[c] + kyA[r] * kyA[r];
      const ph = -Math.PI * LAM * dz * k2, m = mask[r * N + c];
      pr[r * N + c] = Math.cos(ph) * m; pi[r * N + c] = Math.sin(ph) * m;
    }
    return [pr, pi];
  }
  const [propRe, propIm] = makeProp(DZ);
  const [propRRe, propRIm] = makeProp(DZR);
  const propCRe = propRRe, propCIm = new Float32Array(NN);
  for (let i = 0; i < NN; i++) propCIm[i] = -propRIm[i];

  // probe builder: fills (re,im) with the real-space probe at (x0,y0), defocus df
  function buildProbe(re, im, x0, y0, df) {
    const dq = DK;
    for (let r = 0; r < N; r++) {
      const ky = kyA[r];
      for (let c = 0; c < N; c++) {
        const kx = kxA[c], k = Math.sqrt(kx * kx + ky * ky);
        const amp = Math.max(0, Math.min(1, (KAP - k) / dq + 0.5));
        const i = r * N + c;
        if (amp <= 0) { re[i] = 0; im[i] = 0; continue; }
        // + BOX/2 shift: the iFFT places r = 0 at pixel (0,0), but the potential is
        // rasterized centered at N/2 -- without this the probe sits at the CORNER
        // (a half-box fft-shift misregistration between probe and sample)
        const ph = -Math.PI * LAM * df * (kx * kx + ky * ky) - 2 * Math.PI * (kx * (x0 + BOX / 2) + ky * (y0 + BOX / 2));
        re[i] = amp * Math.cos(ph); im[i] = amp * Math.sin(ph);
      }
    }
    fft2d(re, im, true);
  }

  // scratch buffers
  const wRe = new Float32Array(NN), wIm = new Float32Array(NN);       // wave
  const sRe = new Float32Array(NN), sIm = new Float32Array(NN);       // scratch
  function propagate(re, im, pr, pi) { // k-space multiply by propagator (or its conjugate)
    fft2d(re, im, false);
    for (let i = 0; i < NN; i++) {
      const a = re[i], b = im[i];
      re[i] = a * pr[i] - b * pi[i]; im[i] = a * pi[i] + b * pr[i];
    }
    fft2d(re, im, true);
  }

  // forward through the TRUE sample; returns detector intensity (not shifted)
  const intBuf = new Float32Array(NN);
  function forwardTrue(x0, y0) {
    buildProbe(wRe, wIm, x0, y0, DF);
    for (let s = 0; s < NS; s++) {
      const o = s * NN;
      for (let i = 0; i < NN; i++) {
        const a = wRe[i], b = wIm[i], cr = tRe[o + i], ci = tIm[o + i];
        wRe[i] = a * cr - b * ci; wIm[i] = a * ci + b * cr;
      }
      propagate(wRe, wIm, propRe, propIm);
    }
    fft2d(wRe, wIm, false);
    for (let i = 0; i < NN; i++) intBuf[i] = wRe[i] * wRe[i] + wIm[i] * wIm[i];
    return intBuf;
  }

  // scan grid
  const scanPos = [];
  for (let r = 0; r < SCAN_N; r++) for (let c = 0; c < SCAN_N; c++)
    scanPos.push([(c - (SCAN_N - 1) / 2) * STEP, (r - (SCAN_N - 1) / 2) * STEP]);
  const NPOS = scanPos.length;

  // measured amplitudes + recon state live in a page-global cache so a theme
  // toggle (which re-serializes the shadow DOM and re-mounts the widget) does
  // NOT re-run the simulation or reset the reconstruction.
  const BASE_KEY = "pms-v12|" + [N, PX, ALPHA, NS, NR, SCAN_N, SCAN_EXT, PHI_M, PHI_C].join(",");
  const gcPeek = globalThis.__pmsCache;
  if (gcPeek && gcPeek.baseKey === BASE_KEY && gcPeek.meta) {
    if (gcPeek.meta.df) DF = gcPeek.meta.df;                 // defocus survives re-mounts
    if (gcPeek.meta.doseIdx != null) doseIdx = Math.min(gcPeek.meta.doseIdx, DOSES.length - 1);
  }
  const keyFor = (df) => BASE_KEY + "|df" + df;
  const CACHE_KEY = keyFor(DF);
  const gcOld = gcPeek && gcPeek.key === CACHE_KEY ? gcPeek : null;
  const ampsClean = gcOld ? gcOld.ampsClean : new Float32Array(NPOS * NN);
  const ampsUse = gcOld ? gcOld.ampsUse : new Float32Array(NPOS * NN);
  let simDone = gcOld ? NPOS : 0, ready = !!gcOld;

  // ---- reconstruction state --------------------------------------------------
  const ORe = gcOld ? gcOld.ORe : new Float32Array(NR * NN), OIm = gcOld ? gcOld.OIm : new Float32Array(NR * NN);
  const gRe = new Float32Array(NR * NN), gIm = new Float32Array(NR * NN);   // batch gradient
  const mRe = gcOld ? gcOld.mRe : new Float32Array(NR * NN), mIm = gcOld ? gcOld.mIm : new Float32Array(NR * NN);
  const vRe = gcOld ? gcOld.vRe : new Float32Array(NR * NN), vIm = gcOld ? gcOld.vIm : new Float32Array(NR * NN);
  const psiRe = new Float32Array(NR * NN), psiIm = new Float32Array(NR * NN); // stored per-slice inputs
  if (!gcOld) globalThis.__pmsCache = { key: CACHE_KEY, baseKey: BASE_KEY, ampsClean, ampsUse, ORe, OIm, mRe, mIm, vRe, vIm,
    meta: { iter: 0, adamT: 0, init: false, df: DF, doseIdx } };
  const cacheMeta = globalThis.__pmsCache.meta;
  let iter = cacheMeta.iter, adamT = cacheMeta.adamT, relErr = NaN;
  function resetRecon() {
    ORe.fill(1); OIm.fill(0); mRe.fill(0); mIm.fill(0); vRe.fill(0); vIm.fill(0); gRe.fill(0); gIm.fill(0);
    iter = 0; adamT = 0; relErr = NaN; batchK = 0;
    cacheMeta.iter = 0; cacheMeta.adamT = 0; cacheMeta.init = true;
    paintRecon(); paintXZ(); paintDPRight(); updateStat();
  }
  resetRecon.later = true;

  // forward through the current OBJECT estimate (13 slices, padded geometry)
  function forwardModel(x0, y0, store) {
    // chi = -pi*lam*df*k^2 grows by -pi*lam*dz*k^2 per +dz, so the probe ZPAD
    // UPSTREAM of the sample entrance carries defocus DF - ZPAD (not DF + ZPAD:
    // that mismatch defocused the model by 2*ZPAD and shifted the recon in z)
    buildProbe(wRe, wIm, x0, y0, DF - ZPAD_TOP);
    for (let s = 0; s < NR; s++) {
      const o = s * NN;
      if (store) { psiRe.set(wRe.subarray(0, NN), o); psiIm.set(wIm.subarray(0, NN), o); }
      for (let i = 0; i < NN; i++) {
        const a = wRe[i], b = wIm[i], cr = ORe[o + i], ci = OIm[o + i];
        wRe[i] = a * cr - b * ci; wIm[i] = a * ci + b * cr;
      }
      propagate(wRe, wIm, propRRe, propRIm);
    }
    fft2d(wRe, wIm, false); // leave wave at the detector in (wRe, wIm)
  }

  // Poisson resampling of the clean dataset for the selected dose
  let g1 = 0, g2 = 0, gHave = false;
  function gauss() {
    if (gHave) { gHave = false; return g2; }
    const u = Math.random() || 1e-12, v = Math.random();
    const r = Math.sqrt(-2 * Math.log(u));
    g1 = r * Math.cos(2 * Math.PI * v); g2 = r * Math.sin(2 * Math.PI * v);
    gHave = true; return g1;
  }
  function poisson(lam) {
    if (lam <= 0) return 0;
    if (lam > 25) { const v = Math.round(lam + Math.sqrt(lam) * gauss()); return v < 0 ? 0 : v; }
    const L = Math.exp(-lam);
    let k = 0, pr = 1;
    do { k++; pr *= Math.random(); } while (pr > L);
    return k - 1;
  }
  function applyDose() {
    const D = DOSES[doseIdx];
    if (!isFinite(D)) { ampsUse.set(ampsClean); return; }
    for (let p2 = 0; p2 < NPOS; p2++) {
      const o = p2 * NN;
      let tot = 0;
      for (let i = 0; i < NN; i++) tot += ampsClean[o + i] * ampsClean[o + i];
      const sc = D / Math.max(tot, 1e-12), inv = 1 / sc;
      for (let i = 0; i < NN; i++) {
        const lam = ampsClean[o + i] * ampsClean[o + i] * sc;
        ampsUse[o + i] = Math.sqrt(poisson(lam) * inv);
      }
    }
  }

  // one gradient accumulation for probe position p (adds into gRe/gIm), returns batch error terms
  function accumGrad(p) {
    const x0 = scanPos[p][0], y0 = scanPos[p][1], aOff = p * NN;
    forwardModel(x0, y0, true);
    // residual at the detector: g = (1 - a/|Psi|) * Psi
    let num = 0, den = 0;
    for (let i = 0; i < NN; i++) {
      const re = wRe[i], im = wIm[i];
      const mag = Math.sqrt(re * re + im * im) + 1e-12, a = ampsUse[aOff + i];
      const f = 1 - a / mag;
      num += (mag - a) * (mag - a); den += a * a;
      wRe[i] = f * re; wIm[i] = f * im;
    }
    fft2d(wRe, wIm, true);
    // backward pass
    for (let s = NR - 1; s >= 0; s--) {
      propagate(wRe, wIm, propCRe, propCIm); // adjoint propagator (conjugate)
      const o = s * NN;
      for (let i = 0; i < NN; i++) {
        const grn = wRe[i], gin = wIm[i];
        // object gradient: g_O = g_phi * conj(psi_in)
        gRe[o + i] += grn * psiRe[o + i] + gin * psiIm[o + i];
        gIm[o + i] += gin * psiRe[o + i] - grn * psiIm[o + i];
        // pass through object: g_psi = g_phi * conj(O)
        const cr = ORe[o + i], ci = OIm[o + i];
        wRe[i] = grn * cr + gin * ci; wIm[i] = gin * cr - grn * ci;
      }
    }
    return [num, den];
  }

  // Adam step over all slices
  function adamStep(scale) {
    adamT++;
    cacheMeta.iter = iter + 1; cacheMeta.adamT = adamT;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    const c1 = 1 - Math.pow(b1, adamT), c2 = 1 - Math.pow(b2, adamT);
    for (let i = 0; i < NR * NN; i++) {
      const gr = gRe[i] * scale, gi = gIm[i] * scale;
      mRe[i] = b1 * mRe[i] + (1 - b1) * gr; mIm[i] = b1 * mIm[i] + (1 - b1) * gi;
      vRe[i] = b2 * vRe[i] + (1 - b2) * gr * gr; vIm[i] = b2 * vIm[i] + (1 - b2) * gi * gi;
      ORe[i] -= LR * (mRe[i] / c1) / (Math.sqrt(vRe[i] / c2) + eps);
      OIm[i] -= LR * (mIm[i] / c1) / (Math.sqrt(vIm[i] / c2) + eps);
    }
    gRe.fill(0); gIm.fill(0);
  }

  // ---- painters --------------------------------------------------------------
  const probe = { x: 0, y: 0 };
  let sliceMode = false;
  let dpMode = "bf"; // diffraction display contrast: bright-field or dark-field scaling
  const PHI_SCALE = PHI_M * 1.25; // shared greyscale for truth AND reconstruction

  // Oblique parallel projection with mild perspective. The display geometry is
  // deliberately DECOUPLED from the physical spacings: x-y is exaggerated and each
  // panel spreads its slices at its own vertical pitch so the stack reads clearly.
  const XY = 2.0;                       // lateral display exaggeration
  const PITCH = 10.0;                   // slice display pitch, IDENTICAL for both panels
  const ZDP = -52;                      // DP plane, IDENTICAL height for both panels
  const DPSIZE = 30;                    // DP quad width in scene units (x XY on screen)
  const view = {
    ca: 1, sa: 0,
    ce: Math.cos(-14 * Math.PI / 180), se: Math.sin(-14 * Math.PI / 180),
    zoom: 52, cx: SW / 2, cy: SH * 0.386, fl: 45,
  };
  function proj(x, y, z) {
    const rx = (x * view.ca - y * view.sa) * XY;
    const ry = (x * view.sa + y * view.ca) * XY;
    const depth = ry * view.ce - z * view.se;
    const sc = view.fl > 0 ? view.fl / (view.fl - depth + 200) : 1;
    return { sx: rx * view.zoom * sc + view.cx, sy: (-ry * view.se - z * view.ce) * view.zoom * sc + view.cy, depth };
  }
  function unproj(sx, sy) { // inverse on the stack mid-plane (z = 0)
    const perspScale = view.fl > 0 ? view.fl / (view.fl + 200) : 1;
    const effZoom = view.zoom * perspScale;
    const px2 = (sx - view.cx) / effZoom / XY;
    const py2 = -(sy - view.cy) / effZoom / XY;
    const pyse = py2 / view.se;
    return { x: view.ca * px2 + view.sa * pyse, y: -view.sa * px2 + view.ca * pyse };
  }

  // per-panel display geometry: evenly spaced slice planes at the SAME pitch on
  // both sides, and the DP plane at the SAME height on both sides. The physical
  // depth of slice i (A, 0 = sample entrance) drives the beam-circle radii.
  function sideGeom(side) {
    const nSl = side === "R" ? NR_SHOW : NS;
    const zTopSlice = (nSl - 1) / 2 * PITCH;
    const sliceZ = (i) => zTopSlice - i * PITCH;          // i may be fractional (atoms)
    const slicePhysZ = (i) => side === "R" ? -ZPAD + (i + 0.5) * DZR : (i + 0.5) * DZ;
    return { nSl, zTopSlice, zDP: ZDP, sliceZ, slicePhysZ };
  }

  function greyImage(ctx, data, off, scale, w, h) {
    const img = ctx.createImageData(w, h);
    const px = img.data;
    const lo = dark ? 0 : 255, hi = dark ? 255 : 0;
    for (let i = 0; i < w * h; i++) {
      let t = data[off + i] / scale; if (t < 0) t = 0; if (t > 1) t = 1;
      const v = lo + (hi - lo) * t;
      px[i * 4] = v; px[i * 4 + 1] = v; px[i * 4 + 2] = v; px[i * 4 + 3] = 255;
    }
    return img;
  }

  function mkTex() { const c = document.createElement("canvas"); c.width = N; c.height = N; return c; }
  const dpLOff = mkTex(), dpROff = mkTex();
  const texL = Array.from({ length: NS }, mkTex);
  const texR = Array.from({ length: NR_SHOW }, mkTex);
  const phBuf = new Float32Array(NN);
  function buildTexL() {
    for (let s2 = 0; s2 < NS; s2++) {
      const ctx = texL[s2].getContext("2d");
      ctx.putImageData(greyImage(ctx, phase, s2 * NN, PHI_SCALE, N, N), 0, 0);
    }
  }
  function buildTexR() {
    // locked to the ground-truth scale, boosted 2x: the recovered phase is smeared
    // across the thicker recon slices, so its peaks sit well below the truth peaks.
    // The NR_HID hidden headroom slices are solved but never displayed.
    for (let s2 = 0; s2 < NR_SHOW; s2++) {
      const o = (s2 + NR_HID) * NN;
      for (let i = 0; i < NN; i++) phBuf[i] = Math.atan2(OIm[o + i], ORe[o + i]);
      const ctx = texR[s2].getContext("2d");
      ctx.putImageData(greyImage(ctx, phBuf, 0, PHI_SCALE * 0.5, N, N), 0, 0);
    }
  }


  const KAPPX = KAP / DK;            // BF-disk radius in DP pixels
  const KALPX = KMAX_AL / DK;        // band-limit radius in DP pixels
  const MIRX = false, MIRY = false;  // display mirroring (validated: +defocus is upright)
  let dpNorm = null;                 // measured-pattern range, shared with the model DP
  function paintDP(cv, inten, normOverride) {
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(N, N);
    const px = img.data;
    const h = N >> 1;
    // LINEAR scaling between the min and max of the chosen region:
    // BF = inside the bright-field disk, DF = outside it (diffracted intensity)
    let mn = Infinity, mx = -Infinity;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const dist = Math.hypot(r - h, c - h);
        const inBF = dist < KAPPX - 2, inDF = dist > KAPPX + 2 && dist < KALPX - 1;
        if ((dpMode === "bf" && !inBF) || (dpMode === "df" && !inDF)) continue;
        const sr = ((MIRY ? N - 1 - r : r) + h) % N, sc2 = ((MIRX ? N - 1 - c : c) + h) % N;
        const v = inten[sr * N + sc2];
        if (v < mn) mn = v; if (v > mx) mx = v;
      }
    }
    // identical scaling on both panels: the measured pattern defines the range
    if (normOverride) { mn = normOverride.mn; mx = normOverride.mx; }
    const rng = mx - mn || 1;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const sr = ((MIRY ? N - 1 - r : r) + h) % N, sc2 = ((MIRX ? N - 1 - c : c) + h) % N;
        let t = (inten[sr * N + sc2] - mn) / rng;
        if (t < 0) t = 0; if (t > 1) t = 1;
        const [rr, gg, bb] = turboBlack(t);
        const o = (r * N + c) * 4;
        px[o] = rr; px[o + 1] = gg; px[o + 2] = bb; px[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { mn, mx };
  }

  // draw an image as a tilted quad centered at (x, y, zScene)
  function drawQuad(ctx, imgCv, x, y, zScene, half, alpha, borderColor) {
    // Perspective-correct textured quad: an affine setTransform can only draw a
    // parallelogram, so the quad is sliced into horizontal bands, each drawn with
    // its own affine map. Band edges land exactly on the projected trapezoid.
    const W2 = imgCv.width, H2 = imgCv.height, NB = 16; // integer source bands (128/16 = 8 px)
    const Lpts = [], Rpts = [];
    for (let b = 0; b <= NB; b++) {
      const yy = y - half + (2 * half * b) / NB;
      Lpts.push(proj(x - half, yy, zScene));
      Rpts.push(proj(x + half, yy, zScene));
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    const srcBand = H2 / NB;
    for (let b = 0; b < NB; b++) {
      const l0 = Lpts[b], r0 = Rpts[b], l1 = Lpts[b + 1];
      const aT = (r0.sx - l0.sx) / W2, bT = (r0.sy - l0.sy) / W2;
      const cT = (l1.sx - l0.sx) / srcBand, dT = (l1.sy - l0.sy) / srcBand;
      ctx.setTransform(aT, bT, cT, dT, l0.sx, l0.sy);
      const ov = b < NB - 1 ? 0.6 : 0; // slight source overlap into the next band: no hairline seams
      ctx.drawImage(imgCv, 0, b * srcBand, W2, srcBand + ov, 0, 0, W2, srcBand + ov);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    const c0 = Lpts[0], c1 = Rpts[0], c2 = Rpts[NB], c3 = Lpts[NB];
    if (borderColor) {
      ctx.strokeStyle = borderColor; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c0.sx, c0.sy); ctx.lineTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy); ctx.lineTo(c3.sx, c3.sy);
      ctx.closePath(); ctx.stroke();
    }
    return [(c0.sx + c1.sx + c2.sx + c3.sx) / 4, (c0.sy + c1.sy + c2.sy + c3.sy) / 4];
  }


  function paintScene(ctx, side) {
    ctx.clearRect(0, 0, SW, SH);
    ctx.fillStyle = dark ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, SW, SH);
    const isSlices = side === "R" || sliceMode;
    const dpCv2 = side === "R" ? dpROff : dpLOff;
    const g = sideGeom(side);

    // DP plane first (bottom-most)
    drawQuad(ctx, dpCv2, probe.x, probe.y, g.zDP, DPSIZE / 2, 1.0, dark ? "rgba(120,120,120,0.5)" : "rgba(80,80,80,0.4)");

    // sample: atoms or slice stack, painted back-to-front along z
    if (!isSlices) {
      const pr = [];
      for (const a of atoms) {
        const p = proj(a.x, a.y, g.sliceZ(a.z / DZ - 0.5));
        pr.push({ sx: p.sx, sy: p.sy, d: p.depth, kind: a.kind });
      }
      pr.sort((a, b) => a.d - b.d);
      let minD = Infinity, maxD = -Infinity;
      for (const a of pr) { if (a.d < minD) minD = a.d; if (a.d > maxD) maxD = a.d; }
      const rD = maxD - minD || 1;
      for (const a of pr) {
        const t = (a.d - minD) / rD;
        const size = (a.kind === 0 ? 16.5 : 8.0) + 7.0 * t;
        const fade = 0.58 + 0.42 * t;
        ctx.fillStyle = a.kind === 0
          ? `rgba(${232 * fade | 0},${178 * fade | 0},${42 * fade | 0},0.97)`
          : (dark ? `rgba(${156 * fade | 0},${164 * fade | 0},${176 * fade | 0},0.92)` : `rgba(${125 * fade | 0},${132 * fade | 0},${142 * fade | 0},0.95)`);
        ctx.strokeStyle = dark ? `rgba(0,0,0,${0.2 + 0.4 * t})` : `rgba(0,0,0,${0.25 + 0.35 * t})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(a.sx, a.sy, size, 0, 6.283); ctx.fill(); ctx.stroke();
      }
    } else {
      const tex = side === "R" ? texR : texL;
      const bc = dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.24)";
      for (let s2 = g.nSl - 1; s2 >= 0; s2--) { // bottom (far) first
        drawQuad(ctx, tex[s2], 0, 0, g.sliceZ(s2), BOX / 2, 0.9, bc);
      }
    }

    // geometric beam cross-section circle on every plane (underfocus: grows with depth)
    if (isSlices) {
    ctx.strokeStyle = dark ? "rgba(0,255,136,0.65)" : "rgba(0,150,80,0.7)";
    ctx.lineWidth = 2.4;
    for (let s2 = 0; s2 < g.nSl; s2++) {
      const zs = g.sliceZ(s2);
      const rad = ALPHA * Math.abs(DF + g.slicePhysZ(s2));
      if (rad < 0.15) continue;
      ctx.beginPath();
      for (let i = 0; i <= 36; i++) {
        const a2 = i / 36 * Math.PI * 2;
        const pp = proj(probe.x + Math.cos(a2) * rad, probe.y + Math.sin(a2) * rad, zs);
        i ? ctx.lineTo(pp.sx, pp.sy) : ctx.moveTo(pp.sx, pp.sy);
      }
      ctx.stroke();
    }
    }

    // fixed label: panel label at the top
    ctx.textAlign = "center";
    ctx.fillStyle = dark ? "rgba(232,238,244,0.88)" : "rgba(26,26,26,0.85)";
    ctx.font = "600 32px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(side === "R" ? "reconstructed slices" : (sliceMode ? "potential slices" : "atomic model"), SW / 2, 40);
    ctx.textAlign = "start";
  }

  const ctxL = sceneL.getContext("2d"), ctxR = sceneR.getContext("2d");
  function paintView() {
    if (sliceMode) buildTexL();
    paintScene(ctxL, "L");
  }
  const dpNoise = new Float32Array(NN);
  function paintDPLeft() {
    const inten = forwardTrue(probe.x, probe.y);
    const D = DOSES[doseIdx];
    if (isFinite(D)) {
      let tot = 0;
      for (let i = 0; i < NN; i++) tot += inten[i];
      const sc = D / Math.max(tot, 1e-12), inv = 1 / sc;
      for (let i = 0; i < NN; i++) dpNoise[i] = poisson(inten[i] * sc) * inv;
      dpNorm = paintDP(dpLOff, dpNoise);
    } else {
      dpNorm = paintDP(dpLOff, inten);
    }
    paintScene(ctxL, "L");
  }
  function paintRecon() {
    buildTexR();
    paintScene(ctxR, "R");
  }
  function paintDPRight() {
    if (!ready) return;
    forwardModel(probe.x, probe.y, false);
    for (let i = 0; i < NN; i++) intBuf[i] = wRe[i] * wRe[i] + wIm[i] * wIm[i];
    paintDP(dpROff, intBuf, dpNorm);
    paintScene(ctxR, "R");
  }

  function paintXZ() { /* x-z strip removed: smearing reads directly in the slice stack */ }

  function updateStat() {
    statEl.textContent = `iteration ${iter}/${MAX_ITER}` + (isFinite(relErr) ? ` · data error ${(100 * relErr).toFixed(1)}%` : "");
  }
  function paintAll() {
    buildTexL(); buildTexR();
    paintDPLeft(); paintRecon(); paintXZ(); paintDPRight(); paintView(); updateStat();
  }

  // ---- interactions ----------------------------------------------------------
  const CLAMP = SCAN_EXT / 2 + 0.8;
  function setProbe(x, y) {
    probe.x = Math.max(-CLAMP, Math.min(CLAMP, x));
    probe.y = Math.max(-CLAMP, Math.min(CLAMP, y));
    paintDPLeft();
    if (ready) paintDPRight(); else paintScene(ctxR, "R");
  }
  function hit(ev, cv) {
    const r = cv.getBoundingClientRect();
    const sx = (ev.clientX - r.left) / r.width * SW;
    const sy = (ev.clientY - r.top) / r.height * SH;
    const p = unproj(sx, sy);
    return [p.x, p.y];
  }
  function addDrag(cv) {
    // relative dragging: grab anywhere (slices, DP, empty space) and move the
    // probe by the pointer DELTA, so vertical freedom never depends on where
    // the initial click landed
    let dragging = false, sx0 = 0, sy0 = 0, px0 = 0, py0 = 0, css = 2;
    cv.addEventListener("pointerdown", (e) => {
      dragging = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      if (scanning) stopScan();
      const r = cv.getBoundingClientRect();
      css = SW / r.width;
      sx0 = e.clientX; sy0 = e.clientY; px0 = probe.x; py0 = probe.y;
    });
    cv.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const effZoom = view.zoom * (view.fl > 0 ? view.fl / (view.fl + 200) : 1);
      const du = (e.clientX - sx0) * css / effZoom / XY;
      const dv = -(e.clientY - sy0) * css / effZoom / XY / view.se;
      setProbe(px0 + du, py0 + dv);
    });
    cv.addEventListener("pointerup", () => dragging = false);
    cv.addEventListener("pointercancel", () => dragging = false);
  }

  addDrag(sceneL);
  addDrag(sceneR);

  tglBtn.addEventListener("click", () => {
    sliceMode = !sliceMode;
    tglBtn.textContent = sliceMode ? "Atoms" : "Slices";
    paintView();
  });
  dpmBtn.addEventListener("click", () => {
    dpMode = dpMode === "bf" ? "df" : "bf";
    dpmBtn.textContent = dpMode === "bf" ? "Scale: BF disk" : "Scale: dark field";
    paintDPLeft();
    if (ready) paintDPRight();
  });

  const doseLabel = () => isFinite(DOSES[doseIdx]) ? DOSES[doseIdx].toExponential(0).replace("e+", "e") + " e⁻/pattern" : "∞ e⁻/pattern";
  dfSlider.value = DF; dfLab.textContent = DF + " Å";
  // (labels update below; C1 = -defocus)
  dsSlider.value = doseIdx; dsLab.textContent = doseLabel();
  dfSlider.addEventListener("input", () => {   // live: update the geometry display only
    DF = +dfSlider.value;
    dfLab.textContent = DF + " Å";
    paintScene(ctxL, "L"); paintScene(ctxR, "R");
  });
  dfSlider.addEventListener("change", () => {  // on release: rebuild the dataset
    DF = +dfSlider.value;
    restartSim();
  });
  dsSlider.addEventListener("input", () => { doseIdx = +dsSlider.value; dsLab.textContent = doseLabel(); });
  dsSlider.addEventListener("change", () => {
    doseIdx = +dsSlider.value;
    cacheMeta.doseIdx = doseIdx;
    dsLab.textContent = doseLabel();
    if (!ready) return;
    applyDose();
    stopRecon();
    resetRecon();
    paintDPLeft();
  });

  // serpentine scan
  let scanning = false, scanIdx = 0, scanRaf = null, lastScanT = 0;
  function scanOrder(i) {
    const r = Math.floor(i / SCAN_N), c = i % SCAN_N;
    return r * SCAN_N + (r % 2 ? SCAN_N - 1 - c : c);
  }
  function stopScan() { scanning = false; if (scanRaf) cancelAnimationFrame(scanRaf); scanRaf = null; scanBtn.classList.remove(`${id}-on`); scanBtn.textContent = "▶ Scan"; }
  function scanTick(now) {
    if (!scanning) return;
    scanRaf = requestAnimationFrame(scanTick);
    if (now - lastScanT < 90) return;
    lastScanT = now;
    const p = scanPos[scanOrder(scanIdx % NPOS)];
    scanIdx++;
    setProbe(p[0], p[1]);
  }
  scanBtn.addEventListener("click", () => {
    if (scanning) { stopScan(); return; }
    scanning = true; scanBtn.classList.add(`${id}-on`); scanBtn.textContent = "■ Stop";
    scanRaf = requestAnimationFrame(scanTick);
  });

  // ---- reconstruction loop (1 probe position per frame, Adam step per batch) --
  let running = false, reconRaf = null, batchK = 0, batchNum = 0, batchDen = 0;
  let order = [];
  function reshuffle() {
    order = Array.from({ length: NPOS }, (_, i) => i);
    for (let i = NPOS - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
  }
  reshuffle();
  let orderPtr = 0;
  function reconTick() {
    if (!running) return;
    reconRaf = requestAnimationFrame(reconTick);
    // two probe positions per frame keeps ~30 fps with visible progress
    for (let rep = 0; rep < 2 && running; rep++) {
      if (orderPtr >= NPOS) { orderPtr = 0; reshuffle(); }
      const [num, den] = accumGrad(order[orderPtr++]);
      batchNum += num; batchDen += den; batchK++;
      if (batchK >= BATCH) {
        adamStep(1 / BATCH);
        iter++;
        relErr = Math.sqrt(batchNum / Math.max(batchDen, 1e-12));
        batchK = 0; batchNum = 0; batchDen = 0;
        paintRecon(); paintXZ(); updateStat();
        if (iter % 3 === 0) paintDPRight();
        if (iter >= MAX_ITER) { stopRecon(); paintDPRight(); break; }
      }
    }
  }
  function stopRecon() { running = false; if (reconRaf) cancelAnimationFrame(reconRaf); reconRaf = null; runBtn.classList.remove(`${id}-on`); runBtn.textContent = "▶ Reconstruct"; }
  runBtn.addEventListener("click", () => {
    if (!ready) return;
    if (running) { stopRecon(); return; }
    if (iter >= MAX_ITER) resetRecon();
    running = true; runBtn.classList.add(`${id}-on`); runBtn.textContent = "■ Pause";
    reconRaf = requestAnimationFrame(reconTick);
  });
  rstBtn.addEventListener("click", () => { stopRecon(); resetRecon(); });

  // ---- load-time simulation of the 11x11 dataset (chunked) -------------------
  // setTimeout (not rAF) so the dataset still builds when the tab starts hidden.
  let simTimer = null;
  function simOne() {
    const inten = forwardTrue(scanPos[simDone][0], scanPos[simDone][1]);
    const o = simDone * NN;
    for (let i = 0; i < NN; i++) ampsClean[o + i] = Math.sqrt(inten[i]);
    simDone++;
  }
  function simFinish() {
    applyDose();
    ready = true;
    loadEl.style.display = "none";
    if (!cacheMeta.init) resetRecon();
    paintAll();
  }
  function restartSim() { // defocus changed: rebuild the dataset (on slider release)
    stopRecon(); if (scanning) stopScan();
    ready = false; simDone = 0;
    cacheMeta.init = false; cacheMeta.iter = 0; cacheMeta.adamT = 0; cacheMeta.df = DF;
    globalThis.__pmsCache.key = keyFor(DF);
    loadEl.style.display = ""; loadBar.style.width = "0%";
    clearTimeout(simTimer); simTimer = setTimeout(simChunk, 20);
  }
  function simChunk() {
    const t0 = performance.now();
    while (simDone < NPOS && performance.now() - t0 < 26) simOne();
    loadBar.style.width = (100 * simDone / NPOS).toFixed(0) + "%";
    if (simDone < NPOS) { simTimer = setTimeout(simChunk, 16); return; }
    simFinish();
  }
  if (ready) { loadEl.style.display = "none"; setTimeout(() => paintAll(), 0); }
  else {
    // paint the scenes immediately so the compact loading pill overlays real content
    buildTexL(); buildTexR(); paintView(); paintScene(ctxR, "R");
    simTimer = setTimeout(simChunk, 30);
  }

  // debug hooks for automated testing (harmless in production)
  el.__pmsDebug = () => ({ ready, iter, relErr, simDone, NPOS, probe: { ...probe } });
  el.__pmsRun = {
    simAll() { while (simDone < NPOS) simOne(); if (!ready) { clearTimeout(simTimer); simFinish(); } },
    dpStats(x, y) {
      paintDP(dpLOff, forwardTrue(x, y));
      const d = dpLOff.getContext("2d").getImageData(0, 0, N, N).data;
      const h = N >> 1;
      let L = 0, R = 0, T = 0, B = 0, nL = 0, nR = 0, nT = 0, nB = 0;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (Math.hypot(r - h, c - h) > KAPPX - 3) continue;
        const o = (r * N + c) * 4, lum = d[o] + d[o + 1] + d[o + 2];
        if (c < h) { L += lum; nL++; } else { R += lum; nR++; }
        if (r < h) { T += lum; nT++; } else { B += lum; nB++; }
      }
      return { left: +(L / nL).toFixed(1), right: +(R / nR).toFixed(1), top: +(T / nT).toFixed(1), bottom: +(B / nB).toFixed(1) };
    },
    reconSteps(n) {
      if (!ready) return null;
      const t0 = performance.now();
      for (let it = 0; it < n && iter < MAX_ITER; it++) {
        let num = 0, den = 0;
        for (let b = 0; b < BATCH; b++) {
          if (orderPtr >= NPOS) { orderPtr = 0; reshuffle(); }
          const r = accumGrad(order[orderPtr++]);
          num += r[0]; den += r[1];
        }
        adamStep(1 / BATCH);
        iter++;
        relErr = Math.sqrt(num / Math.max(den, 1e-12));
      }
      paintRecon(); paintXZ(); paintDPRight(); updateStat();
      return { iter, relErr, ms_per_iter: (performance.now() - t0) / n };
    },
  };

  el.__pmsCleanup = () => {
    stopScan(); stopRecon();
    if (simTimer) clearTimeout(simTimer);
    mo.disconnect(); clearInterval(themeIv);
  };
}

export default { render };
