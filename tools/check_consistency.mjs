// Compare the works in src/_data/publications.yml with the CV and with exproof.ai's Publications page.
//
//   node tools/check_consistency.mjs [--data src/_data/publications.yml] [--cv cv/amohseni.CV.tex]
//                                    [--xproof /home/claude/xproof/publications.html | URL | ""] [--strict]
//
// Prints differences in titles, authors (surnames, in order), venues, years and status.
// Works are matched across sources by normalized title. The ∃xProof AI page lists works of
// the whole group, so only its works that list Mohseni as an author are expected in the data.
//
// Warn-only: exits 0 unless --strict is given, in which case any difference exits 1.
// --dump prints what the parsers read from the CV and the page, for checking the parsers.
// --xproof "" skips the ∃xProof AI comparison; a URL is fetched.
// The CV is the source of truth for status and for works not yet published; publisher records
// (Crossref, the journal, arXiv) outrank the CV for citations, so a difference is a prompt to
// look, not a verdict on which source is right.

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const DATA = opt("--data", "src/_data/publications.yml");
const CV = opt("--cv", "cv/amohseni.CV.tex");
const XPROOF = opt("--xproof", "/home/claude/xproof/publications.html");
const STRICT = args.includes("--strict");
const DUMP = args.includes("--dump"); // print the works parsed from the CV and the ∃xProof AI page as JSON, then exit

let differences = 0;
const report = (msg) => { differences++; console.log("  " + msg); };
const heading = (msg) => console.log("\n" + msg);

// ---------- normalization ----------
const stripAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normTitle = (s) =>
  stripAccents(String(s || ""))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2018\u2019\u201c\u201d'"`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const normVenue = (s) => normTitle(s).replace(/^the /, "").replace(/\bpart a\b/, "").trim();
const normName = (s) => stripAccents(String(s || "")).toLowerCase().replace(/[\u2019']/g, "").replace(/[^a-z-]/g, "");

const isInitials = (s) => /^([A-Z]\.?\s*-?)+$/.test(s.trim());
// Surname of one author string: "Kevin J. S. Zollman" -> "Zollman"; "Mohseni, A." -> "Mohseni".
function surname(name) {
  name = name.trim();
  if (name.includes(",")) return name.split(",")[0].trim();
  const words = name.split(/\s+/).filter((w) => !isInitials(w));
  return words.length ? words[words.length - 1] : name;
}

// ---------- LaTeX helpers ----------
function stripComments(tex) {
  return tex
    .replace(/\\begin\{comment\}[\s\S]*?\\end\{comment\}/g, "")
    .split("\n")
    .map((l) => l.replace(/(^|[^\\])%.*$/, "$1"))
    .join("\n");
}
// Read a balanced {...} group starting at index i (which must point at "{"). Returns [content, endIndex].
function group(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") { depth--; if (depth === 0) return [s.slice(i + 1, j), j + 1]; }
  }
  return [s.slice(i + 1), s.length];
}
function texToText(s) {
  let out = s;
  for (let k = 0; k < 5; k++) out = out.replace(/\\(?:textbf|textit|emph|textsc|text)\{([^{}]*)\}/g, "$1");
  return out
    .replace(/\{\\color\{[^}]*\}([^{}]*)\}/g, "$1")
    .replace(/\\href\{[^}]*\}\{([^{}]*)\}/g, "$1")
    .replace(/\$[^$]*\$/g, "")
    .replace(/\\&/g, "&")
    .replace(/``|''/g, '"')
    .replace(/\\[a-zA-Z]+\*?/g, "")
    .replace(/[{}]/g, "")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- the CV ----------
function parseCV(file) {
  const tex = stripComments(fs.readFileSync(file, "utf8"));
  const sections = [
    { status: "published", re: /\\begin\{CVList\}\{PEER-REVIEWED[\s\S]*?\\end\{CVList\}/ },
    { status: "under-review", re: /\\begin\{CVList\}\{UNDER REVIEW[\s\S]*?\\end\{CVList\}/ },
    { status: "in-progress", re: /\\begin\{CVList\}\{WORKS IN PROGRESS[\s\S]*?\\end\{CVList\}/ },
  ];
  const works = [];
  for (const sec of sections) {
    const m = tex.match(sec.re);
    if (!m) { console.log(`  (CV section for ${sec.status} not found)`); continue; }
    const body = m[0];
    let i = 0;
    while ((i = body.indexOf("\\CVItem", i)) >= 0) {
      const [label, j] = group(body, body.indexOf("{", i));
      const [item, k] = group(body, body.indexOf("{", j));
      i = k;
      const tm = item.match(/``([\s\S]*?)''/);
      if (!tm) continue;
      const title = texToText(tm[1]).replace(/[.,]\s*$/, "").replace(/^"|"$/g, "");
      const before = item.slice(0, tm.index);
      const after = item.slice(tm.index + tm[0].length);
      const ym = before.match(/\((?:\\textit\{)?(forthcoming|\d{4})\}?\)/);
      const authorText = texToText(before.replace(/\((?:\\textit\{)?(forthcoming|\d{4})\}?\)\.?/, ""))
        .replace(/[.\s]+$/, "");
      const authors = authorText
        .replace(/&/g, ",")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !isInitials(s))
        .map(surname);
      const vm = after.match(/\\textit\{/);
      let venue = "";
      if (vm) venue = texToText(group(after, vm.index + "\\textit".length)[0]).replace(/[.,\s]+$/, "");
      const numbers = texToText(after).match(/(\d+)\((\d+)\),?\s*([\d\u2013-]+)?/);
      works.push({
        label, title, authors, status: sec.status,
        year: ym ? ym[1] : null, venue,
        volume: numbers ? numbers[1] : null, issue: numbers ? numbers[2] : null,
        pages: numbers && numbers[3] ? numbers[3].replace(/\u2013/g, "-") : null,
      });
    }
  }
  return works;
}

// ---------- ∃xProof AI publications page ----------
const htmlText = (s) =>
  s.replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "\u2019").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
function parseXproof(html) {
  const works = [];
  const sectionRe = /<section class="section" id="([^"]+)">([\s\S]*?)<\/section>/g;
  for (const sm of html.matchAll(sectionRe)) {
    const status = { published: "published", "in-progress": "in-progress", "under-review": "under-review" }[sm[1]];
    if (!status) continue; // talks and workshops are not works
    for (const lm of sm[2].matchAll(/<li class="work"[^>]*>([\s\S]*?)<\/li>/g)) {
      const li = lm[1];
      const get = (cls) => (li.match(new RegExp(`<p class="${cls}">([\\s\\S]*?)</p>`)) || [])[1] || "";
      const title = htmlText(get("work-title"));
      const authorsHtml = get("work-authors");
      const venue = htmlText((authorsHtml.match(/<i>([\s\S]*?)<\/i>/) || [])[1] || "");
      // The author list ends at the first period that does not close an initial.
      const text = htmlText(authorsHtml).replace(/^Organized by /, "");
      const end = text.search(/(?<!(?:^|[\s.])[A-Z])\.(\s|$)/);
      const names = (end >= 0 ? text.slice(0, end) : text)
        .split(/,\s*(?:and\s+)?|\s+and\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const year = (li.match(/<span class="year">([^<]*)<\/span>/) || [])[1] || null;
      works.push({ title, authors: names.map(surname), venue, year, status });
    }
  }
  return works;
}

// ---------- comparison ----------
function compare(data, other, otherName, { requireAll, onlyIf = () => true }) {
  const byTitle = new Map(other.map((w) => [normTitle(w.title), w]));
  const seen = new Set();
  for (const w of data) {
    const o = byTitle.get(normTitle(w.title));
    const id = w.slug || w.title;
    if (!o) {
      if (requireAll) report(`${id}: not found in ${otherName} (title "${w.title}")`);
      continue;
    }
    seen.add(normTitle(o.title));
    if (o.title !== w.title) report(`${id}: title differs in punctuation or case: data "${w.title}" / ${otherName} "${o.title}"`);
    const da = (w.authors || []).map(surname).map(normName);
    const oa = (o.authors || []).map(normName);
    if (oa.length && da.join(",") !== oa.join(",")) report(`${id}: authors differ: data [${da.join(", ")}] / ${otherName} [${oa.join(", ")}]`);
    if (o.venue && w.venue && normVenue(o.venue) !== normVenue(w.venue))
      report(`${id}: venue differs: data "${w.venue}" / ${otherName} "${o.venue}"`);
    else if (o.venue && !w.venue) report(`${id}: venue missing in data; ${otherName} has "${o.venue}"`);
    const dy = w.year == null ? null : String(w.year);
    if (o.year && dy && !/forthcoming/i.test(o.year) && o.year !== dy) report(`${id}: year differs: data ${dy} / ${otherName} ${o.year}`);
    const statusMatches = o.status === w.status || (otherName !== "CV" && o.status === "in-progress" && w.status === "under-review");
    if (o.status && w.status && !statusMatches) report(`${id}: status differs: data ${w.status} / ${otherName} ${o.status}`);
    for (const f of ["volume", "issue", "pages"]) {
      if (o[f] && w[f] != null && String(w[f]).replace(/\u2013/g, "-") !== o[f]) report(`${id}: ${f} differs: data ${w[f]} / ${otherName} ${o[f]}`);
    }
  }
  for (const o of other) {
    if (!seen.has(normTitle(o.title)) && onlyIf(o)) report(`not in data: "${o.title}" (${otherName}${o.label ? " " + o.label : ""}, ${o.status})`);
  }
}

// ---------- main ----------
if (DUMP) {
  const out = { cv: fs.existsSync(CV) ? parseCV(CV) : [] };
  if (XPROOF && !/^https?:/.test(XPROOF) && fs.existsSync(XPROOF)) out.xproof = parseXproof(fs.readFileSync(XPROOF, "utf8"));
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}
if (!fs.existsSync(DATA)) {
  console.log(`No data file at ${DATA}; nothing to compare.`);
  process.exit(0);
}
let data = yaml.load(fs.readFileSync(DATA, "utf8")) || [];
if (!Array.isArray(data)) data = data.works || data.publications || [];
console.log(`Data: ${data.length} work(s) in ${DATA}`);

if (fs.existsSync(CV)) {
  const cv = parseCV(CV);
  heading(`Against the CV (${CV}, ${cv.length} works):`);
  const before = differences;
  compare(data, cv, "CV", { requireAll: true });
  if (differences === before) console.log("  no differences");
} else console.log(`\n(CV not found at ${CV}; skipped)`);

if (XPROOF) {
  let html = null;
  try {
    if (/^https?:\/\//.test(XPROOF)) {
      const res = await fetch(XPROOF);
      if (res.ok) html = await res.text();
      else console.log(`\n(${XPROOF} returned ${res.status}; skipped)`);
    } else if (fs.existsSync(XPROOF)) html = fs.readFileSync(XPROOF, "utf8");
    else console.log(`\n(${XPROOF} not found; skipped)`);
  } catch (e) {
    console.log(`\n(could not read ${XPROOF}: ${e.message}; skipped)`);
  }
  if (html) {
    const xp = parseXproof(html);
    heading(`Against the \u2203xProof AI page (${XPROOF}, ${xp.length} works, ${xp.filter((w) => w.authors.some((a) => normName(a) === "mohseni")).length} with Mohseni):`);
    const before = differences;
    compare(data, xp, "\u2203xProof AI", { requireAll: false, onlyIf: (o) => o.authors.some((a) => normName(a) === "mohseni") });
    if (differences === before) console.log("  no differences");
  }
}

console.log(`\n${differences} difference(s).${STRICT ? "" : " (warn-only; pass --strict to fail on differences)"}`);
process.exit(STRICT && differences ? 1 : 0);
