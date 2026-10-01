import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_CODES, LOCALE_COOKIE } from "./locales";

export const routing = defineRouting({
  locales: LOCALE_CODES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeDetection: true,
  alternateLinks: true,
  localeCookie: {
    name: LOCALE_COOKIE,
    sameSite: "lax",
  },
});
