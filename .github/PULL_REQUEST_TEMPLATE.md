## Description

<!-- Describe the changes introduced by this PR. Be concise and focus on the "why", not just the "what". -->

## Type of change

- [ ] `feat:` — new feature
- [ ] `fix:` — bug fix
- [ ] `chore:` — tooling, dependencies, or maintenance
- [ ] `docs:` — documentation only
- [ ] `refactor:` — code restructuring without behaviour change
- [ ] `test:` — test additions or corrections
- [ ] `ci:` — CI/CD pipeline changes
- [ ] `perf:` — performance improvement

## Checklist

- [ ] `ruff check` and `ruff format` pass with no errors
- [ ] `mypy --strict` passes with no errors
- [ ] All existing tests pass (`pytest tests/unit/`)
- [ ] New tests added for any new behaviour (or absence documented below)
- [ ] Changes conform to the canonical repository structure in `docs/structure.md`
- [ ] No secrets, credentials, or PII committed (keys, tokens, `.env` files)
- [ ] Documentation updated if public interfaces or behaviour changed
- [ ] Prompts edited in YAML under `src/tessera/agent/prompts/` — not hardcoded in Python
- [ ] Policies edited in YAML under `src/tessera/guard/` — not hardcoded in Python

## Architectural change

- [ ] This PR introduces or modifies a structural decision

If checked, link the relevant ADR: `docs/decisions/NNNN-<slug>.md`

<!-- ADR link: -->

## Tests performed

<!-- Describe the tests you ran, including any manual verification steps. -->

```
# example
pytest tests/unit/ -v
```

## Deployment notes

<!-- If this PR requires infrastructure changes, migration steps, secret rotation, or any action at deploy time, describe them here. Leave blank if not applicable. -->

## Related issues

<!-- Closes #NNN -->
