// comp-experiment.js — Computational Imaging pillar widget (research column 2)
// Multislice wave propagation, ported from Colin's vis_tests_05.ipynb: a plane wave flows
// DOWN ("rainbow waterfall") and scatters through a small 5-fold quasi-cluster via real FFT
// multislice; the steady wavefield is animated by a global phase rotation (LAB cyclic phase
// colormap). Passive = forward. The rest and fully-bloomed fields are precomputed once; on hover
// the widget cross-dissolves between them (no per-frame FFTs, so it stays buttery): the cluster
// blooms outward, the atoms light up bright, the rest of the wave fades toward the page background
// (transparency, light/dark aware), and it runs backward (the adjoint). Pure JS ESM, no deps.

// in-place radix-2 complex FFT (N power of 2). inverse includes 1/N.
function fft1d(re, im, N, inverse) {
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  const ang = (inverse ? 2 : -2) * Math.PI;
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1, wR = Math.cos(ang / len), wI = Math.sin(ang / len);
    for (let i = 0; i < N; i += len) {
      let cR = 1, cI = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tR = cR * re[b] - cI * im[b], tI = cR * im[b] + cI * re[b];
        re[b] = re[a] - tR; im[b] = im[a] - tI; re[a] += tR; im[a] += tI;
        const nR = cR * wR - cI * wI; cI = cR * wI + cI * wR; cR = nR;
      }
    }
  }
  if (inverse) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
}

// fast atan2 approximation (~0.005 rad), returns [-pi, pi]
function fastAtan2(y, x) {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y), a = ax > ay ? ay / ax : ax / ay, s = a * a;
  let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
  if (ay > ax) r = 1.5707963267948966 - r;
  if (x < 0) r = Math.PI - r;
  return y < 0 ? -r : r;
}

// separable Gaussian blur of a 2D array into a reusable tmp buffer (partial-coherence low-pass)
function gaussBlur2D(arr, Wf, Hf, sigma, tmp) {
  if (sigma <= 0) return;
  const rad = Math.max(1, Math.ceil(sigma * 2.5)), k = new Float32Array(2 * rad + 1);
  let sum = 0;
  for (let i = -rad; i <= rad; i++) { k[i + rad] = Math.exp(-i * i / (2 * sigma * sigma)); sum += k[i + rad]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  for (let r = 0; r < Hf; r++) for (let c = 0; c < Wf; c++) {
    let s = 0; for (let j = -rad; j <= rad; j++) { let cc = c + j; cc = cc < 0 ? 0 : cc >= Wf ? Wf - 1 : cc; s += arr[r * Wf + cc] * k[j + rad]; }
    tmp[r * Wf + c] = s;
  }
  for (let c = 0; c < Wf; c++) for (let r = 0; r < Hf; r++) {
    let s = 0; for (let j = -rad; j <= rad; j++) { let rr = r + j; rr = rr < 0 ? 0 : rr >= Hf ? Hf - 1 : rr; s += tmp[rr * Wf + c] * k[j + rad]; }
    arr[r * Wf + c] = s;
  }
}

// CIELAB (D65) -> sRGB 0..255
function lab2rgb(L, A, B) {
  let y = (L + 16) / 116, x = A / 500 + y, z = y - B / 200;
  const f = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  x = f(x) * 0.95047; y = f(y) * 1.0; z = f(z) * 1.08883;
  let r = x * 3.2406 - y * 1.5372 - z * 0.4986;
  let g = -x * 0.9689 + y * 1.8758 + z * 0.0415;
  let b = x * 0.0557 - y * 0.2040 + z * 1.0570;
  const gm = (c) => { c = c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c; return Math.min(255, Math.max(0, c * 255)) | 0; };
  return [gm(r), gm(g), gm(b)];
}

// Colin's cyclic phase colormap: 12 LAB control points, Fourier-interpolated to N, -> sRGB.
// chroma scales the a*/b* (saturation/vividness); lLift raises L* (brightness).
function labPhaseLUT(N, chroma = 1, lLift = 0) {
  const LAB = [[50,80,70],[65,50,75],[80,20,85],[100,-20,95],[95,-50,90],[90,-90,75],
               [80,-50,0],[60,-10,-50],[50,40,-85],[40,55,-90],[35,80,-80],[40,90,-30]];
  const M = 12, out = new Uint8Array(N * 3), lab = [new Float64Array(N), new Float64Array(N), new Float64Array(N)];
  for (let ch = 0; ch < 3; ch++) {
    const FR = new Float64Array(M), FI = new Float64Array(M);
    for (let k = 0; k < M; k++) { let re = 0, im = 0; for (let n = 0; n < M; n++) { const a = -2 * Math.PI * k * n / M; re += LAB[n][ch] * Math.cos(a); im += LAB[n][ch] * Math.sin(a); } FR[k] = re; FI[k] = im; }
    for (let j = 0; j < N; j++) {
      let v = 0;
      for (let k = 0; k < M; k++) { const bin = k < 6 ? k : N - 12 + k, a = 2 * Math.PI * bin * j / N; v += FR[k] * Math.cos(a) - FI[k] * Math.sin(a); }
      lab[ch][j] = v / M;
    }
  }
  for (let j = 0; j < N; j++) { const c = lab2rgb(Math.min(100, lab[0][j] + lLift), lab[1][j] * chroma, lab[2][j] * chroma); out[j * 3] = c[0]; out[j * 3 + 1] = c[1]; out[j * 3 + 2] = c[2]; }
  return out;
}

function render({ model, el }) {
  const opt = (k, d) => { try { const v = model.get(k); return v == null ? d : v; } catch (e) { return d; } };
  const Wf = opt("field_w", 128);                 // width (FFT dimension, power of 2); 128 keeps the live recompute real-time
  const Hf = opt("field_h", 128);                 // height = number of propagation slices
  const W = opt("width", 460), H = Math.round(W * Hf / Wf);
  const pixelSize = opt("pixel_size", 0.12);
  const wavelength = opt("wavelength", 0.04);
  const sliceThick = opt("slice_thickness", 2.0);
  const carrierBands = opt("carrier_bands", 9);   // visible wavefronts down the height
  const atomPhi = opt("atom_phi", 0.62);          // per-atom phase strength (more = more scattering)
  const atomSigma = opt("atom_sigma", 2.4);       // atom size (field px)
  const coherenceBlur = opt("coherence_blur", 1.3); // low-pass the wavefield (smoother, holds up small)
  const ampMax = opt("amp_max", 1.7);
  const ampPower = opt("amp_power", 1.6);
  const flowSpeed = opt("flow_speed", 2.6);       // passive forward hue advance / frame
  const hoverSpeed = opt("hover_speed", 8.0);     // hover reverse hue advance / frame
  const atomBloom = opt("atom_bloom", 0);         // atom outward spread on hover (0 = highlight in place, no zoom)
  const atomSection = opt("atom_section", 2.5);   // size of the bright atom blobs on hover (field px)
  const bgFade = opt("bg_fade", 0.14);            // background wave opacity at full hover (atoms stay bright)
  const edgeFade = opt("edge_fade", 0.16);        // fraction of each edge faded to transparent (rounded)

  const id = "cmp-" + Math.random().toString(36).slice(2, 8);
  const style = document.createElement("style");
  style.textContent = `
    .${id}-wrap { position:relative; max-width:100%; box-sizing:border-box;
      font-family:-apple-system,system-ui,sans-serif; }
    .${id}-canvas { width:100%; display:block; border-radius:10px; }
    .${id}-frame { position:absolute; inset:0; border-radius:10px; pointer-events:none;
      box-shadow: inset 0 0 0 1px rgba(140,140,150,0.55), inset 1.5px 1.5px 0 rgba(255,255,255,0.16),
        inset -1.5px -1.5px 0 rgba(0,0,0,0.22); }
    .${id}-loading { color:#888; padding:60px 0; text-align:center; font-size:13px; }
  `;
  el.appendChild(style);
  const wrap = document.createElement("div");
  wrap.className = `${id}-wrap`;
  wrap.innerHTML = `<div class="${id}-loading">Propagating wavefield...</div>
    <canvas class="${id}-canvas" style="display:none;"></canvas>
    <div class="${id}-frame" style="display:none;"></div>`;
  el.appendChild(wrap);

  let stopAll = () => {};

  setTimeout(() => {
    const canvas = wrap.querySelector(`.${id}-canvas`);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;

    // --- 5-fold quasi-cluster (rest positions), a vertex pointing up ---
    const atoms = [];
    const acx = Wf * 0.5, acy = Hf * 0.5, clusterRot = opt("cluster_rot", -Math.PI / 2);
    atoms.push(acx, acy);
    const rings = [[5, Wf * 0.085, 0], [5, Wf * 0.15, Math.PI / 5], [10, Wf * 0.235, 0]];
    for (const [cnt, rad, off] of rings) for (let i = 0; i < cnt; i++) { const a = off + i * 2 * Math.PI / cnt + clusterRot; atoms.push(acx + rad * Math.cos(a), acy + rad * Math.sin(a)); }
    const nAtoms = atoms.length / 2;

    // --- static precompute (independent of where the atoms are) ---
    const N = Wf * Hf;
    const re = new Float32Array(Wf), im = new Float32Array(Wf), fr = new Float32Array(Wf), fi = new Float32Array(Wf);
    const propR = new Float32Array(Wf), propI = new Float32Array(Wf), edgeMask = new Float32Array(Wf);
    for (let c = 0; c < Wf; c++) {
      const q = (c < Wf / 2 ? c : c - Wf) / (Wf * pixelSize), chi = -Math.PI * wavelength * sliceThick * q * q;
      propR[c] = Math.cos(chi); propI[c] = Math.sin(chi);
    }
    { const mg = Math.max(2, Wf * 0.1); for (let c = 0; c < Wf; c++) { const t = Math.min(c, Wf - 1 - c) / mg; edgeMask[c] = t >= 1 ? 1 : t * t * (3 - 2 * t); } }
    const psiR = new Float32Array(N), psiI = new Float32Array(N), blurTmp = new Float32Array(N);
    const alphaV = new Uint8Array(N), mask = new Float32Array(N);
    // two precomputed field states (0 = rest, 1 = full bloom); hover cross-dissolves between them, no per-frame recompute
    const phIdx0 = new Uint8Array(N), bright0 = new Uint8Array(N), bx0 = new Float32Array(nAtoms), by0 = new Float32Array(nAtoms);
    const phIdx1 = new Uint8Array(N), bright1 = new Uint8Array(N), bx1 = new Float32Array(nAtoms), by1 = new Float32Array(nAtoms);
    const inv2s2 = 1 / (2 * atomSigma * atomSigma), cut = 64 * atomSigma * atomSigma, pps = 2 * Math.PI * carrierBands / Hf;
    // sharp boundary: the field is fully opaque to a crisp edge (the rounded corners + thin frame
    // are done in CSS). No soft fade. edge_fade kept for back-compat but unused.
    alphaV.fill(255);
    // amplitude -> brightness LUT (their sin/gamma mapping), avoids pow+sin per pixel
    const brightLUT = new Uint8Array(256);
    for (let a = 0; a < 256; a++) { let t = a / 255; if (ampPower !== 1) t = Math.pow(t, ampPower); brightLUT[a] = (Math.sin(t * Math.PI / 2) * 255) | 0; }
    const hueLUT = labPhaseLUT(256, opt("chroma_boost", 1.48), opt("bright_lift", 12));
    const fc = document.createElement("canvas"); fc.width = Wf; fc.height = Hf;
    const fctx = fc.getContext("2d");
    const img = fctx.createImageData(Wf, Hf), d = img.data;

    // --- compute the whole multislice field for the atoms at the given bloom; bakes into the passed-in arrays ---
    function recompute(bloom, phOut, brOut, bxOut, byOut) {
      const b = 1 + atomBloom * bloom;
      for (let k = 0; k < nAtoms; k++) { bxOut[k] = acx + (atoms[k * 2] - acx) * b; byOut[k] = acy + (atoms[k * 2 + 1] - acy) * b; }
      for (let c = 0; c < Wf; c++) { re[c] = 1; im[c] = 0; }
      for (let r = 0; r < Hf; r++) {
        if (r > 0) {
          for (let c = 0; c < Wf; c++) {
            let ph = 0;
            for (let k = 0; k < nAtoms; k++) { const dx = c - bxOut[k], dy = r - byOut[k], d2 = dx * dx + dy * dy; if (d2 < cut) ph += atomPhi * Math.exp(-d2 * inv2s2); }
            if (ph !== 0) { const cs = Math.cos(ph), sn = Math.sin(ph), rr = re[c], ii = im[c]; re[c] = rr * cs - ii * sn; im[c] = rr * sn + ii * cs; }
          }
          fr.set(re); fi.set(im); fft1d(fr, fi, Wf, false);
          for (let c = 0; c < Wf; c++) { const rr = fr[c], ii = fi[c]; fr[c] = rr * propR[c] - ii * propI[c]; fi[c] = rr * propI[c] + ii * propR[c]; }
          fft1d(fr, fi, Wf, true); re.set(fr); im.set(fi);
          for (let c = 0; c < Wf; c++) { const w = edgeMask[c]; re[c] = re[c] * w + (1 - w); im[c] = im[c] * w; }
        }
        const off = r * Wf;
        for (let c = 0; c < Wf; c++) { psiR[off + c] = re[c]; psiI[off + c] = im[c]; }
      }
      gaussBlur2D(psiR, Wf, Hf, coherenceBlur, blurTmp);
      gaussBlur2D(psiI, Wf, Hf, coherenceBlur, blurTmp);
      for (let r = 0; r < Hf; r++) { const ro = r * Wf, cphase = pps * r;
        for (let c = 0; c < Wf; c++) {
          const i = ro + c, pr = psiR[i], pii = psiI[i];
          let p = (fastAtan2(pii, pr) + cphase) * 0.15915494309; p -= Math.floor(p); // 1/(2pi)
          phOut[i] = (p * 256) & 255;
          let av = Math.sqrt(pr * pr + pii * pii) / ampMax; av = av < 0 ? 0 : av > 1 ? 1 : av;
          brOut[i] = brightLUT[(av * 255) | 0];
        }
      }
    }

    // paint one precomputed field into img; bgMul fades the background, the mask keeps the atoms bright + opaque
    function paint(ph, br, bgMul, useMask) {
      for (let i = 0; i < N; i++) {
        const m = useMask ? mask[i] : 0;
        let bm = br[i]; const mb = (m * 255) | 0; if (mb > bm) bm = mb;
        const a = (alphaV[i] * (bgMul + (1 - bgMul) * m)) | 0;
        const idx = (ph[i] - thetaIdxG) & 255, h = idx * 3, o = i << 2;
        d[o] = (hueLUT[h] * bm) >> 8; d[o + 1] = (hueLUT[h + 1] * bm) >> 8; d[o + 2] = (hueLUT[h + 2] * bm) >> 8;
        d[o + 3] = a;
      }
      fctx.putImageData(img, 0, 0);
    }
    // build the bright-atom mask at the eased (rest -> bloom) atom positions
    function buildMask(reconF) {
      mask.fill(0);
      const inv = 1 / (2 * atomSection * atomSection), rad = Math.ceil(3 * atomSection);
      for (let k = 0; k < nAtoms; k++) {
        const c0 = Math.round(bx0[k] + (bx1[k] - bx0[k]) * reconF), r0 = Math.round(by0[k] + (by1[k] - by0[k]) * reconF);
        for (let dy = -rad; dy <= rad; dy++) { const rr = r0 + dy; if (rr < 0 || rr >= Hf) continue;
          for (let dx = -rad; dx <= rad; dx++) { const cc = c0 + dx; if (cc < 0 || cc >= Wf) continue;
            const v = Math.exp(-(dx * dx + dy * dy) * inv), ii = rr * Wf + cc; if (v > mask[ii]) mask[ii] = v; } }
      }
    }
    let thetaIdxG = 0;
    function renderField(thetaIdx, reconF) {
      thetaIdxG = thetaIdx;
      ctx.clearRect(0, 0, W, H);
      if (reconF <= 0.004) {                 // passive: just the rest field
        paint(phIdx0, bright0, 1, false); ctx.drawImage(fc, 0, 0, W, H); return;
      }
      const bg = 1 - (1 - bgFade) * reconF;  // faded-background opacity at this hover amount
      buildMask(reconF);
      if (reconF >= 0.996) {                  // held hover: just the bloomed field + bright atoms
        paint(phIdx1, bright1, bg, true); ctx.drawImage(fc, 0, 0, W, H); return;
      }
      // transition: cross-dissolve rest -> bloom (no FFT recompute, so it stays buttery)
      paint(phIdx0, bright0, 1, false); ctx.globalAlpha = 1 - reconF; ctx.drawImage(fc, 0, 0, W, H);
      paint(phIdx1, bright1, bg, true); ctx.globalAlpha = reconF; ctx.drawImage(fc, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    const initRecon = opt("init_recon", 0); // debug: hold the hover/bloom state for previewing
    const mobile = window.innerWidth < 820 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches); // phones/tablets: lower the frame rate
    let theta = 0, eff = flowSpeed, recon = initRecon, hover = false, raf = null, running = false, lastT = -1;
    function step(now) {
      if (!running) return;
      raf = requestAnimationFrame(step);
      if (lastT >= 0 && now - lastT < (mobile ? 52 : 33)) return;
      const dt = lastT < 0 ? 0.033 : Math.min(0.05, (now - lastT) / 1000); lastT = now;
      eff += ((hover ? -hoverSpeed : flowSpeed) - eff) * Math.min(1, dt * 5);
      recon += ((hover ? 1 : initRecon) - recon) * Math.min(1, dt * 4);
      theta += eff;
      // no recompute in the loop: both field states are precomputed, so the hover is a cheap cross-dissolve (buttery)
      renderField((((theta | 0) % 256) + 256) % 256, recon);
    }
    function start() { if (!running) { running = true; lastT = -1; raf = requestAnimationFrame(step); } }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    canvas.addEventListener("pointerenter", () => { hover = true; });
    canvas.addEventListener("pointerleave", () => { hover = false; });

    let io = null;
    if (typeof IntersectionObserver !== "undefined") { io = new IntersectionObserver((es) => { es[0].isIntersecting ? start() : stop(); }, { threshold: 0.05 }); io.observe(canvas); } else start();
    stopAll = () => { stop(); if (io) io.disconnect(); };

    recompute(0, phIdx0, bright0, bx0, by0);   // rest field
    recompute(1, phIdx1, bright1, bx1, by1);   // fully bloomed field (+ bloomed atom positions)
    wrap.querySelector(`.${id}-loading`).style.display = "none";
    canvas.style.display = "block";
    wrap.querySelector(`.${id}-frame`).style.display = "block";
    renderField(0, initRecon);
  }, 40);

  return () => stopAll();
}

export default { render };
