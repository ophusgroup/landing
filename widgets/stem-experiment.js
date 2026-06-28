// stem-experiment.js — STEM experiment pillar widget (research column 1)
// Forked from stem4d-sim.js, then rebuilt looks-first: a green probe cone focusing
// through a thin glossy hexagonal crystal onto an animated coherent-CBED pattern
// (overlapping diffraction disks whose overlaps interfere, gently breathing + drifting).
// Pure JS ESM module, no dependencies. (Old FFT-diffraction helpers remain but are unused.)

// ============================================================
// FFT utilities
// ============================================================

function fft1d(re, im, N, inverse) {
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const angle = (inverse ? 2 : -2) * Math.PI;
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const wRe = Math.cos(angle / len), wIm = Math.sin(angle / len);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < halfLen; j++) {
        const a = i + j, b = i + j + halfLen;
        const tRe = curRe * re[b] - curIm * im[b];
        const tIm = curRe * im[b] + curIm * re[b];
        re[b] = re[a] - tRe; im[b] = im[a] - tIm;
        re[a] += tRe; im[a] += tIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
  if (inverse) { for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; } }
}

function fft2d(re, im, rows, cols, inverse) {
  const rowRe = new Float32Array(cols), rowIm = new Float32Array(cols);
  for (let r = 0; r < rows; r++) {
    const off = r * cols;
    for (let c = 0; c < cols; c++) { rowRe[c] = re[off + c]; rowIm[c] = im[off + c]; }
    fft1d(rowRe, rowIm, cols, inverse);
    for (let c = 0; c < cols; c++) { re[off + c] = rowRe[c]; im[off + c] = rowIm[c]; }
  }
  const colRe = new Float32Array(rows), colIm = new Float32Array(rows);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) { colRe[r] = re[r * cols + c]; colIm[r] = im[r * cols + c]; }
    fft1d(colRe, colIm, rows, inverse);
    for (let r = 0; r < rows; r++) { re[r * cols + c] = colRe[r]; im[r * cols + c] = colIm[r]; }
  }
}

function fftshift2d(arr, rows, cols) {
  const hr = rows >> 1, hc = cols >> 1;
  for (let r = 0; r < hr; r++) {
    for (let c = 0; c < hc; c++) {
      const i1 = r * cols + c, i2 = (r + hr) * cols + (c + hc);
      let t = arr[i1]; arr[i1] = arr[i2]; arr[i2] = t;
      const i3 = r * cols + (c + hc), i4 = (r + hr) * cols + c;
      t = arr[i3]; arr[i3] = arr[i4]; arr[i4] = t;
    }
  }
}

// ============================================================
// 3D projection — oblique parallel
// ============================================================

function makeView(azDeg, elDeg, zoom, cx, cy, focalLength) {
  const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
  return { ca: Math.cos(az), sa: Math.sin(az), ce: Math.cos(el), se: Math.sin(el), zoom, cx, cy, fl: focalLength || 0 };
}

function proj(x, y, z, v) {
  const rx = x * v.ca - y * v.sa;
  const ry = x * v.sa + y * v.ca;
  const depth = ry * v.ce - z * v.se;
  // Perspective scaling: objects further away appear smaller
  const scale = v.fl > 0 ? v.fl / (v.fl - depth + 200) : 1;
  return {
    sx: rx * v.zoom * scale + v.cx,
    sy: (-ry * v.se - z * v.ce) * v.zoom * scale + v.cy,
    depth: depth
  };
}

function unproj(sx, sy, v) {
  // Approximate inverse including perspective scale at z=0 sample plane
  const perspScale = v.fl > 0 ? v.fl / (v.fl + 200) : 1;
  const effZoom = v.zoom * perspScale;
  const px = (sx - v.cx) / effZoom;
  const py = -(sy - v.cy) / effZoom;
  const pyse = py / v.se;
  return { x: v.ca * px + v.sa * pyse, y: -v.sa * px + v.ca * pyse };
}

// ============================================================
// Sample generation
// ============================================================

function makeRot(a, b, g) {
  const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
  return [ca*cg-sa*cb*sg,-ca*sg-sa*cb*cg,sa*sb, sa*cg+ca*cb*sg,-sa*sg+ca*cb*cg,-ca*sb, sb*sg,sb*cg,cb];
}
function applyRot(m,x,y,z) { return [m[0]*x+m[1]*y+m[2]*z, m[3]*x+m[4]*y+m[5]*z, m[6]*x+m[7]*y+m[8]*z]; }

function generateSample(params) {
  const { pixelSize, cellDimX, cellDimY, aLattice, sigma } = params;
  const imW = Math.round(cellDimX / pixelSize), imH = Math.round(cellDimY / pixelSize);
  const potential = new Float32Array(imW * imH);
  // Two-color honeycomb in the x-y plane, one thin layer. The 4th atom value tags the element/kind
  // (0/1 sublattice A/B, 2 heavy dopant, 3/4/5 organic C/N/O), which sets colour, size AND scattering
  // weight (ATOM_AMP). The small cell spreads the diffraction spots so a large convergence still gives
  // big, distinct CBED disks.
  const s3 = Math.sqrt(3);
  const a = aLattice;            // in-plane lattice constant (Å)
  const a1x = a,       a1y = 0;
  const a2x = a * 0.5, a2y = a * s3 / 2;
  const bx = (a1x + a2x) / 3, by = (a1y + a2y) / 3;   // B sublattice offset

  const halfX = cellDimX/2, halfY = cellDimY/2;
  const nJ = Math.ceil(halfY / a2y) + 4;
  const nI = Math.ceil(halfX / a) + nJ + 4;

  // --- perfect honeycomb as an editable atom list (objects so defects can rewrite it) ---
  const atoms = [];
  for (let j=-nJ; j<=nJ; j++) {
    for (let i=-nI; i<=nI; i++) {
      for (let s=0; s<2; s++) {
        const x = i*a1x + j*a2x + (s ? bx : 0);
        const y = i*a1y + j*a2y + (s ? by : 0);
        if (x<-halfX||x>=halfX||y<-halfY||y>=halfY) continue;
        atoms.push({ x, y, z: 0, k: s });
      }
    }
  }

  // --- inject defects + an adsorbed molecule (mostly off-camera until the hover scan reveals them) ---
  applyDefects(atoms, halfX, halfY, a);

  // --- rasterize the projected potential, each atom weighted by its element's scattering power ---
  for (let n=0; n<atoms.length; n++) {
    const at = atoms[n], amp = ATOM_AMP[at.k] || 1;
    const px=at.x/pixelSize+imW/2, py=at.y/pixelSize+imH/2;
    const fxp=Math.floor(px), fyp=Math.floor(py), dx=px-fxp, dy=py-fyp;
    const x0=((fxp%imW)+imW)%imW, x1=((fxp+1)%imW+imW)%imW;
    const y0=((fyp%imH)+imH)%imH, y1=((fyp+1)%imH+imH)%imH;
    potential[x0*imH+y0]+=amp*(1-dx)*(1-dy); potential[x1*imH+y0]+=amp*dx*(1-dy);
    potential[x0*imH+y1]+=amp*(1-dx)*dy; potential[x1*imH+y1]+=amp*dx*dy;
  }

  // Gaussian blur
  const sigPx=sigma/pixelSize, kR=Math.ceil(sigPx*3);
  const kernel=new Float32Array(2*kR+1); let kSum=0;
  for (let i=-kR;i<=kR;i++){kernel[i+kR]=Math.exp(-0.5*(i/sigPx)**2);kSum+=kernel[i+kR];}
  for (let i=0;i<kernel.length;i++) kernel[i]/=kSum;
  const temp=new Float32Array(imW*imH);
  for (let y=0;y<imH;y++) for (let x=0;x<imW;x++){let s=0;for(let k=-kR;k<=kR;k++)s+=potential[((x+k)%imW+imW)%imW*imH+y]*kernel[k+kR];temp[x*imH+y]=s;}
  for (let x=0;x<imW;x++) for (let y=0;y<imH;y++){let s=0;for(let k=-kR;k<=kR;k++)s+=temp[x*imH+((y+k)%imH+imH)%imH]*kernel[k+kR];potential[x*imH+y]=s;}

  // --- scene atoms (Float32Array, stride 4: x, y, z, kind) ---
  const out = new Float32Array(atoms.length * 4);
  for (let n=0; n<atoms.length; n++){ const at=atoms[n]; out[n*4]=at.x; out[n*4+1]=at.y; out[n*4+2]=at.z; out[n*4+3]=at.k; }
  return { potential, imW, imH, atoms: out };
}

// Inject point defects + an adsorbed caffeine molecule into the honeycomb list. Coordinates are
// absolute (Å); defects sit at a spread of x so most are off-camera until the hover scan reveals them,
// with the caffeine parked at x=0 in the passive beam path. Skipped for small preview cells.
function applyDefects(atoms, halfX, halfY, a) {
  if (halfX < 30) return;
  const nearest = (x, y) => {
    let bi=-1, bd=1e9;
    for (let i=0;i<atoms.length;i++){ const at=atoms[i]; if(at.k>1) continue; const d=(at.x-x)**2+(at.y-y)**2; if(d<bd){bd=d;bi=i;} }
    return bi;
  };
  const kNear = (x, y, k) => {
    const all = [];
    for (let i=0;i<atoms.length;i++){ const at=atoms[i]; if(at.k>1) continue; all.push([(at.x-x)**2+(at.y-y)**2, i]); }
    all.sort((p,q)=>p[0]-q[0]); return all.slice(0,k).map(p=>p[1]);
  };
  // A VARIETY of defects, all on the beam centre line (y=0) so the scan walks the probe through each.
  // None leaves a hole. The two gold features sit far apart (not adjacent).
  { const i=nearest(-54,0); if(i>=0) atoms[i].k=2; }                 // (1) single substitutional dopant (gold)
  for (const i of kNear(24,0,4)) atoms[i].k=2;                       // (2) 4-atom substitution cluster (gold), opposite side from (1)
  // (3) Stone-Wales: rotate the bond aligned with the DEPTH/camera (y) axis -- it is foreshortened, so
  // swinging it 90 deg to horizontal is the obvious change. Pick the neighbour with the largest |dy|.
  // The honeycomb has NO horizontal bonds (they run 30/150/270 deg), so we also STRETCH the rotated pair
  // by `ex` past the plain 90 deg: the central bond ends up clearly longer than a lattice bond, and a long
  // horizontal bond in a hex net is unmistakable. The 5-7-7-5 rewiring stays clean (no dangling bonds).
  { const i=nearest(-12,0);
    if(i>=0){ const xi=atoms[i].x, yi=atoms[i].y; let j=-1, best=-1;
      for(let m=0;m<atoms.length;m++){ if(m===i||atoms[m].k>1) continue; const dx=atoms[m].x-xi, dy=atoms[m].y-yi; if(dx*dx+dy*dy>4.2) continue; if(Math.abs(dy)>best){ best=Math.abs(dy); j=m; } }
      if(j>=0){ const mx=(xi+atoms[j].x)/2, my=(yi+atoms[j].y)/2, ex=1.34; for(const m of [i,j]){ const dx=atoms[m].x-mx, dy=atoms[m].y-my; atoms[m].x=mx-dy*ex; atoms[m].y=my+dx*ex; } } }
  }
  addNanoparticle(atoms, -32, 0);                                   // (4) hemispherical metal nanoparticle on top
  addPyramid(atoms, 0, 0, a);                                       // (5) epitaxial substrate pyramid (now in the passive beam)
  addCaffeine(atoms, 48, 0);                                        // (6) caffeine molecule, swapped off to the side
}

// Cluster atoms (kind 6 = silvery metal, NO bonds) sit ON TOP of the surface (z<0 draws toward the beam).
function addNanoparticle(atoms, cx, cy) { // a rounded hemisphere of metal atoms
  for (const [cnt, r, z] of [[9, 3.0, -1.1], [6, 2.1, -2.6], [3, 1.1, -3.7]])
    for (let i=0;i<cnt;i++){ const ang = i/cnt*2*Math.PI + z; atoms.push({ x: cx+r*Math.cos(ang), y: cy+r*Math.sin(ang), z, k: 6 }); }
  atoms.push({ x: cx, y: cy, z: -4.4, k: 6 });
}
// Epitaxial PYRAMID of the SAME substrate lattice/atoms (kinds 0/1): honeycomb patches stacked and
// shrinking upward (1-2-3 planes), with one heavy apex atom (the "4th atom").
function addPyramid(atoms, cx, cy, a) {
  const s3 = Math.sqrt(3), cZ = a * 0.5;
  for (const [r, L] of [[3.4, 1], [2.1, 2], [0.9, 3]]) {
    const z = -L * cZ;
    for (let j=-3;j<=3;j++) for (let i=-3;i<=3;i++) for (let s=0;s<2;s++){
      const x = i*a + j*a*0.5 + (s ? a*0.5 : 0), y = j*a*s3*0.5 + (s ? a*s3/6 : 0);
      if (x*x + y*y <= r*r) atoms.push({ x: cx+x, y: cy+y, z, k: s });
    }
  }
  atoms.push({ x: cx, y: cy, z: -4*cZ, k: 0 }); // apex is substrate too (a lattice A site at the centre)
}

// 14 heavy atoms (8 C, 4 N, 2 O) of caffeine (1,3,7-trimethylxanthine), ROTATED in-plane and lifted ON
// TOP of the intact lattice (z<0 draws in front, no clearing). k: 3=C, 4=N, 5=O.
function addCaffeine(atoms, cx, cy) {
  const M = [
    [-1.21,0.70,4],[-1.21,-0.70,3],[0,-1.40,4],[1.21,-0.70,3],[1.21,0.70,3],[0,1.40,3], // 6-ring: N1 C2 N3 C4 C5 C6
    [2.40,1.15,4],[3.00,0,3],[2.40,-1.15,4],   // 5-ring: N7 C8 N9
    [-2.25,-1.30,5],[0,2.60,5],                // carbonyls O2 O6
    [-2.52,1.45,3],[0,-2.90,3],[3.75,1.80,3],  // methyls on N1 N3 N7
  ];
  const th = 0.62, ct = Math.cos(th), st = Math.sin(th); // rotate off the lattice axes so it reads as a distinct object
  for (const [mx,my,k] of M) atoms.push({ x: cx + mx*ct - my*st, y: cy + mx*st + my*ct, z: -2.4, k });
}

// ============================================================
// Probe and diffraction
// ============================================================

function computeProbe(cropSize, pixelSize, qMax, defocus, lambda) {
  const N=cropSize;
  const probeRe=new Float32Array(N*N), probeIm=new Float32Array(N*N);
  const dq=1.0/(N*pixelSize);
  for (let r=0;r<N;r++){
    const qy=r<N/2?r*dq:(r-N)*dq;
    for (let c=0;c<N;c++){
      const qx=c<N/2?c*dq:(c-N)*dq;
      const q2=qx*qx+qy*qy, q=Math.sqrt(q2);
      const amp=Math.max(0,Math.min(1,(qMax-q)/dq+0.5));
      if(amp>0){const chi=Math.PI*lambda*defocus*q2;probeRe[r*N+c]=amp*Math.cos(chi);probeIm[r*N+c]=amp*Math.sin(chi);}
    }
  }
  fft2d(probeRe,probeIm,N,N,true);
  fftshift2d(probeRe,N,N); fftshift2d(probeIm,N,N);
  return { probeRe, probeIm };
}

function computeDiffraction(potential,imW,imH,probeRe,probeIm,probeX,probeY,cropSize,pixelSize) {
  const N=cropSize;
  const re=new Float32Array(N*N), im=new Float32Array(N*N);
  const cx=probeX/pixelSize+imW/2, cy=probeY/pixelSize+imH/2;
  for (let r=0;r<N;r++){
    const py=Math.round(cy-N/2+r), yi=((py%imH)+imH)%imH;
    for (let c=0;c<N;c++){
      const px=Math.round(cx-N/2+c), xi=((px%imW)+imW)%imW;
      const idx=r*N+c;
      re[idx]=potential[xi*imH+yi]*probeRe[idx];
      im[idx]=potential[xi*imH+yi]*probeIm[idx];
    }
  }
  fft2d(re,im,N,N,false);
  const intensity=new Float32Array(N*N);
  for (let i=0;i<N*N;i++) intensity[i]=re[i]*re[i]+im[i]*im[i];
  fftshift2d(intensity,N,N);
  return intensity;
}

// ============================================================
// Coherent CBED: overlapping diffraction disks that interfere
// ============================================================

// Precompute the hexagonal set of diffracted beams (reciprocal lattice points)
// with complex structure factors. Independent of probe position.
function buildBeams(p) {
  const s3 = Math.sqrt(3);
  const g1x = p.g0, g1y = 0;
  const g2x = p.g0 * 0.5, g2y = p.g0 * s3 / 2;
  const beams = [];
  for (let m = -p.maxOrder; m <= p.maxOrder; m++) {
    for (let n = -p.maxOrder; n <= p.maxOrder; n++) {
      const gx = m * g1x + n * g2x, gy = m * g1y + n * g2y;
      const gr = Math.hypot(gx, gy);
      if (gr > p.gMax) continue;
      const amp = Math.exp(-(gr * gr) / (2 * p.sigmaG * p.sigmaG));
      // honeycomb two-atom basis: F = 1 + exp(2pi i (m+n)/3) gives per-beam phase variety
      const ph = 2 * Math.PI * (m + n) / 3;
      beams.push({ gx, gy, Fre: amp * (1 + Math.cos(ph)), Fim: amp * Math.sin(ph) });
    }
  }
  return beams;
}

// Physically-motivated coherent CBED. Each beam g paints a convergence disk; within disk
// overlaps the defocus phase chi(u)=chiCoef*|u|^2 makes the constructive/destructive fringes,
// so sweeping defocus breathes the fringes. A soft "Ewald-sphere" excitation window centered at
// the tilt position (tiltCx,tiltCy) weights each beam, so tilting the crystal sweeps which disks
// are bright (the excitation lobe) -- exactly what a real CBED does under a beam/sample tilt.
function computeCBED(N, p) {
  const re = new Float32Array(N * N), im = new Float32Array(N * N);
  const cx = N / 2, cy = N / 2, R = p.R, R2 = R * R, chi = p.chiCoef;
  const tcx = p.tiltCx || 0, tcy = p.tiltCy || 0, invExc = 1 / (2 * p.excW * p.excW);
  for (const b of p.beams) {
    const dgx = b.gx - tcx, dgy = b.gy - tcy;
    const ex = Math.exp(-(dgx * dgx + dgy * dgy) * invExc); // excitation weight (tilt-dependent)
    if (ex < 0.015) continue;                               // skip beams far from the Ewald sphere
    const Fre = b.Fre * ex, Fim = b.Fim * ex;
    const gx = b.gx + cx, gy = b.gy + cy;
    const x0 = Math.max(0, Math.floor(gx - R)), x1 = Math.min(N - 1, Math.ceil(gx + R));
    const y0 = Math.max(0, Math.floor(gy - R)), y1 = Math.min(N - 1, Math.ceil(gy + R));
    for (let y = y0; y <= y1; y++) {
      const uy = y - gy;
      for (let x = x0; x <= x1; x++) {
        const ux = x - gx, u2 = ux * ux + uy * uy;
        if (u2 > R2) continue;
        const edge = Math.min(1, (R - Math.sqrt(u2)) * 0.7); // soft anti-aliased rim
        const a = chi * u2, ca = Math.cos(a) * edge, sa = Math.sin(a) * edge;
        const i2 = y * N + x;
        re[i2] += Fre * ca - Fim * sa;
        im[i2] += Fre * sa + Fim * ca;
      }
    }
  }
  const intensity = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) intensity[i] = re[i] * re[i] + im[i] * im[i];
  return intensity;
}

// Tone-map the CBED with a LOG + gamma stretch (the original widget's math): the FFT diffraction
// has a huge dynamic range, so a plain power stretch crushes the dim defocused shadow image to
// black. The log compresses it so the shadow (and its zoom with defocus) is actually visible.
// Rendered as plasma on an OPAQUE BLACK detector (same in light + dark mode).
function renderCBEDtoCanvas(offscreen, intensity, N, power, zoom, rBF, dfExp, ref, dfScale) {
  zoom = zoom || 1;
  offscreen.width = N; offscreen.height = N;
  const ctx = offscreen.getContext("2d");
  const imgData = ctx.createImageData(N, N);
  const px = imgData.data;
  // POWER-law tone map (was log) so the bright-field disk reads clearly the brightest. The convergence
  // is kept SMALL (separated, circular CBED disks); a display ZOOM then magnifies the central few disks
  // (bilinear) to fill the detector. Source read horizontally MIRRORED so the over-focused shadow scans
  // the same way as the lattice (invisible statically -- the pattern is symmetric).
  const disp = new Float32Array(N * N);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < N * N; i++) { const d = Math.pow(intensity[i], power); disp[i] = d; if (d < mn) mn = d; if (d > mx) mx = d; }
  // The BF disk uses PER-FRAME exposure (so the bright disk + its shadow stay crisp at any thickness),
  // while the dark field uses an ABSOLUTE exposure tied to the fixed bare bright-field reference (scaled
  // by dfScale to set the ceiling). That split is the whole trick: the dark field then reads true sample
  // thickness -- dark over the thin lattice, lit up only where a thick / heavy region scatters strongly --
  // and beyond the disk (rIn, soft to rOut) the weak thin-lattice scattering is further crushed by dexp.
  const rangeBF = (mx - mn) || 1;
  const refDisp = ref ? Math.pow(ref, power) * (dfScale || 1) : mx;
  const rangeDF = (refDisp - mn) || 1, cEdge = N / 2, rMax = N * 0.54, half = N / 2;
  const rIn = rBF || N, rOut = (rBF || N) * 1.3, dexp = dfExp || 2.2;
  for (let r = 0; r < N; r++) {
    const sr = (r - half) / zoom + half, r0 = Math.floor(sr), fr = sr - r0;
    for (let c = 0; c < N; c++) {
      const sc = ((N - 1 - c) - half) / zoom + half, c0 = Math.floor(sc), fc = sc - c0; // mirror in x + zoom
      let val = mn;
      if (r0 >= 0 && r0 < N - 1 && c0 >= 0 && c0 < N - 1) { const b = r0 * N + c0;
        val = disp[b]*(1-fr)*(1-fc) + disp[b+1]*(1-fr)*fc + disp[b+N]*fr*(1-fc) + disp[b+N+1]*fr*fc; }
      const v = val - mn;
      const sdx = sc - half, sdy = sr - half, sd = Math.sqrt(sdx * sdx + sdy * sdy);
      let t;
      if (sd <= rIn) { t = v / rangeBF; }                                  // bright-field disk: per-frame
      else { let tDF = v / rangeDF; if (tDF > 1) tDF = 1; tDF = Math.pow(tDF, dexp); // dark field: absolute + crushed
        if (sd >= rOut) t = tDF; else { const k = (sd - rIn) / (rOut - rIn); t = (v / rangeBF) * (1 - k) + tDF * k; } }
      if (t > 1) t = 1;
      const dist = Math.hypot(c - cEdge, r - cEdge) / rMax;
      let vig = dist < 0.78 ? 1 : Math.max(0, 1 - (dist - 0.78) / 0.24);
      vig *= vig;
      const col = plasmaMap(t);
      const o = (r * N + c) * 4;
      const w = vig * Math.min(1, t * 6); // ramp only the very bottom to true black
      px[o] = col[0] * w | 0; px[o + 1] = col[1] * w | 0; px[o + 2] = col[2] * w | 0; px[o + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// Colormaps & DP rendering to offscreen canvas
// ============================================================

function infernoMap(t) {
  t=Math.max(0,Math.min(1,t));
  if(t<0.25){const s=t/0.25;return[s*90|0,s*10|0,s*130|0];}
  if(t<0.5){const s=(t-0.25)/0.25;return[90+s*140|0,10+s*30|0,130-s*50|0];}
  if(t<0.75){const s=(t-0.5)/0.25;return[230+s*25|0,40+s*120|0,80-s*70|0];}
  const s=(t-0.75)/0.25;return[255,160+s*75|0,10+s*140|0];
}

// matplotlib "plasma": dark blue/purple -> magenta -> orange -> yellow
const PLASMA = [[13,8,135],[84,2,163],[139,10,165],[185,50,137],[219,92,104],[244,136,73],[254,188,43],[240,249,33]];
function plasmaMap(t) {
  t = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const s = t * (PLASMA.length - 1), i = Math.min(PLASMA.length - 2, s | 0), f = s - i, a = PLASMA[i], b = PLASMA[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

// element-like kinds: 0/1 honeycomb A/B, 2 heavy dopant, 3/4/5 organic C/N/O (the adsorbed molecule)
// kinds: 0/1 substrate A/B, 2 substitutional dopant (gold, bonds into the lattice), 3/4/5 organic C/N/O,
// 6 on-top metal cluster (silvery, no bonds -- nanoparticle / pyramid). The "unique" atoms (dopant, N, O,
// cluster) get larger radii so they pop.
const GRAIN_COLORS = [[120,190,255],[255,150,110],[255,205,80],[190,196,206],[120,135,255],[255,90,80],[206,214,226]];
const ATOM_RAD     = [1.0, 0.86, 1.7, 0.78, 1.08, 1.24, 1.7];
const ATOM_AMP     = [1.0, 1.0, 2.4, 1.0, 1.35, 1.7, 3.0]; // projected-potential weight (~scattering power; heavy = dopant/cluster)

function renderDPtoCanvas(offscreen, intensity, N, gamma, zoom) {
  zoom = zoom || 1;
  offscreen.width = N; offscreen.height = N;
  const ctx = offscreen.getContext("2d");
  const imgData = ctx.createImageData(N, N);
  const px = imgData.data;
  const c = N / 2;

  // Bilinear-sample the central N/zoom region (the interesting reflections sit
  // close to the unscattered beam), then log + gamma stretch over what we show.
  function sample(sx, sy) {
    sx = Math.max(0, Math.min(N-1, sx)); sy = Math.max(0, Math.min(N-1, sy));
    const x0 = Math.floor(sx), y0 = Math.floor(sy);
    const x1 = Math.min(N-1, x0+1), y1 = Math.min(N-1, y0+1);
    const fx = sx-x0, fy = sy-y0;
    const a = intensity[y0*N+x0]*(1-fx) + intensity[y0*N+x1]*fx;
    const b = intensity[y1*N+x0]*(1-fx) + intensity[y1*N+x1]*fx;
    return a*(1-fy) + b*fy;
  }
  const disp = new Float32Array(N*N);
  let mn = Infinity, mx = -Infinity;
  for (let r=0;r<N;r++){
    const sy = c + (r - c)/zoom;
    for (let cc=0;cc<N;cc++){
      const v = Math.log(1 + sample(c + (cc - c)/zoom, sy));
      disp[r*N+cc] = v;
      if (v<mn) mn=v; if (v>mx) mx=v;
    }
  }
  const range = mx-mn || 1;
  const blackPt = 0.30;             // push the low-intensity background to true black
  const cEdge = N/2, rMax = N*0.52; // radial vignette so the pattern fades to black at the edges
  for (let r=0;r<N;r++){
    for (let cc=0;cc<N;cc++){
      let t = Math.pow((disp[r*N+cc]-mn)/range, gamma);
      t = Math.max(0, (t - blackPt) / (1 - blackPt));
      const dist = Math.hypot(cc - cEdge, r - cEdge) / rMax;
      let vig = dist < 0.72 ? 1 : Math.max(0, 1 - (dist - 0.72) / 0.30);
      vig *= vig;
      const col = infernoMap(t);
      const o = (r*N+cc)*4;
      px[o]=col[0]*vig|0; px[o+1]=col[1]*vig|0; px[o+2]=col[2]*vig|0; px[o+3]=255;
    }
  }
  ctx.putImageData(imgData,0,0);
}

// ============================================================
// Unified 3D scene renderer
// ============================================================

function renderProbeToCanvas(offscreen, cropSize, pixelSize, qMax, defocus, lambda, gamma) {
  const N = cropSize;
  offscreen.width = N; offscreen.height = N;
  const ctx = offscreen.getContext("2d");
  const imgData = ctx.createImageData(N, N);
  const px = imgData.data;

  // Compute aperture intensity in diffraction space (|A(q)|^2), fftshifted for display
  const dq = 1.0 / (N * pixelSize);
  const intensity = new Float32Array(N * N);
  for (let r = 0; r < N; r++) {
    const qy = r < N/2 ? r * dq : (r - N) * dq;
    for (let c = 0; c < N; c++) {
      const qx = c < N/2 ? c * dq : (c - N) * dq;
      const q = Math.sqrt(qx*qx + qy*qy);
      const amp = Math.max(0, Math.min(1, (qMax - q) / dq + 0.5));
      // fftshift: swap quadrants for display
      const dr = (r + (N>>1)) % N, dc = (c + (N>>1)) % N;
      intensity[dr * N + dc] = amp * amp;
    }
  }

  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < N*N; i++) { if (intensity[i] < mn) mn = intensity[i]; if (intensity[i] > mx) mx = intensity[i]; }
  const range = mx - mn || 1;
  for (let i = 0; i < N*N; i++) {
    const t = Math.pow((intensity[i] - mn) / range, gamma);
    const [r, g, b] = infernoMap(t);
    px[i*4] = r; px[i*4+1] = g; px[i*4+2] = b; px[i*4+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
}

function renderScene(ctx, W, H, atoms, view, probeX, probeY, qMax, defocus, dpCanvas, dpSize, cropSize, pixelSize, cellDimZ, dpZoom, sampleShift, halfX, latA) {
  ctx.clearRect(0,0,W,H); // transparent background: the beam/crystal/detector float on the page

  sampleShift = sampleShift || 0; halfX = halfX || 15; latA = latA || 3.4;
  const numAtoms = atoms.length / 4;
  const dpHalf = dpSize / 2;

  // Scene z-layout: beam from top, DP at bottom
  // Atom z is negated so the block is flipped vertically
  const zDP = -26;
  const zBeamSrc = 18;
  const halfZ = cellDimZ / 2; // atom block z boundaries

  // ---- Diffraction pattern as flat image at bottom ----
  const c0 = proj(probeX - dpHalf, probeY - dpHalf, zDP, view);
  const c1 = proj(probeX + dpHalf, probeY - dpHalf, zDP, view);
  const c3 = proj(probeX - dpHalf, probeY + dpHalf, zDP, view);
  // 4th corner of the affine PARALLELOGRAM the image actually fills (not the perspective-projected
  // point), so the opaque black detector and its outline coincide exactly.
  const c2 = { sx: c1.sx + c3.sx - c0.sx, sy: c1.sy + c3.sy - c0.sy };

  ctx.save();
  const imgW = dpCanvas.width, imgH = dpCanvas.height;
  const ta = (c1.sx - c0.sx) / imgW, tb = (c1.sy - c0.sy) / imgW;
  const tc = (c3.sx - c0.sx) / imgH, td = (c3.sy - c0.sy) / imgH;
  ctx.setTransform(ta, tb, tc, td, c0.sx, c0.sy);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(dpCanvas, 0, 0); // opaque: a solid black detector with the plasma CBED
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();

  // DP border
  ctx.strokeStyle = "rgba(100,100,100,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c0.sx,c0.sy); ctx.lineTo(c1.sx,c1.sy);
  ctx.lineTo(c2.sx,c2.sy); ctx.lineTo(c3.sx,c3.sy);
  ctx.closePath(); ctx.stroke();

  // ---- Probe cone, LOWER pass (sample plane -> detector): drawn BEHIND the atoms so the sample sheet
  // occludes the part of the beam that is below it. (Affine DP centre used by both cone passes.)
  const dpCenterSx = c0.sx + (c1.sx - c0.sx) / 2 + (c3.sx - c0.sx) / 2;
  const dpCenterSy = c0.sy + (c1.sy - c0.sy) / 2 + (c3.sy - c0.sy) / 2;
  drawProbeCone(ctx, view, probeX, probeY, qMax, defocus, dpSize, zDP, zBeamSrc, halfZ, cropSize, pixelSize, dpCenterSx, dpCenterSy, dpZoom, "lower");

  // ---- Draw atoms (sorted by depth, back to front) ----
  // Sample scan: shift the crystal in x and WRAP it (modulo) so atoms that leave the right edge
  // reappear on the left -- the count stays constant, none vanish. The cell is a whole number of
  // lattice periods so it tiles seamlessly; the window is offset by a quarter period (pad) so the
  // wrap seam falls in a lattice GAP, keeping atoms off the boundary where float rounding could glitch.
  const pad = latA * 0.25, twoH = 2 * halfX;
  // The cell is TALL in y (so the cropSize diffraction window fits without wrapping), but the SCENE only
  // draws a thin band around the beam line so it still reads as a thin sheet, not a fat block.
  const yClip = 16;
  const projected = [];
  for (let i=0;i<numAtoms;i++){
    const ay = atoms[i*4+1];
    if (ay < -yClip || ay > yClip) continue;
    const ax = ((atoms[i*4] + sampleShift - pad + halfX) % twoH + twoH) % twoH - halfX + pad;
    const p=proj(ax, ay, -atoms[i*4+2], view);
    projected.push({sx:p.sx,sy:p.sy,depth:p.depth,grain:atoms[i*4+3],ax,ay});
  }
  projected.sort((a,b)=>a.depth-b.depth);
  const minD=projected[0].depth, maxD=projected[projected.length-1].depth;
  const rangeD=maxD-minD||1;

  // Ball-and-stick bonds, drawn UNDER the spheres. Honeycomb nearest neighbours (~1.96 A, so the
  // network reads like graphene and the vacancy / Stone-Wales defects show clearly) plus the molecule's
  // shorter bonds. The distance cutoff skips 3.4 A second neighbours and any pair split across the scroll
  // seam (whose wrapped x differ by ~the cell width).
  const vis = [];
  for (let i=0;i<projected.length;i++){ const a=projected[i]; if (a.sx>-30 && a.sx<W+30 && a.sy>-30 && a.sy<H+30) vis.push(a); }
  ctx.lineCap="round";
  // Lattice bonds (graphene network; dopant kind 2 still links). Cutoff 6.8 sits in the wide gap between
  // the 1.85 A nearest neighbour (3.4) and the 3.2 A second neighbour (10.2), so the regular net is
  // unchanged -- but the STRETCHED Stone-Wales bond (~2.5 A, the only pair that lands in that gap) draws,
  // and we paint it in a warm accent so the rotated bond reads at a glance.
  for (let i=0;i<vis.length;i++){ if (vis[i].grain>2) continue;
    for (let j=i+1;j<vis.length;j++){ if (vis[j].grain>2) continue;
      const dx=vis[i].ax-vis[j].ax, dy=vis[i].ay-vis[j].ay, d2=dx*dx+dy*dy;
      if (d2 >= 6.8) continue;
      if (d2 < 4.2){ ctx.strokeStyle="rgba(116,130,160,0.62)"; ctx.lineWidth=2.1; }
      else { ctx.strokeStyle="rgba(255,116,40,0.96)"; ctx.lineWidth=3.7; }  // the rotated (stretched) Stone-Wales bond
      ctx.beginPath(); ctx.moveTo(vis[i].sx,vis[i].sy); ctx.lineTo(vis[j].sx,vis[j].sy); ctx.stroke(); } }
  const org = vis.filter(a=>a.grain>=3 && a.grain<=5); // organic only; kind 6 cluster atoms draw bondless
  ctx.strokeStyle="rgba(108,112,130,0.92)"; ctx.lineWidth=2.4;  // molecule bonds (stronger)
  for (let i=0;i<org.length;i++) for (let j=i+1;j<org.length;j++){
    const dx=org[i].ax-org[j].ax, dy=org[i].ay-org[j].ay;
    if (dx*dx+dy*dy < 2.9){ ctx.beginPath(); ctx.moveTo(org[i].sx,org[i].sy); ctx.lineTo(org[j].sx,org[j].sy); ctx.stroke(); } }

  for (let i=0;i<projected.length;i++){
    const a=projected[i];
    if (a.sx < -8 || a.sx > W + 8 || a.sy < -8 || a.sy > H + 8) continue; // skip atoms off-screen (sheet is wider than the frame)
    const t=(a.depth-minD)/rangeD;
    const fade=0.55+0.45*t;
    const gc=GRAIN_COLORS[a.grain];
    const rad=(3.4+2.6*t)*ATOM_RAD[a.grain];
    const cr=gc[0]*fade, cg=gc[1]*fade, cb=gc[2]*fade;
    // Glossy sphere: bright off-center highlight, base, then a darker rim.
    const grad=ctx.createRadialGradient(a.sx-rad*0.38, a.sy-rad*0.42, rad*0.1, a.sx, a.sy, rad);
    grad.addColorStop(0, `rgb(${Math.min(255,cr*1.55+40)|0},${Math.min(255,cg*1.55+40)|0},${Math.min(255,cb*1.55+40)|0})`);
    grad.addColorStop(0.5, `rgb(${cr|0},${cg|0},${cb|0})`);
    grad.addColorStop(1, `rgb(${cr*0.4|0},${cg*0.4|0},${cb*0.4|0})`);
    ctx.fillStyle=grad;
    ctx.strokeStyle=`rgba(0,0,0,0.45)`;
    ctx.lineWidth=0.9;
    ctx.beginPath();
    ctx.arc(a.sx, a.sy, rad, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ---- Probe cone, UPPER pass (aperture -> cross-over -> sample plane) + the beam's circular
  // projection in the sample plane: drawn AFTER the atoms so it reads in front of the sample. ----
  drawProbeCone(ctx, view, probeX, probeY, qMax, defocus, dpSize, zDP, zBeamSrc, halfZ, cropSize, pixelSize, dpCenterSx, dpCenterSy, dpZoom, "upper");
}

function drawProbeCone(ctx, view, probeX, probeY, qMax, defocus, dpSize, zDP, zBeamSrc, halfZ, cropSize, pixelSize, dpCenterSx, dpCenterSy, dpZoom, part) {
  // The cone is drawn in two passes so the sample occludes the part behind it: part "lower" (sample
  // plane -> detector) is drawn BEFORE the atoms, part "upper" (aperture -> cross-over -> sample plane)
  // AFTER. Cross-over height tanh-saturated so the large shadow defocus never pushes it above the aperture.
  const crossZ = 15 * Math.tanh(defocus / 320);

  // Bright-field disk radius at the DP plane, the aperture radius for the same takeoff angle, and the
  // beam radius where it crosses the SAMPLE plane (z=0) -- linear along the lower cone (cross-over -> DP).
  const bottomRadius = qMax * pixelSize * dpSize * (dpZoom || 1) * 0.95;
  const topDist = Math.abs(zBeamSrc - crossZ);
  const bottomDist = Math.abs(zDP - crossZ);
  const topRadius = bottomDist > 0 ? bottomRadius * topDist / bottomDist : bottomRadius;
  const beamRadius = crossZ <= 0 ? 0 : bottomRadius * crossZ / (crossZ - zDP);

  // Keep the cone bottom + crossover aligned with the drawn DP image center.
  const nomDP = proj(probeX, probeY, zDP, view);
  const dpOx = dpCenterSx - nomDP.sx, dpOy = dpCenterSy - nomDP.sy;
  function P(x, y, z) {
    const p = proj(x, y, z, view);
    const t = Math.max(0, Math.min(1, (z - zDP) / (zBeamSrc - zDP)));
    return { x: p.sx + dpOx * (1 - t), y: p.sy + dpOy * (1 - t) };
  }
  // Stroke a projected circle (an ellipse) of given radius at height z.
  function ring(z, radius, alpha, lw) {
    ctx.globalAlpha = alpha; ctx.lineWidth = lw; ctx.strokeStyle = "#00b863";
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const p = P(probeX + Math.cos(a) * radius, probeY + Math.sin(a) * radius, z);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  const apL = P(probeX - topRadius, probeY, zBeamSrc), apR = P(probeX + topRadius, probeY, zBeamSrc);
  const cross = P(probeX, probeY, crossZ);
  const dpL = P(probeX - bottomRadius, probeY, zDP), dpR = P(probeX + bottomRadius, probeY, zDP);
  const beamL = P(probeX - beamRadius, probeY, 0), beamR = P(probeX + beamRadius, probeY, 0);

  // Translucent green fill from a UNION of simple subpaths, each forced to the aperture circle's
  // orientation so fill("nonzero") unions (never cancels) the circle<->cone overlaps.
  function ellipsePts(z, radius) {
    const pts = [];
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; pts.push(P(probeX + Math.cos(a) * radius, probeY + Math.sin(a) * radius, z)); }
    return pts;
  }
  function signedArea(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return s; }
  function emitSub(pts, refSign) {
    const seq = (signedArea(pts) * refSign >= 0) ? pts : pts.slice().reverse();
    for (let i = 0; i < seq.length; i++) { const p = seq[i]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  }
  const apEl = ellipsePts(zBeamSrc, topRadius), dpEl = ellipsePts(zDP, bottomRadius), beamEl = ellipsePts(0, beamRadius);
  const refSign = signedArea(apEl) >= 0 ? 1 : -1;
  ctx.setLineDash([]); ctx.fillStyle = "rgba(0,200,110,0.3)";

  if (part === "lower") {
    // BELOW the sample (sample plane -> detector): beam circle + frustum body + DP circle. Drawn BEFORE
    // the atoms so the sample sheet occludes it.
    ctx.globalAlpha = 1;
    ctx.beginPath();
    emitSub(beamEl, refSign); emitSub([beamL, beamR, dpR, dpL], refSign); emitSub(dpEl, refSign);
    ctx.fill("nonzero");
    ctx.globalAlpha = 0.85; ctx.strokeStyle = "#00b863"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(beamL.x, beamL.y); ctx.lineTo(dpL.x, dpL.y); ctx.moveTo(beamR.x, beamR.y); ctx.lineTo(dpR.x, dpR.y); ctx.stroke();
    ring(zDP, bottomRadius, 0.85, 1.6);
    ctx.globalAlpha = 1;
    return;
  }

  // ABOVE/at the sample (aperture -> cross-over -> sample plane), drawn AFTER the atoms, plus the
  // circular projection of the beam IN the sample plane (the bright ring at z=0).
  ctx.globalAlpha = 1;
  ctx.beginPath();
  emitSub(apEl, refSign);                  // aperture circle
  emitSub([apL, apR, cross], refSign);     // converging: aperture -> cross-over
  emitSub([cross, beamL, beamR], refSign); // diverging: cross-over -> sample plane
  ctx.fill("nonzero");
  ctx.globalAlpha = 0.85; ctx.strokeStyle = "#00b863"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(apL.x, apL.y); ctx.lineTo(cross.x, cross.y); ctx.lineTo(beamL.x, beamL.y);
  ctx.moveTo(apR.x, apR.y); ctx.lineTo(cross.x, cross.y); ctx.lineTo(beamR.x, beamR.y);
  ctx.stroke();
  ring(zBeamSrc, topRadius, 0.85, 1.6);    // aperture ring
  ring(0, beamRadius, 0.95, 1.9);          // beam's circular projection in the sample plane
  ctx.globalAlpha = 0.9; ctx.fillStyle = "#00ff88";
  ctx.beginPath(); ctx.arc(cross.x, cross.y, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

// ============================================================
// Main render function
// ============================================================

function render({ model, el }) {
  const pixelSize = model.get("pixel_size") || 0.2;
  const cellDimX = model.get("cell_dim_x") || 30;
  const cellDimY = model.get("cell_dim_y") || 30;
  const cellDimZ = model.get("cell_dim_z") || 3;
  const aLattice = model.get("a_lattice") || 3.4;
  const sigma = model.get("sigma") || 0.22;
  const lambda = model.get("lambda") || 0.0197;
  const cropSize = model.get("crop_size") || 128;
  const dispPower = model.get("display_power") || 0.5;  // detector tone map: BF disk pops (was log)
  const dfPower = model.get("df_power") || 2.2;         // dark-field suppression: weak scattering reads near-black outside the BF disk, lighting up only over thick/heavy regions
  const dfScale = model.get("df_ref_scale") || 3.0;     // dark-field exposure ceiling = (bare BF peak) x this; high enough that a thick region glows bright but still shows structure, not a flat flood

  // Coherent-CBED diffraction (overlapping interfering disks)
  const cbedG0 = model.get("cbed_g0") || 23;            // reciprocal lattice spacing (DP px)
  const cbedDiskFrac = model.get("cbed_disk_frac") || 0.78; // disk radius as a fraction of g0
  const cbedChi = model.get("cbed_chi") || 0.026;       // defocus -> interference fringe density
  const cbedGMax = model.get("cbed_g_max") || 42;       // outermost beams (DP px)
  const cbedSigmaG = model.get("cbed_sigma_g") || 40;   // structure-factor falloff (DP px)
  const cbedPhaseScale = model.get("cbed_phase_scale") || 0.04; // probe drag -> fringe slide

  const id = "s4d-" + Math.random().toString(36).slice(2, 8);
  const dpSize = model.get("dp_size") || 40;     // DP image size in Angstroms (in 3D scene)
  const viewEl = model.get("view_el") || -26;    // scene elevation angle (deg)
  const viewZoom = model.get("view_zoom") || 26; // scene zoom
  const embed = model.get("embed");              // strip the card chrome to drop into a pillar panel

  const style = document.createElement("style");
  style.textContent = `
    .${id}-wrap {
      background: var(--${id}-bg, #111);
      color: var(--${id}-fg, #ccc);
      border: 1px solid var(--${id}-border, #444);
      border-radius: 8px;
      padding: 8px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      max-width: 100%;
      box-sizing: border-box;
    }
    .${id}-title { font-size: 16px; font-weight: 600; color: var(--${id}-title, #ddd); margin-bottom: 4px; text-align: center; }
    .${id}-main { display: flex; flex-direction: column; gap: 8px; }
    .${id}-bottom-hint { font-size: 11px; color: var(--${id}-dim, #555); text-align: center; margin-top: 4px; }
    .${id}-wrap.${id}-bare { background: transparent; border: 0; padding: 0; border-radius: 10px; }
    .${id}-bare .${id}-bottom-hint { display: none; }
    .${id}-bare .${id}-loading { padding: 12px; }
    .${id}-bare .${id}-canvas { border-radius: 10px; }
    .${id}-controls { display: flex; flex-direction: row; flex-wrap: wrap; gap: 10px 20px; align-items: flex-end; padding: 8px 4px; }
    .${id}-canvas-wrap { min-width: 0; }
    .${id}-canvas { width: 100%; display: block; border-radius: 4px; cursor: crosshair; touch-action: none; }
    .${id}-slider-group { flex: 1; min-width: 160px; }
    .${id}-slider-group label { display: block; font-size: 14px; color: var(--${id}-label, #aaa); margin-bottom: 3px; }
    .${id}-slider-group input[type=range] { width: 100%; accent-color: #00cc66; }
    .${id}-slider-val { font-size: 13px; color: var(--${id}-dim, #666); margin-top: 2px; }
    .${id}-btn {
      padding: 8px 16px; border: 1px solid var(--${id}-border, #444); background: var(--${id}-btnbg, #222);
      color: var(--${id}-fg, #ccc); border-radius: 4px; cursor: pointer; font-size: 14px; text-align: center;
      align-self: center;
    }
    .${id}-btn:hover { background: var(--${id}-btnhover, #333); }
    .${id}-btn.active { background: #1a4d2e; border-color: #00cc66; color: #00ff88; }
    .${id}-hint { font-size: 12px; color: var(--${id}-dim, #555); line-height: 1.4; }
    .${id}-loading { color: var(--${id}-dim, #888); padding: 40px; text-align: center; }
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${id}-wrap${embed ? ` ${id}-bare` : ""}`;
  wrap.innerHTML = `
    <div class="${id}-loading">Generating crystal...</div>
    <div class="${id}-main" style="display:none;">
      <canvas class="${id}-canvas" id="${id}-scene"></canvas>
      <div class="${id}-bottom-hint">Drag to move the electron probe</div>
    </div>
  `;
  el.appendChild(wrap);

  // ---- Light/dark theming of the chrome; the dark diffraction display stays dark. ----
  const s4dPalettes = {
    dark:  { bg: "#111", fg: "#ccc", title: "#ddd", label: "#aaa", dim: "#666", btnbg: "#222", btnhover: "#333", border: "#444" },
    light: { bg: "#f4f6f3", fg: "#333", title: "#1f1f1f", label: "#556", dim: "#888", btnbg: "#ffffff", btnhover: "#e9ebe6", border: "#d3d6d0" },
  };
  function s4dDetectDark() {
    try {
      const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
      if (m && m.length >= 3) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
    } catch (e) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function s4dApplyTheme() {
    const p = s4dPalettes[s4dDetectDark() ? "dark" : "light"];
    for (const k in p) wrap.style.setProperty(`--${id}-${k}`, p[k]);
  }
  s4dApplyTheme();
  new MutationObserver(s4dApplyTheme).observe(document.documentElement, { attributes: true });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", s4dApplyTheme);
  let s4dLastDark = s4dDetectDark();
  setInterval(() => { const d = s4dDetectDark(); if (d !== s4dLastDark) { s4dLastDark = d; s4dApplyTheme(); } }, 700);

  let stopAnim = () => {}; // set once the scene is built; cancels the animation loop

  setTimeout(() => {
    const loadingEl = wrap.querySelector(`.${id}-loading`);
    const mainEl = wrap.querySelector(`.${id}-main`);
    const canvas = wrap.querySelector(`#${id}-scene`);
    const W = 540, H = 540;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Offscreen canvas for the diffraction pattern
    const dpOffscreen = document.createElement("canvas");

    // Generate the crystal once. Snap the cell width to a whole number of lattice periods so the
    // lattice tiles SEAMLESSLY in x -- otherwise the hover scroll shows a gap where the atoms wrap.
    const cellX = Math.max(aLattice, Math.round(cellDimX / aLattice) * aLattice);
    const { potential, imW, imH, atoms } = generateSample({ pixelSize, cellDimX: cellX, cellDimY, cellDimZ, aLattice, sigma });

    // The beam stays centered. PASSIVE = the probe DEFOCUS sweeps: the cone cross-over slides and the
    // detector shows the defocused shadow image (Ronchigram) of the lattice. HOVER = the probe settles
    // at a fairly large defocus (hovDefocus) while the sample scans left->right, so the magnified lattice
    // shadow flies by in the bright-field disk. Real FFT physics (probe x sample -> FFT) drives the
    // detector; the scene reads the same defocus + scan, so they stay in sync.
    let probeX = 0; const probeY = 0;
    const initDefocus = model.get("init_defocus") || 0;  // debug: hold a static defocus
    const initScan = model.get("init_scan") || 0;        // debug: hold a static sample scan (A)
    const qMax = model.get("probe_q_max") || 0.3;        // MODERATE convergence: disks overlap a bit, and the BF disk is big enough to hold the shadow projection
    const dpZoom = model.get("dp_zoom") || 1.5;          // light magnify -> BF disk near native FFT res so the projection stays crisp; cone bottom scales with it
    const defAmp = model.get("defocus_amp") || 500;      // passive defocus sweep (A): big enough that the BF disk shows a magnified PROJECTION (Ronchigram) of the lattice/molecule under the probe
    const scanSpeed = model.get("scan_speed") || 7.0;    // hover sample scan rate (A/s)
    const hovDefocus = model.get("hover_defocus") || 480; // hover holds the shadow regime so the projection of whatever is under the probe scans by in the BF disk
    const halfX = cellX / 2;
    let defocus = initDefocus, sampleShift = initScan, hov = 0;

    let probe = computeProbe(cropSize, pixelSize, qMax, defocus, lambda), probeDf = defocus;
    // Fixed bright-field reference = the bare-lattice BF peak (a focused probe over an empty patch), so the
    // detector exposure is ABSOLUTE rather than per-frame. The dark field then stays dark over the thin
    // lattice and only lights up where the sample is thicker (a defect / heavy cluster scatters more) --
    // a per-frame max would grow with the brighter BF over thick regions and cancel exactly that signal.
    const refProbe = computeProbe(cropSize, pixelSize, qMax, 0, lambda);
    const refInt = computeDiffraction(potential, imW, imH, refProbe.probeRe, refProbe.probeIm, -43, 0, cropSize, pixelSize);
    let bfRef = 1e-9; for (let i = 0; i < refInt.length; i++) if (refInt[i] > bfRef) bfRef = refInt[i];
    const view = makeView(0, viewEl, viewZoom * 0.82, W * 0.5, H * 0.36, 140);

    function renderAll() {
      if (probeDf !== defocus) { probe = computeProbe(cropSize, pixelSize, qMax, defocus, lambda); probeDf = defocus; }
      probeX = -sampleShift; // the beam is centered; the sample scrolls under it
      const intensity = computeDiffraction(potential, imW, imH, probe.probeRe, probe.probeIm, probeX, probeY, cropSize, pixelSize);
      const rBF = qMax * cropSize * pixelSize; // bright-field disk radius (px) = the aperture radius in the FFT grid
      renderCBEDtoCanvas(dpOffscreen, intensity, cropSize, dispPower, dpZoom, rBF, dfPower, bfRef, dfScale);
      renderScene(ctx, W, H, atoms, view, 0, probeY, qMax, defocus, dpOffscreen, dpSize, cropSize, pixelSize, cellDimZ, dpZoom, sampleShift, halfX, aLattice);
    }

    // Hover the panel to scan the sample; passive otherwise.
    let hover = false;
    canvas.addEventListener("pointerenter", () => { hover = true; });
    canvas.addEventListener("pointerleave", () => { hover = false; });

    let raf = null, running = false, t0 = 0, lastT = -1e9;
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (now - lastT < 33) return; // ~30fps cap
      lastT = now;
      if (!t0) t0 = now;
      const t = (now - t0) * 0.001;
      hov += ((hover ? 1 : 0) - hov) * 0.07;             // ease passive <-> hover
      defocus = (1 - hov) * (defAmp * (0.5 - 0.5 * Math.cos(t * 0.5))) + hov * hovDefocus; // passive breathes focus<->overfocus; hover settles at ~hovDefocus so the lattice shadow flies by under the scanning probe
      sampleShift += hov * scanSpeed * 0.033;            // hover: scan the sample left -> right
      renderAll();
    }
    function startAnim() { if (!running) { running = true; t0 = 0; raf = requestAnimationFrame(frame); } }
    function stopAnimLoop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    // Only animate while on screen (saves CPU when scrolled away). init_defocus/init_scan hold a static frame.
    let io = null;
    if (initDefocus || initScan) {
      // debug: static frame, no animation
    } else if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((es) => { es[0].isIntersecting ? startAnim() : stopAnimLoop(); }, { threshold: 0.05 });
      io.observe(canvas);
    } else { startAnim(); }
    stopAnim = () => { stopAnimLoop(); if (io) io.disconnect(); };

    // Init
    loadingEl.style.display = "none";
    mainEl.style.display = "flex";
    renderAll();
  }, 50);

  return () => stopAnim();
}

export default { render };
