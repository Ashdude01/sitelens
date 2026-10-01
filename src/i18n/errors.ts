import { getTranslations } from "next-intl/server";

const EXACT: Record<string, string> = {
  "Please enter a domain.": "empty",
  "That input is too long.": "long",
  "That does not look like a valid domain.": "invalid",
  "Only http(s) sites can be scanned.": "protocol",
  "Please enter a domain name, not an IP address.": "ip",
  "Custom ports are not supported.": "port",
  "That does not look like a public domain name.": "public",
  "Rate limit reached. Showing the last saved report.": "rateSaved",
  "Scan failed. The site may be down or blocking us.": "scan",
  "The scan failed. The site may be down, very slow, or blocking bots.": "scanSlow",
  "Worldwide check limit reached for now. Please try again later.": "latencyLimit",
  "Worldwide check is not configured.": "latencyOff",
  "No probes are online in those countries right now.": "latencyOffline",
  "Worldwide check limit reached. Try again in a little while.": "latencySoon",
  "Globalping did not return a measurement id.": "latencyId",
  "No probes responded from those countries. Try again shortly.": "latencyNone",
  "Could not check worldwide reach. Please try again.": "latencyFail",
  "PageSpeed limit reached for now. Please try again later.": "psiLimit",
  "Could not reach Google PageSpeed. Please try again.": "psiFail",
  "PageSpeed failed": "psiFail",
  "Worldwide check failed": "latencyFail",
  "Google PageSpeed quota reached. Add a PAGESPEED_API_KEY or try again later.": "psiQuota",
  "Preview limit reached for now.": "previewLimit",
};

/** Map a known English server message onto the active locale. Unknown text is returned as-is. */
export async function translateError(message: string): Promise<string> {
  const t = await getTranslations("errors");
  const rate = message.match(/^Rate limit reached: (\d+) new scans per hour/);
  if (rate) return t("rate", { n: rate[1] });
  const http = message.match(/^(Globalping|PageSpeed) request failed \(HTTP (\d+)\)/);
  if (http) return t(http[1] === "Globalping" ? "latencyHttp" : "psiHttp", { status: http[2] });
  const key = EXACT[message];
  return key ? t(key) : message;
}
