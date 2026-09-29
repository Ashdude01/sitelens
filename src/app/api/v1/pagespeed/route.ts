import { NextResponse, type NextRequest } from "next/server";
import { InputError, RateLimitError } from "@/server/services/report-service";
import { clientKeyFromHeaders } from "@/server/services/client-key";
import { getPagespeed } from "@/server/services/pagespeed-service";
import { PsiError } from "@/server/pagespeed/psi";

/** GET /api/v1/pagespeed?domain=example.com&strategy=mobile|desktop — Google PageSpeed Insights, cached. */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  const strategy = req.nextUrl.searchParams.get("strategy") === "desktop" ? "desktop" : "mobile";
  try {
    const { result, cached } = await getPagespeed(domain, strategy, {
      clientKey: clientKeyFromHeaders(req.headers),
      force: req.nextUrl.searchParams.get("refresh") === "1",
    });
    return NextResponse.json(result, { headers: { "cache-control": cached ? "public, max-age=600" : "no-store", "x-cache": cached ? "HIT" : "MISS" } });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    if (e instanceof PsiError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("pagespeed failed", domain, e);
    return NextResponse.json({ error: "Could not reach Google PageSpeed. Please try again." }, { status: 502 });
  }
}
