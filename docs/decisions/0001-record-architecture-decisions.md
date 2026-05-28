# 1. Record architecture decisions

Date: 2026-05-27

## Status

Accepted

## Context

Tessera is a portfolio-grade open source project with a hard twenty-day delivery window and a stated discipline of brutal honesty in its public documentation. Structural decisions — license, layout, orchestration framework, dependency boundaries — accumulate quickly during this kind of sprint, and the rationale behind each one is easily lost the moment the next decision is taken. A reader of the repository (recruiter, contributor, or future maintainer) who lands six months later on a question like "why Apache-2.0 and not MIT" or "why is the API code inside the Python package rather than under `webapp/`" deserves an authoritative, short answer that does not require archaeology through commit history or chat transcripts.

A standard exists for this: the Architecture Decision Record, as introduced by Michael Nygard in 2011 and now widely used across the industry. ADRs are short, numbered, immutable-once-accepted documents that capture the context of a decision, the decision itself, and its consequences. They are versioned alongside the code they describe.

## Decision

All structurally significant decisions in Tessera are recorded as Architecture Decision Records under `docs/decisions/`. Records are numbered sequentially starting at `0001`, named in kebab case after the decision (`NNNN-short-title.md`), and written in the Michael Nygard format: title, date, status, context, decision, consequences.

A decision is *structurally significant* if it constrains how subsequent work must be done — choice of license, package layout, orchestration framework, deployment target, language conventions, dependency boundaries, public interface contracts. Tactical implementation choices (variable naming, internal refactors, choice of utility library used once) do not require an ADR.

Once an ADR is accepted and merged, it is immutable in spirit. Reversing or revising a decision is done by writing a new ADR that supersedes the previous one, with the older ADR's status updated to `Superseded by ADR NNNN`. The historical record is preserved.

## Consequences

A reader of the repository can reconstruct the rationale for any structural choice in a single short document. Claude Code, when working in this repository, reads the ADR index before making changes that touch the constrained surface, which reduces the rate of well-intentioned but contradictory edits. The cost is a small ongoing writing discipline — perhaps fifteen minutes per decision — paid in exchange for clarity that compounds over the lifetime of the project. The first five ADRs (`0002` through `0005`, plus this one) were written together at project inception to fix the foundation before scaffolding begins.
