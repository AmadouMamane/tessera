/**
 * Locale-routing configuration shared by middleware, navigation helpers, and
 * the server-side request loader.
 *
 * We treat all three supported languages as first-class — the URL always
 * carries the locale segment (`/fr`, `/de`, `/en`) so that links remain
 * shareable and search engines can index per-language pages.
 */
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "de", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<Locale, { native: string; short: string }> = {
  fr: { native: "Français", short: "FR" },
  de: { native: "Deutsch", short: "DE" },
  en: { native: "English", short: "EN" },
};
