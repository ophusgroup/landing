// duck.js — a small 3D rubber duck bobbing on invisible waves (MyST anywidget).
//
// Glossy radial-gradient shading gives it a rounded, 3D look. It gently bobs up
// and down and rocks a few degrees (90° out of phase) so it reads as riding
// unseen swells, with a soft shadow that shrinks as it rises. The motion is a
// declarative CSS @keyframes animation (survives the hosted theme's DOM
// re-serialization) and respects prefers-reduced-motion.
// Hover / click behaviour is intentionally left for later.

function render({ model, el }) {
  if (el.__duckCleanup) { try { el.__duckCleanup(); } catch (e) {} }
  const id = "dk_" + Math.random().toString(36).slice(2, 7);
  const opt = (k, d) => { try { const v = model && model.get && model.get(k); return v == null ? d : v; } catch (e) { return d; } };
  const size = opt("size", 140);   // px width
  const P = opt("period", 3.6);    // seconds per bob
  const Ay = opt("bob", 6);        // px vertical travel
  const At = opt("tilt", 5);       // deg of rock

  // Bob (translateY) + rock (rotate) sampled from sine/cosine — 90° out of phase
  // so the duck tips as it rises and falls, like it is riding a swell.
  const STEPS = 32;
  let floatKF = "", shKF = "";
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS, a = 2 * Math.PI * t;
    const ty = (-Ay * Math.sin(a)).toFixed(2);
    const rot = (At * Math.cos(a)).toFixed(2);
    floatKF += `${(t * 100).toFixed(2)}%{transform:translateY(${ty}px) rotate(${rot}deg);}`;
    const up = Math.max(0, Math.sin(a));               // 0..1 while the duck is above rest
    shKF += `${(t * 100).toFixed(2)}%{transform:scale(${(1 - 0.16 * up).toFixed(3)});opacity:${(0.16 - 0.07 * up).toFixed(3)};}`;
  }

  el.innerHTML = `
    <style>
      .${id}-wrap { display:block; width:${size}px; max-width:100%; margin:1.2em auto 0.6em; }
      .${id}-wrap svg { display:block; width:100%; height:auto; overflow:visible; }
      .${id}-duck { transform-box:fill-box; transform-origin:50% 90%; will-change:transform;
        animation:${id}-float ${P}s linear infinite; }
      .${id}-sh { transform-box:fill-box; transform-origin:50% 50%;
        animation:${id}-sh ${P}s linear infinite; }
      @keyframes ${id}-float { ${floatKF} }
      @keyframes ${id}-sh { ${shKF} }
      @media (prefers-reduced-motion: reduce){ .${id}-duck,.${id}-sh { animation:none; } }
    </style>
    <div class="${id}-wrap">
      <svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="${id}-body" cx="34%" cy="28%" r="82%">
            <stop offset="0" stop-color="#fff1ab"/>
            <stop offset="0.5" stop-color="#ffce1f"/>
            <stop offset="1" stop-color="#e6a000"/>
          </radialGradient>
          <radialGradient id="${id}-bill" cx="35%" cy="28%" r="95%">
            <stop offset="0" stop-color="#ffc266"/>
            <stop offset="1" stop-color="#ec841a"/>
          </radialGradient>
        </defs>
        <ellipse class="${id}-sh" cx="70" cy="136" rx="46" ry="7.5" fill="#0a1622"/>
        <g class="${id}-duck">
          <path d="M 22 82 Q 5 79 9 64 Q 21 72 35 77 Z" fill="url(#${id}-body)"/>
          <ellipse cx="66" cy="90" rx="50" ry="32" fill="url(#${id}-body)"/>
          <path d="M 84 82 Q 52 76 39 93 Q 53 100 76 93 Q 85 88 84 82 Z" fill="#ffd634"/>
          <path d="M 39 93 Q 53 100 76 93" fill="none" stroke="#d38f00" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
          <circle cx="102" cy="50" r="26" fill="url(#${id}-body)"/>
          <path d="M 120 45 Q 150 42 148 55 Q 139 62 119 57 Z" fill="url(#${id}-bill)"/>
          <path d="M 121 56 Q 135 60 146 56" fill="none" stroke="#c96e12" stroke-width="1.1" stroke-linecap="round" opacity="0.6"/>
          <circle cx="108" cy="43" r="3.7" fill="#33240f"/>
          <circle cx="109.4" cy="41.5" r="1.2" fill="#fff"/>
          <ellipse cx="92" cy="39" rx="9" ry="5.4" fill="#fff" opacity="0.42" transform="rotate(-22 92 39)"/>
          <ellipse cx="50" cy="77" rx="13" ry="6.4" fill="#fff" opacity="0.24" transform="rotate(-16 50 77)"/>
        </g>
      </svg>
    </div>`;

  el.__duckCleanup = () => {};
}

export default { render };
