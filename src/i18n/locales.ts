export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALES = [
  { code: "en", intl: "en-US", label: "English", region: "United States", flag: "us" },
  { code: "de", intl: "de-DE", label: "Deutsch", region: "Germany", flag: "de" },
  { code: "fr", intl: "fr-FR", label: "Français", region: "France", flag: "fr" },
  { code: "es", intl: "es-ES", label: "Español", region: "Spain", flag: "es" },
  { code: "ja", intl: "ja-JP", label: "日本語", region: "Japan", flag: "jp" },
  { code: "nl", intl: "nl-NL", label: "Nederlands", region: "Netherlands", flag: "nl" },
  { code: "sv", intl: "sv-SE", label: "Svenska", region: "Sweden", flag: "se" },
  { code: "it", intl: "it-IT", label: "Italiano", region: "Italy", flag: "it" },
  { code: "ru", intl: "ru-RU", label: "Русский", region: "Russia", flag: "ru" },
  { code: "id", intl: "id-ID", label: "Bahasa Indonesia", region: "Indonesia", flag: "id" },
  { code: "ko", intl: "ko-KR", label: "한국어", region: "South Korea", flag: "kr" },
  { code: "tr", intl: "tr-TR", label: "Türkçe", region: "Turkey", flag: "tr" },
  { code: "ar", intl: "ar-AE", label: "العربية", region: "UAE", flag: "ae" },
] as const;

export const LOCALE_CODES = ["en", "de", "fr", "es", "ja", "nl", "sv", "it", "ru", "id", "ko", "tr", "ar"] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

const codes = new Set<string>(LOCALES.map((l) => l.code));

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && codes.has(value);
}

export function localeMeta(code: string) {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
