// Layout check: a Node port of exproof.ai's tools/check_layout.py.
//
//   node tools/check_layout.mjs [--site _site] [--base http://127.0.0.1:8765] [--only /research/,/about/]
//
// Loads every page in the build at five viewport widths (390, 768, 1024, 1280, 1600), once in
// the day theme and once in the night theme, and fails if any of STYLE.md's layout rules breaks:
//
//   1. The page never scrolls sideways.
//   2. In a text section, nothing except a margin note extends past the right edge of the text column.
//   3. In a wide section, nothing extends past the right edge of the section.
//   4. No margin note overlaps another margin note.
//   5. No text is clipped: no element's content is wider than its box unless the element is a
//      deliberate scroll container (overflow-x: auto or scroll).
//   6. The theme applied: the page background matches the theme's --bg token.
//
// Without --base it serves the build itself under PATH_PREFIX (from the environment, default "/").
// Redirect stubs (pages with a meta refresh) are skipped. Requires Playwright with Chromium.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("Playwright is not installed. In CI: npm install --no-save playwright && npx playwright install --with-deps chromium");
  process.exit(2);
}

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const SITE = path.resolve(opt("--site", "_site"));
let PREFIX = process.env.PATH_PREFIX || "/";
if (!PREFIX.startsWith("/")) PREFIX = "/" + PREFIX;
if (!PREFIX.endsWith("/")) PREFIX += "/";
const WIDTHS = [390, 768, 1024, 1280, 1600];
const THEMES = [
  { name: "day", stored: "light", scheme: "light", bg: "rgb(252, 252, 250)" },
  { name: "night", stored: "dark", scheme: "dark", bg: "rgb(5, 5, 5)" },
];

if (!fs.existsSync(SITE)) {
  console.error(`No build found at ${SITE}. Run npx eleventy first.`);
  process.exit(2);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

let pages = walk(SITE)
  .filter((f) => f.endsWith(".html"))
  .filter((f) => !/<meta[^>]+http-equiv\s*=\s*["']?refresh/i.test(fs.readFileSync(f, "utf8")))
  .map((f) => "/" + path.relative(SITE, f).split(path.sep).join("/").replace(/index\.html$/, ""))
  .sort();
const only = opt("--only", "");
if (only) {
  const keep = new Set(only.split(",").map((s) => s.trim()));
  pages = pages.filter((p) => keep.has(p));
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".woff2": "font/woff2", ".pdf": "application/pdf",
};

// A minimal static server that serves _site under PREFIX, as GitHub Pages does.
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end(); }
      p = "/" + p.slice(PREFIX.length);
      let file = path.join(SITE, p);
      if (!file.startsWith(SITE)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file)) { file = path.join(SITE, "404.html"); res.statusCode = 404; }
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const CHECK = (expectedBg) => {
  const problems = [];
  // Open every collapsible block so its content is checked as a reader would see it.
  document.querySelectorAll("details").forEach((d) => (d.open = true));
  const tol = 1;
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + tol)
    problems.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  const bg = getComputedStyle(document.body).backgroundColor;
  if (expectedBg && bg !== expectedBg) problems.push(`theme not applied: body background ${bg}, expected ${expectedBg}`);
  const isNote = (el) => el.closest(".sidenote, .marginnote");
  const name = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : "");
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
  };

  document.querySelectorAll(".section").forEach((sec) => {
    const body = sec.querySelector(":scope > .body");
    if (!body) return;
    const wide = sec.classList.contains("section--wide");
    const br = body.getBoundingClientRect();
    const pr = parseFloat(getComputedStyle(body).paddingRight) || 0;
    const limit = wide ? br.right : br.right - pr;
    body.querySelectorAll("*").forEach((el) => {
      if (isNote(el) || !visible(el) || el.matches("input, label.margin-toggle")) return;
      const r = el.getBoundingClientRect();
      if (r.right > limit + tol)
        problems.push(`${wide ? "wide" : "text"} section: ${name(el)} ends at ${Math.round(r.right)}, past ${Math.round(limit)}`);
    });
    const notes = [...body.querySelectorAll(".sidenote, .marginnote")].filter(visible).map((n) => n.getBoundingClientRect());
    for (let i = 0; i < notes.length; i++)
      for (let j = i + 1; j < notes.length; j++) {
        const a = notes[i], b = notes[j];
        if (a.left < b.right && b.left < a.right && a.top < b.bottom - tol && b.top < a.bottom - tol)
          problems.push(`two margin notes overlap in section ${sec.id || "(no id)"}`);
      }
  });

  document.querySelectorAll("main *").forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    if (cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.display === "inline") return;
    if (el.matches("canvas, svg, svg *")) return; // drawings size themselves
    if (isNote(el) || el.querySelector(".sidenote, .marginnote")) return; // notes hang into the margin by design
    if (el.scrollWidth > el.clientWidth + tol && el.clientWidth > 0)
      problems.push(`clipped content in ${name(el)} (${el.scrollWidth} > ${el.clientWidth})`);
  });
  return [...new Set(problems)];
};

const server = opt("--base", "") ? null : await serve();
const base = opt("--base", "") || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let failures = 0;
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({ colorScheme: theme.scheme, reducedMotion: "reduce" });
    await context.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch (e) {} }, theme.stored);
    for (const w of WIDTHS) {
      const page = await context.newPage();
      await page.setViewportSize({ width: w, height: 900 });
      for (const p of pages) {
        const url = base.replace(/\/$/, "") + PREFIX + p.replace(/^\//, "");
        await page.goto(url, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const problems = await page.evaluate(CHECK, theme.bg);
        for (const problem of problems) {
          failures++;
          console.log(`[${String(w).padStart(4)}px ${theme.name.padEnd(5)}] ${p}: ${problem}`);
        }
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  if (server) server.close();
}
console.log(
  failures === 0
    ? `Layout check passed: ${pages.length} page(s) x ${WIDTHS.length} widths x ${THEMES.length} themes.`
    : `${failures} problem(s) found across ${pages.length} page(s).`
);
process.exit(failures ? 1 : 0);
