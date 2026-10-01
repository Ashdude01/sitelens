import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

export function proxy(request: NextRequest) {
  return handleI18n(request);
}

export const config = {
  // Skip APIs, sitemaps, and real files. Domain paths like /site/yahoo.com must still match.
  matcher: ["/((?!api/|sitemaps/|_next/|_vercel|badge/|tech-icons/|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|txt|xml|js|css|map|woff2?)$).*)"],
};
