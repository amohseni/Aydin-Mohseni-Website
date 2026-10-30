# Maintaining the site

How Aydin and Claude keep the site current. Content lives in YAML files; templates rarely need to change. Every push to `main` rebuilds and redeploys the site (see `README.md`).

## Which file for which change

| Change | File |
|---|---|
| Bio, tagline, appointments, education, profile links, booking link | `src/_data/profile.yml` |
| A new paper, a status change (in progress, under review, published), a DOI, a PDF link | `src/_data/publications.yml` |
| A talk, past or upcoming | `src/_data/talks.yml` |
| A computational model or app | `src/_data/models.yml` |
| A course, summer school or short course | `src/_data/teaching.yml` |
| A workshop page | `src/_data/workshops.yml` |
| A collaborator's name, website or shared works | `src/_data/coinquirers.yml` |
| An infographic or sketch | `src/_data/sketchbook.yml` (images in `src/assets/img/`) |
| The influences section | `src/_data/influences.yml` |
| A research strand's essay, model or selected works | `src/_data/strands.yml` |
| Anything on the CV | `cv/amohseni.CV.tex` |
| An old CV address that should serve the current CV | `src/_data/legacy_cv_paths.yml` |
| An old address that should redirect | the list at the top of `src/redirects/redirects.njk` |

Field names for each file are listed in `docs/BRIEF.md` under "Data schemas".

### Notes on common changes

- **A paper is accepted or published.** Update its record in `publications.yml` (status, venue, volume, issue, pages, DOI, year, `verified` source), and the matching entry in the CV. Take citation details from Crossref or the journal page, not from memory. Then run `node tools/check_consistency.mjs` to confirm the CV and the data agree.
- **A talk.** Add it to `talks.yml` with a full date (`YYYY-MM-DD`) if known. The home page and the Research page split talks into upcoming and past by comparing each date with the date of the build, so the nightly build moves a talk from upcoming to past the day after it happens, with no commit needed. A month-only date (`YYYY-MM`) counts as upcoming through the end of that month; a year-only date counts as upcoming only if the year has not begun, so give a talk in the current year at least its month. Workshop pages use their `end` date the same way (registration links show only while a workshop is upcoming).
- **A file (PDF, slides).** Put it under `src/assets/files/` and link it as `/assets/files/<name>.pdf`. Files from the old site stay at their original paths under `src/wp-content/uploads/`.
- **Unconfirmed facts.** Leave them out, or mark the element with `data-verify="what needs confirming"`. Append the question to `docs/OPEN-QUESTIONS.md`. Open any page with `#review` at the end of its address to see what is marked.

## How the CV builds

`cv/amohseni.CV.tex` is the only CV source. On every deploy, GitHub Actions compiles it with `xu-cheng/latex-action` (a full TeX Live) and publishes the PDF at `/cv.pdf`. The site links to that address, so the CV on the site is always the one in the repository. The same file is also copied to every old WordPress CV address listed in `src/_data/legacy_cv_paths.yml`, so links to old CV PDFs serve the current one. If the LaTeX fails to compile, the deploy stops and the previous version of the site stays live; the error is in the workflow log under "Compile the CV".

To compile locally (needs a TeX distribution): `cd cv && latexmk -pdf amohseni.CV.tex`.

## Checks

After any change, build and check before pushing:

```
npx eleventy
node tools/check.mjs --allow-missing /cv.pdf
node tools/check_layout.mjs
node tools/check_consistency.mjs
node tools/test-models-agency.mjs
node tools/test-models-community.mjs
```

The link check, the layout check and the two model tests also run in CI and stop a deploy that fails them. The consistency check only prints differences. What each check covers is in `README.md` and `STYLE.md`.

## Monthly steward routine

Once a month (a scheduled Claude session, or by hand), in this order:

1. **Pull** the repository and build it.
2. **Run all the checks (the three checks and the two model tests).** Fix broken links and layout problems; for each difference the consistency check prints, find which source is right (publisher record first, then the CV) and correct the other.
3. **Talks.** Compare `talks.yml` with the CV's Presentations section and Aydin's calendar. Add new talks; confirm dates of upcoming ones.
4. **Publications.** For each work under review or in progress, check arXiv, PhilSci-Archive and the journal for a new version or a publication record. Update status, links and citation details from those records only.
5. **CV.** Confirm the CV in the repository is the current one, and that its date line is current.
6. **External links.** Open the links to co-inquirers' sites, apps (shinyapps.io) and code repositories; replace or remove dead ones.
7. **Open questions.** Read `docs/OPEN-QUESTIONS.md`; ask Aydin the ones only he can answer, in one batched list.
8. **Deploy.** Commit with a message that lists what changed, push, and confirm the workflow run is green and the live site shows the change.

## Division of labor

- **Aydin** decides what the site says about him and his work, approves new prose, and answers open questions.
- **Claude** keeps data in sync with the CV and publisher records, runs the checks, fixes breakage, and drafts changes for Aydin's approval. Claude never adds a fact without a source and never describes Aydin's views beyond what his own writing states.
