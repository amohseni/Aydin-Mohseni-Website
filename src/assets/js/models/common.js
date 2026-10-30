// Shared helpers for the canvas models.
//
// Every model imports what it needs from here: crisp canvas sizing (devicePixelRatio),
// color tokens read from CSS custom properties at draw time (so a theme switch applies live),
// pausing when off screen or when the tab is hidden, reduced-motion detection, quintic
// smootherstep, a seeded random number generator, and chalk strokes (slight width variation
// and a fine grain, so lines look drawn on paper).
//
// Nothing here touches the DOM when the module is imported, so the numerical parts of a model
// can be imported and tested in Node.

// ---------- Math ----------

// Quintic smootherstep (Perlin): zero first and second derivatives at both ends.
export function smootherstep(t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

// mulberry32: small, fast, seeded generator with a 2^32 period. Returns floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function freshSeed() { return (Math.random() * 4294967296) >>> 0; }

// Stable pseudo-random value in [0, 1) for an integer key (used for per-chunk stroke widths,
// so the same piece of a trace keeps the same width from frame to frame).
export function hash01(n, salt = 0) {
  let h = Math.imul((n | 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(salt | 0, 0xC2B2AE35);
  h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D); h ^= h >>> 15; h = Math.imul(h, 0x846CA68B); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------- Environment ----------

const hasWindow = typeof window !== "undefined";

export function prefersReducedMotion() {
  return hasWindow && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Calls fn(reduced) when the reduced-motion preference changes. Returns an unsubscribe function.
export function onReducedMotionChange(fn) {
  if (!hasWindow || !window.matchMedia) return () => {};
  const q = window.matchMedia("(prefers-reduced-motion: reduce)");
  const h = () => fn(q.matches);
  if (q.addEventListener) q.addEventListener("change", h); else if (q.addListener) q.addListener(h);
  return () => { if (q.removeEventListener) q.removeEventListener("change", h); else if (q.removeListener) q.removeListener(h); };
}

// ---------- Color tokens ----------

const TOKEN_DEFAULTS = {
  "--bg": "#fcfcfa", "--fg": "#141413", "--fg-2": "#5d5d58", "--rule": "#e2e2dc",
  "--rule-strong": "#a9a9a2", "--red": "#b0122b", "--red-bright": "#d11c3d",
  "--green": "#1a7f4e", "--chalk": "#2b2b29"
};

// Reads the color tokens from the root element. Cheap enough to call once per frame, but
// models usually call it through a TokenWatcher, which caches until the theme changes.
export function readTokens(el) {
  const out = {};
  if (!hasWindow) { Object.assign(out, TOKEN_DEFAULTS); return out; }
  const cs = getComputedStyle(el || document.documentElement);
  for (const k in TOKEN_DEFAULTS) {
    const v = cs.getPropertyValue(k).trim();
    out[k] = v || TOKEN_DEFAULTS[k];
  }
  return out;
}

// Caches tokens and invalidates the cache when the theme can have changed: the data-theme or
// class attribute on <html>, or the system color scheme. onChange runs after invalidation
// (models under reduced motion use it to redraw their still frame).
export class TokenWatcher {
  constructor(onChange) {
    this.onChange = onChange || null;
    this.cache = null;
    if (!hasWindow) return;
    const inv = () => { this.cache = null; if (this.onChange) this.onChange(); };
    this.mo = new MutationObserver(inv);
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    if (window.matchMedia) {
      this.mq = window.matchMedia("(prefers-color-scheme: dark)");
      this.mqh = inv;
      if (this.mq.addEventListener) this.mq.addEventListener("change", inv); else if (this.mq.addListener) this.mq.addListener(inv);
    }
  }
  get() { return this.cache || (this.cache = readTokens()); }
  destroy() {
    if (this.mo) this.mo.disconnect();
    if (this.mq) { if (this.mq.removeEventListener) this.mq.removeEventListener("change", this.mqh); else if (this.mq.removeListener) this.mq.removeListener(this.mqh); }
  }
}

// Parses "#rgb", "#rrggbb" or "rgb(r, g, b)" into [r, g, b].
export function parseColor(c) {
  c = String(c).trim();
  if (c[0] === "#") {
    if (c.length === 4) return [1, 2, 3].map((i) => parseInt(c[i] + c[i], 16));
    return [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(/[ ,/]+/).slice(0, 3).map(Number);
  return [128, 128, 128];
}
export function rgba(c, a) {
  const p = Array.isArray(c) ? c : parseColor(c);
  return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
}
export function mixColor(a, b, t) {
  const pa = parseColor(a), pb = parseColor(b);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}

// ---------- Canvas ----------

// Keeps a canvas's backing store at CSS size times devicePixelRatio (capped at 2, which is
// indistinguishable at these line weights and halves fill cost on 3x phones). The context is
// scaled so drawing code works in CSS pixels. onResize(width, height) runs after each change.
export class CanvasSizer {
  constructor(canvas, onResize, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onResize = onResize;
    this.maxDpr = opts.maxDpr || 2;
    this.target = opts.observe || canvas;
    this.w = 0; this.h = 0; this.dpr = 1;
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.target);
    this.dprQuery = null;
    this.watchDpr();
    this.measure();
  }
  watchDpr() {
    if (!window.matchMedia) return;
    if (this.dprQuery) this.dprQuery.removeEventListener("change", this.dprHandler);
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    this.dprHandler = () => { this.watchDpr(); this.measure(); };
    if (this.dprQuery.addEventListener) this.dprQuery.addEventListener("change", this.dprHandler);
  }
  measure() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.onResize) this.onResize(w, h);
  }
  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  destroy() {
    this.ro.disconnect();
    if (this.dprQuery && this.dprQuery.removeEventListener) this.dprQuery.removeEventListener("change", this.dprHandler);
  }
}

// ---------- Animation loop with visibility pausing ----------

// Runs frame(now, dt) on requestAnimationFrame while the element is on screen, the tab is
// visible, and the loop has not been paused by the user. dt is in milliseconds and is capped,
// so a model never jumps after a pause. Call start() once; pause()/resume() for user control.
export class Loop {
  constructor(el, frame, opts = {}) {
    this.el = el; this.frame = frame;
    this.maxDt = opts.maxDt || 50;
    this.minInterval = opts.fps ? 1000 / opts.fps - 2 : 0;   // optional frame-rate cap
    this.onScreen = true; this.tabVisible = !document.hidden; this.userPaused = false;
    this.running = false; this.raf = 0; this.last = 0; this.lastDraw = 0;
    this.tick = this.tick.bind(this);
    this.io = new IntersectionObserver((es) => {
      for (const e of es) this.onScreen = e.isIntersecting;
      this.update();
    }, { rootMargin: "64px" });
    this.io.observe(el);
    this.vis = () => { this.tabVisible = !document.hidden; this.update(); };
    document.addEventListener("visibilitychange", this.vis);
    // Site-wide "Pause motion" (footer control, WCAG 2.2.2): <html data-motion="paused"> stops
    // every loop; a "motionchange" event on document clears each model's own pause or play
    // choice. A model's own Play button still runs that one model while motion is paused.
    this.userResumed = false;
    this.motion = () => { this.userPaused = false; this.userResumed = false; this.update(); };
    document.addEventListener("motionchange", this.motion);
  }
  get active() { return this.onScreen && this.tabVisible && !this.userPaused && this.started && (!motionPaused() || this.userResumed); }
  start() { this.started = true; this.update(); }
  stop() { this.started = false; this.update(); }
  pause() { this.userPaused = true; this.userResumed = false; this.update(); }
  resume() { this.userPaused = false; this.userResumed = true; this.update(); }
  update() {
    if (this.active && !this.running) { this.running = true; this.last = 0; this.raf = requestAnimationFrame(this.tick); }
    else if (!this.active && this.running) { this.running = false; cancelAnimationFrame(this.raf); }
  }
  tick(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    if (this.minInterval && this.lastDraw && now - this.lastDraw < this.minInterval) return;
    const dt = this.last ? Math.min(this.maxDt, now - this.last) : 16;
    this.last = now; this.lastDraw = now;
    this.frame(now, dt);
  }
  destroy() {
    this.stop(); this.io.disconnect();
    document.removeEventListener("visibilitychange", this.vis);
    document.removeEventListener("motionchange", this.motion);
  }
}

// True while the reader has paused motion site-wide (the footer control in site.js).
export function motionPaused() {
  return document.documentElement.getAttribute("data-motion") === "paused";
}

// ---------- Chalk ----------

// A small tile of the chalk color with per-pixel alpha noise, used as a stroke pattern so that
// lines carry a fine grain. Cached per (context, color). The tile is drawn at device resolution
// and the pattern is scaled back, so the grain stays one device pixel fine.
const grainCache = new WeakMap();
export function chalkPattern(ctx, color, dpr = 1) {
  let byColor = grainCache.get(ctx);
  if (!byColor) { byColor = new Map(); grainCache.set(ctx, byColor); }
  const key = color + "@" + dpr;
  if (byColor.has(key)) return byColor.get(key);
  const N = 96, tile = document.createElement("canvas");
  tile.width = tile.height = N;
  const tc = tile.getContext("2d"), img = tc.createImageData(N, N), d = img.data;
  const [r, g, b] = parseColor(color), rnd = mulberry32(0xC4A1C);
  for (let i = 0; i < N * N; i++) {
    // Mostly solid with sparse lighter specks: grain, not noise.
    const u = rnd(), a = u < 0.18 ? 0.35 + 0.4 * rnd() : 0.82 + 0.18 * rnd();
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = Math.round(255 * a);
  }
  tc.putImageData(img, 0, 0);
  const pat = ctx.createPattern(tile, "repeat");
  if (pat && pat.setTransform && typeof DOMMatrix !== "undefined") pat.setTransform(new DOMMatrix().scale(1 / dpr));
  if (byColor.size > 8) byColor.clear();
  byColor.set(key, pat);
  return pat;
}

// Strokes a polyline in chalk. pts is a flat array [x0, y0, x1, y1, ...] in CSS pixels.
// The line is cut into chunks of `chunk` points; each chunk gets a width from a stable hash
// of (start index + indexOffset), within +/- jitter of `width`. Pass indexOffset = the absolute
// index of pts[0] in a growing trace, so widths do not shimmer as the trace scrolls.
// alphaFn(chunkIndex, midX, midY, midIndex) may return a per-chunk alpha multiplier (depth, scrim).
export function chalkStroke(ctx, pts, opts = {}) {
  const n = pts.length >> 1;
  if (n < 2) return;
  const width = opts.width || 1, jitter = opts.jitter == null ? 0.18 : opts.jitter;
  const chunk = opts.chunk || 24, off = opts.indexOffset || 0, salt = opts.salt || 0;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = opts.grain === false ? opts.color : chalkPattern(ctx, opts.color, opts.dpr || 1);
  const baseAlpha = opts.alpha == null ? 1 : opts.alpha;
  // Chunk boundaries are aligned to absolute indices so they do not move as the trace scrolls.
  let s = 0;
  while (s < n - 1) {
    const abs = s + off;
    const k = Math.floor(abs / chunk);
    let e = (k + 1) * chunk - off;           // end index (inclusive) of this chunk
    if (e > n - 1) e = n - 1;
    if (e <= s) e = s + 1;
    let a = baseAlpha;
    if (opts.alphaFn) {
      const m = (s + e) >> 1;
      a *= opts.alphaFn(k, pts[m * 2], pts[m * 2 + 1], m);
    }
    if (a > 0.003) {
      ctx.globalAlpha = a;
      ctx.lineWidth = width * (1 + jitter * (2 * hash01(k, salt) - 1));
      ctx.beginPath();
      ctx.moveTo(pts[s * 2], pts[s * 2 + 1]);
      for (let i = s + 1; i <= e; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
      ctx.stroke();
    }
    s = e;
  }
  ctx.restore();
}

// The moving light of the animation vocabulary: a faint pool, a soft glow, and a small core,
// each a radial gradient with a smooth falloff. intensity scales the glow and pool.
export function drawLight(ctx, x, y, color, coreColor, opts = {}) {
  const I = opts.intensity == null ? 1 : opts.intensity, s = opts.scale || 1;
  const layers = [
    [40 * s, 0.10 * I, 2.2],   // pool
    [10 * s, 0.38 * I, 1.8],   // glow
    [2.6 * s, Math.min(1, 0.4 + 0.6 * I), 0.9]  // core
  ];
  ctx.save();
  layers.forEach(([r, peak, fall], i) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = parseColor(i === 2 ? coreColor : color);
    [0, 0.25, 0.5, 0.75, 1].forEach((o) => g.addColorStop(o, rgba(col, (peak * Math.pow(1 - o, fall)).toFixed(4))));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ---------- Default model styles ----------

// Minimal structural styles for model chrome (canvas block, controls row, the matrix table in
// "How it works"), wrapped in :where() so they have zero specificity and the site stylesheet overrides them.
export function ensureModelStyles() {
  if (!hasWindow || document.getElementById("model-base-styles")) return;
  const st = document.createElement("style");
  st.id = "model-base-styles";
  st.textContent = `
:where(.model-canvas) { display: block; width: 100%; touch-action: pan-y; }
:where(.model-controls) { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.2rem; }
:where(.model-hint) { margin-left: auto; }
:where(.model-how-body table) { border-collapse: collapse; font-family: "CMU Typewriter Text", ui-monospace, monospace; font-size: 0.85rem; margin: 0.2rem 0 0.9rem; }
:where(.model-how-body td) { padding: 0.05rem 0.6rem; text-align: right; font-variant-numeric: tabular-nums; }
:where(.visually-hidden) { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
`;
  document.head.appendChild(st);
}
