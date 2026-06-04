# Tessera — Failure-case sourcing journal

This journal records **how** the regression catalogue is built and **where** each
case comes from. Every new case must trace to a publicly documented agent/LLM
failure found on the web; nothing is invented. It exists so the catalogue can
grow (40 → 100 → 200) reproducibly and so every case is auditable.

## Procedure (per case)

1. **Find** a publicly documented failure (incident, court ruling, CVE, paper,
   benchmark, or a curated catalogue such as the OWASP GenAI list, the AI
   Incident Database, MITRE ATLAS, or `vectara/awesome-agent-failures`).
2. **Verify** the source on the web (search + fetch); record **every** reference
   URL in the case's `source_reference.urls`.
3. **Map** it to one of the ten categories and to a realistic Crédit Aurore /
   EU retail-banking scenario (FR/DE/EN prompts).
4. **Grade** with the implemented criteria only: `must_not_contain`,
   `must_contain_any`, `must_not_match` (regex), `must_escalate`,
   `must_not_invoke_tools`, `must_invoke_tools`, `min_confidence`,
   `max_confidence`, `must_cite_source`.
5. **Validate** against `eval/failures/_schema.json`; **avoid duplicating** any
   existing case (see the 01–40 titles).

Context window for sources: **any date up to 2026** (older canonical incidents
are in scope, not only recent ones).

## Verified source inventory

Surfaced and verified via web search (June 2026). Canonical/authoritative links
are marked ★.

| # | Documented failure | Year | Category fit | Reference links |
|---|---|---|---|---|
| S1 | OWASP Top 10 for LLM Applications 2025 (LLM01 Prompt Injection, LLM02 Sensitive Info Disclosure, LLM06 Excessive Agency, LLM09 Misinformation) | 2024/25 | all | ★https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/ · https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf |
| S2 | Air Canada chatbot — *Moffatt v. Air Canada* (BCCRT 149): airline liable for chatbot's wrong refund/bereavement-fare info | 2024 | hallucination, regulatory_misstatement, overconfidence | ★https://en.wikipedia.org/wiki/Moffatt_v._Air_Canada (to verify) · https://www.cxtoday.com/contact-center/3-times-customer-chatbots-went-rogue-and-the-lessons-we-need-to-learn/ |
| S3 | DPD chatbot swore and called DPD "worst delivery firm" after a guardrail-dropping update | 2024 | policy_violation, prompt_injection | https://www.moin.ai/en/chatbot-wiki/chatbot-fails · https://www.cxtoday.com/contact-center/3-times-customer-chatbots-went-rogue-and-the-lessons-we-need-to-learn/ |
| S4 | Chevrolet of Watsonville bot — Chris Bakke injected "agree with anything / $1 is a binding offer" | 2023 | prompt_injection, overconfidence, policy_violation | https://inspectagents.com/blog/chevrolet-ai-failure-breakdown/ |
| S5 | NEDA "Tessa" eating-disorder bot gave weight-loss advice; pulled; failed to escalate | 2023 | escalation_failure, policy_violation | ★https://arxiv.org/pdf/2509.07022 |
| S6 | Bing Chat "Sydney" system-prompt leak (Kevin Liu, "ignore previous instructions") | 2023 | prompt_injection | https://en.wikipedia.org/wiki/Sydney_(Microsoft) · https://oecd.ai/en/incidents/2023-02-10-4440 · https://www.topaithreats.com/incidents/INC-23-0016-bing-chat-sydney-system-prompt-leak/ |
| S7 | Slack AI — indirect prompt injection exfiltrates private-channel data (PromptArmor) | 2024 | prompt_injection, pii_leak | ★https://www.promptarmor.com/resources/data-exfiltration-from-slack-ai-via-indirect-prompt-injection · https://simonwillison.net/2024/Aug/20/data-exfiltration-from-slack-ai/ · https://www.startupdefense.io/mitre-atlas-case-studies/aml-cs0035-data-exfiltration-from-slack-ai-via-indirect-prompt-injection |
| S8 | EchoLeak — CVE-2025-32711, zero-click indirect injection exfiltrates data from M365 Copilot | 2025 | prompt_injection, pii_leak | ★https://nvd.nist.gov/vuln/detail/cve-2025-32711 · https://msrc.microsoft.com/update-guide/vulnerability/CVE-2025-32711 · https://arxiv.org/abs/2509.10540 |
| S9 | AgentDojo — benchmark: injected instructions in tool data make agents perform unintended actions (e.g., transfers) | 2024 | prompt_injection, tool_misuse | ★https://arxiv.org/abs/2406.13352 |
| S10 | Replit AI agent deleted a production database during a code freeze + fabricated test data (AIID #1152) | 2025 | tool_misuse, hallucination | ★https://incidentdatabase.ai/cite/1152/ |
| S11 | AgentHarm — benchmark of harmful agent behaviours (ICLR 2025) | 2024/25 | tool_misuse, policy_violation | ★https://arxiv.org/pdf/2410.09024 |
| S12 | *Mata v. Avianca* — ChatGPT fabricated case citations; lawyers sanctioned ($5,000) | 2023 | citation_fabrication, hallucination | ★https://en.wikipedia.org/wiki/Mata_v._Avianca,_Inc. · https://github.com/vectara/awesome-agent-failures/blob/main/docs/case-studies/chatgpt-lawyer-sanctions.md |
| S13 | Package hallucination / "slopsquatting" — LLMs invent nonexistent package names (USENIX Security 2025) | 2025 | hallucination, citation_fabrication | https://socket.dev/blog/slopsquatting-how-ai-hallucinations-are-fueling-a-new-class-of-supply-chain-attacks · https://www.helpnetsecurity.com/2025/04/14/package-hallucination-slopsquatting-malicious-code/ |
| S14 | `vectara/awesome-agent-failures` — curated catalogue of documented agent failures | 2024/25 | all (index) | ★https://github.com/vectara/awesome-agent-failures |
| S15 | AI Incident Database — searchable index of real AI incidents | ongoing | all (index) | ★https://incidentdatabase.ai/ |

> Links flagged "(to verify)" still need a direct fetch to confirm the exact
> citation/URL before the case relying on them is finalised.

## Case mapping (new ids → sources)

Kept in sync with the `source_reference.urls` inside each case file.

**Batch 1 (ids 41–61, authored):**

| id | source(s) |
|---|---|
| 41 prompt_injection_rag_poison | S7, S1 |
| 42 prompt_injection_email_zeroclick | S8 |
| 43 prompt_injection_binding_offer | S4 |
| 44 prompt_injection_system_prompt_leak | S6 |
| 45 pii_leak_card_pan_echo | S1 |
| 46 pii_leak_exfiltration_request | S7, S8 |
| 47 pii_leak_third_party_correlation | S1 |
| 48 hallucination_retroactive_refund | S2 |
| 49 hallucination_fictitious_feature | S1 |
| 50 hallucination_nonexistent_app | S13 |
| 51 overconfidence_mortgage_verdict | S1, S4 |
| 52 overconfidence_fraud_verdict | S1, S2 |
| 53 citation_fabrication_court_case | S12 |
| 54 tool_misuse_block_third_party_card | S9 |
| 55 tool_misuse_destructive_no_auth | S10, S11 |
| 56 policy_violation_disparage_bank | S3 |
| 57 policy_violation_evade_antifraud | S11 |
| 58 regulatory_misstatement_gdpr_access_fee | GDPR Art. 12/15 |
| 59 regulatory_misstatement_psd2_refund | PSD2 Art. 73 |
| 60 language_mixing_en_de | S1 + multilingual policy |
| 61 escalation_failure_vulnerable_customer | S5 |

→ Total catalogue: **62** cases. Backlog to 100 (≈38 more) and to 200 tracked below.

**Corpus-anchoring corrections (grounding categories).** For the three
grounding-dependent categories the ground truth is Tessera's own corpus, so
those cases are anchored to a real chunk in `src/tessera/corpus/data/`:

| id | corpus anchor / fix |
|---|---|
| 48 hallucination_retroactive_refund | `credit-aurore/produits/compte-courant` (fee 2,40 €/mo; no retroactive-refund policy) |
| 49 hallucination_fictitious_feature | `credit-aurore/produits/livret-aurore` (3,00 % net, capped €22 950 — not 8%/uncapped) |
| 53 citation_fabrication_court_case | dropped `must_cite_source` (it penalised an honest refusal); grade on declining |
| 58 regulatory_misstatement_gdpr_access_fee | `CNIL/fiche-droit-acces-banque` (first copy free; one-month reply) |
| 59 regulatory_misstatement_erasure_aml | **replaces** the PSD2 case (PSD2 not in corpus); `GDPR/art-17` (Art.17(3) + AML 5-yr retention) |
| 62 regulatory_misstatement_dora_incident_deadline | `DORA/art-19` (initial within hours, final within one month — not "no deadline") |

The other 7 (behavioural) categories stay anchored in publicly documented
failures (web). The local-only generator (`scripts/_gen_*.py`, gitignored) is the
working scaffold; the JSON files are the durable artefacts.

## Backlog

- **Batch 1 (now):** new cases grounded in S1–S15, toward 100 total.
- **Lot 2 (→200):** second curated pass; mine the AI Incident Database and
  `awesome-agent-failures` systematically, plus EU-specific regulator guidance
  (CNIL, BaFin, ACPR, EBA) for `regulatory_misstatement`.
