// After `next build`, copy the static assets the standalone server needs (Next.js doesn't copy these itself).
import fs from "node:fs";

const out = ".next/standalone";
if (fs.existsSync(out)) {
  fs.cpSync(".next/static", `${out}/.next/static`, { recursive: true });
  if (fs.existsSync("public")) fs.cpSync("public", `${out}/public`, { recursive: true });
  fs.cpSync("drizzle", `${out}/drizzle`, { recursive: true });
  console.log("postbuild: copied static assets, public/ and drizzle/ into .next/standalone");
}
