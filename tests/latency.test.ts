import { describe, expect, it } from "vitest";
import { buildLatencyReport } from "@/lib/latency-types";

describe("buildLatencyReport", () => {
  it("maps probes onto the fixed country list and counts reachable replies", () => {
    const report = buildLatencyReport("example.com", [
      { probe: { country: "US" }, result: { status: "finished", statusCode: 200, timings: { firstByte: 180, total: 220 } } },
      { probe: { country: "gb" }, result: { status: "finished", statusCode: 403, timings: { firstByte: 90 } } },
      { probe: { country: "JP" }, result: { status: "failed" } },
      { probe: { country: "SG" }, result: { status: "finished", statusCode: 503, timings: { total: 400 } } },
    ]);
    const by = Object.fromEntries(report.regions.map((r) => [r.code, r]));
    expect(by.US).toMatchObject({ status: "ok", ttfbMs: 180 });
    expect(by.GB).toMatchObject({ status: "blocked", ttfbMs: 90 });
    expect(by.JP).toMatchObject({ status: "down", ttfbMs: null });
    expect(by.SG).toMatchObject({ status: "down" });
    expect(by.AU.status).toBe("unavailable");
    expect(report.reachable).toBe(2);
    expect(report.checked).toBe(4);
  });
});
