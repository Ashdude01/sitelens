import { fetch as ufetch } from "undici";
import { config } from "../config";
import { buildLatencyReport, LATENCY_REGIONS, type LatencyReport } from "@/lib/latency-types";

const API = "https://api.globalping.io/v1/measurements";
const PROBES = "https://api.globalping.io/v1/probes";
const WANTED = LATENCY_REGIONS.map((region) => region.code);

export class LatencyError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

function token() {
  return process.env.GLOBALPING_TOKEN?.trim() || config.globalpingToken;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": `SiteLens/0.1 (+${config.publicUrl})`,
  };
  const key = token();
  if (key) h.authorization = `Bearer ${key}`;
  return h;
}

interface Measurement {
  id?: string;
  status?: string;
  results?: unknown[];
}

async function readError(res: { status: number; json: () => Promise<unknown> }): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message?.split("\n")[0] ?? `Globalping request failed (HTTP ${res.status}).`;
}

/** Run one HTTPS request from each region that currently has a probe. */
export async function measureRegions(host: string): Promise<LatencyReport> {
  if (!token()) throw new LatencyError("Worldwide check is not configured.", 503);

  const probeRes = await ufetch(PROBES, { headers: { accept: "application/json", "user-agent": headers()["user-agent"] }, signal: AbortSignal.timeout(10_000) });
  const online = new Set<string>(WANTED);
  if (probeRes.ok) {
    online.clear();
    const list = (await probeRes.json()) as { country?: string; location?: { country?: string } }[];
    for (const probe of list) {
      const code = (probe.location?.country ?? probe.country)?.toUpperCase();
      if (code) online.add(code);
    }
  }
  const locations = WANTED.filter((code) => online.has(code)).map((country) => ({ country }));
  if (!locations.length) throw new LatencyError("No probes are online in those countries right now.", 503);

  const created = await ufetch(API, {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      type: "http",
      target: host,
      locations,
      measurementOptions: {
        protocol: "HTTPS",
        port: 443,
        request: { method: "GET", path: "/" },
      },
    }),
  });

  if (created.status === 429) throw new LatencyError("Worldwide check limit reached. Try again in a little while.", 429);
  if (!created.ok && created.status !== 202) throw new LatencyError(await readError(created), created.status >= 500 ? 502 : 400);

  const first = (await created.json().catch(() => null)) as Measurement | null;
  const location = created.headers.get("location");
  const id = first?.id ?? location?.split("/").pop();
  if (!id) throw new LatencyError("Globalping did not return a measurement id.");

  const deadline = Date.now() + 30_000;
  let latest: Measurement = first ?? {};
  while (Date.now() < deadline) {
    if (latest.status && latest.status !== "in-progress" && latest.results?.length) break;
    await new Promise((r) => setTimeout(r, 500));
    const res = await ufetch(`${API}/${encodeURIComponent(id)}`, { headers: headers(), signal: AbortSignal.timeout(10_000) });
    if (res.status === 429) throw new LatencyError("Worldwide check limit reached. Try again in a little while.", 429);
    if (!res.ok) throw new LatencyError(await readError(res), res.status >= 500 ? 502 : 400);
    latest = (await res.json()) as Measurement;
  }

  const report = buildLatencyReport(host, (latest.results ?? []) as Parameters<typeof buildLatencyReport>[1]);
  if (report.checked === 0) throw new LatencyError("No probes responded from those countries. Try again shortly.");
  return report;
}
