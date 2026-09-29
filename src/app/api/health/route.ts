import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { listSources } from "@/server/repositories/ranks";
import { loadFingerprints } from "@/server/scanner/fingerprints";
import { loadCalibration } from "@/server/traffic/estimator";

export async function GET() {
  try {
    const [lists] = await Promise.all([listSources()]);
    return NextResponse.json(
      { ok: true, fingerprints: loadFingerprints().techs.length, lists, calibrated: loadCalibration(config.dataDir).calibrated },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
