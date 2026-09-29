// Refresh technology fingerprints from https://github.com/enthec/webappanalyzer (GPL-3.0). Run weekly/monthly.
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.FINGERPRINTS_BASE ?? "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src";
const DIR = path.join(process.cwd(), "data", "fingerprints");
fs.mkdirSync(DIR, { recursive: true });

const files: [string, string][] = [["categories.json", `${BASE}/categories.json`]];
for (const c of "_abcdefghijklmnopqrstuvwxyz") files.push([`technologies_${c}.json`, `${BASE}/technologies/${c}.json`]);

let total = 0;
for (const [name, url] of files) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  const json = JSON.parse(text);
  fs.writeFileSync(path.join(DIR, name), text);
  if (name.startsWith("technologies_")) total += Object.keys(json).length;
}
console.log(`Updated ${files.length} files, ${total.toLocaleString()} technologies.`);
