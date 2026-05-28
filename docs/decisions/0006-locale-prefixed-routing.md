# 6. Locale-prefixed routing in the Next.js dashboard

Date: 2026-05-28

## Status

Accepted

## Context

CLAUDE.md's canonical tree describes the dashboard pages as living directly under `webapp/frontend/app/`:

```
app/
├── page.tsx
├── audit/page.tsx
└── eval/page.tsx
```

This implicit assumption is single-locale: one tree, one URL per page, language handled inside the page (cookie, header, or in-page switcher with no URL change). It works for a monolingual product but fights against three of Tessera's first-page commitments.

Tessera is positioned explicitly as a **multilingual** (FR / DE / EN) agent for the European retail market. The agent corpus, the prompt bundles, and the failure-case harness are all language-partitioned, and the README's tagline leans on that partition. The dashboard is the public face of the project: when a recruiter or a regulator clicks a link to a screenshot, the URL that lands in their browser is part of the story.

A single-locale URL tree has four concrete problems for this project:

1. **Shareable links lose their language.** A French regulator who pastes `https://tessera.example/audit` into a German colleague's chat gets the German UI (or whatever cookie/header negotiation decides). The intent of the original sender is silently lost. With `/fr/audit` versus `/de/audit`, the language travels with the link.

2. **SEO and accessibility tooling expect a `lang` attribute that matches the URL.** Search engines, screen-reader configuration, browser translation prompts, and accessibility audits all use the `<html lang>` attribute combined with the URL. Mixing locales on a single path is a known accessibility anti-pattern.

3. **Server rendering and caching are simpler when locale is a URL segment.** Next.js 15's Server Components want to know the locale at request time. With a URL prefix, the negotiation is one read of `params.locale`; without one, the layout has to inspect cookies and headers on every render, and caching gets fragmented per-user.

4. **The non-regression harness already partitions failures by language.** The dashboard mirroring that partition in the URL keeps `eval/reports/latest.json?lang=de`-style deep links sane, and aligns with how the scorecard renders.

The cost of the change is two-fold. First, the file tree under `app/` is replaced by `app/[locale]/`, which means every page sits one directory deeper. Second, link construction across the app has to go through a locale-aware helper (`next-intl`'s `Link`, `redirect`, `usePathname`, `useRouter`) instead of `next/navigation` directly. Both costs are paid once at scaffolding and never again.

The `next-intl` library (v3.25+) is the de facto standard for this pattern in the Next.js 15 era, and `localePrefix: "always"` is the configuration that gives the strongest guarantees (every page has a locale segment; no implicit defaults that drift away from the URL).

## Decision

The dashboard uses **locale-prefixed routing** with `next-intl`. Every reachable page lives under `app/[locale]/`, the supported locales are exactly `fr` / `de` / `en` (matching the agent's `LanguageCode` enum), and `localePrefix` is `always` — even the default locale gets a segment.

Concretely, the canonical tree section of CLAUDE.md is superseded for the frontend portion: the actual layout is

```
app/
├── layout.tsx              # minimal pass-through
├── not-found.tsx
└── [locale]/
    ├── layout.tsx          # owns <html lang>, font loading, providers
    ├── page.tsx            # redirects to /{locale}/chat
    ├── chat/page.tsx
    ├── audit/page.tsx
    ├── eval/page.tsx
    └── health/page.tsx
```

Locale-aware navigation primitives live in `i18n/navigation.ts`; pages and components import `Link`, `redirect`, `usePathname`, and `useRouter` from that module rather than from `next/navigation`. Message catalogues live in `messages/{fr,de,en}.json`. The middleware at `webapp/frontend/middleware.ts` performs locale negotiation and redirects unprefixed URLs.

The agent's `LanguageCode` enum (Python) and the dashboard's `Locale` zod schema (TypeScript) remain the two ends of the same contract: any new language requires a coordinated change to both, and the failure-case harness in `eval/failures/` is the source of truth for what each language must cover.

## Consequences

Every URL in the dashboard now carries its language, which preserves intent across shared links, satisfies the SEO and accessibility expectations of European regulators, and matches the agent's own language partitioning end-to-end. The cost is one layer of directory nesting and one indirect import for navigation; both are absorbed once and do not slow day-to-day work. The dashboard portion of the canonical tree in CLAUDE.md is now considered superseded by this ADR, and contributors editing the frontend should treat `app/[locale]/` as the canonical layout going forward. The agent and infrastructure portions of CLAUDE.md remain authoritative and untouched.
