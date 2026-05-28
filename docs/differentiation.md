# Tessera — Differentiation

This document states honestly what Tessera is and is not, situates it against
the open-source projects and methods it reuses or takes inspiration from, and
records the moats that make the assembly defensible. It is bound by the
project's honest-positioning rule: any framing that drifts toward "new
framework" is wrong and must be corrected.

## What Tessera is NOT

- **Not a new firewall.** The runtime guard layer is `mcp-firewall`, consumed
  as a pinned dependency. Tessera's `src/tessera/guard/adapter.py` is an
  adapter: when `mcp_firewall` is importable it delegates decision logic to it;
  otherwise it falls back to a local policy engine exposing the same interface.
  Tessera does not invent guard semantics.
- **Not a new test framework.** The non-regression harness reuses the
  declarative-case + assertion patterns of AgentAssay and Promptfoo. The schema,
  runner, and scorecard are thin glue over those patterns, not a new evaluation
  engine or assertion language.
- **Not a new safety methodology.** The structured-audit approach is inspired by
  AEGIS. Tessera does not propose a novel safety theory.

## What Tessera IS

Tessera is a **complete, opinionated, deployed assembly** of four quality layers
— runtime guard, offline regression harness, structured audit trail,
human-in-the-loop escalation — wired end to end for **one specific use case**:
European retail banking customer support in French, German, and English, with
explicit grounding in EU regulatory corpora (DORA, CNIL, BaFin, GDPR).

The contribution is the *assembly* and the *EU business semantics*, not
technical invention:

- A LangGraph agent (router → planner → parallel workers → reviewer →
  reporter/escalation) wired to a pgvector hybrid-search retrieval layer with
  cross-lingual regulation search.
- A dual LLM path: Vertex AI for the frontier deployment and Ollama-served Llama
  3.3 70B for an on-premises Apple Silicon deployment, behind one backend
  Protocol.
- The four quality layers integrated so they reinforce each other (guard
  decisions feed the reviewer's confidence; the harness asserts on the guard's
  observable effects; every guard decision is audited).

## Landscape: roles and relationships

Each external project below is cited on the README front page. The table records
its role in Tessera and whether it is a hard dependency, an inspiration for a
pattern, or an interop target. Academic claims attached to any of these MUST be
verified before they are stated as fact here — see the citation note.

| Project | Role in Tessera | Relationship |
| --- | --- | --- |
| `mcp-firewall` (ressl) | Runtime guard / tool-call policy engine | **Dependency** (pinned). At least one upstream PR committed before day 20. |
| AEGIS | Inspiration for the structured audit-trail design | **Inspiration** |
| DFAH | Failure-taxonomy framing for the regression catalogue | **Inspiration** |
| AgentAssay | Declarative-case + assertion pattern for the harness | **Inspiration** |
| Promptfoo | Case-file structure, per-language expansion, scorecard | **Inspiration / interop** (case files are compatible in spirit) |
| STING | Adversarial / prompt-injection probe patterns | **Inspiration** |
| Bernstein | Compliance / audit framing reference | **Inspiration** |
| ALTK | Agent-evaluation tooling reference | **Inspiration** |

> The exact upstream identity, maintainer, and scope of each of the inspiration
> projects above must be confirmed against their canonical repositories or
> papers before this table is presented as authoritative. Several of these names
> are ambiguous; do not assert a specific repository URL, author, or claim here
> until verified.

## Citation note (binding)

Every academic citation in this file MUST be verified against the actual paper
before merge. Do not invent DOIs or arXiv identifiers. Where a citation is not
yet confirmed, leave an explicit placeholder of the form
`[VERIFY: arxiv:XXXX.XXXXX]` so reviewers can see exactly what remains to be
checked. The pre-merge checklist treats any unresolved `[VERIFY: ...]` marker in
a committed differentiation claim as a blocker.

Verified, in-repo references that may be cited as-is (already used in the
failure catalogue):

- Greshake et al., "Not what you've signed up for: Compromising Real-World
  LLM-Integrated Applications with Indirect Prompt Injection", arXiv:2302.12173
  (2023). Used by `eval/failures/01_prompt_injection.json`. Verify the specific
  claims drawn from it before relying on them.
- OWASP LLM Top 10 (2024), "LLM06: Sensitive Information Disclosure". Used by
  `eval/failures/02_pii_leak.json`.

Pending verification (placeholders — do not present as fact):

- AEGIS audit methodology — `[VERIFY: arxiv:XXXX.XXXXX]`
- DFAH failure taxonomy — `[VERIFY: arxiv:XXXX.XXXXX]`
- STING adversarial probing — `[VERIFY: arxiv:XXXX.XXXXX]`
- ALTK agent-evaluation tooling — `[VERIFY: source]`
- Bernstein compliance framing — `[VERIFY: source]`

## Competitive moats

Tessera's defensibility comes from the specificity and completeness of the
assembly, not from any single component:

1. **EU regulatory grounding across three jurisdictions.** The agent retrieves
   over DORA, CNIL, BaFin, and GDPR corpora, with cross-lingual search
   (`knn_search` with `language=None`) so a French question can match a German
   BaFin circular. The regulatory semantics are baked into the prompts, the
   citation records, and the failure taxonomy. This is hard to replicate without
   the same domain work.
2. **A real deployment on two substrates.** The frontier path runs on Google
   Cloud Run with Cloud SQL, Secret Manager, and Cloud Logging/Monitoring
   (Terraform under `infra/terraform/`). The on-premises path runs Llama 3.3 70B
   on Apple Silicon via Ollama. Both sit behind one `ChatBackend` Protocol, so
   the same agent code serves both. A deployed system with a data-residency
   story is worth more than a demo notebook.
3. **A forty-case non-regression harness over documented real-world failures.**
   Ten categories, three languages, machine-checked pass criteria, replayed
   against the live graph on every push, gating merges. This turns "we tested
   it" into a continuously-enforced contract.
4. **Daily commit cadence with no hidden failures.** Conventional Commits, one
   commit minimum per day, and a README that documents the tests that pass *and*
   the tests that fail, with root causes. The discipline itself is a moat: it
   keeps the assembly honest and current.

## Upstream contribution commitment

The "reuse, don't reinvent" positioning is defended by a concrete obligation:
**at least one upstream contribution to `mcp-firewall` must land before day
twenty.** This is non-negotiable per `CLAUDE.md`. It proves that Tessera
engages with its dependency as a contributor rather than merely vendoring it,
and it is the strongest single piece of evidence that the project's value is in
assembly and domain semantics, not in re-implementing a firewall. The specific
PR is tracked separately and will be referenced here once it is opened.
