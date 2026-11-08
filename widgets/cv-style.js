// cv-style.js — colour and spacing for the CV page (cv.md).
// The theme strips <style> from markdown, so this widget adds a stylesheet to
// <head>. Selectors key off the widget's own host element with :has(), so the
// rules switch off by themselves when the reader navigates to another page.
// Light and dark palettes are plain CSS, so the theme toggle needs no JS.

const STYLE_ID = "colab-cv-style";
const PAGE = "article:has([data-cv-style])";

const CSS = `
  ${PAGE} {
    --cv-accent: #b0181e;
    --cv-accent-soft: #b0181e22;
    --cv-title: #00677a;
    --cv-muted: #5b6472;
    --cv-pill-fg: #ffffff;
  }
  html.dark ${PAGE} {
    --cv-accent: #e8a3a3;
    --cv-accent-soft: #e8a3a333;
    --cv-title: #72cfdf;
    --cv-muted: #a3acba;
    --cv-pill-fg: #2a0c0c;
  }

  ${PAGE} h2 {
    color: var(--cv-accent);
    border-bottom: 2px solid var(--cv-accent-soft);
    padding-bottom: 0.25em;
  }

  /* Year labels, which are paragraphs holding only a bold year. */
  ${PAGE} p:not(li p):has(> strong:only-child) {
    margin: 1.8em 0 0.6em;
  }
  ${PAGE} p:not(li p) > strong:only-child {
    display: inline-block;
    padding: 0.1em 0.75em;
    border-radius: 999px;
    background: var(--cv-accent);
    color: var(--cv-pill-fg);
    font-size: 0.9em;
    font-variant-numeric: tabular-nums;
  }

  /* No bullets in any section. */
  ${PAGE} ul { list-style: none; padding-left: 0; }
  ${PAGE} ul ul { padding-left: 1.4em; margin-top: 0.2em; }
  ${PAGE} li { padding-left: 0; margin-bottom: 0.7em; }
  ${PAGE} li li { margin-bottom: 0.15em; }

  /* Paper numbers, dates, job titles and the highlighted C Ophus. */
  ${PAGE} li strong { color: var(--cv-accent); font-weight: 600; }

  /* Paper titles and other links. */
  ${PAGE} a.link { color: var(--cv-title); }
  ${PAGE} :is(li, td) a.link { text-decoration: none; font-weight: 500; }
  ${PAGE} :is(li, td) a.link:hover { text-decoration: underline; }
  ${PAGE} :is(li, td) a.link svg { display: none !important; }

  /* Journal names. */
  ${PAGE} li em { color: var(--cv-muted); }

  /* Invited talks: one chart per year, date column then talk. */
  ${PAGE} table { width: 100%; margin: 0; border-collapse: collapse; }
  ${PAGE} thead, ${PAGE} tr:has(> th) { display: none; }
  ${PAGE} tbody tr { border-bottom: 1px solid var(--cv-accent-soft); }
  ${PAGE} tbody tr:last-child { border-bottom: 0; }
  ${PAGE} tbody td { padding: 0.5em 0.75em 0.5em 0; vertical-align: top; }
  ${PAGE} tbody td:first-child {
    width: 8.5em;
    color: var(--cv-accent);
    font-weight: 600;
  }
  ${PAGE} tbody td:last-child { padding-right: 0; }
`;

function render({ el }) {
  const root = el.getRootNode();
  const host = root && root.host ? root.host : el;
  host.setAttribute("data-cv-style", "");
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
}

export default { render };
