# On-premises deployment

This document describes Tessera's on-premises path: when to choose it over the
Cloud Run / Vertex AI frontier path, what hardware it needs, how the local LLM
and database are set up, and what you give up by running self-hosted.

The on-prem path is a first-class profile, not a degraded fallback. Both paths
share the same agent graph, the same guard layer, the same retrieval store, and
the same regression harness. The only things that change are the LLM backend
(Ollama Llama 3.3 70B instead of Vertex AI Gemini), the embedding backend
(`bge-m3` via Ollama instead of `text-multilingual-embedding-002` via Vertex
AI), and the database host (a local `pgvector/pgvector:pg16` container instead
of Cloud SQL).

## When to choose the on-prem path

Pick on-prem when one or more of the following is a hard requirement.

- **Data residency / sovereignty.** No customer text, no account data, and no
  retrieval queries leave the host. For a European retail bank that cannot send
  prompts to a US-headquartered cloud LLM provider, this is decisive. Tessera's
  positioning is EU regulatory grounding, and the on-prem path keeps the entire
  inference loop inside the operator's own perimeter.
- **No cloud credits / cost control.** The frontier path bills per token through
  Vertex AI. On-prem amortises a fixed hardware cost and has zero per-request
  marginal cost. For high steady-state volume on owned hardware this wins.
- **Latency sensitivity in a closed network.** When the agent runs in the same
  rack as the database and the model, there is no round-trip to a cloud region.
- **Air-gapped environments.** Once the model weights and the corpus are on
  disk, the on-prem path needs no outbound network at all. Pull the model on a
  connected staging box, copy the Ollama blob store across, and run dark.

If none of these apply, the frontier path is operationally simpler: it
autoscales, it has managed Postgres, and Gemini gives stronger multilingual
quality (see the trade-off table below).

## Hardware requirements

### Reference configuration

The development reference is an Apple Silicon **M1 Ultra**:

- 48 GPU cores
- 107.5 GiB usable unified memory (of 128 GiB physical)
- 800 GB/s memory bandwidth

Llama 3.3 70B at Ollama's default Q4_K_M quantization needs roughly 40–43 GiB
resident. On the M1 Ultra it loads comfortably with headroom for the OS,
Postgres, and the embedding model held warm in parallel.

### Minimum viable configuration

An **M2 Pro with 16 GiB** unified memory will run the 70B model only at a more
aggressive 4-bit quantization, and only with the embedding model unloaded
between calls. Expect heavy memory pressure and swap; this config is for
functional testing, not production. For a comfortable production single node,
target 64 GiB or more of unified memory.

### Why Apple Silicon over consumer Nvidia GPUs

The bottleneck for a 70B model is not compute, it is **how much weight you can
hold in memory the accelerator can address**. A consumer Nvidia card tops out at
24 GiB of VRAM (RTX 4090), which cannot hold a 70B model at a usable
quantization without splitting across multiple cards or offloading layers to
host RAM over PCIe — both of which collapse throughput.

Apple's unified memory architecture removes the VRAM/RAM split entirely: the GPU
addresses the same 100+ GiB pool the CPU uses, at 800 GB/s. Combined with
Ollama's Metal MPS backend, a single M1 Ultra runs the full 70B model that would
otherwise require two or three datacenter GPUs. This is the specific reason the
on-prem reference is M-series and not a GPU workstation.

## Model: Llama 3.3 70B via Ollama

The on-prem chat backend is `OllamaBackend` (`src/tessera/llm/local.py`), an
async wrapper over the Ollama client. Defaults come from `OllamaSettings` in
`src/tessera/settings.py`:

- chat model: `llama3.3:70b`
- embedding model: `bge-m3` (1024-dimensional)
- host: `http://localhost:11434`
- request timeout: 120 s
- keep-alive: 600 s (the model stays resident for 10 minutes after the last
  call so repeated turns do not pay the reload cost)

Install and pull:

```bash
brew install ollama
ollama serve            # leave running, or use the launchd service
ollama pull llama3.3:70b
```

Observed on the M1 Ultra reference:

- **Cold load:** ~45 s to bring the 70B model resident on first request.
- **Throughput:** ~35 tokens/sec generation.

The `keep_alive_seconds` setting (passed to Ollama as `keep_alive` by
`OllamaBackend`) exists precisely so that you pay the 45 s load once and then
serve subsequent turns at full speed. A multi-turn support conversation never
re-loads as long as turns arrive within the window.

## Configuration and automatic fallback

Force the on-prem profile explicitly:

```bash
export TESSERA_LLM_PROFILE=on_prem
```

The profile resolution lives in `Settings.resolved_llm_profile()`
(`src/tessera/settings.py`). The default profile is `auto`:

- `frontier` — always route through Vertex AI.
- `on_prem` — always route through Ollama.
- `auto` — route through Vertex AI **if** `TESSERA_VERTEX__PROJECT_ID` is set,
  otherwise fall back to the on-prem Ollama path.

So a host with no Vertex AI project configured automatically runs fully local
with no extra flags. Setting `on_prem` explicitly is still recommended for
production on-prem nodes so the behaviour does not silently change if a stray
Vertex variable appears in the environment.

Embedding dimensionality differs between profiles (768 for Vertex AI
`text-multilingual-embedding-002`, 1024 for `bge-m3`). You cannot mix corpora
ingested under one profile with queries issued under the other — re-ingest the
corpus whenever you switch the embedding backend.

## Frontier vs on-prem trade-offs

| Dimension                     | Frontier (Vertex AI Gemini)              | On-prem (Ollama Llama 3.3 70B)             |
| ----------------------------- | ---------------------------------------- | ------------------------------------------ |
| Median latency (warm)         | Low, region-dependent                    | Higher; bounded by ~35 t/s generation      |
| Cold start                    | None (managed)                           | ~45 s first request                        |
| Marginal cost per request     | Per-token billing                        | Zero (fixed hardware cost)                 |
| Data sovereignty              | Data leaves the perimeter to GCP         | Nothing leaves the host                    |
| Air-gap capable               | No                                       | Yes                                        |
| Language quality (FR/DE/EN)   | Strongest                                | Good; weaker on idiomatic DE               |
| Regulatory hallucination rate | Lower                                    | Higher — relies harder on the grounding gate |
| Scaling                       | Cloud Run autoscaling                    | Single node, no horizontal scaling         |
| Operational burden            | Managed                                  | Operator owns the box                      |

The "regulatory hallucination rate" row is the one that matters most for this
use case. The 70B model confabulates regulatory specifics (article numbers,
dates, thresholds) more readily than Gemini does. The mitigation is the same on
both paths — the grounding-score gate and the citation requirement enforced by
the reviewer and the guard — but the gate does more work on-prem. The regression
harness (`eval/`) is run against both profiles, and the scorecard is expected to
show a measurably higher pre-gate hallucination rate on-prem; this is documented
honestly rather than hidden.

## Postgres on-prem

The local stack uses the official `pgvector/pgvector:pg16` image, which ships
the `vector` extension already built. From `docker-compose.yml`:

```bash
docker compose up -d postgres
```

This brings up Postgres 16 on `localhost:5432` with database `tessera`, user
`tessera`, password `tessera`, and a `pg_isready` health check. The application
creates the `vector` extension and the `documents` table at startup; you do not
run any extension SQL by hand. **pgvector requirement: the version bundled with
`pg16` (0.7+) — older 0.4.x builds lack the HNSW index used by the retrieval
store.**

The default DSN matches this container
(`postgresql://tessera:tessera@localhost:5432/tessera`,
`PostgresSettings.dsn`). Override with `TESSERA_POSTGRES__DSN` for a different
host.

## Performance notes

- **Embedding generation.** On the frontier path, embeddings are a network call
  to Vertex AI. On-prem, `bge-m3` runs through the same Ollama daemon as the
  chat model. Because the chat model dominates unified memory, embedding
  throughput drops while the 70B model is resident; batch corpus ingestion
  before the chat model is warmed, or accept that the first ingest after a chat
  burst is slower.
- **Retrieval latency.** With the demo corpus of ~238 chunks, pgvector HNSW
  search returns in low single-digit milliseconds locally — retrieval is never
  the bottleneck on-prem. The bottleneck is always token generation at ~35 t/s.

## Limitations

The on-prem path is explicitly single-node and unmanaged. Know these going in.

- **No SLA.** There is no managed availability guarantee; uptime is whatever the
  operator's host and power give you.
- **Single node, no horizontal scaling.** One Ollama daemon serves one model
  instance. Concurrency is bounded by that single GPU's throughput; there is no
  built-in load balancing across nodes. The Cloud Run concurrency model
  (80 requests/instance, autoscaling) does not apply.
- **Metal MPS is not available inside Docker containers on macOS.** The
  containerised Ollama service in `docker-compose.yml` is left commented out and
  marked CPU-only for exactly this reason. **Run Ollama natively** (`brew
  install ollama && ollama serve`) to get GPU acceleration; the container path
  is for reproducible CI or functional testing only and will be an order of
  magnitude slower.
- **No managed backups or secret rotation.** The operator owns database backups,
  disk encryption, and any credential handling that Secret Manager would
  otherwise provide on the frontier path.
