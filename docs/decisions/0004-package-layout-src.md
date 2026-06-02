# 4. Package layout: `src/` over flat

Date: 2026-05-27

## Status

Accepted

## Context

A Python package can be laid out in two ways. In the *flat layout*, the importable package directory lives at the repository root next to `pyproject.toml`: `tessera/tessera/__init__.py`. In the *src layout*, the importable package lives one level deeper inside a `src/` directory: `tessera/src/tessera/__init__.py`. The distinction looks cosmetic and is often dismissed as such, but it has real consequences for packaging hygiene and for the divergence between development-time and install-time behaviour.

Under the flat layout, Python's import machinery resolves `import tessera` against the repository root as soon as the current working directory contains `tessera/`. This works at development time without any installation step, which is convenient. It also means that test runs, scripts, and interactive sessions exercise the source tree rather than the installed package. Bugs that only manifest after `pip install` — missing `__init__.py` files in subpackages, files excluded from the wheel, package data not declared in `pyproject.toml` — are invisible until the very last moment, typically when building the distribution for PyPI.

Under the src layout, `import tessera` resolves only against installed packages, because `src/` is not on `sys.path` by default. The developer is forced to install the package, even in editable mode (`uv pip install -e .`), before importing it. Every test run, every script, every notebook now exercises the package as it will be installed by a downstream user. Packaging bugs surface immediately at install time, not at release time.

The Python Packaging Authority has recommended the src layout in its official guide since 2020. The recommendation has been adopted by NumPy, pandas, Flask, Requests, Pydantic, FastAPI, LangChain, LangGraph, Instructor, and the majority of recent serious Python infrastructure projects. The flat layout remains common in older codebases and in tutorials oriented at beginners, but it is no longer the convention for production-grade libraries.

Tessera is intended to be published on PyPI and to be importable by external adopters. The cost of switching from flat to src is approximately zero at inception and significant after the first dozen contributors have built mental models around the existing structure. The decision is therefore taken now.

## Decision

Tessera adopts the `src/` layout. The importable package lives at `src/tessera/`. The `pyproject.toml` declares `[tool.setuptools.packages.find] where = ["src"]` (or the equivalent for whichever build backend is selected, currently `hatchling` as the `uv` default). The project's package is installed in editable mode during development via `uv sync`, which performs the editable install behind the scenes.

Tests, scripts, and ad-hoc imports always go through the installed package. The repository root is *not* added to `sys.path` by any tooling. The `Makefile`'s `install` target ensures `uv sync` has been run before any other target executes.

## Consequences

Packaging bugs surface at development time rather than at release time. The cost of building a PyPI distribution drops to near zero because every test run exercises the package in its installed form. Alignment with the broader Python ecosystem makes the project legible to contributors and reviewers familiar with modern Python packaging.

The cost is a single small habit — running `uv sync` once after cloning the repository, before any other command. This is documented in the `README.md` quickstart and enforced by the `Makefile`. Contributors arriving from older flat-layout projects may briefly stumble on `ModuleNotFoundError` until they run `uv sync`; the README addresses this proactively.
