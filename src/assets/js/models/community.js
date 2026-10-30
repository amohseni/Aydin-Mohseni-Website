// Community: agents on a network learn which of two actions is better by trying them and
// sharing what they see (the network epistemology model of Bala and Goyal 1998, as used by
// Zollman 2007).
//
// Two actions, A and B. Each try of A succeeds with chance P_A = 0.5, each try of B with chance
// P_B = 0.55, so B is better by a small margin. The agents do not know these chances. Each agent
// holds a Beta distribution over each action's chance, with parameters drawn uniformly from
// (0, PRIOR_MAX]. Every round, each agent takes the action whose Beta mean is higher (its best
// guess), tries it TRIALS times, and counts successes. Then each agent updates both Betas by
// Bayes' rule on its own results and those of its neighbors (or of everyone, when evidence is
// shared with everyone). An action nobody takes produces no evidence, so if every agent comes
// to prefer A, nothing can correct their estimates of B: the community has locked in on the
// worse action.
//
// A run is settled when every agent has taken the same action for STABLE consecutive rounds.
//
// The numerical part (no DOM) is exported for tools/test-models-community.mjs.
//
// mount(container, options) builds the canvas, the controls and the "How it works" disclosure.

import {
  smootherstep, clamp, mulberry32, freshSeed, prefersReducedMotion, onReducedMotionChange,
  TokenWatcher, mixColor, parseColor, CanvasSizer, Loop, chalkStroke, ensureModelStyles
} from "./common.js";

// ---------- Model ----------

export const N_AGENTS = 12;
export const P_A = 0.5;          // chance of success of the worse action
export const P_B = 0.55;         // chance of success of the better action
export const TRIALS = 5;         // tries per agent per round
export const PRIOR_MAX = 4;      // Beta parameters start uniform in (0, PRIOR_MAX]
export const STABLE = 20;        // rounds of unanimous action that settle a run
export const MAX_ROUNDS = 5000;  // a run not settled by then counts as unsettled
export const SHORTCUTS = Math.round(N_AGENTS / 5);   // extra edges in the small world

export const NETWORKS = ["cycle", "small-world", "complete"];
export const NETWORK_LABELS = { "cycle": "Cycle", "small-world": "Small world", "complete": "Complete" };

// Adjacency lists for n agents placed around a circle. "cycle": each agent talks to the two
// next to it. "small-world": the cycle plus SHORTCUTS random chords between agents that are not
// within two steps of each other on the cycle (a Newman-Watts small world; the distance rule
// keeps a chord from passing through a node in the drawing). "complete": everyone talks to everyone.
export function makeNetwork(kind, n = N_AGENTS, rng = Math.random) {
  const adj = Array.from({ length: n }, () => new Set());
  const add = (a, b) => { if (a !== b) { adj[a].add(b); adj[b].add(a); } };
  if (kind === "complete") {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) add(i, j);
  } else {
    for (let i = 0; i < n; i++) add(i, (i + 1) % n);
    if (kind === "small-world") {
      let made = 0, guard = 0;
      while (made < SHORTCUTS && guard++ < 1000) {
        const a = Math.floor(rng() * n), b = Math.floor(rng() * n);
        const d = Math.min((a - b + n) % n, (b - a + n) % n);
        if (d > 2 && !adj[a].has(b)) { add(a, b); made++; }
      }
    }
  }
  return adj.map((s) => [...s].sort((x, y) => x - y));
}

export function edgeList(adj) {
  const out = [];
  adj.forEach((ns, i) => ns.forEach((j) => { if (j > i) out.push([i, j]); }));
  return out;
}

// Standard normal CDF (Abramowitz and Stegun 7.1.26 via erf; error below 1.5e-7).
function phi(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

// An agent's credence that B is better: the probability, under its two Betas, that B's chance
// exceeds A's, approximated by a normal distribution for the difference of the two chances.
export function credenceBBetter(aA, bA, aB, bB) {
  const mA = aA / (aA + bA), mB = aB / (aB + bB);
  const vA = (aA * bA) / ((aA + bA) * (aA + bA) * (aA + bA + 1));
  const vB = (aB * bB) / ((aB + bB) * (aB + bB) * (aB + bB + 1));
  const s = Math.sqrt(vA + vB);
  return s > 0 ? phi((mB - mA) / s) : (mB > mA ? 1 : mB < mA ? 0 : 0.5);
}

// The community. Beliefs are stored as Float64Arrays of Beta parameters, index [agent * 2 + action]
// with action 0 = A, 1 = B.
export class Community {
  constructor({ network = "cycle", share = "neighbors", n = N_AGENTS, rng = Math.random, adj = null } = {}) {
    this.n = n; this.rng = rng; this.network = network; this.share = share;
    this.adj = adj || makeNetwork(network, n, rng);
    this.alpha = new Float64Array(n * 2); this.beta = new Float64Array(n * 2);
    for (let k = 0; k < n * 2; k++) {
      this.alpha[k] = PRIOR_MAX * (1 - rng());   // (0, PRIOR_MAX]
      this.beta[k] = PRIOR_MAX * (1 - rng());
    }
    this.choice = new Uint8Array(n); this.succ = new Int32Array(n);
    this.round = 0; this.streak = 0; this.lastUnanimous = -1;
    this.outcome = null;   // null while running; "better", "worse", or "unsettled"
    this.settledAt = -1;   // first round of the final unanimous stretch
  }
  mean(i, a) { const k = i * 2 + a; return this.alpha[k] / (this.alpha[k] + this.beta[k]); }
  credence(i) { return credenceBBetter(this.alpha[i * 2], this.beta[i * 2], this.alpha[i * 2 + 1], this.beta[i * 2 + 1]); }
  preferred(i) {
    const mA = this.mean(i, 0), mB = this.mean(i, 1);
    return mB > mA ? 1 : mB < mA ? 0 : (this.rng() < 0.5 ? 1 : 0);
  }
  step() {
    const { n, rng } = this, p = [P_A, P_B];
    let takingB = 0;
    for (let i = 0; i < n; i++) {
      const a = this.preferred(i);
      this.choice[i] = a; takingB += a;
      let s = 0;
      for (let k = 0; k < TRIALS; k++) if (rng() < p[a]) s++;
      this.succ[i] = s;
    }
    // Everyone updates on the same round's results at once.
    for (let i = 0; i < n; i++) {
      const upd = (j) => { const k = i * 2 + this.choice[j]; this.alpha[k] += this.succ[j]; this.beta[k] += TRIALS - this.succ[j]; };
      if (this.share === "everyone") { for (let j = 0; j < n; j++) upd(j); }
      else { upd(i); for (const j of this.adj[i]) upd(j); }
    }
    this.round++;
    const u = takingB === n ? 1 : takingB === 0 ? 0 : -1;
    if (u >= 0 && u === this.lastUnanimous) this.streak++;
    else this.streak = u >= 0 ? 1 : 0;
    this.lastUnanimous = u;
    if (this.outcome === null) {
      if (this.streak >= STABLE) { this.outcome = u === 1 ? "better" : "worse"; this.settledAt = this.round - STABLE + 1; }
      else if (this.round >= MAX_ROUNDS) this.outcome = "unsettled";
    }
    return takingB;
  }
}

// Runs one community to settlement. Returns { outcome, rounds (to the start of the final
// unanimous stretch), trace (share taking B each round), cred (credences per round, if kept) }.
export function runTrial({ network = "cycle", share = "neighbors", rng = Math.random, keep = false, adj = null } = {}) {
  const c = new Community({ network, share, rng, adj });
  const trace = [], cred = [], choices = [];
  if (keep) { cred.push(Float64Array.from({ length: c.n }, (_, i) => c.credence(i))); choices.push(null); trace.push(NaN); }
  while (c.outcome === null) {
    const b = c.step();
    if (keep) {
      trace.push(b / c.n);
      cred.push(Float64Array.from({ length: c.n }, (_, i) => c.credence(i)));
      choices.push(Uint8Array.from(c.choice));
    }
  }
  return { outcome: c.outcome, rounds: c.settledAt, totalRounds: c.round, trace, cred, choices, adj: c.adj, community: c };
}

// ---------- Text ----------

const HOW_HTML = `
<p>${N_AGENTS} agents choose between two actions, A and B. Each try of A succeeds with chance ${P_A}; each try of B succeeds with chance ${P_B}, so B is better by a small margin. The agents do not know these chances. Each agent's belief about each action's chance is a Beta distribution, which starts with parameters drawn at random between 0 and ${PRIOR_MAX}. Every round, each agent takes the action it currently expects to succeed more often (its best guess), tries it ${TRIALS} times, and counts the successes. Then each agent updates its beliefs by Bayes' rule on its own results and on the results of the agents it is linked to, or of every agent when evidence is shared with everyone. The shade of a node is that agent's credence that B is better (the probability, under its beliefs, that B's chance exceeds A's, computed with a normal approximation). The shade runs from the page color, for credence 0, to the text color, for credence 1, as in the legend above the network. The lower panel traces the share of agents taking B each round.</p>
<p>An action that nobody takes produces no evidence. If every agent comes to prefer A, no new evidence about B arrives to correct their low estimates of it, and the community stays with the worse action (an agent goes back to B only if its estimate of A happens to fall below its old estimate of B); the nodes are then marked red. If every agent comes to prefer B, the evidence keeps confirming it, and the nodes sweep green. A run counts as settled when all agents have taken the same action for ${STABLE} rounds in a row.</p>
<p>This is the model of learning from neighbors of Bala and Goyal (1998), in the form Zollman (2007) used to ask how the pattern of communication among scientists affects what they come to believe. Zollman found that in this model communities in which each scientist hears from fewer others reach the better action more often than fully connected ones, but take longer to settle. In a complete network a few unlucky early results for the better action reach every agent at once and can turn the whole community away from it before anyone has tested it enough; in a cycle, the same results reach only a few agents, and the others keep testing. The parameter values here (${N_AGENTS} agents, chances ${P_A} and ${P_B}, ${TRIALS} tries per round, the prior range, the ${STABLE}-round settling rule, and ${SHORTCUTS} random shortcuts added to the cycle for the small world) are this page's choices. With them, in 500 simulated runs per network (<code>tools/test-models-community.mjs</code>, seed 2007), <span data-model-stat="results">the cycle reached the better action in 99.4 percent of runs, the small world in 99.6 percent, and the complete network in 84.8 percent; the cycle took 58 rounds on average to settle, the small world 48, and the complete network 6</span>. Sharing evidence with everyone makes every agent see every result, so it behaves like the complete network whatever the links.</p>
<p>A related model by Mohseni and Williams (2021) asks how conformity interacts with network structure. There, agents publicly state opinions, weighing accuracy against conformity with their peers, and learn by Bayesian conditionalization from private evidence and from the statements of others. The networks that best sustain a diversity of opinion, which turn out to be the less centralized and less connected ones, best support honest communication and reliable true belief.</p>
<p>Sources: V. Bala and S. Goyal (1998), &ldquo;Learning from Neighbours,&rdquo; <i>Review of Economic Studies</i> 65(3), 595-621, <a href="https://doi.org/10.1111/1467-937X.00059">doi:10.1111/1467-937X.00059</a>. K. J. S. Zollman (2007), &ldquo;The Communication Structure of Epistemic Communities,&rdquo; <i>Philosophy of Science</i> 74(5), 574-587, <a href="https://doi.org/10.1086/525605">doi:10.1086/525605</a>. A. Mohseni and C. R. Williams (2021), &ldquo;Truth and Conformity on Networks,&rdquo; <i>Erkenntnis</i> 86(6), 1509-1530, <a href="https://doi.org/10.1007/s10670-019-00167-6">doi:10.1007/s10670-019-00167-6</a>; interactive model at <a href="https://amohseni.shinyapps.io/Truth-and-Conformity-on-Networks/">amohseni.shinyapps.io</a>, code at <a href="https://github.com/amohseni/Truth-and-Conformity-on-Networks">github.com/amohseni</a>.</p>
`;

const ARIA_BASE = "Network of agents learning which of two actions is better. Each node is an agent, shaded by its credence that action B is better; lines show who shares evidence with whom. A panel below traces the share of agents taking B each round.";

// ---------- Mount ----------

export function mount(container, options = {}) {
  ensureModelStyles();
  const inFigure = !!(container.closest && container.closest("figure.model"));
  const root = document.createElement(inFigure ? "div" : "figure");
  root.className = inFigure ? "model-body model-body--community" : "model model--community";
  const id = "community-" + Math.random().toString(36).slice(2, 8);
  root.innerHTML = `
<canvas class="model-canvas" role="img" tabindex="0" aria-describedby="${id}-desc"></canvas>
<p id="${id}-desc" class="model-desc${options.visibleDescription ? "" : " visually-hidden"}">${options.description || `${N_AGENTS} agents try two actions, one slightly better than the other, and share their results with the agents they are linked to. Each node's shade is the agent's credence that B is better than A; B is in fact slightly better. When every agent settles on the better action the network sweeps green; when every agent settles on the worse one, it is marked red. Sparse networks settle on the better action more often but more slowly.`}</p>
<div class="model-controls">
  <span class="segmented" role="group" aria-label="Network">
    ${NETWORKS.map((k) => `<button type="button" data-net="${k}" aria-pressed="false">${NETWORK_LABELS[k]}</button>`).join("")}
  </span>
  <span class="segmented" role="group" aria-label="Evidence shared with">
    <button type="button" data-share="neighbors" aria-pressed="true">Neighbors</button><button type="button" data-share="everyone" aria-pressed="false">Everyone</button>
  </span>
  <button type="button" data-act="restart">Restart</button>
  <button type="button" data-act="pause" aria-pressed="false">Pause</button>
</div>
<p class="model-desc" aria-live="off"><output class="readout" data-act="readout"></output></p>
<p class="model-desc" aria-live="polite"><output class="readout" data-act="tally"></output></p>
<details class="model-how how"><summary>How it works</summary><div class="model-how-body">${HOW_HTML}</div></details>`;
  container.appendChild(root);
  const canvas = root.querySelector("canvas");
  canvas.style.maxHeight = "34rem";
  const controls = {};
  root.querySelectorAll("[data-act]").forEach((el) => { controls[el.dataset.act] = el; });
  const netButtons = [...root.querySelectorAll("[data-net]")];
  const shareButtons = [...root.querySelectorAll("[data-share]")];

  let reduced = prefersReducedMotion() || options.reducedMotion === true;
  let loop = null, sizer = null, ready = false;
  const tokens = new TokenWatcher(() => { if (ready && (!loop || !loop.running)) draw(); });
  const rng = mulberry32(options.seed != null ? options.seed >>> 0 : freshSeed());
  let network = NETWORKS.includes(options.network) ? options.network : "cycle";
  let share = options.share === "everyone" ? "everyone" : "neighbors";
  const tally = {};   // per "network/share": { runs, better }

  let run = null, edges = [], W = 1, Hh = 1;
  // Playback: tau runs from 0 to run.totalRounds through the precomputed rounds.
  // Phases: play, sweep (green or red marks), hold, fade.
  const SWEEP = 1100, HOLD = 2600, FADE = 800;
  let phase = "play", phaseT = 0, tau = 0, alpha = 1;
  const roundMs = (r) => 320 / (1 + r / 20) + 40;   // slower at first, then faster

  function setAspect() {
    const w = container.getBoundingClientRect().width || 600;
    canvas.style.aspectRatio = options.aspect || (w < 520 ? "1 / 1.08" : "16 / 11");
  }

  function restart() {
    run = runTrial({ network, share, rng, keep: true });
    edges = edgeList(run.adj);
    if (reduced) { phase = "still"; tau = run.totalRounds; alpha = 1; recordOutcome(); }
    else { phase = "play"; phaseT = 0; tau = 0; alpha = 1; }
    if (!reduced && controls.tally.dataset.key !== key()) controls.tally.textContent = tallyText();
    controls.tally.dataset.key = key();
    netButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.net === network)));
    shareButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.share === share)));
    updateText();
  }

  function key() { return network + "/" + share; }
  function recordOutcome() {
    const t = tally[key()] || (tally[key()] = { runs: 0, better: 0 });
    t.runs++; if (run.outcome === "better") t.better++;
    const o = run.outcome === "better" ? `Last run settled: from round ${run.rounds} on, every agent took the better action, B.`
      : run.outcome === "worse" ? `Last run locked in: from round ${run.rounds} on, every agent took the worse action, A.` : "Last run did not settle.";
    controls.tally.textContent = `${o} ${tallyText()}`;
  }
  function tallyText() {
    const t = tally[key()];
    if (!t) return "";
    return `${NETWORK_LABELS[network]} network, evidence shared with ${share === "everyone" ? "everyone" : "neighbors"}: ${t.better} of ${t.runs} ${t.runs === 1 ? "run" : "runs"} on this page reached the better action.`;
  }

  function currentRound() { return Math.min(run.totalRounds, Math.floor(tau)); }
  function updateText() {
    const r = currentRound();
    const nB = r > 0 ? Math.round(run.trace[r] * N_AGENTS) : null;
    controls.readout.textContent = r === 0 ? "Round 0: agents start with random beliefs." :
      `Round ${r}: ${nB} of ${N_AGENTS} agents take the better action, B.`;
    let desc = ARIA_BASE + ` ${NETWORK_LABELS[network]} network; evidence shared with ${share === "everyone" ? "everyone" : "neighbors"}. ` + controls.readout.textContent;
    if (phase !== "play" && run.outcome) desc += run.outcome === "better" ? " Every agent has settled on the better action." : run.outcome === "worse" ? " Every agent has settled on the worse action." : "";
    canvas.setAttribute("aria-label", desc);
  }

  // ---------- Drawing ----------

  function layout() {
    const sans = W < 420 ? 10 : 11;
    const chartH = Math.max(58, Math.round(Hh * 0.2));
    const netH = Hh - chartH - 14;
    const legendH = sans * 3.2;
    const cx = W / 2, cy = legendH * 0.6 + (netH - legendH * 0.6) / 2 + 4;
    const R = Math.max(30, Math.min(W * 0.5 - 30, (netH - legendH * 0.6) / 2 - 18));
    const nodeR = clamp(R * 0.075, 6, 13);
    return { sans, cx, cy, R, nodeR, chart: { x0: sans * 3.4, x1: W - 12, y0: Hh - chartH + 6, y1: Hh - sans * 2.6 } };
  }

  function nodePos(g, i) {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / N_AGENTS;
    return [g.cx + g.R * Math.cos(a), g.cy + g.R * Math.sin(a), a];
  }

  function draw() {
    if (!sizer || !run) return;
    const ctx = sizer.ctx, tk = tokens.get(), g = layout();
    sizer.clear();
    const font = `${g.sans}px "CMU Sans Serif", "Latin Modern Sans", system-ui, sans-serif`;
    const r = currentRound(), f = r < run.totalRounds ? smootherstep(tau - r) : 1;
    const cr = (i) => {
      const a = run.cred[r][i], b = run.cred[Math.min(run.totalRounds, r + 1)][i];
      return a + (b - a) * f;
    };
    // Outcome marks: sweep angle for green, alpha for red.
    const marking = phase === "sweep" || phase === "hold" || phase === "fade" || phase === "still";
    const mk = phase === "sweep" ? smootherstep(phaseT / SWEEP) : marking ? 1 : 0;
    const good = run.outcome === "better", bad = run.outcome === "worse";
    const swept = (ang) => good && marking && ((ang + Math.PI / 2) / (2 * Math.PI)) <= mk + 1e-9;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Edges in chalk. They brighten a little at the start of each round, when evidence moves.
    const pulse = phase === "play" ? 1 - smootherstep(Math.min(1, (tau - r) * 1.6)) : 0;
    const dense = edges.length > 2 * N_AGENTS;
    const baseA = (share === "everyone" ? 0.22 : dense ? 0.3 : 0.55) * (1 + 0.5 * pulse);
    edges.forEach(([i, j], e) => {
      const [x1, y1, a1] = nodePos(g, i), [x2, y2, a2] = nodePos(g, j);
      const green = swept(a1) && swept(a2);
      chalkStroke(ctx, [x1, y1, x2, y2], {
        color: green ? tk["--green"] : tk["--chalk"], width: green ? 1.3 : 1, jitter: 0.2, chunk: 1,
        dpr: sizer.dpr, alpha: green ? 0.7 : baseA, salt: e * 17 + 5, grain: !green
      });
    });
    // Nodes: fill tone from paper (credence 0) to ink (credence 1); outline marks the outcome.
    for (let i = 0; i < N_AGENTS; i++) {
      const [x, y, a] = nodePos(g, i);
      const c = clamp(cr(i), 0, 1);
      ctx.fillStyle = mixColor(tk["--bg"], tk["--fg"], 0.06 + 0.94 * c);
      ctx.beginPath(); ctx.arc(x, y, g.nodeR, 0, Math.PI * 2); ctx.fill();
      let stroke = tk["--rule-strong"], lw = 1;
      if (swept(a)) { stroke = tk["--green"]; lw = 2.2; }
      else if (bad && marking) { stroke = mixColor(tk["--rule-strong"], tk["--red"], mk); lw = 1 + 1.2 * mk; }
      ctx.strokeStyle = stroke; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(x, y, g.nodeR + lw / 2, 0, Math.PI * 2); ctx.stroke();
    }
    // Outcome label in the middle of the circle.
    if (marking && run.outcome !== "unsettled") {
      ctx.font = `${g.sans + 1}px "CMU Sans Serif", "Latin Modern Sans", system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const l1w = Math.max(ctx.measureText(good ? "consensus on" : "locked in on").width, ctx.measureText(good ? "the better action" : "the worse action").width);
      ctx.globalAlpha = alpha * mk * 0.88;
      ctx.fillStyle = tk["--bg"];
      ctx.fillRect(g.cx - l1w / 2 - 6, g.cy - g.sans * 1.6, l1w + 12, g.sans * 3.2);
      ctx.globalAlpha = alpha * mk;
      // On the dark ground --red falls near 3:1 contrast; --red-bright reads better there.
      const darkBg = (parseColor(tk["--bg"]) || [255, 255, 255]).slice(0, 3).reduce((a, v) => a + v, 0) < 384;
      ctx.fillStyle = good ? tk["--green"] : (darkBg && tk["--red-bright"] ? tk["--red-bright"] : tk["--red"]);
      const l1 = good ? "consensus on" : "locked in on", l2 = good ? "the better action" : "the worse action";
      ctx.fillText(l1, g.cx, g.cy - g.sans * 0.75); ctx.fillText(l2, g.cx, g.cy + g.sans * 0.75);
      ctx.globalAlpha = alpha;
    }
    ctx.restore();

    // Legend: a tone bar for credence that B is better.
    ctx.save();
    ctx.font = font; ctx.fillStyle = tk["--fg-2"]; ctx.textBaseline = "middle";
    const lx = 2, ly = g.sans * 0.9, lw = Math.min(110, W * 0.26), lh = 7;
    for (let s = 0; s < lw; s++) {
      ctx.fillStyle = mixColor(tk["--bg"], tk["--fg"], 0.06 + 0.94 * (s / (lw - 1)));
      ctx.fillRect(lx + s, ly, 1.2, lh);
    }
    ctx.strokeStyle = tk["--rule-strong"]; ctx.lineWidth = 0.7; ctx.strokeRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1);
    ctx.fillStyle = tk["--fg-2"]; ctx.textAlign = "left";
    ctx.fillText("0", lx, ly + lh + g.sans * 0.9);
    ctx.textAlign = "right"; ctx.fillText("1", lx + lw, ly + lh + g.sans * 0.9);
    ctx.textAlign = "left"; ctx.fillText("credence that B is better", lx + lw + 8, ly + lh / 2);
    ctx.textAlign = "right";
    ctx.fillText(`round ${r}`, W - 2, ly + lh / 2);
    ctx.restore();

    // Lower panel: share of agents taking B, round by round.
    const c = g.chart, shown = Math.max(1, Math.min(run.totalRounds, tau));
    const xmax = Math.max(30, Math.ceil(shown * 1.1));
    const X = (t) => c.x0 + (t / xmax) * (c.x1 - c.x0), Y = (v) => c.y1 - v * (c.y1 - c.y0);
    ctx.save();
    ctx.strokeStyle = tk["--rule"]; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(c.x0, Y(1)); ctx.lineTo(c.x1, Y(1)); ctx.stroke();
    ctx.strokeStyle = tk["--rule-strong"];
    ctx.beginPath(); ctx.moveTo(c.x0, c.y0); ctx.lineTo(c.x0, c.y1); ctx.lineTo(c.x1, c.y1); ctx.stroke();
    ctx.font = font; ctx.fillStyle = tk["--fg-2"];
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("all", c.x0 - 5, Y(1)); ctx.fillText("none", c.x0 - 5, Y(0));
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("share of agents taking B, by round", c.x0, c.y1 + 4);
    ctx.textAlign = "right"; ctx.fillText(String(xmax), c.x1, c.y1 + 4);
    ctx.restore();
    const pts = [];
    const last = Math.min(run.totalRounds, Math.floor(tau));
    for (let t = 1; t <= last; t++) pts.push(X(t), Y(run.trace[t]));
    if (last < run.totalRounds && last >= 1 && tau > 1) {
      const a = run.trace[last], b = run.trace[last + 1];
      pts.push(X(tau), Y(a + (b - a) * smootherstep(tau - last)));
    }
    const tcol = marking && good ? tk["--green"] : marking && bad ? tk["--red"] : tk["--chalk"];
    if (pts.length >= 4) chalkStroke(ctx, pts, { color: tcol, width: 1.2, jitter: 0.2, chunk: 8, dpr: sizer.dpr, alpha: (marking ? 0.85 : 0.6) * alpha, salt: 3, grain: !marking });
  }

  function frame(now, dt) {
    phaseT += dt;
    if (phase === "play") {
      tau += dt / roundMs(tau);
      if (tau >= run.totalRounds) { tau = run.totalRounds; phase = "sweep"; phaseT = 0; recordOutcome(); }
    } else if (phase === "sweep" && phaseT > SWEEP) { phase = "hold"; phaseT = 0; }
    else if (phase === "hold" && phaseT > HOLD) { phase = "fade"; phaseT = 0; }
    else if (phase === "fade") {
      alpha = 1 - smootherstep(phaseT / FADE);
      if (phaseT > FADE) restart();
    }
    updateText();
    draw();
  }

  setAspect();
  sizer = new CanvasSizer(canvas, (w, h) => {
    W = w; Hh = h;
    if (ready && (!loop || !loop.running)) draw();
  }, { maxDpr: options.maxDpr || 2 });
  W = sizer.w; Hh = sizer.h;
  const ro = new ResizeObserver(() => setAspect());
  ro.observe(container);

  restart();
  loop = new Loop(root, frame);
  function applyMotionPref() {
    if (reduced) {
      loop.stop();
      if (phase !== "still") { phase = "still"; tau = run.totalRounds; alpha = 1; }
    } else {
      if (phase === "still") { phase = "hold"; phaseT = 0; }
      loop.start();
    }
    controls.pause.style.display = reduced ? "none" : "";
    updateText(); draw();
  }
  const unReduce = onReducedMotionChange((m) => { reduced = m || options.reducedMotion === true; applyMotionPref(); });
  ready = true;
  applyMotionPref();

  // ---------- Controls ----------

  netButtons.forEach((b) => b.addEventListener("click", () => { network = b.dataset.net; restart(); draw(); }));
  shareButtons.forEach((b) => b.addEventListener("click", () => { share = b.dataset.share; restart(); draw(); }));
  controls.restart.addEventListener("click", () => { restart(); draw(); });
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
    state() { return { network, share, phase, tau, round: currentRound(), outcome: run.outcome, rounds: run.rounds, reduced, tally: JSON.parse(JSON.stringify(tally)) }; },
    redraw() { draw(); },
    destroy() { loop.destroy(); sizer.destroy(); tokens.destroy(); ro.disconnect(); unReduce(); root.remove(); }
  };
}
