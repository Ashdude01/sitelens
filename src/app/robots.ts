import type { MetadataRoute } from "next";
import { config } from "@/server/config";

export default function robots(): MetadataRoute.Robots {
  const base = config.publicUrl.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
