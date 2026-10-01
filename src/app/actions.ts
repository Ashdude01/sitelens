"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { refresh, updateTag } from "next/cache";
import { reportTag } from "@/server/cache/isr";
import { InputError, normalizeTarget, getOrScanReport, RateLimitError } from "@/server/services/report-service";
import { clientKeyFromHeaders } from "@/server/services/client-key";
import { translateError } from "@/i18n/errors";

export type LookupState = { error: string | null };

/** Search form: validate and go to the canonical report URL. */
export async function lookupAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  let key: string;
  try {
    key = normalizeTarget(formData.get("q")).key;
  } catch (e) {
    const message = e instanceof InputError ? e.message : "That does not look like a valid domain.";
    return { error: await translateError(message) };
  }
  redirect({ href: `/site/${encodeURIComponent(key)}`, locale: await getLocale() });
  return { error: null };
}

export type RescanState = { error: string | null; done: boolean };

/** Force a fresh scan of a domain, then refresh the current page. */
export async function rescanAction(domain: string): Promise<RescanState> {
  try {
    const clientKey = clientKeyFromHeaders(await headers());
    const { stale, report } = await getOrScanReport(domain, { force: true, clientKey });
    if (stale) return { error: await translateError("Rate limit reached. Showing the last saved report."), done: false };
    updateTag(reportTag(report.domain));
  } catch (e) {
    if (e instanceof InputError || e instanceof RateLimitError) return { error: await translateError(e.message), done: false };
    console.error("rescan failed", e);
    return { error: await translateError("Scan failed. The site may be down or blocking us."), done: false };
  }
  refresh();
  return { error: null, done: true };
}
