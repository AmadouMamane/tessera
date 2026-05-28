# Changelog

All notable changes to Tessera are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.3.0] — 2026-05-29

### Added
- Non-regression harness: 35 new failure cases (06–40) covering prompt injection,
  PII leakage, hallucination, overconfidence, citation fabrication, tool misuse,
  policy violation, regulatory misstatement, language mixing, and escalation failure.
  All 40 cases validated against `eval/failures/_schema.json`.
- Architecture diagrams: `docs/images/architecture.svg`, `agent_graph.svg`,
  `eval_flow.svg` — accurate LangGraph topology and GCP deployment overview,
  standalone SVG with no external dependencies.
- Terraform `outputs.tf`; completed `cloud_run.tf`, `postgres.tf`, `secrets.tf`,
  `observability.tf`, `variables.tf`, `main.tf` — pgvector flag on Cloud SQL,
  Cloud SQL Unix-socket sidecar, Cloud Monitoring dashboard (6 tiles), audit-log
  GCS sink, error-rate alert policy.
- GitHub files: `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`, `dependabot.yml`,
  `bug_report.md`, `feature_request.md` issue templates.

## [0.2.0] — 2026-05-29

### Fixed
- **Reporter synthesis** (`src/tessera/agent/reporter.py`): reporter now always
  calls the LLM when retrieved documents are present, injecting any tool-result
  draft as additional context. Previously, a non-empty `draft_response` short-
  circuited synthesis, causing multi-intent queries (e.g., RGPD + card block) to
  return only the tool result and ignore regulation documents.
- **Reviewer grounding score** (`src/tessera/agent/reviewer.py`): tool-result
  drafts (account balance, loan simulation) are intrinsically grounded and now
  score 0.9 regardless of lexical overlap with retrieved documents. Previously,
  zero lexical overlap with regulation docs triggered a 0.0 grounding score and
  spurious escalation.
- **Multi-intent planning** (`src/tessera/agent/planner.py`): added
  `classify_all_intents()` and updated `plan_for()` to collect all matching
  intents instead of returning on first match. Queries like
  *"que dit le RGPD sur le vol de carte"* now activate both `ACCOUNT_LOOKUP`
  and `REGULATION_LOOKUP` workers in the same fan-out.
- **Audit journal** (`src/tessera/guard/audit.py`, `src/tessera/settings.py`):
  added `"file"` sink writing to `/tmp/tessera/audit.log`. Default sink changed
  from `"stdout"` to `"file"` so the dashboard's `/audit` endpoint has entries
  to read. Escalation worker now passes `language.value` (str) instead of the
  `LanguageCode` enum to `ticket_escalate`, fixing a Pydantic validation error.

## [0.1.0] — 2026-05-28 and 2026-05-29

### Added
- Initial project scaffold: `src/tessera/` package layout (ADR 0004), LangGraph
  agent (`graph.py`, `planner.py`, `reviewer.py`, `reporter.py`, `router.py`,
  `state.py`), five worker nodes, five LLM-callable tools.
- `pgvector` retrieval layer: `store.py`, `embeddings.py`, `chunking.py`,
  `reranking.py`, `hybrid_search.py` with cross-lingual `language=None` path
  for regulation documents stored as `language="en"`.
- EU regulatory corpus: GDPR (10 docs), CNIL (8), BaFin (8), DORA (12);
  Crédit Aurore product corpus: 13 docs × 3 languages (FR/DE/EN).
- `mcp-firewall` adapter (`guard/adapter.py`, `guard/policy.yaml`,
  `guard/audit.py`, `guard/decisions.py`) with per-tool allow/deny rules and
  PII argument pattern matching.
- LLM router: frontier path (Vertex AI Gemini) and on-premises path
  (Llama 3.3 70B via Ollama on Apple Silicon); automatic fallback when Vertex AI
  credentials are absent (`TESSERA_LLM_PROFILE=on_prem`).
- FastAPI application (`api/main.py`): SSE `/chat` endpoint, read-only `/audit`
  endpoint, `/healthz` + `/readyz` probes, bearer-token auth middleware,
  request-ID propagation.
- Next.js dashboard (`webapp/frontend`): chat room with SSE streaming, audit
  journal table, eval scorecard view; locale-prefixed routes (`/fr/`, `/de/`,
  `/en/`); route handler for SSE bypassing Next.js rewrite buffering.
- GitHub Actions CI: `ci.yml` (lint, type-check, unit tests), `eval.yml`
  (regression harness gate), `deploy.yml` (Cloud Run deployment), `security.yml`
  (CodeQL + dependency scanning).
- `docker-compose.yml`: Postgres 16 + pgvector service for local development.
- `.devcontainer/devcontainer.json`: reproducible dev container (Python 3.12,
  Node 22, uv, Docker-in-Docker).
- ADRs 0001–0006: architectural decisions log.
- 5 initial failure cases (01–05): prompt injection, PII leak, hallucination,
  overconfident action, citation hallucination.

### Fixed
- **LangGraph concurrent state updates**: `error: NotRequired[str]` raised
  `INVALID_CONCURRENT_GRAPH_UPDATE` when two workers wrote concurrently. Changed
  to `errors: Annotated[list[str], operator.add]` with an additive reducer.
- **LangGraph recursion limit**: `escalation_worker` had edges to both `reviewer`
  and `END`, causing an infinite review loop. Excluded `ESCALATION` from the
  worker → reviewer loop in `graph.py`; escalation routes directly to `END`.
- **psycopg JSONB serialisation**: metadata `dict` could not be adapted to JSONB
  automatically. Fixed by calling `json.dumps(record.metadata)` before insertion.
- **SSE buffering through Next.js rewrites**: `rewrites()` in `next.config.mjs`
  buffers the full response before forwarding, breaking SSE for long LLM calls.
  Replaced with a Node.js route handler (`app/api/chat/route.ts`) that pipes the
  upstream body directly.

[Unreleased]: https://github.com/AmadouMamane/tessera/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/AmadouMamane/tessera/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/AmadouMamane/tessera/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AmadouMamane/tessera/releases/tag/v0.1.0
