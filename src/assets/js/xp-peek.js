// The ∃xProof AI peek: hovering or focusing the masthead link opens a small card that runs a
// miniature of the exproof.ai background. A light searches a random tree depth first; with
// probability 1/3 one branch reaches the last depth, and then the path from the root sweeps
// green. Otherwise the light exhausts the tree and it fades. Under reduced motion, or with motion
// paused site-wide, the card shows one finished search and does not animate.
(function () {
  var host = document.querySelector("[data-xp-peek]");
  if (!host) return;
  var D = 9, card, canvas, ctx, W = 0, H = 0, raf = 0, open = false, run = null;

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function still() {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return reduce || document.documentElement.getAttribute("data-motion") === "paused";
  }

  // A tidy tree that grows rightward. Non-witness branches stop early; the witness reaches D.
  function makeTree() {
    var solvable = Math.random() < 1 / 3, nodes = [];
    function grow(depth, witness) {
      var n = { depth: depth, kids: [], witness: witness };
      nodes.push(n);
      if (depth === D) return n;
      var stop = witness ? 0 : 0.08 + 0.6 * Math.pow(depth / D, 1.6);
      if (!witness && (Math.random() < stop || depth >= D - 1)) return n;
      var k = depth < 2 ? 2 + (Math.random() < 0.5 ? 1 : 0) : (Math.random() < 0.55 ? 2 : 1);
      var w = witness ? Math.floor(Math.random() * k) : -1;
      for (var i = 0; i < k && nodes.length < 70; i++) n.kids.push(grow(depth + 1, i === w));
      if (witness && w >= n.kids.length) n.kids.push(grow(depth + 1, true));
      return n;
    }
    var root = grow(0, solvable);
    var leaf = 0;
    (function place(n) {
      if (!n.kids.length) { n.y = leaf++; return; }
      n.kids.forEach(place);
      n.y = (n.kids[0].y + n.kids[n.kids.length - 1].y) / 2;
    })(root);
    nodes.forEach(function (n) { n.fx = n.depth / D; n.fy = leaf > 1 ? n.y / (leaf - 1) : 0.5; });
    return root;
  }

  // The light's route: depth first, children in random order (the search does not know which
  // branch is the witness). Each step is a segment from one node to another.
  function makeRun() {
    var root = makeTree(), steps = [], path = null;
    (function dfs(n, trail) {
      if (path) return;
      trail = trail.concat([n]);
      if (n.depth === D) { path = trail; return; }
      var kids = n.kids.slice().sort(function () { return Math.random() - 0.5; });
      for (var i = 0; i < kids.length && !path; i++) {
        steps.push({ a: n, b: kids[i], back: false });
        dfs(kids[i], trail);
        if (!path) steps.push({ a: kids[i], b: n, back: true });
      }
    })(root, []);
    return { steps: steps, path: path, seen: [], t0: performance.now(), done: false };
  }

  function pos(n) { return [6 + n.fx * (W - 12), 6 + n.fy * (H - 12)]; }

  function draw(now) {
    var edge = css("--rule-strong", "#a9a9a2"), fg = css("--fg", "#141413"), green = css("--green", "#1a7f4e");
    var stepMs = 70, r = run, n = r.steps.length;
    var elapsed = still() ? 1e9 : Math.max(0, now - r.t0);
    var k = Math.min(n, Math.floor(elapsed / stepMs)), f = Math.min(1, (elapsed - k * stepMs) / stepMs);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1; ctx.strokeStyle = edge; ctx.globalAlpha = 0.8;
    for (var i = 0; i < Math.min(k, n); i++) if (!r.steps[i].back) seg(r.steps[i].a, r.steps[i].b, 1);
    var light = null;
    if (k < n) {
      var s = r.steps[k];
      if (!s.back) seg(s.a, s.b, f);
      var a = pos(s.a), b = pos(s.b);
      light = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    var after = elapsed - n * stepMs;
    if (k >= n && r.path) {
      var sweep = Math.min(1, Math.max(0, after / 700));
      ctx.strokeStyle = green; ctx.globalAlpha = 1; ctx.lineWidth = 1.6;
      var m = Math.floor(sweep * (r.path.length - 1));
      for (var j = 0; j < m; j++) seg(r.path[j], r.path[j + 1], 1);
      light = pos(r.path[r.path.length - 1]);
    } else if (k >= n) {
      light = pos(r.steps.length ? r.steps[n - 1].b : { fx: 0, fy: 0.5 });
    }
    if (light) {
      ctx.globalAlpha = 1; ctx.fillStyle = k >= n && r.path ? green : fg;
      ctx.beginPath(); ctx.arc(light[0], light[1], 2.2, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!still() && after > (r.path ? 2200 : 1200)) run = makeRun();
    if (open && !still()) raf = requestAnimationFrame(draw);
  }
  function seg(a, b, f) {
    var p = pos(a), q = pos(b);
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f); ctx.stroke();
  }

  function build() {
    card = document.createElement("div");
    card.className = "xp-peek"; card.setAttribute("aria-hidden", "true");
    canvas = document.createElement("canvas");
    var p = document.createElement("p");
    p.textContent = "A search for a proof that a path to safe AI exists. When the search reaches a witness, the path turns green.";
    card.appendChild(canvas); card.appendChild(p); host.appendChild(card);
    ctx = canvas.getContext("2d");
  }
  function size() {
    var dpr = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect();
    W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function show() {
    if (open) return;
    if (!card) build();
    open = true; card.classList.add("open"); size();
    run = makeRun(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }
  function hide() { open = false; if (card) card.classList.remove("open"); cancelAnimationFrame(raf); }

  host.addEventListener("mouseenter", show);
  host.addEventListener("mouseleave", hide);
  host.addEventListener("focusin", show);
  host.addEventListener("focusout", hide);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
})();
