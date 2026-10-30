# Build report: aydinmohseni.com rebuild

Final verification, 30 Oct 2026. Nothing is committed or pushed. Details behind each open question are in `docs/OPEN-QUESTIONS.md` and `docs/CONTENT-AUDIT.md`.

## What was built

A static Eleventy 3 site in `src/`, deployed to GitHub Pages by `.github/workflows/deploy.yml`.

- **Pages:** Home (intro, chaos hero, three research strands with essay, live model and selected work, talks, co-inquirers, influences, contact), Research (Published, Under review, In progress, Talks, Workshops, one `#pub-<slug>` anchor per work, BibTeX boxes), Models, Teaching, Sketchbook, About, two workshop pages, a 404 page, `/meet/` and the old WordPress addresses as redirect stubs.
- **Design:** the exproof.ai grid and type scale, set in Computer Modern (self-hosted woff2), paper ground by default with Night mode (stored, applied before first paint), faint paper grain, red Δ wordmark.
- **Models (canvas, ES modules):** chaos in the replicator dynamics on the simplex (Home hero; dimmed background on interior pages), hypothesis-space refinement (AI safety), network epistemology (Metascience), van Fraassen's Reflection (Methods). Each resizes for device pixel ratio, pauses off screen and when the tab is hidden, shows a still frame under reduced motion or the site-wide Pause, reads theme colors live, and has a "How it works" text.
- **Data:** every page is built from `src/_data/*.yml`. Old PDFs are kept at their original `/wp-content/uploads/...` paths.
- **CV:** CI compiles `cv/amohseni.CV.tex`, copies it to `/cv.pdf` and to the old CV addresses in `src/_data/legacy_cv_paths.yml`, before the link check runs.

## Checks and results

Run on a fresh build, plain and with `PATH_PREFIX=/aydin-mohseni-website/`.

| Check | Result |
|---|---|
| `npx eleventy` | 17 pages, no errors |
| `node tools/check.mjs --allow-missing /cv.pdf --strict-fragments` | 0 errors, 0 warnings (both prefixes) |
| `node tools/check.mjs` without `--allow-missing` | Fails only on `/cv.pdf`, as expected locally; in CI the CV is copied into `_site` before this step |
| `node tools/check_layout.mjs` | Passed: 9 pages x 5 widths x 2 themes |
| `node tools/test-models-agency.mjs` | All checks passed |
| `node tools/test-models-community.mjs` | PASS (matches Zollman 2007's direction) |
| `node tools/check_consistency.mjs` | 11 known differences from the CV and exproof.ai (warn-only; listed in OPEN-QUESTIONS) |
| End-to-end Playwright pass, phone (390 x 844, touch) and desktop (1440 x 900) | See below |

End-to-end pass, as a first-time visitor on the prefixed build: Home has no sideways scroll and no reviewer tooltips; all four models animate, every button responds, sliders move, "How it works" opens; Night switches the page to `#050505` and persists across pages and reloads; "Pause motion" freezes the hero, changes to "Resume motion", and persists (a paused reload shows the full settled attractor, not a fragment); Research has no sideways scroll, and all 17 distinct non-CV PDF links return 200 with a PDF content type; the CV link points to `<prefix>cv.pdf`; Models, Teaching, Sketchbook, About and both workshop pages load without errors or sideways scroll; `#review` shows 9 notes on Research. The only failed request was the deliberate visit to a missing page (404 page served).

### Review findings re-verified

Every major finding from the four review lenses was checked in the built HTML or in the browser and is resolved: the paused hero still frame; reviewer notes as titles only in `#review` (0 at load on every page); gallery image sizes; the Metascience workshop organizers (Aydin Mohseni and Kevin Zollman, from the program PDF); the AI Agency workshop facts (Kevin Kelly, Sunday to 3:30pm, Steinberg Auditorium, four hosts, center name marked `data-verify`); `data-verify` notes carried onto Home (8 on Home); the "second question" ordinal removed; co-inquirer names linked in essays and committee lines; one name for the third strand ("methods (formal epistemology and game theory)") in both meta descriptions; display names per STYLE.md; shared summaries open with exproof.ai's sentence; the value-learning status disagreement recorded; the PSA venue name unified.

### Fixed in this pass

1. **Double-escaped apostrophes (visible defect).** Linked co-author names with an apostrophe rendered as the literal text "Cailin O&amp;#39;Connor" on Research (2 places) and Home (2 places). Cause: `authorLine` in `src/_includes/partials/macros.njk` captured an already-escaped name and escaped it again. Fixed; the names now read "Cailin O’Connor".
2. **New check.** `tools/check.mjs` now fails on double-escaped character references (`&amp;#39;`, `&amp;amp;` and the like), so this cannot come back unnoticed. Tested against a copy of the build with the defect reinserted (5 errors). README's Checks table says so.

## Known limitations

1. `/cv.pdf` exists only in CI builds; local link checks need `--allow-missing /cv.pdf`.
2. The ∃ glyph is not in the Computer Modern subsets and comes from a fallback math font; not yet checked on macOS or iOS.
3. Sketches: no sketch image files exist in the archive, so the Sketchbook shows infographics only.
4. One model card ("Optimal Bidding in a First-Price, Sealed-Bid Auction") has no screenshot; the files are not in the archive.
5. Upcoming and past talks are split at build time; the nightly CI run moves them.
6. The CI comparison against `https://exproof.ai/publications.html` and the CI LaTeX build could not be run here (no outbound network from the shell).
7. Headless Chromium uses software rendering, so CPU figures for the animations are upper bounds; real devices were not tested.
8. `src/CNAME` is not created; the domain move follows `docs/CUTOVER.md`.

## Open questions for Aydin

Most important first. Numbers in brackets point to `docs/OPEN-QUESTIONS.md`.

### A. Facts shown on the site (each is marked `data-verify` until answered)

1. **Booking link.** Brief: calendar.app.google/pe98GGpL8dwdoqbp6; old site: calendar.app.google/4AFnSgB8vVi3qtvZA. Which is current? It drives `/meet/`. [Content 8]
2. **Name of the CMU center.** "Conceptual Research on Safe AI (CoRe Safe AI)", "CoreSafe AI" (CV), "Center for Conceptual Research on the Foundations of Safe AI" (Sept 2026 program), or "Foundations of Safe AI initiative" (Aug 2026 page)? [Content 10]
3. **HARKing title.** CV "from Misunderstanding to Misprescription", or "From Misdiagnosis to Misprescription" (the PDF, PhilSci-Archive and your August 2026 text)? [Content 3]
4. **AI Agency and Interpretability Workshop.** The site follows the program PDF (Kevin Kelly as organizer, Sunday to 3:30pm, Foundations of Cooperative AI Lab as host). Confirm, supply URLs for Kevin Kelly and the lab if wanted, and choose "and" or "&" in the title. [Fixer 1, 2]
5. **W6 vs W7.** Are "A Bayesian Model of Grant Funding" and "A Bayesian Model of Optimal Grant Funding" two papers, and which owns the grant-funding app and the Manifest talk? [Content 4]
6. **R2.** Is "Replication, Reform, and an Interventional Simpson's Paradox" the paper earlier called "Intervention and Backfire in the Replication Crisis"? If yes, your August 2026 sentence becomes its summary. [Content 6]
7. **"The Rationality of Nash Equilibria"** (CV W2): is it the old site's "Are Nash Equilibria Rational?" (Home essay and summary assume so)?
8. **Philosophy Compass article (A8).** Still forthcoming? Any preprint to link? [Content 2]
9. **ORCID and PhilPeople.** Confirm 0000-0002-4054-0058 and philpeople.org/profiles/aydin-mohseni before they are shown. [Content 9]

### B. Agreement between this site, the CV and exproof.ai

10. **Status of "Learning the Value of Value Learning":** under review (CV) or working paper (exproof.ai)? [Fixer 4]
11. **Author form for London:** "Alex John London" (arXiv, Research author line) or "Alex J. London" (exproof.ai, prose here)? [Fixer 3]
12. **Years of published works:** the site uses the print year of the volume and issue; the CV differs for several (for example "The Best Paper You'll Read Today": 2022 vs 2024). Keep the rule or overrule it? [Content 1]
13. **W8 vs exproof.ai's "Bayes-Optimal Research Protocols for Automated Research":** one project or two? [Content 5]
14. **CV wording** "Philosophy of Science Biennial Conference" vs the site's "Philosophy of Science Association Biennial". [Fixer 6]
15. **Principal-agent summary:** may the old-site sentence about reward-optimizing agents outperforming aligned ones be shown? [Fixer 5]
16. **Works on the old site or exproof.ai but not in the CV** ("Measuring Agency", "Cooperation and Folk Moral Relativism", "Reporting, Bias, and Belief Distortion", and others): add, or leave out? [Content 6]
17. **"CF Talk" video** (Modeling Interventions in the Replication Crisis): year and venue; add to the CV? [Content 7]

### C. Editorial choices made on your behalf

18. **Strand headings** on Home are the CV's topic lists; you may prefer short headings. [Integration 7]
19. **Strand assignment and selected works per strand**, and the short list of constant co-inquirers. [Content 11, 12]
20. **Hero caption** sentence "With three strategies this cannot happen" and the model names. [Integration 8]
21. **Co-inquirers on Home** list every shared title; a shorter form may read better. [Integration 12]

### D. Material to supply or check

22. **Sketch files** for the Sketchbook. [Content 13, Integration 1]
23. **Gibran text:** check "tomorrow", "Archer’s" and "so He loves" against a 1923 scan. [Content 15]
24. **Borges:** one short quoted sentence per story only if you name the translation and supply it. [Content 16]
25. **Syllabi:** link any of the four syllabus PDFs to courses? [Content 17]
26. **Gabe Avakian Orona's family name** for BibTeX. [Content 18]
27. **Workshop header images** from the old pages: bring back, or leave out? [Integration 3]

### E. Before launch

28. **Domain move:** registrar, DNS host and whether the domain carries email are unknown; `docs/CUTOVER.md` step 1 records them. [Infrastructure 10]
29. **Repository visibility:** the colophon does not link the GitHub repository until you say it is public. [Integration 9]
30. **Check the ∃ glyph** on a Mac and an iPhone. [Design 2]
