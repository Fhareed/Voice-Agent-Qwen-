# LumiDesk — Compliance Reference & Implementation Checklist (EU AI Act + GDPR + Call-Recording Consent)

> ⚠️ **DISCLAIMER — NOT LEGAL ADVICE.** This document is **factual research compiled for product planning**, not legal advice. It summarizes laws and regulator guidance with source links as of **November 2026**. Laws change, member-state rules differ, and the application to LumiDesk's exact setup depends on facts. **A qualified EU data-protection lawyer must review this (and ideally a Finnish privacy counsel for the Finland/EU core market) before go-live** and before any contract or privacy notice is published.

---

## 0. TL;DR — the regimes that apply to LumiDesk

LumiDesk is an **AI voice receptionist SaaS**: an AI agent (on Retell AI) answers inbound calls, talks in real time, **records + transcribes**, captures the caller's **name + phone number**, and **books appointments** (Supabase/Postgres data, Twilio SMS, Google Calendar). Customers = businesses (mostly Finland/EU). Callers = those businesses' end customers (natural persons).

Three bodies of law apply simultaneously:

| Regime | Why it applies to LumiDesk | Core duty it creates |
|---|---|---|
| **EU AI Act – Art. 50 transparency** | The AI agent "interacts directly with natural persons" (callers). | Callers must be **told they are talking to an AI**, at the latest at first interaction. |
| **GDPR** | The agent collects voice, name, phone number, transcripts = **personal data** of EU callers; customers/callers are in the EU. | Lawful basis, privacy notice, data-subject rights, retention limits, processor/controller roles, DPAs, lawful international transfers. |
| **ePrivacy Directive (2002/58/EC) + national call-recording rules** | Recording/transcribing a phone call = interception/storage of a communication. | Confidentiality of communications; **recording consent/notice** — rules **vary by member state**. |

**Who is who under GDPR:** The **business customer is the data controller** (decides to deploy an AI receptionist and why). **LumiDesk is a processor** acting on the customer's instructions. **Retell, Twilio, Supabase, Google are sub-processors.** This split drives most of the checklist below.

---

## PART A — Which laws apply and why (with citations)

### A1. EU AI Act — Article 50 transparency (must a caller be told it's an AI? YES)

**The rule.** Providers must design AI systems that interact directly with natural persons so those persons **are informed that they are interacting with an AI system**, *unless this is obvious to a reasonably well-informed, observant and circumspect person given the context*. The information must be given **clearly and distinguishably at the latest at the time of the first interaction or exposure**, and meet accessibility requirements.
Source: EU AI Act Art. 50(1) and 50(5) — https://artificialintelligenceact.eu/article/50/

- A phone caller does **not** reliably know they've reached an AI, so the "obvious from context" exception should **not** be relied on. Disclose explicitly.
- Art. 50 also covers marking AI-generated synthetic audio/content as machine-readable (Art. 50(2)/(4)). A live two-way receptionist conversation is primarily an Art. 50(1) "interaction" case; if LumiDesk ever generates/plays synthetic media that could be mistaken for a real recording, revisit 50(2).

**Timeline / enforcement (this is live NOW).** Article 50 transparency obligations became **applicable and enforceable on 2 August 2026**, for AI systems regardless of risk level. Enforced by national competent authorities. The "AI Omnibus" deferred the *high-risk* obligations but **left the transparency duties unchanged / on the original timetable**. A narrow carve-out gave providers of pre-existing generative systems until **2 December 2026** to meet machine-readable marking.
Source: Goodwin, *EU AI Act Transparency Obligations Are Now in Force* (Aug 2026) — https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force
Source (article text + timeline): https://artificialintelligenceact.eu/article/50/

**Penalties.** Non-compliance with transparency duties can draw fines up to **€15 million or 3% of worldwide annual turnover**, whichever is higher.
Source: Goodwin (above); AI Act Art. 99 — https://artificialintelligenceact.eu/article/99/

> **Bottom line:** LumiDesk must build an AI self-disclosure into the start of every call. This is not optional and is already in force.

---

### A2. GDPR

LumiDesk processes personal data of EU callers (voice, transcript, name, phone number, appointment details). Full GDPR text: https://gdpr-info.eu

**A2.1 Lawful basis (Art. 6).** Every processing purpose needs a lawful basis. Likely mix:
- *Booking the appointment / handling the caller's request* → **Art. 6(1)(b) contract / steps at the caller's request**, or **6(1)(f) legitimate interests** of the business. https://gdpr-info.eu/art-6-gdpr/
- *Recording + transcription* → the lawful basis is contested and **often consent is required** at national level (see A3). Treat recording as its own purpose with its own basis.
- The **lawful basis is the controller's (the business customer's) call** — LumiDesk must give customers the tooling and guidance to set and document it, and must obtain the needed notices/consents per the Retell DPA allocation of responsibility. Source: Retell DPA §3.3(b) (customer establishes lawful bases, gives notices, obtains consents) — https://retellai.com/legal/data-processing-addendum

**A2.2 Privacy notice / transparency (Art. 13).** When personal data is collected from the data subject, they must be told (at collection): controller identity + contact, DPO if any, purposes + lawful basis, legitimate interests if relied on, recipients/sub-processors, international transfers + safeguards, retention period, their rights, right to withdraw consent, right to complain to a supervisory authority. https://gdpr-info.eu/art-13-gdpr/
- Practical challenge: a **voice channel** can't show a privacy policy. Deliver a **short spoken notice at call start** + point callers to a **full written privacy notice** (URL via SMS, business website, or on the number's web page).

**A2.3 Data-subject rights.** Callers can exercise:
- **Access (Art. 15)** — a copy of their data incl. the recording/transcript. https://gdpr-info.eu/art-15-gdpr/
- **Erasure / "right to be forgotten" (Art. 17)** — delete their data. https://gdpr-info.eu/art-17-gdpr/
- Also rectification (16), restriction (18), portability (20), objection (21).
LumiDesk must be able to **find, export, and delete all data for a given caller (by phone number)** across Retell, Supabase, Twilio logs and Google Calendar, and help the customer-controller answer requests. Retell forwards data-subject requests to the customer and assists (Retell DPA §7).

**A2.4 Retention / storage limitation (Art. 5(1)(e)).** Personal data kept no longer than necessary. https://gdpr-info.eu/art-5-gdpr/
- ⚠️ **Retell default stores recordings & transcripts indefinitely** in session history unless disabled; retention is configurable and storage can be turned off. LumiDesk must set a **defined, documented retention period** and configure Retell accordingly — do not leave the "store forever" default. Source: Retell AI community thread on EU GDPR/residency — https://community.retellai.com/t/eu-client-gdpr-compliance-data-residency-subprocessors-dpa-full-breakdown-questions-for-the-team/2332

**A2.5 Records of processing (Art. 30).** As a processor, LumiDesk must maintain a record of processing activities carried out on behalf of controllers. https://gdpr-info.eu/art-30-gdpr/

**A2.6 Security (Art. 32).** Appropriate technical/organisational measures (encryption in transit/at rest, access control, breach response). https://gdpr-info.eu/art-32-gdpr/

**A2.7 Controller vs processor (Art. 28) + sub-processor DPAs.** Processing by a processor must be governed by a **binding written contract (DPA)** setting out subject-matter, duration, nature/purpose, data types, data-subject categories, and the controller's rights; it must bind the processor to act only on documented instructions, ensure confidentiality, apply Art. 32 security, assist with data-subject rights and Art. 32–36 duties, delete/return data at end, and allow audits. A processor **may not engage a sub-processor without the controller's prior (specific or general) written authorisation**, and must **flow down the same data-protection obligations**; the processor stays **fully liable** for its sub-processors. https://gdpr-info.eu/art-28-gdpr/

This creates a **two-layer DPA chain** LumiDesk must have in place:
1. **LumiDesk ⇄ its business customers** — LumiDesk's own DPA (LumiDesk as processor) incorporated into the SaaS terms, with a published sub-processor list + change-notice/objection rights.
2. **LumiDesk ⇄ each sub-processor** (Retell, Twilio, Supabase, Google) — sign/accept their DPAs with flow-down terms:
   - **Retell** — DPA available at https://retellai.com/legal/data-processing-addendum (Retell = processor; Module 2 controller-processor and Module 3 processor-processor; sub-processor list at trust.retellai.com/subprocessors; 15 days' notice of new sub-processors, 10-day objection window; SOC 2 Type II; breach notice without undue delay; deletion on termination). **Confirm the DPA is expressly incorporated into your Retell agreement** — per its own terms it only applies if referenced. Source: Retell DPA — https://retellai.com/legal/data-processing-addendum
   - **Twilio, Supabase, Google** — accept each vendor's standard DPA and record their sub-processor lists and transfer terms (see A2.8).

**A2.8 International data transfers (US sub-processors).** Transfers of EU personal data to a third country (e.g. US) need a transfer tool under GDPR Chapter V. Two main routes:
- **EU–US Data Privacy Framework (DPF) adequacy** — valid for transfers to **DPF-certified US organisations**. The DPF was **upheld by the EU General Court on 3 Sept 2025** (Latombe challenge dismissed); it remains a valid basis, though an appeal to the CJEU ("Schrems III" risk) is possible and the Commission must keep monitoring it. Source: Jones Day, *EU General Court Upholds EU-U.S. Data Privacy Framework* (Sept 2025) — https://www.jonesday.com/en/insights/2025/09/eu-general-court-upholds-euus-data-privacy-framework
- **Standard Contractual Clauses (SCCs)** — Commission-approved model clauses (Decision (EU) 2021/914, modules per role) for transfers to recipients not subject to GDPR; following *Schrems II*, pair with a **Transfer Impact Assessment (TIA)** and any supplementary measures. Source: EU Commission SCC page — https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en
- **LumiDesk specifics:** Retell "**does not currently operate services within the European Union**" and processes globally (incl. US on AWS). Its DPA treats US transfers to Retell as **not restricted while Retell holds an active EU–US DPF certification**, with **SCCs (2021/914) as the fallback** for restricted transfers. LumiDesk must (a) verify Retell's DPF certification is active, (b) ensure SCCs apply as fallback, and (c) do a TIA. Sources: Retell DPA §11/Schedule 3 — https://retellai.com/legal/data-processing-addendum ; community thread — https://community.retellai.com/t/eu-client-gdpr-compliance-data-residency-subprocessors-dpa-full-breakdown-questions-for-the-team/2332
- For **Twilio and Google**, verify each is **DPF-certified** (check the official list at dataprivacyframework.gov) and/or covered by **SCCs** in their DPA. For **Supabase**, prefer an **EU region** to keep data in the EEA and minimise transfers.

---

### A3. ePrivacy / call-recording consent (rules VARY by member state)

**The confidentiality rule.** ePrivacy Directive (2002/58/EC) Art. 5(1) requires member states to prohibit **listening, tapping, storage or other kinds of interception or surveillance** of communications **without the consent of the users concerned** (except where legally authorised). Recording + transcribing a call squarely engages this. Source: ePrivacy Directive Art. 5(1) — https://www.legislation.gov.uk/eudr/2002/58/article/5/data.html

**It's personal data, and consent is often required.** Voice recordings are personal data, so GDPR applies on top of ePrivacy. National regulators take strict views: the **Danish DPA (2019)** ruled a company must obtain **affirmative, freely-given, specific, informed, unambiguous consent** before recording customer calls, and rejected "legitimate interest"/"training purposes" as a basis in that case. Source: *Denmark DPA Rules on How GDPR Applies to Voice Recordings* — https://natlawreview.com/article/denmark-dpa-rules-how-gdpr-applies-to-voice-recordings

**Finland.** Finnish practice applies GDPR + ePrivacy to call recordings; the Finnish Data Protection Ombudsman actively enforces recording-related rights (e.g. a 2023 fine involving the right to obtain one's own call recordings). The exact basis (consent vs. legitimate interest) and employee-vs-customer nuances should be confirmed with Finnish counsel. Source: EDPB — Finnish SA fine re: call recordings (2023) — https://www.edpb.europa.eu/news/national-news/2023/finnish-sa-administrative-fine-business-directory-operator-infringements_en

**→ Because the required basis (consent vs. notice + legitimate interest) differs by member state, LumiDesk must be able to adapt its call-opening behaviour per the customer's country.** Safest default: **notify at the very start that the call is recorded/transcribed, state why, and offer an opt-out** (route to a human / no-record path). Where a member state requires consent, obtain **affirmative consent** before recording (e.g. "to continue with the recorded assistant, say yes / press 1", or caller must proceed after a clear notice where that suffices).

**US (brief).** If a customer operates in the US, recording is governed by federal + **state wiretap laws**: most states are **one-party consent**, but **13 all-party ("two-party") consent states** (incl. **California, Florida, Illinois, Massachusetts, Pennsylvania, Washington**, and others) require **everyone on the call to consent**. For cross-state calls the **stricter rule generally applies**, so **all-party consent (a clear recorded notice/consent at call start) is the safe default**. Source: Kilpatrick, *Wiretap Laws in the United States* (2024) — https://ktslaw.com/en/insights/alert/2024/7/wiretap-laws-in-the-united-states

---

### A4. How to determine which regime applies — capture the customer's country/region

The business customer's location (and where their callers are) determines which rules bind each deployed agent. LumiDesk cannot apply the right AI-disclosure/recording behaviour or the right transfer terms without this.

- **Capture at signup:** the customer's **country/region of establishment** and **primary country(ies) of operation / where their callers are**, plus the **agent's language(s)**.
- **Decision logic:**
  - Business established in EU/EEA **or** targeting/serving EU callers → **GDPR + EU AI Act + ePrivacy apply** (GDPR territorial scope, Art. 3 — https://gdpr-info.eu/art-3-gdpr/). Apply the correct **member-state call-recording mode** (consent vs. notice) based on country.
  - Business + callers entirely outside EU (e.g. US) → apply **local law** (e.g. US state consent laws); still disclose AI as best practice.
- Use the captured region to drive: (1) which **spoken disclosure script + recording mode** plays, (2) the **privacy-notice** variant/language, (3) the **transfer mechanism / data-residency** choices (e.g. EU Supabase region).

---

## PART B — Prioritized implementation checklist (build in this order)

**P0 — Blockers before any EU go-live**

1. **AI self-disclosure at the START of every call (AI Act Art. 50).** Hard-code a spoken line, at the very first interaction, that the caller is talking to an automated AI agent. Make it un-skippable and logged. Translate per agent language. *(In force since 2 Aug 2026.)*
2. **Call-recording + transcription notice + lawful basis, at call start (ePrivacy + GDPR).** Before recording/transcribing, play a clear notice that the call is recorded and transcribed and why. For member states requiring consent (and as safe default), obtain **affirmative consent or a clear opt-out to a non-recorded/human path**. Make recording mode (consent vs. notice) **configurable per customer country**.
3. **Capture signup customer's country/region + operating region + language**, and wire it to drive disclosure script, recording mode, privacy-notice variant, and data-residency/transfer choices (Part A4).
4. **Sub-processor DPAs + transfer mechanism in place for every vendor.**
   - Confirm **Retell DPA is expressly incorporated** into your contract; verify **Retell's DPF certification active + SCCs fallback**; complete a **TIA**.
   - Accept **Twilio, Supabase, Google** DPAs; verify each US recipient is **DPF-certified and/or on SCCs**; prefer **Supabase EU region**.
   - Maintain your **own published sub-processor list** with change-notice + objection rights for your customers.
5. **Fix retention — do NOT keep Retell's "store indefinitely" default.** Set and document a **retention period**; configure Retell storage/retention (or disable Retell-side storage and retain only in your controlled Supabase EU store); implement auto-deletion.

**P1 — Required for a compliant, auditable service**

6. **Full written privacy notice (Art. 13)** per region/language, covering controller (the business), LumiDesk + sub-processors, purposes + lawful basis, transfers + safeguards, retention, and rights. Surface it to callers (URL via confirmation SMS / business web page) and to signup customers.
7. **Data-subject-rights workflow (Arts. 15, 17, etc.).** Build the ability to **look up, export, and delete all data for a caller by phone number** across Retell, Supabase, Twilio, Google Calendar — and a process to help the customer-controller respond within deadlines.
8. **Your own customer-facing DPA (LumiDesk as processor)** incorporated into SaaS terms (Art. 28 content).
9. **Records of processing (Art. 30)** as processor; document purposes, categories, sub-processors, transfers, retention.
10. **Security measures (Art. 32):** encryption in transit + at rest, access controls, logging, and a **breach-response plan** (note Retell's breach-notice timing to you; GDPR requires controller notice to authority within 72h).

**P2 — Hardening & governance**

11. **Consent/notice logging + audit trail** (what was disclosed, when, caller response) per call — evidence for both AI Act and recording consent.
12. **Human fallback / opt-out path** ("speak to a person" / don't record) for callers who object.
13. **DPIA (Art. 35)** — large-scale processing of voice/behavioural data likely warrants a Data Protection Impact Assessment; have the controller customer do one (LumiDesk supplies inputs).
14. **Vendor monitoring:** track DPF status (Schrems III appeal risk), Retell EU-residency roadmap, and sub-processor-list changes; re-paper SCCs/TIA if DPF is struck down.
15. **Localised translations** of all spoken disclosures + privacy notices for every supported agent language.

---

## PART C — Recommended short spoken disclosure (say at the very start of every call)

These must be **translated into the agent's language** and adjusted to the customer's country (recording mode). Keep it short and clear; it must come **before** substantive conversation and **before** recording where consent is required.

**Recommended combined opening (AI disclosure + recording notice) — English:**

> "Hi, you've reached **[Business name]**. You're speaking with an **automated AI assistant** — not a human. This call is **recorded and transcribed** so we can help you and book your appointment. If you'd prefer to speak to a person or not be recorded, just let me know."

**Minimal AI-only disclosure sentence (AI Act Art. 50) — English:**

> "Just so you know, you're speaking with **[Business name]'s AI assistant — an automated virtual agent, not a human.**"

**Consent-mode variant (member states requiring consent / all-party US states):**

> "Hi, you've reached **[Business name]**. You're speaking with an **automated AI assistant**, and this call is **recorded and transcribed**. To continue with the recorded assistant, please say **"yes"** — or say **"agent"** to speak with a person."

Notes:
- Must be given **clearly and distinguishably at the latest at first interaction** (AI Act Art. 50(5)).
- Do **not** rely on the "obvious from context" exception on a phone call.
- Point callers to the full written privacy notice (e.g. "You can read how we handle your data at [URL]" / send the link by SMS).
- Translate per language and keep the wording's substance identical across languages; log the disclosure + caller response.

---

## Sources

- EU AI Act, Article 50 (transparency) — https://artificialintelligenceact.eu/article/50/
- EU AI Act, Article 99 (penalties) — https://artificialintelligenceact.eu/article/99/
- Goodwin, *EU AI Act Transparency Obligations Are Now in Force* (Aug 2026) — https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force
- GDPR full text — https://gdpr-info.eu
- GDPR Art. 3 (territorial scope) — https://gdpr-info.eu/art-3-gdpr/
- GDPR Art. 5 (principles / storage limitation) — https://gdpr-info.eu/art-5-gdpr/
- GDPR Art. 6 (lawful basis) — https://gdpr-info.eu/art-6-gdpr/
- GDPR Art. 13 (information / privacy notice) — https://gdpr-info.eu/art-13-gdpr/
- GDPR Art. 15 (access) — https://gdpr-info.eu/art-15-gdpr/
- GDPR Art. 17 (erasure) — https://gdpr-info.eu/art-17-gdpr/
- GDPR Art. 28 (processor / sub-processors) — https://gdpr-info.eu/art-28-gdpr/
- GDPR Art. 30 (records of processing) — https://gdpr-info.eu/art-30-gdpr/
- GDPR Art. 32 (security) — https://gdpr-info.eu/art-32-gdpr/
- EU Commission — Standard Contractual Clauses — https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en
- Jones Day — *EU General Court Upholds EU-U.S. Data Privacy Framework* (Sept 2025) — https://www.jonesday.com/en/insights/2025/09/eu-general-court-upholds-euus-data-privacy-framework
- ePrivacy Directive 2002/58/EC, Art. 5(1) (confidentiality of communications) — https://www.legislation.gov.uk/eudr/2002/58/article/5/data.html
- National Law Review — *Denmark DPA Rules on How GDPR Applies to Voice Recordings* — https://natlawreview.com/article/denmark-dpa-rules-how-gdpr-applies-to-voice-recordings
- EDPB — Finnish SA fine re: call recordings (2023) — https://www.edpb.europa.eu/news/national-news/2023/finnish-sa-administrative-fine-business-directory-operator-infringements_en
- Kilpatrick — *Wiretap Laws in the United States* (2024) — https://ktslaw.com/en/insights/alert/2024/7/wiretap-laws-in-the-united-states
- Retell AI — Data Processing Addendum — https://retellai.com/legal/data-processing-addendum
- Retell AI community — EU GDPR / data residency / sub-processors thread — https://community.retellai.com/t/eu-client-gdpr-compliance-data-residency-subprocessors-dpa-full-breakdown-questions-for-the-team/2332

*Compiled November 2026. Not legal advice — obtain qualified EU/Finnish data-protection legal review before go-live.*
