# aydinmohseni.com

The source of Aydin Mohseni's website. Aydin Mohseni is an assistant professor of philosophy at Carnegie Mellon University.

This repository replaces the WordPress site at aydinmohseni.com with a static site. [Eleventy](https://www.11ty.dev/) builds it from Nunjucks templates and YAML data, GitHub Actions compiles the CV from LaTeX, and GitHub Pages serves the result. The design is shared with [∃xProof AI](https://exproof.ai/) (see `DESIGN.md`); the rules for every page are in `STYLE.md`; how to change content is in `MAINTAINING.md`.

## Layout of the repository

| Path | What it holds |
|---|---|
| `src/_data/*.yml` | All content that changes: profile, publications, talks, models, teaching, workshops, co-inquirers, sketchbook, influences, research strands. |
| `src/*.njk`, `src/**/index.njk` | Page templates. |
| `src/_includes/` | The base layout and shared macros. |
| `src/assets/` | Stylesheet, fonts (Computer Modern, self-hosted), images, and the JavaScript models. |
| `src/redirects/` | Stub pages that send old WordPress addresses, and `/meet/`, to their new places. |
| `src/wp-content/uploads/` | Files from the old site at their original paths, so old PDF links keep working. |
| `cv/amohseni.CV.tex` | The CV. CI compiles it and publishes it at `/cv.pdf`. |
| `tools/` | Checks run before every deploy. |
| `docs/` | The build brief, open questions, and the domain cutover runbook. |

## Build locally

Requires Node 22.

```
npm ci
npx eleventy                      # builds src/ into _site/
npx eleventy --serve --port 8080  # builds and serves with live reload at http://localhost:8080/
```

The CV is compiled only in CI. To compile it locally you need a TeX distribution: `cd cv && latexmk -pdf amohseni.CV.tex`, then copy `cv/amohseni.CV.pdf` to `_site/cv.pdf`.

To preview the site exactly as the github.io preview serves it, build with the path prefix:

```
PATH_PREFIX=/aydin-mohseni-website/ npx eleventy   # the repository's name, as in the github.io address
```

## Checks

Run after a build, from the repository root. Each takes the same `PATH_PREFIX` the build used.

| Command | What it checks | In CI |
|---|---|---|
| `node tools/check.mjs` | Broken internal links (respecting the path prefix), images without alt text, em dashes in any HTML, pages missing a title, description, or Open Graph tags. Locally add `--allow-missing /cv.pdf`, since only CI builds the CV. | Fails the deploy |
| `node tools/check_layout.mjs` | Every page at 390, 768, 1024, 1280 and 1600 pixels wide, in day and night themes: no sideways scrolling, content stays in its zone, margin notes do not overlap, no clipped text. Needs Playwright with Chromium. | Fails the deploy |
| `node tools/check_consistency.mjs` | Titles, authors, venues, years and status of works in `publications.yml` against the CV and the ∃xProof AI Publications page. | Warnings only |

## How deploy works

`.github/workflows/deploy.yml` runs on every push to `main`, every night at 06:17 UTC (so upcoming talks move to past without a commit), and by hand from the Actions tab ("Run workflow"). It:

1. installs dependencies with `npm ci`;
2. compiles `cv/amohseni.CV.tex` with `xu-cheng/latex-action`;
3. builds the site with Eleventy under the path prefix GitHub Pages reports for the site (`/<repository>/` on the github.io preview, `/` once the custom domain is set), unless the repository variable `PATH_PREFIX` overrides it;
4. copies the CV to `_site/cv.pdf`;
5. runs the three checks (link and layout checks block the deploy; the consistency check only warns);
6. uploads `_site` and deploys it to GitHub Pages.

GitHub disables scheduled workflows in a public repository after 60 days without activity. If the nightly run stops, re-enable it from the Actions tab.

## Enable GitHub Pages

1. In the repository on GitHub: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
2. Push to `main`, or run the workflow by hand. The site appears at `https://amohseni.github.io/<repository>/`.
3. Nothing else is needed for the path prefix: the workflow asks GitHub Pages for it, so it matches the repository's name exactly. To force a different prefix, set the variable `PATH_PREFIX` under **Settings > Secrets and variables > Actions > Variables** (for example `/aydin-mohseni-website/`); leave it unset otherwise.

GitHub Pages on a private repository requires a paid GitHub plan (Pro, Team or Enterprise). On a free plan, make the repository public.

When the custom domain moves (see `docs/CUTOVER.md`), the prefix becomes `/` on the next run by itself, provided the variable `PATH_PREFIX` is unset (or set to `/`).

## License

See `LICENSE` for the code. The Computer Modern fonts are under the SIL Open Font License (see `src/assets/fonts/COMPUTER-MODERN-README.md`).
