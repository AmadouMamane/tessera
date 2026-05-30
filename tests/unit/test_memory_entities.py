"""Unit tests for literal entity extraction (ADR 0007, Tier 1).

These are the anti-degradation guarantees: the values a banking summary must not
distort have to be recalled verbatim.
"""

from __future__ import annotations

import pytest

from tessera.agent.state import ConversationMessage
from tessera.memory.entities import extract_entities, extract_from_messages


class TestAmounts:
    @pytest.mark.parametrize(
        "text",
        [
            "Votre solde est de 4 567,89 €.",
            "Saldo: 1.234,56 €",
            "Balance is 3,214.57 EUR",
            "€4,567.89 was debited",
            "un virement de 100 €",
            "amount of 1234.56 EUR",
        ],
    )
    def test_amounts_detected(self, text: str) -> None:
        assert extract_entities(text).amounts, f"no amount found in {text!r}"

    def test_amount_value_is_verbatim(self) -> None:
        led = extract_entities("Votre solde est de 4 567,89 €.")
        assert "4 567,89 €" in led.amounts


class TestAccountRefs:
    def test_iban_full(self) -> None:
        led = extract_entities("Mon IBAN est FR76 3000 4000 0500 0600 7000 195 svp.")
        assert any(ref.startswith("FR76 3000") for ref in led.account_refs)

    def test_account_number(self) -> None:
        led = extract_entities("le compte 00098123 de mon collègue")
        assert "00098123" in led.account_refs


class TestDates:
    @pytest.mark.parametrize(
        "text",
        ["le 12/03/2024", "am 12.03.2024", "on 2024-03-12", "le 12 mars 2024", "on March 12, 2024"],
    )
    def test_dates_detected(self, text: str) -> None:
        assert extract_entities(text).dates, f"no date in {text!r}"


class TestTickets:
    @pytest.mark.parametrize("text", ["dossier REF-12345", "ticket 123456", "référence: AB-9876"])
    def test_tickets_detected(self, text: str) -> None:
        assert extract_entities(text).ticket_refs, f"no ticket in {text!r}"


class TestCitations:
    @pytest.mark.parametrize(
        ("text", "needle"),
        [
            ("conformément à DORA Art. 28(3)", "DORA Art. 28(3)"),
            ("selon le RGPD", "RGPD"),
            ("une circulaire BaFin", "BaFin"),
            ("under GDPR Article 17", "GDPR Article 17"),
        ],
    )
    def test_citations_detected(self, text: str, needle: str) -> None:
        assert needle in extract_entities(text).citations


class TestProducts:
    def test_product_detected(self) -> None:
        assert "Crédit Aurore" in extract_entities("le Crédit Aurore est-il éligible ?").products


class TestMerge:
    def test_extract_from_messages_merges(self) -> None:
        msgs = [
            ConversationMessage(role="user", content="solde de 100 € sur DORA Art. 5"),
            ConversationMessage(role="assistant", content="et 200 € selon le RGPD"),
        ]
        led = extract_from_messages(msgs)
        assert "100 €" in led.amounts
        assert "200 €" in led.amounts
        assert any("DORA" in c for c in led.citations)
        assert "RGPD" in led.citations

    def test_empty_text(self) -> None:
        assert extract_entities("").is_empty()
