.PHONY: install lint typecheck test format precommit

install:
	uv sync

lint: install
	uv run ruff check .

typecheck: install
	uv run mypy src/tessera

test: install
	uv run pytest tests/unit/

format: install
	uv run ruff format .

precommit: install
	uv run pre-commit run --all-files
