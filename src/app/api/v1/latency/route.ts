import { translateError } from "@/i18n/errors";
import { NextResponse, type NextRequest } from "next/server";
import { InputError, RateLimitError } from "@/server/services/report-service";
import { clientKeyFromHeaders } from "@/server/services/client-key";
import { getLatency } from "@/server/services/latency-service";
import { LatencyError } from "@/server/latency/globalping";

export const maxDuration = 60;

/** GET /api/v1/latency?domain=example.com — HTTPS timing from seven countries, cached. */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  try {
    const { result, cached } = await getLatency(domain, {
      clientKey: clientKeyFromHeaders(req.headers),
      force: req.nextUrl.searchParams.get("refresh") === "1",
    });
    return NextResponse.json(result, { headers: { "cache-control": cached ? "public, max-age=600" : "no-store", "x-cache": cached ? "HIT" : "MISS" } });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: await translateError(e.message) }, { status: 400 });
    if (e instanceof RateLimitError || e instanceof LatencyError) return NextResponse.json({ error: await translateError(e.message) }, { status: e instanceof RateLimitError ? 429 : e.status });
    console.error("latency failed", domain, e);
    return NextResponse.json({ error: await translateError("Could not check worldwide reach. Please try again.") }, { status: 502 });
  }
}
