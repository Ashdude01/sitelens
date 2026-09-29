// Import popularity lists into the database.
//
//   npm run import:ranks -- umbrella                    Cisco Umbrella top 1M (downloads, daily, free)
//   npm run import:ranks -- majestic                    Majestic Million (downloads, daily, CC BY 3.0)
//   npm run import:ranks -- crux --file crux.csv        "origin,rank" from BigQuery (scripts/crux-bigquery.sql)
//   npm run import:ranks -- crux-country --file cc.csv  "country_code,origin,rank"
//   npm run import:ranks -- custom --name mylist --file list.csv   "rank,domain"
//   Add --file to umbrella/majestic to import a file you already downloaded (.csv or .zip).
//
// LICENCE WARNING: Cloudflare Radar and the default Tranco list are non-commercial (CC BY-NC).
import "./_env";
import fs from "node:fs";
import readline from "node:readline";
import { Readable } from "node:stream";
import { unzipSync } from "fflate";
import { replaceCruxCountry, replaceSource } from "@/server/repositories/ranks";

const args = process.argv.slice(2);
const kind = args[0];
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const DOWNLOADS: Record<string, string> = {
  umbrella: "https://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip",
  majestic: "https://downloads.majestic.com/majestic_million.csv",
};

export function normDomain(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

async function openLines(): Promise<AsyncIterable<string>> {
  const file = opt("file");
  let buf: Buffer;
  if (file) buf = fs.readFileSync(file);
  else if (DOWNLOADS[kind]) {
    console.log(`Downloading ${DOWNLOADS[kind]} …`);
    const res = await fetch(DOWNLOADS[kind]);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else throw new Error("Please pass --file <path>");
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(new Uint8Array(buf));
    const name = Object.keys(files).find((n) => n.endsWith(".csv")) ?? Object.keys(files)[0];
    buf = Buffer.from(files[name]);
  }
  return readline.createInterface({ input: Readable.from(buf), crlfDelay: Infinity });
}

const splitCsv = (line: string) => line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
const progress = (n: number) => {
  if (n % 200_000 < 3000) process.stdout.write(`  ${n.toLocaleString()} rows\r`);
};

async function* rankRows(lines: AsyncIterable<string>) {
  let first = true;
  for await (const line of lines) {
    if (!line) continue;
    const c = splitCsv(line);
    if (first) {
      first = false;
      const isHeader = kind === "crux" ? !/^\d+$/.test(c[1] ?? "") : !/^\d+$/.test(c[0] ?? "");
      if (isHeader) continue;
    }
    let domain: string;
    let rank: number;
    let extra: string | null = null;
    if (kind === "majestic") {
      rank = Number(c[0]);
      domain = c[2];
      extra = JSON.stringify({ refSubNets: Number(c[4]) || null });
    } else if (kind === "crux") {
      domain = c[0];
      rank = Number(c[1]);
    } else {
      rank = Number(c[0]);
      domain = c[1];
    }
    domain = normDomain(domain);
    if (domain && rank) yield { domain, rank, extra };
  }
}

async function* countryRows(lines: AsyncIterable<string>) {
  let first = true;
  for await (const line of lines) {
    if (!line) continue;
    const [country, origin, rank] = splitCsv(line);
    if (first) {
      first = false;
      if (!/^\d+$/.test(rank ?? "")) continue;
    }
    const domain = normDomain(origin);
    if (domain && Number(rank)) yield { domain, country: country.toUpperCase(), rank: Number(rank) };
  }
}

async function main() {
  if (!kind) {
    console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(0, 11).join("\n"));
    process.exit(1);
  }
  const t0 = Date.now();
  const lines = await openLines();
  if (kind === "crux-country") {
    const n = await replaceCruxCountry(countryRows(lines), progress);
    console.log(`Imported ${n.toLocaleString()} crux-country rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return;
  }
  const source = kind === "custom" ? opt("name") : kind;
  if (!source) throw new Error("custom lists need --name");
  if (/^(tranco|radar|cloudflare)/i.test(source)) console.warn("WARNING: this list may be licensed for non-commercial use only.");
  const n = await replaceSource(source, rankRows(lines), progress);
  console.log(`Imported ${n.toLocaleString()} rows into "${source}" in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
