// Eleventy config. Source in src/, output in _site/.
// PATH_PREFIX is "/" once the custom domain is live; the Pages workflow sets it for the github.io preview.
//
// Development pages (src/lab/*, the model test pages, and src/styleguide.njk) are left out of the
// build unless DEV_PAGES=1 is set:  DEV_PAGES=1 npx eleventy --serve
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// A talk or event date as given in the data: 2026, "2026", "2026-11", "2026-11-14", or a YAML date.
// Returns { y, m, d, precision } (m and d 1-based), or null.
function parseDate(v) {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate(), precision: "day" };
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return { y: +m[1], m: +m[2], d: +m[3], precision: "day" };
  if ((m = s.match(/^(\d{4})-(\d{2})$/))) return { y: +m[1], m: +m[2], d: 0, precision: "month" };
  if ((m = s.match(/^(\d{4})$/))) return { y: +m[1], m: 0, d: 0, precision: "year" };
  return null;
}

// Is a dated event still to come at build time? The rule depends on how precisely the date is known:
//   day:   upcoming through the day itself (UTC);
//   month: upcoming through the last day of that month (the exact day is not known);
//   year:  upcoming only if the whole year lies ahead (a year-only date in the current year
//          cannot be placed, so it counts as past).
function isUpcoming(v, now = new Date()) {
  const p = parseDate(v);
  if (!p) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (p.precision === "day") return Date.UTC(p.y, p.m - 1, p.d) >= today;
  if (p.precision === "month") return Date.UTC(p.y, p.m, 0) >= today;   // day 0 of the next month = last day of this one
  return p.y > now.getUTCFullYear();
}

function formatDate(v) {
  const p = parseDate(v);
  if (!p) return v ? String(v) : "";
  if (p.precision === "day") return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
  if (p.precision === "month") return `${MONTHS[p.m - 1]} ${p.y}`;
  return String(p.y);
}

// Pixel size of a PNG, JPEG, GIF or WebP file, read from its header, for width and height
// attributes (so the page does not jump as lazy images arrive). Returns { width, height } or null.
function imageSize(file) {
  let b;
  try { b = fs.readFileSync(file); } catch { return null; }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L") { const v = b.readUInt32LE(21); return { width: 1 + (v & 0x3fff), height: 1 + ((v >> 14) & 0x3fff) }; }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// The name of the ∃xProof AI program in running text. The ∃ is set from the math stack (the CMU
// subsets lack it) and hidden from screen readers, which read a hidden "E" instead, so the
// accessible name is "ExProof AI" everywhere (the masthead link uses aria-label with the same name).
const EXPROOF_NAME = '<span class="exists" aria-hidden="true">∃</span><span class="visually-hidden">E</span>xProof AI';

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default function (eleventyConfig) {
  const BUILD = new Date();
  const dev = process.env.DEV_PAGES === "1";
  if (!dev) {
    eleventyConfig.ignores.add("src/lab/**");
    eleventyConfig.ignores.add("src/styleguide.njk");
  }

  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));
  eleventyConfig.addGlobalData("build", { date: BUILD, iso: BUILD.toISOString().slice(0, 10), year: BUILD.getUTCFullYear() });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/wp-content": "wp-content" });
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.addPassthroughCopy({ "src/.nojekyll": ".nojekyll" });

  // The fonts README is documentation, not part of the site: passthrough copy brings it along
  // with the fonts, so remove it from the output after each build.
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const f = path.join(dir.output, "assets", "fonts", "COMPUTER-MODERN-README.md");
    try { fs.rmSync(f, { force: true }); } catch { /* nothing to remove */ }
  });

  // {% set size = "/assets/img/x.png" | imageSize %} -> { width, height } of src/assets/img/x.png.
  // A missing or unreadable file fails the build, so a broken image path cannot ship.
  eleventyConfig.addFilter("imageSize", (p) => {
    const size = imageSize(path.join("src", String(p).replace(/^\/+/, "")));
    if (!size) throw new Error(`imageSize: cannot read the size of ${p}`);
    return size;
  });

  eleventyConfig.addFilter("year", (d) => new Date(d).getUTCFullYear());
  eleventyConfig.addFilter("formatDate", formatDate);
  eleventyConfig.addFilter("isUpcoming", (d) => isUpcoming(d, BUILD));

  // Split a list of dated items (talks, workshops) into upcoming and past at build time.
  // key names the date field; for workshops pass "end".
  eleventyConfig.addFilter("upcoming", (items, key = "date") => (items || []).filter((t) => isUpcoming(t[key], BUILD)));
  eleventyConfig.addFilter("past", (items, key = "date") => (items || []).filter((t) => !isUpcoming(t[key], BUILD)));

  // Upcoming items soonest first (the data lists newest first).
  eleventyConfig.addFilter("soonestFirst", (items, key = "date") => [...(items || [])].sort((a, b) => {
    const pa = parseDate(a[key]) || { y: 0, m: 0, d: 0 }, pb = parseDate(b[key]) || { y: 0, m: 0, d: 0 };
    return (pa.y - pb.y) || (pa.m - pb.m) || (pa.d - pb.d);
  }));

  // Group talks by title (and paper), keeping the data's newest-first order, for the Research page:
  // one entry per talk with every occasion it was given.
  eleventyConfig.addFilter("groupTalks", (talks) => {
    const groups = [];
    const byKey = new Map();
    for (const t of talks || []) {
      const key = (t.paper_slug || "") + "|" + t.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      let g = byKey.get(key);
      if (!g) {
        g = { title: t.title, paper_slug: t.paper_slug || "", occasions: [] };
        byKey.set(key, g);
        groups.push(g);
      }
      g.occasions.push({ ...t, upcoming: isUpcoming(t.date, BUILD) });
    }
    return groups;
  });

  eleventyConfig.addFilter("coauthors", (authors) => (authors || []).filter((a) => !a.includes("Mohseni")));
  eleventyConfig.addFilter("findBy", (list, key, value) => (list || []).find((x) => x[key] === value));
  eleventyConfig.addFilter("findBySlug", (list, slug) => (list || []).find((x) => x.slug === slug));
  eleventyConfig.addFilter("whereStatus", (list, status) => (list || []).filter((x) => x.status === status));
  eleventyConfig.addFilter("whereKind", (list, kind) => (list || []).filter((x) => x.kind === kind));

  // Escape plain text, then turn each phrase in `links` (phrase -> URL, or phrase -> slug when
  // `slugBase` is given) into a link. Used for the bios and the strand essays, whose data is
  // plain text. `quote` wraps each linked phrase in curly quotes (paper titles).
  //
  // opts.people: a list of people ({ display, url }, e.g. coinquirers); each display name in the
  // text links to that person's site (STYLE.md: link a co-inquirer's name wherever it appears).
  // People without a URL stay plain text.
  eleventyConfig.addFilter("exproofName", () => EXPROOF_NAME);
  eleventyConfig.addFilter("linkPhrases", (text, links = {}, opts = {}) => {
    let html = escapeHtml(text || "");
    const entries = Object.entries(links || {}).sort((a, b) => b[0].length - a[0].length);
    const tokens = [];
    for (const [phrase, target] of entries) {
      const esc = escapeHtml(phrase);
      if (!html.includes(esc)) continue;
      const href = opts.slugBase ? `${opts.slugBase}#pub-${target}` : target;
      const a = `<a href="${escapeHtml(href)}">${esc}</a>`;
      const token = `\u0000${tokens.length}\u0000`;
      tokens.push(opts.quote ? `“${a}”` : a);
      html = html.split(esc).join(token);
    }
    const people = (opts.people || []).filter((p) => p && p.display && p.url).sort((a, b) => b.display.length - a.display.length);
    for (const p of people) {
      const esc = escapeHtml(p.display);
      if (!html.includes(esc)) continue;
      const token = `\u0001${tokens.length}\u0001`;
      tokens.push(`<a href="${escapeHtml(p.url)}">${esc}</a>`);
      html = html.split(esc).join(token);
    }
    html = html.replace(/\u0001(\d+)\u0001/g, (_, i) => tokens[+i]);
    html = html.replace(/∃xProof AI/g, `<a href="https://exproof.ai/">${EXPROOF_NAME}</a>`);
    // A comma or period after a quoted title goes inside the closing quote (American usage).
    html = html.replace(/\u0000(\d+)\u0000([,.]?)/g, (_, i, punct) => {
      const t = tokens[+i];
      return opts.quote && punct ? t.slice(0, -1) + punct + "\u201d" : t + punct;
    });
    return html;
  });

  // Typographic apostrophes in text (the data is typed with straight ones): O'Connor, You'll,
  // Aydin's. Only text between tags is touched, never attributes, scripts, styles or code.
  eleventyConfig.addTransform("apostrophes", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    let skip = 0;
    return content.split(/(<[^>]+>)/).map((part) => {
      if (part.startsWith("<")) {
        const m = part.match(/^<(\/?)(script|style|pre|code|textarea)\b/i);
        if (m) skip += m[1] ? -1 : 1;
        return part;
      }
      return skip > 0 ? part : part.replace(/([A-Za-z\u00C0-\u024F])(?:'|&#39;)([A-Za-z])/g, "$1\u2019$2").replace(/([a-z])s(?:'|&#39;)(\s)/g, "$1s\u2019$2");
    }).join("");
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    pathPrefix: process.env.PATH_PREFIX || "/",
    templateFormats: ["njk", "md", "html", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
