// materials-block.js — a slowly rotating block of nanocrystalline silicon
// (the tricor look from silicon-order.js: toon-outlined atom spheres + translucent
// tetrahedra). It blooms apart and grows when you hover, then settles back.
// anywidget entry point. Data comes from nanocrystalline-si.json (data_url option).

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
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const src = await resp.text();
      const blobUrl = URL.createObjectURL(new Blob([src], { type: "application/javascript" }));
      THREE = await import(blobUrl);
      globalThis.__three_module_cache = THREE;
      return THREE;
    } catch (e) { errs.push(url.split("/")[2] + ": " + e.message); }
  }
  throw new Error("Could not load Three.js (" + errs.join("; ") + ")");
}

function detectDark() {
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/\d+/g);
    if (m && m.length >= 3) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
  } catch (e) {}
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
const THEME = {
  light: { clear: 0xeef0ec, atom: [0.94, 0.78, 0.63], outline: 0x000000, tet: [0.35, 0.45, 0.95], tetOp: 0.4 },
  dark:  { clear: 0x0c0f14, atom: [0.66, 0.34, 0.30], outline: 0x05070a, tet: [0.55, 0.10, 0.10], tetOp: 0.22 },
};

function render({ model, el }) {
  const opt = (k, d) => { try { const v = model.get(k); return v == null ? d : v; } catch (e) { return d; } };
  const dataUrl = opt("data_url", "https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/widgets/nanocrystalline-si.json");
  const aspect = opt("aspect", "4 / 3");
  const id = "mb_" + Math.random().toString(36).slice(2, 7);

  el.innerHTML = `
    <div class="${id}-stage" style="position:relative; width:100%; aspect-ratio:${aspect};
        overflow:visible; line-height:0; transition:transform .4s ease; transform-origin:center;">
      <canvas style="display:block; width:100%; height:100%;"></canvas>
    </div>`;
  const stage = el.querySelector(`.${id}-stage`);
  const canvas = el.querySelector("canvas");
  let theme = detectDark() ? THEME.dark : THEME.light;

  let hover = false;
  stage.addEventListener("pointerenter", () => { hover = true; stage.style.transform = "scale(1.1)"; stage.style.zIndex = 3; });
  stage.addEventListener("pointerleave", () => { hover = false; stage.style.transform = "scale(1)"; });

  Promise.all([ensureThree(), fetch(dataUrl).then((r) => r.json())])
    .then(([T, data]) => build(T, data))
    .catch((err) => { stage.innerHTML = `<div style="padding:2em;font:13px sans-serif;opacity:.6">3D viewer failed: ${err.message}</div>`; });

  function build(THREE, data) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(new THREE.Color(theme.clear), 1);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.9); d1.position.set(1.2, 1.5, 1.0); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.25); d2.position.set(-1, -0.5, -1); scene.add(d2);

    const camera = new THREE.PerspectiveCamera(16, 1, 0.1, 8000);
    const group = new THREE.Group();
    group.rotation.x = 0.22;
    scene.add(group);

    const n = data.num_atoms;
    const base = new Float32Array(data.positions);
    let maxR = 0;
    for (let i = 0; i < n; i++) { const d = Math.hypot(base[i*3], base[i*3+1], base[i*3+2]); if (d > maxR) maxR = d; }

    const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
    const atomMat = new THREE.MeshPhongMaterial({ color: new THREE.Color(theme.atom[0], theme.atom[1], theme.atom[2]), shininess: 28, specular: 0xcccccc, emissive: 0x2a2a2a });
    const outlineMat = new THREE.MeshBasicMaterial({ color: theme.outline, side: THREE.BackSide });
    const atomMesh = new THREE.InstancedMesh(sphereGeo, atomMat, n); atomMesh.frustumCulled = false;
    const outlineMesh = new THREE.InstancedMesh(sphereGeo, outlineMat, n); outlineMesh.frustumCulled = false;
    const r = data.atom_radius * data.atom_scale, rOut = r + 0.02;
    const dummy = new THREE.Object3D();
    function setAtoms(bloom) {
      const k = 1 + bloom * 0.55; // inflate the lattice outward
      for (let i = 0; i < n; i++) {
        dummy.position.set(base[i*3] * k, base[i*3+1] * k, base[i*3+2] * k);
        dummy.scale.setScalar(r); dummy.updateMatrix(); atomMesh.setMatrixAt(i, dummy.matrix);
        dummy.scale.setScalar(rOut); dummy.updateMatrix(); outlineMesh.setMatrixAt(i, dummy.matrix);
      }
      atomMesh.instanceMatrix.needsUpdate = true; outlineMesh.instanceMatrix.needsUpdate = true;
    }
    setAtoms(0);
    group.add(outlineMesh); group.add(atomMesh);

    // Translucent tetrahedra (fade out as the lattice blooms so the atoms read clearly).
    let tetMesh = null;
    const nT = data.num_tetrahedra || 0;
    if (nT > 0) {
      const tv = new Float32Array(data.tetrahedra_vertices);
      const FACES = [[0,1,2],[0,1,3],[0,2,3],[1,2,3]];
      const facePos = new Float32Array(nT * FACES.length * 9); let fo = 0;
      for (let t = 0; t < nT; t++) {
        const b = t * 12;
        const V = [[tv[b],tv[b+1],tv[b+2]],[tv[b+3],tv[b+4],tv[b+5]],[tv[b+6],tv[b+7],tv[b+8]],[tv[b+9],tv[b+10],tv[b+11]]];
        for (const [a,bb,c] of FACES) {
          facePos[fo++]=V[a][0]; facePos[fo++]=V[a][1]; facePos[fo++]=V[a][2];
          facePos[fo++]=V[bb][0]; facePos[fo++]=V[bb][1]; facePos[fo++]=V[bb][2];
          facePos[fo++]=V[c][0]; facePos[fo++]=V[c][1]; facePos[fo++]=V[c][2];
        }
      }
      const fgeo = new THREE.BufferGeometry();
      fgeo.setAttribute("position", new THREE.BufferAttribute(facePos, 3));
      fgeo.computeVertexNormals();
      const fmat = new THREE.MeshPhongMaterial({ color: new THREE.Color(theme.tet[0], theme.tet[1], theme.tet[2]), shininess: 20, transparent: true, opacity: theme.tetOp, side: THREE.DoubleSide, depthWrite: false });
      tetMesh = new THREE.Mesh(fgeo, fmat); group.add(tetMesh);
    }

    // React to light/dark theme changes: flip the background and the atom/tetra colors.
    function applyTheme() {
      theme = detectDark() ? THEME.dark : THEME.light;
      renderer.setClearColor(new THREE.Color(theme.clear), 1);
      atomMat.color.setRGB(theme.atom[0], theme.atom[1], theme.atom[2]);
      outlineMat.color.set(theme.outline);
      if (tetMesh) tetMesh.material.color.setRGB(theme.tet[0], theme.tet[1], theme.tet[2]);
    }
    const themeObs = new MutationObserver(applyTheme);
    themeObs.observe(document.documentElement, { attributes: true });
    themeObs.observe(document.body, { attributes: true });
    const themeMq = window.matchMedia("(prefers-color-scheme: dark)");
    themeMq.addEventListener("change", applyTheme);

    function resize() {
      const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h;
      const fov = camera.fov * Math.PI / 180;
      camera.position.set(0, 0, (maxR * 1.15) / Math.tan(fov / 2));
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(stage);

    let bloom = 0, scale = 1, raf, lastW = 0, lastH = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      const cw = stage.clientWidth, ch = stage.clientHeight;
      if (cw > 1 && ch > 1 && (cw !== lastW || ch !== lastH)) { lastW = cw; lastH = ch; resize(); }
      const tb = hover ? 1 : 0;
      const nb = bloom + (tb - bloom) * 0.07;
      if (Math.abs(nb - bloom) > 0.0008) {
        bloom = nb; setAtoms(bloom);
        if (tetMesh) tetMesh.material.opacity = theme.tetOp * (1 - bloom);
      }
      const ts = hover ? 1.08 : 1.0; scale += (ts - scale) * 0.08; group.scale.setScalar(scale);
      group.rotation.y += hover ? 0.006 : 0.0035;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); themeObs.disconnect();
      themeMq.removeEventListener("change", applyTheme); renderer.dispose();
    };
  }
}

export default { render };
