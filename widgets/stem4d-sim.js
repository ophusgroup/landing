// stem4d-sim.js — Interactive 4DSTEM diffraction simulation widget
// Single 3D scene: atoms + probe cone + diffraction image below sample
// Pure JS ESM module, no dependencies

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
  const { pixelSize, cellDimX, cellDimY, cellDimZ, aLattice, sigma } = params;
  const imW = Math.round(cellDimX / pixelSize), imH = Math.round(cellDimY / pixelSize);
  const potential = new Float32Array(imW * imH);
  const basis = [[0,0,0],[0.5,0.5,0],[0.5,0,0.5],[0,0.5,0.5]];
  const grains = [
    { cx:-50, cy:-4, cz:-8, rot: makeRot(0, 0, 76*Math.PI/180) },
    { cx:  0, cy: 4, cz:10, rot: makeRot(0, 45*Math.PI/180, 110*Math.PI/180) },
    { cx: 50, cy: 0, cz: 2, rot: makeRot(45*Math.PI/180, -54.73*Math.PI/180, 22*Math.PI/180) },
  ];
  const p01=[(grains[1].cx+grains[0].cx)/2,(grains[1].cy+grains[0].cy)/2,(grains[1].cz+grains[0].cz)/2];
  // Use only x-component for boundary to avoid diagonal z-clipping artifact
  const v01=[grains[1].cx-grains[0].cx, 0, 0];
  const n01=Math.abs(v01[0]); v01[0]/=n01;
  const p12=[(grains[2].cx+grains[1].cx)/2,(grains[2].cy+grains[1].cy)/2,(grains[2].cz+grains[1].cz)/2];
  // Use only x-component for boundary to avoid diagonal z-clipping artifact
  const v12=[grains[2].cx-grains[1].cx, 0, 0];
  const n12=Math.abs(v12[0]); v12[0]/=n12;
  const tileR=10, halfX=cellDimX/2, halfY=cellDimY/2, halfZ=cellDimZ/2, aq=aLattice/4;
  const atomList = [];

  for (let gi=0;gi<3;gi++) {
    const g=grains[gi];
    for (let ix=-tileR;ix<=tileR;ix++) for (let iy=-tileR;iy<=tileR;iy++) for (let iz=-tileR;iz<=tileR;iz++) for (let bi=0;bi<4;bi++) {
      const lx=(ix+basis[bi][0])*aLattice, ly=(iy+basis[bi][1])*aLattice, lz=(iz+basis[bi][2])*aLattice;
      const [rx,ry,rz]=applyRot(g.rot,lx,ly,lz);
      const ax=rx+g.cx, ay=ry+g.cy, az=rz+g.cz;
      if (ax<-halfX||ax>=halfX||ay<-halfY||ay>=halfY||az<-halfZ||az>=halfZ) continue;
      const d01=v01[0]*(ax-p01[0])+v01[1]*(ay-p01[1])+v01[2]*(az-p01[2]);
      const d12=v12[0]*(ax-p12[0])+v12[1]*(ay-p12[1])+v12[2]*(az-p12[2]);
      if (gi===0&&d01>=-aq) continue;
      if (gi===1&&(d01<=aq||d12>=-aq)) continue;
      if (gi===2&&d12<=aq) continue;
      atomList.push(ax,ay,az,gi);
      const px=ax/pixelSize+imW/2, py=ay/pixelSize+imH/2;
      const fx=Math.floor(px), fy=Math.floor(py), dx=px-fx, dy=py-fy;
      const x0=((fx%imW)+imW)%imW, x1=((fx+1)%imW+imW)%imW;
      const y0=((fy%imH)+imH)%imH, y1=((fy+1)%imH+imH)%imH;
      potential[x0*imH+y0]+=(1-dx)*(1-dy); potential[x1*imH+y0]+=dx*(1-dy);
      potential[x0*imH+y1]+=(1-dx)*dy; potential[x1*imH+y1]+=dx*dy;
    }
  }

  // Gaussian blur
  const sigPx=sigma/pixelSize, kR=Math.ceil(sigPx*3);
  const kernel=new Float32Array(2*kR+1); let kSum=0;
  for (let i=-kR;i<=kR;i++){kernel[i+kR]=Math.exp(-0.5*(i/sigPx)**2);kSum+=kernel[i+kR];}
  for (let i=0;i<kernel.length;i++) kernel[i]/=kSum;
  const temp=new Float32Array(imW*imH);
  for (let y=0;y<imH;y++) for (let x=0;x<imW;x++){let s=0;for(let k=-kR;k<=kR;k++)s+=potential[((x+k)%imW+imW)%imW*imH+y]*kernel[k+kR];temp[x*imH+y]=s;}
  for (let x=0;x<imW;x++) for (let y=0;y<imH;y++){let s=0;for(let k=-kR;k<=kR;k++)s+=temp[x*imH+((y+k)%imH+imH)%imH]*kernel[k+kR];potential[x*imH+y]=s;}

  return { potential, imW, imH, atoms: new Float32Array(atomList) };
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
// Colormaps & DP rendering to offscreen canvas
// ============================================================

function infernoMap(t) {
  t=Math.max(0,Math.min(1,t));
  if(t<0.25){const s=t/0.25;return[s*90|0,s*10|0,30+s*100|0];}
  if(t<0.5){const s=(t-0.25)/0.25;return[90+s*140|0,10+s*30|0,130-s*50|0];}
  if(t<0.75){const s=(t-0.5)/0.25;return[230+s*25|0,40+s*120|0,80-s*70|0];}
  const s=(t-0.75)/0.25;return[255,160+s*75|0,10+s*140|0];
}

const GRAIN_COLORS = [[255,25,0],[0,200,255],[255,180,0]];

function renderDPtoCanvas(offscreen, intensity, N, gamma) {
  offscreen.width = N; offscreen.height = N;
  const ctx = offscreen.getContext("2d");
  const imgData = ctx.createImageData(N, N);
  const px = imgData.data;

  // Log + gamma
  const disp = new Float32Array(N*N);
  for (let i=0;i<N*N;i++) disp[i]=Math.log(1+intensity[i]);
  let mn=Infinity, mx=-Infinity;
  for (let i=0;i<N*N;i++){if(disp[i]<mn)mn=disp[i];if(disp[i]>mx)mx=disp[i];}
  const range=mx-mn||1;

  for (let i=0;i<N*N;i++){
    const t=Math.pow((disp[i]-mn)/range, gamma);
    const [r,g,b]=infernoMap(t);
    px[i*4]=r; px[i*4+1]=g; px[i*4+2]=b; px[i*4+3]=255;
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

function renderScene(ctx, W, H, atoms, view, probeX, probeY, qMax, defocus, dpCanvas, probeCanvas, dpSize, cropSize, pixelSize, cellDimZ) {
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "#080808";
  ctx.fillRect(0,0,W,H);

  const numAtoms = atoms.length / 4;
  const dpHalf = dpSize / 2;

  // Scene z-layout: beam from top, DP at bottom
  // Atom z is negated so the block is flipped vertically
  const zDP = -65;
  const zBeamSrc = 50;
  const halfZ = cellDimZ / 2; // atom block z boundaries

  // ---- Diffraction pattern as flat image at bottom ----
  const c0 = proj(probeX - dpHalf, probeY - dpHalf, zDP, view);
  const c1 = proj(probeX + dpHalf, probeY - dpHalf, zDP, view);
  const c3 = proj(probeX - dpHalf, probeY + dpHalf, zDP, view);
  const c2 = proj(probeX + dpHalf, probeY + dpHalf, zDP, view);

  ctx.save();
  const imgW = dpCanvas.width, imgH = dpCanvas.height;
  const ta = (c1.sx - c0.sx) / imgW, tb = (c1.sy - c0.sy) / imgW;
  const tc = (c3.sx - c0.sx) / imgH, td = (c3.sy - c0.sy) / imgH;
  ctx.setTransform(ta, tb, tc, td, c0.sx, c0.sy);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(dpCanvas, 0, 0);
  ctx.globalAlpha = 1;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.restore();

  // DP border
  ctx.strokeStyle = "rgba(100,100,100,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c0.sx,c0.sy); ctx.lineTo(c1.sx,c1.sy);
  ctx.lineTo(c2.sx,c2.sy); ctx.lineTo(c3.sx,c3.sy);
  ctx.closePath(); ctx.stroke();

  // ---- Draw atoms (sorted by depth, back to front) ----
  // Negate atom z to flip the block vertically
  const projected = new Array(numAtoms);
  for (let i=0;i<numAtoms;i++){
    const p=proj(atoms[i*4], atoms[i*4+1], -atoms[i*4+2], view);
    projected[i]={sx:p.sx,sy:p.sy,depth:p.depth,grain:atoms[i*4+3]};
  }
  projected.sort((a,b)=>a.depth-b.depth);
  const minD=projected[0].depth, maxD=projected[numAtoms-1].depth;
  const rangeD=maxD-minD||1;

  for (let i=0;i<numAtoms;i++){
    const a=projected[i];
    const t=(a.depth-minD)/rangeD;
    const fade=0.2+0.8*t;
    const gc=GRAIN_COLORS[a.grain];
    const size=1.5+3.0*t;
    ctx.fillStyle=`rgb(${gc[0]*fade|0},${gc[1]*fade|0},${gc[2]*fade|0})`;
    ctx.strokeStyle=`rgba(0,0,0,${0.15+0.5*t})`;
    ctx.lineWidth=0.6;
    ctx.beginPath();
    ctx.arc(a.sx, a.sy, size/2, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }

  // ---- Draw probe cone ----
  // Affine center: the transform maps pixel (imgW/2, imgH/2) to this screen point
  const dpCenterSx = c0.sx + (c1.sx - c0.sx) / 2 + (c3.sx - c0.sx) / 2;
  const dpCenterSy = c0.sy + (c1.sy - c0.sy) / 2 + (c3.sy - c0.sy) / 2;
  drawProbeCone(ctx, view, probeX, probeY, qMax, defocus, dpSize, zDP, zBeamSrc, halfZ, cropSize, pixelSize, dpCenterSx, dpCenterSy);

  // ---- Two inset panels on the right ----
  const insetSize = Math.min(180, W * 0.2);
  const insetX = W - insetSize - 10;
  const gap = 20;
  const labelH = 16;

  // Upper right: initial probe intensity (diffraction space)
  const probeY1 = 8;
  ctx.strokeStyle = "rgba(0,255,136,0.5)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(insetX-1, probeY1-1, insetSize+2, insetSize+2);
  ctx.drawImage(probeCanvas, insetX, probeY1, insetSize, insetSize);
  ctx.fillStyle = "rgba(0,255,136,0.6)";
  ctx.font = "16px -apple-system, sans-serif";
  ctx.fillText("Initial Probe Intensity", insetX, probeY1 + insetSize + labelH);

  // Lower right: diffraction pattern
  const dpY1 = probeY1 + insetSize + labelH + gap;
  ctx.strokeStyle = "rgba(0,255,136,0.5)";
  ctx.strokeRect(insetX-1, dpY1-1, insetSize+2, insetSize+2);
  ctx.drawImage(dpCanvas, insetX, dpY1, insetSize, insetSize);
  ctx.fillStyle = "rgba(0,255,136,0.6)";
  ctx.font = "16px -apple-system, sans-serif";
  ctx.fillText("Diffraction Pattern", insetX, dpY1 + insetSize + labelH);
}

function drawProbeCone(ctx, view, probeX, probeY, qMax, defocus, dpSize, zDP, zBeamSrc, halfZ, cropSize, pixelSize, dpCenterSx, dpCenterSy) {
  // Crossover z (in original coords, positive = above sample)
  const crossZ = Math.max(-50, Math.min(45, defocus / 500 * 35));

  // Bottom radius = BF disk radius in scene coords (matched to DP bright field spot)
  const dpHalf = dpSize / 2;
  const bottomRadius = qMax * pixelSize * dpSize * 0.95;

  // Top radius: proportional so both cones have same takeoff angle
  const topDist = Math.abs(zBeamSrc - crossZ);
  const bottomDist = Math.abs(zDP - crossZ);
  const topRadius = bottomDist > 0 ? bottomRadius * topDist / bottomDist : bottomRadius;

  // Z boundaries for dashed lines (atom block in scene coordinates)
  // Shift slightly with probeY to account for oblique viewing angle
  const yShift = probeY * 0.45; // z-offset proportional to probe y position
  const zBlockHi = halfZ * 1.15 + yShift;   // top: tighter to block
  const zBlockLo = -halfZ * 1.58 + yShift;  // bottom: extended further

  const nLines = Math.max(8, Math.round(20 * qMax / 0.15));
  const nCirclePts = 40;

  // Helper: draw a 3D circle
  function drawCircle3D(cx, cy, cz, radius, alpha, lineW) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineW;
    ctx.strokeStyle = "#00ff88";
    ctx.beginPath();
    for (let i = 0; i <= nCirclePts; i++) {
      const ang = (i / nCirclePts) * Math.PI * 2;
      const p = proj(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius, cz, view);
      if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }

  // Compute DP center offset for perspective alignment
  const nominalDPCenter = proj(probeX, probeY, zDP, view);
  const dpOx = dpCenterSx - nominalDPCenter.sx;
  const dpOy = dpCenterSy - nominalDPCenter.sy;

  // Helper: draw a line segment from z1 to z2 along a cone ray
  function drawRaySegment(cosA, sinA, r1, z1, r2, z2, dashed) {
    const p1x = probeX + cosA * r1, p1y = probeY + sinA * r1;
    const p2x = probeX + cosA * r2, p2y = probeY + sinA * r2;
    const sp1 = proj(p1x, p1y, z1, view);
    const sp2 = proj(p2x, p2y, z2, view);
    // Interpolate DP offset: full offset at zDP, zero at other z levels
    const t1 = Math.max(0, (z1 - zDP) / (zBeamSrc - zDP));
    const t2 = Math.max(0, (z2 - zDP) / (zBeamSrc - zDP));
    ctx.beginPath();
    if (dashed) ctx.setLineDash([4, 8]); else ctx.setLineDash([]);
    ctx.moveTo(sp1.sx + dpOx * (1 - t1), sp1.sy + dpOy * (1 - t1));
    ctx.lineTo(sp2.sx + dpOx * (1 - t2), sp2.sy + dpOy * (1 - t2));
    ctx.stroke();
  }

  // Helper: interpolate radius at a given z along a cone section
  function radiusAtZ(z, z1, r1, z2, r2) {
    if (Math.abs(z2 - z1) < 0.001) return r1;
    const t = (z - z1) / (z2 - z1);
    return r1 + t * (r2 - r1);
  }

  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;

  for (let i = 0; i < nLines; i++) {
    const angle = (i / nLines) * Math.PI * 2;
    const cosA = Math.cos(angle), sinA = Math.sin(angle);

    // Upper cone: beam source (zBeamSrc) -> crossover (crossZ)
    // Radius goes from topRadius -> 0
    // Lower cone: crossover (crossZ) -> DP (zDP)
    // Radius goes from 0 -> bottomRadius

    // Split each cone into segments: outside block (solid) and inside block (dashed)
    const segments = [
      { z1: zBeamSrc, r1: topRadius, z2: crossZ, r2: 0 },     // upper cone
      { z1: crossZ, r1: 0, z2: zDP, r2: bottomRadius },         // lower cone
    ];

    for (const seg of segments) {
      // Clip segment to 3 zones: above block, inside block, below block
      const zMin = Math.min(seg.z1, seg.z2), zMax = Math.max(seg.z1, seg.z2);
      const goingDown = seg.z2 < seg.z1;

      // Ordered z-cuts within the segment
      const cuts = [seg.z1];
      for (const bz of [zBlockHi, zBlockLo]) {
        if (bz > zMin && bz < zMax) cuts.push(bz);
      }
      cuts.push(seg.z2);
      if (goingDown) cuts.sort((a, b) => b - a); else cuts.sort((a, b) => a - b);

      for (let ci = 0; ci < cuts.length - 1; ci++) {
        const cz1 = cuts[ci], cz2 = cuts[ci + 1];
        const cr1 = radiusAtZ(cz1, seg.z1, seg.r1, seg.z2, seg.r2);
        const cr2 = radiusAtZ(cz2, seg.z1, seg.r1, seg.z2, seg.r2);
        const midZ = (cz1 + cz2) / 2;
        const inside = midZ >= zBlockLo && midZ <= zBlockHi;
        drawRaySegment(cosA, sinA, cr1, cz1, cr2, cz2, inside);
      }
    }
  }
  ctx.setLineDash([]);

  // Draw circles
  drawCircle3D(probeX, probeY, zBeamSrc, topRadius, 0.5, 1.5);  // entrance aperture

  // Bottom circle: centered on the actual DP visual center to match perspective
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#00ff88";
  ctx.beginPath();
  for (let i = 0; i <= nCirclePts; i++) {
    const ang = (i / nCirclePts) * Math.PI * 2;
    const p = proj(probeX + Math.cos(ang) * bottomRadius, probeY + Math.sin(ang) * bottomRadius, zDP, view);
    // Offset to align with DP visual center
    const nominalCenter = proj(probeX, probeY, zDP, view);
    const ox = dpCenterSx - nominalCenter.sx;
    const oy = dpCenterSy - nominalCenter.sy;
    if (i === 0) ctx.moveTo(p.sx + ox, p.sy + oy); else ctx.lineTo(p.sx + ox, p.sy + oy);
  }
  ctx.stroke();

  // Crossover dot
  // Crossover dot: offset like rays to match perspective alignment
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#00ff88";
  const pCross = proj(probeX, probeY, crossZ, view);
  const tCross = Math.max(0, (crossZ - zDP) / (zBeamSrc - zDP));
  ctx.beginPath();
  ctx.arc(pCross.sx + dpOx * (1 - tCross), pCross.sy + dpOy * (1 - tCross), 3, 0, Math.PI*2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

// ============================================================
// Main render function
// ============================================================

function render({ model, el }) {
  const pixelSize = model.get("pixel_size") || 0.2;
  const cellDimX = model.get("cell_dim_x") || 150;
  const cellDimY = model.get("cell_dim_y") || 40;
  const cellDimZ = model.get("cell_dim_z") || 40;
  const aLattice = model.get("a_lattice") || 4.0;
  const sigma = model.get("sigma") || 0.2;
  const lambda = model.get("lambda") || 0.0197;
  const cropSize = model.get("crop_size") || 128;
  const initQMax = model.get("probe_q_max") || 0.15;

  const id = "s4d-" + Math.random().toString(36).slice(2, 8);
  const dpSize = 60; // DP image size in Angstroms (in 3D scene)

  const style = document.createElement("style");
  style.textContent = `
    .${id}-wrap {
      background: #111;
      color: #ccc;
      border-radius: 8px;
      padding: 8px 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      max-width: 100%;
      box-sizing: border-box;
    }
    .${id}-title { font-size: 16px; font-weight: 600; color: #ddd; margin-bottom: 4px; text-align: center; }
    .${id}-main { display: flex; flex-direction: column; gap: 8px; }
    .${id}-bottom-hint { font-size: 11px; color: #555; text-align: center; margin-top: 4px; }
    .${id}-controls { display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px 16px; align-items: flex-end; }
    .${id}-canvas-wrap { min-width: 0; }
    .${id}-canvas { width: 100%; display: block; border-radius: 4px; cursor: crosshair; }
    .${id}-slider-group { flex: 1; min-width: 140px; }
    .${id}-slider-group label { display: block; font-size: 12px; color: #aaa; margin-bottom: 2px; }
    .${id}-slider-group input[type=range] { width: 100%; accent-color: #00cc66; }
    .${id}-slider-val { font-size: 11px; color: #666; margin-top: 1px; }
    .${id}-btn {
      padding: 6px 12px; border: 1px solid #444; background: #222;
      color: #ccc; border-radius: 4px; cursor: pointer; font-size: 13px; text-align: center;
      align-self: center;
    }
    .${id}-btn:hover { background: #333; }
    .${id}-btn.active { background: #1a4d2e; border-color: #00cc66; color: #00ff88; }
    .${id}-hint { font-size: 11px; color: #555; line-height: 1.4; }
    .${id}-loading { color: #888; padding: 40px; text-align: center; }
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${id}-wrap`;
  wrap.innerHTML = `
    <div class="${id}-loading">Generating polycrystalline sample...</div>
    <div class="${id}-main" style="display:none;">
      <div class="${id}-canvas-wrap">
        <div class="${id}-title">4DSTEM Diffraction</div>
        <canvas class="${id}-canvas" id="${id}-scene"></canvas>
        <div class="${id}-bottom-hint">Drag on the 3D view to move the electron probe</div>
      </div>
      <div class="${id}-controls">
        <div class="${id}-slider-group">
          <label>Convergence Semiangle</label>
          <input type="range" id="${id}-qmax" min="0.025" max="1.015" step="0.005" value="${initQMax}">
          <div class="${id}-slider-val" id="${id}-qmax-val"></div>
        </div>
        <div class="${id}-slider-group">
          <label>Defocus (Å)</label>
          <input type="range" id="${id}-defocus" min="-500" max="500" step="5" value="0">
          <div class="${id}-slider-val" id="${id}-defocus-val">0 Å</div>
        </div>
        <div class="${id}-slider-group">
          <label>Display Gamma</label>
          <input type="range" id="${id}-gamma" min="0.1" max="2.0" step="0.05" value="0.25">
          <div class="${id}-slider-val" id="${id}-gamma-val">0.25</div>
        </div>
        <div id="${id}-scan" class="${id}-btn">▶ Scan</div>
      </div>
    </div>
  `;
  el.appendChild(wrap);

  setTimeout(() => {
    const loadingEl = wrap.querySelector(`.${id}-loading`);
    const mainEl = wrap.querySelector(`.${id}-main`);
    const canvas = wrap.querySelector(`#${id}-scene`);
    const qmaxSlider = wrap.querySelector(`#${id}-qmax`);
    const qmaxVal = wrap.querySelector(`#${id}-qmax-val`);
    const defocusSlider = wrap.querySelector(`#${id}-defocus`);
    const defocusVal = wrap.querySelector(`#${id}-defocus-val`);
    const gammaSlider = wrap.querySelector(`#${id}-gamma`);
    const gammaVal = wrap.querySelector(`#${id}-gamma-val`);
    const scanBtn = wrap.querySelector(`#${id}-scan`);

    const W = 960, H = 440;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Offscreen canvases for DP and probe images
    const dpOffscreen = document.createElement("canvas");
    const probeOffscreen = document.createElement("canvas");

    // Generate sample
    const sample = generateSample({ pixelSize, cellDimX, cellDimY, cellDimZ, aLattice, sigma });
    const { potential, imW, imH, atoms } = sample;

    // State
    let probeX = 0, probeY = 0;
    let qMax = initQMax, defocus = 0, gamma = 0.25;
    let probe = computeProbe(cropSize, pixelSize, qMax, defocus, lambda);
    let scanning = false, scanAnimId = null;

    const view = makeView(0, -30, 10.0, W * 0.40, H * 0.43, 100);

    function updateQMaxLabel() {
      const mrad = qMax * lambda * 1000;
      qmaxVal.textContent = `${qMax.toFixed(2)} Å⁻¹ (${mrad.toFixed(1)} mrad)`;
    }

    let probeNeedsRender = true; // flag to re-render probe inset only when sliders change

    function renderAll() {
      if (probeNeedsRender) {
        renderProbeToCanvas(probeOffscreen, cropSize, pixelSize, qMax, defocus, lambda, gamma);
        probeNeedsRender = false;
      }
      const intensity = computeDiffraction(potential, imW, imH, probe.probeRe, probe.probeIm, probeX, probeY, cropSize, pixelSize);
      renderDPtoCanvas(dpOffscreen, intensity, cropSize, gamma);
      renderScene(ctx, W, H, atoms, view, probeX, probeY, qMax, defocus, dpOffscreen, probeOffscreen, dpSize, cropSize, pixelSize, cellDimZ);
    }

    // Drag
    let isDragging = false, rafPending = false;

    function canvasToProbe(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const sx = (clientX - rect.left) / rect.width * W;
      const sy = (clientY - rect.top) / rect.height * H;
      return unproj(sx, sy, view);
    }

    function clampProbe() {
      const hc = cropSize * pixelSize / 2;
      probeX = Math.max(-cellDimX/2+hc, Math.min(cellDimX/2-hc, probeX));
      probeY = Math.max(-cellDimY/2+hc, Math.min(cellDimY/2-hc, probeY));
    }

    function onPointerMove(cx, cy) {
      const pos = canvasToProbe(cx, cy);
      probeX = pos.x; probeY = pos.y;
      clampProbe();
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => { renderAll(); rafPending = false; });
      }
    }

    canvas.addEventListener("mousedown", (e) => { isDragging = true; if(scanning)stopScan(); onPointerMove(e.clientX, e.clientY); });
    document.addEventListener("mousemove", (e) => { if(isDragging) onPointerMove(e.clientX, e.clientY); });
    document.addEventListener("mouseup", () => { isDragging = false; });
    canvas.addEventListener("touchstart", (e) => { isDragging=true; if(scanning)stopScan(); onPointerMove(e.touches[0].clientX,e.touches[0].clientY); e.preventDefault(); }, {passive:false});
    canvas.addEventListener("touchmove", (e) => { if(isDragging){onPointerMove(e.touches[0].clientX,e.touches[0].clientY);e.preventDefault();} }, {passive:false});
    canvas.addEventListener("touchend", () => { isDragging = false; });

    // Sliders
    qmaxSlider.addEventListener("input", () => {
      qMax = parseFloat(qmaxSlider.value); updateQMaxLabel();
      probe = computeProbe(cropSize, pixelSize, qMax, defocus, lambda); probeNeedsRender = true; renderAll();
    });
    defocusSlider.addEventListener("input", () => {
      defocus = parseFloat(defocusSlider.value); defocusVal.textContent = `${defocus} Å`;
      probe = computeProbe(cropSize, pixelSize, qMax, defocus, lambda); probeNeedsRender = true; renderAll();
    });
    gammaSlider.addEventListener("input", () => {
      gamma = parseFloat(gammaSlider.value); gammaVal.textContent = gamma.toFixed(2); probeNeedsRender = true; renderAll();
    });

    // Scan
    function stopScan() {
      scanning = false; if(scanAnimId)cancelAnimationFrame(scanAnimId); scanAnimId=null;
      scanBtn.classList.remove("active"); scanBtn.textContent = "▶ Scan";
    }
    function startScan() {
      scanning = true; scanBtn.classList.add("active"); scanBtn.textContent = "■ Stop";
      const hc = cropSize*pixelSize/2;
      const xMin = -cellDimX/2+hc, xMax = cellDimX/2-hc;
      const period = 6000, startTime = performance.now(), startY = probeY;
      function tick(now) {
        if(!scanning) return;
        const t = ((now-startTime)%period)/period;
        probeX = xMin + (t<0.5 ? t*2 : 2-t*2) * (xMax-xMin);
        probeY = startY;
        renderAll();
        scanAnimId = requestAnimationFrame(tick);
      }
      scanAnimId = requestAnimationFrame(tick);
    }
    scanBtn.addEventListener("click", () => { if(scanning)stopScan(); else startScan(); });

    // Init
    loadingEl.style.display = "none";
    mainEl.style.display = "flex";
    updateQMaxLabel();
    renderAll();
  }, 50);
}

export default { render };
