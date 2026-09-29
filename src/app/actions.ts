"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { InputError, normalizeTarget, getOrScanReport, RateLimitError } from "@/server/services/report-service";
import { clientKeyFromHeaders } from "@/server/services/client-key";

export type LookupState = { error: string | null };

/** Search form: validate and go to the canonical report URL. */
export async function lookupAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  let key: string;
  try {
    key = normalizeTarget(formData.get("q")).key;
  } catch (e) {
    return { error: e instanceof InputError ? e.message : "That does not look like a valid domain." };
  }
  redirect(`/site/${encodeURIComponent(key)}`);
}

export type RescanState = { error: string | null; done: boolean };

/** Force a fresh scan of a domain, then refresh the current page. */
export async function rescanAction(domain: string): Promise<RescanState> {
  try {
    const clientKey = clientKeyFromHeaders(await headers());
    const { stale } = await getOrScanReport(domain, { force: true, clientKey });
    if (stale) return { error: "Rate limit reached. Showing the last saved report.", done: false };
  } catch (e) {
    if (e instanceof InputError || e instanceof RateLimitError) return { error: e.message, done: false };
    console.error("rescan failed", e);
    return { error: "Scan failed. The site may be down or blocking us.", done: false };
  }
  refresh();
  return { error: null, done: true };
}
