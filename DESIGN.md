# Design notes

This site shares its design with [∃xProof AI](https://exproof.ai/) (repository `amohseni/Existential-Proof-AI-Safety-Website`). Its organization follows Daniel Herrmann's site, [danielherrmann.ca](https://www.danielherrmann.ca/), with his approval. The contract for the build is `docs/BRIEF.md`; this file records how the site follows exproof.ai and where it departs.

## What follows exproof.ai

- **Grid.** The three-zone grid is copied from exproof.ai's `site.css`: label rail 8.5rem, text column up to 34rem, margin column 15rem (12rem under 1100px), gap 2.5rem, breakpoints at 1100, 860 and 560 pixels, root font 17px (18px from 1200px), body text 1.15rem/1.5.
- **Section types.** Text sections and wide sections, with the same rules (see `STYLE.md`).
- **Rules and rhythm.** A sticky masthead with one half-strength rule; no rules between sections; rail labels aligned to the cap line of the text beside them; link targets that land below the menu; closing notes centered in the section's tail.
- **Margin notes.** Tufte-style sidenotes and margin notes, which become numbered toggles on phones.
- **Links.** Ink at rest, red on hover, no underline at rest. Red marks the current page.
- **Night palette.** Night mode uses exproof.ai's colors exactly.
- **Animation vocabulary.** From exproof.ai's `search.js`: thin lines, one moving light (a core with a soft glow) in red, quintic smootherstep easing, brief holds at events, gray traces that stay, a green sweep when something converges, dimming under the text column when a model runs behind the page, one still frame under reduced motion, and a pause when off screen.
- **Review mode.** Appending `#review` to any address highlights every element marked `data-verify`, as on exproof.ai.
- **Layout check.** `tools/check_layout.mjs` is a Node port of exproof.ai's `tools/check_layout.py`.
- **Publications structure.** The Research page follows exproof.ai's `publications.html`: Published, Under review, In progress, Talks and Workshops, with a count line and jump links under the title.

## Where this site departs from exproof.ai

1. **Paper by default.** The ground is white paper (`#fcfcfa`) with ink text (`#141413`). The exproof.ai black palette is the Night mode, chosen by the system setting or by a Night/Day button in the masthead (as on danielherrmann.ca). The choice is stored in `localStorage` and applied before first paint.
2. **Computer Modern throughout.** CMU Serif replaces ET Book, CMU Sans Serif replaces IBM Plex Sans, and CMU Typewriter Text serves code. The fonts are self-hosted; nothing loads from Google Fonts or any other CDN.
3. **A faint chalk-on-paper feel.** A fixed paper grain from an SVG `feTurbulence` filter sits behind the page at 4% opacity by day and 2.5% by night, never animated. Model strokes use `--chalk` with slight width variation and a fine grain, so lines look drawn. Nothing else carries texture.
4. **The wordmark.** "Aydin Mohseni" in CMU Serif, preceded by a red Δ (the simplex symbol), in the role of exproof.ai's red ∃.
5. **Live models instead of one background.** exproof.ai runs one search animation behind every page. This site has four canvas models, one ES module each in `src/assets/js/models/`: chaos in replicator dynamics on the simplex (the home page hero, and available as a full-page background behind the content), reflection (Methods), hypothesis-space refinement (AI safety), and a community sharing evidence on a network (Metascience). Each has controls and a "How it works" disclosure, as on danielherrmann.ca.
6. **A build step.** exproof.ai is hand-written HTML. This site has more repeated content (publications, talks, models, courses), so Eleventy builds it from YAML data, and a GitHub Actions workflow builds and deploys it (see `README.md`). The page structure still matches exproof.ai's.
7. **Organization from danielherrmann.ca.** The home page carries the argument: an introduction, a live model, research strands each with a model, a short essay and selected work, recent and upcoming talks, co-inquirers, influences, and contact.
8. **Day colors.** The day palette has its own values for every token (`STYLE.md`, section 3); for example green is `#1a7f4e` by day and exproof.ai's `#1fa463` by night.
9. **Redirects.** Old WordPress addresses keep working through stub pages in `src/redirects/` (an instant refresh, a script fallback, and a visible link), and old uploads keep their original paths under `/wp-content/uploads/`.
