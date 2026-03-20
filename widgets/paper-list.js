// paper-list.js — ESM module for searchable/filterable publication list (MyST any:bundle)

function render({ model, el }) {
  const dataUrl = model.get("data_url") || "";
  const accentColor = model.get("accent_color") || "#8C1515";

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
      padding: 0.4em 0;
      line-height: 1.5;
    }
    .${id}-paper a {
      color: ${accentColor};
      text-decoration: none;
    }
    .${id}-paper a:hover {
      text-decoration: underline;
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
    }
    .${id}-loading {
      color: #6b7280;
      font-style: italic;
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
        <input class="${id}-search" type="text" placeholder="Search papers by title..." />
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
        // Search filter
        if (searchText && !p.title.toLowerCase().includes(searchText)) {
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
            .map((t) => `<span class="${id}-paper-tag">${t}</span>`)
            .join("");
          // Clean up LaTeX in title for display
          const displayTitle = p.title;
          html += `<div class="${id}-paper"><a href="${p.url}" target="_blank" rel="noopener">${displayTitle}</a>${tagsHtml ? `<span class="${id}-paper-tags">${tagsHtml}</span>` : ""}</div>`;
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
