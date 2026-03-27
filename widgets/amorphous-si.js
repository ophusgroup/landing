// amorphous-si.js — Interactive nanocrystalline/amorphous silicon widget
// 3-panel: 3-body diagram | 3D rotatable structure | 2D diffraction
// Pure JS ESM module, no dependencies

// ============================================================
// Seeded PRNG (xoshiro128**)
// ============================================================
function makeRng(seed) {
  let s = [seed >>> 0, (seed * 2654435761) >>> 0, (seed * 2246822519) >>> 0, (seed * 3266489917) >>> 0];
  if (!s[0] && !s[1] && !s[2] && !s[3]) s[0] = 1;
  function next() {
    const r = (((s[1] * 5) << 7) | ((s[1] * 5) >>> 25)) * 9;
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = ((s[3] << 11) | (s[3] >>> 21));
    return (r >>> 0) / 4294967296;
  }
  return { random: next };
}

// ============================================================
// FFT
// ============================================================
function fft1d(re, im, N, inv) {
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  const ang = (inv ? 2 : -2) * Math.PI;
  for (let len = 2; len <= N; len <<= 1) {
    const h = len >> 1, wR = Math.cos(ang / len), wI = Math.sin(ang / len);
    for (let i = 0; i < N; i += len) {
      let cR = 1, cI = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h;
        const tR = cR * re[b] - cI * im[b], tI = cR * im[b] + cI * re[b];
        re[b] = re[a] - tR; im[b] = im[a] - tI;
        re[a] += tR; im[a] += tI;
        const nR = cR * wR - cI * wI; cI = cR * wI + cI * wR; cR = nR;
      }
    }
  }
  if (inv) { for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; } }
}

function fft2d(re, im, N, inv) {
  const tR = new Float64Array(N), tI = new Float64Array(N);
  for (let r = 0; r < N; r++) {
    const o = r * N;
    for (let c = 0; c < N; c++) { tR[c] = re[o + c]; tI[c] = im[o + c]; }
    fft1d(tR, tI, N, inv);
    for (let c = 0; c < N; c++) { re[o + c] = tR[c]; im[o + c] = tI[c]; }
  }
  for (let c = 0; c < N; c++) {
    for (let r = 0; r < N; r++) { tR[r] = re[r * N + c]; tI[r] = im[r * N + c]; }
    fft1d(tR, tI, N, inv);
    for (let r = 0; r < N; r++) { re[r * N + c] = tR[r]; im[r * N + c] = tI[r]; }
  }
}

function fftshift2d(a, N) {
  const h = N >> 1, o = new Float64Array(N * N);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      o[((r + h) % N) * N + ((c + h) % N)] = a[r * N + c];
  return o;
}

// ============================================================
// Colormaps
// ============================================================
const infernoData = [
  [0,0,4],[1,0,5],[1,1,6],[1,1,8],[2,1,10],[2,2,12],[2,2,14],[3,2,16],
  [4,3,18],[4,3,20],[5,4,23],[6,4,25],[7,5,27],[8,5,29],[9,6,31],[10,7,34],
  [11,7,36],[12,8,38],[13,8,41],[14,9,43],[16,9,45],[17,10,48],[18,10,50],
  [20,11,52],[21,11,55],[22,11,57],[24,12,60],[25,12,62],[27,12,65],[28,12,67],
  [30,12,69],[31,12,72],[33,12,74],[35,12,76],[36,12,79],[38,12,81],[40,11,83],
  [41,11,85],[43,11,87],[45,11,89],[47,10,91],[49,10,92],[50,10,94],[52,10,95],
  [54,9,97],[56,9,98],[57,9,99],[59,9,100],[61,9,101],[62,9,102],[64,10,103],
  [66,10,104],[68,10,104],[69,10,105],[71,11,106],[73,11,106],[74,12,107],
  [76,12,107],[77,13,108],[79,13,108],[81,14,108],[82,14,109],[84,15,109],
  [85,15,109],[87,16,110],[89,16,110],[90,17,110],[92,18,110],[93,18,110],
  [95,19,110],[97,19,110],[98,20,110],[100,21,110],[101,21,110],[103,22,110],
  [105,22,110],[106,23,110],[108,24,110],[109,24,110],[111,25,110],[113,25,110],
  [114,26,110],[116,26,110],[117,27,110],[119,28,109],[120,28,109],[122,29,109],
  [124,29,109],[125,30,109],[127,30,108],[128,31,108],[130,32,108],[132,32,107],
  [133,33,107],[135,33,107],[137,34,106],[138,34,106],[140,35,105],[141,35,105],
  [143,36,105],[145,37,104],[146,37,104],[148,38,103],[149,38,103],[151,39,102],
  [153,39,101],[154,40,101],[156,40,100],[158,41,100],[159,42,99],[161,42,98],
  [163,43,97],[164,44,97],[166,44,96],[168,45,95],[169,46,95],[171,46,94],
  [173,47,93],[174,48,92],[176,49,91],[177,49,90],[179,50,90],[181,51,89],
  [182,52,88],[184,53,87],[185,53,86],[187,54,85],[189,55,84],[190,56,83],
  [192,57,82],[193,58,81],[195,59,80],[196,60,79],[198,61,78],[200,62,76],
  [201,63,75],[203,64,74],[204,66,73],[206,67,72],[207,68,70],[209,69,69],
  [210,71,68],[212,72,66],[213,73,65],[214,75,64],[216,76,62],[217,78,61],
  [218,79,60],[220,81,58],[221,82,57],[222,84,56],[224,86,54],[225,87,53],
  [226,89,52],[227,91,51],[228,92,50],[229,94,49],[230,96,48],[232,98,47],
  [233,100,46],[234,102,46],[235,104,45],[236,106,45],[237,108,44],[237,110,44],
  [238,112,44],[239,114,44],[240,116,44],[241,118,44],[241,120,44],[242,122,44],
  [243,124,44],[243,126,45],[244,128,45],[244,131,46],[245,133,46],[245,135,47],
  [246,137,48],[246,139,49],[247,141,49],[247,143,50],[247,145,51],[248,147,52],
  [248,149,53],[248,151,54],[249,153,56],[249,155,57],[249,157,58],[250,159,59],
  [250,161,61],[250,163,62],[250,165,64],[250,167,65],[251,169,67],[251,171,68],
  [251,173,70],[251,175,71],[251,177,73],[251,179,75],[252,181,77],[252,183,78],
  [252,185,80],[252,187,82],[252,189,84],[252,191,86],[252,193,87],[252,195,89],
  [253,197,91],[253,199,93],[253,201,95],[253,203,97],[253,205,99],[253,207,101],
  [253,209,103],[253,210,105],[254,212,107],[254,214,109],[254,216,112],
  [254,218,114],[254,220,116],[254,222,118],[254,224,120],[254,226,123],
  [254,228,125],[255,229,127],[255,231,130],[255,233,132],[255,235,134],
  [255,237,137],[255,239,139],[255,240,142],[255,242,144],[255,244,147],
  [255,246,149],[255,247,152],[255,249,155],[255,251,157],[255,252,160],
  [255,254,163],[253,255,166],[251,255,169],[249,255,172],[247,255,176],
  [245,255,179],[244,255,182],[243,255,186],[241,255,189],[241,255,192],
  [240,255,196],[240,255,199],[240,255,203],[241,255,206],[241,255,210],
  [242,255,213],[243,255,217],[245,255,220],[246,255,224],[248,255,227],
  [250,255,231],[252,255,234],[253,255,237]
];
function infernoColor(t) {
  return infernoData[Math.max(0, Math.min(255, Math.round(t * 255)))];
}

function turboColor(t) {
  t = Math.max(0, Math.min(1, t));
  const r = Math.max(0, Math.min(255, Math.round(34.61 + t * (1172.33 + t * (-10793.56 + t * (33300.12 + t * (-38394.49 + t * 14825.05)))))));
  const g = Math.max(0, Math.min(255, Math.round(23.31 + t * (557.33 + t * (1225.33 + t * (-5765.73 + t * (8642.97 + t * (-4136.93))))))));
  const b = Math.max(0, Math.min(255, Math.round(27.2 + t * (3211.1 + t * (-15327.97 + t * (27814 + t * (-22569.18 + t * 6838.66)))))));
  return [r, g, b];
}

// ============================================================
// Spatial grid for fast neighbor finding
// ============================================================
function buildGrid(atoms, N, cellSize) {
  let maxAbs = 0;
  for (let i = 0; i < N * 3; i++) { const v = Math.abs(atoms[i]); if (v > maxAbs) maxAbs = v; }
  const gH = Math.ceil(maxAbs / cellSize) + 1;
  const gD = 2 * gH + 1;
  const nCells = gD * gD * gD;
  const counts = new Int32Array(nCells);
  const cellOf = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const cx = Math.floor(atoms[i * 3] / cellSize) + gH;
    const cy = Math.floor(atoms[i * 3 + 1] / cellSize) + gH;
    const cz = Math.floor(atoms[i * 3 + 2] / cellSize) + gH;
    cellOf[i] = (cx * gD + cy) * gD + cz;
    counts[cellOf[i]]++;
  }
  const off = new Int32Array(nCells + 1);
  for (let i = 0; i < nCells; i++) off[i + 1] = off[i] + counts[i];
  const sorted = new Int32Array(N);
  const fill = new Int32Array(nCells);
  for (let i = 0; i < N; i++) { const ci = cellOf[i]; sorted[off[ci] + fill[ci]++] = i; }
  return { sorted, off, gD, gH, cellSize };
}

// Count crystalline atoms quickly (no allocations beyond grid)
function countCrystalline(atoms, N, rBond) {
  const g = buildGrid(atoms, N, rBond + 0.1);
  const { sorted, off, gD, gH, cellSize } = g;
  const r2 = rBond * rBond, thresh2 = 0.16;
  let count = 0;
  for (let i = 0; i < N; i++) {
    const xi = atoms[i * 3], yi = atoms[i * 3 + 1], zi = atoms[i * 3 + 2];
    const cx = Math.floor(xi / cellSize) + gH;
    const cy = Math.floor(yi / cellSize) + gH;
    const cz = Math.floor(zi / cellSize) + gH;
    let nn = 0, mx = 0, my = 0, mz = 0, bad = false;
    for (let dx = -1; dx <= 1 && !bad; dx++) {
      const nx = cx + dx; if (nx < 0 || nx >= gD) continue;
      for (let dy = -1; dy <= 1 && !bad; dy++) {
        const ny = cy + dy; if (ny < 0 || ny >= gD) continue;
        for (let dz = -1; dz <= 1 && !bad; dz++) {
          const nz = cz + dz; if (nz < 0 || nz >= gD) continue;
          const ci = (nx * gD + ny) * gD + nz;
          for (let k = off[ci]; k < off[ci + 1]; k++) {
            const j = sorted[k]; if (j === i) continue;
            const ddx = atoms[j * 3] - xi, ddy = atoms[j * 3 + 1] - yi, ddz = atoms[j * 3 + 2] - zi;
            if (ddx * ddx + ddy * ddy + ddz * ddz < r2) {
              nn++; mx += ddx; my += ddy; mz += ddz;
              if (nn > 4) { bad = true; break; }
            }
          }
        }
      }
    }
    if (nn === 4 && !bad) { mx /= 4; my /= 4; mz /= 4; if (mx * mx + my * my + mz * mz < thresh2) count++; }
  }
  return count;
}

// Full bond + crystalline classification using grid
function findBondsGrid(atoms, N, rBond) {
  const g = buildGrid(atoms, N, rBond + 0.1);
  const { sorted, off, gD, gH, cellSize } = g;
  const r2 = rBond * rBond, thresh2 = 0.16;
  const nnList = new Array(N);
  for (let i = 0; i < N; i++) nnList[i] = [];
  for (let i = 0; i < N; i++) {
    const xi = atoms[i * 3], yi = atoms[i * 3 + 1], zi = atoms[i * 3 + 2];
    const cx = Math.floor(xi / cellSize) + gH, cy = Math.floor(yi / cellSize) + gH, cz = Math.floor(zi / cellSize) + gH;
    for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx; if (nx < 0 || nx >= gD) continue;
      for (let dy = -1; dy <= 1; dy++) { const ny = cy + dy; if (ny < 0 || ny >= gD) continue;
        for (let dz = -1; dz <= 1; dz++) { const nz = cz + dz; if (nz < 0 || nz >= gD) continue;
          const ci = (nx * gD + ny) * gD + nz;
          for (let k = off[ci]; k < off[ci + 1]; k++) {
            const j = sorted[k]; if (j <= i) continue;
            const ddx = atoms[j * 3] - xi, ddy = atoms[j * 3 + 1] - yi, ddz = atoms[j * 3 + 2] - zi;
            if (ddx * ddx + ddy * ddy + ddz * ddz < r2) { nnList[i].push(j); nnList[j].push(i); }
          }
        }
      }
    }
  }
  const crystalline = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (nnList[i].length === 4) {
      let mx = 0, my = 0, mz = 0;
      for (const j of nnList[i]) { mx += atoms[j * 3] - atoms[i * 3]; my += atoms[j * 3 + 1] - atoms[i * 3 + 1]; mz += atoms[j * 3 + 2] - atoms[i * 3 + 2]; }
      mx /= 4; my /= 4; mz /= 4;
      if (mx * mx + my * my + mz * mz < thresh2) crystalline[i] = 1;
    }
  }
  const bonds = [];
  for (let i = 0; i < N; i++) for (const j of nnList[i]) if (j > i) bonds.push([i, j, crystalline[i] && crystalline[j] ? 1 : 0]);
  return { bonds, nnList, crystalline };
}

// Wide NN list for 3-body using grid
function buildNNListGrid(atoms, N, rMax) {
  const g = buildGrid(atoms, N, rMax + 0.1);
  const { sorted, off, gD, gH, cellSize } = g;
  const r2 = rMax * rMax, nC = Math.ceil(rMax / cellSize);
  const nnList = new Array(N);
  for (let i = 0; i < N; i++) nnList[i] = [];
  for (let i = 0; i < N; i++) {
    const xi = atoms[i * 3], yi = atoms[i * 3 + 1], zi = atoms[i * 3 + 2];
    const cx = Math.floor(xi / cellSize) + gH, cy = Math.floor(yi / cellSize) + gH, cz = Math.floor(zi / cellSize) + gH;
    for (let dx = -nC; dx <= nC; dx++) { const nx = cx + dx; if (nx < 0 || nx >= gD) continue;
      for (let dy = -nC; dy <= nC; dy++) { const ny = cy + dy; if (ny < 0 || ny >= gD) continue;
        for (let dz = -nC; dz <= nC; dz++) { const nz = cz + dz; if (nz < 0 || nz >= gD) continue;
          const ci = (nx * gD + ny) * gD + nz;
          for (let k = off[ci]; k < off[ci + 1]; k++) {
            const j = sorted[k]; if (j === i) continue;
            const ddx = atoms[j * 3] - xi, ddy = atoms[j * 3 + 1] - yi, ddz = atoms[j * 3 + 2] - zi;
            if (ddx * ddx + ddy * ddy + ddz * ddz < r2) nnList[i].push(j);
          }
        }
      }
    }
  }
  return nnList;
}

// ============================================================
// Structure generation
// ============================================================
function generateCrystalSphere(R, a) {
  const basis = [[0,0,0],[.5,.5,0],[.5,0,.5],[0,.5,.5],[.25,.25,.25],[.75,.75,.25],[.75,.25,.75],[.25,.75,.75]];
  const M = Math.ceil(R / a) + 1, R2 = R * R, atoms = [];
  for (let ix = -M; ix <= M; ix++) for (let iy = -M; iy <= M; iy++) for (let iz = -M; iz <= M; iz++)
    for (const b of basis) { const x = (ix + b[0]) * a, y = (iy + b[1]) * a, z = (iz + b[2]) * a; if (x * x + y * y + z * z <= R2) atoms.push([x, y, z]); }
  return atoms;
}

// Multi-scale disorder: rotation radius decays from maxR to minR asymptotically
function generateDisorderOps(rng, numOps, sphereR, maxRotR, minRotR) {
  const ops = [];
  for (let i = 0; i < numOps; i++) {
    const t = i / numOps;
    const rotR = minRotR + (maxRotR - minRotR) * Math.pow(1 - t, 1.5);
    const maxC = sphereR - rotR * 0.3;
    let cx, cy, cz;
    do { cx = (rng.random() * 2 - 1) * maxC; cy = (rng.random() * 2 - 1) * maxC; cz = (rng.random() * 2 - 1) * maxC; } while (cx * cx + cy * cy + cz * cz > maxC * maxC);
    const th = rng.random() * 2 * Math.PI, ph = Math.acos(2 * rng.random() - 1);
    const ax = Math.sin(ph) * Math.cos(th), ay = Math.sin(ph) * Math.sin(th), az = Math.cos(ph);
    const angle = (rng.random() * 0.8 + 0.2) * Math.PI;
    ops.push({ cx, cy, cz, ax, ay, az, angle, r2: rotR * rotR });
  }
  return ops;
}

function rotatePoint(px, py, pz, ax, ay, az, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), d = px * ax + py * ay + pz * az;
  return [px * c + (ay * pz - az * py) * s + ax * d * (1 - c), py * c + (az * px - ax * pz) * s + ay * d * (1 - c), pz * c + (ax * py - ay * px) * s + az * d * (1 - c)];
}

// Push apart atom pairs closer than minDist (a few iterations of pairwise repulsion)
function relaxMinDist(a, N, minDist, iters) {
  const minD2 = minDist * minDist;
  for (let it = 0; it < iters; it++) {
    const g = buildGrid(a, N, minDist + 0.1);
    const { sorted, off, gD, gH, cellSize } = g;
    for (let i = 0; i < N; i++) {
      const xi = a[i * 3], yi = a[i * 3 + 1], zi = a[i * 3 + 2];
      const cx = Math.floor(xi / cellSize) + gH, cy = Math.floor(yi / cellSize) + gH, cz = Math.floor(zi / cellSize) + gH;
      for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx; if (nx < 0 || nx >= gD) continue;
        for (let dy = -1; dy <= 1; dy++) { const ny = cy + dy; if (ny < 0 || ny >= gD) continue;
          for (let dz = -1; dz <= 1; dz++) { const nz = cz + dz; if (nz < 0 || nz >= gD) continue;
            const ci = (nx * gD + ny) * gD + nz;
            for (let k = off[ci]; k < off[ci + 1]; k++) {
              const j = sorted[k]; if (j <= i) continue;
              const ddx = a[j * 3] - xi, ddy = a[j * 3 + 1] - yi, ddz = a[j * 3 + 2] - zi;
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (d2 < minD2 && d2 > 0.0001) {
                const d = Math.sqrt(d2);
                const push = (minDist - d) * 0.5 / d; // each atom moves half the overlap
                a[i * 3] -= ddx * push; a[i * 3 + 1] -= ddy * push; a[i * 3 + 2] -= ddz * push;
                a[j * 3] += ddx * push; a[j * 3 + 1] += ddy * push; a[j * 3 + 2] += ddz * push;
              }
            }
          }
        }
      }
    }
  }
}

function precomputeStates(crystal, ops, nSteps, minDist) {
  const N = crystal.length, states = new Array(nSteps + 1);
  states[0] = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { states[0][i * 3] = crystal[i][0]; states[0][i * 3 + 1] = crystal[i][1]; states[0][i * 3 + 2] = crystal[i][2]; }
  const opsPS = ops.length / nSteps;
  for (let step = 1; step <= nSteps; step++) {
    states[step] = new Float32Array(states[step - 1]);
    const a = states[step], s0 = Math.floor((step - 1) * opsPS), s1 = Math.floor(step * opsPS);
    for (let oi = s0; oi < s1; oi++) {
      const op = ops[oi];
      for (let i = 0; i < N; i++) {
        const dx = a[i * 3] - op.cx, dy = a[i * 3 + 1] - op.cy, dz = a[i * 3 + 2] - op.cz;
        if (dx * dx + dy * dy + dz * dz <= op.r2) {
          const [rx, ry, rz] = rotatePoint(dx, dy, dz, op.ax, op.ay, op.az, op.angle);
          a[i * 3] = op.cx + rx; a[i * 3 + 1] = op.cy + ry; a[i * 3 + 2] = op.cz + rz;
        }
      }
    }
    // Enforce minimum spacing after each step's rotations
    relaxMinDist(a, N, minDist, 3);
  }
  return states;
}

// Find atoms that are too close and mark the minimum set inactive.
// Uses greedy approach: repeatedly deactivate the atom with most conflicts.
function findActiveAtoms(atoms, N, minDist) {
  const active = new Uint8Array(N);
  active.fill(1);
  const g = buildGrid(atoms, N, minDist + 0.1);
  const { sorted, off, gD, gH, cellSize } = g;
  const minD2 = minDist * minDist;

  // Step 1: find all conflicting pairs, count conflicts per atom
  const conflictCount = new Int32Array(N);
  const pairI = [], pairJ = [];
  for (let i = 0; i < N; i++) {
    const xi = atoms[i * 3], yi = atoms[i * 3 + 1], zi = atoms[i * 3 + 2];
    const cx = Math.floor(xi / cellSize) + gH, cy = Math.floor(yi / cellSize) + gH, cz = Math.floor(zi / cellSize) + gH;
    for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx; if (nx < 0 || nx >= gD) continue;
      for (let dy = -1; dy <= 1; dy++) { const ny = cy + dy; if (ny < 0 || ny >= gD) continue;
        for (let dz = -1; dz <= 1; dz++) { const nz = cz + dz; if (nz < 0 || nz >= gD) continue;
          const ci = (nx * gD + ny) * gD + nz;
          for (let k = off[ci]; k < off[ci + 1]; k++) {
            const j = sorted[k]; if (j <= i) continue;
            const ddx = atoms[j * 3] - xi, ddy = atoms[j * 3 + 1] - yi, ddz = atoms[j * 3 + 2] - zi;
            if (ddx * ddx + ddy * ddy + ddz * ddz < minD2) {
              conflictCount[i]++; conflictCount[j]++;
              pairI.push(i); pairJ.push(j);
            }
          }
        }
      }
    }
  }

  // Step 2: greedily deactivate — for each unresolved pair, remove atom with more conflicts
  // Process pairs sorted by smallest distance first (worst overlaps)
  for (let p = 0; p < pairI.length; p++) {
    const i = pairI[p], j = pairJ[p];
    if (!active[i] || !active[j]) continue; // already resolved by prior deactivation
    // Deactivate the atom with more conflicts (breaks more pairs at once)
    if (conflictCount[i] >= conflictCount[j]) { active[i] = 0; }
    else { active[j] = 0; }
  }
  return active;
}

// ============================================================
// 3-body correlation (central atoms only for performance)
// ============================================================
function compute3Body(atoms, N, nnList, rNNmax, rMax, dr, dtDeg, sphereR, active) {
  const r2NN = rNNmax * rNNmax, dt = dtDeg * Math.PI / 180;
  const thetaBins = Math.ceil(Math.PI / dt), rBins = Math.ceil(rMax / dr) + 1;
  const body3 = new Float64Array(thetaBins * rBins);
  const cR2 = (sphereR * 0.65) * (sphereR * 0.65);
  for (let a0 = 0; a0 < N; a0++) {
    if (active && !active[a0]) continue;
    const x0 = atoms[a0 * 3], y0 = atoms[a0 * 3 + 1], z0 = atoms[a0 * 3 + 2];
    if (x0 * x0 + y0 * y0 + z0 * z0 > cR2) continue;
    for (const a1 of nnList[a0]) {
      if (active && !active[a1]) continue;
      const dx1 = x0 - atoms[a1 * 3], dy1 = y0 - atoms[a1 * 3 + 1], dz1 = z0 - atoms[a1 * 3 + 2];
      const d2_1 = dx1 * dx1 + dy1 * dy1 + dz1 * dz1;
      if (d2_1 > r2NN) continue;
      const inv1 = 1 / Math.sqrt(d2_1);
      for (const a2 of nnList[a0]) {
        if (a2 === a1 || (active && !active[a2])) continue;
        const dx2 = x0 - atoms[a2 * 3], dy2 = y0 - atoms[a2 * 3 + 1], dz2 = z0 - atoms[a2 * 3 + 2];
        const d2 = dx2 * dx2 + dy2 * dy2 + dz2 * dz2, dist = Math.sqrt(d2);
        const ri = Math.round(dist / dr); if (ri >= rBins) continue;
        const cosA = (dx1 * dx2 + dy1 * dy2 + dz1 * dz2) * inv1 / dist;
        body3[Math.min(Math.round(Math.acos(Math.max(-1, Math.min(1, cosA))) / dt), thetaBins - 1) * rBins + ri]++;
      }
    }
  }
  // Normalize per-radius-bin
  for (let ri = 1; ri < rBins; ri++) {
    let s = 0; for (let ti = 0; ti < thetaBins; ti++) s += body3[ti * rBins + ri];
    const ex = s / thetaBins; if (ex > 0) for (let ti = 0; ti < thetaBins; ti++) body3[ti * rBins + ri] /= ex;
  }
  for (let ti = 0; ti < thetaBins; ti++) body3[ti * rBins] = 0;
  // Gaussian smooth
  const sT = 2.0, sR = 1.5, kT = 6, kR = 5;
  const sm = new Float64Array(thetaBins * rBins);
  for (let ti = 0; ti < thetaBins; ti++) for (let ri = 0; ri < rBins; ri++) {
    let s = 0, w = 0;
    for (let dti = -kT; dti <= kT; dti++) { const tii = ti + dti; if (tii < 0 || tii >= thetaBins) continue;
      for (let dri = -kR; dri <= kR; dri++) { const rii = ri + dri; if (rii < 0 || rii >= rBins) continue;
        const ww = Math.exp(-(dti * dti) / (2 * sT * sT) - (dri * dri) / (2 * sR * sR)); s += body3[tii * rBins + rii] * ww; w += ww; } }
    sm[ti * rBins + ri] = w > 0 ? s / w : 0;
  }
  for (let i = 0; i < thetaBins * rBins; i++) body3[i] = sm[i];
  return { body3, thetaBins, rBins };
}

// ============================================================
// Radial distribution function g(r)
// ============================================================
function computeGR(atoms, N, nnList, rMax, dr, sphereR, active) {
  const rBins = Math.ceil(rMax / dr) + 1;
  const hist = new Float64Array(rBins);
  const cR = sphereR * 0.65;
  const cR2 = cR * cR;
  let nCentral = 0;

  for (let i = 0; i < N; i++) {
    if (active && !active[i]) continue;
    const xi = atoms[i * 3], yi = atoms[i * 3 + 1], zi = atoms[i * 3 + 2];
    if (xi * xi + yi * yi + zi * zi > cR2) continue;
    nCentral++;
    for (const j of nnList[i]) {
      if (active && !active[j]) continue;
      const dx = atoms[j * 3] - xi, dy = atoms[j * 3 + 1] - yi, dz = atoms[j * 3 + 2] - zi;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const ri = Math.round(dist / dr);
      if (ri < rBins) hist[ri]++;
    }
  }

  // Normalize: g(r) = hist(r) / (nCentral * 4πr²dr * ρ)
  const rho = 8 / (5.43 * 5.43 * 5.43);
  const gr = new Float64Array(rBins);
  for (let ri = 1; ri < rBins; ri++) {
    const r = ri * dr;
    const shellVol = 4 * Math.PI * r * r * dr;
    const expected = nCentral * shellVol * rho;
    gr[ri] = expected > 0 ? hist[ri] / expected : 0;
  }
  return { gr, rBins, dr };
}

// ============================================================
// Diffraction: fftshift(abs(fft2(probe * potential)))
// ============================================================
function computeDiffraction(atoms, N, fftSize, pixelSize, azimuth, elevation, semiangle, lambda, active) {
  const half = fftSize / 2;
  const ca = Math.cos(azimuth), sa = Math.sin(azimuth), ce = Math.cos(elevation), se = Math.sin(elevation);

  // (a) Projected potential (summed along view direction)
  const potRe = new Float64Array(fftSize * fftSize);
  const sigma = 0.3, sig2 = 2 * sigma * sigma / (pixelSize * pixelSize);
  const drawR = Math.ceil(3 * sigma / pixelSize);
  for (let i = 0; i < N; i++) {
    if (active && !active[i]) continue;
    const x = atoms[i * 3], y = atoms[i * 3 + 1], z = atoms[i * 3 + 2];
    const x1 = x * ca - z * sa, z1 = x * sa + z * ca, y1 = y * ce - z1 * se;
    const ax = x1 / pixelSize + half, ay = y1 / pixelSize + half;
    if (ax < 1 || ax >= fftSize - 1 || ay < 1 || ay >= fftSize - 1) continue;
    const ix0 = Math.max(0, Math.floor(ax - drawR)), ix1 = Math.min(fftSize - 1, Math.ceil(ax + drawR));
    const iy0 = Math.max(0, Math.floor(ay - drawR)), iy1 = Math.min(fftSize - 1, Math.ceil(ay + drawR));
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
      const dx = ix - ax, dy = iy - ay;
      potRe[iy * fftSize + ix] += Math.exp(-(dx * dx + dy * dy) / sig2);
    }
  }
  // Smooth edge mask on potential
  for (let iy = 0; iy < fftSize; iy++) for (let ix = 0; ix < fftSize; ix++) {
    const r = Math.sqrt((ix - half) ** 2 + (iy - half) ** 2) / half;
    if (r > 0.85) potRe[iy * fftSize + ix] *= Math.max(0, 1 - (r - 0.85) / 0.15);
  }

  // (b) Build probe in real space: iFFT of aperture disk
  const aRe = new Float64Array(fftSize * fftSize), aIm = new Float64Array(fftSize * fftSize);
  const semiRad = semiangle * 0.001;
  const qMaxPx = (semiRad / lambda) * fftSize * pixelSize, qMaxPx2 = qMaxPx * qMaxPx;
  for (let iy = 0; iy < fftSize; iy++) for (let ix = 0; ix < fftSize; ix++) {
    const qx = ix < half ? ix : ix - fftSize, qy = iy < half ? iy : iy - fftSize;
    if (qx * qx + qy * qy <= qMaxPx2) aRe[iy * fftSize + ix] = 1;
  }
  fft2d(aRe, aIm, fftSize, true); // iFFT → probe at corner
  const probeC = fftshift2d(aRe, fftSize); // center it

  // (c) exit wave = probe × potential, both centered
  const exitRe = new Float64Array(fftSize * fftSize);
  for (let i = 0; i < fftSize * fftSize; i++) exitRe[i] = probeC[i] * potRe[i];

  // Shift for FFT (center → corner), FFT, intensity
  const eRe = fftshift2d(exitRe, fftSize), eIm = new Float64Array(fftSize * fftSize);
  fft2d(eRe, eIm, fftSize, false);
  const intensity = new Float64Array(fftSize * fftSize);
  for (let i = 0; i < fftSize * fftSize; i++) intensity[i] = eRe[i] * eRe[i] + eIm[i] * eIm[i];
  return fftshift2d(intensity, fftSize);
}

// ============================================================
// 3D projection
// ============================================================
function makeProjection(az, el, dist) {
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  return { project(x, y, z) {
    const x1 = x * ca - z * sa, z1 = x * sa + z * ca, y1 = y * ce - z1 * se, z2 = y * se + z1 * ce;
    const s = dist / (dist - z2); return [x1 * s, y1 * s, z2];
  }};
}

// ============================================================
// Rendering
// ============================================================
function renderBody3ToCanvas(ctx, w, h, b3) {
  const { body3, thetaBins, rBins } = b3;
  const img = ctx.createImageData(w, h); const px = img.data;
  for (let py = 0; py < h; py++) { const ti = Math.floor((1 - py / h) * thetaBins);
    for (let ppx = 0; ppx < w; ppx++) { const ri = Math.floor(ppx / w * rBins);
      const v = Math.max(0, Math.min(1, body3[Math.min(ti, thetaBins - 1) * rBins + ri] / 4.0));
      const [r, g, b] = turboColor(v); const idx = (py * w + ppx) * 4;
      px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = 255; } }
  ctx.putImageData(img, 0, 0);
}

function renderDPToCanvas(ctx, w, h, dp, fftSize, gamma, maxI) {
  const img = ctx.createImageData(w, h); const px = img.data;
  if (maxI <= 0) maxI = 1;
  for (let py = 0; py < h; py++) { const fi = Math.floor(py / h * fftSize);
    for (let ppx = 0; ppx < w; ppx++) { const fj = Math.floor(ppx / w * fftSize);
      const v = Math.pow(Math.min(1, Math.max(0, dp[fi * fftSize + fj] / maxI)), gamma);
      const [r, g, b] = infernoColor(v); const idx = (py * w + ppx) * 4;
      px[idx] = r; px[idx + 1] = g; px[idx + 2] = b; px[idx + 3] = 255; } }
  ctx.putImageData(img, 0, 0);
}

// ============================================================
// Main render (MyST widget entry point)
// ============================================================
function render({ model, el }) {
  const id = 'asi_' + Math.random().toString(36).slice(2, 8);
  const sphereRadius = model?.get?.('sphere_radius') ?? 50;
  const latticeConst = model?.get?.('lattice_constant') ?? 5.43;
  const numRawSteps = 150, totalOps = 2400;
  const maxRotR = 10, minRotR = 4, rBond = 2.8;
  const fftSize = 256, pixelSize = 0.5, seed = 42, lambda = 0.0197;

  el.innerHTML = `
    <style>
      .${id}-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #111; border-radius: 12px; overflow: hidden; color: #ccc; }
      .${id}-wrap { overflow: visible; }
      .${id}-panels { display: flex; gap: 0; width: 100%; }
      .${id}-panel { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 4px 2px; min-width: 0; overflow: hidden; }
      .${id}-panel canvas { border-radius: 6px; cursor: default; image-rendering: pixelated; display: block; width: 100%; height: auto; }
      .${id}-mid { flex: 1.4; }
      .${id}-mid canvas { cursor: grab; }
      .${id}-mid canvas:active { cursor: grabbing; }
      .${id}-label { font-size: 10px; color: #aaa; margin-bottom: 3px; text-align: center; letter-spacing: 0.3px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .${id}-controls { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 8px 12px; background: #222; align-items: center; justify-content: center; border-top: 1px solid #444; }
      .${id}-ctrl { display: flex; align-items: center; gap: 4px; font-size: 11px; }
      .${id}-ctrl input[type="range"] { width: 100px; accent-color: #00cc66; }
      .${id}-ctrl .val { min-width: 50px; text-align: right; font-variant-numeric: tabular-nums; color: #00ff88; font-size: 11px; }
      .${id}-btn { background: #222; border: 1px solid #444; color: #ccc; padding: 3px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; min-width: 64px; text-align: center; }
      .${id}-btn:hover { background: #333; }
      .${id}-btn.active { background: #1a4d2e; border-color: #00cc66; color: #00ff88; }
      .${id}-loading { text-align: center; padding: 40px; color: #888; font-size: 14px; }
      .${id}-main { display: none; }
      @media (max-width: 500px) { .${id}-panels { flex-direction: column; align-items: center; } .${id}-panel canvas { width: 80%; } }
    </style>
    <div class="${id}-wrap">
      <div class="${id}-loading" id="${id}-loading">Generating atomic structures…</div>
      <div class="${id}-main" id="${id}-main">
        <div class="${id}-panels">
          <div class="${id}-panel"><div class="${id}-label">NN 3-Body Angle–Radius</div><canvas id="${id}-body3" width="240" height="160"></canvas><div class="${id}-label" style="margin-top:2px">Pair Distribution g(r)</div><canvas id="${id}-gr" width="240" height="70"></canvas></div>
          <div class="${id}-panel ${id}-mid"><div class="${id}-label">Atomic Structure</div><canvas id="${id}-scene" width="360" height="360"></canvas></div>
          <div class="${id}-panel"><div class="${id}-label">Diffraction Pattern</div><canvas id="${id}-dp" width="240" height="240"></canvas></div>
        </div>
        <div class="${id}-controls">
          <div class="${id}-ctrl"><span>Disorder:</span><input type="range" id="${id}-disorder" min="0" max="100" value="50" step="1"><span class="val" id="${id}-dv">50% cryst</span></div>
          <div class="${id}-ctrl"><span>Semiangle:</span><input type="range" id="${id}-semi" min="0.25" max="10" value="0.5" step="0.25"><span class="val" id="${id}-sv">0.50 mrad</span></div>
          <div class="${id}-ctrl"><span>Gamma:</span><input type="range" id="${id}-gamma" min="0.1" max="3.0" value="0.5" step="0.05"><span class="val" id="${id}-gv">0.50</span></div>
          <div class="${id}-ctrl"><span>DP Max:</span><input type="range" id="${id}-dpmax" min="-3" max="0.15" value="-1" step="0.01"><span class="val" id="${id}-dmv">0.100</span></div>
          <button class="${id}-btn" id="${id}-rb">&#x25B6; Rotate</button>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    const $ = s => document.getElementById(`${id}-${s}`);
    const loadEl = $('loading'), mainEl = $('main');
    const b3C = $('body3'), grC = $('gr'), scC = $('scene'), dpC = $('dp');
    const dSlid = $('disorder'), dVal = $('dv'), sSlid = $('semi'), sVal = $('sv');
    const gSlid = $('gamma'), gVal = $('gv'), dmSlid = $('dpmax'), dmVal = $('dmv'), rBtn = $('rb');
    const b3Ctx = b3C.getContext('2d'), grCtx = grC.getContext('2d'), scCtx = scC.getContext('2d'), dpCtx = dpC.getContext('2d');

    const crystal = generateCrystalSphere(sphereRadius, latticeConst);
    const nAtoms = crystal.length;
    const rng = makeRng(seed);
    const ops = generateDisorderOps(rng, totalOps, sphereRadius, maxRotR, minRotR);
    const minDist = 1.5; // minimum physical spacing in Angstroms
    const states = precomputeStates(crystal, ops, numRawSteps, minDist);

    // Calibrate: crystalline fraction at sampled states → remap for linear slider
    const nc0 = countCrystalline(states[0], nAtoms, rBond);
    const sI = 6; // sample interval
    const cF = new Float64Array(numRawSteps + 1);
    for (let s = 0; s <= numRawSteps; s += sI) cF[s] = countCrystalline(states[s], nAtoms, rBond) / nc0;
    cF[numRawSteps] = countCrystalline(states[numRawSteps], nAtoms, rBond) / nc0;
    for (let s = 0; s <= numRawSteps; s++) if (s % sI !== 0 && s !== numRawSteps) {
      const lo = Math.floor(s / sI) * sI, hi = Math.min(lo + sI, numRawSteps);
      cF[s] = cF[lo] + (cF[hi] - cF[lo]) * ((s - lo) / (hi - lo));
    }
    const remap = new Int32Array(101), remapPct = new Int32Array(101);
    for (let p = 0; p <= 100; p++) {
      const tgt = 1 - p / 100; let best = 0, bestD = 2;
      for (let s = 0; s <= numRawSteps; s++) { const d = Math.abs(cF[s] - tgt); if (d < bestD) { bestD = d; best = s; } }
      remap[p] = best; remapPct[p] = Math.round(cF[best] * 100);
    }

    // Compute vacuum center beam intensity for DP normalization
    // This is |FFT(probe)|^2 at DC — the probe with no sample
    function vacuumPeakIntensity(semiVal) {
      const aRe = new Float64Array(fftSize * fftSize), aIm = new Float64Array(fftSize * fftSize);
      const half = fftSize / 2, sR = semiVal * 0.001;
      const qMP = (sR / lambda) * fftSize * pixelSize, qMP2 = qMP * qMP;
      for (let iy = 0; iy < fftSize; iy++) for (let ix = 0; ix < fftSize; ix++) {
        const qx = ix < half ? ix : ix - fftSize, qy = iy < half ? iy : iy - fftSize;
        if (qx * qx + qy * qy <= qMP2) aRe[iy * fftSize + ix] = 1;
      }
      fft2d(aRe, aIm, fftSize, true); // iFFT
      const pc = fftshift2d(aRe, fftSize);
      // Peak is at center — compute |FFT(probe)|^2 at DC
      // which equals (sum of probe)^2 = (sum of aperture / N^2)^2 * N^2...
      // Simpler: the vacuum DP center beam = |sum of probe|^2
      let sumP = 0;
      for (let i = 0; i < fftSize * fftSize; i++) sumP += pc[i];
      return sumP * sumP;
    }
    let vacuumI = vacuumPeakIntensity(0.5);

    let dLevel = 50, semi = 0.5, gamma = 0.5, dpMaxFrac, az = 0.5, el = 0.3;
    let rotating = false, rotId = null;
    let cBonds = null, cBody3 = null, cGR = null, cDP = null, needFull = true, needDP = true;

    const getA = () => states[remap[dLevel]];
    function runFull() {
      const a = getA();
      cBonds = findBondsGrid(a, nAtoms, rBond);
      const wNN = buildNNListGrid(a, nAtoms, 5.5);
      cBody3 = compute3Body(a, nAtoms, wNN, 2.7, 5.5, 0.1, 2, sphereRadius, null);
      cGR = computeGR(a, nAtoms, wNN, 5.5, 0.1, sphereRadius, null);
      needFull = false;
    }
    function runDP() { cDP = computeDiffraction(getA(), nAtoms, fftSize, pixelSize, az, el, semi, lambda, null); needDP = false; }

    function rBody3() { if (!cBody3) return; const w = b3C.width, h = b3C.height; renderBody3ToCanvas(b3Ctx, w, h, cBody3);
      b3Ctx.fillStyle = '#888'; b3Ctx.font = '9px sans-serif';
      // Angle labels
      b3Ctx.fillText('0°', 2, h - 3); b3Ctx.fillText('180°', 2, 10);
      // 90° mark
      const y90 = Math.round((1 - 90 / 180) * h);
      b3Ctx.strokeStyle = 'rgba(255,255,255,0.3)'; b3Ctx.setLineDash([2, 3]);
      b3Ctx.beginPath(); b3Ctx.moveTo(0, y90); b3Ctx.lineTo(w, y90); b3Ctx.stroke();
      b3Ctx.fillStyle = '#aaa'; b3Ctx.fillText('90°', w - 28, y90 - 2);
      // 109.5° mark
      const tY = Math.round((1 - 109.5 / 180) * h);
      b3Ctx.strokeStyle = 'rgba(255,255,255,0.5)'; b3Ctx.setLineDash([3, 3]);
      b3Ctx.beginPath(); b3Ctx.moveTo(0, tY); b3Ctx.lineTo(w, tY); b3Ctx.stroke();
      b3Ctx.setLineDash([]); b3Ctx.fillStyle = '#fff'; b3Ctx.fillText('109.5°', w - 44, tY - 2);
      }
    function rGR() {
      if (!cGR) return;
      const w = grC.width, h = grC.height, ctx = grCtx;
      const { gr, rBins, dr } = cGR;
      const rMax = 5.5;
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, w, h);
      // Find max g(r) for scaling (cap at 5 for display)
      let gMax = 0;
      for (let ri = 1; ri < rBins; ri++) if (gr[ri] > gMax) gMax = gr[ri];
      gMax = Math.max(2, Math.min(gMax, 8));
      // Draw g(r)=1 reference line
      const y1 = h - (1 / gMax) * (h - 16) - 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(w, y1); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = '#888'; ctx.font = '8px sans-serif';
      ctx.fillText('1', 1, y1 - 2);
      // Draw g(r) curve
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let ri = 1; ri < rBins; ri++) {
        const x = (ri * dr / rMax) * w;
        const y = h - (gr[ri] / gMax) * (h - 16) - 2;
        if (ri === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.lineWidth = 1;
      // Labels
      ctx.fillStyle = '#888'; ctx.font = '8px sans-serif';
      ctx.fillText('g(r)', 2, 10);
      // Radius ticks (shared with 3-body above)
      for (let r = 0; r <= 5; r++) { const px = Math.round(r / rMax * w); ctx.fillText(`${r}`, px + 1, h - 1); }
      ctx.fillText('radius (Å)', w - 50, h - 1);
    }
    function rDP() { if (cDP) renderDPToCanvas(dpCtx, dpC.width, dpC.height, cDP, fftSize, gamma, dpMaxFrac * vacuumI); }

    function rScene() {
      const W = scC.width, H = scC.height, ctx = scCtx, atoms = getA();
      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, W, H);
      const proj = makeProjection(az, el, 200), cx = W / 2, cy = H / 2, sc = Math.min(W, H) / (sphereRadius * 2.56);
      const prjAll = new Array(nAtoms);
      for (let i = 0; i < nAtoms; i++) {
        const [sx, sy, sz] = proj.project(atoms[i * 3], atoms[i * 3 + 1], atoms[i * 3 + 2]);
        prjAll[i] = { i, sx: cx + sx * sc, sy: cy - sy * sc, sz };
      }
      prjAll.sort((a, b) => a.sz - b.sz);
      const nVisible = nAtoms;
      const pI = new Array(nAtoms); for (const p of prjAll) pI[p.i] = p;

      // Probe cone (vertical)
      const pHA = semi * 0.001, pE = sphereRadius * 2, pTR = pE * Math.tan(pHA) * sc * 6;
      const pTY = cy - pE * sc, pBY = cy + pE * sc;
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#00ff88';
      ctx.beginPath(); ctx.moveTo(cx - pTR, pTY); ctx.lineTo(cx, cy); ctx.lineTo(cx + pTR, pTY); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - pTR, pBY); ctx.lineTo(cx + pTR, pBY); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,255,136,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx - pTR, pTY); ctx.lineTo(cx, cy); ctx.moveTo(cx + pTR, pTY); ctx.lineTo(cx, cy);
      ctx.moveTo(cx, cy); ctx.lineTo(cx - pTR, pBY); ctx.moveTo(cx, cy); ctx.lineTo(cx + pTR, pBY); ctx.stroke();

      // Bonds (batched)
      if (cBonds) { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(80,200,255,0.18)'; ctx.beginPath();
        for (const [i, j, cr] of cBonds.bonds) { if (!cr) continue; const a = pI[i], b = pI[j]; ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); } ctx.stroke(); }

      // Atoms in depth bins
      const nB = 5;
      for (let bin = 0; bin < nB; bin++) {
        const lo = Math.floor(bin / nB * nVisible), hi = Math.floor((bin + 1) / nB * nVisible);
        const alpha = 0.15 + 0.55 * (bin / (nB - 1)), r = 0.8 + 0.4 * (bin / (nB - 1));
        if (cBonds) {
          ctx.fillStyle = `rgba(80,200,255,${alpha})`; ctx.beginPath();
          for (let k = lo; k < hi; k++) { const p = prjAll[k]; if (!cBonds.crystalline[p.i]) continue; ctx.moveTo(p.sx + r, p.sy); ctx.arc(p.sx, p.sy, r, 0, 6.2832); } ctx.fill();
          ctx.fillStyle = `rgba(140,140,150,${alpha * 0.4})`; ctx.beginPath();
          for (let k = lo; k < hi; k++) { const p = prjAll[k]; if (cBonds.crystalline[p.i]) continue; ctx.moveTo(p.sx + r * 0.6, p.sy); ctx.arc(p.sx, p.sy, r * 0.6, 0, 6.2832); } ctx.fill();
        }
      }
      ctx.fillStyle = '#555'; ctx.font = '10px sans-serif'; ctx.fillText(`${nAtoms} atoms`, 8, H - 8);
      if (cBonds) { let nc = 0; for (let i = 0; i < nAtoms; i++) if (cBonds.crystalline[i]) nc++; ctx.fillStyle = 'rgba(80,200,255,0.7)'; ctx.fillText(`${nc} crystalline`, 8, H - 20); }
    }

    function renderAll() { if (needFull) runFull(); if (needDP) runDP(); rScene(); rBody3(); rGR(); rDP(); }

    // Drag rotation
    let drag = false, lx = 0, ly = 0, dpTO = null;
    scC.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; scC.setPointerCapture(e.pointerId); });
    scC.addEventListener('pointermove', e => { if (!drag) return; az -= (e.clientX - lx) * 0.01; el += (e.clientY - ly) * 0.01; lx = e.clientX; ly = e.clientY; rScene(); if (dpTO) clearTimeout(dpTO); dpTO = setTimeout(() => { needDP = true; runDP(); rDP(); }, 250); });
    scC.addEventListener('pointerup', () => { drag = false; needDP = true; runDP(); rDP(); });
    scC.addEventListener('touchstart', e => { if (e.touches.length === 1) { drag = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY; } }, { passive: true });
    scC.addEventListener('touchmove', e => { if (!drag || e.touches.length !== 1) return; az -= (e.touches[0].clientX - lx) * 0.01; el += (e.touches[0].clientY - ly) * 0.01; lx = e.touches[0].clientX; ly = e.touches[0].clientY; rScene(); }, { passive: true });
    scC.addEventListener('touchend', () => { drag = false; needDP = true; runDP(); rDP(); }, { passive: true });

    let aTO = null;
    dSlid.addEventListener('input', () => { dLevel = parseInt(dSlid.value); dVal.textContent = `${remapPct[dLevel]}% cryst`; needFull = true; needDP = true;
      if (aTO) clearTimeout(aTO); cBonds = findBondsGrid(getA(), nAtoms, rBond);
      rScene(); aTO = setTimeout(() => renderAll(), 200); });
    // Auto-scale DP max with semiangle using calibration points (log-log interpolation)
    // 0.05 mrad → 0.01, 1.0 mrad → 0.03, 4.0 mrad → 0.5
    const dpCalSemi = [0.05, 1.0, 4.0, 10.0], dpCalMax = [0.01, 0.03, 0.5, 1.1];
    const dpCalLogS = dpCalSemi.map(Math.log10), dpCalLogM = dpCalMax.map(Math.log10);
    function suggestedDPMax(s) {
      const ls = Math.log10(Math.max(0.01, s));
      // Piecewise linear in log-log
      if (ls <= dpCalLogS[0]) return dpCalMax[0];
      if (ls >= dpCalLogS[dpCalLogS.length - 1]) return dpCalMax[dpCalMax.length - 1];
      for (let i = 0; i < dpCalLogS.length - 1; i++) {
        if (ls <= dpCalLogS[i + 1]) {
          const t = (ls - dpCalLogS[i]) / (dpCalLogS[i + 1] - dpCalLogS[i]);
          return Math.pow(10, dpCalLogM[i] + t * (dpCalLogM[i + 1] - dpCalLogM[i]));
        }
      }
      return dpCalMax[dpCalMax.length - 1];
    }
    function updateDPMaxFromSemi() {
      dpMaxFrac = suggestedDPMax(semi);
      const logVal = Math.log10(dpMaxFrac);
      dmSlid.value = logVal;
      dmVal.textContent = dpMaxFrac < 0.01 ? dpMaxFrac.toExponential(1) : dpMaxFrac.toFixed(3);
    }
    sSlid.addEventListener('input', () => { semi = parseFloat(sSlid.value); sVal.textContent = `${semi.toFixed(2)} mrad`; vacuumI = vacuumPeakIntensity(semi); updateDPMaxFromSemi(); rScene(); needDP = true; runDP(); rDP(); });
    gSlid.addEventListener('input', () => { gamma = parseFloat(gSlid.value); gVal.textContent = gamma.toFixed(2); rDP(); });
    dmSlid.addEventListener('input', () => { dpMaxFrac = Math.pow(10, parseFloat(dmSlid.value)); dmVal.textContent = dpMaxFrac < 0.01 ? dpMaxFrac.toExponential(1) : dpMaxFrac.toFixed(3); rDP(); });

    function stopRot() { rotating = false; if (rotId) cancelAnimationFrame(rotId); rotId = null; rBtn.classList.remove('active'); rBtn.innerHTML = '&#x25B6; Rotate'; needDP = true; runDP(); rDP(); }
    function startRot() { rotating = true; rBtn.classList.add('active'); rBtn.innerHTML = '&#x25A0; Stop'; let last = performance.now(), dpT = 0;
      function tick(now) { if (!rotating) return; const dt = (now - last) / 1000; last = now;
        el += dt * 0.4; // rotate around y-axis
        dpT += dt; rScene();
        if (dpT > 0.6) { dpT = 0; needDP = true; runDP(); rDP(); } rotId = requestAnimationFrame(tick); } rotId = requestAnimationFrame(tick); }
    rBtn.addEventListener('click', () => { if (rotating) stopRot(); else startRot(); });

    loadEl.style.display = 'none'; mainEl.style.display = 'block';
    updateDPMaxFromSemi(); // set initial DP max from default semiangle
    renderAll();
  }, 80);
}

export default { render };
