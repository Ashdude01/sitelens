import { NextResponse, type NextRequest } from "next/server";
import { InputError, RateLimitError, getOrScanReport } from "@/server/services/report-service";
import { clientKeyFromHeaders } from "@/server/services/client-key";

const cors = { "access-control-allow-origin": "*" };

export const maxDuration = 60;

/**
 * GET /api/v1/lookup?domain=example.com[&refresh=1]
 * Returns the full report JSON. Cached reads are free; new scans are rate-limited per client.
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  const force = req.nextUrl.searchParams.get("refresh") === "1";
  try {
    const { report, fromCache, stale } = await getOrScanReport(domain ?? "", {
      force,
      clientKey: clientKeyFromHeaders(req.headers),
    });
    return NextResponse.json(
      { ...report, ...(stale ? { stale: true } : {}) },
      { headers: { ...cors, "cache-control": fromCache && !stale ? "public, max-age=300" : "no-store", "x-cache": fromCache ? "HIT" : "MISS" } },
    );
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 400, headers: cors });
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429, headers: cors });
    console.error("api lookup failed", domain, e);
    return NextResponse.json({ error: "Scan failed. The site may be down or blocking us." }, { status: 502, headers: cors });
  }
}
