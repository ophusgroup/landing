// person-card.js — anywidget ESM module for interactive person cards
// Hover on desktop, tap on mobile to show info popup overlay

function render({ model, el }) {
  const name = model.get("name") || "";
  const image = model.get("image") || "";
  const pronouns = model.get("pronouns") || "";
  const bio = model.get("bio") || "";
  const links = model.get("links") || [];
  const popupWidth = model.get("popup_width") || 300;

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
      max-height: 60vh;
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
    .${id}-popup-name {
      font-weight: 700;
      font-size: 0.95em;
      margin-bottom: 0.3em;
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
  `;
  el.appendChild(style);

  const card = document.createElement("div");
  card.className = `${id}-wrap`;

  const linksHtml = links
    .map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)
    .join(" &middot; ");

  card.innerHTML = `
    <img src="${image}" alt="${name}" />
    <div class="${id}-name">${name}</div>
    <div class="${id}-popup">
      <div class="${id}-popup-name">${name}</div>
      ${pronouns ? `<div class="${id}-pronouns">${pronouns}</div>` : ""}
      ${linksHtml ? `<div class="${id}-links">${linksHtml}</div>` : ""}
      ${bio ? `<div class="${id}-bio">${bio}</div>` : ""}
    </div>
  `;

  const popup = card.querySelector(`.${id}-popup`);
  const nameEl = card.querySelector(`.${id}-name`);

  function positionPopup() {
    // Align popup top with the name element
    popup.style.top = nameEl.offsetTop + "px";
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
