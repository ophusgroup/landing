// stem-hover-card.js — simplified STEM instrument schematic widget
// Inspired by the composition in physics03.ipynb:
// objective lens + focused probe + polycrystalline specimen + diffraction plane.
// Pure JS ESM module, no dependencies.

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function ease(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function makeRng(seed) {
  let x = (seed >>> 0) || 1;
  return function random() {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 4294967295) / 4294967295;
  };
}

function rotY(theta, p) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    x: c * p.x + s * p.z,
    y: p.y,
    z: -s * p.x + c * p.z,
  };
}

function rotX(theta, p) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    x: p.x,
    y: c * p.y - s * p.z,
    z: s * p.y + c * p.z,
  };
}

function projectPoint(p, view) {
  return {
    x: view.cx + p.x * view.scale + p.z * view.skewX,
    y: view.cy + p.y * view.scaleY + p.z * view.skewY,
    depth: p.z * 1.7 + p.y * 0.25,
  };
}

function solvePlanePoint(sx, sy, plane) {
  const dx = sx - plane.origin.x;
  const dy = sy - plane.origin.y;
  const det = plane.u.x * plane.v.y - plane.u.y * plane.v.x;
  if (Math.abs(det) < 1e-6) return null;
  const u = (dx * plane.v.y - dy * plane.v.x) / det;
  const v = (dy * plane.u.x - dx * plane.u.y) / det;
  return { u, v };
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawGlow(ctx, x, y, r, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(rgb, alpha));
  g.addColorStop(0.45, rgba(rgb, alpha * 0.25));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function generateStructure(seed) {
  const random = makeRng(seed);
  const colors = [
    [246, 53, 20],
    [36, 197, 255],
    [224, 170, 24],
  ];
  const grains = [
    { xMin: -34, xMax: -7, rotY: -0.14, rotX: 0.03, color: colors[0] },
    { xMin: -10, xMax: 10, rotY: 0.22, rotX: -0.06, color: colors[1] },
    { xMin: 7, xMax: 34, rotY: -0.18, rotX: 0.08, color: colors[2] },
  ];
  const basis = [
    { x: 0.25, y: 0.25, z: 0.25 },
    { x: 0.75, y: 0.75, z: 0.25 },
    { x: 0.75, y: 0.25, z: 0.75 },
    { x: 0.25, y: 0.75, z: 0.75 },
  ];
  const atoms = [];
  const spacing = 2.25;

  for (let g = 0; g < grains.length; g++) {
    const grain = grains[g];
    for (let ix = -12; ix <= 12; ix++) {
      for (let iy = -2; iy <= 2; iy++) {
        for (let iz = -4; iz <= 4; iz++) {
          for (let b = 0; b < basis.length; b++) {
            let p = {
              x: (ix + basis[b].x) * spacing,
              y: (iy + basis[b].y - 0.5) * 2.55,
              z: (iz + basis[b].z - 0.5) * 3.4,
            };
            p = rotY(grain.rotY, p);
            p = rotX(grain.rotX, p);
            p.x += (grain.xMin + grain.xMax) * 0.5;
            p.z += (random() - 0.5) * 0.25;
            if (p.x < grain.xMin || p.x > grain.xMax) continue;
            if (p.y < -4.5 || p.y > 4.5) continue;
            if (p.z < -14 || p.z > 14) continue;
            atoms.push({
              x: p.x,
              y: p.y,
              z: p.z,
              grain: g,
              color: grain.color,
              phase: random() * Math.PI * 2,
              amp: 0.03 + random() * 0.04,
            });
          }
        }
      }
    }
  }

  return {
    atoms,
    grains,
    bounds: {
      xMin: -37,
      xMax: 37,
      yMin: -4.5,
      yMax: 4.5,
      zMin: -14,
      zMax: 14,
    },
  };
}

function makeScanPath(cols, rows, bounds) {
  const path = [];
  for (let r = 0; r < rows; r++) {
    const tz = rows === 1 ? 0.5 : r / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const cc = r % 2 === 0 ? c : cols - 1 - c;
      const tx = cols === 1 ? 0.5 : cc / (cols - 1);
      path.push({
        x: lerp(bounds.xMin + 4, bounds.xMax - 4, tx),
        z: lerp(bounds.zMin + 2.5, bounds.zMax - 2.5, tz),
      });
    }
  }
  return path;
}

function samplePath(path, t) {
  const n = path.length;
  if (!n) return { x: 0, z: 0 };
  const v = ((t % n) + n) % n;
  const i0 = Math.floor(v);
  const i1 = (i0 + 1) % n;
  const u = v - i0;
  return {
    x: lerp(path[i0].x, path[i1].x, u),
    z: lerp(path[i0].z, path[i1].z, u),
  };
}

function computeSignals(atoms, probe, time) {
  const grainWeights = [0, 0, 0];
  let local = 0;
  let streak = 0;

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    const dx = probe.x - atom.x;
    const dz = probe.z - atom.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > 52) continue;
    const w = Math.exp(-d2 / 14);
    grainWeights[atom.grain] += w;
    local += w;
    streak += Math.cos(atom.phase + time * 1.9) * w;
  }

  const total = grainWeights[0] + grainWeights[1] + grainWeights[2] || 1;
  for (let i = 0; i < grainWeights.length; i++) grainWeights[i] /= total;

  const dominant = Math.max(grainWeights[0], grainWeights[1], grainWeights[2]);
  const boundaryMix = 1 - dominant;
  const density = clamp(local / 7.5, 0, 1.2);
  const vibr = streak / (local || 1);

  const bf = clamp(0.86 - density * 0.52 - boundaryMix * 0.12 + vibr * 0.06, 0.12, 1);
  const adf = clamp(0.14 + density * 0.42 + boundaryMix * 0.18 - vibr * 0.05, 0.05, 0.95);
  const haadf = clamp(0.08 + density * 0.36 + boundaryMix * 0.32 + Math.abs(vibr) * 0.05, 0.04, 0.98);

  return { bf, adf, haadf, grainWeights, boundaryMix, density };
}

function drawBeamColumn(ctx, state, view, layout, palette) {
  const topY = -34;
  const bottomY = layout.diffY + 12;
  const top = projectPoint({ x: state.probe.x, y: topY, z: state.probe.z }, view);
  const top2 = projectPoint({ x: state.probe.x, y: layout.sampleTopY - 7.5, z: state.probe.z }, view);
  const mid1 = projectPoint({ x: state.probe.x, y: layout.sampleTopY - 2.4, z: state.probe.z }, view);
  const mid2 = projectPoint({ x: state.probe.x, y: layout.sampleBottomY + 2.1, z: state.probe.z }, view);
  const bot = projectPoint({ x: state.probe.x, y: bottomY, z: state.probe.z }, view);

  const beamRgb = palette.beam;
  const radius = 2.6 + state.live * 1.5;
  ctx.save();
  ctx.strokeStyle = rgba(beamRgb, 0.75);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(bot.x, bot.y);
  ctx.stroke();

  ctx.fillStyle = rgba(beamRgb, 0.12 + state.live * 0.08);
  ctx.beginPath();
  ctx.moveTo(top.x - radius, top.y);
  ctx.lineTo(top.x + radius, top.y);
  ctx.lineTo(top2.x + 9 + state.live * 3, top2.y);
  ctx.lineTo(top2.x - 9 - state.live * 3, top2.y);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(mid2.x - 9 - state.live * 2, mid2.y);
  ctx.lineTo(mid2.x + 9 + state.live * 2, mid2.y);
  ctx.lineTo(bot.x + 13 + state.live * 4, bot.y);
  ctx.lineTo(bot.x - 13 - state.live * 4, bot.y);
  ctx.closePath();
  ctx.fill();

  drawGlow(ctx, mid1.x, mid1.y, 15 + state.live * 8, beamRgb, 0.18 + state.live * 0.1);
  drawGlow(ctx, bot.x, bot.y, 18 + state.live * 6, beamRgb, 0.1 + state.live * 0.08);
  ctx.restore();
}

function drawObjective(ctx, state, view, layout, palette) {
  const p = projectPoint({ x: state.probe.x, y: -39, z: state.probe.z }, view);
  const w = 70 + state.live * 6;
  const h = 20;
  ctx.save();
  const g = ctx.createLinearGradient(p.x, p.y - h, p.x, p.y + h);
  g.addColorStop(0, palette.objectiveTop);
  g.addColorStop(1, palette.objectiveBottom);
  ctx.fillStyle = g;
  roundedRect(ctx, p.x - w * 0.36, p.y - 11, w * 0.72, 22, 10);
  ctx.fill();
  ctx.strokeStyle = rgba(palette.objectiveEdge, 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  roundedRect(ctx, p.x - w * 0.24, p.y + 8, w * 0.48, 16, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = palette.aperture;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 16, 8, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSample(ctx, structure, state, view, layout, palette) {
  const b = structure.bounds;
  const topY = layout.sampleTopY;
  const bottomY = layout.sampleBottomY;
  const top = {
    a: projectPoint({ x: b.xMin, y: topY, z: b.zMin }, view),
    b: projectPoint({ x: b.xMax, y: topY, z: b.zMin }, view),
    c: projectPoint({ x: b.xMax, y: topY, z: b.zMax }, view),
    d: projectPoint({ x: b.xMin, y: topY, z: b.zMax }, view),
  };
  const bot = {
    a: projectPoint({ x: b.xMin, y: bottomY, z: b.zMin }, view),
    b: projectPoint({ x: b.xMax, y: bottomY, z: b.zMin }, view),
    c: projectPoint({ x: b.xMax, y: bottomY, z: b.zMax }, view),
    d: projectPoint({ x: b.xMin, y: bottomY, z: b.zMax }, view),
  };

  ctx.save();
  ctx.fillStyle = palette.sampleFace;
  ctx.strokeStyle = palette.sampleEdge;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(top.d.x, top.d.y);
  ctx.lineTo(top.c.x, top.c.y);
  ctx.lineTo(bot.c.x, bot.c.y);
  ctx.lineTo(bot.d.x, bot.d.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(top.b.x, top.b.y);
  ctx.lineTo(top.c.x, top.c.y);
  ctx.lineTo(bot.c.x, bot.c.y);
  ctx.lineTo(bot.b.x, bot.b.y);
  ctx.closePath();
  ctx.fillStyle = palette.sampleSide;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(top.a.x, top.a.y);
  ctx.lineTo(top.b.x, top.b.y);
  ctx.lineTo(top.c.x, top.c.y);
  ctx.lineTo(top.d.x, top.d.y);
  ctx.closePath();
  ctx.fillStyle = palette.sampleTop;
  ctx.fill();
  ctx.stroke();

  if (state.live > 0.15) {
    ctx.save();
    ctx.strokeStyle = rgba(palette.grid, 0.16 + state.live * 0.16);
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p0 = {
        x: lerp(top.a.x, top.b.x, t),
        y: lerp(top.a.y, top.b.y, t),
      };
      const p1 = {
        x: lerp(top.d.x, top.c.x, t),
        y: lerp(top.d.y, top.c.y, t),
      };
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const p0 = {
        x: lerp(top.a.x, top.d.x, t),
        y: lerp(top.a.y, top.d.y, t),
      };
      const p1 = {
        x: lerp(top.b.x, top.c.x, t),
        y: lerp(top.b.y, top.c.y, t),
      };
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  const plane = {
    origin: { x: top.a.x, y: top.a.y },
    u: { x: top.b.x - top.a.x, y: top.b.y - top.a.y },
    v: { x: top.d.x - top.a.x, y: top.d.y - top.a.y },
  };
  state.samplePlane = plane;
  state.sampleTopQuad = top;

  const atoms = structure.atoms.slice();
  atoms.sort((m, n) => {
    const dm = m.z * 1.5 - m.y * 0.15;
    const dn = n.z * 1.5 - n.y * 0.15;
    return dm - dn;
  });

  ctx.save();
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    const jitter = state.live * atom.amp;
    const p = projectPoint(
      {
        x: atom.x + Math.sin(state.time * 2 + atom.phase) * jitter,
        y: atom.y + Math.cos(state.time * 2.3 + atom.phase * 0.8) * jitter * 0.4,
        z: atom.z + Math.sin(state.time * 1.7 + atom.phase * 1.2) * jitter * 0.6,
      },
      view
    );
    const r = 4.2 - atom.y * 0.04;
    const fill = mix(atom.color, [255, 255, 255], 0.12);
    drawGlow(ctx, p.x, p.y, r * 2.8, atom.color, 0.018 + state.live * 0.012);
    ctx.fillStyle = rgba(fill, 0.98);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(mix(atom.color, [70, 38, 0], 0.45), 0.96);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rgba([255, 255, 255], 0.78);
    ctx.beginPath();
    ctx.arc(p.x - r * 0.28, p.y - r * 0.26, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (state.live > 0.18 && state.scanTrail.length > 1) {
    ctx.save();
    ctx.strokeStyle = rgba(palette.beam, 0.32 + state.live * 0.16);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < state.scanTrail.length; i++) {
      const tp = projectPoint({ x: state.scanTrail[i].x, y: topY - 0.2, z: state.scanTrail[i].z }, view);
      if (i === 0) ctx.moveTo(tp.x, tp.y);
      else ctx.lineTo(tp.x, tp.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawDiffractionPlane(ctx, state, view, layout, palette) {
  const half = 18;
  const y = layout.diffY;
  const quad = {
    a: projectPoint({ x: -half, y, z: -half }, view),
    b: projectPoint({ x: half, y, z: -half }, view),
    c: projectPoint({ x: half, y, z: half }, view),
    d: projectPoint({ x: -half, y, z: half }, view),
  };

  ctx.save();
  ctx.fillStyle = palette.diffPlane;
  ctx.strokeStyle = palette.diffEdge;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(quad.a.x, quad.a.y);
  ctx.lineTo(quad.b.x, quad.b.y);
  ctx.lineTo(quad.c.x, quad.c.y);
  ctx.lineTo(quad.d.x, quad.d.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  function planePoint(px, pz) {
    return projectPoint({ x: px * half, y, z: pz * half }, view);
  }

  function planeRing(rNorm, alpha, width) {
    ctx.save();
    ctx.strokeStyle = rgba([245, 245, 245], alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const p = planePoint(Math.cos(a) * rNorm, Math.sin(a) * rNorm);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  const c0 = planePoint(0, 0);
  drawGlow(ctx, c0.x, c0.y, 22 + state.signals.bf * 16, [255, 255, 255], 0.34);
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.beginPath();
  ctx.arc(c0.x, c0.y, 5 + state.signals.bf * 5, 0, Math.PI * 2);
  ctx.fill();

  planeRing(0.34 + state.signals.adf * 0.05, 0.18, 1.4);
  planeRing(0.58 + state.signals.haadf * 0.06, 0.14, 1.1);

  const spotAngles = [-0.72, 0.12, 0.84];
  for (let g = 0; g < state.signals.grainWeights.length; g++) {
    const weight = state.signals.grainWeights[g];
    if (weight < 0.025) continue;
    const angle0 = spotAngles[g] + Math.sin(state.time * 0.7 + g) * 0.03;
    for (let k = 0; k < 6; k++) {
      const ang = angle0 + (k * Math.PI) / 3;
      const radii = [0.28 + g * 0.04, 0.48 + g * 0.05];
      for (let j = 0; j < radii.length; j++) {
        const p = planePoint(Math.cos(ang) * radii[j], Math.sin(ang) * radii[j]);
        const rr = (j === 0 ? 2.2 : 1.4) + weight * (j === 0 ? 2.0 : 1.2);
        drawGlow(ctx, p.x, p.y, rr * 5.2, [255, 255, 255], 0.12 + weight * 0.2);
        ctx.fillStyle = rgba([246, 246, 246], 0.72 + weight * 0.22);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (state.live > 0.12) {
    ctx.save();
    ctx.strokeStyle = rgba([255, 255, 255], 0.08);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(quad.a.x, quad.a.y);
    ctx.lineTo(quad.c.x, quad.c.y);
    ctx.moveTo(quad.b.x, quad.b.y);
    ctx.lineTo(quad.d.x, quad.d.y);
    ctx.stroke();
    ctx.restore();
  }

  state.diffQuad = quad;
}

function drawLabels(ctx, state, view, layout, palette) {
  ctx.save();
  ctx.font = "600 13px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = palette.label;

  const top = projectPoint({ x: state.probe.x, y: -36, z: state.probe.z }, view);
  const sampleLabel = projectPoint({ x: -33, y: layout.sampleBottomY + 12, z: 12 }, view);
  const diffLabel = projectPoint({ x: 22, y: layout.diffY - 18, z: -18 }, view);
  const probeLabel = projectPoint({ x: state.probe.x - 1.5, y: layout.sampleTopY - 22, z: state.probe.z - 2 }, view);

  ctx.fillText("objective lens", top.x - 50, top.y - 18);
  ctx.fillText("focused probe", probeLabel.x - 34, probeLabel.y);
  ctx.fillText("polycrystalline specimen", sampleLabel.x, sampleLabel.y);
  ctx.fillText("diffraction pattern", diffLabel.x - 8, diffLabel.y);

  ctx.font = "12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = palette.subtle;
  ctx.fillText("scan coils + converged beam", top.x - 58, top.y - 2);
  ctx.fillText("grain contrast from atomic-scale structure", sampleLabel.x, sampleLabel.y + 18);
  ctx.fillText("live scattering response", diffLabel.x - 8, diffLabel.y + 16);
  ctx.restore();
}

function drawStatus(ctx, state, dims, palette) {
  const x = dims.w - 174;
  const y = 20;
  const w = 144;
  const h = 30;
  ctx.save();
  ctx.fillStyle = state.active ? palette.pillActiveBg : palette.pillBg;
  ctx.strokeStyle = state.active ? palette.pillActiveBorder : palette.pillBorder;
  ctx.lineWidth = 1;
  roundedRect(ctx, x, y, w, h, 15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = state.active ? palette.pillActiveFg : palette.pillFg;
  ctx.font = "600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.active ? "RASTER SCAN LIVE" : "HOVER TO SCAN", x + w * 0.5, y + h * 0.53);
  ctx.restore();
}

function drawLegend(ctx, state, dims, palette) {
  const items = [
    { label: "BF", value: state.signals.bf, color: [220, 230, 240] },
    { label: "ADF", value: state.signals.adf, color: [130, 230, 255] },
    { label: "HAADF", value: state.signals.haadf, color: [255, 205, 92] },
  ];
  const x0 = dims.w - 206;
  const y0 = dims.h - 62;
  ctx.save();
  ctx.font = "600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  for (let i = 0; i < items.length; i++) {
    const x = x0 + i * 66;
    ctx.fillStyle = rgba(items[i].color, 0.95);
    ctx.fillText(items[i].label, x, y0);
    ctx.fillStyle = palette.subtle;
    ctx.fillText(`${Math.round(items[i].value * 100)}%`, x + 24, y0);
  }
  ctx.restore();
}

function drawScene(ctx, dims, structure, state, palette) {
  const bg = ctx.createLinearGradient(0, 0, 0, dims.h);
  bg.addColorStop(0, palette.sceneTop);
  bg.addColorStop(1, palette.sceneBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, dims.w, dims.h);

  const liveEase = ease(state.live);
  const view = {
    cx: dims.w * 0.5,
    cy: lerp(dims.h * 0.4, dims.h * 0.375, liveEase),
    scale: lerp(Math.min(dims.w * 0.0082, 7.2), Math.min(dims.w * 0.0091, 8.1), liveEase),
    scaleY: lerp(Math.min(dims.w * 0.0075, 6.6), Math.min(dims.w * 0.0083, 7.4), liveEase),
    skewX: lerp(-5.2, -6.0, liveEase),
    skewY: lerp(-1.95, -2.35, liveEase),
  };
  const layout = {
    sampleTopY: -5.4,
    sampleBottomY: 5.4,
    diffY: lerp(24, 30, liveEase),
  };

  const diffGlowY = projectPoint({ x: 0, y: layout.diffY, z: 0 }, view).y;
  const baseGlow = ctx.createLinearGradient(0, diffGlowY - 80, 0, dims.h);
  baseGlow.addColorStop(0, rgba(palette.floorGlow, 0));
  baseGlow.addColorStop(1, rgba(palette.floorGlow, 0.08 + liveEase * 0.08));
  ctx.fillStyle = baseGlow;
  ctx.fillRect(0, diffGlowY - 80, dims.w, dims.h - diffGlowY + 80);

  drawDiffractionPlane(ctx, state, view, layout, palette);
  drawBeamColumn(ctx, state, view, layout, palette);
  drawSample(ctx, structure, state, view, layout, palette);
  drawObjective(ctx, state, view, layout, palette);
  drawStatus(ctx, state, dims, palette);
  drawLegend(ctx, state, dims, palette);
  if (state.live > 0.18) drawLabels(ctx, state, view, layout, palette);
}

function render({ model, el }) {
  const title = model.get("title") || "Scanning Transmission Electron Microscopy";
  const subtitle =
    model.get("subtitle") ||
    "A focused electron probe scans a specimen and the transmitted scattering is recorded as a live diffraction response.";
  const seed = model.get("seed") || 11;
  const id = "stem-instrument-" + Math.random().toString(36).slice(2, 8);

  el.replaceChildren();

  const style = document.createElement("style");
  style.textContent = `
    .${id}-wrap {
      background: var(--${id}-bg, #0f1216);
      color: var(--${id}-fg, #dfe6ef);
      border: 1px solid var(--${id}-border, #28313a);
      border-radius: 18px;
      padding: 16px;
      box-sizing: border-box;
      width: 100%;
      max-width: 1080px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 10px 34px rgba(0, 0, 0, 0.12);
      transition: transform 260ms ease, box-shadow 260ms ease, border-color 220ms ease, background 220ms ease;
      outline: none;
    }
    .${id}-wrap.is-live {
      transform: translateY(-2px);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
      border-color: var(--${id}-borderlive, #48c59f);
    }
    .${id}-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .${id}-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.15;
      font-weight: 700;
      color: var(--${id}-title, #f5f8fc);
    }
    .${id}-subtitle {
      margin: 6px 0 0 0;
      max-width: 66ch;
      font-size: 13px;
      line-height: 1.45;
      color: var(--${id}-sub, #90a0b2);
    }
    .${id}-hint {
      flex: 0 0 auto;
      align-self: center;
      font-size: 11px;
      color: var(--${id}-sub, #90a0b2);
      text-align: right;
      line-height: 1.35;
    }
    .${id}-viewport {
      position: relative;
      min-height: 290px;
      border-radius: 16px;
      overflow: hidden;
      background: var(--${id}-viewport, #071018);
      border: 1px solid var(--${id}-viewborder, rgba(255,255,255,0.08));
      transition: min-height 360ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 220ms ease;
    }
    .${id}-wrap.is-live .${id}-viewport {
      min-height: 420px;
      border-color: var(--${id}-viewborderlive, rgba(73, 197, 158, 0.25));
    }
    .${id}-canvas {
      display: block;
      width: 100%;
      height: 100%;
      cursor: crosshair;
    }
    .${id}-footer {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      color: var(--${id}-sub, #90a0b2);
      flex-wrap: wrap;
    }
    .${id}-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .${id}-chip {
      padding: 4px 8px;
      border-radius: 999px;
      background: var(--${id}-chipbg, rgba(255,255,255,0.04));
      border: 1px solid var(--${id}-chipborder, rgba(255,255,255,0.08));
      color: var(--${id}-chipfg, #c7d1dc);
    }
    @media (max-width: 760px) {
      .${id}-head {
        flex-direction: column;
        gap: 8px;
      }
      .${id}-hint {
        text-align: left;
      }
      .${id}-viewport,
      .${id}-wrap.is-live .${id}-viewport {
        min-height: 260px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .${id}-wrap,
      .${id}-viewport {
        transition: none;
      }
    }
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${id}-wrap`;
  wrap.tabIndex = 0;
  wrap.innerHTML = `
    <div class="${id}-head">
      <div>
        <div class="${id}-title">${title}</div>
        <p class="${id}-subtitle">${subtitle}</p>
      </div>
      <div class="${id}-hint">Hover to start the scan.<br>Move across the sample to steer the probe.</div>
    </div>
    <div class="${id}-viewport">
      <canvas class="${id}-canvas"></canvas>
    </div>
    <div class="${id}-footer">
      <div>This version mirrors the notebook schematic: lens, probe, specimen, and diffraction plane.</div>
      <div class="${id}-chips">
        <span class="${id}-chip">probe scan</span>
        <span class="${id}-chip">polycrystal</span>
        <span class="${id}-chip">diffraction</span>
      </div>
    </div>
  `;
  el.appendChild(wrap);

  const palettes = {
    dark: {
      bg: "#0f1216",
      fg: "#dfe6ef",
      title: "#f4f8fd",
      sub: "#93a2b3",
      border: "#28313a",
      borderlive: "#48c59f",
      viewport: "#081018",
      viewborder: "rgba(255,255,255,0.08)",
      viewborderlive: "rgba(73,197,158,0.24)",
      chipbg: "rgba(255,255,255,0.04)",
      chipborder: "rgba(255,255,255,0.08)",
      chipfg: "#c8d2dc",
      sceneTop: "#071019",
      sceneBottom: "#060b10",
      sampleTop: "rgba(34, 48, 64, 0.58)",
      sampleFace: "rgba(20, 32, 44, 0.62)",
      sampleSide: "rgba(16, 25, 36, 0.72)",
      sampleEdge: "rgba(174, 214, 255, 0.18)",
      grid: [126, 176, 224],
      objectiveTop: "#39444e",
      objectiveBottom: "#1b222b",
      objectiveEdge: [148, 164, 178],
      aperture: "rgba(10, 10, 12, 0.95)",
      beam: [95, 255, 130],
      diffPlane: "rgba(8, 8, 8, 1)",
      diffEdge: "rgba(180, 210, 255, 0.22)",
      label: "rgba(223, 238, 252, 0.95)",
      subtle: "rgba(154, 173, 192, 0.84)",
      pillBg: "rgba(255,255,255,0.04)",
      pillBorder: "rgba(255,255,255,0.09)",
      pillFg: "rgba(220, 232, 244, 0.9)",
      pillActiveBg: "rgba(72, 197, 159, 0.16)",
      pillActiveBorder: "rgba(94, 233, 187, 0.4)",
      pillActiveFg: "rgba(183, 255, 221, 0.95)",
      floorGlow: [60, 255, 138],
    },
    light: {
      bg: "#f5f7f4",
      fg: "#203042",
      title: "#13202d",
      sub: "#5f6e7d",
      border: "#d3ddd2",
      borderlive: "#66a789",
      viewport: "#fdfefe",
      viewborder: "rgba(19, 33, 45, 0.08)",
      viewborderlive: "rgba(66, 153, 119, 0.24)",
      chipbg: "rgba(255,255,255,0.82)",
      chipborder: "rgba(19, 33, 45, 0.08)",
      chipfg: "#384656",
      sceneTop: "#fdfefe",
      sceneBottom: "#edf2f6",
      sampleTop: "rgba(236, 242, 248, 0.94)",
      sampleFace: "rgba(220, 230, 239, 0.9)",
      sampleSide: "rgba(209, 221, 232, 0.94)",
      sampleEdge: "rgba(90, 116, 143, 0.26)",
      grid: [126, 150, 184],
      objectiveTop: "#d8dde2",
      objectiveBottom: "#adb6bf",
      objectiveEdge: [124, 135, 145],
      aperture: "rgba(32, 34, 38, 0.92)",
      beam: [48, 234, 87],
      diffPlane: "rgba(10, 10, 10, 1)",
      diffEdge: "rgba(68, 84, 102, 0.24)",
      label: "rgba(16, 30, 42, 0.92)",
      subtle: "rgba(71, 86, 102, 0.84)",
      pillBg: "rgba(19, 33, 45, 0.05)",
      pillBorder: "rgba(19, 33, 45, 0.09)",
      pillFg: "rgba(31, 52, 71, 0.85)",
      pillActiveBg: "rgba(72, 197, 159, 0.14)",
      pillActiveBorder: "rgba(66, 153, 119, 0.32)",
      pillActiveFg: "rgba(24, 95, 73, 0.95)",
      floorGlow: [46, 188, 107],
    },
  };

  const structure = generateStructure(seed);
  const scanPath = makeScanPath(10, 5, structure.bounds);
  const viewport = wrap.querySelector(`.${id}-viewport`);
  const canvas = wrap.querySelector(`.${id}-canvas`);
  const ctx = canvas.getContext("2d");
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    active: false,
    live: 0,
    liveTarget: 0,
    time: 0,
    palette: palettes.dark,
    probe: { x: 0, z: 0 },
    pointerTarget: { x: 0, z: 0 },
    pointerInside: false,
    pathPhase: 0,
    scanTrail: [],
    samplePlane: null,
    sampleTopQuad: null,
    diffQuad: null,
    signals: {
      bf: 0.78,
      adf: 0.22,
      haadf: 0.16,
      grainWeights: [0.15, 0.7, 0.15],
      boundaryMix: 0.14,
      density: 0.4,
    },
  };

  function detectDark() {
    try {
      const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
      if (m && m.length >= 3) {
        return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.52;
      }
    } catch (err) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function applyTheme() {
    state.palette = palettes[detectDark() ? "dark" : "light"];
    for (const [k, v] of Object.entries(state.palette)) {
      if (
        k === "sceneTop" ||
        k === "sceneBottom" ||
        k === "sampleTop" ||
        k === "sampleFace" ||
        k === "sampleSide" ||
        k === "sampleEdge" ||
        k === "grid" ||
        k === "objectiveTop" ||
        k === "objectiveBottom" ||
        k === "objectiveEdge" ||
        k === "aperture" ||
        k === "beam" ||
        k === "diffPlane" ||
        k === "diffEdge" ||
        k === "label" ||
        k === "subtle" ||
        k === "floorGlow"
      ) {
        continue;
      }
      wrap.style.setProperty(`--${id}-${k}`, typeof v === "string" ? v : v);
    }
  }

  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true });
  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    if (media.addEventListener) media.addEventListener("change", applyTheme);
    else if (media.addListener) media.addListener(applyTheme);
  }

  let dims = { w: 800, h: 320 };
  function resize() {
    const rect = viewport.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    dims = { w: Math.max(10, rect.width), h: Math.max(10, rect.height) };
    canvas.width = Math.round(dims.w * dpr);
    canvas.height = Math.round(dims.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function screenToSample(event) {
    if (!state.samplePlane) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * dims.w;
    const sy = ((event.clientY - rect.top) / rect.height) * dims.h;
    const uv = solvePlanePoint(sx, sy, state.samplePlane);
    if (!uv) return null;
    const u = clamp(uv.u, 0, 1);
    const v = clamp(uv.v, 0, 1);
    return {
      x: lerp(structure.bounds.xMin, structure.bounds.xMax, u),
      z: lerp(structure.bounds.zMin, structure.bounds.zMax, v),
    };
  }

  function draw() {
    drawScene(ctx, dims, structure, state, state.palette);
  }

  let rafId = null;
  let lastTs = null;
  function frame(ts) {
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    state.time += dt;
    state.live = lerp(state.live, state.liveTarget, reducedMotion ? 0.2 : 0.09);

    if (state.live > 0.48) wrap.classList.add("is-live");
    else if (state.live < 0.44) wrap.classList.remove("is-live");

    const autoSpeed = state.active ? 3.4 : 0.45;
    state.pathPhase += dt * autoSpeed;
    const autoTarget = samplePath(scanPath, state.pathPhase);
    const pointerBlend = state.pointerInside ? 0.86 * state.live : 0;
    const target = {
      x: lerp(autoTarget.x, state.pointerTarget.x, pointerBlend),
      z: lerp(autoTarget.z, state.pointerTarget.z, pointerBlend),
    };
    const follow = reducedMotion ? 0.16 : 0.08 + state.live * 0.08;
    state.probe.x = lerp(state.probe.x, target.x, follow);
    state.probe.z = lerp(state.probe.z, target.z, follow);

    state.signals = computeSignals(structure.atoms, state.probe, state.time);
    state.scanTrail.push({ x: state.probe.x, z: state.probe.z });
    if (state.scanTrail.length > 24) state.scanTrail.shift();

    draw();
    rafId = requestAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);

  wrap.addEventListener("pointerenter", () => {
    state.active = true;
    state.liveTarget = 1;
  });
  wrap.addEventListener("pointerleave", () => {
    state.active = false;
    state.pointerInside = false;
    state.liveTarget = 0;
  });
  wrap.addEventListener("focusin", () => {
    state.active = true;
    state.liveTarget = 1;
  });
  wrap.addEventListener("focusout", () => {
    state.active = false;
    state.pointerInside = false;
    state.liveTarget = 0;
  });

  canvas.addEventListener("pointermove", (event) => {
    const p = screenToSample(event);
    if (!p) return;
    state.pointerInside = true;
    state.pointerTarget = p;
  });
  canvas.addEventListener("pointerdown", (event) => {
    const p = screenToSample(event);
    if (!p) return;
    state.active = true;
    state.liveTarget = 1;
    state.pointerInside = true;
    state.pointerTarget = p;
  });

  resize();
  rafId = requestAnimationFrame(frame);

  el.__stemWidgetCleanup = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    resizeObserver.disconnect();
  };
}

export default { render };
