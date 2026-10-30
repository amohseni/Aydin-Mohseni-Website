// Headless test of the community model (src/assets/js/models/community.js).
//
// Runs TRIALS_PER independent communities for each network (evidence shared with neighbors),
// plus the complete-sharing condition, and reports the share that settle on the better action,
// a 95% Wilson interval, and the mean number of rounds to settle. Then checks the direction of
// Zollman (2007): the sparser network (cycle) reaches the better action more often than the
// complete network, but takes longer. Also checks that settled outcomes rarely change over a further
// 2000 rounds (so the settling rule is not declaring outcomes early), and that sharing with
// everyone matches the complete network.
//
// Usage: node tools/test-models-community.mjs [trials] [seed]

import { runTrial, NETWORKS, Community, makeNetwork } from "../src/assets/js/models/community.js";
import { mulberry32 } from "../src/assets/js/models/common.js";

const TRIALS_PER = +process.argv[2] || 500;
const SEED = process.argv[3] != null ? +process.argv[3] : 2007;
const rng = mulberry32(SEED);

function wilson(k, n, z = 1.96) {
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}

const results = {};
const conditions = [...NETWORKS.map((k) => [k, "neighbors"]), ["cycle", "everyone"]];
for (const [network, share] of conditions) {
  let better = 0, worse = 0, unsettled = 0, rounds = 0;
  for (let i = 0; i < TRIALS_PER; i++) {
    const r = runTrial({ network, share, rng });
    if (r.outcome === "better") better++; else if (r.outcome === "worse") worse++; else unsettled++;
    rounds += r.rounds;
  }
  const label = share === "everyone" ? "everyone (any network)" : network;
  results[label] = { better, worse, unsettled, frac: better / TRIALS_PER, ci: wilson(better, TRIALS_PER), meanRounds: rounds / TRIALS_PER };
}

console.log(`Community model: ${TRIALS_PER} runs per condition, seed ${SEED}`);
console.log("condition                 better  95% CI           worse  unsettled  mean rounds to settle");
for (const [k, v] of Object.entries(results)) {
  console.log(`${k.padEnd(25)} ${v.frac.toFixed(3)}   [${v.ci[0].toFixed(3)}, ${v.ci[1].toFixed(3)}]   ${String(v.worse).padStart(5)}  ${String(v.unsettled).padStart(9)}  ${v.meanRounds.toFixed(1).padStart(8)}`);
}

// Persistence: after settling, run 2000 more rounds. Count runs that leave unanimity at some
// point (an agent briefly retries the other action) and runs whose majority action over the
// last 50 of those rounds differs from the settled outcome (the outcome changed).
let departures = 0, changed = 0, checked = 0;
const prng = mulberry32(SEED + 1);
for (const network of NETWORKS) {
  for (let i = 0; i < 100; i++) {
    const r = runTrial({ network, rng: prng });
    const c = r.community, on = r.outcome === "better" ? 1 : 0;
    let left = false, tail = 0;
    for (let t = 0; t < 2000; t++) {
      const b = c.step();
      if ((on === 1 && b < c.n) || (on === 0 && b > 0)) left = true;
      if (t >= 1950) tail += b;
    }
    const fin = tail / (50 * c.n) > 0.5 ? 1 : 0;
    checked++; if (left) departures++; if (fin !== on) changed++;
  }
}
console.log(`Persistence over 2000 further rounds: ${departures} of ${checked} settled runs left unanimity at some point; ${changed} of ${checked} changed outcome.`);

const fails = [];
const C = results.cycle, S = results["small-world"], K = results.complete, E = results["everyone (any network)"];
if (!(C.frac > K.frac)) fails.push("cycle should reach the better action more often than complete");
if (!(C.ci[0] > K.ci[1])) fails.push("cycle and complete intervals should not overlap");
if (!(S.frac > K.frac)) fails.push("small world should reach the better action more often than complete");
if (!(C.meanRounds > K.meanRounds)) fails.push("cycle should take longer to settle than complete");
if (!(S.meanRounds > K.meanRounds)) fails.push("small world should take longer to settle than complete");
if (Math.abs(E.frac - K.frac) > 0.06) fails.push("sharing with everyone should behave like the complete network");
if (C.unsettled + S.unsettled + K.unsettled > 0) fails.push("some runs did not settle");
if (changed > checked * 0.02) fails.push("settled outcomes change too often; the settling rule is too loose");
// Network construction checks.
const n = 12, sw = makeNetwork("small-world", n, mulberry32(1));
const deg = (adj) => adj.reduce((s, a) => s + a.length, 0) / 2;
if (deg(makeNetwork("cycle", n)) !== n) fails.push("cycle edge count");
if (deg(makeNetwork("complete", n)) !== n * (n - 1) / 2) fails.push("complete edge count");
if (deg(sw) !== n + Math.round(n / 5)) fails.push("small-world edge count");

if (fails.length) { console.log("FAIL:\n  " + fails.join("\n  ")); process.exit(1); }
console.log("PASS: direction matches Zollman (2007): sparser networks are more reliable but slower.");
