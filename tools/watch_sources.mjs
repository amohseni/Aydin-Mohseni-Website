#!/usr/bin/env node
// Content watch: compares the site's data with outside records and prints a Markdown report of
// what may need updating. It never edits data: every finding is a lead for a person (or a Claude
// session) to confirm against the source before changing src/_data/.
//
// Checks:
//   1. Publications not yet published, or published without a DOI: does Crossref now have a
//      record with a matching title? (journal, year, DOI)
//   2. New works: does arXiv or OpenAlex list a work by Aydin Mohseni whose title is not in
//      publications.yml?
//   3. Missing arXiv links: does arXiv have a work whose title matches an entry with no arXiv link?
//   4. External links on the built site (_site/) that fail to load (only with --links).
//
// Usage: node tools/watch_sources.mjs [--links] [--out report.md]
// Exit code is 0 whether or not there are findings; network failures are reported, not fatal.
// The report's first line is "FINDINGS: <n>" so the workflow can tell an empty report apart.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");

const args = process.argv.slice(2);
const CHECK_LINKS = args.includes("--links");
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? args[outIdx + 1] : null;

const AUTHOR = { given: "Aydin", family: "Mohseni" };
const UA = "aydinmohseni.com content watch (https://github.com/amohseni/Aydin-Mohseni-Website)";
const pubs = yaml.load(fs.readFileSync("src/_data/publications.yml", "utf8")) || [];

// ---------------------------------------------------------------- title matching
const STOP = new Set(["a", "an", "the", "of", "and", "in", "on", "for", "to", "with", "under", "via", "is", "are"]);
const norm = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (t) => new Set(norm(t).split(" ").filter((w) => w && !STOP.has(w)));
function similar(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);   // overlap coefficient: tolerant of subtitles added or dropped
}
function lev(a, b) {   // edit distance, for typos in outside records ("Mispescription")
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}
const close = (a, b) => { const x = norm(a), y = norm(b); return lev(x, y) <= Math.max(2, Math.round(0.08 * Math.max(x.length, y.length))); };
const MATCH = 0.8;
const matches = (a, b) => similar(a, b) >= MATCH || close(a, b);
// Leads Aydin or a monthly session dismissed (not his, or left off on purpose) never come back.
const IGNORE_FILE = "src/_data/watch_ignore.yml";
const ignored = fs.existsSync(IGNORE_FILE) ? (yaml.load(fs.readFileSync(IGNORE_FILE, "utf8")) || []) : [];
const isIgnored = (s) => ignored.some((x) => { const k = typeof x === "string" ? x : x.match; return k && (s.includes(k) || matches(k, s)); });
const known = (title) => pubs.find((p) => matches(p.title, title)) || (isIgnored(title) ? { ignored: true, links: { arxiv: "-" } } : null);

async function getJSON(url) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429 && attempt < 4) { await new Promise((ok) => setTimeout(ok, 5000 * 2 ** attempt)); continue; }   // rate limited: back off
    if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
    return r.json();
  }
}
async function getText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
  return r.text();
}

const findings = [];   // { section, text }
const errors = [];
const add = (section, text) => findings.push({ section, text });

// ---------------------------------------------------------------- 1. Crossref
async function crossref() {
  const targets = pubs.filter((p) => p.status !== "published" || !p.doi);
  for (const p of targets) {
    const q = encodeURIComponent(p.title);
    try {
      const j = await getJSON(`https://api.crossref.org/works?query.bibliographic=${q}&query.author=${AUTHOR.family}&rows=5&select=DOI,title,container-title,author,issued,type`);
      for (const it of j.message.items || []) {
        const t = (it.title || [])[0] || "";
        const byHim = (it.author || []).some((a) => (a.family || "").toLowerCase() === AUTHOR.family.toLowerCase());
        if (!byHim || !matches(t, p.title)) continue;
        if (p.doi && it.DOI.toLowerCase() === String(p.doi).toLowerCase()) continue;
        if (it.type === "posted-content") continue;   // preprint servers; covered by the arXiv check
        const year = it.issued?.["date-parts"]?.[0]?.[0] ?? "?";
        const venue = (it["container-title"] || [])[0] || it.type;
        add("Crossref records for works the site lists as unpublished or without a DOI",
          `**${p.title}** (\`${p.slug}\`, status: ${p.status}${p.doi ? "" : ", no DOI"}): Crossref has *${t}* in ${venue}, ${year}, https://doi.org/${it.DOI}`);
      }
    } catch (e) { errors.push(`Crossref, ${p.slug}: ${e.message}`); }
    await new Promise((r) => setTimeout(r, 1500));   // Crossref's public pool allows few requests per second
  }
}

// ---------------------------------------------------------------- 2-3. arXiv
async function arxiv() {
  let xml;
  try {
    xml = await getText(`https://export.arxiv.org/api/query?search_query=au:%22${AUTHOR.given}%20${AUTHOR.family}%22&max_results=100&sortBy=submittedDate&sortOrder=descending`);
  } catch (e) { errors.push(`arXiv: ${e.message}`); return; }
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
    const body = m[1];
    const pick = (tag) => (body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1]?.replace(/\s+/g, " ").trim() || "";
    return { title: pick("title"), id: pick("id"), published: pick("published").slice(0, 10) };
  });
  for (const e of entries) {
    const p = known(e.title);
    if (!p) {
      add("Works on arXiv that the site does not list", `*${e.title}* (${e.published}): ${e.id}`);
    } else if (!p.links?.arxiv) {
      add("arXiv versions of listed works that have no arXiv link", `**${p.title}** (\`${p.slug}\`): ${e.id}`);
    }
  }
}

// ---------------------------------------------------------------- 2. OpenAlex
async function openalex() {
  try {
    const a = await getJSON(`https://api.openalex.org/authors?search=${encodeURIComponent(AUTHOR.given + " " + AUTHOR.family)}&per-page=5`);
    const authors = (a.results || []).filter((x) => norm(x.display_name) === norm(`${AUTHOR.given} ${AUTHOR.family}`));
    if (!authors.length) { errors.push("OpenAlex: no author record named Aydin Mohseni"); return; }
    const ids = authors.map((x) => x.id.split("/").pop()).join("|");
    const w = await getJSON(`https://api.openalex.org/works?filter=author.id:${ids}&sort=publication_date:desc&per-page=100&select=title,publication_date,doi,type,primary_location`);
    const seen = new Set();
    for (const it of w.results || []) {
      if (!it.title || seen.has(norm(it.title))) continue;
      seen.add(norm(it.title));
      if (["erratum", "paratext", "peer-review"].includes(it.type)) continue;
      if (known(it.title)) continue;
      const venue = it.primary_location?.source?.display_name || it.type;
      add("Works in OpenAlex that the site does not list (includes old items the CV may omit on purpose)",
        `*${it.title}* (${it.publication_date || "?"}, ${venue})${it.doi ? `: ${it.doi}` : ""}`);
    }
  } catch (e) { errors.push(`OpenAlex: ${e.message}`); }
}

// ---------------------------------------------------------------- 4. external links
async function links() {
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) { if (!["wp-content", "assets", "primer-on-ai"].includes(f.name)) walk(p); }
      else if (f.name.endsWith(".html")) files.push(p);
    }
  })("_site");
  const urls = new Map();   // url -> first page
  for (const f of files) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(/href="(https?:\/\/[^"#]+)/g)) {
      const u = m[1].replace(/&amp;/g, "&");
      if (/aydinmohseni\.com|fonts\.googleapis|doi\.org\/10\.|linkedin\.com|scholar\.google/.test(u)) continue;   // own site, or hosts that block bots
      if (!urls.has(u)) urls.set(u, "/" + path.relative("_site", f).replace(/index\.html$/, ""));
    }
  }
  const list = [...urls];
  for (let i = 0; i < list.length; i += 8) {
    await Promise.all(list.slice(i, i + 8).map(async ([u, page]) => {
      let status = "";
      for (const method of ["HEAD", "GET"]) {
        try {
          const r = await fetch(u, { method, redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
          status = r.status;
          if (r.ok) return;
        } catch (e) { status = e.name === "TimeoutError" ? "timeout" : "no response"; }
      }
      if (status === 403 || status === 429) return;   // bot blocking, not a dead link
      if (isIgnored(u)) return;
      add("External links that failed to load", `${u} (${status}), on ${page}`);
    }));
  }
}

// ---------------------------------------------------------------- run
await Promise.all([crossref(), arxiv(), openalex()]);
if (CHECK_LINKS) await links();

const date = new Date().toISOString().slice(0, 10);
let md = `FINDINGS: ${findings.length}\n\n`;
md += `Content watch, ${date}. These are leads, not facts: confirm each against its source, then update \`src/_data/\` (see MAINTAINING.md). Nothing here changes the site on its own.\n`;
const sections = [...new Set(findings.map((f) => f.section))];
for (const s of sections) {
  md += `\n### ${s}\n\n` + findings.filter((f) => f.section === s).map((f) => `- [ ] ${f.text}`).join("\n") + "\n";
}
if (!findings.length) md += "\nNothing new found.\n";
if (errors.length) md += `\n### Sources that could not be checked\n\n` + errors.map((e) => `- ${e}`).join("\n") + "\n";
if (OUT) fs.writeFileSync(OUT, md);
process.stdout.write(md);
