# Style guide

Rules for every page on aydinmohseni.com, adapted from the ∃xProof AI style guide. Follow them when adding content, and run the checks (last section) before pushing. The live reference for every component is the style guide page at `/styleguide/`. It and the model test pages in `src/lab/` are development pages, left out of the published build: build them with `DEV_PAGES=1 npx eleventy --serve`.

## 1. Layout rules

### Zones

Every section is laid out on one grid with three zones, left to right:

| Zone | Width | What goes there |
|---|---|---|
| Rail | 8.5rem | The section label only (small capitals, `.label`). |
| Text column | up to 34rem (about 65 characters) | All content: prose, headings, lists, tables, figures, models, grids. |
| Margin column | 15rem (12rem below 1100px) | Margin notes only (`.sidenote`, `.marginnote`). |

The gap between zones is 2.5rem. The root font size is 17px, 18px from 1200px; body text is 1.15rem with a line height of 1.5.

### Section types

- **Text section** (`<section class="section">`, the default; the `section()` macro in `src/_includes/partials/macros.njk`). Content stays inside the text column. Only margin notes enter the margin column. Use this for prose, lists of works, models and anything with margin notes.
- **Wide section** (`<section class="section section--wide">`, `section(label, id, wide=true)`). There is no margin column; content spans the text and margin columns together. Margin notes are not allowed and are hidden if present. Use this only for grids of short, parallel items, such as the research strands or the co-inquirers.

A section is one type or the other, never both. Nothing reaches into another zone by negative margins; margin notes are the only elements with a negative margin.

### Vertical rhythm and rules

- **No hairlines between text.** Sections, list items and works have no dividing lines.
- **No rules between sections.** The only horizontal line on a page is the one under the masthead, at half the strength of `--rule-strong`. Tables keep their internal rules.
- **Cap lines align.** The tops of the capitals of a rail label run level with the tops of the capitals of the first line beside it (or the top of a photo), and, on the Research page, with the year and the title of each entry. The label's offset depends on what the section body starts with (see the `--label-pt` rules in `site.css`). Check after changing any type size.
- **Link targets land below the menu.** A linked item (`#pub-<slug>`, `#talks`) stops so its first line sits level with the pinned section label, just below the menu bar.
- **Closing notes sit midway.** A closing note (`p.more` as the last element of a section body, such as "All research") sits centered between the element above it and the section's lower edge. Do not give it its own margins.

### Figures, tables, models

1. First ask whether the content can be said in a sentence. A formal statement belongs in the text as a `.scheme` block, not as a diagram.
2. A table must fit the text column. Three columns is the practical limit there. A wider table goes in its own wide section, or is split.
3. A table or code block that can grow wider than its column goes inside `<div class="table-wrap">`, which scrolls sideways within the column.
4. Captions are labeled by kind and numbered within the page: "Table 1", "Figure 1".
5. No figure, table, model or image goes in the margin column.
6. A live model is a `<figure class="model">` mounted by its ES module. It carries an `aria-label`, a text description, and a "How it works" disclosure.

### Responsive behavior

| Viewport | Behavior |
|---|---|
| over 1100px | Full three-zone grid. |
| 860 to 1100px | Margin column narrows to 12rem. Grids drop to two columns. |
| under 860px | One column. The rail label sits above each section. Margin notes become numbered toggles that open in place. Grids stack. |
| under 560px | Header is no longer sticky. Lists of works stack their metadata above the title. |

### Clipping

- Every grid or flex child that holds text has `min-width: 0`, so long text wraps instead of overflowing.
- Labels, metadata and addresses wrap anywhere if needed (`overflow-wrap: anywhere`).
- No element has a fixed width larger than its column.

## 2. Type

Every face is Computer Modern (CMU, SIL Open Font License), self-hosted in `src/assets/fonts/`.

| Role | Face | Use |
|---|---|---|
| Text and headings | CMU Serif | Body text, headings, questions, the scheme block, the wordmark. |
| Labels and metadata | CMU Sans Serif | Navigation, section labels, author lines, dates, buttons, model controls. |
| Code | CMU Typewriter Text | Code and other monospace roles. |

Computer Modern is thin on screens: keep the sizes in `site.css`, never synthesize bold or italic (`font-synthesis: none`), and check rendering at 100% zoom. Headings are plain and descriptive. Section labels are one or two words in small capitals. Italic marks emphasis, titles, terms being defined, and variables in running text.

## 3. Color

Day (paper) is the default. Night uses the ∃xProof AI palette exactly. A reader's choice is stored by the Night/Day button; otherwise the system setting decides.

| Token | Day | Night | Use |
|---|---|---|---|
| `--bg` | #fcfcfa | #050505 | Page background. |
| `--fg` | #141413 | #f5f5f2 | Primary text, links at rest. |
| `--fg-2` | #5d5d58 | #b8b8b3 | Secondary text, metadata, labels. |
| `--rule`, `--rule-strong` | #e2e2dc, #a9a9a2 | #2c2c2a, #6c6c68 | `--rule` inside tables and the citation box; `--rule-strong` (at half strength) for the masthead line. Never for text. |
| `--red`, `--red-bright` | #b0122b, #d11c3d | same | Link hover, the current page, the wordmark Δ, converged or winning states in models. Not for small body text. |
| `--green` | #1a7f4e | #1fa463 | A found or converged path in a model only. |
| `--chalk` | #2b2b29 | #d8d8d2 | Model strokes. |

Body text contrast is at least 4.5:1 in both themes. The paper grain behind the page sits at 4% opacity by day and 2.5% by night and never moves. Text, controls and tables stay crisp.

## 4. The wordmark

"Aydin Mohseni" in CMU Serif, preceded by a red Δ (the simplex). The Δ is always red; on hover the whole wordmark turns red. In page titles and meta descriptions, where styling is impossible, write the plain name.

## 5. Writing

- State only what is true and confirmed. Never invent a fact, date, venue, co-author, quotation, URL or description of Aydin's views. Mark anything unconfirmed with `data-verify="what needs confirming"` and check the page with `#review` appended to its address before publishing. Record unknowns in `docs/OPEN-QUESTIONS.md`.
- Plain, direct sentences. No em dashes, anywhere (content, comments, alt text): use commas, colons or parentheses. No slogans, clever turns or hype words.
- One term per concept, used consistently across pages.
- Link each co-inquirer's name to their personal website wherever it appears (from `coinquirers.yml`). Leave it unlinked if no URL is confirmed. In essay data (`strands.yml`) this is automatic: the `linkPhrases` filter links every `display` name it finds.
- One name per person. The full author lines on the Research page print each name as the publication record gives it (Crossref, arXiv, or the CV for unpublished work: "Alex John London", "Daniel A. Herrmann"), because they are citations. Everywhere else (essays, "With ..." lines, talk co-presenters, workshop pages, the sketchbook) uses the person's `display` form from `coinquirers.yml` ("Alex J. London", "Daniel Herrmann", "Benjamin A. Levinstein", "Kevin Zollman"). For London and Levinstein the display form is the one in exproof.ai's README name table.
- Write "∃xProof AI" in data as plain text; templates render it with the `exproofName` filter (a hidden ∃ and a visually hidden "E"), so screen readers say "ExProof AI" everywhere.
- Shared material: where a work also appears on exproof.ai, its summary opens with exproof.ai's sentence word for word; anything added after it names its source in `summary_sources`.
- Citations come from publisher records (Crossref, the journal, arXiv) first, then the CV.
- Every image has alt text that says what it shows. Purely decorative images take `alt=""`.
- Every internal URL goes through Eleventy's `url` filter: `{{ '/research/' | url }}`.

## 6. Checks

Build first, then run from the repository root:

```
npx eleventy
node tools/check.mjs --allow-missing /cv.pdf
node tools/check_layout.mjs
node tools/check_consistency.mjs
```

`tools/check_layout.mjs` loads every page at 390, 768, 1024, 1280 and 1600 pixels wide, in day and night, and fails if:

1. any page scrolls sideways;
2. anything other than a margin note extends past the text column in a text section;
3. anything extends past its section in a wide section;
4. two margin notes overlap;
5. any text is clipped by its container;
6. the theme's background did not apply.

`tools/check.mjs` fails on broken internal links, images without alt text, em dashes, and pages missing a title, description or Open Graph tags. `tools/check_consistency.mjs` prints differences between `publications.yml`, the CV and the ∃xProof AI Publications page; it never fails the build.
