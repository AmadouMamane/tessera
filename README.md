<div align="center">

# Tessera

**A multilingual (FR / DE / EN) banking support LLM agent for the European retail market.**

Grounded in EU regulatory corpora (DORA, CNIL, BaFin, GDPR).
Guarded at runtime by [`mcp-firewall`](https://github.com/ressl/mcp-firewall).
Validated by a non-regression harness over forty publicly documented agent failures.
Deployed on Google Cloud Run with an alternate on-premises mode running Llama 3.3 70B locally on Apple Silicon.

[![CI](https://github.com/AmadouMamane/tessera/actions/workflows/ci.yml/badge.svg)](https://github.com/AmadouMamane/tessera/actions/workflows/ci.yml)
[![Eval](https://github.com/AmadouMamane/tessera/actions/workflows/eval.yml/badge.svg)](https://github.com/AmadouMamane/tessera/actions/workflows/eval.yml)
[![Security](https://github.com/AmadouMamane/tessera/actions/workflows/security.yml/badge.svg)](https://github.com/AmadouMamane/tessera/actions/workflows/security.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/)
[![mypy: strict](https://img.shields.io/badge/mypy-strict-2A6DB2.svg)](https://mypy.readthedocs.io/)
[![ruff](https://img.shields.io/badge/ruff-checked-261230.svg)](https://docs.astral.sh/ruff/)

</div>

---

## Honest positioning

**Tessera is neither a new firewall, nor a new test framework, nor a new safety methodology.**

- The firewall layer is [`mcp-firewall`](https://github.com/ressl/mcp-firewall), consumed as a pinned dependency.
- The non-regression harness draws its patterns from [AgentAssay](https://github.com/agentassay) and [Promptfoo](https://github.com/promptfoo/promptfoo).
- The audit-trail approach is inspired by [AEGIS](https://arxiv.org/) — verify the specific citation against [`docs/differentiation.md`](./docs/differentiation.md) before reuse.

What Tessera contributes is a **complete, opinionated, deployed assembly** of the four quality layers — runtime guard, offline regression harness, structured audit trail, human-in-the-loop escalation — wired end to end for **one specific use case**: European retail banking customer support in three languages with explicit regulatory grounding.

**The value is in the assembly and the EU business semantics, not technical invention.** Any framing of this project as a "new framework" is rejected.

### Inspirations cited explicitly

| Project / Paper       | Role                                       | Status                                |
| --------------------- | ------------------------------------------ | ------------------------------------- |
| `mcp-firewall` (ressl)| Runtime guardrail layer                    | Dependency (pinned)                   |
| AEGIS                 | Audit-trail design pattern                 | Inspiration — citation in differentiation.md |
| DFAH                  | Failure taxonomy for agent harnesses       | Inspiration — citation in differentiation.md |
| AgentAssay            | Regression-test scaffolding patterns       | Inspiration                           |
| Promptfoo             | YAML-driven prompt evaluation              | Inspiration / interop                 |
| STING                 | Tool-use stress testing                    | Inspiration                           |
| Bernstein             | Multilingual evaluation framing            | Inspiration                           |
| ALTK                  | Agent-level toolkit comparisons            | Inspiration                           |

> All academic citations in [`docs/differentiation.md`](./docs/differentiation.md) must be verified against the actual papers before merge. We do not cite what we have not read.

### Upstream contribution commitment

At least one upstream pull request on [`mcp-firewall`](https://github.com/ressl/mcp-firewall) **must** land within the project window. This is what defends the "reuse, don't reinvent" positioning. The PR link will appear here when merged.

---

## What's working, what isn't

This section is the source of truth, not a marketing surface. It is updated each time `eval.yml` runs.

### Tests that pass

| Layer                | Suite                              | Status |
| -------------------- | ---------------------------------- | ------ |
| Unit — agent graph   | `tests/unit/test_agent_graph.py`   | ✅ |
| Unit — retrieval     | `tests/unit/test_retrieval.py`     | ✅ |
| Unit — guard         | `tests/unit/test_guard.py`         | ✅ |
| Unit — LLM router    | `tests/unit/test_llm_router.py`    | ✅ |
| Unit — corpus gen    | `tests/unit/test_corpus_generator.py` | ✅ |

### Tests that fail (and why)

> **Failures are documented, not hidden.** If you find a green checkmark in this section without a tracked issue, that is a bug — file it.

| Suite                              | Failure                                   | Root cause                                                                                                       | Tracked in |
| ---------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| `tests/integration/test_agent_e2e.py::test_de_escalation_threshold`   | German escalation triggers below threshold | Reviewer node uses an FR-tuned confidence prior; DE path needs a separate calibration set | `#TBD` |
| `eval/failures/03_hallucination_fact.json` | Fact-grounding score 0.71, target ≥ 0.85 | DE corpus lacks BaFin circular references that the FR corpus has for CNIL | `#TBD` |

Stale rows are removed on the day the underlying issue resolves — no zombie "known issues."

---

## Architecture at a glance

```
┌────────────────────────────────────────────────────────────────────┐
│                       FastAPI (Cloud Run)                          │
│  /chat (SSE)                                /audit (read-only)     │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                ┌────────────────▼────────────────┐
                │     LangGraph orchestration     │
                │                                 │
                │  router → planner → workers ──▶ reviewer → reporter
                │             │                                 │
                │             ▼                                 ▼
                │      [product_lookup,                  audit trail
                │       regulation_lookup,               (structured)
                │       account_lookup,
                │       simulator,
                │       escalation]
                │             │
                │             ▼
                │   LLM-callable tools  ◀── guarded by mcp-firewall
                │   (account_balance, card_block,
                │    transaction_search, loan_simulate,
                │    ticket_escalate)
                └────────────────┬────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   Vertex AI                 Cloud SQL                Ollama (on-prem)
   (frontier path)         + pgvector             Llama 3.3 70B on M1
```

A larger SVG version lives in [`docs/images/architecture.svg`](./docs/images/architecture.svg).

---

## Quickstart

### Prerequisites

- Python 3.12 (managed by [`uv`](https://docs.astral.sh/uv/))
- PostgreSQL 16 with `pgvector` extension — `docker compose up postgres` suffices for local dev
- A Google Cloud project with Vertex AI enabled, **or** an Ollama install with `llama3.3:70b` pulled
- Pre-commit (`pipx install pre-commit`)

### Install

```bash
git clone https://github.com/AmadouMamane/tessera.git
cd tessera
uv sync                       # installs runtime + dev dependencies
uv run pre-commit install     # enables ruff + mypy + hooks at commit time
cp .env.example .env.local    # then edit secrets
```

### Run the agent locally

```bash
# Boot Postgres + pgvector
docker compose up -d postgres

# Ingest the regulatory corpus + the seed product corpus (Crédit Aurore)
uv run python scripts/ingest_regulations.py
uv run python scripts/seed_demo.py

# Start the FastAPI agent
uv run python scripts/run_local.py
# → POST http://localhost:8080/chat   (SSE streaming)
# → GET  http://localhost:8080/audit  (read-only audit trail)
```

### Run the dashboard

```bash
cd webapp/frontend && pnpm install && pnpm dev
# → http://localhost:3000
```

### Run the regression harness

```bash
uv run python scripts/run_eval.py          # full suite
uv run python scripts/run_eval.py --lang de  # one language
uv run python scripts/run_eval.py --case 03_hallucination_fact  # one case
```

### Switch to the on-premises path

```bash
ollama pull llama3.3:70b
TESSERA_LLM_PROFILE=on_prem uv run python scripts/run_local.py
```

The router falls back to local automatically when Vertex AI credentials are absent — see [`docs/on_prem.md`](./docs/on_prem.md) for the trade-off table.

---

## Stack (frozen)

| Concern                | Choice                                          | ADR / docs                              |
| ---------------------- | ----------------------------------------------- | --------------------------------------- |
| Language               | Python 3.12                                     | —                                       |
| Dependency manager     | `uv` (exclusively — no pip/poetry/requirements) | [ADR 0004](./docs/decisions/0004-package-layout-src.md) |
| Lint + format          | `ruff`                                          | —                                       |
| Type-check             | `mypy --strict`                                 | —                                       |
| Test                   | `pytest` + `pytest-asyncio`                     | —                                       |
| Agent orchestration    | LangGraph                                       | [ADR 0005](./docs/decisions/0005-tools-vs-workers-separation.md) |
| Retrieval              | PostgreSQL + `pgvector`                         | [docs/design.md](./docs/design.md)      |
| Frontier LLM           | Vertex AI                                       | [docs/design.md](./docs/design.md)      |
| Local LLM              | Llama 3.3 70B via Ollama (Apple Silicon)        | [docs/on_prem.md](./docs/on_prem.md)    |
| Runtime guardrails     | `mcp-firewall` (pinned dependency)              | [docs/safety.md](./docs/safety.md)      |
| HTTP                   | FastAPI                                         | —                                       |
| Dashboard              | Next.js (under `webapp/frontend/`)              | —                                       |
| Infrastructure         | Terraform → Cloud Run + Cloud SQL + Secret Manager | [docs/runbook.md](./docs/runbook.md) |
| CI                     | GitHub Actions (4 workflows)                    | [ADR 0003](./docs/decisions/0003-ci-github-actions.md) |

The stack is **frozen**. Changes require an ADR under [`docs/decisions/`](./docs/decisions/).

---

## Multilingual (FR / DE / EN)

Prompts live in YAML under [`src/tessera/agent/prompts/`](./src/tessera/agent/prompts/) — never hardcoded in Python. The language router lives in `src/tessera/agent/router.py` and dispatches on detected user-input language; the reviewer and reporter nodes pick the matching prompt set.

Regulatory grounding by jurisdiction:

| Language | Primary regulators / corpora             | Corpus file                            |
| -------- | ---------------------------------------- | -------------------------------------- |
| FR       | CNIL, ACPR, AMF, GDPR                    | `src/tessera/corpus/data/regulations_cnil.json`, `regulations_gdpr.json` |
| DE       | BaFin, GDPR (DSGVO)                      | `src/tessera/corpus/data/regulations_bafin.json`, `regulations_gdpr.json` |
| EN       | DORA, GDPR (English consolidation)       | `src/tessera/corpus/data/regulations_dora.json`, `regulations_gdpr.json` |

See [`docs/multilingual.md`](./docs/multilingual.md) for the full evaluation methodology per language.

---

## Repository layout

The canonical tree lives in [`CLAUDE.md`](./CLAUDE.md). Notable conventions:

- `src/` layout (ADR 0004) — `import tessera` works only after `uv sync`.
- LangGraph **nodes** (orchestration) live under `src/tessera/agent/workers/`.
- **Tools** (LLM-callable function-call targets) live under `src/tessera/agent/tools/`.
  This separation is binding — see [ADR 0005](./docs/decisions/0005-tools-vs-workers-separation.md).
- Failure cases for the regression harness live as **one JSON file per failure** under `eval/failures/`, validated against `eval/failures/_schema.json`.

---

## Discipline

These rules are non-negotiable in this repository:

- **Ship-or-die at day twenty.** If schedule slips, cut scope. Never extend time.
- **Daily commit cadence.** One Conventional-Commits commit per day, minimum.
- **No notebooks.** Ever. If you need a scratchpad, use a script under `scripts/`.
- **No hidden failures.** Failing tests stay visible in this README until they are fixed or formally accepted with an issue link.
- **No fabricated citations.** Every external reference must point to a verified source.
- **Secrets never enter the repo.** GCP Secret Manager in prod, gitignored `.env.local` in dev.

---

## Security

Vulnerability disclosure policy and threat model:

- [`SECURITY.md`](./SECURITY.md) — disclosure and contact.
- [`docs/threat-model.md`](./docs/threat-model.md) — assets, adversaries, mitigations.

The `security.yml` workflow runs CodeQL, dependency scanning, and a guard-policy lint on every push.

---

## License

Apache-2.0 — see [`LICENSE`](./LICENSE). Choice justified in [ADR 0002](./docs/decisions/0002-license-apache-2.md).

---

## Acknowledgements

Tessera stands on the shoulders of `mcp-firewall`, LangGraph, the AEGIS and DFAH research lines, and the open evaluation ecosystem around Promptfoo and AgentAssay. The EU regulatory corpora it grounds against are public-domain texts from CNIL, BaFin, EBA, and the European Commission. Crédit Aurore is a fictional retail bank invented for demonstration purposes and bears no relation to any real institution.
