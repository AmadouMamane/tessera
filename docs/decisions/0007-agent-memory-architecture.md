# 7. Agent memory architecture

Date: 2026-05-30

## Status

Accepted and **implemented** (all four phases). This ADR supersedes the implicit
memory model that Tessera shipped with — client-passed conversation history plus
a per-turn `MemorySaver` — and extends the canonical tree in CLAUDE.md by
introducing the `src/tessera/memory/` package. The agent and infrastructure
portions of CLAUDE.md remain authoritative; only the memory surface described
here is added. Two design points were refined during implementation (durable
transcript table instead of re-keying the checkpointer; a dedicated pgvector
table instead of LangGraph `BaseStore`); each is flagged inline as an
"Implementation note" below.

## Context

Tessera is positioned as a *production-grade reference implementation*. Memory
is the one subsystem where the gap between "works in a demo" and "works in the
field" is widest, and where the EU retail-banking semantics that justify the
whole project impose constraints that a generic chatbot does not face. This ADR
exists so that the memory design is decided once, defended in writing, and
reusable as a pattern outside Tessera.

### What existed before this ADR

Two mechanisms were doing memory-shaped work, both by accident rather than by
design.

1. **Conversation continuity was stateless on the server.** The dashboard
   re-sent the full `history[]` array on every request (`api/routes/chat.py`).
   The backend turned it into `prior_messages` and prepended it to the agent
   state. The server remembered nothing between requests; the client was the
   sole keeper of conversational truth. This is fragile (a client bug loses the
   thread), unauditable (the server cannot replay what it never stored), and
   does not survive a second client.

2. **The LangGraph checkpointer was keyed by turn, not by conversation.**
   `chat.py` compiled the graph with a `MemorySaver` and `thread_id = turn_id`.
   A LangGraph checkpointer is the framework's *thread memory* primitive — it is
   meant to be keyed by the conversation so that successive turns resume the
   same thread. Keying it by `turn_id` reduces it to a per-turn scratchpad whose
   only purpose was to let the graph pause before the reporter for token
   streaming. The single most load-bearing memory primitive in the stack was
   present and wired backwards.

3. **The recency window forgot abruptly.** The reporter injected the last
   `HISTORY_WINDOW = 6` messages and silently dropped everything older. No
   summary, no carry-over of facts — three turns back simply ceased to exist.

There was no long-term memory of any kind: nothing learned across sessions, no
customer profile, no record of how a past incident was resolved.

### The taxonomy we commit to

We adopt the CoALA taxonomy (Cognitive Architectures for Language Agents) as the
shared vocabulary, because it maps cleanly onto what an agent actually stores and
because it is the language used in the literature this project is benchmarked
against. The four types and their status in Tessera:

| Type | Holds | Tessera substrate |
|------|-------|-------------------|
| **Procedural** | Rules, tools, policies — *how to act* | `guard/policy.yaml`, `agent/prompts/*.yaml`, the LangGraph graph. Read-only at runtime; self-modifying procedural memory is **explicitly out of scope** (see Consequences). |
| **Semantic** | Facts about the world | `pgvector` corpus (regulatory + product). Already retrieval-backed. |
| **Working** | The current turn | `AgentState` in-graph. |
| **Episodic (intra-session)** | The running conversation | Tier 0 sliding window today; Tier 1 adds compaction. |
| **Episodic (long-term)** | Past sessions, customer preferences, resolved incidents | Tier 2, introduced here. |

This ADR concerns the two episodic rows. Procedural and semantic memory already
exist and are governed by their own ADRs and corpora.

### The forces in tension

- **Banking conversations are short.** Three to five turns is typical. Most of
  the time a verbatim sliding window is not just sufficient, it is *better* than
  anything cleverer, because it introduces zero risk of distortion. Over-
  engineering the common case is a real cost.
- **Summarisation is lossy in exactly the wrong place.** An LLM asked to
  summarise a banking exchange will degrade the very tokens that matter:
  `€4 567,89` becomes "about €4,500", `FR76 3000 4000 …` becomes "the IBAN",
  `DORA Art. 28(3)` becomes "the DORA provisions". For a compliance-grounded
  agent, lexical degradation of amounts, identifiers, dates, and regulatory
  citations is not an inconvenience — it is a correctness and audit failure.
- **There is no authentication layer yet.** Tessera has no notion of an
  authenticated customer identity at runtime. Any long-term memory keyed by
  "customer" has to choose a proxy and be honest that it is a proxy.
- **Memory is an attack surface.** A fact extracted from a malicious turn and
  written to long-term memory is a stored prompt-injection that re-arms on every
  future session (OWASP LLM03, indirect injection). The project already treats
  user input as hostile; memory must inherit that posture on **both** the write
  and the read path. This is continuous with the language-pinning guard bypass
  and the bracket-injection findings already recorded for this codebase.
- **GDPR is not optional.** Storing anything about a person triggers data-
  minimisation, retention limits, right-to-erasure (Art. 17), and consent.
  These are the EU business semantics the project claims as its differentiator;
  the memory layer is where they become concrete.
- **Reuse over reinvention.** The project's positioning forbids inventing a new
  memory framework. We must lean on primitives we already run (LangGraph,
  Postgres, pgvector) and keep any third-party memory engine (LangMem, Mem0,
  Zep) behind a swappable boundary so the choice is reversible and the
  comparison is honest.

## Decision

We separate memory into **two orthogonal mechanisms** plus a **cross-cutting
governance layer**, and we make the second mechanism **pluggable** behind a
single Protocol so the backend — including external engines — is a one-line
configuration choice.

### Mechanism A — Thread persistence (short-term, durable)

Conversation continuity becomes server-side and durable, so the server — not the
client — is the keeper of conversational truth:

- A dedicated **`conversation_messages` transcript table** records every
  user/assistant turn, keyed by `conversation_id`. It is the source of prior
  turns for each new turn and a replayable record for the audit trail.
- The client-supplied `history[]` degrades from source-of-truth to an optional
  cold-start hint (e.g. importing a transcript), used only when the server has
  no record of the conversation.
- The LangGraph checkpointer (`MemorySaver`) stays keyed **per turn**
  (`thread_id = turn_id`): it only powers the intra-turn streaming pause
  (interrupt-before-reporter), which is unchanged.

> **Implementation note (refines the original idea).** An earlier draft proposed
> re-keying the checkpointer by `conversation_id` to carry history across turns.
> Implementation surfaced a blocker: `AgentState` has per-turn accumulator
> channels (`retrieved_documents`, `tool_calls`, `citations`, `guard_decisions`,
> `errors`) whose reducers *concatenate*. Persisting the whole graph state across
> turns on one thread would bleed one turn's retrievals and citations into the
> next. A dedicated transcript table is therefore the correct mechanism: it
> carries exactly the conversational record, leaves per-turn state clean, and
> needs no new dependency — it reuses the existing `psycopg`/pgvector layer. The
> checkpointer being keyed per turn was never the defect; the *absence of
> server-side conversation persistence* was.

### Mechanism B — Memory management (pluggable backend)

Everything about *how the conversation is compacted* and *what is remembered
across sessions* sits behind one Protocol in `src/tessera/memory/`. The agent
calls the Protocol; it never knows which backend is wired.

```python
# src/tessera/memory/protocol.py  (shape, not full implementation)

class MemoryScope(NamedTuple):
    conversation_id: UUID
    subject_id: str          # customer proxy; see "Identity" below
    language: LanguageCode

@dataclass(frozen=True)
class MemoryContext:
    """What the reporter injects, in priority order."""
    recent_verbatim: list[ConversationMessage]   # last N turns, untouched
    summary: str | None                          # compacted older turns
    entities: EntityLedger                        # literal, never paraphrased
    long_term: list[MemoryItem]                   # retrieved cross-session items

class MemoryBackend(Protocol):
    async def load(self, *, scope: MemoryScope, query: str) -> MemoryContext: ...
    async def record(self, *, scope: MemoryScope, turn: TurnRecord) -> None: ...
    async def forget(self, *, scope: MemoryScope) -> None: ...   # GDPR Art. 17
```

`load` is on the hot path (assembles the prompt context). `record` is on the
**cold path** — invoked after the turn completes, never blocking the user.
`forget` is the erasure primitive every backend must implement.

#### The three native tiers

```
src/tessera/memory/
├── __init__.py        # get_memory_backend() factory + scope_for()
├── protocol.py        # MemoryBackend Protocol + MemoryScope/MemoryContext/MemoryItem
├── transcript.py      # Mechanism A — durable conversation transcript table
├── window.py          # Tier 0 — sliding window           (DEFAULT)
├── summary.py         # Tier 1 — summary buffer + entity ledger
├── persistent.py      # Tier 2 — cross-session, dedicated pgvector table
├── entities.py        # literal entity extraction (shared by Tier 1 & 2)
├── governance.py      # PII screening, TTL, erasure, consent, audit hooks
├── reflector.py       # post-turn background memory formation (cold path)
└── adapters/          # external engines behind the same Protocol
    ├── __init__.py     # MissingMemoryExtraError
    ├── langmem.py      # optional extra  [memory-langmem]
    ├── mem0.py         # optional extra  [memory-mem0]
    └── zep.py          # optional extra  [memory-zep]
```

**Tier 0 — `window` (the default).** The current sliding window, formalised
behind the Protocol. It is the default *on purpose*: for short banking
conversations it is correct, lossless, and free. We do not replace it; we make
it the floor of a ladder. Choosing a heavier tier is an explicit decision, never
the silent default.

**Tier 1 — `summary` (compaction with an entity ledger).** When a conversation
exceeds a token budget, keep the last N turns verbatim and replace the older
ones with a running summary — **but extract literal entities before
summarising**. `entities.py` pulls amounts, IBANs/account references, dates,
ticket numbers, product names, and regulatory citations into an `EntityLedger`
that is carried *verbatim and structured*, never handed to the summarising LLM
to paraphrase. The injected context is therefore
`[SUMMARY] + [ENTITY LEDGER] + [last N verbatim turns]`. The summary is computed
in the **background at the end of turn N** by a small, cheap model (local
Llama 3.2 3B, or Gemini Flash on the frontier path) so turn N+1 pays no latency.
This tier exists because naïve summarisation is actively dangerous in banking;
the entity ledger is the mitigation and is non-negotiable when Tier 1 is on.

**Tier 2 — `persistent` (long-term, cross-session).** Durable memory keyed by
subject, in a dedicated `long_term_memory` pgvector table — the same embedding +
pgvector layer that already backs document retrieval. Rows are tagged by kind:

```
kind = "semantic"     facts: preferred language, products held, stable preferences
kind = "episodic"     summaries of resolved incidents — few-shot "how X was handled"
```

> **Implementation note (refines the original idea).** The first draft named
> LangGraph's `BaseStore`/`PostgresStore` vector index as the substrate.
> Implementation chose a dedicated pgvector table reached through Tessera's own
> `tessera.retrieval.embeddings` + `psycopg` layer instead, because it (a) keeps
> the whole embedding path under one roof, (b) avoids version-specific
> `BaseStore` index wiring, (c) lets the schema own the governance columns
> (`expires_at` for TTL, `importance` for ranking) directly, and (d) needs no
> dependency beyond the `pgvector`/`psycopg` already in the stack. The "reuse a
> framework primitive" goal is still met — the primitive reused is Tessera's own
> retrieval layer.

Retrieval scores candidates by **recency × importance × semantic relevance**
(the Generative Agents memory-stream scoring), de-duplicated against the live
RAG `retrieved_documents` so the context is not padded with redundancy. Writes
are **upserts**, not appends, to prevent the unbounded-duplicate failure mode of
naïve memory layers.

#### Memory formation — the write path (`reflector.py`)

Memories are formed on the cold path, never during the user-facing turn:

```
turn completes (reviewer + guard have already passed)
   └─ reflector (background task / nightly batch)
        ├─ small LLM extracts candidate facts from the turn
        ├─ governance.screen(): PII minimisation + guard (mcp-firewall)   ← may reject
        ├─ entities.py: attach literal entity ledger (no paraphrase)
        ├─ semantic de-dup → upsert into the Store
        └─ emit a GuardDecisionRecord into the existing audit trail
```

A **nightly consolidation** cron (GitHub Actions scheduled job or Cloud Run job)
re-summarises the prior day's sessions into Tier 2, enriching long-term memory
without touching production latency. This keeps the hot path cheap and the
long-term store coherent.

#### External backends (LangMem / Mem0 / Zep)

The same Protocol admits external engines as **optional extras**, so the
build/buy decision stays reversible and the project's competitor comparison
stays honest rather than theoretical:

| Backend | Role | Trade-off |
|---------|------|-----------|
| `window` / `summary` / `persistent` | **Native, default.** | Reuses LangGraph + pgvector; zero new runtime service; full control of governance. |
| `langmem` | LangChain memory managers + background consolidation. | Less code to write for consolidation; one more dependency for what the native tiers already cover. |
| `mem0` | Extraction + vector/graph memory engine. | Mature product; brings its own store, duplicating our pgvector and diffusing the governance boundary. |
| `zep` | Zep Community Edition temporal memory service. | Strong temporal/graph features; an external service to operate and to bring under EU-residency and audit guarantees. |

The native `persistent` schema is deliberately shaped to be **interface-
compatible** with Mem0 and Zep CE (`facts / incidents / preferences / entities`
records), so migrating to one later is an adapter swap, not a rewrite.

#### Backend selection

One setting, validated by `settings.py`, switches the backend with no code
change anywhere else:

```python
MEMORY_BACKEND: Literal[
    "window", "summary", "persistent",   # native tiers
    "langmem", "mem0", "zep",            # external adapters (optional extras)
] = "window"
```

External adapters import their engine lazily and fail with a clear message if
the corresponding optional extra is not installed, so the default install stays
lean.

### Identity: `conversation_id` as the subject proxy

Because there is no authentication layer yet, `subject_id` defaults to the
`conversation_id`. Long-term memory is therefore *per-conversation-thread*, not
truly *per-person*, until auth lands. This is recorded as a known limitation
rather than hidden: when an authenticated customer identity becomes available it
replaces the proxy at the single `MemoryScope` boundary, and nothing else
changes. Honest positioning over a fake identity model.

### Governance (`governance.py`) — the differentiator

Cross-cutting, applied on every read and write. This is where "memory" becomes
"EU banking memory" and where Tessera distinguishes itself from a thin wrapper
over an off-the-shelf memory engine:

- **Data minimisation.** Never store raw PII (IBANs in full, balances, card
  numbers). Store references/tokens; the entity ledger holds *locators*, not
  secrets. Screened by the guard before any write.
- **Retention / TTL by memory type.** Short-term purged at conversation close;
  episodic medium-lived; semantic long-lived. Retention is explicit and
  documented, not incidental.
- **Right to erasure (GDPR Art. 17).** `governance.erase_subject(...)` (exposed
  as `DELETE /memory/{conversation_id}`, and used by every backend's `forget`)
  deletes the subject across all layers — long-term rows, summary, transcript,
  and consent — in one operation, regardless of which backend is configured. A
  first-class, demonstrable capability.
- **Consent.** A per-subject consent flag gates all Tier 2 writes; without it,
  the agent runs Tier 0/1 only.
- **Memory is untrusted data.** Long-term items are injected into the prompt in
  a **delimited, explicitly labelled "context, not instruction" block**, never
  merged into the system prompt. Screening runs on the **read** path too, not
  only on write — defence in depth against stored injection.
- **Audit.** Every memory read and write emits a record into the existing audit
  trail (`guard/audit.py`), so the memory layer is as inspectable as the tool
  layer.

### Rollout (day-twenty discipline: cut, don't extend)

All four phases are **implemented** (see Status), but the staging order still
records the value/surface trade-off:

1. **Phase 1 — foundation.** Durable `conversation_messages` transcript +
   `window` behind the Protocol. Makes conversations server-side, durable, and
   replayable. High value, low surface; worth shipping even if nothing else lands.
2. **Phase 2 — `summary` + entity ledger.** Removes abrupt forgetting without
   risking lexical degradation.
3. **Phase 3 — `persistent` + reflector + governance.** The "impressive demo"
   tier and the largest surface; the first to cut if the schedule slips.
4. **Phase 4 — recency/importance scoring, external adapters, nightly
   consolidation.** Nice-to-have.

## Consequences

- Conversation continuity is server-side, durable, and replayable via the
  transcript, instead of depending on the client to re-send history. This pays
  off twice: in robustness and in the audit trail.
- The default behaviour does not change. `window` stays the floor, so the common
  short-conversation case keeps its lossless, zero-cost path; heavier memory is
  opt-in and justified per deployment.
- Banking correctness is protected by construction: the entity ledger guarantees
  that amounts, identifiers, dates, and citations survive compaction verbatim.
- The build/buy question is settled without being foreclosed. We ship native by
  default, keep LangMem/Mem0/Zep one setting away, and shape the schema for
  migration. The competitor comparison in `docs/differentiation.md` can cite
  these as *evaluated and bounded*, not hand-waved.
- GDPR obligations are concrete capabilities (`forget`, TTL, consent, audit),
  which is exactly the EU semantics the project sells.
- **Costs and explicit non-goals.** One new package (`src/tessera/memory/`) and
  **no new runtime dependency** — the native tiers reuse the `psycopg`/pgvector
  and base `langgraph` already in the stack. External engines are optional
  extras (`memory-langmem` / `memory-mem0` / `memory-zep`), not in the default
  install. Long-term memory is per-thread until auth exists — a stated
  limitation. **Procedural self-modification is out of scope**:
  the agent never rewrites its own policies or prompts from memory, because a
  self-editing policy is a security hole, and rules already live, versioned and
  reviewed, in `guard/` and `prompts/`. Pull requests that let memory write into
  the procedural layer are rejected with a pointer to this ADR.
- The `src/tessera/memory/` package is added to the canonical tree by this ADR;
  contributors treat the layout above as canonical for the memory surface.

## References

- CoALA — Sumers, Yao, Narasimhan, Griffiths, *Cognitive Architectures for
  Language Agents* (2023). Memory typology.
- Park et al., *Generative Agents* (2023). Memory-stream retrieval scoring
  (recency × importance × relevance).
- OWASP Top 10 for LLM Applications — LLM03 (indirect/stored injection).
- LangGraph persistence: checkpointers (thread memory) and `BaseStore`
  (long-term memory).
- Mem0, Zep Community Edition, LangMem — evaluated external backends.
