// person-card.js — ESM module for interactive person cards (MyST any:bundle)
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

  const id = "pc-" + Math.random().toString(36).slice(2, 8);

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
      border-radius: 4px;
      display: block;
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

    /* Dark mode (class-based for Curvenote) */
    [data-theme="dark"] .${id}-popup,
    .dark .${id}-popup {
      background: #1f2937;
      border-color: #4b5563;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    [data-theme="dark"] .${id}-titles,
    .dark .${id}-titles {
      color: #d1d5db;
      border-bottom-color: #4b5563;
    }
    [data-theme="dark"] .${id}-pronouns,
    .dark .${id}-pronouns { color: #9ca3af; }
    [data-theme="dark"] .${id}-links a,
    .dark .${id}-links a { color: #E8A0A0; }
    [data-theme="dark"] .${id}-bio,
    .dark .${id}-bio { color: #d1d5db; }
    [data-theme="dark"] .${id}-papers,
    .dark .${id}-papers { border-top-color: #4b5563; }
    [data-theme="dark"] .${id}-papers a,
    .dark .${id}-papers a { color: #E8A0A0; }
  `;
  el.appendChild(style);

  const card = document.createElement("div");
  card.className = `${id}-wrap`;

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
  document.addEventListener("click", (e) => {
    if (!card.contains(e.target)) hidePopup();
  });

  el.appendChild(card);
}

export default { render };
