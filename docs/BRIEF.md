# Build brief: aydinmohseni.com rebuild

Every agent working on this repository reads this file first. It is the contract between workstreams.

## Goal

Replace the WordPress site at aydinmohseni.com (InMotion) with a static site in this repository, deployed by GitHub Pages. The site must be an elevated, streamlined, excellent experience: beautiful, fast, accurate, and effortless to maintain.

- **Look and feel:** the design language of exproof.ai (repo cloned at `/home/claude/xproof`; read `DESIGN.md`, `STYLE.md`, `assets/site.css`, `assets/search.js`, and the HTML pages), with three changes: white paper ground by default (the exproof.ai black palette becomes the Night mode), every typeface Computer Modern, and a very faint chalk-on-paper feel.
- **Organization and content model:** danielherrmann.ca (fetch it with WebFetch: `https://www.danielherrmann.ca/`, `/publications.html`, `/about.html`, `/contact.html`). Home page carries the argument: intro, a live model, research strands each with a live model + short essay + selected work, recent talks, co-inquirers, influences, contact. Daniel has explicitly approved reuse of anything from his site.
- **Content:** Aydin Mohseni, assistant professor of philosophy at CMU. Sources of truth, in order: publisher records (Crossref, journal pages, arXiv) for citations; the CV at `cv/amohseni.CV.tex` (current, 26 Oct 2026) for everything else; the old site (fetch `https://aydinmohseni.com/...` with WebFetch; curl is blocked) for descriptions, links and files; exproof.ai for shared program descriptions.

## Hard rules

1. **No em dashes** anywhere (content, comments, alt text). Use commas, colons, parentheses.
2. **No fabrication.** Never invent a fact, date, venue, co-author, quotation, URL, or description of Aydin's views. If something is unknown, leave it out and record it in `docs/OPEN-QUESTIONS.md` (append; create if absent). Mark anything unconfirmed in HTML with `data-verify` so the review can find it.
3. **Plain, direct sentences.** No slogans, no clever turns, no hype words. One term per concept.
4. **Accessibility:** semantic HTML, alt text on images, visible focus, `prefers-reduced-motion` respected (animations show a still frame), contrast at least 4.5:1 for body text in both themes.
5. **Performance:** no frameworks, no runtime CDN dependencies. Plain JS modules, canvas or SVG. Pages pause animation when off screen or tab hidden.
6. **Paths:** every internal URL goes through Eleventy's `url` filter (`{{ '/research/' | url }}`), because the preview is served under a path prefix before the domain moves.
7. **Stay in your lane.** Write only the files your workstream owns (below). If you need something from another workstream, write the request into `docs/OPEN-QUESTIONS.md`.

## Stack

Eleventy 3 (already installed; `npx eleventy` builds `src/` to `_site/`). Nunjucks templates. Data in `src/_data/*.yml`. Static assets in `src/assets/` (copied to `/assets/`). Old WordPress uploads will be placed at `src/wp-content/uploads/...` with their exact original paths (copied to `/wp-content/uploads/...`), so old PDF links keep working. Serve locally with `npx eleventy --serve --port 8080` or `npx eleventy && python3 -m http.server -d _site 8765`. Playwright and Chromium are preinstalled (`require('playwright')`; never run `playwright install`).

## Design system (exact)

- **Grid** (copy from exproof.ai `site.css`): label rail 8.5rem, text column up to 34rem, margin column 15rem (12rem under 1100px), gap 2.5rem; `.page` max width and paddings as exproof.ai; breakpoints 1100 / 860 / 560; root font 17px, 18px from 1200px; body 1.15rem/1.5. Section types `.section` and `.section--wide` with the same rules as exproof.ai `STYLE.md`. Masthead sticky with one half-strength rule. No rules between sections. Cap-line alignment of rail labels. Margin notes (`.sidenote`, `.marginnote`) behave as on exproof.ai, including numbered toggles on phones.
- **Type:** fonts in `src/assets/fonts/` (self-hosted woff2 subsets, SIL OFL). `CMU Serif` (400 = file 500-roman/italic, 700 = file 700-roman/italic) for text and headings, replacing ET Book. `CMU Sans Serif` for labels, navigation and metadata, replacing IBM Plex Sans. `CMU Typewriter Text` for code and monospace roles. Fallback stack: `"Latin Modern Roman", "Computer Modern", Georgia, serif`. Computer Modern is thin on screens: keep exproof sizes, `font-synthesis: none`, and check rendering at 100% zoom.
- **Color tokens** (light default; dark under `prefers-color-scheme: dark` unless `[data-theme="light"]`, and under `[data-theme="dark"]`):
  - light: `--bg #fcfcfa` (paper), `--fg #141413` (ink), `--fg-2 #5d5d58` (graphite), `--rule #e2e2dc`, `--rule-strong #a9a9a2`, `--red #b0122b`, `--red-bright #d11c3d`, `--green #1a7f4e`, `--chalk #2b2b29` (animation strokes).
  - dark: exactly exproof.ai's values (`--bg #050505`, `--fg #f5f5f2`, `--fg-2 #b8b8b3`, `--rule #2c2c2a`, `--rule-strong #6c6c68`, `--red #b0122b`, `--red-bright #d11c3d`, `--green #1fa463`, `--chalk #d8d8d2`).
  - Links: ink at rest, red on hover (exproof.ai behavior). Red marks the current page, the wordmark Δ, and converged or winning states in models. Green only for a found or converged path in animations.
- **Theme toggle:** a small "Night"/"Day" text button in the masthead (as on danielherrmann.ca), stored in `localStorage` (wrapped in try/catch), applied before first paint by a tiny inline script in `<head>`.
- **Wordmark:** "Aydin Mohseni" in CMU Serif, preceded by a red Δ (the simplex symbol, playing the role of the red ∃ on exproof.ai). Whole wordmark turns red on hover.
- **Chalk on paper, very subtle:** (a) a fixed paper-grain layer from an inline SVG `feTurbulence` at about 4% opacity in light mode, 2.5% in dark, never animated; (b) model strokes in `--chalk` with slight width variation and a fine grain, so lines look drawn; (c) nothing else. Text, controls, tables stay crisp.
- **Animation vocabulary** (from exproof.ai `search.js`): thin lines, one moving light (core + soft glow) in red, quintic smootherstep easing, brief holds at events, gray traces that stay, green sweep when something converges, dimmed under the text column when used as background, a single still frame under reduced motion, paused off screen.

## Pages and URLs

| URL | Page | Notes |
|---|---|---|
| `/` | Home | Intro (photo `src/assets/img/mohseni.jpg`, from exproof.ai), one line "Scientific philosopher" plus a short bio; hero model (chaos); three research strands; recent and upcoming talks (from data, by date); co-inquirers; influences; contact |
| `/research/` | Research | exproof.ai `publications.html` structure: Published, Under review, In progress, Talks, Workshops; count line with jump links; one anchor per work `#pub-<slug>`; filters optional |
| `/models/` | Computational models | Research models and teaching models; thumbnail, summary, app link, code link, related paper |
| `/teaching/` | Teaching | University courses, summer schools and short courses, teaching training (condensed) |
| `/workshops/ai-agency-2026/`, `/workshops/metascience-2025/` | One page per workshop | Listed in Research > Workshops |
| `/sketchbook/` | Sketchbook | Infographics (with their papers) and sketches |
| `/about/` | About | Full bio, appointments, education, Peace Corps, Erdős number, profiles, contact, colophon |
| `/cv.pdf` | CV | Built by CI from `cv/amohseni.CV.tex` |
| `/meet/` | Redirect | Instant meta refresh + JS to `https://calendar.app.google/pe98GGpL8dwdoqbp6` |
| old URLs | Redirect stubs | `/research/` stays; `/talks/` → `/research/#talks`; `/teaching-2/` → `/teaching/`; `/computational-models/` → `/models/`; `/infographics/` and `/sketches/` → `/sketchbook/`; `/ai-agency-workshop/` → `/workshops/ai-agency-2026/`; `/formal-models-in-science-workshop/` → `/workshops/metascience-2025/` |

Navigation: Research, Models, Teaching, Sketchbook, About, CV, ∃xProof AI (external, https://exproof.ai/), theme toggle. Footer repeats navigation, email `amohseni [at] cmu [dot] edu` (obfuscated, as now), Google Scholar `https://scholar.google.com/citations?user=CvN3cf4AAAAJ&hl=en`, GitHub `https://github.com/amohseni`, PhilPeople and ORCID only if verified, and a one-line colophon (Computer Modern by Donald Knuth; design shared with ∃xProof AI).

## Research strands (from the CV's research summary)

1. **AI safety:** AI agent foundations, value learning and alignment, automated research. Model: hypothesis-space refinement. Link the related ∃xProof AI program pages.
2. **Metascience:** grant funding, the replication crisis, the social epistemology of science. Model: a community sharing evidence on a network.
3. **Methods** (formal epistemology and game theory): Bayesian epistemology, decision theory, evolutionary game theory. Model: reflection.

The hero above the strands is chaos on the simplex. Essays: two or three short paragraphs each, built only from the descriptions in Aydin's own papers, abstracts, old-site text, CV, and exproof.ai. Do not attribute views he has not stated.

## Influences section (Aydin's choices, 30 Oct 2026)

- Kahlil Gibran, "On Children," from *The Prophet* (1923; public domain in the US). May be quoted in full; use the 1923 Knopf text exactly.
- Jorge Luis Borges: "The Library of Babel," "The Lottery in Babylon," "Pierre Menard, Author of the Quixote," and "On Exactitude in Science" (the map as large as the territory). These translations are under copyright: give each title, the year, and one plain sentence of our own on what the story is about; at most one short quoted sentence per story, attributed to a named translation. No long quotation.

## Models (canvas, one ES module each, in `src/assets/js/models/`)

Each model exports `mount(container, options)` and builds its own canvas, controls and a "How it works" disclosure (as on danielherrmann.ca). Controls in CMU Sans Serif, small, minimal. Each must: resize crisply (devicePixelRatio), pause off screen and when the tab is hidden, honor reduced motion, read colors from CSS tokens at draw time (so theme switches apply live), have an `aria-label` and a text description.

1. `chaos.js`: replicator dynamics x_i' = x_i((Ax)_i - x·Ax) for the 4-strategy game A = [[0,-12,0,22],[20,0,0,-10],[-21,-4,0,35],[10,-2,2,0]] (Arneodo, Coullet and Tresser 1980 via Hofbauer's equivalence; as presented in Sandholm 2010; confirm the citation). Uniform point is the interior equilibrium; orbits started near it stay interior and trace a strange attractor (largest Lyapunov exponent about 0.16 verified with RK4, h = 0.002). Orbits started far away go to the boundary, so restrict start points to a neighborhood of the equilibrium. Draw in the 3-simplex (tetrahedron) with slow rotation. Two modes: `background` (full-page, behind content, dimmed under text column, like exproof.ai's search tree) and `hero` (in-page, with controls: restart from a new nearby point, speed, rotate by drag; "How it works": why 4 strategies is the minimal number for chaos in replicator dynamics, Poincaré–Bendixson, sources Skyrms 1992 "Chaos in game dynamics", Arneodo et al. 1980, Hofbauer 1981, Sandholm 2010).
2. `reflection.js`: van Fraassen's Reflection principle, P(A | P_later(A) = x) = x. A Bayesian agent's credence that a coin is biased toward heads (two hypotheses), current value marked; a fan of simulated future credence paths (gray chalk) spreading toward 0 and 1; their running mean in red stays level (martingale). Toggle "an agent who expects to change its mind": its forecast mean drifts, and the text notes that drift exposes it to a Dutch book. Sources: van Fraassen 1984 "Belief and the Will".
3. `hypotheses.js`: a hypothesis space as a partition (e.g. a horizontal band or treemap) of named hypotheses plus a catch-all, shaded by posterior; evidence arrives and mass moves; when the catch-all's mass passes a threshold it splits into new hypotheses, so the algebra refines. Ties to value learning with a catch-all and "Learning the Value of Value Learning" (London and Mohseni, arXiv:2511.17714). Must be mathematically honest: Bayesian updating within the current algebra; refinement redistributes the catch-all's mass among new cells and the catch-all's remainder, preserving total probability.
4. `community.js`: agents on a network each hold a credence about which of two actions is better, run experiments, share results with neighbors, update by Bayes (the Bala–Goyal / Zollman network epistemology model). Show convergence to the true belief (green) or lock-in on the worse action. Toggle: everyone sees all evidence vs neighbors only. Cite Zollman 2007 and Aydin's related work (Mohseni and Williams, "Truth and Conformity on Networks").

## File ownership

| Workstream | Owns |
|---|---|
| Design | `src/assets/css/`, `src/_includes/` (layouts, partials), `src/assets/js/site.js`, `src/assets/js/theme.js` |
| Chaos model | `src/assets/js/models/chaos.js`, `src/assets/js/models/common.js` (shared helpers: canvas sizing, tokens, visibility, smootherstep), `src/assets/js/background.js` |
| Agency models | `src/assets/js/models/reflection.js`, `src/assets/js/models/hypotheses.js` |
| Metascience model | `src/assets/js/models/community.js` |
| Content data | `src/_data/*.yml`, `docs/CONTENT-AUDIT.md` |
| Infrastructure | `.github/workflows/`, `cv/` build, `tools/`, `src/CNAME` (not yet), redirect stub pages, `README.md`, `STYLE.md`, `DESIGN.md`, `MAINTAINING.md` |
| Integration (later) | the page templates in `src/*.njk`, `src/**/index.njk`, and fixes anywhere |

`common.js` is owned by the chaos workstream; other model authors may import it but write a local helper if it is not there yet.

## Data schemas (YAML in `src/_data/`)

- `profile.yml`: name, tagline, short_bio (home), long_bio (about, paragraphs), email_obfuscated, links (scholar, github, osf, philpeople, orcid where verified), appointments, education, booking_url.
- `publications.yml`: list of works: `slug`, `title`, `authors` (list, in the paper's order, Aydin marked by name match), `year`, `status` (published | under-review | in-progress), `venue`, `volume`, `issue`, `pages`, `doi`, `links` (pdf, journal, arxiv, philsci, model, code, data), `strand` (ai-safety | metascience | methods), `selected` (bool, for home), `summary` (one or two sentences, sourced), `exproof` (URL of related ∃xProof AI page, if any), `verified` (source used: crossref | journal | arxiv | cv).
- `talks.yml`: list: `title`, `paper_slug` (if any), `venue`, `city`, `date` (YYYY or YYYY-MM-DD as known), `invited` (bool), `video` (url).
- `models.yml`: `slug`, `title`, `kind` (research | teaching), `summary`, `app`, `code`, `paper_slug`, `image` (path).
- `teaching.yml`: courses (title, institution, terms), short_courses, training (condensed).
- `workshops.yml`: per workshop: slug, title, dates, place, hosts, speakers (name, affiliation, url), description, program_pdf, registration.
- `coinquirers.yml`: collaborators with personal URLs (reuse the URL table in exproof.ai `README.md`, verify others) and the works shared.
- `sketchbook.yml`: infographics (title, images, paper link) and sketches.
- `influences.yml`: as specified above.
- `strands.yml`: the three strands: title, slug, essay paragraphs, model id, selected work slugs.
