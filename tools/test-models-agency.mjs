// Mathematical checks for the agency models (reflection.js and hypotheses.js).
//
//   node tools/test-models-agency.mjs
//
// (a) Reflection: under the agent's own forecast, the mean of simulated future credences equals
//     the present credence within Monte Carlo error for the Bayesian agent, and drifts upward
//     for the agent who expects to change its mind. Also checks the one-step expectation exactly.
// (b) Hypotheses: total probability is 1 after every update and every refinement; a refinement
//     changes no cell but the catch-all and conserves its mass; and the cell masses equal the
//     posterior of a learner who named all 19 values from the start, summed over each cell.
//
// Exits with status 1 if any check fails.

import {
  simulateFutures, expectedNext, bayesUpdate, driftUpdate, FLIPS, THETA_H, THETA_T
} from "../src/assets/js/models/reflection.js";
import {
  HypothesisSpace, THETAS, INITIAL_NAMED, NAMED_PRIOR, MAX_FLIPS
} from "../src/assets/js/models/hypotheses.js";
import { mulberry32 } from "../src/assets/js/models/common.js";

let failures = 0;
function check(cond, msg) {
  if (cond) console.log("  ok   " + msg);
  else { console.log("  FAIL " + msg); failures++; }
}

// ---------- (a) Reflection ----------

console.log("(a) Reflection");

// Exact one-step expectation.
{
  let maxBayes = 0, minDrift = Infinity;
  for (let c = 0.01; c < 1; c += 0.01) {
    maxBayes = Math.max(maxBayes, Math.abs(expectedNext(c, false) - c));
    minDrift = Math.min(minDrift, expectedNext(c, true) - c);
  }
  check(maxBayes < 1e-15, `Bayesian one-step expected credence equals present credence (max error ${maxBayes.toExponential(2)})`);
  check(minDrift > 0, `non-reflective one-step expected credence exceeds present credence (min excess ${minDrift.toFixed(5)})`);
  check(Math.abs(bayesUpdate(0.5, true) - THETA_H / (THETA_H + THETA_T)) < 1e-15, "Bayes update after one heads from 0.5 is 0.7/(0.7+0.3)");
  check(driftUpdate(0.5, true) > bayesUpdate(0.5, true), "drift update exceeds the Bayes update");
}

// Monte Carlo: mean of simulated futures, at every flip.
const N = 20000;
for (const c0 of [0.1, 0.3, 0.5, 0.7, 0.9]) {
  for (const seed of [1, 2, 3]) {
    const rng = mulberry32(seed * 7919 + Math.round(c0 * 100));
    const b = simulateFutures({ c0, n: N, drift: false, rng });
    let maxZ = 0;
    for (let t = 1; t <= FLIPS; t++) {
      const se = b.sd[t] / Math.sqrt(N);
      // The stratified hypothesis assignment can shift the share of H paths by at most 1/N.
      const z = Math.max(0, Math.abs(b.mean[t] - c0) - 1 / N) / se;
      maxZ = Math.max(maxZ, z);
    }
    check(maxZ < 4.5, `Bayesian c0=${c0} seed=${seed}: mean within MC error at all ${FLIPS} flips (max |z| ${maxZ.toFixed(2)}, mean after ${FLIPS} = ${b.mean[FLIPS].toFixed(4)})`);
    // The paths do spread toward 0 and 1.
    check(b.sd[FLIPS] > 0.3 * Math.sqrt(c0 * (1 - c0)), `Bayesian c0=${c0} seed=${seed}: paths spread (sd after ${FLIPS} = ${b.sd[FLIPS].toFixed(3)})`);

    const d = simulateFutures({ c0, n: N, drift: true, rng });
    const se = d.sd[FLIPS] / Math.sqrt(N);
    const z = (d.mean[FLIPS] - c0) / se;
    check(z > 10, `non-reflective c0=${c0} seed=${seed}: mean drifts up (mean after ${FLIPS} = ${d.mean[FLIPS].toFixed(4)}, z = ${z.toFixed(1)})`);
  }
}

// ---------- (b) Hypotheses ----------

console.log("(b) Hypotheses");

function fineReference() {
  const p = THETAS.map((_, i) => (INITIAL_NAMED.includes(i) ? NAMED_PRIOR : (1 - NAMED_PRIOR * INITIAL_NAMED.length) / (THETAS.length - INITIAL_NAMED.length)));
  return {
    p,
    update(heads) {
      let z = 0;
      for (let i = 0; i < p.length; i++) { p[i] *= heads ? THETAS[i] : 1 - THETAS[i]; z += p[i]; }
      for (let i = 0; i < p.length; i++) p[i] /= z;
    }
  };
}

function compare(space, ref) {
  // Cell masses against the fine posterior summed over each cell.
  let maxErr = 0;
  const namedMembers = new Set(space.cells.map((c) => c.member));
  for (const c of space.cells) maxErr = Math.max(maxErr, Math.abs(c.mass - ref.p[c.member]));
  if (space.catchAll) {
    let s = 0;
    for (let i = 0; i < THETAS.length; i++) if (!namedMembers.has(i)) s += ref.p[i];
    maxErr = Math.max(maxErr, Math.abs(space.catchAll.mass - s));
  }
  return maxErr;
}

let updates = 0, refinements = 0, emptied = 0, maxTotalErr = 0, maxRefErr = 0, maxConsErr = 0, untouchedChanged = 0, settledRuns = 0, wrongSettled = 0;
const runs = 400;
const rng = mulberry32(20261030);
for (let r = 0; r < runs; r++) {
  const truth = Math.floor(rng() * THETAS.length);
  const threshold = 0.3 + 0.05 * Math.floor(rng() * 11);
  const space = new HypothesisSpace(), ref = fineReference();
  maxTotalErr = Math.max(maxTotalErr, Math.abs(space.total() - 1));
  while (space.flips < MAX_FLIPS && !space.settled()) {
    const heads = rng() < THETAS[truth];
    space.update(heads); ref.update(heads); updates++;
    maxTotalErr = Math.max(maxTotalErr, Math.abs(space.total() - 1));
    maxRefErr = Math.max(maxRefErr, compare(space, ref));
    const before = new Map(space.cells.map((c) => [c.id, c.mass]));
    const caBefore = space.catchAll ? space.catchAll.mass : 0;
    const added = space.refine(threshold);
    if (added) {
      refinements++;
      if (!space.catchAll) emptied++;
      for (const [id, m] of before) if (space.cells.find((c) => c.id === id).mass !== m) untouchedChanged++;
      const after = added.reduce((s, c) => s + c.mass, 0) + (space.catchAll ? space.catchAll.mass : 0);
      maxConsErr = Math.max(maxConsErr, Math.abs(after - caBefore));
      maxTotalErr = Math.max(maxTotalErr, Math.abs(space.total() - 1));
      maxRefErr = Math.max(maxRefErr, compare(space, ref));
    }
  }
  if (space.settled()) { settledRuns++; if (space.settled().member !== truth) wrongSettled++; }
}
console.log(`  ${runs} runs, ${updates} updates, ${refinements} refinements (${emptied} emptied the catch-all), ${settledRuns} runs settled`);
check(refinements > 0, "refinements occurred in the animated setting");
// The "How it works" text says about 3 runs in 100 settle on a value other than the true one.
check(wrongSettled / runs > 0.01 && wrongSettled / runs < 0.06, `share of runs settling on a wrong value is about 3 in 100 (${wrongSettled} of ${runs})`);

// Forced exhaustion: refine after every flip (threshold below 0) until the catch-all is gone,
// so the branch that names the last members is exercised too.
for (let r = 0; r < 50; r++) {
  const truth = Math.floor(rng() * THETAS.length);
  const space = new HypothesisSpace(), ref = fineReference();
  while (space.catchAll) {
    const heads = rng() < THETAS[truth];
    space.update(heads); ref.update(heads); updates++;
    maxTotalErr = Math.max(maxTotalErr, Math.abs(space.total() - 1));
    const caBefore = space.catchAll.mass;
    const added = space.refine(-1);
    refinements++;
    if (!space.catchAll) emptied++;
    const after = added.reduce((s, c) => s + c.mass, 0) + (space.catchAll ? space.catchAll.mass : 0);
    maxConsErr = Math.max(maxConsErr, Math.abs(after - caBefore));
    maxTotalErr = Math.max(maxTotalErr, Math.abs(space.total() - 1));
    maxRefErr = Math.max(maxRefErr, compare(space, ref));
  }
  // Updating continues correctly once every value is named.
  for (let k = 0; k < 50; k++) { const h = rng() < THETAS[truth]; space.update(h); ref.update(h); }
  maxTotalErr = Math.max(maxTotalErr, Math.abs(space.total() - 1));
  maxRefErr = Math.max(maxRefErr, compare(space, ref));
  if (space.cells.length !== THETAS.length) untouchedChanged++;
}
console.log(`  plus 50 forced-exhaustion runs: totals now ${refinements} refinements, ${emptied} emptied the catch-all`);
check(emptied === 50, "every forced-exhaustion run ends with all 19 values named and no catch-all");
check(maxTotalErr < 1e-12, `total probability is 1 after every update and refinement (max error ${maxTotalErr.toExponential(2)})`);
check(untouchedChanged === 0, "a refinement leaves every cell but the catch-all unchanged");
check(maxConsErr < 1e-15, `new cells plus the catch-all's remainder equal the catch-all's mass before refinement (max error ${maxConsErr.toExponential(2)})`);
check(maxRefErr < 1e-12, `cell masses equal the full 19-value posterior summed over each cell (max error ${maxRefErr.toExponential(2)})`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
