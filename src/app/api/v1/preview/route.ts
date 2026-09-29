import { NextResponse, type NextRequest } from "next/server";
import { InputError, RateLimitError } from "@/server/services/report-service";
import { clientKeyFromHeaders } from "@/server/services/client-key";
import { getPreview } from "@/server/services/preview-service";

export const maxDuration = 60;

/** GET /api/v1/preview?domain=example.com — homepage screenshot for the report sidebar. */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  try {
    const { image, contentType, cached } = await getPreview(domain, clientKeyFromHeaders(req.headers));
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "content-type": contentType,
        "cache-control": cached ? "public, max-age=86400" : "public, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof InputError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    console.error("preview failed", domain, e);
    return new NextResponse("Preview unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  }
}
