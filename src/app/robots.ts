import type { MetadataRoute } from "next";
import { config } from "@/server/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: `${config.publicUrl}/sitemap.xml`,
  };
}
