import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

/** Path without a locale prefix, always starting with `/` (`/` for the home page). */
export function pageAlternates(pathname: string, locale: Locale): Metadata["alternates"] {
  const suffix = pathname === "/" ? "" : pathname;
  const languages: Record<string, string> = {};
  for (const item of LOCALES) languages[item.intl] = `/${item.code}${suffix}`;
  languages["x-default"] = `/${DEFAULT_LOCALE}${suffix}`;
  return {
    canonical: `/${locale}${suffix}`,
    languages,
  };
}
