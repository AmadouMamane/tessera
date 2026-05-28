# Runbook

Operational reference for deploying, observing, and recovering the Tessera
agent on Google Cloud Run. The infrastructure is described in
`infra/terraform/` and the deploy is automated through the `deploy.yml` GitHub
Actions workflow. This document is the on-call companion: how to ship it, how to
watch it, and what to do when it misbehaves.

For the self-hosted path see `docs/on_prem.md`; for the local quickstart see the
last section here.

## Deployment prerequisites

- A GCP project with billing enabled.
- The following APIs enabled: **Cloud Run**, **Cloud SQL Admin**, **Secret
  Manager**, **Vertex AI**, and **Serverless VPC Access** (the service uses
  private VPC egress to reach Cloud SQL).
- **Terraform ≥ 1.7**.
- `gcloud` authenticated against the target project with rights to manage Cloud
  Run, Cloud SQL, Secret Manager, and IAM.
- A container image for the agent, built from `infra/docker/Dockerfile.agent`
  and pushed to a registry the Cloud Run service account can read.

## Deploy steps

### 1. Provision infrastructure

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

This creates the Cloud Run service, the Cloud SQL Postgres instance (pgvector
enabled via the `cloudsql.enable_pgvector` flag), the Secret Manager secrets,
the log bucket retention, the audit log sink to a dedicated GCS bucket, the
log-based metrics, the monitoring dashboard, and the alert policies.

### 2. Populate secrets

Terraform creates the secret *containers* and placeholder versions; you add the
real values. The application reads these as secret-backed environment variables
at container start.

```bash
gcloud secrets versions add bearer_token        --data-file=-   # API auth token
gcloud secrets versions add postgres_url         --data-file=-   # full Postgres DSN
gcloud secrets versions add audit_signing_key     --data-file=-   # audit log signing key
gcloud secrets versions add vertex_project_id      --data-file=-   # Vertex AI project id
```

(Pipe the value into each command, e.g. `printf '%s' "$TOKEN" | gcloud secrets
versions add bearer_token --data-file=-`.)

### 3. Build and push the image

```bash
docker build -f infra/docker/Dockerfile.agent -t REGION-docker.pkg.dev/PROJECT/tessera/agent:TAG .
docker push REGION-docker.pkg.dev/PROJECT/tessera/agent:TAG
```

### 4. Deploy to Cloud Run

Trigger the `deploy.yml` workflow (push to the deploy branch or run it manually).
It points the Cloud Run service at the new image tag and shifts 100% of traffic
to the latest revision (`TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST`).

## Environment variables

Plain values are set on the Cloud Run container directly; secret-backed values
are resolved from Secret Manager at start. Defaults are from
`src/tessera/settings.py`.

| Variable                          | Default (settings)            | Source in prod                    |
| --------------------------------- | ----------------------------- | --------------------------------- |
| `TESSERA_ENVIRONMENT`             | `local`                       | plain (`production`)              |
| `TESSERA_LLM_PROFILE`             | `auto`                        | plain (`frontier` on Cloud Run)   |
| `TESSERA_DEFAULT_LANGUAGE`        | `fr`                          | plain                             |
| `TESSERA_VERTEX__PROJECT_ID`      | unset                         | plain (project id)                |
| `TESSERA_VERTEX__LOCATION`        | `europe-west1`                | plain (region)                    |
| `TESSERA_VERTEX__CHAT_MODEL`      | `gemini-2.0-flash-001`        | plain                             |
| `TESSERA_VERTEX__EMBEDDING_MODEL` | `text-multilingual-embedding-002` | plain                         |
| `TESSERA_OBS__CLOUD_LOGGING_PROJECT` | unset                      | plain (project id)                |
| `TESSERA_GUARD__AUDIT_SINK`       | `file`                        | plain (`cloud_logging`)           |
| `TESSERA_POSTGRES__DSN`           | local DSN                     | **secret** `postgres_url`         |
| `TESSERA_API__BEARER_TOKEN`       | unset                         | **secret** `bearer_token`         |

The audit signing key and Vertex project id secrets are populated as above; the
guard's audit sink is set to `cloud_logging` in production so entries flow into
the audit GCS bucket via the log sink. Other settings (pool sizes, confidence
threshold, timeouts) keep their defaults unless overridden by their respective
`TESSERA_*` variables.

## Health checks

- **`/healthz`** — liveness. Returns 200 with `{status, version}` as soon as the
  process is up (`src/tessera/api/routes/health.py`). The Cloud Run **liveness
  probe** hits it every 30 s.
- **`/readyz`** — readiness, distinct from liveness so deployments can stagger.
- **Startup probe** — a TCP probe on port 8080, 5 s period, up to 12 failures
  (~60 s) before the revision is considered failed to start
  (`infra/terraform/cloud_run.tf`).
- **Postgres connectivity** is exercised at startup when the app opens its
  connection pool and ensures the `vector` extension / `documents` table; a DB
  that is unreachable will fail the revision before it serves traffic.
- **`/budget`** — running LLM cost estimate (input/output tokens, estimated EUR)
  as `text/plain` for quick scrapes.

## Observability

A Cloud Monitoring dashboard (**Tessera — {environment}**) is provisioned with
six tiles (`infra/terraform/observability.tf`):

1. **Request count** — by response-code class.
2. **Request latency** — p95 (REDUCE_PERCENTILE_95).
3. **CPU utilisation**.
4. **HTTP 5xx errors** — from the `http_5xx` log-based metric.
5. **Guard deny decisions** — from the `guard_denies` log-based metric, grouped
   by target tool.
6. **Active instances**.

Two alert policies are configured:

- **HTTP error rate > 5% over 5 min** — on the built-in Cloud Run
  `request_count` metric filtered to the `5xx` response-code class.
- **Guard deny storm** — fires when `guard_denies` exceeds **20 in a 10-minute
  window**. A spike may indicate a prompt-injection attempt; the alert
  documentation links here.

Both policies have empty `notification_channels` in Terraform — wire your
channels (PagerDuty, email, Slack) before relying on them.

## Audit log

- **Local:** JSON lines written to `/tmp/tessera/audit.log`
  (`GuardSettings.audit_file`, sink `file`).
- **Production:** the guard's audit sink is `cloud_logging`; entries carry
  `jsonPayload.type="tessera.guard.audit"`. A log sink routes exactly those
  entries to the dedicated GCS bucket `PROJECT-SERVICE-audit` for independent
  archiving and review.
- **Format:** one JSON object per entry, including outcome (`denied` / allowed),
  the target tool, and the decision context.
- **Retention / rotation:** the main log bucket honours `log_retention_days`;
  the audit GCS bucket has a 365-day delete lifecycle rule and
  `force_destroy = false` so it cannot be wiped accidentally.

## On-call procedures

### High error rate (5xx alert firing)

1. Read recent logs:
   `gcloud logging read 'resource.type="cloud_run_revision"' --limit 50`.
2. Check for a **guard deny-storm** in the same window — a flood of denies can
   surface as upstream errors. Filter
   `jsonPayload.type="tessera.guard.audit" AND jsonPayload.outcome="denied"`.
3. Check the LLM backend health: Vertex AI quota/availability on the frontier
   path, or the Ollama daemon on the on-prem path.
4. Check the most recent Cloud Run revision in the console — if the error
   started at a deploy, roll back (below).

### Escalation storm (too many turns escalating)

1. Review recent audit entries to see which tool / decision is escalating.
2. Check the **confidence threshold** setting
   (`GuardSettings.escalation_confidence_threshold`, default 0.6). A threshold
   set too high forces benign turns into escalation; a misbehaving LLM backend
   produces uniformly low confidence.
3. Confirm the LLM backend is healthy — degraded generation lowers confidence
   across the board.

### Corpus staleness (wrong or outdated regulatory answers)

1. Re-ingest:
   `uv run python scripts/ingest_regulations.py` then
   `uv run python scripts/seed_demo.py`.
2. Verify the chunk count after ingest — **expected ~238 chunks**. A materially
   different count signals a partial or duplicated ingest.

## Rollback

Shift traffic back to the last known-good revision:

```bash
gcloud run services update-traffic SERVICE \
  --region REGION \
  --to-revisions PREVIOUS_REVISION=100
```

Because traffic normally tracks `LATEST`, pinning to an explicit prior revision
takes effect immediately and freezes auto-promotion until you re-point at
`LATEST`.

## Local development

```bash
docker compose up -d postgres
uv run python scripts/run_local.py
```

This starts the `pgvector/pgvector:pg16` container and runs the agent locally.
With no Vertex project configured, the `auto` profile falls back to the on-prem
Ollama path — see `docs/on_prem.md` for the Ollama setup. Set
`TESSERA_LLM_PROFILE=on_prem` to force it.
