// paper-list.js — ESM module for searchable/filterable publication list (MyST any:bundle)

function render({ model, el }) {
  const dataUrl = model.get("data_url") || "";
  const accentColor = model.get("accent_color") || "#8C1515";
  const accentColorDark = model.get("accent_color_dark") || "#E8A0A0";

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
    .${id}-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4em;
      margin-bottom: 0.6em;
    }
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
      color: #111;
    }
    .${id}-paper {
      padding: 0.5em 0;
      line-height: 1.5;
    }
    .${id}-paper a {
      color: ${accentColor};
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

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .${id}-search {
        background: #1f2937;
        color: #e5e7eb;
        border-color: #4b5563;
      }
      .${id}-search:focus {
        border-color: ${accentColorDark};
        box-shadow: 0 0 0 2px ${accentColorDark}33;
      }
      .${id}-tag {
        background: #1f2937;
        color: #d1d5db;
        border-color: #4b5563;
      }
      .${id}-tag:hover {
        border-color: ${accentColorDark};
        color: ${accentColorDark};
      }
      .${id}-tag.active {
        background: ${accentColorDark};
        color: #111;
        border-color: ${accentColorDark};
      }
      .${id}-year-btn {
        background: #1f2937;
        color: #9ca3af;
        border-color: #4b5563;
      }
      .${id}-year-btn:hover {
        border-color: ${accentColorDark};
        color: ${accentColorDark};
      }
      .${id}-year-btn.active {
        background: ${accentColorDark};
        color: #111;
        border-color: ${accentColorDark};
      }
      .${id}-year-heading {
        color: #e5e7eb;
        border-bottom-color: ${accentColorDark};
      }
      .${id}-paper a {
        color: ${accentColorDark};
      }
      .${id}-paper-meta {
        color: #9ca3af;
      }
      .${id}-clear {
        color: ${accentColorDark};
      }
      .${id}-stats {
        color: #9ca3af;
      }
      .${id}-paper-tag {
        background: #374151;
        color: #9ca3af;
      }
      .${id}-loading {
        color: #9ca3af;
      }
    }
    /* Class-based dark mode (Curvenote) */
    [data-theme="dark"] .${id}-search,
    .dark .${id}-search {
      background: #1f2937;
      color: #e5e7eb;
      border-color: #4b5563;
    }
    [data-theme="dark"] .${id}-tag,
    .dark .${id}-tag {
      background: #1f2937;
      color: #d1d5db;
      border-color: #4b5563;
    }
    [data-theme="dark"] .${id}-tag:hover,
    .dark .${id}-tag:hover {
      border-color: ${accentColorDark};
      color: ${accentColorDark};
    }
    [data-theme="dark"] .${id}-tag.active,
    .dark .${id}-tag.active {
      background: ${accentColorDark};
      color: #111;
      border-color: ${accentColorDark};
    }
    [data-theme="dark"] .${id}-year-btn,
    .dark .${id}-year-btn {
      background: #1f2937;
      color: #9ca3af;
      border-color: #4b5563;
    }
    [data-theme="dark"] .${id}-year-btn:hover,
    .dark .${id}-year-btn:hover {
      border-color: ${accentColorDark};
      color: ${accentColorDark};
    }
    [data-theme="dark"] .${id}-year-btn.active,
    .dark .${id}-year-btn.active {
      background: ${accentColorDark};
      color: #111;
      border-color: ${accentColorDark};
    }
    [data-theme="dark"] .${id}-year-heading,
    .dark .${id}-year-heading {
      color: #e5e7eb;
      border-bottom-color: ${accentColorDark};
    }
    [data-theme="dark"] .${id}-paper a,
    .dark .${id}-paper a {
      color: ${accentColorDark};
    }
    [data-theme="dark"] .${id}-paper-meta,
    .dark .${id}-paper-meta {
      color: #9ca3af;
    }
    [data-theme="dark"] .${id}-clear,
    .dark .${id}-clear {
      color: ${accentColorDark};
    }
    [data-theme="dark"] .${id}-stats,
    .dark .${id}-stats {
      color: #9ca3af;
    }
    [data-theme="dark"] .${id}-paper-tag,
    .dark .${id}-paper-tag {
      background: #374151;
      color: #9ca3af;
    }
  `;
  el.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = `${id}-wrap`;
  wrap.innerHTML = `<div class="${id}-loading">Loading publications...</div>`;
  el.appendChild(wrap);

  fetch(dataUrl)
    .then((r) => r.json())
    .then((papers) => buildUI(papers))
    .catch((err) => {
      wrap.innerHTML = `<div style="color:red;">Failed to load papers: ${err.message}</div>`;
    });

  function buildUI(papers) {
    // Pre-build search index: lowercase title + authors + journal
    for (const p of papers) {
      p._search = [
        p.title,
        (p.authors || []).join(" "),
        p.journal || ""
      ].join(" ").toLowerCase();
    }

    // Collect all tags and years
    const allTags = {};
    const allYears = new Set();
    for (const p of papers) {
      allYears.add(p.year);
      for (const t of p.tags) {
        allTags[t] = (allTags[t] || 0) + 1;
      }
    }
    const sortedTags = Object.entries(allTags)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
    const sortedYears = [...allYears].sort((a, b) => b - a);

    let activeTags = new Set();
    let activeYears = new Set();
    let searchText = "";

    wrap.innerHTML = `
      <div class="${id}-controls">
        <input class="${id}-search" type="text" placeholder="Search by title, author, or journal..." />
        <div class="${id}-tags"></div>
        <div class="${id}-years"></div>
        <div class="${id}-stats"></div>
      </div>
      <div class="${id}-results"></div>
    `;

    const searchInput = wrap.querySelector(`.${id}-search`);
    const tagsContainer = wrap.querySelector(`.${id}-tags`);
    const yearsContainer = wrap.querySelector(`.${id}-years`);
    const statsContainer = wrap.querySelector(`.${id}-stats`);
    const resultsContainer = wrap.querySelector(`.${id}-results`);

    // Render tag pills
    for (const tag of sortedTags) {
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
        renderResults();
      });
      pill.dataset.tag = tag;
      tagsContainer.appendChild(pill);
    }

    // Render year buttons
    for (const year of sortedYears) {
      const btn = document.createElement("span");
      btn.className = `${id}-year-btn`;
      btn.textContent = year;
      btn.addEventListener("click", () => {
        if (activeYears.has(year)) {
          activeYears.delete(year);
        } else {
          activeYears.add(year);
        }
        updateYearStyles();
        renderResults();
      });
      btn.dataset.year = year;
      yearsContainer.appendChild(btn);
    }

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

          html += `<div class="${id}-paper">`;
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
