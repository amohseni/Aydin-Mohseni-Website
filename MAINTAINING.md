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

`cv/amohseni.CV.tex` is the only CV source. On every deploy, GitHub Actions compiles it with `xu-cheng/latex-action` (a full TeX Live) and publishes the PDF at `/cv.pdf`. The site links to that address, so the CV on the site is always the one in the repository. The same file is also copied to every old WordPress CV address listed in `src/_data/legacy_cv_paths.yml`, so links to old CV PDFs serve the current one. If the LaTeX fails to compile, the site still deploys without a new CV (the previous `/cv.pdf` is not carried over, so the CV link breaks until the source is fixed); the LaTeX errors appear as warnings on the workflow run under "Report CV errors".

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

## What updates on its own

| What | How | Needs a person? |
|---|---|---|
| Upcoming talks become past talks; workshop registration links close | Nightly rebuild (06:17 UTC) compares dates with the build date | No |
| The CV PDF at `/cv.pdf` and the old CV addresses | Compiled from `cv/amohseni.CV.tex` on every deploy | Only to change the `.tex` |
| A primer on AI at `/teaching/primer-on-ai/` | Copied from amohseni/AI-Safety-Fundamentals on every deploy | No |
| New papers, new DOIs, arXiv versions, dead external links | Weekly **content watch** (Mondays): `tools/watch_sources.mjs` checks Crossref, arXiv, OpenAlex and every external link, and lists leads in one open GitHub issue labelled `content-watch` | Yes: each lead is confirmed before the data changes |
| Working through those leads, plus talks and the CV | Monthly Claude session (3rd of the month), following the routine below; it opens one pull request | Aydin merges the pull request |

Nothing automatic writes facts to the site. Automation finds leads and keeps derived things (dates, the CV PDF) current; every new fact goes through a pull request.

A lead that is not a real change (a work by another Aydin Mohseni, an item left off the site on purpose, a link that fails only for robots) goes into `src/_data/watch_ignore.yml` so it does not come back.

Run the watch by hand: `node tools/watch_sources.mjs --links` (after `npx eleventy`), or "Run workflow" on the Content watch workflow in the Actions tab.

## Monthly steward routine

Once a month (the scheduled Claude session, or by hand), in this order. Work on a branch named `monthly-YYYY-MM` and finish with one pull request that lists every change and its source.

1. **Pull** the repository and build it. Read the open `content-watch` issue: it is the list of leads to work through.
2. **Run all the checks (the three checks and the two model tests).** Fix broken links and layout problems; for each difference the consistency check prints, find which source is right (publisher record first, then the CV) and correct the other.
3. **Talks.** Compare `talks.yml` with the CV's Presentations section and Aydin's calendar. Add new talks; confirm dates of upcoming ones.
4. **Publications.** For each work under review or in progress, check arXiv, PhilSci-Archive and the journal for a new version or a publication record. Update status, links and citation details from those records only.
5. **CV.** Confirm the CV in the repository is the current one, and that its date line is current.
6. **External links.** Open the links to co-inquirers' sites, apps (shinyapps.io) and code repositories; replace or remove dead ones.
7. **Open questions.** Read `docs/OPEN-QUESTIONS.md`; ask Aydin the ones only he can answer, in one batched list.
8. **Deliver.** Push the branch and open the pull request (or, by hand, commit to `main`). Tick the leads handled in the `content-watch` issue and close it when none remain. Prose changes are proposed in the pull request description, not merged unasked.

## Division of labor

- **Aydin** decides what the site says about him and his work, approves new prose, and answers open questions.
- **Claude** keeps data in sync with the CV and publisher records, runs the checks, fixes breakage, and drafts changes for Aydin's approval. Claude never adds a fact without a source and never describes Aydin's views beyond what his own writing states.
