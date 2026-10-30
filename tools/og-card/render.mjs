// Renders src/assets/img/og-card.png (1200 x 630 at 2x) from tools/og-card/card.html.
// Run from the repository root with a static server on port 8077: python3 -m http.server 8077
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright");
const q = process.argv[2] || "";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await p.goto("http://localhost:8077/tools/og-card/card.html?" + q);
await p.waitForSelector("body[data-ready]"); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: process.argv[3] || "src/assets/img/og-card.png" });
await b.close();
