// ptycho-ms.js — interactive multislice electron ptychography demo (MyST anywidget).
//
// Left panel: 4D-STEM acquisition geometry. A decahedral metal nanoparticle
// (5-fold axis along the beam, 2 laterally-offset 111 layers per slice) sits on
// an amorphous carbon substrate, 11 potential slices total. The probe can be
// dragged freely or scanned in a serpentine over the 11x11 acquisition grid,
// with the live far-field diffraction pattern shown below (power-0.5 scaling,
// turbo-with-black colormap). A toggle flips the sample view between the 3D
// atomic model and the greyscale 2D phase slices.
//
// Right panel: mini-batch gradient-descent multislice ptychography (pixelated
// forward model as in quantEM's diffractive_imaging module; probe assumed known,
// object-only, Adam optimizer, batch of 11 random probe positions per step).
// The reconstruction volume spans the sample plus a small pad above and below,
// split into recon_slices (default 7, thicker than the true slices) so the
// elongation of features along the beam direction is visible,
// especially in the x-z cross-section. The model diffraction pattern from the
// current object estimate is shown at the shared (linked) probe position.
//
// The 11x11 dataset is simulated in-browser at load (~2 s, chunked with a
// progress bar); there are no data files. Physics: 300 kV, 30 mrad, 128^2 grid
// at 0.2 A/px, 4.7 A slices, defocus 130 A -> ~80% probe overlap at 1.6 A steps.
// Depth resolution 2*lambda/alpha^2 ~ 44 A vs a ~52 A stack: partial sectioning.

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

  // slice roles: 0,1 top caps; 2..6 center; 7,8 bottom caps; 9,10 aC substrate
  const ringR = [2, 3, 4, 4, 4, 4, 4, 3, 2]; // pentagon "rings" per particle slice
  for (let s = 0; s < 9; s++) {
    const R = ringR[s];
    for (let w = 0; w < 5; w++) {
      const t0 = (w * 72 - 90) * Math.PI / 180;
      const e1 = [Math.cos(t0 - 36 * Math.PI / 180), Math.sin(t0 - 36 * Math.PI / 180)];
      const e2 = [Math.cos(t0 + 36 * Math.PI / 180), Math.sin(t0 + 36 * Math.PI / 180)];
      // per-wedge B-layer stacking offset along the wedge bisector
      const bis = [(e1[0] + e2[0]), (e1[1] + e2[1])];
      const bl = Math.hypot(bis[0], bis[1]) || 1;
      const off = [bis[0] / bl * a * 0.577, bis[1] / bl * a * 0.577];
      for (let i = 0; i <= R; i++) {
        for (let j = 0; j <= R - i; j++) {
          if (w > 0 && j === 0) continue; // seam atoms belong to the previous wedge
          if (i === 0 && j === 0 && w > 0) continue; // apex once
          const x = a * (i * e1[0] + j * e2[0]);
          const y = a * (i * e1[1] + j * e2[1]);
          // two laterally-offset layers per slice (ABAB along the 5-fold axis)
          atoms.push({ x, y, z: (s + 0.28) * DZ, kind: 0, slice: s });
          if (i + j < R) atoms.push({ x: x + off[0], y: y + off[1], z: (s + 0.72) * DZ, kind: 0, slice: s });
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
    while (placed.length < count && guard++ < 4000) {
      const x = (rng() * 2 - 1) * (halfBox - 1.5);
      const y = (rng() * 2 - 1) * (halfBox - 1.5);
      if (avoidR && Math.hypot(x, y) < avoidR) continue; // keep clear of the particle core
      let ok = true;
      for (const p of placed) if ((p.x - x) ** 2 + (p.y - y) ** 2 < 1.7 * 1.7) { ok = false; break; }
      if (!ok) continue;
      const z = (slice + 0.2 + rng() * 0.6) * DZ;
      placed.push({ x, y, z });
      atoms.push({ x, y, z, kind: 1, slice });
    }
  }
  addCarbon(8, 14, 5.5);  // bottom cap slice picks up some carbon around the particle base
  addCarbon(9, 30, 0);    // substrate
  addCarbon(10, 30, 0);   // substrate

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
  const ALPHA = opt("alpha", 0.030);            // rad
  const KAP = ALPHA / LAM;                      // aperture radius, 1/A
  const DZ = opt("slice_thickness", 4.7);       // A
  const NS = 11;                                // sample slices
  const NR = Math.max(3, opt("recon_slices", 7)); // reconstruction slices
  const ZPAD = 4.7;                             // recon volume pad above/below sample (A)
  const DF = opt("defocus", 130);               // A (probe crossover below entrance)
  const SCAN_N = 11;
  const SCAN_EXT = opt("scan_extent", 16.0);    // A, full width of scan grid
  const STEP = SCAN_EXT / (SCAN_N - 1);
  const PHI_M = opt("phi_metal", 0.6);          // peak phase per metal atom (rad)
  const PHI_C = opt("phi_carbon", 0.25);
  const BATCH = opt("batch", 11);
  const LR = opt("learning_rate", 0.02);
  const KMAX_AL = (2 / 3) / (2 * PX);           // anti-alias band limit, 1/A

  const cfg = { N, PX, NS, DZ, PHI_M, PHI_C, SIG_M: 0.5, SIG_C: 0.6 };

  // ---- DOM -------------------------------------------------------------------
  // Each panel is ONE stem4d-style scene canvas: probe cone from the top, the
  // sample in the middle, and the diffraction pattern as a tilted plane below.
  const CW = 372, CH = 452;             // CSS size; internal canvases are 2x
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
    .${id}-slider { flex: 1; min-width: 70px; accent-color: var(--accent); }
    .${id}-lab { font-size: 11px; color: var(--dim); white-space: nowrap; }
    .${id}-caption { font-size: 10.5px; color: var(--dim); margin: 3px 0 6px; }
    .${id}-stat { font-size: 11px; color: var(--dim); font-variant-numeric: tabular-nums; margin-top: 2px; min-height: 14px; }
    .${id}-load { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 10px; align-items: center;
      justify-content: center; background: var(--bg); z-index: 5; border-radius: 10px; }
    .${id}-bar { width: 220px; height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
    .${id}-bar > div { height: 100%; width: 0%; background: var(--accent); transition: width 0.1s; }
  </style>
  <div class="${id}-wrap">
    <div class="${id}-load"><div style="font-size:12px">Simulating the 11×11 4D-STEM dataset…</div><div class="${id}-bar"><div></div></div></div>
    <div class="${id}-cols">
      <div class="${id}-panel">
        <div class="${id}-ptitle">Experiment: 4D-STEM acquisition</div>
        <canvas class="${id}-sceneL" width="${SW}" height="${SH}"></canvas>
        <div class="${id}-row">
          <button class="${id}-btn ${id}-tgl">Slices</button>
          <button class="${id}-btn ${id}-scan">▶ Scan</button>
          <input class="${id}-slider ${id}-zL" type="range" min="0" max="${NS - 1}" value="${NS >> 1}" style="display:none">
          <span class="${id}-lab ${id}-zLlab" style="display:none"></span>
        </div>
        <div class="${id}-caption">Drag the probe or scan the 11×11 grid. The measured diffraction pattern is simulated live below the sample.</div>
      </div>
      <div class="${id}-panel">
        <div class="${id}-ptitle">Reconstruction: multislice ptychography</div>
        <canvas class="${id}-sceneR" width="${SW}" height="${SH}"></canvas>
        <div class="${id}-row">
          <button class="${id}-btn ${id}-run">▶ Reconstruct</button>
          <button class="${id}-btn ${id}-rst">Reset</button>
          <input class="${id}-slider ${id}-zR" type="range" min="0" max="${NR - 1}" value="${NR >> 1}">
          <span class="${id}-lab ${id}-zRlab"></span>
        </div>
        <div class="${id}-caption">The reconstruction slices are shown stacked along the beam. Limited depth resolution smears features between neighboring slices.</div>
        <div class="${id}-stat ${id}-stat1">iteration 0</div>
      </div>
    </div>
  </div>`;

  const wrap = el.querySelector(`.${id}-wrap`);
  const loadEl = el.querySelector(`.${id}-load`), loadBar = loadEl.querySelector(`.${id}-bar > div`);
  const sceneL = el.querySelector(`.${id}-sceneL`), sceneR = el.querySelector(`.${id}-sceneR`);
  const tglBtn = el.querySelector(`.${id}-tgl`), scanBtn = el.querySelector(`.${id}-scan`);
  const runBtn = el.querySelector(`.${id}-run`), rstBtn = el.querySelector(`.${id}-rst`);
  const zL = el.querySelector(`.${id}-zL`), zLlab = el.querySelector(`.${id}-zLlab`);
  const zR = el.querySelector(`.${id}-zR`), zRlab = el.querySelector(`.${id}-zRlab`);
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
  const DZR = (NS * DZ + 2 * ZPAD) / NR;        // recon slice thickness
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
        const ph = Math.PI * LAM * df * (kx * kx + ky * ky) - 2 * Math.PI * (kx * x0 + ky * y0);
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

  // measured amplitudes (sqrt of intensity), filled at load
  const amps = new Float32Array(NPOS * NN);
  let simDone = 0, ready = false;

  // ---- reconstruction state --------------------------------------------------
  const ORe = new Float32Array(NR * NN), OIm = new Float32Array(NR * NN);
  const gRe = new Float32Array(NR * NN), gIm = new Float32Array(NR * NN);   // batch gradient
  const mRe = new Float32Array(NR * NN), mIm = new Float32Array(NR * NN);   // Adam m
  const vRe = new Float32Array(NR * NN), vIm = new Float32Array(NR * NN);   // Adam v
  const psiRe = new Float32Array(NR * NN), psiIm = new Float32Array(NR * NN); // stored per-slice inputs
  let iter = 0, adamT = 0, relErr = NaN;
  function resetRecon() {
    ORe.fill(1); OIm.fill(0); mRe.fill(0); mIm.fill(0); vRe.fill(0); vIm.fill(0); gRe.fill(0); gIm.fill(0);
    iter = 0; adamT = 0; relErr = NaN; batchK = 0;
    paintRecon(); paintXZ(); paintDPRight(); updateStat();
  }
  resetRecon.later = true;

  // forward through the current OBJECT estimate (13 slices, padded geometry)
  function forwardModel(x0, y0, store) {
    buildProbe(wRe, wIm, x0, y0, DF + ZPAD);
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

  // one gradient accumulation for probe position p (adds into gRe/gIm), returns batch error terms
  function accumGrad(p) {
    const x0 = scanPos[p][0], y0 = scanPos[p][1], aOff = p * NN;
    forwardModel(x0, y0, true);
    // residual at the detector: g = (1 - a/|Psi|) * Psi
    let num = 0, den = 0;
    for (let i = 0; i < NN; i++) {
      const re = wRe[i], im = wIm[i];
      const mag = Math.sqrt(re * re + im * im) + 1e-12, a = amps[aOff + i];
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
  let PHI_SCALE = PHI_M * 1.25;

  // stem4d-style oblique parallel projection with mild perspective
  const SQ = 0.5;                          // display squash of the beam (z) axis
  const zMidPhys = (NS * DZ) / 2;
  const sceneHalfZ = zMidPhys * SQ;        // sample block half-height in scene units
  const zDPs = -(sceneHalfZ + 32);         // DP plane
  const zSrc = sceneHalfZ + 21;            // beam source
  const DPSIZE = 30;                       // DP quad width in scene units
  const view = {
    ca: 1, sa: 0,
    ce: Math.cos(-27 * Math.PI / 180), se: Math.sin(-27 * Math.PI / 180),
    zoom: 27, cx: SW / 2, cy: SH * 0.46, fl: 110,
  };
  function proj(x, y, z) {
    const rx = x * view.ca - y * view.sa;
    const ry = x * view.sa + y * view.ca;
    const depth = ry * view.ce - z * view.se;
    const sc = view.fl > 0 ? view.fl / (view.fl - depth + 200) : 1;
    return { sx: rx * view.zoom * sc + view.cx, sy: (-ry * view.se - z * view.ce) * view.zoom * sc + view.cy, depth };
  }
  function unproj(sx, sy) { // inverse on the sample mid-plane (z = 0)
    const perspScale = view.fl > 0 ? view.fl / (view.fl + 200) : 1;
    const effZoom = view.zoom * perspScale;
    const px2 = (sx - view.cx) / effZoom;
    const py2 = -(sy - view.cy) / effZoom;
    const pyse = py2 / view.se;
    return { x: view.ca * px2 + view.sa * pyse, y: -view.sa * px2 + view.ca * pyse };
  }
  const physZ = (zp) => (zMidPhys - zp) * SQ; // physical depth (0 = entrance) -> scene z

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

  // textures: measured / model DPs + per-slice greyscale phase images
  function mkTex() { const c = document.createElement("canvas"); c.width = N; c.height = N; return c; }
  const dpLOff = mkTex(), dpROff = mkTex();
  const texL = Array.from({ length: NS }, mkTex);
  const texR = Array.from({ length: NR }, mkTex);
  const phBuf = new Float32Array(NN);
  function buildTexL() {
    for (let s = 0; s < NS; s++) {
      const ctx = texL[s].getContext("2d");
      ctx.putImageData(greyImage(ctx, phase, s * NN, PHI_SCALE, N, N), 0, 0);
    }
  }
  const phAll = new Float32Array(NR * NN);
  function buildTexR() {
    // reconstruction display auto-scale: 99.5th percentile of the phase across all
    // slices, clamped from below so a blank/noisy start stays blank rather than
    // amplifying noise. Keeps the stack readable while smearing dilutes the peaks.
    for (let s = 0; s < NR * NN; s++) phAll[s] = Math.atan2(OIm[s], ORe[s]);
    let mx = 0;
    for (let i = 0; i < NR * NN; i++) if (phAll[i] > mx) mx = phAll[i];
    let scaleR = PHI_SCALE;
    if (mx > 1e-6) {
      const hist = new Uint32Array(128);
      for (let i = 0; i < NR * NN; i++) { const v = phAll[i]; if (v > 0) hist[Math.min(127, v / mx * 127 | 0)]++; }
      let tot = 0; for (let b = 0; b < 128; b++) tot += hist[b];
      let acc = 0, cut = 127;
      for (let b = 0; b < 128; b++) { acc += hist[b]; if (acc >= tot * 0.998) { cut = b; break; } }
      scaleR = Math.max(0.35 * PHI_SCALE, mx * cut / 127);
    }
    for (let s = 0; s < NR; s++) {
      const ctx = texR[s].getContext("2d");
      ctx.putImageData(greyImage(ctx, phAll, s * NN, scaleR, N, N), 0, 0);
    }
  }

  const dpHist = new Uint32Array(256);
  function paintDP(cv, inten) {
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(N, N);
    const px = img.data;
    let mx = 1e-12;
    for (let i = 0; i < NN; i++) if (inten[i] > mx) mx = inten[i];
    dpHist.fill(0);
    for (let i = 0; i < NN; i++) dpHist[Math.min(255, Math.pow(inten[i] / mx, 0.42) * 255 | 0)]++;
    let acc = 0, cut = 255;
    const target = NN * 0.985;
    for (let b = 0; b < 256; b++) { acc += dpHist[b]; if (acc >= target) { cut = b; break; } }
    const norm = Math.max(cut / 255, 0.05);
    const h = N >> 1;
    for (let r = 0; r < N; r++) {
      const sr = (r + h) % N;
      for (let c = 0; c < N; c++) {
        const sc2 = (c + h) % N;
        const t = Math.min(1, Math.pow(inten[sr * N + sc2] / mx, 0.42) / norm);
        const [rr, gg, bb] = turboBlack(t);
        const o = (r * N + c) * 4;
        px[o] = rr; px[o + 1] = gg; px[o + 2] = bb; px[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // draw an image as a tilted quad centered at (x, y, zScene)
  function drawQuad(ctx, imgCv, x, y, zScene, half, alpha, borderColor) {
    const c0 = proj(x - half, y - half, zScene);
    const c1 = proj(x + half, y - half, zScene);
    const c3 = proj(x - half, y + half, zScene);
    const c2 = proj(x + half, y + half, zScene);
    const ta = (c1.sx - c0.sx) / imgCv.width, tb = (c1.sy - c0.sy) / imgCv.width;
    const tc = (c3.sx - c0.sx) / imgCv.height, td = (c3.sy - c0.sy) / imgCv.height;
    ctx.save();
    ctx.setTransform(ta, tb, tc, td, c0.sx, c0.sy);
    ctx.globalAlpha = alpha;
    ctx.drawImage(imgCv, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (borderColor) {
      ctx.strokeStyle = borderColor; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c0.sx, c0.sy); ctx.lineTo(c1.sx, c1.sy); ctx.lineTo(c2.sx, c2.sy); ctx.lineTo(c3.sx, c3.sy);
      ctx.closePath(); ctx.stroke();
    }
    const cxs = c0.sx + (c1.sx - c0.sx) / 2 + (c3.sx - c0.sx) / 2;
    const cys = c0.sy + (c1.sy - c0.sy) / 2 + (c3.sy - c0.sy) / 2;
    return [cxs, cys];
  }

  // stem4d-style probe cone with dashed rays inside the sample block
  function drawCone(ctx, dpCenter) {
    const green = dark ? "#00ff88" : "#00994f";
    const crossZ = -(sceneHalfZ + 9);              // visual crossover: below the exit, above the DP
    const bottomRadius = (KAP * 2 * PX) * (DPSIZE / 2); // BF-disk radius on the displayed DP
    // upper cone stays physical: entrance footprint alpha*DF, extended up to the source
    const footprint = ALPHA * DF;
    const entranceZ = sceneHalfZ;
    const topRadius = footprint * (zSrc - crossZ) / (entranceZ - crossZ);
    const yShift = probe.y * 0.45 * SQ;
    const zBlockHi = sceneHalfZ * 1.1 + yShift, zBlockLo = -sceneHalfZ * 1.28 + yShift;
    const nominal = proj(probe.x, probe.y, zDPs);
    const dpOx = dpCenter ? dpCenter[0] - nominal.sx : 0;
    const dpOy = dpCenter ? dpCenter[1] - nominal.sy : 0;
    const nLines = 14, nC = 40;
    function ray(cosA, sinA, r1, z1, r2, z2, dashed) {
      const sp1 = proj(probe.x + cosA * r1, probe.y + sinA * r1, z1);
      const sp2 = proj(probe.x + cosA * r2, probe.y + sinA * r2, z2);
      const t1 = Math.max(0, (z1 - zDPs) / (zSrc - zDPs));
      const t2 = Math.max(0, (z2 - zDPs) / (zSrc - zDPs));
      ctx.beginPath();
      ctx.setLineDash(dashed ? [5, 9] : []);
      ctx.moveTo(sp1.sx + dpOx * (1 - t1), sp1.sy + dpOy * (1 - t1));
      ctx.lineTo(sp2.sx + dpOx * (1 - t2), sp2.sy + dpOy * (1 - t2));
      ctx.stroke();
    }
    const rAt = (z, z1, r1, z2, r2) => Math.abs(z2 - z1) < 1e-3 ? r1 : r1 + (z - z1) / (z2 - z1) * (r2 - r1);
    ctx.strokeStyle = green; ctx.lineWidth = 2; ctx.globalAlpha = 0.4;
    for (let i = 0; i < nLines; i++) {
      const ang = i / nLines * Math.PI * 2, cA2 = Math.cos(ang), sA2 = Math.sin(ang);
      for (const seg of [{ z1: zSrc, r1: topRadius, z2: crossZ, r2: 0 }, { z1: crossZ, r1: 0, z2: zDPs, r2: bottomRadius }]) {
        const zMin = Math.min(seg.z1, seg.z2), zMax = Math.max(seg.z1, seg.z2);
        const cuts = [seg.z1];
        for (const bz of [zBlockHi, zBlockLo]) if (bz > zMin && bz < zMax) cuts.push(bz);
        cuts.push(seg.z2);
        cuts.sort((a, b) => b - a);
        for (let ci = 0; ci < cuts.length - 1; ci++) {
          const cz1 = cuts[ci], cz2 = cuts[ci + 1];
          const midZ = (cz1 + cz2) / 2;
          ray(cA2, sA2, rAt(cz1, seg.z1, seg.r1, seg.z2, seg.r2), cz1, rAt(cz2, seg.z1, seg.r1, seg.z2, seg.r2), cz2, midZ >= zBlockLo && midZ <= zBlockHi);
        }
      }
    }
    ctx.setLineDash([]);
    // aperture circle + DP circle + crossover dot
    function circle(cz, radius, useOffset) {
      ctx.beginPath();
      for (let i = 0; i <= nC; i++) {
        const ang = i / nC * Math.PI * 2;
        const p = proj(probe.x + Math.cos(ang) * radius, probe.y + Math.sin(ang) * radius, cz);
        const t = Math.max(0, (cz - zDPs) / (zSrc - zDPs));
        const ox = useOffset ? dpOx * (1 - t) : 0, oy = useOffset ? dpOy * (1 - t) : 0;
        if (i === 0) ctx.moveTo(p.sx + ox, p.sy + oy); else ctx.lineTo(p.sx + ox, p.sy + oy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.55; ctx.lineWidth = 2.4; ctx.strokeStyle = green;
    circle(zSrc, topRadius, false);
    circle(zDPs, bottomRadius, true);
    ctx.globalAlpha = 0.95; ctx.fillStyle = green;
    const pc = proj(probe.x, probe.y, crossZ);
    const tC = Math.max(0, (crossZ - zDPs) / (zSrc - zDPs));
    ctx.beginPath(); ctx.arc(pc.sx + dpOx * (1 - tC), pc.sy + dpOy * (1 - tC), 5, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintScene(ctx, side) {
    ctx.clearRect(0, 0, SW, SH);
    ctx.fillStyle = dark ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, SW, SH);
    const isSlices = side === "R" || sliceMode;
    const dpCv2 = side === "R" ? dpROff : dpLOff;

    // DP plane first (bottom-most)
    const dpCenter = drawQuad(ctx, dpCv2, probe.x, probe.y, zDPs, DPSIZE / 2, 0.95, dark ? "rgba(120,120,120,0.5)" : "rgba(80,80,80,0.4)");

    // sample: atoms or slice stack, painted back-to-front along z
    if (!isSlices) {
      const pr = [];
      for (const a of atoms) {
        const p = proj(a.x, a.y, physZ(a.z));
        pr.push({ sx: p.sx, sy: p.sy, d: p.depth, kind: a.kind });
      }
      pr.sort((a, b) => a.d - b.d);
      let minD = Infinity, maxD = -Infinity;
      for (const a of pr) { if (a.d < minD) minD = a.d; if (a.d > maxD) maxD = a.d; }
      const rD = maxD - minD || 1;
      for (const a of pr) {
        const t = (a.d - minD) / rD;
        const size = (a.kind === 0 ? 3.8 : 2.8) + 3.0 * t;
        const fade = 0.35 + 0.65 * t;
        ctx.fillStyle = a.kind === 0
          ? `rgba(${232 * fade | 0},${178 * fade | 0},${42 * fade | 0},0.97)`
          : (dark ? `rgba(${156 * fade | 0},${164 * fade | 0},${176 * fade | 0},0.92)` : `rgba(${125 * fade | 0},${132 * fade | 0},${142 * fade | 0},0.95)`);
        ctx.strokeStyle = dark ? `rgba(0,0,0,${0.2 + 0.4 * t})` : `rgba(0,0,0,${0.25 + 0.35 * t})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(a.sx, a.sy, size, 0, 6.283); ctx.fill(); ctx.stroke();
      }
    } else {
      const tex = side === "R" ? texR : texL;
      const nSl = side === "R" ? NR : NS;
      const dzSl = side === "R" ? DZR : DZ;
      const z0 = side === "R" ? -ZPAD : 0;
      const active = side === "R" ? +zR.value : +zL.value;
      const bc = dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.22)";
      const bcA = dark ? "rgba(140,200,255,0.9)" : "rgba(20,90,200,0.85)";
      for (let s2 = nSl - 1; s2 >= 0; s2--) { // bottom (far) first
        const zc = physZ(z0 + (s2 + 0.5) * dzSl);
        drawQuad(ctx, tex[s2], 0, 0, zc, BOX / 2 * 0.94, s2 === active ? 0.98 : 0.58, s2 === active ? bcA : bc);
      }
    }

    // scan grid on the entrance plane
    ctx.fillStyle = dark ? "rgba(150,170,190,0.6)" : "rgba(60,80,110,0.5)";
    for (const [sx2, sy2] of scanPos) {
      const p = proj(sx2, sy2, physZ(0) + 2.5);
      ctx.beginPath(); ctx.arc(p.sx, p.sy, 3.1, 0, 6.283); ctx.fill();
    }

    // probe cone last
    drawCone(ctx, dpCenter);

    // DP label under the quad
    ctx.fillStyle = dark ? "rgba(0,255,136,0.65)" : "rgba(0,140,80,0.8)";
    ctx.font = "600 24px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    const lbl = proj(probe.x, probe.y + DPSIZE / 2 + 2.5, zDPs);
    ctx.fillText(side === "R" ? "model diffraction pattern" : "measured diffraction pattern", lbl.sx, Math.min(SH - 12, lbl.sy + 30));
    ctx.textAlign = "start";
  }

  const ctxL = sceneL.getContext("2d"), ctxR = sceneR.getContext("2d");
  function paintView() {
    if (sliceMode) buildTexL();
    paintScene(ctxL, "L");
    if (sliceMode) {
      const s2 = +zL.value;
      zLlab.textContent = `slice ${s2 + 1}/${NS}` + (s2 >= 9 ? " (carbon)" : s2 === 8 ? " (cap + carbon)" : "");
    }
  }
  function paintDPLeft() { paintDP(dpLOff, forwardTrue(probe.x, probe.y)); paintScene(ctxL, "L"); }
  function paintRecon() {
    buildTexR();
    paintScene(ctxR, "R");
    const s2 = +zR.value;
    const zA = (s2 * DZR - ZPAD).toFixed(0), zB = ((s2 + 1) * DZR - ZPAD).toFixed(0);
    zRlab.textContent = `slice ${s2 + 1}/${NR} · ${zA} to ${zB} Å`;
  }
  function paintDPRight() {
    if (!ready) return;
    forwardModel(probe.x, probe.y, false);
    for (let i = 0; i < NN; i++) intBuf[i] = wRe[i] * wRe[i] + wIm[i] * wIm[i];
    paintDP(dpROff, intBuf);
    paintScene(ctxR, "R");
  }

  function paintXZ() { /* x-z strip removed: smearing reads directly in the slice stack */ }

  function updateStat() {
    statEl.textContent = `iteration ${iter}` + (isFinite(relErr) ? ` · data error ${(100 * relErr).toFixed(1)}%` : "");
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
    let dragging = false;
    cv.addEventListener("pointerdown", (e) => {
      dragging = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      if (scanning) stopScan();
      const [x, y] = hit(e, cv); setProbe(x, y);
    });
    cv.addEventListener("pointermove", (e) => { if (dragging) { const [x, y] = hit(e, cv); setProbe(x, y); } });
    cv.addEventListener("pointerup", () => dragging = false);
    cv.addEventListener("pointercancel", () => dragging = false);
  }
  addDrag(sceneL);
  addDrag(sceneR);

  tglBtn.addEventListener("click", () => {
    sliceMode = !sliceMode;
    tglBtn.textContent = sliceMode ? "Atoms" : "Slices";
    zL.style.display = sliceMode ? "" : "none";
    zLlab.style.display = sliceMode ? "" : "none";
    paintView();
  });
  zL.addEventListener("input", paintView);
  zR.addEventListener("input", paintRecon);

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
      }
    }
  }
  function stopRecon() { running = false; if (reconRaf) cancelAnimationFrame(reconRaf); reconRaf = null; runBtn.classList.remove(`${id}-on`); runBtn.textContent = "▶ Reconstruct"; }
  runBtn.addEventListener("click", () => {
    if (!ready) return;
    if (running) { stopRecon(); return; }
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
    for (let i = 0; i < NN; i++) amps[o + i] = Math.sqrt(inten[i]);
    simDone++;
  }
  function simFinish() {
    ready = true;
    loadEl.style.display = "none";
    resetRecon();
    paintAll();
  }
  function simChunk() {
    const t0 = performance.now();
    while (simDone < NPOS && performance.now() - t0 < 26) simOne();
    loadBar.style.width = (100 * simDone / NPOS).toFixed(0) + "%";
    if (simDone < NPOS) { simTimer = setTimeout(simChunk, 16); return; }
    simFinish();
  }
  simTimer = setTimeout(simChunk, 30);

  // debug hooks for automated testing (harmless in production)
  el.__pmsDebug = () => ({ ready, iter, relErr, simDone, NPOS, probe: { ...probe } });
  el.__pmsRun = {
    simAll() { while (simDone < NPOS) simOne(); if (!ready) { clearTimeout(simTimer); simFinish(); } },
    reconSteps(n) {
      if (!ready) return null;
      const t0 = performance.now();
      for (let it = 0; it < n; it++) {
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
