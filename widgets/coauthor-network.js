// coauthor-network.js — Interactive co-author network visualization
// Force-directed graph with orbital animation, click-to-center

function render({ model, el }) {
  const dataUrl = model.get("data_url") || "https://cdn.jsdelivr.net/gh/ophusgroup/landing@main/data/coauthors.json";
  const accentColor = model.get("accent_color") || "#8C1515";
  const id = "cn-" + Math.random().toString(36).slice(2, 8);

  const style = document.createElement("style");
  style.textContent = `
    .${id}-wrap { background: #0a0a0f; border-radius: 8px; overflow: hidden; position: relative; }
    .${id}-canvas { width: 100%; display: block; cursor: grab; touch-action: none; }
    .${id}-canvas:active { cursor: grabbing; }
    .${id}-info {
      position: absolute; bottom: 12px; left: 12px;
      background: rgba(0,0,0,0.75); color: #ccc; padding: 8px 12px;
      border-radius: 6px; font: 12px -apple-system, sans-serif;
      pointer-events: none; opacity: 0; transition: opacity 0.2s;
    }
    .${id}-info.show { opacity: 1; }
    .${id}-hint {
      position: absolute; top: 8px; right: 12px;
      color: #555; font: 11px -apple-system, sans-serif;
    }
    .${id}-reset {
      position: absolute; top: 8px; left: 12px;
      background: rgba(255,255,255,0.08); color: #888; border: 1px solid #333;
      padding: 4px 10px; border-radius: 4px; font: 11px -apple-system, sans-serif;
      cursor: pointer;
    }
    .${id}-reset:hover { background: rgba(255,255,255,0.15); color: #ccc; }
    .${id}-search {
      position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.6); color: #ccc; border: 1px solid #444;
      padding: 4px 10px; border-radius: 4px; font: 12px -apple-system, sans-serif;
      width: 180px; outline: none;
    }
    .${id}-search:focus { border-color: #666; background: rgba(0,0,0,0.8); }
    .${id}-search::placeholder { color: #666; }
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${id}-wrap`;
  wrap.innerHTML = `
    <canvas class="${id}-canvas" id="${id}-c"></canvas>
    <div class="${id}-info" id="${id}-info"></div>
    <input class="${id}-search" id="${id}-search" type="text" placeholder="Search co-author..." />
    <div class="${id}-hint">Click a name to focus · Scroll to zoom</div>
    <button class="${id}-reset" id="${id}-reset">↩ Reset view</button>
  `;
  el.appendChild(wrap);

  const canvas = wrap.querySelector(`#${id}-c`);
  const infoBox = wrap.querySelector(`#${id}-info`);
  const resetBtn = wrap.querySelector(`#${id}-reset`);
  const searchInput = wrap.querySelector(`#${id}-search`);
  const ctx = canvas.getContext("2d");

  function resize() {
    const w = wrap.clientWidth;
    const h = Math.min(w, 600);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }
  let { w: W, h: H } = resize();

  let camX = 0, camY = 0, camZoom = 1;
  let targetCamX = 0, targetCamY = 0, targetZoom = 1;
  let focusNode = null; // null = Colin (index 0)
  let orbitCenter = 0;  // index of node that others orbit around

  fetch(dataUrl)
    .then(r => r.json())
    .then(data => init(data))
    .catch(e => { ctx.fillStyle = "#888"; ctx.fillText("Failed to load data", 20, 30); });

  function init(data) {
    const { nodes, edges } = data;
    const N = nodes.length;

    // Normalize by second-highest so Ophus doesn't dominate alpha
    const sortedPapers = nodes.map(n => n.colinPapers).sort((a, b) => b - a);
    const maxColinPapers = sortedPapers[1] || sortedPapers[0]; // use 2nd highest
    const maxEdgeWeight = Math.max(...edges.map(e => e.weight));

    // Initialize positions — spread out more
    for (let i = 0; i < N; i++) {
      if (i === 0) {
        nodes[i].x = 0; nodes[i].y = 0;
        nodes[i].vx = 0; nodes[i].vy = 0;
      } else {
        const angle = (i / (N - 1)) * Math.PI * 2 + Math.random() * 0.3;
        const r = 300 + Math.random() * 300;
        nodes[i].x = Math.cos(angle) * r;
        nodes[i].y = Math.sin(angle) * r;
        nodes[i].vx = 0; nodes[i].vy = 0;
      }
      // Size scaling — Ophus is index 0, others capped at 80% his size
      const t = Math.min(nodes[i].colinPapers / maxColinPapers, 1);
      if (i === 0) {
        nodes[i].radius = 22;
        nodes[i].fontSize = 16;
      } else {
        nodes[i].radius = 5 + Math.pow(t, 0.6) * 13;
        nodes[i].fontSize = 8 + Math.pow(t, 0.5) * 7;
      }

      // Last name for labels
      const parts = nodes[i].name.split(" ");
      nodes[i].lastName = parts[parts.length - 1];
    }

    // Build adjacency
    const adj = new Map();
    for (const e of edges) {
      if (!adj.has(e.source)) adj.set(e.source, []);
      if (!adj.has(e.target)) adj.set(e.target, []);
      adj.get(e.source).push(e);
      adj.get(e.target).push(e);
    }

    // Force simulation
    let simAlpha = 1;
    const DECAY = 0.997;
    const REPULSION = 4000;     // stronger repulsion = more spread
    const SPRING = 0.002;
    const SPRING_LEN = 140;     // longer rest length
    const CENTER_PULL = 0.0008;
    const ORBIT_SPEED = 0.00012;

    function simulate() {
      simAlpha *= DECAY;
      if (simAlpha < 0.001) simAlpha = 0.001;

      const cx = nodes[orbitCenter].x;
      const cy = nodes[orbitCenter].y;

      // Repulsion
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d2 = dx * dx + dy * dy + 1;
          const d = Math.sqrt(d2);
          const f = REPULSION * simAlpha / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }

      // Spring attraction
      for (const e of edges) {
        const a = nodes[e.source], b = nodes[e.target];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
        const strength = SPRING * Math.sqrt(e.weight) * simAlpha;
        const targetLen = SPRING_LEN / Math.sqrt(e.weight * 0.3 + 0.5);
        const f = (d - targetLen) * strength;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Pull toward orbit center — co-authors pulled closer by edge weight
      const focusEdges = adj.get(orbitCenter) || [];
      const focusWeights = new Map();
      for (const e of focusEdges) {
        const other = e.source === orbitCenter ? e.target : e.source;
        focusWeights.set(other, e.weight);
      }

      for (let i = 0; i < N; i++) {
        if (i === orbitCenter) continue;
        const dx = nodes[i].x - cx;
        const dy = nodes[i].y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

        const w = focusWeights.get(i);
        if (w !== undefined) {
          // Connected: pull to target distance inversely proportional to weight
          const isFocusedOther = focusNode !== null && focusNode !== 0;
          const baseDist = isFocusedOther ? 350 : 320;
          const targetDist = baseDist / Math.sqrt(w);
          const pullStrength = isFocusedOther ? 0.003 : 0.003 * simAlpha;
          const f = (dist - targetDist) * pullStrength;
          nodes[i].vx -= (dx / dist) * f;
          nodes[i].vy -= (dy / dist) * f;
        } else {
          // Not connected: gentle pull toward orbit center
          nodes[i].vx -= dx * CENTER_PULL * simAlpha;
          nodes[i].vy -= dy * CENTER_PULL * simAlpha;
        }

        // Extra pull for low-connection nodes (initial layout only)
        if (focusNode === null) {
          const nConns = (adj.get(i) || []).length;
          if (nConns < 10) {
            const extraPull = CENTER_PULL * (1 - nConns / 10) * 2 * simAlpha;
            nodes[i].vx -= dx * extraPull;
            nodes[i].vy -= dy * extraPull;
          }
        }
      }

      // Orbital drift around orbit center
      for (let i = 0; i < N; i++) {
        if (i === orbitCenter) continue;
        const dx = nodes[i].x - cx;
        const dy = nodes[i].y - cy;
        const angle = Math.atan2(dy, dx);
        const r = Math.sqrt(dx * dx + dy * dy);
        const speed = ORBIT_SPEED * (1 + 0.5 * Math.sin(i * 1.7));
        nodes[i].vx += -Math.sin(angle) * r * speed;
        nodes[i].vy += Math.cos(angle) * r * speed;
      }

      // Apply velocity
      const damping = 0.85;
      for (let i = 0; i < N; i++) {
        nodes[i].vx *= damping;
        nodes[i].vy *= damping;
        const speed = Math.sqrt(nodes[i].vx ** 2 + nodes[i].vy ** 2);
        if (speed > 5) { nodes[i].vx *= 5 / speed; nodes[i].vy *= 5 / speed; }
        nodes[i].x += nodes[i].vx;
        nodes[i].y += nodes[i].vy;
      }
    }

    function updateCamera() {
      camX += (targetCamX - camX) * 0.06;
      camY += (targetCamY - camY) * 0.06;
      camZoom += (targetZoom - camZoom) * 0.06;
    }

    function worldToScreen(wx, wy) {
      return { sx: (wx - camX) * camZoom + W / 2, sy: (wy - camY) * camZoom + H / 2 };
    }
    function screenToWorld(sx, sy) {
      return { wx: (sx - W / 2) / camZoom + camX, wy: (sy - H / 2) / camZoom + camY };
    }

    function zoomToFitNetwork(nodeIdx) {
      const nodeEdges = adj.get(nodeIdx) || [];
      if (nodeEdges.length === 0) return 2.0;
      const cx = nodes[nodeIdx].x, cy = nodes[nodeIdx].y;
      let maxDist = 0;
      for (const e of nodeEdges) {
        const other = e.source === nodeIdx ? e.target : e.source;
        const dx = nodes[other].x - cx, dy = nodes[other].y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        maxDist = Math.max(maxDist, d);
      }
      // Zoom so the furthest co-author fits in ~80% of the viewport
      const viewSize = Math.min(W, H) * 0.8;
      const zoom = maxDist > 0 ? viewSize / maxDist : 1.5;
      return Math.max(0.4, Math.min(3.0, zoom));
    }

    let hoveredNode = null;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      const grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W * 0.7);
      grad.addColorStop(0, "#0f0f1a");
      grad.addColorStop(1, "#060608");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Draw edges
      for (const e of edges) {
        const a = nodes[e.source], b = nodes[e.target];
        const pa = worldToScreen(a.x, a.y);
        const pb = worldToScreen(b.x, b.y);
        const t = e.weight / maxEdgeWeight;
        // lineWidth set below, not here
        const isHoveredEdge = hoveredNode !== null &&
          (e.source === hoveredNode || e.target === hoveredNode);
        const isCenteredEdge = focusNode !== null &&
          (e.source === focusNode || e.target === focusNode);

        ctx.lineWidth = 1.5 * camZoom;
        if (isHoveredEdge) {
          ctx.strokeStyle = `rgba(200, 70, 70, ${0.4 + t * 0.5})`;
        } else if (isCenteredEdge) {
          ctx.strokeStyle = `rgba(160, 140, 200, ${0.3 + t * 0.5})`;
        } else {
          ctx.strokeStyle = `rgba(80, 80, 130, ${0.03 + t * 0.12})`;
        }
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }

      // Draw nodes (draw large ones last so they're on top)
      const drawOrder = [...Array(N).keys()].sort((a, b) => nodes[a].radius - nodes[b].radius);

      for (const i of drawOrder) {
        const n = nodes[i];
        const p = worldToScreen(n.x, n.y);
        const r = n.radius * camZoom;
        const isHovered = hoveredNode === i;
        const isCentered = focusNode === i;

        const t = Math.min(n.colinPapers / maxColinPapers, 1);

        // Two states only: hovered or normal. Centered node slightly brighter.
        let fillAlpha, labelAlpha, strokeAlpha;
        if (isHovered) {
          fillAlpha = 1.0;
          labelAlpha = 0.95;
          strokeAlpha = 1.0;
        } else if (isCentered) {
          fillAlpha = 0.7;
          labelAlpha = 0.8;
          strokeAlpha = 0.5;
        } else {
          fillAlpha = 0.5;
          labelAlpha = 0.6;
          strokeAlpha = 0.3;
        }

        // Fill color — warm tones scaled by importance
        const rr = Math.round(50 + t * 140);
        const gg = Math.round(20 + t * 30);
        const bb = Math.round(30 + t * 40);

        ctx.globalAlpha = fillAlpha;
        if (isHovered) {
          ctx.fillStyle = accentColor;
        } else {
          ctx.fillStyle = `rgb(${rr}, ${gg}, ${bb})`;
        }
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = strokeAlpha;
        ctx.strokeStyle = isHovered ? "#ff8888" : "rgba(160, 120, 140, 0.5)";
        ctx.lineWidth = isHovered ? 2.5 : 1;
        ctx.stroke();

        // Label — always show last name, full name when hovered/focused
        const fontSize = Math.max(8, n.fontSize * camZoom);
        if (fontSize > 5) {
          ctx.globalAlpha = labelAlpha;
          const bold = isHovered || isCentered;
          ctx.font = `${bold ? "bold " : ""}${fontSize}px -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = "#ffffff";

          const label = n.lastName;
          ctx.fillText(label, p.sx, p.sy + r + fontSize + 3);
        }

        ctx.globalAlpha = 1;
      }
    }

    function hitTest(mx, my) {
      const { wx, wy } = screenToWorld(mx, my);
      let closest = -1, closestDist = Infinity;
      for (let i = 0; i < N; i++) {
        const dx = nodes[i].x - wx, dy = nodes[i].y - wy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const hitR = nodes[i].radius + 10 / camZoom;
        if (d < hitR && d < closestDist) {
          closest = i; closestDist = d;
        }
      }
      return closest;
    }

    // Pointer events (Shadow DOM-safe: pointer capture replaces document-level mouseup)
    let isDragging = false, dragDist = 0, lastMx, lastMy;

    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;

      if (isDragging) {
        const dx = (mx - lastMx) / camZoom, dy = (my - lastMy) / camZoom;
        targetCamX -= dx; targetCamY -= dy;
        dragDist += Math.abs(mx - lastMx) + Math.abs(my - lastMy);
        lastMx = mx; lastMy = my;
        return;
      }

      const hit = hitTest(mx, my);
      hoveredNode = hit;
      canvas.style.cursor = hit >= 0 ? "pointer" : "grab";

      if (hit >= 0) {
        const n = nodes[hit];
        const connections = (adj.get(hit) || []).length;
        infoBox.innerHTML = `<b>${n.name}</b> · ${n.colinPapers} paper${n.colinPapers > 1 ? "s" : ""} · ${connections} co-authors`;
        infoBox.classList.add("show");
      } else {
        infoBox.classList.remove("show");
      }
    });

    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      lastMx = e.clientX - rect.left; lastMy = e.clientY - rect.top;
      isDragging = true; dragDist = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointerup", () => { isDragging = false; });
    canvas.addEventListener("pointercancel", () => { isDragging = false; });

    canvas.addEventListener("click", (e) => {
      if (dragDist > 5) return; // was a drag, not a click
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit >= 0) {
        focusNode = hit;
        orbitCenter = hit;
        targetCamX = nodes[hit].x;
        targetCamY = nodes[hit].y;
        targetZoom = zoomToFitNetwork(hit);
        resetBtn.style.display = "block";
        simAlpha = Math.max(simAlpha, 0.4); // re-energize to reorganize around new center
      }
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      targetZoom = Math.max(0.3, Math.min(6, targetZoom * factor));
    }, { passive: false });

    resetBtn.addEventListener("click", () => {
      targetCamX = nodes[0].x; targetCamY = nodes[0].y; targetZoom = 1;
      focusNode = null;
      orbitCenter = 0;
      simAlpha = Math.max(simAlpha, 0.4);
      searchInput.value = "";
    });

    // Search
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase().trim();
      if (!q) return;
      for (let i = 0; i < N; i++) {
        if (nodes[i].name.toLowerCase().includes(q) || nodes[i].lastName.toLowerCase().includes(q)) {
          focusNode = i;
          orbitCenter = i;
          targetCamX = nodes[i].x;
          targetCamY = nodes[i].y;
          targetZoom = zoomToFitNetwork(i);
          resetBtn.style.display = "block";
          simAlpha = Math.max(simAlpha, 0.4);
          break;
        }
      }
    });
    searchInput.addEventListener("keydown", (e) => {
      e.stopPropagation(); // prevent canvas shortcuts
    });

    const ro = new ResizeObserver(() => { ({ w: W, h: H } = resize()); });
    ro.observe(wrap);

    // Settle layout then slow down
    for (let i = 0; i < 600; i++) simulate();
    simAlpha = 0.015;

    // Center camera on Ophus after settling
    camX = targetCamX = nodes[0].x;
    camY = targetCamY = nodes[0].y;

    function frame() {
      simulate();
      updateCamera();
      // Track orbit center with camera if focused
      if (focusNode !== null) {
        targetCamX = nodes[focusNode].x;
        targetCamY = nodes[focusNode].y;
      }
      draw();
      requestAnimationFrame(frame);
    }
    frame();
  }
}

export default { render };
