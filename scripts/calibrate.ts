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
  loadCalibration,
  midRank,
  type Calibration,
} from "@/server/traffic/estimator";

const MIN_POINTS = 8;
const norm = (s: string) => s.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

const csv = path.join(config.dataDir, "ground_truth.csv");
if (fs.existsSync(csv)) {
  const rows = fs
    .readFileSync(csv, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split(",").map((s) => s.trim()))
    .filter(([d, v]) => d !== "domain" && Number(v) > 0)
    .map(([d, v, source = "public", period = ""]) => ({ domain: norm(d), monthlyVisits: Math.round(Number(v)), source, period: period || null }));
  await upsertGroundTruth(rows);
  console.log(`Loaded ${rows.length} ground-truth rows from data/ground_truth.csv`);
}

const truth = await allGroundTruth();
if (!truth.length) {
  console.log("No ground truth yet. Add rows to data/ground_truth.csv and re-run.");
  process.exit(0);
}

const prior = loadCalibration(config.dataDir);
const cal: Calibration = { calibrated: false, fittedAt: new Date().toISOString(), sources: { ...prior.sources } };
const bySource: Record<string, { x: number; y: number }[]> = {};
const signalsByDomain = new Map<string, Awaited<ReturnType<typeof getRankSignals>>>();
for (const t of truth) {
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
  cal.sources[source] = f;
  cal.calibrated = true;
  console.log(`  ${source}: n=${f.n}  log10(visits) = ${f.a} + ${f.b}*log10(rank)  sigma=${f.sigma} (typical error x${(10 ** f.sigma).toFixed(1)})`);
}
cal.note = cal.calibrated ? `Fitted on ${truth.length} sites with known traffic.` : prior.note;
fs.writeFileSync(calibrationPath(config.dataDir), `${JSON.stringify(cal, null, 2)}\n`);

let inRange = 0;
let total = 0;
let absLogErr = 0;
for (const t of truth) {
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
