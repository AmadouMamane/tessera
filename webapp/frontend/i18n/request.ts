/**
 * Server-side message loader consumed by `next-intl/plugin`.
 *
 * The plugin invokes this on every server render with the negotiated locale;
 * we read the matching JSON catalogue from `messages/<locale>.json`.
 */
import { getRequestConfig } from "next-intl/server";

import { type Locale, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? (requested as Locale)
      : routing.defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: "Europe/Paris",
    now: new Date(),
  };
});
