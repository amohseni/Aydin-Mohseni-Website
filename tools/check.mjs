// Static checks on the built site. Builds nothing: run `npx eleventy` first.
//
//   node tools/check.mjs [--site _site] [--allow-missing /cv.pdf] [--strict-fragments]
//
// Fails (exit status 1) on:
//   1. internal links or asset references that do not resolve to a file in _site
//      (absolute paths must carry PATH_PREFIX, read from the environment, default "/");
//   2. <img> elements without an alt attribute;
//   3. em dashes in any HTML file (the character, &mdash;, or a numeric reference);
//   4. pages missing <title>, a meta description, or the Open Graph tags
//      og:title, og:description, og:type, og:url and og:image.
//      Redirect stubs (pages with a meta refresh) need a title, a canonical link and noindex instead.
//   5. double-escaped character references (such as "&amp;#39;"), which show as literal code.
//
// Warns (no failure) on: links to #fragments that no element on the target page carries
// (fail with --strict-fragments), img with alt="" (allowed for decorative images),
// absolute links to aydinmohseni.com whose path does not exist in the build,
// and em dashes in CSS, JS, XML and text files.
//
// --allow-missing takes a site path (without the prefix) that may be absent, such as /cv.pdf,
// which only CI builds. It may be given more than once.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const SITE = path.resolve(opt("--site", "_site"));
const STRICT_FRAGMENTS = args.includes("--strict-fragments");
const ALLOW_MISSING = new Set(args.flatMap((a, i) => (a === "--allow-missing" ? [args[i + 1]] : [])));
let PREFIX = process.env.PATH_PREFIX || "/";
if (!PREFIX.startsWith("/")) PREFIX = "/" + PREFIX;
if (!PREFIX.endsWith("/")) PREFIX += "/";
const SITE_HOSTS = ["aydinmohseni.com", "www.aydinmohseni.com"];

if (!fs.existsSync(SITE)) {
  console.error(`No build found at ${SITE}. Run npx eleventy first.`);
  process.exit(2);
}

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const files = walk(SITE);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const rel = (f) => "/" + path.relative(SITE, f).split(path.sep).join("/");

// Map a site path (no prefix, no query or hash) to a file in _site, or null.
function resolveSitePath(p) {
  let decoded;
  try { decoded = decodeURIComponent(p); } catch { decoded = p; }
  const base = path.join(SITE, decoded);
  if (!base.startsWith(SITE)) return null;
  const candidates = decoded.endsWith("/")
    ? [path.join(base, "index.html")]
    : [base, path.join(base, "index.html"), base + ".html"];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

// The site path a page is served at, without the prefix ("/research/index.html" -> "/research/").
const pageUrl = (file) => rel(file).replace(/index\.html$/, "");

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = fs.readFileSync(file, "utf8");
    const ids = new Set();
    for (const m of html.matchAll(/\s(?:id|name)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) ids.add(m[2] ?? m[3] ?? m[4]);
    idCache.set(file, ids);
  }
  return idCache.get(file);
}

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4]) : null;
};
const decodeEntities = (s) => s.replace(/&amp;/g, "&").replace(/&#0*38;/g, "&").replace(/&quot;/g, '"');

const EM_DASH = /\u2014|&mdash;|&#0*8212;|&#x0*2014;/i;

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function checkEmDashes(file, text, asError) {
  const re = new RegExp(EM_DASH.source, "gi");
  for (const m of text.matchAll(re)) {
    const line = lineOf(text, m.index);
    const snippet = text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " ");
    (asError ? err : warn)(rel(file), `em dash on line ${line}: "...${snippet}..."`);
  }
}

for (const file of htmlFiles) {
  const name = rel(file);
  const raw = fs.readFileSync(file, "utf8");
  checkEmDashes(file, raw, true);
  for (const m of raw.matchAll(/&amp;(#[0-9]+|#x[0-9a-f]+|[a-z]+);/gi)) {
    err(name, `double-escaped "&${m[1]};" on line ${lineOf(raw, m.index)}`);
  }

  // Remove comments and the bodies of inline scripts and styles before reading attributes.
  const html = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2")
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, "$1$2")
    .replace(/(<template\b[^>]*>)[\s\S]*?(<\/template>)/gi, "$1$2");
  const tags = [...html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)].map((m) => ({ name: m[1].toLowerCase(), tag: m[0] }));
  const metas = tags.filter((t) => t.name === "meta");
  const metaContent = (key, value) => {
    const t = metas.find((m) => (attr(m.tag, key) || "").toLowerCase() === value);
    return t ? attr(t.tag, "content") : null;
  };
  const isRedirect = metas.some((m) => (attr(m.tag, "http-equiv") || "").toLowerCase() === "refresh");

  // 4. Title, description, Open Graph.
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  if (!title || !title.trim()) err(name, "missing or empty <title>");
  if (!metaContent("name", "description")) err(name, "missing meta description");
  if (isRedirect) {
    if (!tags.some((t) => t.name === "link" && (attr(t.tag, "rel") || "").toLowerCase() === "canonical")) err(name, "redirect stub without a canonical link");
    if (!/noindex/i.test(metaContent("name", "robots") || "")) err(name, "redirect stub without noindex");
  } else {
    for (const og of ["og:title", "og:description", "og:type", "og:url", "og:image"]) {
      if (!metaContent("property", og)) err(name, `missing ${og}`);
    }
  }

  // 2. Alt text.
  for (const t of tags.filter((t) => t.name === "img")) {
    const alt = attr(t.tag, "alt");
    const src = attr(t.tag, "src") || "(no src)";
    if (alt === null) err(name, `img without alt: ${src}`);
    else if (!alt.trim() && !/aria-hidden\s*=\s*"true"|role\s*=\s*"presentation"/i.test(t.tag)) warn(name, `img with empty alt (decorative?): ${src}`);
  }

  // 1. Links and asset references.
  const refs = [];
  for (const t of tags) {
    for (const a of ["href", "src", "poster", "data"]) {
      const v = attr(t.tag, a);
      if (v !== null) refs.push({ tag: t.name, value: decodeEntities(v.trim()), kind: a });
    }
    const srcset = attr(t.tag, "srcset");
    if (srcset) for (const part of srcset.split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u) refs.push({ tag: t.name, value: decodeEntities(u), kind: "srcset" });
    }
    // Meta refresh targets.
    if (t.name === "meta" && (attr(t.tag, "http-equiv") || "").toLowerCase() === "refresh") {
      const m = (attr(t.tag, "content") || "").match(/url\s*=\s*(.+)$/i);
      if (m) refs.push({ tag: "meta refresh", value: decodeEntities(m[1].trim()), kind: "refresh" });
    }
  }

  for (const r of refs) {
    let v = r.value;
    if (!v) { err(name, `empty ${r.kind} on <${r.tag}>`); continue; }
    if (/^(mailto:|tel:|data:|javascript:|blob:|about:)/i.test(v)) continue;

    let absoluteSiteLink = false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith("//")) {
      let u;
      try { u = new URL(v.startsWith("//") ? "https:" + v : v); } catch { err(name, `malformed URL: ${v}`); continue; }
      if (!SITE_HOSTS.includes(u.hostname)) continue; // external
      absoluteSiteLink = true;
      v = u.pathname + u.search + u.hash; // canonical and og:url use the production host, no prefix
    }

    const hashIndex = v.indexOf("#");
    const fragment = hashIndex >= 0 ? v.slice(hashIndex + 1) : "";
    let p = (hashIndex >= 0 ? v.slice(0, hashIndex) : v).split("?")[0];

    let sitePath;
    if (p === "") {
      sitePath = null; // same page
    } else if (absoluteSiteLink) {
      sitePath = p;
    } else if (p.startsWith("/")) {
      if (!p.startsWith(PREFIX) && p + "/" !== PREFIX) {
        err(name, `<${r.tag} ${r.kind}="${r.value}"> is missing the path prefix ${PREFIX} (use the url filter)`);
        continue;
      }
      sitePath = "/" + p.slice(PREFIX.length);
    } else {
      sitePath = new URL(p, "https://x" + pageUrl(file)).pathname;
    }

    const target = sitePath === null ? file : resolveSitePath(sitePath);
    if (!target) {
      if (ALLOW_MISSING.has(sitePath)) continue;
      const msg = `broken link <${r.tag} ${r.kind}="${r.value}">`;
      if (absoluteSiteLink) {
        // Canonical and og:url of this page should exist; other production-host links are warnings.
        const selfLink = sitePath === pageUrl(file) || sitePath === rel(file);
        (selfLink ? err : warn)(name, msg + (selfLink ? "" : " (absolute link to the production host)"));
      } else err(name, msg);
      continue;
    }
    if (fragment && target.endsWith(".html") && !["top"].includes(fragment)) {
      let frag;
      try { frag = decodeURIComponent(fragment); } catch { frag = fragment; }
      if (!idsOf(target).has(frag)) {
        (STRICT_FRAGMENTS ? err : warn)(name, `link to #${frag}, which ${rel(target)} does not define`);
      }
    }
  }
}

// Em dashes in other text files are warnings.
for (const file of files.filter((f) => /\.(css|js|mjs|xml|txt|svg|json|md)$/i.test(f))) {
  checkEmDashes(file, fs.readFileSync(file, "utf8"), false);
}

// Print each distinct message once, with a count when it repeats on a page (nav links, for example).
const tally = (list) => {
  const counts = new Map();
  for (const m of list) counts.set(m, (counts.get(m) || 0) + 1);
  return [...counts].map(([m, n]) => (n > 1 ? `${m} (x${n})` : m));
};
for (const w of tally(warnings)) console.log(`warning  ${w}`);
for (const e of tally(errors)) console.log(`error    ${e}`);
console.log(
  `\nChecked ${htmlFiles.length} HTML page(s) under ${SITE} with path prefix ${PREFIX}: ` +
  `${errors.length} error(s), ${warnings.length} warning(s).`
);
process.exit(errors.length ? 1 : 0);
