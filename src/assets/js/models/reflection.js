// Reflection: van Fraassen's principle P(A | P_later(A) = x) = x, shown through forecasts.
//
// An agent is unsure whether a coin is biased toward heads (H: chance of heads 0.7) or toward
// tails (T: chance of heads 0.3). Its credence in H now is c. We simulate the futures the agent
// itself regards as possible: draw a hypothesis with the agent's current probabilities (H with
// probability c), then flip a coin with that hypothesis's chance, and record the credence the
// agent would hold after each flip.
//
// A Bayesian agent's credence is a martingale under its own forecast: the expected credence
// after the next flip equals the credence now, so the average over simulated futures stays at c
// while individual paths spread toward 0 and 1. The other agent ("expects to change its mind")
// takes the Bayesian posterior and then moves a fixed fraction DRIFT of the way toward 1. Its
// expected future credence is higher than its credence now, which violates Reflection.
//
// The numerical part (no DOM) is exported for tools/test-models-agency.mjs.
//
// mount(container, options) builds the canvas, the controls and the "How it works" disclosure.

import {
  smootherstep, clamp, mulberry32, freshSeed, prefersReducedMotion, onReducedMotionChange,
  TokenWatcher, rgba, CanvasSizer, Loop, chalkStroke, drawLight, ensureModelStyles
} from "./common.js";

// ---------- Model ----------

export const THETA_H = 0.7;    // chance of heads if the coin is biased toward heads
export const THETA_T = 0.3;    // chance of heads if the coin is biased toward tails
export const DRIFT = 0.05;     // the non-reflective agent moves this fraction of the way to 1 after each flip
export const FLIPS = 40;       // length of each simulated future
export const ENSEMBLE = 4000;  // simulated futures behind the average
export const SHOWN = 48;       // futures drawn as paths

// Bayes' rule for one flip (heads = true).
export function bayesUpdate(c, heads) {
  const lh = heads ? THETA_H : 1 - THETA_H, lt = heads ? THETA_T : 1 - THETA_T;
  const num = c * lh, den = num + (1 - c) * lt;
  return den > 0 ? num / den : c;
}

// The agent who expects to change its mind: Bayes, then a step toward 1.
export function driftUpdate(c, heads, k = DRIFT) {
  const b = bayesUpdate(c, heads);
  return b + k * (1 - b);
}

// The agent's own probability of heads on the next flip, given credence c in H.
export function predictiveHeads(c) { return c * THETA_H + (1 - c) * THETA_T; }

// Exact expected credence after one flip, under the agent's own forecast.
export function expectedNext(c, drift = false) {
  const up = drift ? driftUpdate : bayesUpdate, ph = predictiveHeads(c);
  return ph * up(c, true) + (1 - ph) * up(c, false);
}

// Simulates n futures of length T from credence c0. Hypotheses are assigned by a randomly
// offset stratified rule (path i gets H when floor((i+1)c0 + u) > floor(i c0 + u)), so the share
// of H paths is c0 up to one path and its expectation is exactly c0. Returns
// { paths: Float64Array(n * (T + 1)), isH: Uint8Array(n), mean: Float64Array(T + 1), sd: Float64Array(T + 1) }.
export function simulateFutures({ c0, T = FLIPS, n = ENSEMBLE, drift = false, rng = Math.random }) {
  const paths = new Float64Array(n * (T + 1)), isH = new Uint8Array(n);
  const mean = new Float64Array(T + 1), sq = new Float64Array(T + 1), sd = new Float64Array(T + 1);
  const up = drift ? driftUpdate : bayesUpdate, u = rng();
  for (let i = 0; i < n; i++) {
    const h = Math.floor((i + 1) * c0 + u) > Math.floor(i * c0 + u);
    isH[i] = h ? 1 : 0;
    const theta = h ? THETA_H : THETA_T;
    let c = c0;
    paths[i * (T + 1)] = c;
    for (let t = 1; t <= T; t++) {
      c = up(c, rng() < theta);
      paths[i * (T + 1) + t] = c;
    }
  }
  for (let t = 0; t <= T; t++) {
    let s = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const v = paths[i * (T + 1) + t]; s += v; s2 += v * v; }
    mean[t] = s / n; sq[t] = s2 / n;
    sd[t] = Math.sqrt(Math.max(0, sq[t] - mean[t] * mean[t]));
  }
  return { paths, isH, mean, sd, n, T };
}

// ---------- Text ----------

const HOW_HTML = `
<p>The agent is unsure whether a coin is biased toward heads (chance 0.7) or toward tails (chance 0.3); the slider sets its credence in heads-bias. Each gray path is a future the agent itself thinks possible: draw a hypothesis with its present probabilities, flip ${FLIPS} times, and track its posterior. The red line averages ${ENSEMBLE.toLocaleString("en-US")} such futures. A path turns green once it stays within 0.02 of 0 or 1.</p>
<p>Van Fraassen's (1984) Reflection principle says \\(P(A \\mid P_{\\text{later}}(A) = x) = x\\). It implies that present credence equals expected later credence. A Bayesian who forecasts with its own probabilities satisfies this exactly: its credences form a martingale, \\(\\mathbb{E}[P_{t+1}(A) \\mid P_t] = P_t(A)\\). The paths still spread toward 0 or 1, and the share ending near 1 approaches the present credence. The agent expects to become more certain, but not in any particular direction.</p>
<p>The agent who expects to change its mind moves ${Math.round(DRIFT * 100)} percent of the remaining way toward heads-bias after each Bayesian update. It foresees this, so its average forecast rises, Reflection fails, and it is open to a diachronic Dutch book.</p>
<p>Source: B. C. van Fraassen (1984), &ldquo;Belief and the Will,&rdquo; <i>The Journal of Philosophy</i> 81(5), <span data-verify="end page not in the Crossref record">235-256</span>, <a href="https://doi.org/10.2307/2026388">doi:10.2307/2026388</a>.</p>
`;

const ARIA_BASE = "Chart of simulated future credences. The horizontal axis counts coin flips from now; the vertical axis is credence that the coin is biased toward heads.";

// ---------- Mount ----------

export function mount(container, options = {}) {
  ensureModelStyles();
  const inFigure = !!(container.closest && container.closest("figure.model"));
  const root = document.createElement(inFigure ? "div" : "figure");
  root.className = inFigure ? "model-body model-body--reflection" : "model model--reflection";
  const id = "reflection-" + Math.random().toString(36).slice(2, 8);
  root.innerHTML = `
<canvas class="model-canvas" role="img" aria-describedby="${id}-desc"></canvas>
<p id="${id}-desc" class="model-desc${options.visibleDescription ? "" : " visually-hidden"}">${options.description || "Gray paths are possible futures of an agent's credence that a coin is biased toward heads, simulated from the agent's own present probabilities. For a Bayesian agent their average, in red, stays level at the present credence: it expects to become more certain, but not in a particular direction. Switch to the agent who expects to change its mind to see its average drift."}</p>
<div class="model-controls">
  <span class="model-actions"><button type="button" data-act="pause">Pause</button><button type="button" data-act="resample">New futures</button></span>
  <button type="button" data-act="drift" aria-pressed="false">Expects to change its mind</button>
  <label>Credence now <input type="range" data-act="c0" min="0.05" max="0.95" step="0.05" value="0.5" aria-valuetext="0.50"></label>
</div>
<p class="model-desc" aria-live="polite"><output class="readout" data-act="readout"></output></p>
<details class="model-how how"><summary>How it works</summary><div class="model-how-body">${HOW_HTML}</div></details>`;
  container.appendChild(root);
  const canvas = root.querySelector("canvas");
  canvas.style.aspectRatio = options.aspect || "16 / 10";
  canvas.style.maxHeight = "30rem";
  const controls = {};
  root.querySelectorAll("[data-act]").forEach((el) => { controls[el.dataset.act] = el; });

  // State
  let reduced = prefersReducedMotion() || options.reducedMotion === true;
  let loop = null, sizer = null, ready = false;
  const tokens = new TokenWatcher(() => { if (ready && (!loop || !loop.running)) draw(performance.now()); });
  const rng = mulberry32(options.seed != null ? options.seed >>> 0 : freshSeed());
  let c0 = clamp(+options.credence || 0.5, 0.05, 0.95);
  controls.c0.value = String(c0);
  let drift = options.drift === true;
  let sim = null, shownIdx = [];
  let W = 1, Hh = 1;
  // Phases of one cycle: grow (the futures unfold flip by flip), hold, sweep (green on settled
  // paths), hold, fade. tau is the flip clock (0..FLIPS).
  const FLIP_MS = 150, HOLD1 = 700, SWEEP = 900, HOLD2 = 2600, FADE = 700;
  let phase = "grow", phaseT = 0, tau = 0, alpha = 1;

  function resample() {
    sim = simulateFutures({ c0, drift, rng });
    shownIdx = [];
    const step = sim.n / SHOWN;
    for (let i = 0; i < SHOWN; i++) shownIdx.push(Math.floor((i + 0.5) * step));
    if (reduced) { phase = "still"; tau = FLIPS; alpha = 1; }
    else if (loop && !loop.running) heldStill();
    else { phase = "grow"; phaseT = 0; tau = 0; alpha = 1; }
    updateText();
  }

  // While paused (site-wide "Pause motion" or the model's own Pause), new futures are shown
  // grown and settled, as under reduced motion, and held: Play continues from that frame.
  function heldStill() { phase = "hold2"; phaseT = 0; tau = FLIPS; alpha = 1; }

  function updateText() {
    const end = sim.mean[FLIPS], se = sim.sd[FLIPS] / Math.sqrt(sim.n);
    controls.readout.textContent = `Credence now ${c0.toFixed(2)}. Average simulated credence after ${FLIPS} flips ${end.toFixed(3)} (Monte Carlo standard error ${se.toFixed(3)}).` +
      (drift ? " This agent expects its credence to rise, so it violates Reflection." : " The average stays at the present credence, as Reflection requires.");
    canvas.setAttribute("aria-label", ARIA_BASE + ` Present credence ${c0.toFixed(2)}. ` +
      (drift ? `Agent who expects to change its mind: the average of the paths rises to ${end.toFixed(2)}.` : `Bayesian agent: the paths spread toward 0 and 1 while their average stays at ${end.toFixed(2)}.`));
    controls.drift.setAttribute("aria-pressed", String(drift));
    controls.c0.setAttribute("aria-valuetext", c0.toFixed(2));
  }

  // ---------- Drawing ----------

  function layout() {
    const sans = W < 560 ? 12 : 13;   // canvas labels: 12px minimum, 13px from 560px
    const L = sans * 3.2, R = 14, Tp = 12, B = sans * 3;
    return { x0: L, x1: W - R, y0: Tp, y1: Hh - B, sans };
  }

  function draw(now) {
    if (!sizer || !sim) return;
    const ctx = sizer.ctx, tk = tokens.get(), g = layout();
    sizer.clear();
    const X = (t) => g.x0 + (t / FLIPS) * (g.x1 - g.x0);
    const Y = (c) => g.y1 - c * (g.y1 - g.y0);
    const font = `${g.sans}px "CMU Sans Serif", "Latin Modern Sans", system-ui, sans-serif`;

    // Axes and guides.
    ctx.save();
    ctx.strokeStyle = tk["--rule-strong"]; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.lineTo(g.x0, g.y1); ctx.lineTo(g.x1, g.y1); ctx.stroke();
    ctx.strokeStyle = tk["--rule"]; ctx.lineWidth = 0.7;
    for (const v of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.moveTo(g.x0, Y(v)); ctx.lineTo(g.x1, Y(v)); ctx.stroke(); }
    ctx.fillStyle = tk["--fg-2"]; ctx.font = font; ctx.globalAlpha = 1;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const v of [0, 0.5, 1]) ctx.fillText(v === 0.5 ? "0.5" : String(v), g.x0 - 6, Y(v));
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let t = 0; t <= FLIPS; t += 10) ctx.fillText(t === 0 ? "now" : String(t), X(t), g.y1 + 5);
    ctx.fillText("flips from now", (g.x0 + g.x1) / 2, g.y1 + 5 + g.sans * 1.35);
    ctx.save();
    ctx.translate(g.x0 - g.sans * 2.4, (g.y0 + g.y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle"; ctx.fillText("credence in heads bias", 0, 0);
    ctx.restore();
    // Present credence: dashed guide across the chart.
    ctx.strokeStyle = tk["--fg-2"]; ctx.globalAlpha = 0.55; ctx.setLineDash([3, 4]); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(g.x0, Y(c0)); ctx.lineTo(g.x1, Y(c0)); ctx.stroke();
    ctx.restore();

    // How far each path is drawn.
    const k = Math.floor(tau), f = smootherstep(tau - k);
    const T1 = sim.T + 1;
    const greenUpTo = phase === "sweep" ? smootherstep(phaseT / SWEEP) * FLIPS
      : (phase === "hold2" || phase === "fade" || phase === "still") ? FLIPS + 1 : -1;
    // A path has settled from the first flip after which it stays within 0.02 of the end it finishes at.
    const settledAt = (i) => {
      const end = sim.paths[i * T1 + FLIPS];
      const near = end > 0.98 ? (v) => v > 0.98 : end < 0.02 ? (v) => v < 0.02 : null;
      if (!near) return -1;
      let t = FLIPS;
      while (t > 0 && near(sim.paths[i * T1 + t - 1])) t--;
      return t;
    };
    const pathPts = (i, upTo) => {
      const pts = [];
      for (let t = 0; t <= Math.min(k, FLIPS); t++) pts.push(X(t), Y(sim.paths[i * T1 + t]));
      if (k < FLIPS && upTo > k) {
        const a = sim.paths[i * T1 + k], b = sim.paths[i * T1 + k + 1];
        pts.push(X(k + f), Y(a + (b - a) * f));
      }
      return pts;
    };

    // Gray paths in chalk.
    shownIdx.forEach((i, j) => {
      chalkStroke(ctx, pathPts(i, tau), {
        color: tk["--chalk"], width: 1, jitter: 0.22, chunk: 6, dpr: sizer.dpr, alpha: 0.3 * alpha, salt: j * 13 + 1
      });
    });
    // Green: settled parts of paths, swept in from the left.
    if (greenUpTo >= 0) {
      shownIdx.forEach((i, j) => {
        const s = settledAt(i);
        if (s < 0 || s > greenUpTo) return;
        const pts = [];
        const end = Math.min(FLIPS, Math.floor(greenUpTo));
        for (let t = s; t <= end; t++) pts.push(X(t), Y(sim.paths[i * T1 + t]));
        if (pts.length >= 4) chalkStroke(ctx, pts, {
          color: tk["--green"], width: 1.25, jitter: 0.15, chunk: 6, dpr: sizer.dpr, alpha: 0.75 * alpha, salt: j * 7 + 3, grain: false
        });
      });
    }

    // The average over the whole ensemble, in red, with the light at its head.
    const mpts = [];
    for (let t = 0; t <= Math.min(k, FLIPS); t++) mpts.push(X(t), Y(sim.mean[t]));
    let hx = X(Math.min(k, FLIPS)), hy = Y(sim.mean[Math.min(k, FLIPS)]);
    if (k < FLIPS) {
      const a = sim.mean[k], b = sim.mean[k + 1];
      hx = X(k + f); hy = Y(a + (b - a) * f); mpts.push(hx, hy);
    }
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = tk["--red"]; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(mpts[0], mpts[1]);
    for (let i = 2; i < mpts.length; i += 2) ctx.lineTo(mpts[i], mpts[i + 1]);
    ctx.stroke();
    // Present credence marker.
    ctx.fillStyle = tk["--red"];
    ctx.beginPath(); ctx.arc(X(0), Y(c0), 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (phase === "grow" || phase === "hold1") {
      drawLight(ctx, hx, hy, tk["--red"], tk["--red-bright"], { intensity: alpha * (phase === "grow" ? 1 : 0.7), scale: 0.8 });
    }
    // Label for the average.
    ctx.save();
    ctx.globalAlpha = alpha; ctx.font = font; ctx.fillStyle = tk["--red"];
    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    const ly = Y(sim.mean[Math.min(k, FLIPS)]);
    if (tau > 8) ctx.fillText("average", Math.min(hx, g.x1) - 4, ly - 6);
    ctx.restore();
  }

  function frame(now, dt) {
    phaseT += dt;
    if (phase === "grow") {
      tau += dt / FLIP_MS;
      if (tau >= FLIPS) { tau = FLIPS; phase = "hold1"; phaseT = 0; }
    } else if (phase === "hold1" && phaseT > HOLD1) { phase = "sweep"; phaseT = 0; }
    else if (phase === "sweep" && phaseT > SWEEP) { phase = "hold2"; phaseT = 0; }
    else if (phase === "hold2" && phaseT > HOLD2) { phase = "fade"; phaseT = 0; }
    else if (phase === "fade") {
      alpha = 1 - smootherstep(phaseT / FADE);
      if (phaseT > FADE) resample();
    }
    draw(now);
  }

  sizer = new CanvasSizer(canvas, (w, h) => {
    W = w; Hh = h;
    if (ready && (!loop || !loop.running)) draw(performance.now());
  }, { maxDpr: options.maxDpr || 2 });
  W = sizer.w; Hh = sizer.h;

  resample();
  loop = new Loop(root, frame);
  function applyMotionPref() {
    if (reduced) { loop.stop(); phase = "still"; tau = FLIPS; alpha = 1; }
    else {
      if (phase === "still") { phase = "hold2"; phaseT = 0; }
      loop.start();
      // Mounted while motion is paused: show the grown fan, not an empty first frame.
      if (!loop.running && phase === "grow" && tau === 0) heldStill();
    }
    controls.pause.style.display = reduced ? "none" : "";
    draw(performance.now());
  }
  const unReduce = onReducedMotionChange((r) => { reduced = r || options.reducedMotion === true; applyMotionPref(); });
  ready = true;
  applyMotionPref();

  // ---------- Controls ----------

  controls.c0.addEventListener("input", () => { c0 = clamp(+controls.c0.value, 0.05, 0.95); resample(); draw(performance.now()); });
  controls.drift.addEventListener("click", () => { drift = !drift; resample(); draw(performance.now()); });
  controls.resample.addEventListener("click", () => { resample(); draw(performance.now()); });
  controls.pause.addEventListener("click", () => {
    // A plain action button whose label changes (no aria-pressed: the red pressed style
    // marks a selected mode, not a stopped animation).
    const p = controls.pause.dataset.paused !== "true";
    controls.pause.dataset.paused = String(p);
    controls.pause.textContent = p ? "Play" : "Pause";
    if (p) loop.pause(); else loop.resume();
  });

  return {
    element: root,
    canvas,
    pause() { loop.pause(); },
    resume() { loop.resume(); },
    get running() { return loop.running; },
    state() { return { c0, drift, phase, tau, meanEnd: sim.mean[FLIPS], meanStart: sim.mean[0], reduced }; },
    redraw() { draw(performance.now()); },
    destroy() { loop.destroy(); sizer.destroy(); tokens.destroy(); unReduce(); root.remove(); }
  };
}
