# LumiDesk — Data Processing Agreement (DPA)

**DRAFT — not legal advice.** This is a practical template prepared for planning. Have a qualified data-protection lawyer review and adapt it (especially the `[bracketed]` fields, the security measures in Annex II, and the liability and governing-law sections) before you offer or rely on it.

**Last updated:** [DATE]
**Version:** [1.0 — DRAFT]

---

## 1. Parties and scope

This Data Processing Agreement ("**DPA**") forms part of, and is governed by, the LumiDesk Terms of Service (the "**Agreement**") between:

- **Processor:** [DeepO3 — legal entity to be registered in Finland], [company registration number — pending], [registered address, Finland], operator of the **LumiDesk** AI phone-receptionist service ("**LumiDesk**", "**we**", "**Processor**"); and
- **Controller:** the business customer that has accepted the Agreement ("**Customer**", "**Controller**", "**you**").

This DPA applies where LumiDesk processes **personal data** on the Customer's behalf in connection with the service, and reflects the parties' obligations under Regulation (EU) 2016/679 ("**GDPR**") and applicable data protection law. If there is any conflict between this DPA and the rest of the Agreement on data protection, **this DPA prevails**.

## 2. Roles of the parties

For personal data about the people who call the Customer's phone line(s) and interact with the AI receptionist (the "**Caller Data**"), the **Customer is the controller** and **LumiDesk is the processor**. The Customer is responsible for having a lawful basis for the processing (including any consent required for call recording in the Customer's jurisdiction) and for the lawfulness of its instructions.

(Note: for the Customer's own account, billing and usage data, LumiDesk acts as an independent **controller** under its Privacy Policy, not as processor — that data is outside this DPA.)

## 3. Subject-matter, duration, nature and purpose of processing

- **Subject-matter & nature:** receiving and answering inbound calls on the Customer's behalf; converting speech to text; generating spoken responses; **recording and transcribing** calls; checking calendar availability; creating bookings; and sending confirmation messages — all so the AI receptionist can serve the Customer's callers.
- **Purpose:** providing the LumiDesk service to the Customer as described in the Agreement, on the Customer's documented instructions.
- **Duration:** for the term of the Agreement, plus the retention and deletion periods in Section 11.

## 4. Types of personal data and categories of data subjects

**Categories of data subjects:** the Customer's callers, customers and prospective customers who contact the Customer's phone line(s).

**Types of personal data:**
- caller telephone number (from caller ID);
- any name, email address, or other details a caller provides during the call;
- **call audio recordings and transcripts**;
- appointment/booking details (time, service, notes);
- the content of confirmation SMS messages.

The service is not intended to process special-category data (GDPR Art. 9). The Customer must not instruct processing of special-category data except as separately agreed with appropriate safeguards.

## 5. Processor obligations (GDPR Art. 28(3))

LumiDesk shall:

1. **Process only on documented instructions.** Process Caller Data only on the Customer's documented instructions (including the configuration the Customer chooses in the product and the Agreement), including as to international transfers, unless required by EU/Member-State law — in which case LumiDesk will inform the Customer first, unless that law prohibits it. LumiDesk will inform the Customer if, in its opinion, an instruction infringes data protection law.
2. **Confidentiality.** Ensure persons authorised to process Caller Data are under an appropriate obligation of confidentiality.
3. **Security.** Implement the technical and organisational measures in **Annex II** to ensure a level of security appropriate to the risk (GDPR Art. 32).
4. **Sub-processors.** Engage sub-processors only in accordance with Section 6.
5. **Assist the Customer** by appropriate technical and organisational measures, insofar as possible, to respond to **data-subject requests** (Chapter III) and to meet its obligations under **Arts. 32–36** (security, breach notification, data protection impact assessments and prior consultation), taking into account the nature of processing and the information available to LumiDesk.
6. **Deletion/return.** At the Customer's choice, delete or return Caller Data at the end of the provision of services, as set out in Section 11.
7. **Demonstrate compliance.** Make available information necessary to demonstrate compliance with Art. 28 and allow for and contribute to audits, as set out in Section 9.

## 6. Sub-processors

6.1 The Customer grants LumiDesk **general authorisation** to engage sub-processors to provide the service. LumiDesk's current sub-processors are listed in the **Sub-processor List** (see `subprocessors.md` / [LINK]) and in **Annex III**:

| Sub-processor | Purpose | Location |
|---|---|---|
| Retell AI | Voice AI: call handling, recording, transcription | United States (processes globally) |
| Twilio | Telephony and confirmation SMS | United States / global |
| Supabase | Database and authentication hosting | [REGION — confirm EU region] |
| Google (Calendar / Cloud) | Calendar events for bookings | United States / global |
| Stripe | Payment processing | United States / global |

6.2 LumiDesk will impose on each sub-processor, by contract, data-protection obligations **materially equivalent** to those in this DPA (the "flow-down").

6.3 **Changes:** LumiDesk will give the Customer prior notice (at least [30] days) of the addition or replacement of a sub-processor via [email / the sub-processor page]. The Customer may **object** on reasonable data-protection grounds within [14] days; if the parties cannot resolve the objection, the Customer may terminate the affected service as its sole remedy.

6.4 LumiDesk remains liable to the Customer for its sub-processors' performance of their data-protection obligations.

## 7. International transfers

Where Caller Data is transferred outside the EU/EEA (notably to sub-processors in the United States), LumiDesk relies on an appropriate transfer mechanism — the **EU–US Data Privacy Framework** where the recipient is certified, and/or the European Commission's **Standard Contractual Clauses** (module processor-to-processor or controller-to-processor as applicable) together with supplementary measures. The applicable SCCs are incorporated by reference and available on request. [Confirm each provider's current mechanism and the Supabase region before publishing.]

## 8. Personal-data breach

LumiDesk will notify the Customer **without undue delay** after becoming aware of a personal-data breach affecting Caller Data, and will provide the information reasonably available to help the Customer meet its own notification obligations (Arts. 33–34), including the nature of the breach, likely consequences, and measures taken or proposed.

## 9. Audits and information

LumiDesk will make available to the Customer information reasonably necessary to demonstrate compliance with this DPA and will allow for and contribute to audits, including inspections, conducted by the Customer or an auditor it mandates — subject to reasonable notice, confidentiality, frequency ([once per 12 months] unless required by a supervisory authority or following a breach), and protection of other customers' data. LumiDesk may satisfy audit requests by providing existing reports/certifications where available.

## 10. Data-subject requests

If LumiDesk receives a request from a data subject (caller) relating to Caller Data, it will, where legally permitted, promptly inform the Customer and will not respond directly except on the Customer's instruction. LumiDesk will assist the Customer, by appropriate measures and insofar as possible, to fulfil the Customer's obligation to respond — including locating records by telephone number across the systems used to provide the service.

## 11. Deletion and return

On termination or expiry of the Agreement, and at the Customer's choice, LumiDesk will **delete or return** all Caller Data and delete existing copies, unless EU/Member-State law requires storage. In the ordinary course, Caller Data is retained for **[RETENTION PERIOD — e.g. 30/90 days]** and then deleted (see the Privacy Policy, Section 9). [Confirm and configure retention, including in Retell, whose default retains recordings indefinitely.]

## 12. Liability

Each party's liability under this DPA is subject to the limitations and exclusions of liability in the Agreement.

## 13. Governing law

This DPA is governed by the laws of **Finland** and, as applicable, the GDPR, consistent with the governing-law clause of the Agreement.

---

## Annex I — Description of processing
As set out in Sections 3–4 above (subject-matter, nature, purpose, duration; data subjects; types of personal data).

## Annex II — Technical and organisational security measures (Art. 32)
Indicative measures (confirm/complete to match your actual implementation):
- Encryption of data **in transit** (HTTPS/TLS); [encryption at rest — confirm with Supabase/providers].
- **Access control** and least-privilege; a privileged-role database model that **scopes each business's data to that business** (tenant isolation enforced server-side).
- **Passwords hashed** by the authentication provider; no plaintext credential storage.
- **Signed/verified webhooks** and per-org API tokens for tool calls.
- Secrets held in server environment configuration, not in client code or the repository.
- Logging and monitoring; [backup and recovery — confirm]; [vendor security reviews].
- Breach-response process (Section 8).

## Annex III — Approved sub-processors
As listed in Section 6.1 and the Sub-processor List.

---

*Draft template, not legal advice. Have a qualified lawyer review before use.*
