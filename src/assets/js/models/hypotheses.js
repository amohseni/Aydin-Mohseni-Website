// Hypothesis-space refinement: Bayesian updating within a partition that has a catch-all cell,
// and refinement of the partition when the catch-all gains enough probability.
//
// The world: a coin whose chance of heads is one of the 19 values 0.05, 0.10, ..., 0.95. The
// learner does not start with all 19 as separate hypotheses. It names three (0.20, 0.50, 0.80)
// and lumps the other sixteen into a catch-all, "other". The prior gives each named hypothesis
// 1/4 and the catch-all 1/4, spread evenly over its members.
//
// Updating stays within the current partition (the current algebra of propositions). A named
// hypothesis has likelihood theta or 1 - theta for a flip. The catch-all is a composite
// hypothesis: its likelihood is the average of its members' likelihoods, weighted by their
// probabilities given the catch-all, and those conditional weights are updated by Bayes' rule
// too. Cell masses are multiplied by their likelihoods and renormalized.
//
// Refinement: when the catch-all's mass exceeds the threshold, the learner names the K members
// of the catch-all with the highest conditional weight. Each new cell receives the catch-all's
// mass times its conditional weight; the catch-all keeps the rest and its weights are
// renormalized over the remaining members. No other cell changes, so total probability is
// unchanged, and the cell masses always equal the posterior over the 19 values summed over each
// cell (tools/test-models-agency.mjs checks both).
//
// The numerical part (no DOM) is exported for that test.
//
// mount(container, options) builds the canvas, the controls and the "How it works" disclosure.

import {
  smootherstep, clamp, mulberry32, freshSeed, prefersReducedMotion, onReducedMotionChange,
  TokenWatcher, rgba, CanvasSizer, Loop, chalkStroke, drawLight, ensureModelStyles
} from "./common.js";

// ---------- Model ----------

export const THETAS = Array.from({ length: 19 }, (_, i) => Math.round((0.05 + 0.05 * i) * 100) / 100);
export const INITIAL_NAMED = [3, 9, 15];   // indices of 0.20, 0.50, 0.80
export const NAMED_PRIOR = 0.25;           // prior of each initially named hypothesis
export const SPLIT_K = 2;                  // members named at each refinement
export const SETTLED = 0.99;               // a named hypothesis at or above this has settled the question
export const MAX_FLIPS = 3000;

export class HypothesisSpace {
  constructor({ named = INITIAL_NAMED, namedPrior = NAMED_PRIOR, thetas = THETAS } = {}) {
    this.thetas = thetas;
    this.cells = [];
    this.nextId = 0;
    for (const i of named) this.cells.push({ id: this.nextId++, kind: "named", member: i, mass: namedPrior, born: 0 });
    const rest = thetas.map((_, i) => i).filter((i) => !named.includes(i));
    const caMass = 1 - namedPrior * named.length;
    // Conditional weights of the catch-all's members (zero outside it).
    this.w = new Float64Array(thetas.length);
    for (const i of rest) this.w[i] = 1 / rest.length;
    this.catchAll = rest.length ? { id: this.nextId++, kind: "catch", mass: caMass, born: 0 } : null;
    this.flips = 0; this.heads = 0;
  }
  // Cells in display order: named cells in the order they were named, then the catch-all.
  get order() { return this.catchAll ? this.cells.concat([this.catchAll]) : this.cells.slice(); }
  inCatch(i) { return this.catchAll && !this.cells.some((c) => c.member === i); }
  total() { let s = 0; for (const c of this.order) s += c.mass; return s; }

  // One flip, Bayes' rule within the current partition.
  update(heads) {
    const lik = (i) => (heads ? this.thetas[i] : 1 - this.thetas[i]);
    let z = 0;
    for (const c of this.cells) { c.mass *= lik(c.member); z += c.mass; }
    if (this.catchAll) {
      let lca = 0;
      for (let i = 0; i < this.w.length; i++) if (this.w[i] > 0) lca += this.w[i] * lik(i);
      for (let i = 0; i < this.w.length; i++) if (this.w[i] > 0) this.w[i] = (this.w[i] * lik(i)) / lca;
      this.catchAll.mass *= lca;
      z += this.catchAll.mass;
    }
    for (const c of this.order) c.mass /= z;
    this.flips++; if (heads) this.heads++;
  }

  // Splits K members out of the catch-all if its mass exceeds the threshold. Returns the new
  // cells, or null. If the catch-all has K or fewer members left, all are named and it is gone.
  refine(threshold, k = SPLIT_K) {
    const ca = this.catchAll;
    if (!ca || ca.mass <= threshold) return null;
    const live = [];
    for (let i = 0; i < this.w.length; i++) if (this.inCatch(i)) live.push(i);
    live.sort((a, b) => this.w[b] - this.w[a] || a - b);
    const pick = live.length <= k ? live : live.slice(0, k);
    const added = [];
    let taken = 0;
    for (const i of pick) {
      const cell = { id: this.nextId++, kind: "named", member: i, mass: ca.mass * this.w[i], born: this.flips };
      taken += this.w[i];
      this.w[i] = 0;
      this.cells.push(cell); added.push(cell);
    }
    if (pick.length === live.length) { this.catchAll = null; this.w.fill(0); }
    else {
      ca.mass = ca.mass * (1 - taken);
      let s = 0;
      for (let i = 0; i < this.w.length; i++) s += this.w[i];
      if (s > 0) for (let i = 0; i < this.w.length; i++) this.w[i] /= s;
      else {
        // Every remaining member has underflowed to zero weight, so the catch-all's mass is
        // zero too; spread the (empty) conditional weight evenly so later updates stay defined.
        const rest = live.filter((i) => !pick.includes(i));
        for (const i of rest) this.w[i] = 1 / rest.length;
      }
    }
    return added;
  }
  leader() {
    let best = null;
    for (const c of this.cells) if (!best || c.mass > best.mass) best = c;
    return best;
  }
  settled() { const l = this.leader(); return l && l.mass >= SETTLED ? l : null; }
}

// ---------- Text ----------

const HOW_HTML = `
<p>A coin lands heads with some fixed chance, one of the 19 values 0.05, 0.10, &hellip;, 0.95, picked at random at the start of each run and hidden from the learner. The learner starts with three named hypotheses about the chance (0.20, 0.50 and 0.80) and a catch-all, &ldquo;other,&rdquo; that stands for the sixteen values it has not named. Its prior gives each named hypothesis 1/4 and the catch-all 1/4. The bar on the right is the current partition, each cell as tall as its probability; the chart to its left shows how the probabilities have moved, flip by flip. The hatched region is the catch-all. The label of the leading hypothesis is red, and a hypothesis turns green when its probability reaches ${SETTLED}. That is a stopping rule for the animation, not certainty: in simulation, about 3 runs in 100 end with a neighboring value at ${SETTLED}, and the readout then shows a true chance that differs from the green hypothesis. A run that reaches ${MAX_FLIPS.toLocaleString("en-US")} flips without settling ends without a green hypothesis.</p>
<p>Each flip is evidence, and the learner updates by Bayes' rule within its current partition. A named hypothesis assigns heads the chance it names. The catch-all assigns heads the average chance of its members, weighted by how probable each member is given the catch-all, and those weights are updated by Bayes' rule as well. When the true chance is far from every named value, no named hypothesis fits the data well, and probability tends to flow into the catch-all.</p>
<p>When the catch-all's probability passes the threshold set by the slider, the learner refines its partition: it names the ${SPLIT_K} members of the catch-all that are most probable given the catch-all. Each new hypothesis receives the catch-all's probability times its weight within the catch-all, and the catch-all keeps the remainder. No other cell changes, so probability is conserved, and the cells' probabilities are exactly what a learner with the same prior who had named all 19 values from the start would assign to them. The refinement adds propositions the learner can now distinguish; it does not revise any earlier credence. The total shown under the figure is the sum over all cells after each update and each refinement.</p>
<p>This is refinement of a hypothesis space, an epistemic refinement. London and Mohseni (2025) extend the Jeffrey-Bolker framework to model refinements in values, prove a value-of-information theorem for this axiological refinement, and unify epistemic and axiological refinement under a single formalism. The model here is an illustration of refining a partition, not their formalism.</p>
<p>Source: A. J. London and A. Mohseni (2025), &ldquo;Learning the Value of Value Learning,&rdquo; <a href="https://arxiv.org/abs/2511.17714">arXiv:2511.17714</a>.</p>
`;

// ---------- Mount ----------

export function mount(container, options = {}) {
  ensureModelStyles();
  const inFigure = !!(container.closest && container.closest("figure.model"));
  const root = document.createElement(inFigure ? "div" : "figure");
  root.className = inFigure ? "model-body model-body--hypotheses" : "model model--hypotheses";
  const id = "hypotheses-" + Math.random().toString(36).slice(2, 8);
  root.innerHTML = `
<canvas class="model-canvas" role="img" tabindex="0" aria-describedby="${id}-desc"></canvas>
<p id="${id}-desc" class="model-desc${options.visibleDescription ? "" : " visually-hidden"}">${options.description || "A learner's hypotheses about a coin's chance of heads, drawn as a partition whose cells are as tall as their probabilities, with a catch-all for the values it has not named. As flips arrive, probability moves between cells by Bayes' rule. When the catch-all becomes probable enough, it splits into newly named hypotheses, and total probability stays 1."}</p>
<div class="model-controls">
  <button type="button" data-act="restart">New coin</button>
  <button type="button" data-act="pause" aria-pressed="false">Pause</button>
  <label>Split at <input type="range" data-act="threshold" min="0.3" max="0.8" step="0.05" value="0.5" aria-valuetext="0.50"></label>
</div>
<p class="model-desc" aria-live="off"><output class="readout" data-act="readout"></output></p>
<details class="model-how how"><summary>How it works</summary><div class="model-how-body">${HOW_HTML}</div></details>`;
  container.appendChild(root);
  const canvas = root.querySelector("canvas");
  canvas.style.aspectRatio = options.aspect || "16 / 10";
  canvas.style.maxHeight = "30rem";
  const controls = {};
  root.querySelectorAll("[data-act]").forEach((el) => { controls[el.dataset.act] = el; });

  let reduced = prefersReducedMotion() || options.reducedMotion === true;
  let loop = null, sizer = null, ready = false;
  const tokens = new TokenWatcher(() => { if (ready && (!loop || !loop.running)) draw(performance.now()); });
  const rng = mulberry32(options.seed != null ? options.seed >>> 0 : freshSeed());
  let threshold = clamp(+options.threshold || 0.5, 0.3, 0.8);
  controls.threshold.value = String(threshold);

  let space, truth, snaps, lastSplit, settledCell, W = 1, Hh = 1;
  // Phases: step (ease from the previous snapshot to the next), split (hold at a refinement),
  // sweep (green on a settled hypothesis), hold, fade.
  const STEP_MS = 260, SPLIT_MS = 900, SWEEP = 900, HOLD = 2600, FADE = 700;
  let phase = "step", phaseT = 0, alpha = 1, xMaxShown = 40;

  function snapshot() {
    snaps.push({ n: space.flips, cells: space.order.map((c) => ({ id: c.id, kind: c.kind, member: c.member, mass: c.mass })) });
  }

  function newRun() {
    space = new HypothesisSpace();
    truth = Math.floor(rng() * THETAS.length);
    snaps = []; lastSplit = null; settledCell = null;
    snapshot();
    xMaxShown = 40; alpha = 1;
    if (reduced) runStill();
    else { phase = "step"; phaseT = 0; }
    updateText();
  }

  function flip() { space.update(rng() < THETAS[truth]); }
  function batchSize(n) { return n < 30 ? 1 : n < 80 ? 2 : n < 200 ? 5 : n < 600 ? 12 : n < 1500 ? 25 : 50; }

  // Advances one displayed step: a batch of flips, cut short by a refinement.
  function advance() {
    const b = batchSize(space.flips);
    let split = null;
    for (let i = 0; i < b && space.flips < MAX_FLIPS; i++) {
      flip();
      split = space.refine(threshold);
      if (split || space.settled()) break;
    }
    snapshot();
    lastSplit = split ? { at: snaps.length - 1, cells: split } : lastSplit;
    settledCell = space.settled();
    updateText();
    return split;
  }

  // Reduced motion: run to the end and show one still frame.
  function runStill() {
    while (!space.settled() && space.flips < MAX_FLIPS) advance();
    phase = "still"; alpha = 1;
    xMaxShown = niceMax(space.flips);
  }

  function niceMax(n) { const steps = [40, 80, 120, 200, 300, 500, 800, 1200, 1600, 2000, 3000]; for (const s of steps) if (n <= s) return s; return n; }

  function fmt(t) { return t.toFixed(2); }
  function updateText() {
    const lead = space.leader();
    const named = space.cells.length;
    const tot = space.total();
    const done = settledCell || space.flips >= MAX_FLIPS;
    controls.readout.textContent = `Flips ${space.flips} (${space.heads} heads). Named hypotheses ${named}${space.catchAll ? " plus other" : ""}. ` +
      `Leading: ${fmt(THETAS[lead.member])} at ${lead.mass.toFixed(3)}. Total probability ${tot.toFixed(9)}.` +
      (done ? ` True chance of heads: ${fmt(THETAS[truth])}.` : "");
    canvas.setAttribute("aria-label", `Partition of hypotheses about a coin's chance of heads after ${space.flips} flips. ` +
      space.order.map((c) => (c.kind === "catch" ? "other" : fmt(THETAS[c.member])) + " " + c.mass.toFixed(2)).join(", ") + ".");
    controls.threshold.setAttribute("aria-valuetext", threshold.toFixed(2));
  }

  // ---------- Drawing ----------

  let hatch = null, hatchKey = "";
  function hatchPattern(ctx, color, dpr) {
    const key = color + dpr;
    if (hatch && hatchKey === key) return hatch;
    const n = Math.round(7 * dpr), c = document.createElement("canvas");
    c.width = c.height = n;
    const x = c.getContext("2d");
    x.strokeStyle = color; x.lineWidth = 0.8 * dpr;
    x.beginPath(); x.moveTo(-1, n + 1); x.lineTo(n + 1, -1); x.moveTo(n - 1, n + 1); x.lineTo(n + 1, n - 1); x.moveTo(-1, 1); x.lineTo(1, -1); x.stroke();
    hatch = ctx.createPattern(c, "repeat");
    if (hatch && hatch.setTransform && typeof DOMMatrix !== "undefined") hatch.setTransform(new DOMMatrix().scale(1 / dpr));
    hatchKey = key;
    return hatch;
  }

  function layout() {
    const sans = W < 420 ? 10 : 11;
    const bandW = W < 420 ? 12 : 16, labelW = sans * 4.6;
    const x0 = sans * 3.2, xb = W - labelW - bandW - 4;
    return { x0, x1: xb - sans * 1.2, xb, bandW, y0: sans * 1.8, y1: Hh - sans * 3, sans };
  }

  // Masses for display: the last snapshot, or an eased blend of the last two during a step.
  function blendCells(u) {
    const cur = snaps[snaps.length - 1];
    if (snaps.length < 2 || u >= 1) return cur.cells.map((c) => ({ ...c }));
    const prev = snaps[snaps.length - 2], pm = new Map(prev.cells.map((c) => [c.id, c.mass]));
    return cur.cells.map((c) => ({ ...c, mass: (pm.has(c.id) ? pm.get(c.id) : 0) + (c.mass - (pm.has(c.id) ? pm.get(c.id) : 0)) * u }));
  }

  function draw(now) {
    if (!sizer || !snaps) return;
    const ctx = sizer.ctx, tk = tokens.get(), g = layout();
    sizer.clear();
    const font = `${g.sans}px "CMU Sans Serif", "Latin Modern Sans", system-ui, sans-serif`;
    const u = phase === "step" ? smootherstep(phaseT / STEP_MS) : 1;
    const nPrev = snaps.length >= 2 ? snaps[snaps.length - 2].n : 0, nCur = snaps[snaps.length - 1].n;
    const nHead = nPrev + (nCur - nPrev) * u;
    const X = (n) => g.x0 + (n / xMaxShown) * (g.x1 - g.x0);
    const Y = (p) => g.y1 - p * (g.y1 - g.y0);

    // Axes.
    ctx.save();
    ctx.strokeStyle = tk["--rule-strong"]; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x0, g.y1); ctx.lineTo(g.x1, g.y1); ctx.stroke();
    ctx.fillStyle = tk["--fg-2"]; ctx.font = font;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("0", g.x0 - 6, Y(0)); ctx.fillText("1", g.x0 - 6, Y(1));
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("0", X(0), g.y1 + 5); ctx.fillText(String(xMaxShown), X(xMaxShown), g.y1 + 5);
    ctx.fillText("flips", (g.x0 + g.x1) / 2, g.y1 + 5);
    ctx.save(); ctx.translate(g.x0 - g.sans * 2.2, (g.y0 + g.y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle"; ctx.fillText("probability", 0, 0); ctx.restore();
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("chance of heads", Math.min(g.xb, W - g.sans * 7.6), g.y0 - 4);
    ctx.restore();

    // History: cumulative boundaries over snapshots, with the head eased.
    const cols = snaps.map((s, j) => (j === snaps.length - 1 ? { n: nHead, cells: blendCells(u) } : s));
    const cum = (cells, upToId) => { let s = 0; for (const c of cells) { s += c.mass; if (c.id === upToId) return s; } return s; };
    // Catch-all region (hatched), while it exists.
    ctx.save();
    ctx.globalAlpha = 0.5 * alpha;
    ctx.fillStyle = hatchPattern(ctx, tk["--fg-2"], sizer.dpr);
    ctx.beginPath();
    let open = false, upper = [];
    const flush = () => {
      if (!open) return;
      for (let i = upper.length - 1; i >= 0; i--) ctx.lineTo(upper[i][0], upper[i][1]);
      ctx.closePath(); open = false; upper = [];
    };
    for (const col of cols) {
      const ca = col.cells.find((c) => c.kind === "catch");
      if (!ca) { flush(); continue; }
      const lo = 1 - ca.mass, x = X(col.n);
      if (!open) { ctx.moveTo(x, Y(lo)); open = true; } else ctx.lineTo(x, Y(lo));
      upper.push([x, Y(1)]);
    }
    flush();
    ctx.fill();
    ctx.restore();

    // Boundary lines: the upper edge of each named cell, from just before its birth.
    const ids = [];
    for (const c of cols[cols.length - 1].cells) if (c.kind === "named") ids.push(c.id);
    const leader = space.leader(), settledId = settledCell ? settledCell.id : -1;
    const sweepTo = phase === "sweep" ? smootherstep(phaseT / SWEEP) : (phase === "hold" || phase === "fade" || (phase === "still" && settledCell)) ? 1 : 0;
    ids.forEach((cid, j) => {
      const pts = [];
      let started = false;
      for (let s = 0; s < cols.length; s++) {
        const col = cols[s], has = col.cells.some((c) => c.id === cid);
        if (!has) continue;
        if (!started && s > 0) {
          // The new boundary branches off the boundary below it (it had zero mass there).
          const prev = cols[s - 1], idx = col.cells.findIndex((c) => c.id === cid);
          const below = idx > 0 ? cum(prev.cells, col.cells[idx - 1].id) : 0;
          pts.push(X(prev.n), Y(below));
        }
        started = true;
        pts.push(X(col.n), Y(cum(col.cells, cid)));
      }
      chalkStroke(ctx, pts, { color: tk["--chalk"], width: 1.05, jitter: 0.2, chunk: 8, dpr: sizer.dpr, alpha: 0.62 * alpha, salt: cid * 17 + 5 });
    });

    // Settled hypothesis: its region swept green, left to right.
    if (settledCell && sweepTo > 0) {
      const cid = settledId, lo = [], hi = [];
      const lastX = X(cols[0].n) + (X(nHead) - X(cols[0].n)) * sweepTo;
      for (let s = 0; s < cols.length; s++) {
        const col = cols[s], idx = col.cells.findIndex((c) => c.id === cid);
        if (idx < 0) continue;
        const x = X(col.n);
        if (x > lastX) break;
        const top = cum(col.cells, cid), bot = top - col.cells[idx].mass;
        lo.push([x, Y(bot)]); hi.push([x, Y(top)]);
      }
      if (lo.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.16 * alpha; ctx.fillStyle = tk["--green"];
        ctx.beginPath(); ctx.moveTo(lo[0][0], lo[0][1]);
        for (const p of lo) ctx.lineTo(p[0], p[1]);
        for (let i = hi.length - 1; i >= 0; i--) ctx.lineTo(hi[i][0], hi[i][1]);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.85 * alpha; ctx.strokeStyle = tk["--green"]; ctx.lineWidth = 1.4;
        for (const edge of [lo, hi]) { ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]); for (const p of edge) ctx.lineTo(p[0], p[1]); ctx.stroke(); }
        ctx.restore();
      }
    }

    // The current partition as a vertical band, with labels.
    const cells = cols[cols.length - 1].cells;
    let acc = 0;
    const labels = [];
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const c of cells) {
      const yTop = Y(acc + c.mass), yBot = Y(acc);
      const h = yBot - yTop;
      if (c.kind === "catch") {
        ctx.fillStyle = hatchPattern(ctx, tk["--fg-2"], sizer.dpr);
        ctx.fillRect(g.xb, yTop, g.bandW, h);
      } else {
        const isSettled = c.id === settledId && sweepTo >= 1;
        ctx.fillStyle = isSettled ? rgba(tk["--green"], 0.55) : rgba(tk["--chalk"], 0.06 + 0.5 * c.mass);
        ctx.fillRect(g.xb, yTop, g.bandW, h);
      }
      ctx.strokeStyle = tk["--bg"]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.xb, yTop); ctx.lineTo(g.xb + g.bandW, yTop); ctx.stroke();
      labels.push({ c, y: (yTop + yBot) / 2, h });
      acc += c.mass;
    }
    ctx.strokeStyle = tk["--rule-strong"]; ctx.lineWidth = 0.7;
    ctx.strokeRect(g.xb + 0.5, Y(1) + 0.5, g.bandW - 1, Y(0) - Y(1) - 1);
    // Labels: only where a cell is tall enough, and never overlapping.
    ctx.font = font; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    let lastY = Infinity;
    const minGap = g.sans * 1.25;
    labels.sort((a, b) => b.y - a.y);
    for (const l of labels) {
      if (l.h < g.sans * 0.9 && l.c.id !== leader.id) continue;
      if (lastY - l.y < minGap) continue;
      const settledNow = l.c.id === settledId && sweepTo >= 1;
      ctx.fillStyle = settledNow ? tk["--green"] : (l.c.kind === "named" && l.c.id === leader.id) ? tk["--red"] : tk["--fg-2"];
      ctx.fillText(l.c.kind === "catch" ? "other" : fmt(THETAS[l.c.member]), g.xb + g.bandW + 6, l.y);
      lastY = l.y;
    }
    ctx.restore();

    // The light: on the split point during a refinement, otherwise at the head of the leading cell's upper edge.
    if (phase === "step" || phase === "split") {
      let lx = X(nHead), ly;
      if (phase === "split" && lastSplit && lastSplit.at === snaps.length - 1) {
        const first = lastSplit.cells[0];
        const idx = cells.findIndex((c) => c.id === first.id);
        ly = Y(idx > 0 ? cum(cells, cells[idx - 1].id) : 0);
      } else {
        const lc = cells.find((c) => c.id === leader.id) || cells[0];
        ly = Y(cum(cells, lc.id));   // on the drawn upper edge of the leading cell
      }
      const I = phase === "split" ? 0.6 + 0.4 * Math.sin(Math.PI * clamp(phaseT / SPLIT_MS, 0, 1)) : 0.8;
      drawLight(ctx, lx, ly, tk["--red"], tk["--red-bright"], { intensity: I * alpha, scale: 0.75 });
    }
  }

  function frame(now, dt) {
    phaseT += dt;
    const target = niceMax(Math.max(40, space.flips));
    xMaxShown += (target - xMaxShown) * Math.min(1, dt / 400);
    if (Math.abs(target - xMaxShown) < 0.5) xMaxShown = target;
    if (phase === "step" && phaseT >= STEP_MS) {
      if (settledCell) { phase = "sweep"; phaseT = 0; }
      else if (space.flips >= MAX_FLIPS) { phase = "hold"; phaseT = 0; }
      else {
        const split = advance();
        phase = split ? "split" : "step"; phaseT = 0;
      }
    } else if (phase === "split" && phaseT >= SPLIT_MS) { phase = "step"; phaseT = STEP_MS; }
    else if (phase === "sweep" && phaseT >= SWEEP) { phase = "hold"; phaseT = 0; }
    else if (phase === "hold" && phaseT >= HOLD) { phase = "fade"; phaseT = 0; }
    else if (phase === "fade") {
      alpha = 1 - smootherstep(phaseT / FADE);
      if (phaseT >= FADE) newRun();
    }
    draw(now);
  }

  sizer = new CanvasSizer(canvas, (w, h) => {
    W = w; Hh = h;
    if (ready && (!loop || !loop.running)) draw(performance.now());
  }, { maxDpr: options.maxDpr || 2 });
  W = sizer.w; Hh = sizer.h;

  newRun();
  loop = new Loop(root, frame);
  function applyMotionPref() {
    if (reduced) { loop.stop(); if (phase !== "still") runStill(); updateText(); }
    else { if (phase === "still") { phase = "hold"; phaseT = 0; } loop.start(); }
    controls.pause.style.display = reduced ? "none" : "";
    draw(performance.now());
  }
  const unReduce = onReducedMotionChange((r) => { reduced = r || options.reducedMotion === true; applyMotionPref(); });
  ready = true;
  applyMotionPref();

  controls.restart.addEventListener("click", () => { newRun(); draw(performance.now()); });
  controls.threshold.addEventListener("input", () => {
    threshold = clamp(+controls.threshold.value, 0.3, 0.8);
    updateText();
    if (reduced) { newRun(); draw(performance.now()); }
  });
  controls.pause.addEventListener("click", () => {
    const p = controls.pause.getAttribute("aria-pressed") !== "true";
    controls.pause.setAttribute("aria-pressed", String(p));
    controls.pause.textContent = p ? "Play" : "Pause";
    if (p) loop.pause(); else loop.resume();
  });

  return {
    element: root,
    canvas,
    pause() { loop.pause(); },
    resume() { loop.resume(); },
    get running() { return loop.running; },
    state() {
      return {
        flips: space.flips, total: space.total(), truth: THETAS[truth], phase, reduced,
        cells: space.order.map((c) => ({ label: c.kind === "catch" ? "other" : fmt(THETAS[c.member]), mass: c.mass }))
      };
    },
    redraw() { draw(performance.now()); },
    destroy() { loop.destroy(); sizer.destroy(); tokens.destroy(); unReduce(); root.remove(); }
  };
}
