// Fit the traffic model on sites whose real traffic you know.
//   1) Add rows to data/ground_truth.csv:  domain,monthly_visits,source,period
//        source = verified (owner-connected analytics, shown as exact) | public (published stats)
//   2) npm run calibrate
// Prints how often the real number falls inside the shown range - publish that on /methodology.
import "./_env";
import fs from "node:fs";
import path from "node:path";
import { config } from "@/server/config";
import { allGroundTruth, upsertGroundTruth } from "@/server/repositories/ground-truth";
import { getRankSignals } from "@/server/repositories/ranks";
import {
  calibrationPath,
  estimateFromSignals,
  fitSource,
  midRank,
  type Calibration,
} from "@/server/traffic/estimator";

const MIN_POINTS = 8;
/**
 * Sites below this many monthly visits are left out of the fit. Rank lists only cover sites with real
 * traffic, so a "site" with a handful of visits that still has a top rank is a tracking artefact
 * (e.g. google.com or a translate proxy showing up in a government analytics export with 3 visits).
 * Keeping them flattened the fitted slope to ~0 and made every estimate tiny.
 */
const MIN_VISITS = Number(process.env.CALIBRATE_MIN_VISITS ?? 10_000);
/** Popularity follows a power law with slope near -1. A fit far outside this range means bad ground truth. */
const SLOPE_RANGE: [number, number] = [-1.6, -0.6];
const norm = (s: string) => s.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

const csv = path.join(config.dataDir, "ground_truth.csv");
if (fs.existsSync(csv)) {
  // Merge hostnames that normalize to the same site (www.irs.gov + irs.gov) by ADDING their visits.
  // Overwriting instead kept whichever came last, often a bare redirect host with a few thousand visits.
  const merged = new Map<string, { domain: string; monthlyVisits: number; source: string; period: string | null }>();
  for (const line of fs.readFileSync(csv, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [d, v, source = "public", period = ""] = line.split(",").map((x) => x.trim());
    if (d === "domain" || !(Number(v) > 0)) continue;
    const domain = norm(d);
    const cur = merged.get(domain);
    if (cur) cur.monthlyVisits += Math.round(Number(v));
    else merged.set(domain, { domain, monthlyVisits: Math.round(Number(v)), source, period: period || null });
  }
  const rows = [...merged.values()];
  await upsertGroundTruth(rows);
  console.log(`Loaded ${rows.length} ground-truth sites from data/ground_truth.csv`);
}

const truth = await allGroundTruth();
if (!truth.length) {
  console.log("No ground truth yet. Add rows to data/ground_truth.csv and re-run.");
  process.exit(0);
}

// Start every run from the uncalibrated priors, not from the previous calibration.json, so a bad earlier
// fit can never become the fallback for a source that fails the checks below.
const PRIORS: Calibration["sources"] = {
  crux: { a: 10.9, b: -1.1, sigma: 0.4 },
  umbrella: { a: 10.9, b: -1.1, sigma: 0.6 },
  majestic: { a: 10.9, b: -1.1, sigma: 0.7 },
  default: { a: 10.9, b: -1.1, sigma: 0.7 },
};
const prior = { note: "DEFAULT PRIORS, NOT FITTED. Add sites with known traffic to data/ground_truth.csv and run npm run calibrate." };
const cal: Calibration = { calibrated: false, fittedAt: new Date().toISOString(), sources: { ...PRIORS } };
const bySource: Record<string, { x: number; y: number }[]> = {};
const signalsByDomain = new Map<string, Awaited<ReturnType<typeof getRankSignals>>>();
const usable = truth.filter((t) => t.monthlyVisits >= MIN_VISITS);
console.log(`Using ${usable.length} sites with at least ${MIN_VISITS.toLocaleString()} visits/month (${truth.length - usable.length} smaller ones skipped)`);
for (const t of usable) {
  const signals = await getRankSignals({ key: t.domain, host: t.domain, domain: t.domain });
  signalsByDomain.set(t.domain, signals);
  for (const s of signals) (bySource[s.source] ??= []).push({ x: Math.log10(midRank(s.source, s.rank)), y: Math.log10(t.monthlyVisits) });
}
for (const [source, pts] of Object.entries(bySource)) {
  if (pts.length < MIN_POINTS) {
    console.log(`  ${source}: only ${pts.length} matching sites (need ${MIN_POINTS}), keeping prior`);
    continue;
  }
  const f = fitSource(pts);
  if (f.b < SLOPE_RANGE[0] || f.b > SLOPE_RANGE[1]) {
    console.log(`  ${source}: fitted slope ${f.b} is implausible (expected ${SLOPE_RANGE[0]} to ${SLOPE_RANGE[1]}), keeping prior. Check the ground truth.`);
    continue;
  }
  cal.sources[source] = f;
  cal.calibrated = true;
  console.log(`  ${source}: n=${f.n}  log10(visits) = ${f.a} + ${f.b}*log10(rank)  sigma=${f.sigma} (typical error x${(10 ** f.sigma).toFixed(1)})`);
}
cal.note = cal.calibrated ? `Fitted on ${usable.length} sites with known traffic.` : prior.note;
fs.writeFileSync(calibrationPath(config.dataDir), `${JSON.stringify(cal, null, 2)}\n`);

let inRange = 0;
let total = 0;
let absLogErr = 0;
for (const t of usable) {
  const est = estimateFromSignals(signalsByDomain.get(t.domain) ?? [], cal);
  if (!est) continue;
  total++;
  if (t.monthlyVisits >= est.monthlyVisits.low && t.monthlyVisits <= est.monthlyVisits.high) inRange++;
  absLogErr += Math.abs(Math.log10(est.monthlyVisits.mid) - Math.log10(t.monthlyVisits));
}
if (total) {
  console.log(`\nAccuracy on ${total} sites: ${((inRange / total) * 100).toFixed(0)}% inside the shown range, typical error x${(10 ** (absLogErr / total)).toFixed(2)}`);
  console.log("(In-sample. Hold some sites out for a stricter test.) Publish this on /methodology.");
}
console.log(`Wrote data/calibration.json (calibrated=${cal.calibrated})`);
