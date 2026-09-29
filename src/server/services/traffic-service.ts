import type { TrafficInfo, TrafficVerdict } from "@/lib/types";
import { config } from "../config";
import type { Target } from "../scanner/net";
import { estimateFromSignals, loadCalibration } from "../traffic/estimator";
import { getCruxRecord, getOrganicEstimate } from "../traffic/providers";
import { getCountryPopularity, getRankSignals } from "../repositories/ranks";
import { findGroundTruth } from "../repositories/ground-truth";

export async function getTraffic(target: Target, finalOrigin: string): Promise<TrafficInfo> {
  const [ranks, countries, truth, crux, organic] = await Promise.all([
    getRankSignals(target),
    getCountryPopularity(target),
    findGroundTruth(target),
    getCruxRecord(finalOrigin),
    getOrganicEstimate(target.domain),
  ]);
  const estimate = estimateFromSignals(ranks, loadCalibration(config.dataDir));
  const verified = truth?.source === "verified" ? { monthlyVisits: truth.monthlyVisits, period: truth.period } : null;

  let verdict: TrafficVerdict = "unknown";
  if (verified) verdict = "verified";
  else if (estimate) verdict = "estimated";
  else if (crux?.inCrux === false) verdict = "too-small";

  return { verdict, verified, estimate, ranks, countries, crux, organic };
}
