// person-card.js — ESM module for interactive person cards (MyST anywidget)
// Hover on desktop, tap on mobile to show info popup below name

function render({ model, el }) {
  const name = model.get("name") || "";
  const image = model.get("image") || "";
  const pronouns = model.get("pronouns") || "";
  const bio = model.get("bio") || "";
  const titles = model.get("titles") || [];
  const links = model.get("links") || [];
  const papers = model.get("papers") || [];
  const popupWidth = model.get("popup_width") || 420;
  // Optional per-card styling (defaults below = plain square, full color):
  //   "frame": "hexagon" → pointy-top hexagon crop with a slow "breathing" clip boundary
  //   "grayscale": true  → grayscale at rest, fades to full color on hover
  const frame = model.get("frame") || "square";
  const grayscale = model.get("grayscale") || false;

  const id = "pc-" + Math.random().toString(36).slice(2, 8);
  const breatheDelay = "-" + (Math.random() * 5).toFixed(2);

  const imgShapeCss = frame === "hexagon"
    ? `aspect-ratio: 0.8660; object-fit: cover;
       clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
       animation: ${id}-breathe 5s ease-in-out infinite;
       animation-delay: ${breatheDelay}s; will-change: clip-path;`
    : `border-radius: 4px;`;
  const grayscaleCss = grayscale
    ? `filter: grayscale(100%); transition: filter 0.4s ease;`
    : ``;
  const optionCss = `
    ${grayscale ? `.${id}-wrap:hover img { filter: grayscale(0%); }` : ``}
    ${frame === "hexagon" ? `
    @keyframes ${id}-breathe {
      0%, 100% { clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); }
      50%      { clip-path: polygon(50% 3%, 97% 26.5%, 97% 73.5%, 50% 97%, 3% 73.5%, 3% 26.5%); }
    }
    @media (prefers-reduced-motion: reduce) { .${id}-wrap img { animation: none; } }` : ``}
  `;

  const style = document.createElement("style");
  style.textContent = `
    .${id}-wrap {
      position: relative;
      display: inline-block;
      cursor: pointer;
      text-align: center;
      width: 100%;
    }
    .${id}-wrap img {
      width: 100%;
      display: block;
      ${grayscaleCss}
      ${imgShapeCss}
    }
    .${id}-name {
      font-weight: 700;
      margin-top: 0.4em;
      font-size: 0.95em;
    }
    .${id}-popup {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      left: 0;
      width: ${popupWidth}px;
      max-height: 90vh;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 1em;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      z-index: 9999;
      text-align: left;
      transition: opacity 0.18s ease, visibility 0.18s ease;
      pointer-events: none;
    }
    .${id}-popup.show {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
    }
    .${id}-titles {
      font-size: 0.85em;
      line-height: 1.5;
      color: #374151;
      margin-bottom: 0.5em;
      padding-bottom: 0.5em;
      border-bottom: 1px solid #e5e7eb;
    }
    .${id}-pronouns {
      color: #6b7280;
      font-size: 0.85em;
      margin-bottom: 0.4em;
    }
    .${id}-links {
      margin-bottom: 0.6em;
      line-height: 1.7;
    }
    .${id}-links a {
      color: #8C1515;
      text-decoration: none;
      white-space: nowrap;
    }
    .${id}-links a:hover {
      text-decoration: underline;
    }
    .${id}-bio {
      font-size: 0.88em;
      line-height: 1.55;
      color: #374151;
    }
    .${id}-papers {
      margin-top: 0.6em;
      padding-top: 0.5em;
      border-top: 1px solid #e5e7eb;
      font-size: 0.85em;
      line-height: 1.5;
    }
    .${id}-papers a {
      color: #8C1515;
      text-decoration: none;
    }
    .${id}-papers a:hover {
      text-decoration: underline;
    }

    /* Dark mode — detected via JS, applied as .${id}-dark on wrapper */
    .${id}-dark .${id}-popup { background: #1f2937; border-color: #4b5563; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .${id}-dark .${id}-titles { color: #d1d5db; border-bottom-color: #4b5563; }
    .${id}-dark .${id}-pronouns { color: #9ca3af; }
    .${id}-dark .${id}-links a { color: #E8A0A0; }
    .${id}-dark .${id}-bio { color: #d1d5db; }
    .${id}-dark .${id}-papers { border-top-color: #4b5563; }
    .${id}-dark .${id}-papers a { color: #E8A0A0; }
    ${optionCss}
  `;
  el.appendChild(style);

  // Detect dark mode by checking actual page background luminance
  function detectDark() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/\d+/g);
    if (m) {
      const lum = (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255;
      return lum < 0.5;
    }
    return false;
  }
  const card = document.createElement("div");
  card.className = `${id}-wrap`;
  function applyTheme() {
    card.classList.toggle(`${id}-dark`, detectDark());
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  const titlesHtml = titles
    .map((t) => `<div>${t}</div>`)
    .join("");

  const linksHtml = links
    .map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)
    .join(" &middot; ");

  const papersHtml = papers
    .map((p) => `<div><a href="${p.url}" target="_blank" rel="noopener">${p.title}</a></div>`)
    .join("");

  card.innerHTML = `
    <img src="${image}" alt="${name}" />
    <div class="${id}-name">${name}</div>
    <div class="${id}-popup">
      ${titlesHtml ? `<div class="${id}-titles">${titlesHtml}</div>` : ""}
      ${pronouns ? `<div class="${id}-pronouns">${pronouns}</div>` : ""}
      ${linksHtml ? `<div class="${id}-links">${linksHtml}</div>` : ""}
      ${bio ? `<div class="${id}-bio">${bio.replace(/\n/g, "<br>")}</div>` : ""}
      ${papersHtml ? `<div class="${id}-papers">${papersHtml}</div>` : ""}
    </div>
  `;

  const popup = card.querySelector(`.${id}-popup`);
  const nameEl = card.querySelector(`.${id}-name`);

  function positionPopup() {
    popup.style.top = (nameEl.offsetTop + nameEl.offsetHeight + 4) + "px";
  }

  function showPopup() {
    positionPopup();
    popup.classList.add("show");
  }
  function hidePopup() {
    popup.classList.remove("show");
  }

  // Desktop: hover
  let leaveTimer;
  card.addEventListener("mouseenter", () => {
    clearTimeout(leaveTimer);
    showPopup();
  });
  card.addEventListener("mouseleave", () => {
    leaveTimer = setTimeout(hidePopup, 250);
  });

  // Mobile: tap
  let isTouchDevice = false;
  card.addEventListener("touchstart", () => { isTouchDevice = true; }, { once: true });
  card.addEventListener("click", (e) => {
    if (!isTouchDevice) return;
    e.preventDefault();
    e.stopPropagation();
    popup.classList.toggle("show");
    if (popup.classList.contains("show")) positionPopup();
  });
  // Use composedPath so clicks inside the shadow root (retargeted to the host
  // at the document level) are still recognised as "inside the card".
  el.ownerDocument.addEventListener("click", (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.includes(card)) hidePopup();
  });

  el.appendChild(card);
}

export default { render };
