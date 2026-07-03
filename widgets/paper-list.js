// paper-list.js — ESM module for searchable/filterable publication list (MyST anywidget)

function render({ model, el }) {
  const dataUrl = model.get("data_url") || "";
  const accentColor = model.get("accent_color") || "#8C1515";
  const accentColorDark = model.get("accent_color_dark") || "#E8A0A0";
  const hoverUrl = model.get("hover_url") || "";

  const id = "pl-" + Math.random().toString(36).slice(2, 8);

  const style = document.createElement("style");
  style.textContent = `
    .${id}-wrap {
      font-family: inherit;
      max-width: 100%;
    }
    .${id}-controls {
      margin-bottom: 1.2em;
    }
    .${id}-search {
      width: 100%;
      padding: 0.6em 1em;
      font-size: 1em;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      outline: none;
      box-sizing: border-box;
      margin-bottom: 0.8em;
      background: #fff;
      color: #111;
    }
    .${id}-search:focus {
      border-color: ${accentColor};
      box-shadow: 0 0 0 2px ${accentColor}33;
    }
    .${id}-tags-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.45em;
      padding: 0.4em 0.85em;
      font-size: 0.85em;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      cursor: pointer;
      background: #fff;
      color: #374151;
      user-select: none;
      transition: all 0.15s ease;
      margin-bottom: 0.6em;
    }
    .${id}-tags-toggle:hover { border-color: ${accentColor}; color: ${accentColor}; }
    .${id}-chev {
      display: inline-block;
      font-size: 0.7em;
      line-height: 1;
      transition: transform 0.15s ease;
    }
    .${id}-tags-toggle.open .${id}-chev { transform: rotate(90deg); }
    .${id}-tagcount { color: ${accentColor}; font-weight: 600; }
    .${id}-tags {
      display: none;
      flex-wrap: wrap;
      gap: 0.4em;
      margin-bottom: 0.6em;
    }
    .${id}-tags.open { display: flex; }
    .${id}-tag-cat {
      display: inline-block;
      font-size: 0.7em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9ca3af;
      margin-right: 0.3em;
      margin-left: 0.6em;
      vertical-align: middle;
    }
    .${id}-tag-cat:first-child { margin-left: 0; }
    .${id}-tag {
      display: inline-block;
      padding: 0.25em 0.7em;
      font-size: 0.82em;
      border: 1px solid #d1d5db;
      border-radius: 20px;
      cursor: pointer;
      background: #fff;
      color: #374151;
      transition: all 0.15s ease;
      user-select: none;
    }
    .${id}-tag:hover {
      border-color: ${accentColor};
      color: ${accentColor};
    }
    .${id}-tag.active {
      background: ${accentColor};
      color: #fff;
      border-color: ${accentColor};
    }
    .${id}-years {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3em;
      margin-bottom: 0.6em;
    }
    .${id}-year-btn {
      padding: 0.2em 0.55em;
      font-size: 0.78em;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      cursor: pointer;
      background: #fff;
      color: #6b7280;
      transition: all 0.15s ease;
      user-select: none;
    }
    .${id}-year-btn:hover {
      border-color: ${accentColor};
      color: ${accentColor};
    }
    .${id}-year-btn.active {
      background: ${accentColor};
      color: #fff;
      border-color: ${accentColor};
    }
    .${id}-stats {
      font-size: 0.85em;
      color: #6b7280;
      margin-bottom: 0.8em;
    }
    .${id}-clear {
      color: ${accentColor};
      cursor: pointer;
      margin-left: 0.5em;
      font-size: 0.85em;
    }
    .${id}-clear:hover {
      text-decoration: underline;
    }
    .${id}-year-heading {
      font-size: 1.15em;
      font-weight: 700;
      margin: 1em 0 0.4em 0;
      padding-bottom: 0.3em;
      border-bottom: 2px solid ${accentColor};
      color: inherit;
    }
    .${id}-paper {
      padding: 0.5em 0;
      line-height: 1.5;
    }
    .${id}-paper a {
      color: #6b1010;
      text-decoration: none;
    }
    .${id}-paper a:hover {
      text-decoration: underline;
    }
    .${id}-paper-meta {
      font-size: 0.82em;
      color: #6b7280;
      margin-top: 0.15em;
      line-height: 1.4;
    }
    .${id}-paper-journal {
      font-style: italic;
    }
    .${id}-paper-tags {
      display: inline;
      margin-left: 0.5em;
    }
    .${id}-paper-tag {
      display: inline-block;
      font-size: 0.7em;
      padding: 0.1em 0.45em;
      border-radius: 3px;
      background: #f3f4f6;
      color: #6b7280;
      margin-left: 0.25em;
      vertical-align: middle;
    }
    .${id}-loading {
      color: #6b7280;
      font-style: italic;
    }

    /* Dark mode — detected via JS, applied as .${id}-dark on wrapper */
    .${id}-dark .${id}-search { background: #1f2937; color: #e5e7eb; border-color: #4b5563; }
    .${id}-dark .${id}-search:focus { border-color: ${accentColorDark}; box-shadow: 0 0 0 2px ${accentColorDark}33; }
    .${id}-dark .${id}-tag-cat { color: #6b7280; }
    .${id}-dark .${id}-tags-toggle { background: #1f2937; color: #9ca3af; border-color: #374151; }
    .${id}-dark .${id}-tags-toggle:hover { border-color: #b05050; color: #d4a0a0; }
    .${id}-dark .${id}-tagcount { color: ${accentColorDark}; }
    .${id}-dark .${id}-tag { background: #1f2937; color: #6b7280; border-color: #374151; }
    .${id}-dark .${id}-tag:hover { border-color: #b05050; color: #d4a0a0; }
    .${id}-dark .${id}-tag.active { background: #6b2020; color: #e5d0d0; border-color: #8C1515; }
    .${id}-dark .${id}-year-btn { background: #1f2937; color: #6b7280; border-color: #374151; }
    .${id}-dark .${id}-year-btn:hover { border-color: #b05050; color: #d4a0a0; }
    .${id}-dark .${id}-year-btn.active { background: #6b2020; color: #e5d0d0; border-color: #8C1515; }
    .${id}-dark .${id}-year-heading { color: #e5e7eb; border-bottom-color: ${accentColorDark}; }
    .${id}-dark .${id}-paper a { color: ${accentColorDark}; }
    .${id}-dark .${id}-paper-meta { color: #9ca3af; }
    .${id}-dark .${id}-clear { color: ${accentColorDark}; }
    .${id}-dark .${id}-stats { color: #9ca3af; }
    .${id}-dark .${id}-paper-tag { background: #1f2937; color: #6b7280; }
    .${id}-dark .${id}-loading { color: #9ca3af; }

    /* Hover preview card — graphical abstract + abstract text */
    .${id}-hovercard {
      position: fixed; z-index: 9999; width: 500px; max-width: 94vw;
      background: #fff; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 10px;
      box-shadow: 0 10px 34px rgba(0,0,0,0.18); overflow: hidden; pointer-events: none;
      opacity: 0; transform: translateY(4px);
      transition: opacity .14s ease, transform .14s ease;
      font-size: 0.84em; line-height: 1.5;
    }
    .${id}-hovercard.show { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .${id}-hc-img { display: block; width: 100%; max-height: 320px; object-fit: contain;
      background: #f6f6f7; border-bottom: 1px solid #eee; }
    .${id}-hc-body { padding: 11px 13px 13px; }
    .${id}-hc-title { font-weight: 600; color: #111; margin: 0 0 3px; font-size: 0.96em; line-height: 1.35; }
    .${id}-hc-title a { color: inherit; text-decoration: none; }
    .${id}-hc-title a:hover { text-decoration: underline; }
    .${id}-hc-meta { color: #6b7280; font-style: italic; margin: 0 0 7px; font-size: 0.92em; }
    .${id}-hc-abs { margin: 0; color: #374151;
      display: -webkit-box; -webkit-line-clamp: 9; -webkit-box-orient: vertical; overflow: hidden; }
    .${id}-dark .${id}-hovercard { background: #111827; color: #d1d5db; border-color: #374151;
      box-shadow: 0 10px 34px rgba(0,0,0,0.5); }
    .${id}-dark .${id}-hc-img { background: #0b0f16; border-bottom-color: #1f2937; }
    .${id}-dark .${id}-hc-title { color: #f3f4f6; }
    .${id}-dark .${id}-hc-meta { color: #9ca3af; }
    .${id}-dark .${id}-hc-abs { color: #cbd5e1; }
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${id}-wrap`;
  wrap.innerHTML = `<div class="${id}-loading">Loading publications...</div>`;
  el.appendChild(wrap);

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
  function applyTheme() {
    wrap.classList.toggle(`${id}-dark`, detectDark());
  }
  applyTheme();
  // Re-check when theme changes
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  fetch(dataUrl)
    .then((r) => r.json())
    .then((papers) => buildUI(papers))
    .catch((err) => {
      wrap.innerHTML = `<div style="color:red;">Failed to load papers: ${err.message}</div>`;
    });

  function buildUI(papers) {
    // Pre-build search index: lowercase title + authors + journal
    papers.forEach((p, i) => {
      p._idx = i;
      p._search = [
        p.title,
        (p.authors || []).join(" "),
        p.journal || ""
      ].join(" ").toLowerCase();
    });

    // Collect all tags and years
    const allTags = {};
    const allYears = new Set();
    for (const p of papers) {
      allYears.add(p.year);
      for (const t of p.tags) {
        allTags[t] = (allTags[t] || 0) + 1;
      }
    }
    // Tag category ordering
    const TAG_ORDER = {
      "4DSTEM":0,"Ptychography":1,"Tomography":2,"Imaging":3,"Diffraction":4,
      "Phase Contrast":5,"Strain":6,"Spectroscopy":7,"EELS":8,"XEDS":9,
      "Simulation":10,"Machine Learning":11,"In Situ":12,"Cryo-EM":13,
      "Fluctuation EM":14,"Lorentz TEM":15,"Holography":16,
      "Aberration Correction":17,"Interferometry":18,"Image Processing":19,
      "FIB":20,"Ion Irradiation":21,
      "2D Materials":100,"Nanoparticles":101,"Oxides":102,"Metals & Alloys":103,
      "Perovskites":104,"Disordered":105,"Polymers":106,"Semiconductor":107,
      "Catalysis":108,"Energy Materials":109,"Biological":110,"Nuclear Materials":111,
      "Moiré":112,
      "Crystallography":200,"Magnetism":201,
      "Software":202,"py4DSTEM":203,"Data Science":204,
    };
    const TAG_CAT = (t) => {
      const o = TAG_ORDER[t]; if (o == null) return 3;
      return o < 100 ? 0 : o < 200 ? 1 : 2;
    };
    const TAG_CAT_LABELS = ["", "", ""];
    const MIN_TAG_COUNT = 3;
    const sortedTags = Object.entries(allTags)
      .filter(([, c]) => c >= MIN_TAG_COUNT)
      .sort((a, b) => (TAG_ORDER[a[0]] ?? 999) - (TAG_ORDER[b[0]] ?? 999))
      .map(([t]) => t);
    const sortedYears = [...allYears].sort((a, b) => b - a);

    let activeTags = new Set();
    let activeYears = new Set();
    let searchText = "";

    wrap.innerHTML = `
      <div class="${id}-controls">
        <input class="${id}-search" type="text" placeholder="Search by title, author, or journal..." />
        <button class="${id}-tags-toggle" type="button" aria-expanded="false" aria-controls="${id}-tagsbox">
          <span class="${id}-chev">&#9656;</span><span>Tags</span><span class="${id}-tagcount"></span>
        </button>
        <div class="${id}-tags" id="${id}-tagsbox"></div>
        <!-- years removed -->
        <div class="${id}-stats"></div>
      </div>
      <div class="${id}-results"></div>
    `;

    const searchInput = wrap.querySelector(`.${id}-search`);
    const tagsContainer = wrap.querySelector(`.${id}-tags`);
    const tagsToggle = wrap.querySelector(`.${id}-tags-toggle`);
    const tagCountEl = wrap.querySelector(`.${id}-tagcount`);
    const yearsContainer = wrap.querySelector(`.${id}-years`);
    const statsContainer = wrap.querySelector(`.${id}-stats`);
    const resultsContainer = wrap.querySelector(`.${id}-results`);

    // --- Hover preview card: lazy-loads pre-baked abstracts/images keyed by DOI ---
    const hovercard = document.createElement("div");
    hovercard.className = `${id}-hovercard`;
    wrap.appendChild(hovercard);
    let hoverData = null, hoverLoading = false, hoverCurrent = null, showTimer = null, hideTimer = null;
    const canHover = !window.matchMedia || window.matchMedia("(hover: hover)").matches;
    function loadHoverData() {
      if (hoverData || hoverLoading || !hoverUrl) return;
      hoverLoading = true;
      fetch(hoverUrl).then((r) => r.json()).then((d) => { hoverData = d || {}; })
        .catch(() => { hoverData = {}; });
    }
    if (canHover && hoverUrl) loadHoverData();
    function normDoi(u) { return (u || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase(); }
    function hideCard() { clearTimeout(showTimer); clearTimeout(hideTimer); hoverCurrent = null; hovercard.classList.remove("show"); }
    function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(hideCard, 140); }
    function cancelHide() { clearTimeout(hideTimer); }
    // Centered on the hovered paper (partially overlapping it), clamped to the viewport.
    function positionCard(cardEl) {
      const r = cardEl.getBoundingClientRect();
      const w = hovercard.offsetWidth || 500, h = hovercard.offsetHeight;
      const left = r.left + r.width / 2 - w / 2, top = r.top + r.height / 2 - h / 2;
      hovercard.style.left = Math.max(8, Math.min(left, window.innerWidth - w - 8)) + "px";
      hovercard.style.top = Math.max(8, Math.min(top, window.innerHeight - h - 8)) + "px";
    }
    function showCard(cardEl) {
      const p = papers[+cardEl.dataset.pidx];
      const info = p && hoverData && hoverData[normDoi(p.url)];
      if (!info || (!info.abstract && !info.image)) return;
      hovercard.textContent = "";
      if (info.image) {
        const img = document.createElement("img");
        img.className = `${id}-hc-img`; img.alt = ""; img.referrerPolicy = "no-referrer";
        img.onerror = () => img.remove();
        img.src = info.image;
        hovercard.appendChild(img);
      }
      const body = document.createElement("div");
      body.className = `${id}-hc-body`;
      const t = document.createElement("div");
      t.className = `${id}-hc-title`;
      const link = document.createElement("a");
      link.href = p.url; link.target = "_blank"; link.rel = "noopener"; link.textContent = p.title;
      t.appendChild(link);
      body.appendChild(t);
      const metaStr = [p.journal, p.year].filter(Boolean).join(" · ");
      if (metaStr) {
        const m = document.createElement("div");
        m.className = `${id}-hc-meta`; m.textContent = metaStr;
        body.appendChild(m);
      }
      if (info.abstract) {
        const a = document.createElement("div");
        a.className = `${id}-hc-abs`; a.textContent = info.abstract;
        body.appendChild(a);
      }
      hovercard.appendChild(body);
      positionCard(cardEl);
      hovercard.classList.add("show");
    }
    if (canHover) {
      resultsContainer.addEventListener("mouseover", (e) => {
        const card = e.target.closest(`.${id}-paper`);
        if (!card) return;
        cancelHide();
        if (card === hoverCurrent && hovercard.classList.contains("show")) return;
        loadHoverData();
        clearTimeout(showTimer);
        hoverCurrent = card;
        showTimer = setTimeout(() => { if (hoverCurrent === card) showCard(card); }, 350);
      });
      resultsContainer.addEventListener("mouseout", (e) => {
        const card = e.target.closest(`.${id}-paper`);
        if (!card) return;
        const to = e.relatedTarget;
        if (to && (card.contains(to) || hovercard.contains(to))) return;
        clearTimeout(showTimer);
        scheduleHide();
      });
      hovercard.addEventListener("mouseenter", cancelHide);
      hovercard.addEventListener("mouseleave", (e) => {
        const to = e.relatedTarget;
        if (to && to.closest && to.closest(`.${id}-paper`)) return;
        scheduleHide();
      });
      window.addEventListener("scroll", () => { if (hoverCurrent) hideCard(); }, { passive: true });
    }

    // Tags are collapsed by default to save space; toggle to reveal the pills.
    tagsToggle.addEventListener("click", () => {
      const open = tagsContainer.classList.toggle("open");
      tagsToggle.classList.toggle("open", open);
      tagsToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    function updateTagCount() {
      tagCountEl.textContent = activeTags.size ? `· ${activeTags.size} selected` : "";
    }

    // Render tag pills with category labels
    let lastCat = -1;
    for (const tag of sortedTags) {
      const cat = TAG_CAT(tag);
      if (cat !== lastCat) {
        lastCat = cat;
        const label = document.createElement("span");
        label.className = `${id}-tag-cat`;
        label.textContent = TAG_CAT_LABELS[cat] || "";
        tagsContainer.appendChild(label);
      }
      const pill = document.createElement("span");
      pill.className = `${id}-tag`;
      pill.textContent = `${tag} (${allTags[tag]})`;
      pill.addEventListener("click", () => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
        } else {
          activeTags.add(tag);
        }
        updateTagStyles();
        updateTagCount();
        renderResults();
      });
      pill.dataset.tag = tag;
      tagsContainer.appendChild(pill);
    }

    // Year buttons removed to save space

    // Search input
    searchInput.addEventListener("input", (e) => {
      searchText = e.target.value.toLowerCase();
      renderResults();
    });

    function updateTagStyles() {
      tagsContainer.querySelectorAll(`.${id}-tag`).forEach((el) => {
        el.classList.toggle("active", activeTags.has(el.dataset.tag));
      });
    }

    function updateYearStyles() {
      if (!yearsContainer) return; // year buttons were removed to save space
      yearsContainer.querySelectorAll(`.${id}-year-btn`).forEach((el) => {
        el.classList.toggle("active", activeYears.has(parseInt(el.dataset.year)));
      });
    }

    function filterPapers() {
      return papers.filter((p) => {
        // Search filter — matches title, authors, and journal
        if (searchText && !p._search.includes(searchText)) {
          return false;
        }
        // Tag filter (AND: paper must have ALL active tags)
        if (activeTags.size > 0) {
          for (const t of activeTags) {
            if (!p.tags.includes(t)) return false;
          }
        }
        // Year filter (OR: paper must be in ANY active year)
        if (activeYears.size > 0 && !activeYears.has(p.year)) {
          return false;
        }
        return true;
      });
    }

    function escHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function formatAuthors(authors) {
      if (!authors || authors.length === 0) return "";
      if (authors.length <= 6) return authors.join(", ");
      return authors.slice(0, 5).join(", ") + ", ... " + authors[authors.length - 1];
    }

    function renderResults() {
      hideCard();
      const filtered = filterPapers();
      const hasFilters = searchText || activeTags.size > 0 || activeYears.size > 0;

      // Stats line
      let statsHtml = `Showing ${filtered.length} of ${papers.length} publications`;
      if (hasFilters) {
        statsHtml += `<span class="${id}-clear">Clear filters</span>`;
      }
      statsContainer.innerHTML = statsHtml;

      const clearBtn = statsContainer.querySelector(`.${id}-clear`);
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          searchText = "";
          searchInput.value = "";
          activeTags.clear();
          activeYears.clear();
          updateTagStyles();
          updateYearStyles();
          updateTagCount();
          renderResults();
        });
      }

      // Group by year
      const byYear = {};
      for (const p of filtered) {
        if (!byYear[p.year]) byYear[p.year] = [];
        byYear[p.year].push(p);
      }

      let html = "";
      for (const year of sortedYears) {
        if (!byYear[year]) continue;
        html += `<div class="${id}-year-heading">${year} (${byYear[year].length})</div>`;
        for (const p of byYear[year]) {
          const tagsHtml = p.tags
            .map((t) => `<span class="${id}-paper-tag">${escHtml(t)}</span>`)
            .join("");

          const authorsStr = formatAuthors(p.authors || []);
          const journal = p.journal || "";
          let metaParts = [];
          if (authorsStr) metaParts.push(escHtml(authorsStr));
          if (journal) metaParts.push(`<span class="${id}-paper-journal">${escHtml(journal)}</span>`);

          html += `<div class="${id}-paper" data-pidx="${p._idx}">`;
          html += `<a href="${p.url}" target="_blank" rel="noopener">${escHtml(p.title)}</a>`;
          if (tagsHtml) html += `<span class="${id}-paper-tags">${tagsHtml}</span>`;
          if (metaParts.length) html += `<div class="${id}-paper-meta">${metaParts.join(" · ")}</div>`;
          html += `</div>`;
        }
      }

      if (filtered.length === 0) {
        html = `<div style="color: #6b7280; padding: 2em 0; text-align: center;">No papers match your filters.</div>`;
      }

      resultsContainer.innerHTML = html;
    }

    // Initial render
    renderResults();
  }
}

export default { render };
