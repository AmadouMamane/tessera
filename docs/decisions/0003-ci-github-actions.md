# 3. CI/CD with GitHub Actions

Date: 2026-05-27

## Status

Accepted

## Context

Tessera is hosted on GitHub at `github.com/AmadouMamane/tessera`. It needs a continuous integration pipeline that runs lint, type check, unit tests, and security scans on every push and pull request, a separate pipeline for the LLM-driven regression harness (which is expensive and slow and must not run on every push), and a deployment pipeline that builds the container image and pushes it to Google Cloud Run when a tagged release is cut. The candidates are GitHub Actions, GitLab CI (mirrored from the GitHub repository), and Google Cloud Build.

GitHub Actions is natively integrated with the hosting platform. No mirroring step, no external runner registration, no token bridging. Workflows live as YAML files under `.github/workflows/` in the same repository they operate on, which makes them auditable in the same code review loop as the code itself. The free tier for public repositories is generous enough to cover Tessera's expected volume — unlimited Linux build minutes for public repos at the time of writing — which matters for a portfolio project budgeted on a free or near-free runtime. The marketplace ecosystem is mature: `astral-sh/setup-uv`, `actions/setup-python`, `actions/cache`, `google-github-actions/auth`, and the Trivy and Bandit scanners all exist as well-maintained reusable actions.

GitLab CI is technically superior on a few dimensions (notably DAG-style needs and the built-in container registry), but it would require either moving the repository or maintaining a mirror, and the secondary tooling (Cloud Run deploy, dependency review, CodeQL) is GitHub-native. The complexity-to-benefit ratio does not justify the move for a twenty-day project.

Google Cloud Build runs inside the GCP tenant where Tessera is deployed and benefits from native identity federation with Cloud Run. It is an attractive secondary pipeline but a poor primary one: build status is not surfaced cleanly on the GitHub pull request UI without additional plumbing, and the marketplace of reusable steps is narrower. The right place for Cloud Build, if it appears at all, is as a secondary deployment-only pipeline triggered after the GitHub Actions release workflow tags an image.

## Decision

GitHub Actions is the sole CI/CD platform for Tessera. Four workflows live under `.github/workflows/`:

- `ci.yml` runs on every push and pull request. It executes `uv sync`, `ruff check`, `ruff format --check`, `mypy --strict`, and `pytest tests/unit/`. Integration tests under `tests/integration/` run conditionally when the `integration` label is set on the pull request or on push to `main`.
- `eval.yml` runs the regression harness against the failure catalog under `eval/failures/`. It runs on schedule (nightly) and on pull requests labelled `eval`. It does not run on every push because it consumes paid LLM API quota.
- `deploy.yml` runs on tag push matching `v*.*.*`. It builds the agent and frontend container images, pushes them to Artifact Registry, and triggers a Cloud Run revision deployment. Authentication to GCP uses Workload Identity Federation, not long-lived service account keys.
- `security.yml` runs on every push, pull request, and weekly schedule. It runs Trivy on the container images, `pip-audit` and `bandit` on the Python sources, `gitleaks` on the working tree, and CodeQL on the repository.

Cloud Build is not used. If a future ADR introduces a GCP-internal build path for compliance or supply-chain reasons, this decision is superseded at that time.

## Consequences

Pipeline definitions are versioned in the same repository as the code they build, which makes every CI change reviewable in the same workflow as a code change. Engineers and recruiters familiar with the GitHub ecosystem can read and trust the pipelines without context-switching. The four-workflow split keeps the per-push feedback loop fast (`ci.yml` and `security.yml` only) while isolating the expensive evaluation pipeline so a noisy commit history does not burn the LLM budget.

The cost is a single-vendor dependency on GitHub for the CI surface; should GitHub's pricing or policy change adversely, Tessera would need to migrate. This risk is judged acceptable for the project window and the project size.
