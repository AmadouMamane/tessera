"""Seed the local pgvector database with the demo corpora.

Reads the JSON files under ``src/tessera/corpus/data/``, chunks each
document, embeds the chunks with the active backend, and inserts them into
the documents table.

The script is idempotent — re-running over an already-seeded database is a
no-op (each chunk has a unique ``(corpus, source, chunk_id)`` key).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from importlib import resources

from tessera.observability.logging import get_logger
from tessera.retrieval import embeddings
from tessera.retrieval.chunking import chunk_text
from tessera.retrieval.store import DocumentRecord, ensure_schema, insert_documents
from tessera.settings import LanguageCode

LOG = get_logger("tessera.seed_demo")


_CORPUS_FILES: dict[str, tuple[str, LanguageCode]] = {
    "credit_aurore_fr.json": ("credit_aurore", LanguageCode.FR),
    "credit_aurore_de.json": ("credit_aurore", LanguageCode.DE),
    "credit_aurore_en.json": ("credit_aurore", LanguageCode.EN),
}


async def _ingest_file(filename: str, corpus: str, language: LanguageCode) -> int:
    package = resources.files("tessera.corpus.data")
    target = package.joinpath(filename)
    if not target.is_file():
        LOG.warning("seed.skip_missing", filename=filename)
        return 0

    payload = json.loads(target.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise TypeError(f"{filename}: expected a JSON list of documents")

    records: list[DocumentRecord] = []
    for doc in payload:
        source = str(doc["source"])
        text = str(doc["text"])
        metadata = {str(k): str(v) for k, v in (doc.get("metadata") or {}).items()}
        chunks = chunk_text(text, language=language)
        if not chunks:
            continue
        chunk_texts = [c.text for c in chunks]
        vectors = await embeddings.embed(chunk_texts)
        for idx, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True)):
            records.append(
                DocumentRecord(
                    corpus=corpus,
                    source=source,
                    chunk_id=f"{source}#{idx:04d}",
                    language=language,
                    text=chunk.text,
                    embedding=vector,
                    metadata=metadata,
                )
            )

    inserted = await insert_documents(records)
    LOG.info(
        "seed.ingested",
        filename=filename,
        corpus=corpus,
        language=language.value,
        records=len(records),
        inserted=inserted,
    )
    return inserted


async def _main(args: argparse.Namespace) -> int:
    LOG.info("seed.start", filter=args.only)
    await ensure_schema()
    total = 0
    for filename, (corpus, language) in _CORPUS_FILES.items():
        if args.only and args.only not in {corpus, language.value, filename}:
            continue
        total += await _ingest_file(filename, corpus, language)
    LOG.info("seed.done", inserted=total)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed Tessera's pgvector store.")
    parser.add_argument("--only", help="Restrict to one corpus or language code.")
    args = parser.parse_args(argv)
    return asyncio.run(_main(args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
