// esteem-logo.js — animated vector recreation of the ESTEEM center logo (MyST anywidget)
//
// Renders a fully scalable SVG: a stylized microchip on the left with circuit
// "wires" feeding in, the ESTEEM wordmark, and the tagline that the acronym
// spells out — Enabling Science for Transformative Energy-Efficient Microelectronics.
//
// Animation (loops ~3.6s): bright pulses travel along the left wires INTO the
// chip, the chip core flashes, then a pulse shoots out the right side and lights
// up the first "E" of ESTEEM. Respects prefers-reduced-motion.
//
// Everything below is parameterized via model.get(...) so colors/sizing/animation
// can be tuned from the directive. Sensible defaults reproduce the logo as-is.

function render({ model, el }) {
  // ---- Parameters (all optional) ---------------------------------------
  const P = (k, d) => {
    const v = model && model.get ? model.get(k) : undefined;
    return v === undefined || v === null || v === "" ? d : v;
  };

  const text = P("text", "ESTEEM");
  const tagline = P(
    "tagline",
    "Enabling Science for Transformative Energy-Efficient Microelectronics"
  );
  const colors = {
    red: P("color_text", "#D62828"), // ESTEEM wordmark
    chip: P("color_chip", "#1F7A6D"), // chip package (teal)
    die: P("color_die", "#2A9D8F"), // inner die (lighter teal)
    gold: P("color_wire", "#D9A328"), // pins + wire base
    pulse: P("color_pulse", "#5EE9FF"), // travelling pulse (electric cyan)
    flash: P("color_flash", "#FFFFFF"), // white-hot flash on the lit-up E
    taglineLight: P("color_tagline", "#274A45"), // tagline on light bg
    taglineDark: P("color_tagline_dark", "#A9CFC9"), // tagline on dark bg
  };
  const animate = P("animate", true) !== false;
  const maxWidth = P("max_width", 720); // px cap on rendered width

  // Unique id prefix so multiple instances / page CSS never collide.
  const id = "esteem-" + Math.random().toString(36).slice(2, 8);

  // ---- Layout constants (SVG user units) -------------------------------
  const VB_W = 820,
    VB_H = 220;
  const CHIP = { x: 96, y: 62, w: 96, h: 96 }; // package box
  const CX = CHIP.x + CHIP.w / 2; // 144 (chip center x)
  const CY = CHIP.y + CHIP.h / 2; // 110 (chip center y)
  const TX = 250; // ESTEEM start x
  const BASE = 144; // ESTEEM baseline y
  const TAG_BASE = 178; // tagline baseline y

  // Left pin centers (the wires plug into these), right pins, top/bottom pins.
  const leftPinsY = [82, 104, 126, 148];
  const rightPinsY = [86, 110, 134];
  const topPinsX = [112, 132, 152, 172];
  const botPinsX = topPinsX;

  // ---- Small SVG builders ----------------------------------------------
  const NS = "http://www.w3.org/2000/svg";
  const elem = (name, attrs = {}, kids = []) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    for (const c of kids) n.appendChild(c);
    return n;
  };

  // Pins as little rounded rects. Horizontal pins (left/right) are wide; the
  // vertical pins (top/bottom) are tall.
  function pin(cx, cy, horizontal) {
    const w = horizontal ? 12 : 7;
    const h = horizontal ? 7 : 12;
    return elem("rect", {
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      rx: 2,
      fill: colors.gold,
    });
  }

  // ---- Build the SVG ----------------------------------------------------
  const svg = elem("svg", {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    width: "100%",
    role: "img",
    "aria-label": `${text} — ${tagline}`,
    class: `${id}-svg`,
  });

  // defs: glow filter + die gradient
  const defs = elem("defs");
  defs.innerHTML = `
    <filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${id}-glow-strong" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="7"/>
    </filter>
    <radialGradient id="${id}-die" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="${colors.die}"/>
      <stop offset="100%" stop-color="${colors.chip}"/>
    </radialGradient>`;
  svg.appendChild(defs);

  // --- Wires feeding the chip (animated). Each has a dim base + bright pulse.
  // pathLength="100" normalizes every path so the dash math is identical.
  const inboundWires = [
    "M0,72 H36 L56,82 H92", // top wire jogs down into pin 1
    "M0,104 H92", // straight into pin 2
    "M0,126 H92", // straight into pin 3
    "M0,158 H38 L58,148 H92", // bottom wire jogs up into pin 4
  ];
  // Outbound wire: exits the chip's right-center pin and runs to the first E.
  const outboundWire = "M206,110 H228 L244,101 H250";

  const wiresG = elem("g", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });

  // A couple of purely-decorative dim stubs for circuit texture.
  ["M20,72 V58 H30", "M20,158 V172 H32", "M120,18 V40", "M168,202 V178"].forEach((d) => {
    wiresG.appendChild(elem("path", { d, stroke: colors.gold, "stroke-width": 2, opacity: 0.35 }));
  });

  // Via dots where wires enter from the left edge.
  [72, 104, 126, 158].forEach((y) =>
    wiresG.appendChild(elem("circle", { cx: 4, cy: y, r: 3.2, fill: colors.gold }))
  );

  // Base (dim) traces — always visible.
  [...inboundWires, outboundWire].forEach((d) =>
    wiresG.appendChild(
      elem("path", { d, stroke: colors.gold, "stroke-width": 3, opacity: 0.55 })
    )
  );

  // Pulse traces — a blurred colored halo + a bright white-ish core, both dashed.
  function addPulse(d, kind, idx) {
    const cls = `${id}-pulse ${id}-${kind}`;
    const delay = kind === "in" ? (-0.06 * idx).toFixed(2) : "0";
    const common = {
      d,
      pathLength: 100,
      "stroke-dasharray": "13 200",
      "stroke-linecap": "round",
      style: `animation-delay:${delay}s`,
    };
    wiresG.appendChild(
      elem("path", {
        ...common,
        class: `${cls} ${id}-halo`,
        stroke: colors.pulse,
        "stroke-width": 7,
        filter: `url(#${id}-glow)`,
      })
    );
    wiresG.appendChild(
      elem("path", {
        ...common,
        class: `${cls} ${id}-core`,
        stroke: "#FFFFFF",
        "stroke-width": 2.6,
      })
    );
  }
  inboundWires.forEach((d, i) => addPulse(d, "in", i));
  addPulse(outboundWire, "out", 0);
  svg.appendChild(wiresG);

  // --- Chip package + pins + die ---------------------------------------
  const chipG = elem("g");
  leftPinsY.forEach((y) => chipG.appendChild(pin(CHIP.x, y, true)));
  rightPinsY.forEach((y) => chipG.appendChild(pin(CHIP.x + CHIP.w, y, true)));
  topPinsX.forEach((x) => chipG.appendChild(pin(x, CHIP.y, false)));
  botPinsX.forEach((x) => chipG.appendChild(pin(x, CHIP.y + CHIP.h, false)));

  chipG.appendChild(
    elem("rect", {
      x: CHIP.x,
      y: CHIP.y,
      width: CHIP.w,
      height: CHIP.h,
      rx: 12,
      fill: colors.chip,
    })
  );
  // Inner die with gradient + faint circuit grid + flashing core.
  chipG.appendChild(
    elem("rect", {
      x: CX - 30,
      y: CY - 30,
      width: 60,
      height: 60,
      rx: 7,
      fill: `url(#${id}-die)`,
      stroke: colors.gold,
      "stroke-width": 1.5,
      "stroke-opacity": 0.6,
    })
  );
  const grid = elem("g", { stroke: colors.gold, "stroke-width": 1, opacity: 0.4 });
  for (let i = 1; i < 4; i++) {
    grid.appendChild(elem("line", { x1: CX - 30, y1: CY - 30 + i * 15, x2: CX + 30, y2: CY - 30 + i * 15 }));
    grid.appendChild(elem("line", { x1: CX - 30 + i * 15, y1: CY - 30, x2: CX - 30 + i * 15, y2: CY + 30 }));
  }
  chipG.appendChild(grid);
  // Core square — flashes when the inbound pulses arrive.
  chipG.appendChild(
    elem("rect", {
      x: CX - 11,
      y: CY - 11,
      width: 22,
      height: 22,
      rx: 3,
      fill: colors.gold,
      class: `${id}-core-flash`,
      filter: `url(#${id}-glow)`,
    })
  );
  svg.appendChild(chipG);

  // --- ESTEEM wordmark + tagline ---------------------------------------
  const fontStack = `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`;
  const word = elem("text", {
    x: TX,
    y: BASE,
    fill: colors.red,
    class: `${id}-word`,
  });
  word.textContent = text;

  // Lighting up the first letter is a two-layer flare, both flashed in sync with
  // the arriving pulse:
  //   1. a soft cyan energy halo (pulse color, heavy blur) drawn BEHIND the word
  //   2. a white-hot copy of the glyph drawn ON TOP, so the letter itself flares.
  const firstChar = (text || "E").charAt(0);
  const flashGlow = elem("text", {
    x: TX,
    y: BASE,
    fill: colors.pulse,
    filter: `url(#${id}-glow-strong)`,
    class: `${id}-flash-glow`,
  });
  flashGlow.textContent = firstChar;
  const flashLetter = elem("text", {
    x: TX,
    y: BASE,
    fill: colors.flash,
    filter: `url(#${id}-glow)`,
    class: `${id}-flash-letter`,
  });
  flashLetter.textContent = firstChar;

  const tag = elem("text", {
    x: TX,
    y: TAG_BASE,
    class: `${id}-tag`,
    lengthAdjust: "spacingAndGlyphs",
  });
  tag.textContent = tagline;

  svg.appendChild(flashGlow); // behind the word → radiating aura
  svg.appendChild(word);
  svg.appendChild(flashLetter); // on top → white-hot glyph
  svg.appendChild(tag);

  // ---- Styles -----------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
    .${id}-root { display:inline-block; width:100%; max-width:${maxWidth}px; }
    .${id}-svg { display:block; height:auto; overflow:visible; }
    .${id}-word {
      font-family:${fontStack}; font-weight:800; font-size:92px;
      letter-spacing:1px;
    }
    .${id}-flash-letter, .${id}-flash-glow {
      font-family:${fontStack}; font-weight:800; font-size:92px;
      letter-spacing:1px; opacity:0;
    }
    .${id}-tag {
      font-family:${fontStack}; font-weight:500; font-size:15px;
      letter-spacing:0.4px; fill:${colors.taglineLight};
    }
    .${id}-root.${id}-dark .${id}-tag { fill:${colors.taglineDark}; }

    .${id}-pulse { opacity:0; }
    .${id}-core-flash { opacity:0.85; }

    ${
      animate
        ? `
    .${id}-pulse { opacity:1; }
    .${id}-in  { animation:${id}-travel-in 3.6s linear infinite; }
    .${id}-out { animation:${id}-travel-out 3.6s linear infinite; }
    .${id}-core-flash { animation:${id}-coreflash 3.6s ease-in-out infinite; }
    .${id}-flash-letter, .${id}-flash-glow { animation:${id}-litE 3.6s ease-in-out infinite; }

    /* Inbound pulse: travels far-left → chip during 0–40%, then parks off-path. */
    @keyframes ${id}-travel-in {
      0%   { stroke-dashoffset:13; }
      40%  { stroke-dashoffset:-100; }
      100% { stroke-dashoffset:-100; }
    }
    /* Outbound pulse: waits, then chip → E during 44–60%. */
    @keyframes ${id}-travel-out {
      0%,44% { stroke-dashoffset:13; }
      60%    { stroke-dashoffset:-100; }
      100%   { stroke-dashoffset:-100; }
    }
    @keyframes ${id}-coreflash {
      0%,30% { opacity:0.45; }
      40%    { opacity:1; }
      62%    { opacity:0.9; }
      80%    { opacity:0.45; }
      100%   { opacity:0.45; }
    }
    @keyframes ${id}-litE {
      0%,56% { opacity:0; }
      62%    { opacity:1; }
      80%    { opacity:0.5; }
      94%    { opacity:0; }
      100%   { opacity:0; }
    }`
        : ``
    }

    @media (prefers-reduced-motion: reduce) {
      .${id}-pulse { opacity:0 !important; animation:none !important; }
      .${id}-flash-letter, .${id}-flash-glow { opacity:0 !important; animation:none !important; }
      .${id}-core-flash { opacity:0.85 !important; animation:none !important; }
    }
  `;

  // ---- Mount ------------------------------------------------------------
  const root = document.createElement("div");
  root.className = `${id}-root`;
  root.appendChild(style);
  root.appendChild(svg);
  el.appendChild(root);

  // Fit the tagline width to the ESTEEM wordmark width (like the original lockup).
  // Measured after layout; falls back gracefully if measurement is unavailable.
  function fitTagline() {
    try {
      const w = word.getComputedTextLength();
      if (w > 0) tag.setAttribute("textLength", Math.max(w, 1));
    } catch (_) {
      /* getComputedTextLength unavailable (detached) — leave natural width */
    }
  }
  requestAnimationFrame(fitTagline);

  // ---- Dark-mode detection (page background luminance), matches other widgets.
  function detectDark() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/\d+/g);
    if (m) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
    return false;
  }
  function applyTheme() {
    root.classList.toggle(`${id}-dark`, detectDark());
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true });
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  }
}

export default { render };
