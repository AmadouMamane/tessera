"""Synthetic Crédit Aurore product corpus generator.

The catalogue is small and deterministic — three product lines per language,
each described in a short, evaluation-friendly page. The generator's only
job is to materialise the catalogue into JSON files under ``data/`` so the
ingestion script can pick them up.

The catalogue text is editorial — it is *not* drawn from any real bank's
materials. Keep it that way.
"""

from __future__ import annotations

import argparse
import importlib.resources as resources
import json
from dataclasses import asdict, dataclass
from pathlib import Path

from tessera.settings import LanguageCode


@dataclass(frozen=True, slots=True)
class ProductPage:
    """One product page in one language."""

    source: str
    language: LanguageCode
    text: str
    metadata: dict[str, str]


_CATALOGUE: dict[LanguageCode, tuple[ProductPage, ...]] = {
    LanguageCode.FR: (
        ProductPage(
            source="credit-aurore-livret-aurore",
            language=LanguageCode.FR,
            text=(
                "Le Livret Aurore est un livret d'épargne réglementé proposé par "
                "Crédit Aurore. Le taux d'intérêt en vigueur est de 3,00% net, "
                "révisé deux fois par an. Le plafond de versement est fixé à "
                "22 950 € hors capitalisation des intérêts. Les retraits sont "
                "libres et sans frais."
            ),
            metadata={"product": "savings", "locator": "livret-aurore"},
        ),
        ProductPage(
            source="credit-aurore-pret-immobilier-classique",
            language=LanguageCode.FR,
            text=(
                "Le Prêt Immobilier Aurore est un prêt à taux fixe ou variable "
                "destiné à financer l'acquisition d'une résidence principale, "
                "secondaire, ou un investissement locatif. La durée maximale "
                "est de 25 ans. Une assurance emprunteur conforme à la loi "
                "Lemoine est requise. Les frais de dossier s'élèvent à 1% du "
                "montant emprunté, plafonnés à 1 500 €."
            ),
            metadata={"product": "mortgage", "locator": "pret-immobilier"},
        ),
    ),
    LanguageCode.DE: (
        ProductPage(
            source="credit-aurore-aurore-sparen",
            language=LanguageCode.DE,
            text=(
                "Das Aurore-Sparbuch ist ein reguliertes Sparprodukt der "
                "Crédit Aurore. Der aktuelle Zinssatz beträgt 3,00% p.a. und "
                "wird halbjährlich überprüft. Die Einzahlungsobergrenze liegt "
                "bei 22 950 EUR ohne Zinskapitalisierung. Abhebungen sind "
                "jederzeit gebührenfrei möglich."
            ),
            metadata={"product": "savings", "locator": "aurore-sparen"},
        ),
        ProductPage(
            source="credit-aurore-baufinanzierung",
            language=LanguageCode.DE,
            text=(
                "Die Aurore-Baufinanzierung ist ein Hypothekendarlehen mit "
                "fester oder variabler Verzinsung zur Finanzierung von "
                "selbstgenutztem oder vermietetem Wohneigentum. Die maximale "
                "Laufzeit beträgt 25 Jahre. Eine konforme Restschuld- bzw. "
                "Risikolebensversicherung ist erforderlich. Die Bearbeitungs"
                "gebühr beträgt 1% der Darlehenssumme, höchstens 1 500 EUR."
            ),
            metadata={"product": "mortgage", "locator": "baufinanzierung"},
        ),
    ),
    LanguageCode.EN: (
        ProductPage(
            source="credit-aurore-aurore-savings",
            language=LanguageCode.EN,
            text=(
                "The Aurore Savings Account is a regulated savings product "
                "offered by Crédit Aurore. The current interest rate is 3.00% "
                "net, reviewed twice a year. The deposit cap is EUR 22,950 "
                "excluding capitalised interest. Withdrawals are free and "
                "available on demand."
            ),
            metadata={"product": "savings", "locator": "aurore-savings"},
        ),
        ProductPage(
            source="credit-aurore-aurore-mortgage",
            language=LanguageCode.EN,
            text=(
                "The Aurore Mortgage is a fixed- or variable-rate home loan "
                "designed for the purchase of a primary or secondary "
                "residence, or for buy-to-let investment. The maximum term "
                "is 25 years. A compliant loan-protection insurance policy "
                "is required. The arrangement fee is 1% of the loan amount, "
                "capped at EUR 1,500."
            ),
            metadata={"product": "mortgage", "locator": "aurore-mortgage"},
        ),
    ),
}


def _resolve_data_dir() -> Path:
    package = resources.files("tessera.corpus.data")
    return Path(str(package))


def _write_corpus(language: LanguageCode, pages: tuple[ProductPage, ...]) -> Path:
    target = _resolve_data_dir() / f"credit_aurore_{language.value}.json"
    payload = [
        {
            "source": page.source,
            "language": page.language.value,
            "text": page.text,
            "metadata": page.metadata,
        }
        for page in pages
    ]
    target.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return target


async def main(argv: list[str] | None = None) -> int:
    """CLI entry point — writes one JSON file per language."""
    parser = argparse.ArgumentParser(description="Generate the demo product corpus.")
    parser.add_argument(
        "--language",
        choices=[lang.value for lang in LanguageCode],
        help="Generate only one language; default is all three.",
    )
    args = parser.parse_args(argv)
    targets = (
        [LanguageCode(args.language)]
        if args.language
        else list(LanguageCode)
    )
    for language in targets:
        path = _write_corpus(language, _CATALOGUE[language])
        print(f"wrote {path}")  # noqa: T201
    return 0
