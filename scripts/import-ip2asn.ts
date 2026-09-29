// IP -> ASN / hosting provider (free, public domain) from https://iptoasn.com
//   npm run import:ip2asn
//   npm run import:ip2asn -- --file ip2asn-v4.tsv.gz
import "./_env";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { ipToInt, replaceIp2Asn } from "@/server/repositories/ip2asn";

const URL_V4 = "https://iptoasn.com/data/ip2asn-v4.tsv.gz";
const i = process.argv.indexOf("--file");
const file = i >= 0 ? process.argv[i + 1] : null;

let buf: Buffer;
if (file) buf = fs.readFileSync(file);
else {
  console.log(`Downloading ${URL_V4} …`);
  const res = await fetch(URL_V4);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  buf = Buffer.from(await res.arrayBuffer());
}
if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);

const rows = [];
for (const line of buf.toString("utf8").split("\n")) {
  const [s, e, asn, cc, org] = line.split("\t");
  if (!s || !e || !/^\d+\.\d+\.\d+\.\d+$/.test(s)) continue;
  rows.push({ start: ipToInt(s), end: ipToInt(e), asn: Number(asn) || 0, country: cc || null, org: org?.trim() || null });
}
await replaceIp2Asn(rows);
console.log(`Imported ${rows.length.toLocaleString()} IP ranges`);
