/**
 * Server-side message loader consumed by `next-intl/plugin`.
 *
 * The plugin invokes this on every server render with the negotiated locale;
 * we read the matching JSON catalogue from `messages/<locale>.json`.
 */
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: "Europe/Paris",
    now: new Date(),
  };
});
