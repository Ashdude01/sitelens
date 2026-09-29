import { PageSpeedPanel } from "@/components/pagespeed/pagespeed-panel";
import { ReachabilityPanel } from "./reachability-panel";
import { SitePreview } from "./site-preview";

/** Sticky report column: homepage, worldwide reach, then lab scores. */
export function ReportRail({ domain }: { domain: string }) {
  return (
    <div className="space-y-4">
      <SitePreview domain={domain} />
      <ReachabilityPanel domain={domain} />
      <PageSpeedPanel domain={domain} />
    </div>
  );
}
