// nano-mascot.js — the nano@Stanford mascot (traced from the user's mascot05.svg).
// A friendly robot that waves + bobs, winks on hover, and has a click-driven easter egg.
// Pure SVG + CSS, transparent background. One black outline wraps the whole silhouette
// (feMorphology) so parts blend; a darker-gray shading + white highlight per grey object add volume.
// Both arms are independent pivot groups (armL / armR) with sleeve caps that overlap into the torso.
// Breathing is a small RIGID translateY bob (legs planted, head never deforms — it's a robot).
//
// Interaction:
//   - hover pauses the wave (and winks in the happy state)
//   - 5 clicks -> neutral face, 10 -> angry face, 20 -> the character stomp-runs at the
//     screen, fills it with a black "nano@stanford" screen, then fades back
//   - mousing off the widget resets the click count + face
// Ground shadow hides in dark mode. Used on facilities.md.

function detectDark() {
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/\d+/g);
    if (m && m.length >= 3) return (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255 < 0.5;
  } catch (e) {}
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function render({ model, el }) {
  const id = "nm_" + Math.random().toString(36).slice(2, 7);
  const G = "#bfbfbf", SH = "#8d8d8d", HL = "#ffffff"; // grey / shading / highlight

  // Optional float layout via anywidget body params, applied to the mount as a runtime
  // inline style — the deployed theme strips Tailwind float/width utilities, but not this.
  const opt = (k, d) => { try { const v = model && model.get && model.get(k); return v == null ? d : v; } catch (e) { return d; } };
  const side = opt("side", "");
  if (side === "left" || side === "right") {
    const w = opt("width", "40%");
    const top = opt("top", "0.2em");
    const m = side === "right" ? `${top} 0 0.6em 1.4em` : `${top} 1.4em 0.6em 0`;
    // Float the mount; if MyST wrapped it in a single-child block, hoist the float up to
    // that wrapper too, until we reach the real content flow (a parent with siblings).
    let t = el;
    for (let i = 0; i < 3 && t; i++) {
      t.style.float = side; t.style.width = w; t.style.margin = m;
      const p = t.parentElement;
      if (!p || p.children.length > 1) break;
      t = p;
    }
  }

  // CSS kept as a string so the run overlay (which lives in document.body, outside the
  // widget's shadow root on the deployed site) can inject its own copy for the clone.
  const css = `
      .${id}-wrap { display:block; width:100%; line-height:0; cursor:pointer; user-select:none; -webkit-user-select:none; }
      .${id}-wrap svg { width:100%; height:auto; display:block; overflow:visible; }
      .${id}-armR { transform-box:view-box; transform-origin:147px 115px;
        animation:${id}-wave 1.5s ease-in-out infinite; }
      @keyframes ${id}-wave { 0%,100%{ transform:rotate(-9deg);} 50%{ transform:rotate(9deg);} }
      .${id}-armL { transform-box:view-box; transform-origin:53px 113px; }
      .${id}-bob { transform-box:view-box;
        animation:${id}-bob 3.6s ease-in-out infinite; }
      @keyframes ${id}-bob { 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-2px);} }
      /* hover pauses the wave */
      .${id}-wrap:hover .${id}-armR { animation-play-state:paused; }
      /* wink (happy state only — the wink lives inside the happy face group) */
      .${id}-winkEye { opacity:0; }
      .${id}-wrap:hover .${id}-openEye, .${id}-wrap.${id}-wink .${id}-openEye { opacity:0; }
      .${id}-wrap:hover .${id}-winkEye, .${id}-wrap.${id}-wink .${id}-winkEye { opacity:1; }
      /* expression swap (class on the wrap, or on the clone during the run) */
      .${id}-neutralFace, .${id}-angryFace { display:none; }
      .${id}-neutral .${id}-happyFace { display:none; }
      .${id}-neutral .${id}-neutralFace { display:inline; }
      .${id}-angry .${id}-happyFace { display:none; }
      .${id}-angry .${id}-angryFace { display:inline; }
      /* run: fast flailing arms + stomp bob (used on the full-screen clone) */
      .${id}-running .${id}-shadow { display:none; }
      .${id}-running .${id}-armR { animation:${id}-flailR .26s ease-in-out infinite; }
      .${id}-running .${id}-armL { animation:${id}-flailL .26s ease-in-out infinite; }
      /* stomping legs (only on the running clone; shadings are stripped so no clip trouble) */
      .${id}-running #${id}-ll { transform-box:view-box; animation:${id}-legL .26s ease-in-out infinite; }
      .${id}-running #${id}-rl { transform-box:view-box; animation:${id}-legR .26s ease-in-out infinite; }
      @keyframes ${id}-legL { 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-8px);} }
      @keyframes ${id}-legR { 0%,100%{ transform:translateY(-8px);} 50%{ transform:translateY(0);} }
      /* stomp bob that DECAYS to rest as the shirt fills, so the title settles smoothly */
      .${id}-running .${id}-bob { animation:${id}-stomprun 1.7s ease-out forwards; }
      @keyframes ${id}-flailR { 0%,100%{ transform:rotate(-42deg);} 50%{ transform:rotate(12deg);} }
      @keyframes ${id}-flailL { 0%,100%{ transform:rotate(42deg);} 50%{ transform:rotate(-12deg);} }
      @keyframes ${id}-stomprun { 0%{transform:translateY(0);} 10%{transform:translateY(-7px);} 20%{transform:translateY(0);} 32%{transform:translateY(-5px);} 45%{transform:translateY(0);} 58%{transform:translateY(-3px);} 72%{transform:translateY(0);} 86%{transform:translateY(-1.5px);} 100%{transform:translateY(0);} }
      @media (prefers-reduced-motion: reduce){ .${id}-armR, .${id}-bob { animation:none; } }`;

  el.innerHTML = `
    <style>${css}</style>
    <div class="${id}-wrap">
      <svg viewBox="0 0 197.6 212.48" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="nano@Stanford mascot robot">
        <defs>
          <filter id="${id}-ol" x="-25%" y="-25%" width="150%" height="150%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="d"/>
            <feFlood flood-color="#131313" result="b"/>
            <feComposite in="b" in2="d" operator="in" result="o"/>
            <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <clipPath id="${id}-cll"><use href="#${id}-ll"/></clipPath>
          <clipPath id="${id}-crl"><use href="#${id}-rl"/></clipPath>
          <clipPath id="${id}-cbe"><use href="#${id}-be"/></clipPath>
          <clipPath id="${id}-cab"><use href="#${id}-ab"/></clipPath>
          <clipPath id="${id}-chb"><use href="#${id}-hb"/></clipPath>
          <clipPath id="${id}-cLa"><use href="#${id}-laP"/></clipPath>
          <clipPath id="${id}-cRa"><use href="#${id}-raP"/></clipPath>
        </defs>

        <ellipse class="${id}-shadow" cx="106.01" cy="202.72" rx="61.87" ry="9.76" fill="#0a0a0a" opacity="0.82"/>

        <g filter="url(#${id}-ol)">
          <!-- LEGS: static + planted (outside the bob so the feet never move) -->
          <path id="${id}-ll" fill="${G}" d="M80.05,183.5c0,9.53-3.27,17.26-7.31,17.26s-13.21-14.89-17.96-28.76c-5.43-11.3,13.92-9.76,17.96-9.76s7.31,11.73,7.31,21.26Z"/>
          <ellipse cx="83" cy="188" rx="24" ry="27" fill="${SH}" clip-path="url(#${id}-cll)"/>
          <path id="${id}-rl" fill="${G}" d="M146.85,183.65c3.05,14.3,1.34,17.09-2.88,17.09s-15.29-5.13-28.45-20.07c-5.5-6.24,11.99-17.29,16.21-17.29s10.01-3.78,15.13,20.27Z"/>
          <ellipse cx="150" cy="188" rx="24" ry="27" fill="${SH}" clip-path="url(#${id}-crl)"/>

          <!-- BOB: whole upper body bobs as a rigid unit (no scaling, so the dome never stretches) -->
          <g class="${id}-bob">
            <!-- head / body + your shading + dome highlight -->
            <path id="${id}-hb" fill="${G}" d="M154.44,86.27l-55.25,73.33-55.61-73.33c0-34.61,19.83-57.49,55.61-57.49s55.25,23.8,55.25,57.49Z"/>
            <path fill="#7f7f7f" d="M154.44,86.27l-11.46,15.21H55.12l-11.53-15.21c-.18,1,96.53.36,96.53.36l3.43-4.58s.6-10.39-4.2-25.39c-5.24-16.38-14.63-23.04-14.63-23.04,19.75,8.6,29.72,27.97,29.72,52.66Z"/>
            <ellipse cx="72" cy="60" rx="13" ry="21" transform="rotate(-20 72 60)" fill="${HL}" opacity="0.16" clip-path="url(#${id}-chb)"/>
            <!-- antenna + shading -->
            <path id="${id}-ab" fill="${G}" d="M110.99,29.57c0,3.14-5.32,5.68-11.88,5.68s-11.88-2.54-11.88-5.68c0-5.68.38-5.68,11.88-5.68s11.88-.31,11.88,5.68Z"/>
            <ellipse cx="107" cy="31" rx="11" ry="8" fill="${SH}" clip-path="url(#${id}-cab)"/>
            <circle fill="${G}" cx="98.53" cy="4.96" r="4.46"/>
            <path fill="${SH}" d="M98.53,0.5 A4.46,4.46 0 0 1 98.53,9.42 Z"/>
            <polygon fill="${G}" points="104.1 26.26 93.95 26.26 95.75 8.45 101.22 8.45 104.1 26.26"/>
            <polygon fill="${SH}" points="104.1 26.26 99.5 26.26 100.6 8.45 101.22 8.45"/>
            <!-- torso bottom + shading -->
            <ellipse id="${id}-be" fill="${G}" cx="97.86" cy="169.31" rx="43.87" ry="18.65"/>
            <ellipse cx="118" cy="182" rx="45" ry="21" fill="${SH}" clip-path="url(#${id}-cbe)"/>

            <!-- LEFT arm pivot group -->
            <g class="${id}-armL">
              <path id="${id}-laP" fill="${G}" d="M55.39,115.54c0,4-11.33,14.97-22.77,9.23C12.41,114.64.5,102.61.5,98.61c0-5.74,3.78-6.01,39.1-1.18,12.68,1.73,15.79,14.12,15.79,18.12Z"/>
              <ellipse cx="22" cy="132" rx="48" ry="24" fill="${SH}" clip-path="url(#${id}-cLa)"/>
              <ellipse cx="26" cy="103" rx="44" ry="12" fill="${HL}" opacity="0.18" clip-path="url(#${id}-cLa)"/>
            </g>
            <!-- RIGHT arm pivot group (waves); flat shadow band along the lower edge -->
            <g class="${id}-armR">
              <path id="${id}-raP" fill="${G}" d="M197.09,80.72c-.48,6.26-2.2,14.77-21.07,34.18-15.54,15.98-27.17,6.81-30.56,1.53-3.68-5.74-.82-15.49,24.18-29.6,22.92-12.93,27.79-10.58,27.45-6.1Z"/>
              <path fill="${SH}" d="M141,126C166,126,186,121,201,77C191,91,178,101,165,105C158,106,152,106,147,105C144,112,142,119,141,126Z" clip-path="url(#${id}-cRa)"/>
              <ellipse cx="159" cy="88" rx="24" ry="16" fill="${HL}" opacity="0.18" clip-path="url(#${id}-cRa)"/>
            </g>

            <!-- t-shirt torso -->
            <path fill="#0d0d0d" d="M39.58,97.44C48,98,54,99,60.6,100.54C67,102,71,104,76.55,105.51C81,106,88,108,97.09,108.28C119,108,128,96,145.99,98.55C154,111,161,134,158.26,153.88C156,162,150,172,145.13,177C130,176,116,175,101.87,175.47C86,176,71,176,55.38,177C50,169,44,159,41.43,149.42C40,142,39.6,135,39.56,127.86C39.57,118,39.57,106,39.58,97.44Z"/>
            <g class="${id}-armL"><path fill="#0d0d0d" d="M28,109C30,103,34,98,40,96C50,97,58,101,63,107C64,114,63,121,60,127C51,130,40,131,33,128C29,122,27,115,28,109Z"/></g>
            <g class="${id}-armR"><path fill="#0d0d0d" d="M138,106C144,102,150,98,156,94C159,92,161,91,163,91C168,95,172,103,176,114C173,121,168,127,162,132C155,141,146,146,138,143C127,139,119,131,116,120C114,114,122,109,138,106Z"/></g>
            <!-- face -->
            <path fill="#1e232b" d="M140.18,83.54h-40.32s-40.51,0-40.51,0c0-21.74,4.39-39.37,40.42-39.37s40.42,17.63,40.42,39.37Z"/>
          </g>
        </g>

        <!-- eyes / mouth / shirt text bob in sync with the face (outside the outline filter) -->
        <g class="${id}-bob">
          <g fill="none" stroke="#77acce" stroke-width="1.5" stroke-linecap="round">
            <!-- HAPPY (default): squinty arcs + smile; right eye winks on hover -->
            <g class="${id}-happyFace">
              <path d="M73.15,63.45c.59-2.31,2.96-4.98,6.6-4.98s6.28,2.67,6.6,5.34"/>
              <path class="${id}-openEye" d="M112.39,63.45c.59-2.31,2.96-4.98,6.6-4.98s6.28,2.67,6.6,5.34"/>
              <path class="${id}-winkEye" d="M112.4,62.6q6.6,1.5,13.2,0"/>
              <path d="M91.46,71.66c0,3.98,4.27,6.9,9.54,6.9s9.25-2.25,9.54-6.75"/>
            </g>
            <!-- NEUTRAL: flat lines -->
            <g class="${id}-neutralFace">
              <path d="M73,61H86"/>
              <path d="M112.5,61H125.5"/>
              <path d="M91,75H110"/>
            </g>
            <!-- ANGRY: eyes slanted down toward the center + frowning mouth -->
            <g class="${id}-angryFace">
              <path d="M73,58L86,65"/>
              <path d="M112.5,65L125.5,58"/>
              <path d="M91,78Q100.5,71,110,78"/>
            </g>
          </g>
          <text fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="11" transform="translate(61.57 139)">nano</text>
          <text fill="#8c1515" font-family="Helvetica, Arial, sans-serif" font-size="11" transform="translate(86.54 141)">@</text>
          <text fill="#ffffff" font-family="Helvetica, Arial, sans-serif" font-size="11" transform="translate(98.32 139)">stanford</text>
        </g>
      </svg>
    </div>`;

  const wrap = el.querySelector(`.${id}-wrap`);
  const shadow = el.querySelector(`.${id}-shadow`);
  let clicks = 0, running = false;

  const setFace = (state) => {
    wrap.classList.remove(`${id}-neutral`, `${id}-angry`);
    if (state === "neutral") wrap.classList.add(`${id}-neutral`);
    else if (state === "angry") wrap.classList.add(`${id}-angry`);
  };

  if (wrap) {
    wrap.addEventListener("pointerenter", () => wrap.classList.add(`${id}-wink`));
    wrap.addEventListener("pointerleave", () => {
      wrap.classList.remove(`${id}-wink`);
      if (running) return;
      clicks = 0;
      setFace("happy");
    });
    wrap.addEventListener("click", () => {
      if (running) return;
      clicks++;
      if (clicks >= 15) triggerRun();
      else if (clicks >= 10) setFace("angry");
      else if (clicks >= 5) setFace("neutral");
    });
  }

  // 15 clicks: the character stomp-runs at the screen, fills it with a black
  // "nano@stanford" title, holds ~2s, then fades back. (Deliberately rough.)
  function triggerRun() {
    running = true;
    setFace("angry");
    const svg = el.querySelector("svg");
    const rect = svg.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    // the (now flat) "nano@stanford" shirt text is centered at ~(50.5%, 63.5%) of the viewBox
    const OX = 0.505, OY = 0.635;

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:1;transition:opacity .5s ease;user-select:none;";

    // The overlay lives in document.body (light DOM). On the deployed site the widget's
    // <style> is scoped inside the anywidget's shadow root, so inject a fresh copy of the
    // CSS here — otherwise the clone gets no animations and every face group shows at once.
    const runStyle = document.createElement("style");
    runStyle.textContent = css;
    overlay.appendChild(runStyle);

    const black = document.createElement("div");
    black.style.cssText =
      "position:absolute;inset:0;background:#000;opacity:0;transition:opacity 1.1s ease-in;";
    overlay.appendChild(black);

    // scaler grows the character FROM the shirt text, so the shirt's own title
    // ends up centered on the black screen (no separate text element).
    const scaler = document.createElement("div");
    scaler.style.cssText =
      `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;` +
      `transform-origin:${OX * 100}% ${OY * 100}%;transition:transform 1.3s cubic-bezier(.45,0,.85,.5);will-change:transform;`;
    const clone = svg.cloneNode(true);
    clone.setAttribute("style", "width:100%;height:100%;display:block;overflow:visible;");
    clone.classList.add(`${id}-running`, `${id}-angry`);
    // drop the clipped shadings/highlights — the clone shares ids with the original,
    // so their clips would misbehave; the base shapes + outline are enough for a fast run.
    clone.querySelectorAll("[clip-path]").forEach((n) => n.remove());
    // recolor the shirt to pure black so it merges seamlessly with the black screen
    clone.querySelectorAll('[fill="#0d0d0d"]').forEach((n) => n.setAttribute("fill", "#000"));
    scaler.appendChild(clone);
    overlay.appendChild(scaler);
    document.body.appendChild(overlay);

    // hide the resting character so it isn't visible behind the runner
    svg.style.visibility = "hidden";

    // move the shirt-text point to screen center + scale the shirt up to fill
    const dx = vw / 2 - (rect.left + OX * rect.width);
    const dy = vh / 2 - (rect.top + OY * rect.height);
    const Sx = 1.89 * vw / rect.width;                // fit the title to ~80% of the width (5% larger)
    const Sy = Math.max(Sx, 2.8 * vh / rect.height);  // then stretch taller only if needed to fill

    void overlay.offsetWidth; // reflow so the transitions run
    requestAnimationFrame(() => {
      black.style.opacity = "1";
      scaler.style.transform = `translate(${dx}px,${dy}px) scale(${Sx})`; // charge to fit width
    });
    // once nearly full screen, smoothly stretch the shirt taller to fill / fix the aspect
    setTimeout(() => {
      scaler.style.transition = "transform .5s ease-out";
      scaler.style.transform = `translate(${dx}px,${dy}px) scale(${Sx},${Sy})`;
    }, 1300);
    // hold ~2s -> fade back to the original layout
    setTimeout(() => { overlay.style.opacity = "0"; svg.style.visibility = ""; setFace("happy"); }, 3800);
    setTimeout(() => { overlay.remove(); clicks = 0; running = false; }, 4400);
  }

  const applyTheme = () => { if (shadow) shadow.style.opacity = detectDark() ? "0" : "0.82"; };
  applyTheme();
  const obs = new MutationObserver(applyTheme);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
  obs.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
}

export default { render };
