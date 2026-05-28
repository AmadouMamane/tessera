# Multilingual

Tessera serves three languages — French, German, English — for European retail
banking. Multilinguality touches every layer: language detection on the router,
per-language prompt bundles, per-language intent cues, the corpus, retrieval, and
evaluation. This document is the reference for how those pieces fit together.

## Language detection

Language detection lives in the router node (`src/tessera/agent/router.py`) and
is deliberately **rule-based and offline**, for two reasons stated in the module:

1. The router runs on every turn; an LLM call here would dominate latency.
2. The non-regression harness needs deterministic replays — the same input must
   always yield the same detected language.

`detect_language` tokenises the input with a Unicode-aware regex (covering FR/DE
accented characters and the German ß/ẞ), then scores the text against three
small stopword lexicons (`_STOPWORDS` for FR / DE / EN). The lexicons are chosen
so that overlap between languages is minimal — `le/la/les` only in FR, `the`
only in EN, `der/die/das` only in DE — and each includes domain stopwords
(`compte`/`konto`/`account`, `virement`/`überweisung`/`transfer`, etc.).

The result is a `LanguageDetectionResult` with `language`, `confidence`, and
`fallback_used`. Confidence is `score[best] / total_stopword_hits`. When
confidence is below `min_confidence` (default **0.35**), or no tokens / no
stopword hits are found, detection falls back to the configured default language
(`Settings.default_language`, **FR**) and sets `fallback_used=True`.

The `run` entry point respects a pinned language: if the caller has set
`language_confidence` above `_PINNED_CONFIDENCE` (0.99), detection is skipped and
the pinned value is kept. This is what lets tests and harness replays force a
specific language deterministically.

## Prompt architecture

Prompts are never hardcoded in Python. Each language has one YAML bundle under
`src/tessera/agent/prompts/{fr,de,en}.yaml`. Keys map 1:1 with the node that
consumes them, and templates use `str.format()` placeholders. The FR bundle
currently defines:

- `system` — agent persona and guardrails (Crédit Aurore support, always answer
  in clear language, never give personalised investment advice, cite RGPD / CNIL
  / DORA when relevant, never fabricate a reference).
- `planner` — lists the user's intents and which workers to activate, given
  `{user_input}`.
- `reviewer` — three-criteria evaluation (grounding, coverage, safety) of a
  `{draft}`.
- `reporter` — assembles `{draft}{citations}` into the final answer.
- `escalation` — human-handoff acknowledgement carrying `{ticket_reference}`.
- `decline` — refusal message pointing the user to a human advisor.

The brief's `system`, `reporter`, and (future-leaning) `planner` keys are all
present; `planner` is already wired in FR. The DE and EN bundles mirror the same
key set so the graph is language-agnostic above the prompt layer.

## Intent classification per language

Intent classification is regex-cue-based and per-language, so it tolerates the
language-specific spelling of regulatory and product terms. It supports
multi-intent inputs — a single message can route to several workers (e.g.
product lookup + regulation lookup). The cue tables are language-scoped, which is
why the same concept appears under different surface forms:

- GDPR cues: `rgpd` in FR, `dsgvo` in DE, `gdpr` in EN.
- Product / account / transaction cues likewise differ per locale (`virement` /
  `überweisung` / `transfer`, etc.).

Keeping the cues per-language avoids cross-lingual false positives and keeps the
classifier deterministic, matching the same offline-and-replayable discipline as
the language detector.

## Corpus distribution

The corpus under `src/tessera/corpus/data/` has two kinds of content:

- **Crédit Aurore product docs** — three bundles, one per language
  (`credit_aurore_fr.json`, `_de.json`, `_en.json`), roughly ~13 documents each.
  These are stored in their own language and retrieved with the language filter
  active.
- **Regulatory corpora** — four bundles: `regulations_gdpr.json`,
  `regulations_cnil.json`, `regulations_bafin.json`, `regulations_dora.json`.
  These are **stored in English** (`language="en"`) and searched cross-lingually
  (see below), so a FR or DE user still reaches them.

## Cross-lingual retrieval

The store (`src/tessera/retrieval/store.py`) exposes `knn_search` with a
`language: LanguageCode | None` parameter:

- When `language` is set, the SQL adds `AND language = %s`, so product lookups
  stay within the conversation's language.
- When `language is None`, the language filter is **omitted** and the search
  spans all stored languages.

Regulation documents are stored as `language="en"`. The `regulation_lookup`
worker calls `knn_search` with `language=None`, which bypasses the language
filter and lets a French- or German-speaking user retrieve the English-stored EU
texts. The embedding model carries enough cross-lingual signal that a FR/DE
query still finds the relevant EN regulatory chunk; the agent then answers in the
user's language while citing the underlying text.

## Translation pipeline

Product content is authored once and translated for the other locales by
`src/tessera/corpus/translator.py`. The translator produces the DE/EN variants
of the Crédit Aurore product docs so the three product bundles stay aligned in
structure and coverage. Regulatory corpora are **not** machine-translated — they
are kept in their authoritative English form and reached cross-lingually, which
avoids introducing translation drift into legally sensitive text.

## Known gaps

These are tracked openly rather than hidden:

- **BaFin corpus is smaller than the CNIL corpus.** DE regulatory coverage is
  thinner than FR, which lowers grounding quality on German regulatory
  questions.
- **DE hallucination on regulatory facts runs ~15% higher** than FR/EN. This is
  asserted and monitored by
  `tests/integration/test_agent_e2e.py::test_de_escalation_threshold`, which
  checks that the lower DE grounding pushes borderline DE turns into escalation
  rather than into a confident-but-wrong answer.

## Evaluation per language

The eval runner (`eval/runner.py`) accepts a `--lang` flag to scope a run to one
language. Failure cases under `eval/failures/NN_*.json` declare a `languages`
array (validated by `eval/failures/_schema.json`, enum `["fr","de","en"]`), and
each case carries per-language `prompts` with a `user` string (optionally a
`system_override`). A run with `--lang de` executes only the German prompt
variant of each case whose `languages` array includes `de`. This makes per-
language regression coverage explicit and lets the harness surface, for example,
the DE-specific weaknesses noted above.
