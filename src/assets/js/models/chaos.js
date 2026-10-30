// Chaos on the simplex: the replicator dynamics for a four-strategy game whose orbits trace a
// strange attractor inside the tetrahedron of population states.
//
//   x_i' = x_i ((Ax)_i - x.Ax),   A = [[0,-12,0,22],[20,0,0,-10],[-21,-4,0,35],[10,-2,2,0]]
//
// The matrix is the Arneodo-Coullet-Tresser (1980) game as given by Sandholm. The barycenter
// (1/4, 1/4, 1/4, 1/4) is the only interior equilibrium and is unstable. Orbits that start
// within START_RADIUS of it spiral out onto the attractor and stay interior; orbits that start
// far away can run to the boundary. Numerical checks (Node, this module's own rk4Step):
// largest Lyapunov exponent about 0.16 (RK4, h = 0.002); 20 random starts within 0.03 of the
// barycenter, 10^6 steps each, none came closer to the boundary than 5.3e-5; 100 starts within
// 0.08, 3 x 10^5 steps each, none collapsed; collapses begin near radius 0.1.
//
// mount(container, { mode: "hero" | "background", ... }) builds the canvas, and in hero mode
// the controls and the "How it works" disclosure.

import {
  smootherstep, clamp, mulberry32, freshSeed, prefersReducedMotion, onReducedMotionChange,
  TokenWatcher, parseColor, rgba, CanvasSizer, Loop, chalkStroke, drawLight, ensureModelStyles
} from "./common.js";

// ---------- Dynamics ----------

export const A = [[0, -12, 0, 22], [20, 0, 0, -10], [-21, -4, 0, 35], [10, -2, 2, 0]];
export const H = 0.002;              // RK4 step (time units)
export const START_RADIUS = 0.03;    // Euclidean radius of the start ball around the barycenter
export const SAMPLE_EVERY = 10;      // keep one trace point every 10 steps (0.02 time units)
export const BOUNDARY_GUARD = 1e-7;  // restart if any share falls below this (never seen in tests)

export function rhs(x, out) {
  let m = 0;
  const ax0 = A[0][0] * x[0] + A[0][1] * x[1] + A[0][2] * x[2] + A[0][3] * x[3];
  const ax1 = A[1][0] * x[0] + A[1][1] * x[1] + A[1][2] * x[2] + A[1][3] * x[3];
  const ax2 = A[2][0] * x[0] + A[2][1] * x[1] + A[2][2] * x[2] + A[2][3] * x[3];
  const ax3 = A[3][0] * x[0] + A[3][1] * x[1] + A[3][2] * x[2] + A[3][3] * x[3];
  m = x[0] * ax0 + x[1] * ax1 + x[2] * ax2 + x[3] * ax3;
  out[0] = x[0] * (ax0 - m); out[1] = x[1] * (ax1 - m);
  out[2] = x[2] * (ax2 - m); out[3] = x[3] * (ax3 - m);
  return out;
}

const k1 = new Float64Array(4), k2 = new Float64Array(4), k3 = new Float64Array(4), k4 = new Float64Array(4), tmp = new Float64Array(4);

// One classical fourth-order Runge-Kutta step, in place. The exact flow keeps sum(x) = 1;
// the step renormalizes to remove round-off drift.
export function rk4Step(x, h = H) {
  rhs(x, k1);
  for (let i = 0; i < 4; i++) tmp[i] = x[i] + 0.5 * h * k1[i];
  rhs(tmp, k2);
  for (let i = 0; i < 4; i++) tmp[i] = x[i] + 0.5 * h * k2[i];
  rhs(tmp, k3);
  for (let i = 0; i < 4; i++) tmp[i] = x[i] + h * k3[i];
  rhs(tmp, k4);
  let s = 0;
  for (let i = 0; i < 4; i++) { x[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); s += x[i]; }
  for (let i = 0; i < 4; i++) x[i] /= s;
  return x;
}

// A start point drawn uniformly from the ball of radius r (in the plane sum = 0) around
// the barycenter.
export function randomStart(rng, r = START_RADIUS) {
  let v, n;
  do {
    v = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1];
    const m = (v[0] + v[1] + v[2] + v[3]) / 4;
    v = v.map((c) => c - m);
    n = Math.hypot(v[0], v[1], v[2], v[3]);
  } while (n === 0 || n > 1);
  const rad = r * Math.cbrt(rng());
  return Float64Array.from(v, (c) => 0.25 + (c / n) * rad);
}

function minShare(x) { return Math.min(x[0], x[1], x[2], x[3]); }

// ---------- Geometry ----------

// Regular tetrahedron with circumradius 1, centered at the origin, strategy 1 at the top.
const R2 = (2 * Math.SQRT2) / 3;
const VERTS = [
  [0, 1, 0],
  [R2 * Math.cos(Math.PI / 2), -1 / 3, R2 * Math.sin(Math.PI / 2)],
  [R2 * Math.cos(Math.PI / 2 + (2 * Math.PI) / 3), -1 / 3, R2 * Math.sin(Math.PI / 2 + (2 * Math.PI) / 3)],
  [R2 * Math.cos(Math.PI / 2 + (4 * Math.PI) / 3), -1 / 3, R2 * Math.sin(Math.PI / 2 + (4 * Math.PI) / 3)]
];
const EDGES = [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]];

function to3(x, out, o) {
  out[o] = x[0] * VERTS[0][0] + x[1] * VERTS[1][0] + x[2] * VERTS[2][0] + x[3] * VERTS[3][0];
  out[o + 1] = x[0] * VERTS[0][1] + x[1] * VERTS[1][1] + x[2] * VERTS[2][1] + x[3] * VERTS[3][1];
  out[o + 2] = x[0] * VERTS[0][2] + x[1] * VERTS[1][2] + x[2] * VERTS[2][2] + x[3] * VERTS[3][2];
}

const CAMERA = 4.5;   // distance of the eye from the center, in circumradii (mild perspective)

// ---------- Trajectory state ----------

class Trajectory {
  constructor(cap) {
    this.cap = cap;
    this.buf = new Float32Array(cap * 3);
    this.reset(new Float64Array([0.25, 0.25, 0.25, 0.25]));
  }
  reset(x0) {
    this.x = Float64Array.from(x0);
    this.steps = 0;          // RK4 steps taken
    this.count = 0;          // trace points stored (absolute, grows without bound)
    this.push();
  }
  push() {
    to3(this.x, this.buf, (this.count % this.cap) * 3);
    this.count++;
  }
  get first() { return Math.max(0, this.count - this.cap); }
  // Advance by n steps; returns false if the orbit came too close to the boundary.
  advance(n) {
    for (let i = 0; i < n; i++) {
      rk4Step(this.x);
      this.steps++;
      if (this.steps % SAMPLE_EVERY === 0) this.push();
    }
    const m = minShare(this.x);
    return m > BOUNDARY_GUARD && m === m;
  }
}

// ---------- Text ----------

const MATRIX_HTML = A.map((row) => "<tr>" + row.map((v) => `<td>${v < 0 ? "−" + -v : v}</td>`).join("") + "</tr>").join("");

const HOW_HTML = `
<p>Four strategies compete in a large population. The state of the population is the share using each strategy, x = (x<sub>1</sub>, x<sub>2</sub>, x<sub>3</sub>, x<sub>4</sub>), which is a point in a tetrahedron (the 3-simplex). Each corner is a population in which everyone uses one strategy; the center is the population in which each strategy has a quarter of the users.</p>
<p>Under the replicator dynamics, a strategy's share grows in proportion to how much better it does than the population average: x&#775;<sub>i</sub> = x<sub>i</sub>((Ax)<sub>i</sub> &minus; x&middot;Ax). Here the payoff matrix A is</p>
<table aria-label="Payoff matrix A, rows are the strategy's own payoff against each column strategy"><tbody>${MATRIX_HTML}</tbody></table>
<p>The only equilibrium inside the tetrahedron is the center, (1/4, 1/4, 1/4, 1/4), and it is unstable. A population that starts near it spirals outward and settles onto a strange attractor: the folded set that the trace fills in. Two populations that start almost together separate at an average exponential rate of about 0.16 per unit of time (the largest Lyapunov exponent, which we estimated numerically), so the long-run path cannot be predicted from an approximate starting point. Starts far from the center can instead run to the boundary, where some strategies die out, so each new start here is drawn close to the center.</p>
<p><strong>Why four strategies.</strong> With n strategies the state space has n &minus; 1 dimensions. With three strategies it is a triangle, a region of the plane, and the Poincar&eacute;-Bendixson theorem says that a bounded orbit in the plane can only approach an equilibrium, a closed cycle, or a set of equilibria joined by orbits. Chaos needs at least three dimensions, so four is the smallest number of strategies for which the replicator dynamics can be chaotic.</p>
<p>The replicator dynamics with four strategies is equivalent to a Lotka-Volterra system with three species (Hofbauer 1981), so the strange attractor that Arneodo, Coullet and Tresser (1980) found in a three-species Lotka-Volterra system appears in a four-strategy game. Skyrms (1992), citing Zeeman's analysis of three-strategy games, noted that chaos does not occur with three strategies, and gave numerical evidence that it does occur with four. <span data-verify="matrix confirmed from Sandholm's Dynamo gallery and his 2007 survey; the section number comes from the 2009 draft table of contents; the printed book was not checked">Sandholm presents this game as an example of chaotic evolutionary dynamics (2010, section 9.3).</span></p>
<p>The orbit is computed in your browser with the fourth-order Runge-Kutta method, step 0.002.</p>
<p class="model-sources"><strong>Sources.</strong><br>
A. Arneodo, P. Coullet and C. Tresser (1980), &ldquo;Occurence of strange attractors in three-dimensional Volterra equations,&rdquo; <i>Physics Letters A</i> 79(4), 259-263, <a href="https://doi.org/10.1016/0375-9601(80)90342-4">doi:10.1016/0375-9601(80)90342-4</a>.<br>
J. Hofbauer (1981), &ldquo;On the occurrence of limit cycles in the Volterra-Lotka equation,&rdquo; <i>Nonlinear Analysis: Theory, Methods &amp; Applications</i> 5(9), 1003-1007, <a href="https://doi.org/10.1016/0362-546X(81)90059-6">doi:10.1016/0362-546X(81)90059-6</a>.<br>
B. Skyrms (1992), &ldquo;Chaos in game dynamics,&rdquo; <i>Journal of Logic, Language and Information</i> 1(2), 111-130, <a href="https://doi.org/10.1007/BF00171693">doi:10.1007/BF00171693</a>.<br>
W. H. Sandholm (2010), <i>Population Games and Evolutionary Dynamics</i>, MIT Press.</p>
`;

const ARIA = "Animated orbit of the replicator dynamics for a four-strategy game, drawn inside a slowly rotating tetrahedron whose corners are the four strategies. Starting near the center, the orbit spirals outward and traces a strange attractor.";

// ---------- Mount ----------

export function mount(container, options = {}) {
  const mode = options.mode === "background" ? "background" : "hero";
  const isBg = mode === "background";
  ensureModelStyles();

  const cfg = {
    speed: options.speed || (isBg ? 0.7 : 1.2),         // time units per second
    cap: options.cap || (isBg ? 7000 : 9000),            // trace points kept (0.02 time units each)
    yawRate: (2 * Math.PI) / (isBg ? 140 : 75),          // radians per second of slow rotation
    pitch: 0.36,
    scrimSelector: options.scrimSelector || "[data-scrim], main",
    scrimInside: 0.35,                                   // trace opacity multiplier under the text column
    fps: isBg ? 30 : 0,
    storageKey: options.storageKey || (isBg ? "chaos-background-v1" : null)
  };

  // DOM
  let root, canvas, controls = {}, desc;
  if (isBg) {
    canvas = document.createElement("canvas");
    canvas.className = "chaos-background";
    canvas.setAttribute("aria-hidden", "true");
    // Inside the layout's fixed .model-background layer, fill it; directly in <body>, be fixed.
    const inLayer = container !== document.body;
    Object.assign(canvas.style, inLayer
      ? { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", display: "block" }
      : { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "0", pointerEvents: "none", display: "block" });
    container.insertBefore(canvas, container.firstChild);
    root = canvas;
  } else {
    // site.js mounts models into .model-mount inside <figure class="model">; then build a plain
    // block. Mounted anywhere else, build the figure too.
    const inFigure = !!(container.closest && container.closest("figure.model"));
    root = document.createElement(inFigure ? "div" : "figure");
    root.className = inFigure ? "model-body model-body--chaos" : "model model--chaos";
    const id = "chaos-" + Math.random().toString(36).slice(2, 8);
    root.innerHTML = `
<canvas class="model-canvas" role="img" tabindex="0" aria-label="${ARIA}" aria-describedby="${id}-desc"></canvas>
<p id="${id}-desc" class="model-desc${options.visibleDescription ? "" : " visually-hidden"}">${options.description || "The replicator dynamics for four strategies has no stable resting point inside the tetrahedron of population states. Its orbits fold into a strange attractor, so small differences in where a population starts grow until its path cannot be predicted. Drag the figure, or use the arrow keys, to rotate it."}</p>
<div class="model-controls">
  <span class="model-actions"><button type="button" data-act="pause">Pause</button><button type="button" data-act="restart">New start</button></span>
  <label>Speed <input type="range" data-act="speed" min="-2" max="2" step="0.1" value="0" aria-valuetext="1 times"></label>
  <span class="model-hint" aria-hidden="true">Drag to rotate</span>
</div>
<details class="model-how"><summary>How it works</summary><div class="model-how-body">${HOW_HTML}</div></details>`;
    container.appendChild(root);
    canvas = root.querySelector("canvas");
    canvas.style.aspectRatio = "10 / 9";
    canvas.style.maxHeight = "34rem";
    canvas.style.cursor = "grab";
    desc = root.querySelector(".model-desc");
    root.querySelectorAll("[data-act]").forEach((el) => { controls[el.dataset.act] = el; });
  }

  // State
  let reduced = prefersReducedMotion() || options.reducedMotion === true;
  let loop = null, sizer = null, ready = false;
  const tokens = new TokenWatcher(() => { if (ready && (!loop || !loop.running)) draw(performance.now()); });
  const rng = mulberry32(options.seed != null ? options.seed >>> 0 : freshSeed());
  const traj = new Trajectory(cfg.cap);
  let ghost = null;          // previous trajectory, fading out after a restart
  let yaw = 0.6, pitch = cfg.pitch, yawVel = 0, dragging = false;
  let speedMul = 1, W = 1, Hh = 1, scrim = null;
  let screen = new Float32Array((cfg.cap + 1) * 2), depth = new Float32Array(cfg.cap + 1);
  let stepCarry = 0, appear = 0;
  const stats = { frames: 0, work: 0, maxWork: 0 };

  function newStart() { return randomStart(rng); }

  function restart(fade = true) {
    if (fade && traj.count > 2) {
      const g = new Trajectory(traj.cap);
      g.buf.set(traj.buf); g.count = traj.count; g.x = Float64Array.from(traj.x);
      ghost = { traj: g, t0: performance.now() };
    } else ghost = null;
    traj.reset(newStart());
    appear = 0;
    // Reduced motion, or paused (site-wide "Pause motion" or the model's own Pause): show the
    // new orbit's settled attractor at once, as a still frame; Play continues from it.
    if (reduced || (loop && !loop.running)) { settleStill(); draw(performance.now()); }
  }

  // Reduced motion: one still frame, the attractor after the spiral has settled. The orbit
  // leaves the center's neighborhood after about 16 time units, so run for the length of the
  // kept trace plus 30 time units: the still then shows only the attractor.
  function settleStill() {
    ghost = null;
    traj.advance(traj.cap * SAMPLE_EVERY + Math.round(30 / H));
    appear = 1;
  }

  // Background continuity across pages (same tab): restore the orbit and trace saved on the
  // previous page. Storage can be unavailable; then each page starts its own orbit.
  function save() {
    if (!cfg.storageKey || reduced) return;
    try {
      const n = Math.min(traj.count, traj.cap), out = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const j = ((traj.first + i) % traj.cap) * 3;
        out[i * 3] = traj.buf[j]; out[i * 3 + 1] = traj.buf[j + 1]; out[i * 3 + 2] = traj.buf[j + 2];
      }
      const bytes = new Uint8Array(out.buffer);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      sessionStorage.setItem(cfg.storageKey, JSON.stringify({
        x: Array.from(traj.x), steps: traj.steps, count: traj.count, yaw, wall: Date.now(), trace: btoa(bin)
      }));
    } catch (e) { /* storage unavailable or full */ }
  }
  function restore() {
    if (!cfg.storageKey) return false;
    try {
      const s = JSON.parse(sessionStorage.getItem(cfg.storageKey) || "null");
      if (!s || Date.now() - s.wall > 30 * 60 * 1000 || !Array.isArray(s.x) || s.x.length !== 4) return false;
      const bin = atob(s.trace), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const pts = new Float32Array(bytes.buffer), n = Math.min(pts.length / 3, traj.cap);
      traj.x = Float64Array.from(s.x);
      if (!(minShare(traj.x) > BOUNDARY_GUARD)) return false;
      traj.steps = s.steps; traj.count = s.count;
      const first = traj.count - n;
      for (let i = 0; i < n; i++) {
        const j = ((first + i) % traj.cap) * 3;
        traj.buf[j] = pts[(pts.length / 3 - n + i) * 3]; traj.buf[j + 1] = pts[(pts.length / 3 - n + i) * 3 + 1]; traj.buf[j + 2] = pts[(pts.length / 3 - n + i) * 3 + 2];
      }
      yaw = +s.yaw || yaw; appear = 1;
      return true;
    } catch (e) { return false; }
  }

  // Projection of the trace into screen space for the current rotation.
  // Scale and center of the figure. The tetrahedron's circumcenter is not the middle of its
  // outline (the top vertex is at height 1, the base at -1/3), so the center is moved down to
  // the middle of the outline's vertical range at the current pitch (lowest possible base
  // vertex over all yaw). With these factors the vertices and their labels stay inside the
  // canvas for every yaw and every pitch the controls allow (checked numerically).
  function frameGeom() {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const s = isBg ? Math.min(W, Hh) * 0.47 : Math.min(W * 0.4, Hh * 0.48);
    const top = cp, bottom = -cp / 3 - Math.abs(sp) * R2;
    return { s, cx: W / 2, cy: Hh / 2 + s * (top + bottom) / 2 };
  }

  function project(t, out, dep) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const G = frameGeom(), s = G.s, cx = G.cx, cyy = G.cy;
    const n = Math.min(t.count, t.cap), first = t.count - n;
    for (let i = 0; i < n; i++) {
      const j = ((first + i) % t.cap) * 3;
      pt(t.buf[j], t.buf[j + 1], t.buf[j + 2]);
      out[i * 2] = P[0]; out[i * 2 + 1] = P[1]; dep[i] = P[2];
    }
    // The live head of the orbit (between samples).
    to3(t.x, Q, 0); pt(Q[0], Q[1], Q[2]);
    out[n * 2] = P[0]; out[n * 2 + 1] = P[1]; dep[n] = P[2];
    return n + 1;
    function pt(x, y, z) {
      const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
      const y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
      const f = CAMERA / (CAMERA - z2);
      P[0] = cx + s * f * x1; P[1] = cyy - s * f * y2; P[2] = z2;
    }
  }
  const P = new Float32Array(3), Q = new Float32Array(3);

  function vertexScreen(i) {
    const x = [0, 0, 0, 0]; x[i] = 1;
    const tt = { count: 0, cap: 1, buf: new Float32Array(3), x };
    const o = new Float32Array(2), d = new Float32Array(1);
    project(tt, o, d);
    return [o[0], o[1], d[0]];
  }

  function maskAt(x) {
    if (!scrim) return 1;
    const ramp = 80, inside = cfg.scrimInside;
    if (x <= scrim.x0 - ramp || x >= scrim.x1 + ramp) return 1;
    if (x >= scrim.x0 && x <= scrim.x1) return inside;
    const d = x < scrim.x0 ? (scrim.x0 - x) / ramp : (x - scrim.x1) / ramp;
    return inside + (1 - inside) * d;
  }
  function measureScrim() {
    scrim = null;
    if (!isBg) return;
    const el = document.querySelector(cfg.scrimSelector);
    if (el) { const r = el.getBoundingClientRect(); if (r.width > 0) scrim = { x0: r.left, x1: r.right }; }
  }

  // ---------- Drawing ----------

  function isDark(tk) {
    const [r, g, b] = parseColor(tk["--bg"]);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }

  function drawTrace(ctx, t, alphaMul, tk, dark) {
    const n = project(t, screen, depth);
    const chunk = 24, first = t.first, newest = t.count;
    // On phones (under 560px) the text column covers the screen, so the background cannot be
    // dimmed beside it: it is drawn at half strength instead, gray only (see draw()).
    const base = (isBg ? (dark ? 0.26 : 0.24) * (W < 560 ? 0.5 : 1) : (dark ? 0.62 : 0.58)) * alphaMul;
    chalkStroke(ctx, screen.subarray(0, n * 2), {
      color: tk["--chalk"], width: isBg ? 1.0 : 1.05, jitter: 0.2, chunk, indexOffset: first,
      dpr: sizer.dpr, alpha: base,
      alphaFn: (k, mx, my, m) => {
        // Oldest quarter of the kept trace fades out; nearer parts are a little darker.
        const age = (newest - (first + m)) / t.cap;
        const fade = age > 0.75 ? Math.max(0, (1 - age) / 0.25) : 1;
        const dz = clamp(0.78 + 0.22 * depth[m], 0.55, 1);
        return fade * dz * (scrim ? maskAt(mx) : 1);
      }
    });
    return n;
  }

  function draw(now) {
    const ctx = sizer.ctx, tk = tokens.get(), dark = isDark(tk);
    sizer.clear();

    // Tetrahedron edges, faint; back edges fainter.
    const vs = [0, 1, 2, 3].map(vertexScreen);
    ctx.save();
    for (const [a, b] of EDGES) {
      const zmid = (vs[a][2] + vs[b][2]) / 2;
      const al = (isBg ? 0.10 * (W < 560 ? 0.5 : 1) * maskAt((vs[a][0] + vs[b][0]) / 2) : 0.26) * clamp(0.7 + 0.3 * zmid, 0.4, 1);
      chalkStroke(ctx, [vs[a][0], vs[a][1], vs[b][0], vs[b][1]], {
        color: tk["--chalk"], width: 0.8, jitter: 0, chunk: 2, alpha: al, dpr: sizer.dpr, salt: a * 7 + b
      });
    }
    ctx.restore();
    if (!isBg) {
      ctx.save();
      ctx.fillStyle = tk["--fg-2"];
      ctx.font = '12px "CMU Sans Serif", "Latin Modern Sans", system-ui, sans-serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const G = frameGeom(), cx = G.cx, cyy = G.cy;
      vs.forEach((v, i) => {
        const dx = v[0] - cx, dy = v[1] - cyy, d = Math.hypot(dx, dy) || 1;
        ctx.globalAlpha = clamp(0.65 + 0.35 * v[2], 0.4, 1);
        ctx.fillText(String(i + 1), v[0] + (dx / d) * 13, v[1] + (dy / d) * 13);
      });
      ctx.restore();
    }

    // Fading previous orbit after a restart.
    if (ghost) {
      const g = 1 - smootherstep((now - ghost.t0) / 1400);
      if (g <= 0) ghost = null; else drawTrace(ctx, ghost.traj, g, tk, dark);
    }
    const n = drawTrace(ctx, traj, 1, tk, dark);

    // The light: the current state of the population. Not drawn behind text on phones.
    if (isBg && W < 560) return;
    const hx = screen[(n - 1) * 2], hy = screen[(n - 1) * 2 + 1];
    const I = appear * (isBg ? Math.max(0.7, maskAt(hx)) * (dark ? 0.95 : 0.85) : 1);
    drawLight(ctx, hx, hy, tk["--red"], tk["--red-bright"], { intensity: I, scale: isBg ? 1 : 0.9 });
  }

  function frame(now, dt) {
    const t0 = performance.now();
    // Integrate: speed (time units per second) times elapsed time, in whole RK4 steps.
    const want = (cfg.speed * speedMul * dt) / 1000 / H + stepCarry;
    const steps = Math.floor(want); stepCarry = want - steps;
    if (!traj.advance(steps)) restart(true);
    appear = Math.min(1, appear + dt / 700);
    // Rotation: slow auto-rotation, plus inertia left over from a drag.
    if (!dragging) {
      yaw += (cfg.yawRate * dt) / 1000 + yawVel * dt;
      yawVel *= Math.exp(-dt / 500);
    }
    draw(now);
    const w = performance.now() - t0;
    stats.frames++; stats.work += w; if (w > stats.maxWork) stats.maxWork = w;
  }

  sizer = new CanvasSizer(canvas, (w, h) => {
    W = w; Hh = h; measureScrim();
    if (ready && (!loop || !loop.running)) draw(performance.now());
  }, { maxDpr: options.maxDpr || (isBg ? 1.5 : 2) });
  W = sizer.w; Hh = sizer.h; measureScrim();

  // ---------- Start ----------

  if (isBg && !reduced && restore()) { /* resumed */ }
  else {
    traj.reset(newStart());
    // Skip part of the slow first spiral: a short head start in hero mode, and enough in
    // background mode that a first page view already shows the attractor's outline.
    if (reduced) settleStill(); else traj.advance(Math.round((isBg ? 60 : 8) / H));
  }

  loop = new Loop(isBg ? canvas : root, frame, { fps: cfg.fps });
  function applyMotionPref() {
    if (reduced) { loop.stop(); if (traj.count < 1000) settleStill(); appear = 1; draw(performance.now()); }
    else {
      loop.start();
      // Mounted while motion is paused: draw the full attractor (the reduced-motion still),
      // not the first few loops of the spiral. Play continues from it.
      if (!loop.running && traj.count < 1000) { settleStill(); }
    }
    // Inline display, because the site stylesheet sets display on these controls.
    if (controls.pause) controls.pause.style.display = reduced ? "none" : "";
    if (controls.speed) controls.speed.parentElement.style.display = reduced ? "none" : "";
  }
  const unReduce = onReducedMotionChange((r) => { reduced = r; applyMotionPref(); });
  ready = true;
  applyMotionPref();
  draw(performance.now());

  const onPageHide = () => save();
  const onVis = () => { if (document.hidden) save(); };
  if (cfg.storageKey) { window.addEventListener("pagehide", onPageHide); document.addEventListener("visibilitychange", onVis); }
  const onResize = () => measureScrim();
  window.addEventListener("resize", onResize);

  // ---------- Hero controls ----------

  const cleanups = [];
  if (!isBg) {
    controls.restart.addEventListener("click", () => restart(!reduced));
    controls.pause.addEventListener("click", () => {
      // A plain action button whose label changes (no aria-pressed: the red pressed style
      // marks a selected mode, not a stopped animation).
      const p = controls.pause.dataset.paused !== "true";
      controls.pause.dataset.paused = String(p);
      controls.pause.textContent = p ? "Play" : "Pause";
      if (p) loop.pause(); else loop.resume();
    });
    controls.speed.addEventListener("input", () => {
      speedMul = Math.pow(2, +controls.speed.value);
      controls.speed.setAttribute("aria-valuetext", (Math.round(speedMul * 100) / 100) + " times");
    });
    // Drag (mouse, pen, touch) to rotate; vertical touch drags still scroll the page.
    let lastX = 0, lastY = 0, lastT = 0;
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = performance.now(); yawVel = 0;
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const now = performance.now(), dx = e.clientX - lastX, dy = e.clientY - lastY;
      yaw += dx * 0.008; pitch = clamp(pitch + dy * 0.006, -0.25, 1.15);
      const dtm = Math.max(1, now - lastT);
      yawVel = (dx * 0.008) / dtm;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      if (!loop.running) draw(now);
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false; canvas.style.cursor = "grab";
      if (performance.now() - lastT > 80) yawVel = 0;
      yawVel = clamp(yawVel, -0.01, 0.01);
      if (reduced) yawVel = 0;
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft") yaw -= 0.12; else if (k === "ArrowRight") yaw += 0.12;
      else if (k === "ArrowUp") pitch = clamp(pitch - 0.08, -0.25, 1.15);
      else if (k === "ArrowDown") pitch = clamp(pitch + 0.08, -0.25, 1.15);
      else return;
      e.preventDefault();
      if (!loop.running) draw(performance.now());
    });
  }

  // ---------- Controller ----------

  return {
    mode,
    element: root,
    canvas,
    pause() { loop.pause(); },
    resume() { loop.resume(); },
    restart() { restart(!reduced); },
    get running() { return loop.running; },
    state() { return { x: Array.from(traj.x), steps: traj.steps, time: traj.steps * H, minShare: minShare(traj.x), yaw, reduced }; },
    stats() { return { frames: stats.frames, avgDrawMs: stats.frames ? stats.work / stats.frames : 0, maxDrawMs: stats.maxWork }; },
    redraw() { measureScrim(); draw(performance.now()); },
    destroy() {
      save();
      loop.destroy(); sizer.destroy(); tokens.destroy(); unReduce();
      window.removeEventListener("resize", onResize);
      if (cfg.storageKey) { window.removeEventListener("pagehide", onPageHide); document.removeEventListener("visibilitychange", onVis); }
      root.remove();
    }
  };
}
