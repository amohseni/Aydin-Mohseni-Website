# Content audit

Report for Aydin from the content-data workstream, 30 October 2026. It records where every fact in `src/_data/*.yml` came from and every place the CV, the publisher record and the old site disagree. The CV (`cv/amohseni.CV.tex`) was not edited.

## Sources and how they were read

| Source | Access | Notes |
|---|---|---|
| CV, `cv/amohseni.CV.tex` | read in full | Scope for works, talks, teaching, training, organizing |
| Crossref API (`api.crossref.org/works`) | WebFetch, 30 Oct 2026 | Publisher records for all 8 published works with a DOI |
| arXiv abs page 2511.17714 | WebFetch | Authors, versions |
| PhilSci-Archive (creator page, item 18523) | WebFetch | HARKing preprint |
| Old site pages (`/`, `/research/`, `/talks/`, `/teaching-2/`, `/computational-models/`, `/ai-agency-workshop/`, `/formal-models-in-science-workshop/`, `/infographics/`, `/sketches/`) | WebFetch | The fetch tool summarizes pages and declines to return long passages verbatim. URLs, titles, citations and short quotations were returned exactly; abstracts came back paraphrased. Summaries in `publications.yml` and `models.yml` are rewritten from those paraphrases, not copied. |
| WordPress REST API (`/wp-json/wp/v2/pages`, `/media`) | WebFetch | Page list; partial media list (about 70 files, 2019 to 2026). Used to confirm full-size image paths and to find the metascience workshop program PDF. |
| exproof.ai clone (`/home/claude/xproof`) | read locally | `publications.html`, program pages, `people.html`, README name-URL table |
| CMU faculty page for Aydin | WebFetch | Office (Baker Hall 145F), CoRe Safe AI naming |
| YouTube oEmbed for the two videos | WebFetch | Video titles and channel |
| GitHub `amohseni/Tragedies-of-the-Commons` | WebFetch | Repository exists |
| Project Gutenberg eBook #58585 | WebFetch | Gibran, *The Prophet*, Knopf 1923 imprint |
| Wikipedia pages for the four Borges stories | WebFetch | Original titles, first publication years |
| Co-author pages (Weatherall, Barrett, Zollman via CMU, O'Connor, Huttegger) | WebFetch | Confirmed each page belongs to the named person |

Not reachable: ScienceDirect article page (client error), ORCID record page and API (empty page; robots), PhilPeople profile (client error), YouTube watch pages (client error).

## Published works: CV vs publisher vs old site

The citation in `publications.yml` follows Crossref in every field below. Title capitalization follows the CV's title case where Crossref uses sentence case.

| Work | Field | CV | Crossref (publisher record) | Old site |
|---|---|---|---|---|
| Social sciences hard (A9) | title | "Why are the Social Sciences Hard? Two New Hypotheses" | "Why are the social sciences hard? Two new hypotheses" | "Why are the Human Sciences Hard? Two New Hypotheses" (and the PDF file name) |
| | authors | Mohseni, Herrmann, G. A. Orona | Aydin Mohseni, Daniel A. Herrmann, Gabe Avakian Orona | Herrmann, Mohseni, "Aarona" / "Avakian Aarona" |
| | journal | *Studies in History and Philosophy of Science Part A* | *Studies in History and Philosophy of Science* | *Studies in the History and Philosophy of Science* |
| | year, vol, no. | forthcoming | 2026 (October), vol. 119, no issue (special numbering "C"), article 102197 | 2024 |
| | DOI | none | 10.1016/j.shpsa.2026.102197 | none |
| Role of Modeling (A8) | all | forthcoming, *Philosophy Compass*, commissioned | no record found | not listed |
| Methods for Modelers (A7) | title | "Methods for Modelers of Science" | "Methods for Modelers of Science" | heading "Methods for Modeling Science"; citation line "Methods for Modelers of Science" |
| | book | *Methods in the Philosophy of Science: A User's Guide* | *Methods in the Philosophy of Science: A User's Guide* (edited book, DOI 10.7551/mitpress/15452.001.0001) | *Methods in Philosophy of Science: A User's Guide* |
| | editors | Adrian Currie & Sophie Juliane Veigl | Sophie J. Veigl, Adrian Currie (in that order) | Veigl & Currie |
| | publisher | Oxford University Press | The MIT Press | MIT Press |
| | year, pages | 2025, none | 2025 (15 July), pp. 485-506 | 2024 |
| | DOI | none | 10.7551/mitpress/15452.003.0036 | none |
| Best Paper (A6) | year | 2024 | 2022 (issued), vol. 50 no. 2 | 2023 |
| | other | 50(2), 127-153 | matches; publisher Philosophy Documentation Center; DOI 10.5840/philtopics202250220 | |
| | preprint | | MetaArXiv 10.31222/osf.io/hpks9 (2023) lists O'Connor, Weatherall, Mohseni and "Media Bias" | |
| Tragedy of the AI Commons (A5) | year | 2023 | 2022 (online and issued 6 July 2022) | 2022 |
| | vol, no., pages | 200(4), 289 | 200(4), article 289 | 200(4): 1-33 |
| | DOI | none | 10.1007/s11229-022-03763-2 | none |
| Truth and Conformity (A4) | authors | Mohseni & C. Williams | Aydin Mohseni, Cole Randall Williams | Mohseni & C.R. Williams |
| | year | 2021, 86(6), 1509-1530 | print 2021-12 (online 2019-10-26), 86(6), 1509-1530 | 2021, cited as "Unpublished manuscript" |
| Red King (A3) | title | "...Testing the Cultural Red King Hypothesis" | "On the emergence of minority disadvantage: testing the cultural Red King hypothesis" | heading "On the Emergence of Inequity: Testing the Cultural Red King Hypothesis"; citation "...Testing the Red King Hypothesis" (no "Cultural") |
| | year, issue | 2019, 198(2) | online 2019-10-25, print 2021-06, 198(6), 5599-5621 | forthcoming |
| Self-Assembling Networks (A2) | journal | *British Journal of Philosophy of Science* | *The British Journal for the Philosophy of Science* | *British Journal for the Philosophy of Science* |
| | issue | 70(2) | 70(1), 301-325, March 2019 | 70: 301-325 |
| Stochastic Stability (A1) | title | "...Disagreements Between Dynamics" | "...Disagreements between Dynamics" | as CV |
| | other | 2019, 86(3), 497-521 | matches; DOI 10.1086/703581 | |

Decisions taken in the data (Aydin may overrule): year shown is Crossref's issued year, except Truth and Conformity and Red King, where the print year (2021) is shown and the online year (2019) is noted. The CV's A9 "Part A" is dropped because the journal's current name has no part.

## Under review and in progress

| Work | Discrepancy |
|---|---|
| R5 Bayesian Reduction of Causation | Old site and exproof.ai agree with the CV on title and author order. The old Presentations page titles the talk "A Bayesian Reduction of Causation in Causal Models". |
| R4 Learning the Value of Value Learning | arXiv lists "Alex John London" (CV: A. J. London; exproof.ai: Alex J. London). First submitted 21 Nov 2025, v5 13 Apr 2026. Old site dates it 2026. |
| R3 HARKing | CV: "from Misunderstanding to Misprescription". Old site, PDF file name and PhilSci-Archive: "From Misdiagnosis to Misprescription" (PhilSci-Archive misspells "Mispescription"). CV marks it revise and resubmit. |
| R2 Replication, Reform, and an Interventional Simpson's Paradox | Not on the old site. The old site's in-progress "Intervention and Backfire in the Replication Crisis" (CV talk P6) may be its predecessor; not linked in the data. |
| R1 Limitations of Equilibrium Concepts | Old site: "The Limitations of...", 2019 manuscript. PhilSci-Archive lists a 2019 preprint (item URL not retrieved). |
| W8 Automated AI safety research | exproof.ai lists "Bayes-Optimal Research Protocols for Automated Research" by Mohseni and DeDeo only. CV: "Bayes-Optimal Automated AI Safety Research via Judgement Aggregation under Resource Constraints", Mohseni, Zollman, DeDeo. |
| W7 / W6 grant funding | Two CV entries with near-identical titles and the same authors. |
| W5 Principal-agent | Old site entry has no authors and links a placeholder URL (`/research/PREPRINT-URL-IF-ANY`). exproof.ai: Mohseni and L. G. Demo, as the CV. |
| W2 Rationality of Nash Equilibria | Old site: "Are Nash Equilibria Rational?" (Mohseni, Huttegger), with the Near-Zero-Sum-Game model. Treated as the same paper. |
| Not in the CV | Old site: "Reporting, Bias, and Belief Distortion" (Mohseni, O'Connor, Weatherall); "Cooperation and Folk Moral Relativism" (Mohseni, Stanford; OSF data https://osf.io/e7u2h/); "Intervention and Backfire in the Replication Crisis" (PhilSci-Archive 2022 per old site; citation reads "...Replication Archive"; placeholder link). exproof.ai: "Measuring Agency: Belief and Preference Elicitation for Language Models" (Mohseni, Clay). None of these is in `publications.yml`, because the CV sets the scope. |

## Talks

`talks.yml` has 51 entries: the CV's 50 venue occurrences (P1-P15) plus one occurrence from the old site that the CV lacks. Differences:

- **Added from the old site:** "Intervention and Backfire in the Replication Crisis", Pittsburgh Center for Philosophy of Science, "CF Talk", Pittsburgh, 2025, invited, video https://www.youtube.com/watch?v=Ep4pyhoD-jg (YouTube title: "Modeling Interventions in the Replication Crisis" by Aydin Mohseni; channel Center for Philosophy of Science). The year 2025 is doubtful given the 2021-22 fellowship.
- **Video 2:** https://www.youtube.com/watch?v=3_PTLhkZG6c, YouTube title "Lunchtime Talk - Aydin Mohseni 9/19/25", attached to the CV's "Center for Philosophy of Science Lunch Time Talks, Pittsburgh 2025" (P12); date set to 2025-09-19 from the video title.
- **Titles:** old site "A Bayesian Reduction of Causation in Causal Models" vs CV "A Bayesian Reduction of Causation"; old site "Why the Social Sciences are Hard" vs CV "Why are the Social Sciences Hard? Two New Hypotheses". CV used.
- **Venue names:** old site "ODYSSEY Conference on Theoretical AI Alignment" vs CV "ILIAD 2025 Conference: ODYSSEY"; old "The PPE Society: Eighth Annual Meeting" vs CV "Philosophy, Politics, and Economics Society Conference" (2024); old "PhilML Conference" vs CV "Philosophy of Science Meets Machine Learning Conference" (Tübingen 2024); old "Pittsburgh Center for Philosophy of Science, LT Talk" vs CV "Center for Philosophy of Science Lunch Time Talks"; old "12th MuST Conference in Philosophy of Science" vs CV full name. CV used.
- **In the CV, not on the old site:** all 2026 talks, P13-P15, PPE 9th Annual Meeting 2025, P11 2026 venues and ILIAD 2025, Foundations of Cooperative AI Lab Seminar 2024, Philosophy and Complex Systems Seminar Moscow 2018, IMBS R. D. Luce Conference 2017.
- **Old site errors:** "Munich 201" (CV: 2017); "Dusseld¨orf" (CV: Düsseldorf).
- **Co-presenters** (`with`) from exproof.ai: Herrmann on P13 and on the PSA 2026 San Diego talk (November 2026, upcoming).
- **Paper links:** P15 "A Bayesian Model of Optimal Science Funding" is linked to W6 by title similarity (flagged). P6, P9, P13, P14 have no paper.
- Slides PDFs found in the media library and attached to papers: Truth and Conformity, Stochastic Stability, Minority Disadvantage, Limitations of Equilibrium Concepts. `SlidesCirisAndIntervention.pdf` (2019) belongs to P6, which has no paper slug, so it is not used.

## Teaching

CV used for titles. Old-site variants: "Game Theory, AI, and X-Risk" (CV "Game Theory, AI & X-Risk"); "Philosophy Core Seminar II" (CV "Philosophy Core II Graduate Seminar"); "Philosophy of Science" (CV "Introduction to Philosophy of Science"); "Introduction to Epistemology and Metaphysics" (CV "Metaphysics & Epistemology"). The old page lacks Spring 2026 courses and "Making Modern Science" (UCI, Fall 2020), and has an empty "Video Lectures" heading. It carries a Dewey epigraph cited to "*Education and Experience*, 239"; Dewey's book is *Experience and Education*, and the attribution of that sentence to Dewey is doubtful, so it is not carried over. "THU" in the CV is expanded to Tsinghua University (from "Pitt–Tsinghua"). Training is condensed to five lines from the CV's twelve.

## Models

Thirteen models from the old Computational Models page (7 research, 6 teaching). Changes: the grant-funding image (`2026/07/SC-GrantFundingModel.png`) is moved from "Modeling Interventions in Science" and "Prediction Markets Lab" to the grant funding model; Tragedies of the Commons gains its code link (repository confirmed). Paper links come from the old Research page's model links (Best Paper, Truth and Conformity, Self-Assembling Networks, Stochastic Stability, Tragedy of the AI Commons, HARKing) and from inference for the grant model and the Near-Zero-Sum game (flagged). Image alt text is generic because the images were not viewed. Full-size originals are used where the media API listed them; 2018 images use the thumbnail paths the page displayed.

## Workshops

- AI Agency & Interpretability Workshop: dates, room, hosts, speakers, registration, program PDF and image from the old page; organizers (Mohseni and Herrmann) from exproof.ai. The CV calls it "CMU AI & Agency Workshop (Pittsburgh, Fall 2026)".
- Formal Models in Metascience Workshop: from the old page. Its program link points to the AI Agency PDF; the data uses `/wp-content/uploads/2025/08/Workshop_Program___Formal_Models_in_Metascience.pdf`, found in the media library and not opened.
- Speaker URLs are filled only where already confirmed (exproof.ai README table).

## Bio and profile

- `long_bio` is the old home-page bio. The fetch tool returned it as verbatim text on request; it should still be diffed against the WordPress source once the export is available. One fix: "Perci Diaconis" to "Persi Diaconis". No other change.
- CoRe Safe AI: the CV writes "CoreSafe AI"; the old bio, exproof.ai and the CMU page write "Conceptual Research on Safe AI (CoRe Safe AI)". The data uses "CoRe Safe AI".
- Booking link: the brief gives https://calendar.app.google/pe98GGpL8dwdoqbp6; the old home page links https://calendar.app.google/4AFnSgB8vVi3qtvZA.
- ORCID 0000-0002-4054-0058 appears with Aydin's name in the Elsevier Crossref deposit (not authenticated). Kept in `links_unverified`, so the footer does not show it.
- OSF: the old site links https://osf.io/ (the OSF home page), not a profile. Dropped.
- Office Baker Hall 145F from the CMU faculty page (the CV gives only the department address).

## Influences

- Gibran, "On Children": text from Project Gutenberg #58585, whose title page reads "New York: Alfred A. Knopf / 1923". The fetch tool would not return the passage whole (125-character quotation limit), so the text was reconstructed and then checked line by line against the Gutenberg file through the tool, with specific fragments quoted back exactly. Differences from the commonly circulated text, all following Gutenberg: "tomorrow" (not "to-morrow"), "Archer's" capitalized in "Let your bending in the Archer's hand", lower-case "he" in "For even as he loves the arrow that flies", curly apostrophes, "Children" italic in the opening line. Stanza grouping is a layout choice. Check against a scan of the 1923 printing.
- Borges: years from Wikipedia: "The Library of Babel" 1941 (*El jardín de senderos que se bifurcan*); "The Lottery in Babylon" 1941 (*Sur*, then the same collection); "Pierre Menard, Author of the Quixote" 1939 (*Sur*, May 1939); "On Exactitude in Science" 1946 (*Los Anales de Buenos Aires*, March 1946). Each description is our own sentence. No quotations were included: the brief allows one short quoted sentence per story from a named translation, and no translation text was available to check one against.

## Strand essays: sources per paragraph

Strand membership of each work (`strand` in `publications.yml`) and the selected works per strand are editorial choices for Aydin to confirm. Assignments that could go either way: Red King (methods, could be metascience), Self-Assembling Networks (metascience, could be methods), Tragedy of the AI Commons (AI safety), Bayesian Reduction of Causation (AI safety, following exproof.ai's Agency area).

**AI safety**
1. Old home-page bio ("His work on agency focuses especially on artificial intelligence, including the foundations of AI safety, agency, and alignment"); exproof.ai `people.html` (Aydin and Daniel listed as Directors); exproof.ai `index.html` ("We use decision and game theory, mechanistic interpretability, and philosophical analysis to understand advanced AI systems as agents"); CV research summary.
2. arXiv:2511.17714 abstract (as paraphrased by the fetch); exproof.ai `value-uncertainty.html` ("Standard frameworks let an agent learn about the world while her options and values stay fixed. We extend the Jeffrey–Bolker framework ... value-of-information theorem ... mutual refinement tends to turn zero-sum games into positive-sum ones").
3. exproof.ai `publications.html` summary of A Bayesian Reduction of Causation; exproof.ai `delegation.html` (second strand led by Mohseni and Demo).

**Metascience**
1. Old home-page bio (two questions; methods; "scientific funding and reform"); CV research summary (grant funding, replication crisis, social epistemology of science).
2. Old Research page summaries of Truth and Conformity on Networks and The Best Paper You'll Read Today.
3. PhilSci-Archive 18523 abstract and old Research page (HARKing); old Computational Models page (Optimal Grant Funding for Scientific Production).

**Methods**
1. CV research summary; old home-page bio (the methods he uses). The phrase "the formal tools Aydin uses to study scientific communities and artificial agents" joins the two; confirm.
2. Old Research page summaries of Stochastic Stability and Limitations of Equilibrium Concepts.
3. Old Research page summaries of "Are Nash Equilibria Rational?" (taken to be CV W2) and of the Red King paper.

## Checks run

- All ten YAML files parse (PyYAML) and the Eleventy build loads them (`npx eleventy`, 14 files written).
- No em dash (U+2014) in any data file.
- Counts against the CV: 9 published, 5 under review, 8 in progress (CV A1-A9, R1-R5, W1-W8); 50 talk occurrences from the CV (per P-number counts match) plus 1 from the old site.
- Every `paper_slug`, strand `selected` slug, co-inquirer `works` slug and infographic slug exists in `publications.yml`; every co-author string in `publications.yml` has a `coinquirers.yml` entry with the matching works, and vice versa.
- All 22 works render through the design workstream's `work` macro (scratch build, BibTeX on).
- Independent review, 30 Oct 2026: Crossref, arXiv, the old pages and Gutenberg were fetched again and matched the data. Corrections made after review are listed under "Content data review" in `docs/OPEN-QUESTIONS.md`.
