// person-card.js — anywidget ESM module for interactive person cards
// Hover on desktop, tap on mobile to show info popup

function render({ model, el }) {
  const name = model.get("name") || "";
  const image = model.get("image") || "";
  const pronouns = model.get("pronouns") || "";
  const bio = model.get("bio") || "";
  const links = model.get("links") || [];
  const popupWidth = model.get("popup_width") || 320;

  // Scoped class prefix to avoid collisions
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

    /* ---- popup ---- */
    .${id}-popup {
      visibility: hidden;
      opacity: 0;
      position: absolute;
      top: 0;
      left: calc(100% + 0.75em);
      width: ${popupWidth}px;
      max-height: 80vh;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 1em;
      box-shadow: 0 8px 24px rgba(0,0,0,0.14);
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
    /* flip left when near right edge */
    .${id}-popup.flip {
      left: auto;
      right: calc(100% + 0.75em);
    }
    /* fall back to below if no horizontal room */
    .${id}-popup.below {
      left: 50%;
      right: auto;
      top: calc(100% + 0.5em);
      transform: translateX(-50%);
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
      color: #2563eb;
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

  // Build HTML
  const card = document.createElement("div");
  card.className = `${id}-wrap`;

  const linksHtml = links
    .map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)
    .join(" · ");

  card.innerHTML = `
    <img src="${image}" alt="${name}" />
    <div class="${id}-name">${name}</div>
    <div class="${id}-popup">
      ${pronouns ? `<div class="${id}-pronouns">${pronouns}</div>` : ""}
      ${linksHtml ? `<div class="${id}-links">${linksHtml}</div>` : ""}
      ${bio ? `<div class="${id}-bio">${bio}</div>` : ""}
    </div>
  `;

  const popup = card.querySelector(`.${id}-popup`);

  // Position logic: prefer right, flip left, fallback below
  function positionPopup() {
    popup.classList.remove("flip", "below");
    const rect = card.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;

    if (spaceRight >= popupWidth + 20) {
      // default: right — no extra class needed
    } else if (spaceLeft >= popupWidth + 20) {
      popup.classList.add("flip");
    } else {
      popup.classList.add("below");
    }
  }

  function showPopup() {
    positionPopup();
    popup.classList.add("show");
  }
  function hidePopup() {
    popup.classList.remove("show");
  }

  // Desktop: hover with small delay on leave
  let leaveTimer;
  card.addEventListener("mouseenter", () => {
    clearTimeout(leaveTimer);
    showPopup();
  });
  card.addEventListener("mouseleave", () => {
    leaveTimer = setTimeout(hidePopup, 250);
  });

  // Mobile: tap to toggle, tap elsewhere to dismiss
  let isTouchDevice = false;
  card.addEventListener("touchstart", () => { isTouchDevice = true; }, { once: true });
  card.addEventListener("click", (e) => {
    if (!isTouchDevice) return;
    e.preventDefault();
    e.stopPropagation();
    if (popup.classList.contains("show")) {
      hidePopup();
    } else {
      showPopup();
    }
  });
  document.addEventListener("click", (e) => {
    if (!card.contains(e.target)) hidePopup();
  });

  el.appendChild(card);
}

export default { render };
