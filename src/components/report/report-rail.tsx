import { PageSpeedPanel } from "@/components/pagespeed/pagespeed-panel";
import { ReachabilityPanel } from "./reachability-panel";

/** Sticky report column: lab scores, then worldwide reach. */
export function ReportRail({ domain }: { domain: string }) {
  return (
    <div className="space-y-4">
      <PageSpeedPanel domain={domain} />
      <ReachabilityPanel domain={domain} />
    </div>
  );
}
