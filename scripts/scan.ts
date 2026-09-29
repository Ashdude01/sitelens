// Scan from the command line:  npm run scan -- example.com [--json] [--force]
import "./_env";
import { getOrScanReport } from "@/server/services/report-service";
import { closeBrowser } from "@/server/scanner/browser";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
if (!input) {
  console.log("Usage: npm run scan -- example.com [--json] [--force]");
  process.exit(1);
}

try {
  const { report: r, fromCache } = await getOrScanReport(input, { force: args.includes("--force") });
  if (args.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`\n${r.domain}  (${fromCache ? "cached" : `scanned in ${r.scanMs} ms`}, mode: ${r.mode})`);
    console.log(r.fetch.ok ? `HTTP ${r.fetch.status} -> ${r.fetch.finalUrl}` : `Fetch failed: ${r.fetch.error ?? r.fetch.status}`);
    if (r.site?.title) console.log(`Title: ${r.site.title}`);
    console.log(`\nTechnologies (${r.technologies.length}):`);
    for (const t of r.technologies)
      console.log(`  - ${t.name}${t.version ? ` ${t.version}` : ""}  [${t.categories.join(", ")}]  ${t.confidence}%  <- ${t.evidence[0]}`);
    const tr = r.traffic;
    console.log("\nTraffic:");
    if (tr.verified) console.log(`  VERIFIED: ${tr.verified.monthlyVisits.toLocaleString()} visits/month`);
    else if (tr.estimate) {
      const e = tr.estimate;
      console.log(`  ${e.monthlyVisits.low.toLocaleString()} – ${e.monthlyVisits.high.toLocaleString()} visits/month (${e.confidence}${e.calibrated ? "" : ", uncalibrated"})`);
      for (const s of tr.ranks) console.log(`    ${s.source} rank ${s.rank.toLocaleString()}`);
    } else console.log(`  Not enough data (${tr.verdict}). Import lists: npm run import:ranks -- umbrella`);
    for (const n of r.notes) console.log(`\nNote: ${n}`);
  }
} catch (e) {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await closeBrowser();
}
