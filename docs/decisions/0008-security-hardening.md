# 0008 — Production security hardening (deployment-aware)

- Status: accepted
- Date: 2026-05-31
- Deciders: Tessera maintainers
- Supersedes: none
- Related: 0005 (tools vs workers), 0007 (agent memory), `docs/threat-model.md`,
  `docs/safety.md`

## Context

Tessera already ships a credible security baseline: a STRIDE threat model, a
runtime guard (`mcp-firewall`) on every tool call, PII redaction, bearer-token
auth, secrets in GCP Secret Manager, a private-IP database, and a CI security
workflow (CodeQL, pip-audit, bandit, gitleaks, trivy, guard-policy-lint).

A review for an *enterprise* production posture surfaced concrete gaps that the
baseline does not yet cover, and which the existing docs in places *claim* are
handled:

1. **`SECURITY.md` is a stub.** Both `threat-model.md` and `safety.md` point to a
   responsible-disclosure process that does not exist. Broken promise.
2. **No request rate limiting.** The threat model lists DoS as "mitigated" but
   the only lever is Cloud Run autoscaling — which *bills*, it does not *protect*.
   `/chat` invokes an LLM; unauthenticated or abusive volume is a direct cost and
   availability risk.
3. **`/audit` has no route-level authorization.** It is covered only by the
   *optional, global* bearer middleware. If the token is unset (the documented CI
   posture), the audit log — which contains operational detail and potentially
   PII — is world-readable. No defence in depth.
4. **No HTTP security headers on the API.** The Next.js front sets them; the API
   does not (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
   HSTS, a minimal CSP for the `/docs` surface).
5. **Unbounded aggregate request size.** `history` allows 40 × 8 000 chars with
   no global ceiling — a cost/DoS amplifier independent of rate limiting.
6. **No SBOM, no image provenance, no `.well-known/security.txt`.** Expected
   artefacts for an enterprise supply-chain story.

The non-negotiable framing from the README applies: **reuse, don't reinvent.**
This ADR adds an *opinionated assembly* of well-known controls; it invents no new
security mechanism.

## The deployment-mode distinction (the load-bearing decision)

Tessera runs in two very different trust environments, and a control that is
redundant in one is essential in the other. We make this explicit with a single
`deployment_mode` setting (`cloud_run | on_prem`) and gate behaviour on it.

- **Cloud Run** terminates TLS, autoscales, resolves secrets from Secret Manager,
  enforces IAM, and reaches the database over private VPC egress. Several
  app-level controls here are *defence in depth* on top of the platform.
- **On-prem** (Llama 3.3 70B on Apple Silicon) has **none** of that by default.
  There is no managed LB, no Secret Manager, no platform rate limiter, and the
  model weights are pulled from a third-party registry. App-level controls are
  the *primary* line of defence, not a backstop.

### Control × deployment-mode matrix

| Control | Cloud Run | On-prem | Notes |
|---|---|---|---|
| Bearer auth (`/chat`, `/audit`, `/memory`) | required | required | unchanged; `secrets.compare_digest` |
| Route-level authz on `/audit`, `/memory` | required | required | defence in depth, not just global middleware |
| Rate limiting | recommended | **required** | redundant behind a cloud LB, primary on-prem |
| Security headers | yes | yes | HSTS only when TLS is terminated upstream |
| HSTS | on (TLS at Cloud Run) | **opt-in** | on-prem may run plain HTTP behind a proxy → `hsts` flag |
| Secret source | Secret Manager | file / env (documented) | never baked into the image |
| Image signing / SLSA | yes (OIDC keyless) | advisory | provenance verified at deploy on cloud |
| Ollama weight verification | n/a | **operator step** | documented gap (threat-model); pin digest, verify on a trusted host |
| Payload size caps | yes | yes | identical app-level limits |

The rule: **on-prem turns every "recommended" into "required"**, because there is
no platform underneath to lean on.

## Decision

Ship a deployment-aware hardening layer in five parts, each reusing a
battle-tested mechanism and adding only thin, auditable glue:

1. **Rate limiting** via `slowapi` (Starlette-native, `limits` under the hood).
   Keyed by bearer-token identity when present, else client IP. Applied to
   `/chat` (strict) and the read endpoints (looser). In-memory store by default;
   a Redis URL may be configured for multi-instance Cloud Run. Default limits are
   settings-driven and *enforced* on-prem.

2. **Route-level authorization** for `/audit` and `/memory` via a FastAPI
   dependency, independent of the global middleware. When auth material is
   configured, these routes require it even if the global middleware is bypassed;
   the dependency also scopes/redacts further. The audit reader keeps redacting
   PII-shaped fields it surfaces.

3. **Security headers** via a small, deployment-aware middleware (≈30 lines,
   following the existing middleware pattern rather than importing a library, so
   the header set stays auditable and mode-conditional). HSTS only when
   `tls_terminated` is true.

4. **Request hardening**: a global request-body ceiling (in addition to the
   per-field Pydantic caps) and a conservative aggregate `history` budget.

5. **Supply chain & disclosure**: a real `SECURITY.md` with a coordinated
   disclosure process, a `.well-known/security.txt`, a CycloneDX **SBOM** job in
   CI, **cosign keyless** image signing + SLSA provenance for the agent image,
   and a `detect-secrets` baseline alongside the existing gitleaks scan.
   Dockerfile hardening (non-root user, no build tooling in the final stage).

Crypto and authentication primitives are **never** hand-rolled. New runtime
dependency footprint is limited to `slowapi`; SBOM/signing/secret-scan tooling is
CI-only and adds nothing to the runtime image.

## Consequences

**Positive.** The posture matches the claims already made in the threat model;
on-prem deployments — the weakest environment — get the strongest app-level
defences; the supply-chain story (SBOM + provenance) becomes verifiable; the
disclosure promise is kept.

**Negative / costs.** One new runtime dependency (`slowapi`). Rate-limit defaults
need tuning per environment. cosign/SLSA jobs only run in GitHub Actions and
cannot be validated on a developer laptop — they are reviewed, not locally
executed. Redis is optional but recommended for multi-instance correctness of
rate limits on Cloud Run (in-memory limits are per-instance).

**Explicitly out of scope.** WAF rules, mTLS between services, full IAM redesign,
and automated Ollama weight signature verification (kept as a documented
operator step, consistent with the threat model's open risk).

## Verification

Each part lands as its own commit, green under `ruff`, `mypy --strict`, and
`pytest` (`tests/unit` always; integration where infra allows). New unit tests
cover: rate-limit trip + reset, `/audit` and `/memory` rejecting unauthenticated
access when auth is configured, security headers present (and HSTS gated on
mode), and request-size rejection. CI-only artefacts (SBOM, cosign, SLSA) are
asserted by workflow presence and a dry-run where possible.
