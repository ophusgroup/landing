// research-pillars.js — the three research pillars as one unified, full-width row.
// Each column has an interactive panel on top, then a title, description, and links.
// Hovering a column brings its panel to life and lets it grow past the column border.
// Column 1 is the live STEM experiment (stem-experiment.js), column 2 the wave
// propagation widget (comp-experiment.js), column 3 the nanocrystalline-silicon block.

// The sibling STEM + computational widgets are loaded the same way as Three.js below:
// fetch the text and import a Blob URL. This avoids import.meta / relative-import resolution,
// which does not survive the anywidget module loader (the parent module has no usable base URL).
// Tries each base in order and verifies the response is actually JS, not a CDN 404 page (jsDelivr
// returns a plain-text "Couldn't find the requested file" body that otherwise imports as a syntax error).
async function loadSibling(bases, name, cb) {
  const errs = [];
  for (const base of bases) {
    try {
      const resp = await fetch(`${base}/${name}${cb || ""}`);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const text = await resp.text();
      const head = text.slice(0, 200);
      if (/^\s*</.test(head) || /couldn'?t find|not found|404:/i.test(head)) throw new Error("got an error page, not JS");
      const blobUrl = URL.createObjectURL(new Blob([text], { type: "application/javascript" }));
      const mod = await import(blobUrl);
      return mod.default || mod;
    } catch (e) { errs.push((base.split("/")[2] || base) + ": " + e.message); }
  }
  throw new Error("all sources failed (" + errs.join("; ") + ")");
}

let THREE = null;
const THREE_VERSION = "0.170.0";
const THREE_MIRRORS = [
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
  `https://unpkg.com/three@${THREE_VERSION}/build/three.module.js`,
  `https://esm.sh/three@${THREE_VERSION}/build/three.module.js`,
];
async function ensureThree() {
  if (THREE) return THREE;
  if (globalThis.__three_module_cache) return (THREE = globalThis.__three_module_cache);
  const errs = [];
  for (const url of THREE_MIRRORS) {
    try {
      const resp = await fetch(url); if (!resp.ok) throw new Error("HTTP " + resp.status);
      const blobUrl = URL.createObjectURL(new Blob([await resp.text()], { type: "application/javascript" }));
      THREE = await import(blobUrl); globalThis.__three_module_cache = THREE; return THREE;
    } catch (e) { errs.push(url.split("/")[2] + ": " + e.message); }
  }
  throw new Error("Could not load Three.js (" + errs.join("; ") + ")");
}
function detectDark() {
  try {
    const bg = getComputedStyle(document.body).backgroundColor; const m = bg.match(/\d+/g);
    if (m && m.length >= 3) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
  } catch (e) {}
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
const MAT = {
  light: { clear: 0xeef0ec, atom: [0.94, 0.78, 0.63], emissive: 0x2a2a2a, specular: 0xcccccc,
           outline: 0x000000, tet: [0.35, 0.45, 0.95], tetOp: 0.38, edge: 0x1b2444, edgeOp: 0.4 },
  dark:  { clear: 0x0c0f14, atom: [0.56, 0.47, 0.38], emissive: 0x050504, specular: 0x1c1c1c,
           outline: 0x000000, tet: [0.30, 0.50, 0.95], tetOp: 0.12, edge: 0x8fb6ec, edgeOp: 0.5 },
};

const PILLARS = [
  { kind: "stem", img: "card_experiments.jpg",
    title: "Scanning Transmission Electron Microscopy", short: "Electron Microscopy",
    desc: "We develop new STEM measurements using advanced detectors, beam shaping, and programmable acquisition. We record and invert massive electron-scattering datasets to reveal structural, chemical, and other signals beyond conventional imaging.",
    links: [["see the projects", "#scanning-transmission-electron-microscopy"]] },
  { kind: "comp", img: "card_reconstruction.jpg",
    title: "Computational Imaging and Open Software", short: "Computational Imaging",
    desc: "We build reconstruction algorithms, simulations, and open-source software for quantitative microscopy. Our methods include ptychography, tomography, and physics-guided machine learning to convert raw high-dimensional data into interpretable structure.",
    links: [["see the projects", "#computational-imaging-and-open-software"]] },
  { kind: "materials",
    title: "Characterizing Materials on the Atomic Scale", short: "Materials Structure",
    desc: "We study how atomic structure controls material behavior. Our work maps strain, defects, interfaces, chemical and structural order/disorder, local symmetry, and evolving atomic environments across energy, electronic, quantum, and structural materials.",
    links: [["see the projects", "#characterizing-materials-on-the-atomic-scale"]] },
];

function render({ model, el }) {
  const opt = (k, d) => { try { const v = model.get(k); return v == null ? d : v; } catch (e) { return d; } };
  const dataUrl = opt("data_url", "https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/nanocrystalline-si.json");
  const imageBase = opt("image_base", "https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/images/research");
  const widgetBases = [
    opt("widget_base", "https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets"),
    "https://raw.githubusercontent.com/ophusgroup/landing/main/widgets", // fallback if jsDelivr is stale/404
  ];
  const widgetCb = opt("widget_cb", ""); // local-preview cache-buster, e.g. "?t=123"; empty in production
  const accent = opt("accent", "#8C1515");
  const bare = opt("bare", false); // widgets only, no title/desc/links (used at the top of the landing page)
  const researchUrl = opt("research_url", "/research"); // bare panels link here on click
  const id = "rp_" + Math.random().toString(36).slice(2, 7);

  el.innerHTML = `
    <style>
      .${id}-row { display:flex; align-items:stretch; gap:0; width:100%; overflow:visible;
        margin:0.5rem 0 1rem; font-family:inherit; }
      .${id}-col { flex:1 1 0; min-width:0; position:relative; display:flex; flex-direction:column;
        padding:0 1.1rem 1rem; border-left:1px solid var(--${id}-rule); transition:z-index 0s; }
      .${id}-col:first-child { border-left:0; }
      .${id}-col.hot { z-index:6; }
      .${id}-row.bare { margin:0; }
      .${id}-row.bare .${id}-col { border-left:0; padding:0 0.4rem; }
      .${id}-panel { position:relative; width:100%; aspect-ratio:1/1; overflow:visible; line-height:0;
        border-radius:10px; background:transparent; }
      .${id}-panel canvas { display:block; width:100%; height:100%; border-radius:10px; }
      .${id}-widget { position:absolute; inset:0; }
      .${id}-img { width:100%; height:100%; object-fit:cover; display:block; border-radius:10px; }
      .${id}-title { font-size:.9rem; font-weight:600; line-height:1.25; margin:.85rem 0 .15rem;
        color:var(--${id}-fg); }
      .${id}-bar { width:0; height:2px; background:${accent}; transition:width .3s ease; margin-bottom:.5rem; }
      .${id}-col.hot .${id}-bar { width:34px; }
      .${id}-desc { font-size:.86rem; line-height:1.5; color:var(--${id}-dim); margin:0 0 .6rem; flex:1 0 auto; }
      .${id}-links { font-size:.82rem; line-height:1.7; color:var(--${id}-faint); }
      .${id}-links a { color:var(--${id}-link); text-decoration:none; }
      .${id}-links a:hover { text-decoration:underline; }
      .${id}-btitle { font-size:.95rem; font-weight:600; line-height:1.3; text-align:center; margin:.6rem 0 .15rem; color:var(--${id}-fg); }
      .${id}-row.bare .${id}-links { text-align:center; }
      @media (max-width:640px){ .${id}-row{ flex-direction:column; } .${id}-col{ border-left:0; padding:0 0 1.2rem; } }
      @media (prefers-reduced-motion: reduce){ .${id}-panel{ transition:none; } }
    </style>
    <div class="${id}-row${bare ? " bare" : ""}">
      ${PILLARS.map((p) => `
        <div class="${id}-col" data-kind="${p.kind}">
          <div class="${id}-panel">${p.kind === "materials" ? `<canvas></canvas>` : `<div class="${id}-widget" data-widget="${p.kind}"></div>`}</div>
          ${bare ? `<div class="${id}-btitle">${p.short}</div>
          <div class="${id}-links">${p.links.map(([t, h]) => `<a href="${researchUrl}${h}">${t}</a>`).join(" · ")}</div>` : `<div class="${id}-title">${p.title}</div>
          <div class="${id}-bar"></div>
          <div class="${id}-desc">${p.desc}</div>
          <div class="${id}-links">${p.links.map(([t, h]) => `<a href="${h}">${t}</a>`).join(" · ")}</div>`}
        </div>`).join("")}
    </div>`;

  const root = el.querySelector(`.${id}-row`);
  function applyChrome() {
    const dark = detectDark();
    const v = (k, val) => root.style.setProperty(`--${id}-${k}`, val);
    v("rule", dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)");
    v("panelbg", dark ? "#0c0f14" : "#eef0ec");
    v("fg", dark ? "#e6e9ee" : "#1a1a1a");
    v("dim", dark ? "#aab2bd" : "#4b5563");
    v("faint", dark ? "#7b8593" : "#9aa3ad");
    v("link", dark ? "#E8A0A0" : accent);
  }
  applyChrome();
  const chromeObs = new MutationObserver(() => requestAnimationFrame(applyChrome));
  chromeObs.observe(document.documentElement, { attributes: true });
  chromeObs.observe(document.body, { attributes: true });

  // Per-column hover: grow + raise the panel (the spill), and drive the 3D bloom.
  const cols = [...el.querySelectorAll(`.${id}-col`)];
  const hover = { materials: { value: false } };
  cols.forEach((col, i) => {
    col.addEventListener("pointerenter", () => { col.classList.add("hot"); if (col.dataset.kind === "materials") hover.materials.value = true; });
    col.addEventListener("pointerleave", () => { col.classList.remove("hot"); if (col.dataset.kind === "materials") hover.materials.value = false; });
    if (bare) { col.style.cursor = "pointer"; const dest = researchUrl + ((PILLARS[i] && PILLARS[i].links[0]) ? PILLARS[i].links[0][1] : ""); col.addEventListener("click", () => { window.location.href = dest; }); }
  });

  // Mount the STEM experiment (col 1) and the wave-propagation widget (col 2).
  const mk = (o) => ({ get: (k) => o[k] });
  const fail = (mount, label) => (e) => { if (mount) mount.innerHTML = `<div style="padding:1em;font:11px sans-serif;opacity:.55">${label}: ${e.message}</div>`; };
  const stemMount = el.querySelector(`.${id}-widget[data-widget="stem"]`);
  if (stemMount) loadSibling(widgetBases, "stem-experiment.js", widgetCb)
    .then((w) => w.render({ model: mk({ embed: true,
      pixel_size: 0.4, cell_dim_x: 120, cell_dim_y: 56, cell_dim_z: 3, a_lattice: 3.2, sigma: 0.22,
      lambda: 0.0197, crop_size: 128, display_gamma: 0.7, cbed_g0: 23, cbed_disk_frac: 0.78,
      cbed_chi: 0.026, cbed_g_max: 42, cbed_sigma_g: 40, cbed_phase_scale: 0.04, dp_size: 40,
      view_el: -26, view_zoom: 26 }), el: stemMount }))
    .catch(fail(stemMount, "STEM widget"));
  const compMount = el.querySelector(`.${id}-widget[data-widget="comp"]`);
  if (compMount) loadSibling(widgetBases, "comp-experiment.js", widgetCb)
    .then((w) => w.render({ model: mk({}), el: compMount }))
    .catch(fail(compMount, "wave widget"));

  // Mount the live silicon block into column 3.
  const matCanvas = el.querySelector(`.${id}-col[data-kind="materials"] canvas`);
  const matStage = el.querySelector(`.${id}-col[data-kind="materials"] .${id}-panel`);
  ensureThree()
    .then((T) => fetch(dataUrl).then((r) => r.json()).then((data) => buildMaterials(T, data, matCanvas, matStage, hover.materials)))
    .catch((err) => { if (matStage) matStage.innerHTML = `<div style="padding:1.5em;font:12px sans-serif;opacity:.6">3D failed: ${err.message}</div>`; });
}

function buildMaterials(THREE, data, canvas, stage, hoverRef) {
  let theme = detectDark() ? MAT.dark : MAT.light;
  const mobile = window.innerWidth < 820 || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches); // lighter GPU load on phones/tablets
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, canvas, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.4 : 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(1.2, 1.5, 1.0); scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.25); d2.position.set(-1, -0.5, -1); scene.add(d2);
  const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 8000);
  const group = new THREE.Group(); group.rotation.x = 0.22; scene.add(group);

  const n = data.num_atoms;
  const base = new Float32Array(data.positions);
  let maxR = 0;
  for (let i = 0; i < n; i++) { const d = Math.hypot(base[i*3], base[i*3+1], base[i*3+2]); if (d > maxR) maxR = d; }

  const sphereGeo = new THREE.SphereGeometry(1, mobile ? 10 : 16, mobile ? 8 : 12);
  const atomMat = new THREE.MeshPhongMaterial({ color: new THREE.Color(theme.atom[0], theme.atom[1], theme.atom[2]), shininess: 28, specular: theme.specular, emissive: theme.emissive });
  const outlineMat = new THREE.MeshBasicMaterial({ color: theme.outline, side: THREE.BackSide });
  const atomMesh = new THREE.InstancedMesh(sphereGeo, atomMat, n); atomMesh.frustumCulled = false;
  const outlineMesh = new THREE.InstancedMesh(sphereGeo, outlineMat, n); outlineMesh.frustumCulled = false;
  const r = data.atom_radius * data.atom_scale, rOut = r + 0.02;
  const dummy = new THREE.Object3D();
  function setAtoms(bloom) {
    const k = 1 + bloom * 0.45;
    for (let i = 0; i < n; i++) {
      dummy.position.set(base[i*3]*k, base[i*3+1]*k, base[i*3+2]*k);
      dummy.scale.setScalar(r); dummy.updateMatrix(); atomMesh.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(rOut); dummy.updateMatrix(); outlineMesh.setMatrixAt(i, dummy.matrix);
    }
    atomMesh.instanceMatrix.needsUpdate = true; outlineMesh.instanceMatrix.needsUpdate = true;
  }
  setAtoms(0); group.add(outlineMesh); group.add(atomMesh);

  let tetMesh = null, edgeMesh = null;
  const nT = data.num_tetrahedra || 0;
  if (nT > 0) {
    const tv = new Float32Array(data.tetrahedra_vertices);
    const FACES = [[0,1,2],[0,1,3],[0,2,3],[1,2,3]], EDGES = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const facePos = new Float32Array(nT * FACES.length * 9), edgePos = new Float32Array(nT * EDGES.length * 6);
    let fo = 0, eo = 0;
    for (let t = 0; t < nT; t++) {
      const b = t * 12;
      const V = [[tv[b],tv[b+1],tv[b+2]],[tv[b+3],tv[b+4],tv[b+5]],[tv[b+6],tv[b+7],tv[b+8]],[tv[b+9],tv[b+10],tv[b+11]]];
      for (const [a,bb,c] of FACES) { facePos[fo++]=V[a][0];facePos[fo++]=V[a][1];facePos[fo++]=V[a][2];facePos[fo++]=V[bb][0];facePos[fo++]=V[bb][1];facePos[fo++]=V[bb][2];facePos[fo++]=V[c][0];facePos[fo++]=V[c][1];facePos[fo++]=V[c][2]; }
      for (const [a,bb] of EDGES) { edgePos[eo++]=V[a][0];edgePos[eo++]=V[a][1];edgePos[eo++]=V[a][2];edgePos[eo++]=V[bb][0];edgePos[eo++]=V[bb][1];edgePos[eo++]=V[bb][2]; }
    }
    const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute("position", new THREE.BufferAttribute(facePos, 3)); fgeo.computeVertexNormals();
    tetMesh = new THREE.Mesh(fgeo, new THREE.MeshPhongMaterial({ color: new THREE.Color(theme.tet[0], theme.tet[1], theme.tet[2]), shininess: 20, transparent: true, opacity: theme.tetOp, side: THREE.DoubleSide, depthWrite: false })); group.add(tetMesh);
    const egeo = new THREE.BufferGeometry(); egeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
    edgeMesh = new THREE.LineSegments(egeo, new THREE.LineBasicMaterial({ color: new THREE.Color(theme.edge), transparent: true, opacity: theme.edgeOp, depthWrite: false })); group.add(edgeMesh);
  }

  function applyTheme() {
    requestAnimationFrame(() => {
      theme = detectDark() ? MAT.dark : MAT.light;
      atomMat.color.setRGB(theme.atom[0], theme.atom[1], theme.atom[2]);
      atomMat.emissive.set(theme.emissive); atomMat.specular.set(theme.specular);
      outlineMat.color.set(theme.outline);
      if (tetMesh) tetMesh.material.color.setRGB(theme.tet[0], theme.tet[1], theme.tet[2]);
      if (edgeMesh) edgeMesh.material.color.set(theme.edge);
    });
  }
  applyTheme();
  const themeObs = new MutationObserver(applyTheme);
  themeObs.observe(document.documentElement, { attributes: true });
  themeObs.observe(document.body, { attributes: true });

  let lastW = 0, lastH = 0, camBaseZ = 0;
  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const fov = camera.fov * Math.PI / 180; camBaseZ = (maxR * 0.9) / Math.tan(fov / 2);
    camera.updateProjectionMatrix();
  }

  // hover only FADES the polyhedra out to reveal the atoms; nothing scales (no bloom, no camera move)
  let fade = 0, lastFrame = -1e9;
  function animate(now) {
    requestAnimationFrame(animate);
    if (mobile && (now || 0) - lastFrame < 33) return; // ~30fps cap on mobile to halve the continuous-render load
    lastFrame = now || 0;
    const cw = stage.clientWidth, ch = stage.clientHeight;
    if (cw > 1 && ch > 1 && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; resize(); }
    const hot = hoverRef.value;
    fade += ((hot ? 1 : 0) - fade) * 0.07;
    if (tetMesh) tetMesh.material.opacity = theme.tetOp * (1 - fade);
    if (edgeMesh) edgeMesh.material.opacity = theme.edgeOp * (1 - fade);
    camera.position.z = camBaseZ; // fixed: the structure never zooms or shrinks
    group.rotation.y += hot ? 0.006 : 0.0035;
    renderer.render(scene, camera);
  }
  animate();
}

export default { render };
