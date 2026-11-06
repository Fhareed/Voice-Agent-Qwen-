# LumiDesk — Privacy Policy

**DRAFT — not legal advice.** This is a practical starting point prepared for planning. Have a qualified data-protection lawyer review and adapt it (especially the bracketed `[…]` fields and the lawful-basis, retention, and governing-law sections) before you publish or rely on it.

**Last updated:** [DATE]
**Effective:** [DATE]

---

## 1. Who we are

LumiDesk ("**LumiDesk**", "**we**", "**us**", "**our**") provides an AI phone-receptionist service that answers inbound calls for businesses, speaks with callers, and books appointments.

- **Legal entity:** [LEGAL ENTITY NAME], [COMPANY REGISTRATION NUMBER], registered at [REGISTERED ADDRESS].
- **Contact for privacy questions:** [privacy@yourdomain] (or write to us at the address above).
- **Data protection contact / DPO:** [NAME / EMAIL, if appointed].

This policy explains how we handle personal data. It covers two different relationships, because LumiDesk handles data in two different roles (see Section 2).

## 2. Our two roles: controller and processor

- **We are the _controller_** for the personal data of the **businesses that sign up** to LumiDesk (and their staff users): account details, billing, and how you use the product. For this data, LumiDesk decides the purposes and means, and this policy governs it.
- **We are a _processor_** for the personal data of the **people who call our customers' phone lines** (the "callers"). Here, **our business customer is the controller** — they decide why the AI answers their calls and what happens to the booking. We process caller data **only on their documented instructions**, under a Data Processing Agreement (see Section 8). If you are a caller and want to exercise your rights, contact the business you called; we will support them in responding.

## 3. Personal data we collect

**a) From business customers (we are controller):**
- Account data: name, business name, email, password (stored hashed by our auth provider), country/region, phone number.
- Business profile you enter: industry, services, pricing, service area, hours, language and voice preferences.
- Billing data: subscription plan and payment status. **Card details are handled by our payment provider (Stripe) and are not stored by LumiDesk.**
- Communications: messages you send us (support, email).
- Usage and technical data: log data, IP address, device/browser information, and strictly-necessary cookies used to keep you signed in.

**b) From callers, on behalf of our business customers (we are processor):**
- The caller's phone number (from caller ID) and any name, email, or details they give during the call.
- **Call audio recordings and transcripts**, produced so the AI can understand the call and book the appointment.
- Appointment/booking details created during the call, and any confirmation SMS sent.

**c) Website visitors:**
- Data from our public site and sign-up, including cookies (see Section 11).

We do not intentionally collect special-category data (health, etc.). Please don't provide it through the service.

## 4. Why we use personal data, and our legal basis (GDPR Art. 6)

| Purpose | Data | Legal basis |
|---|---|---|
| Provide and operate your account and the AI receptionist | Account, business profile, usage | Performance of a contract (Art. 6(1)(b)) |
| Take payment and manage your subscription | Billing | Performance of a contract |
| Answer calls, check availability, and book appointments for callers | Caller data, recordings, transcripts, bookings | Processed **on our customer's instructions** as processor; the customer (controller) relies on their own lawful basis (and consent where required) |
| Keep the service secure and prevent abuse | Logs, technical data | Legitimate interests (Art. 6(1)(f)) |
| Support, service emails, and legal compliance | Contact, account data | Legitimate interests / legal obligation |
| Product improvement (aggregated, where feasible) | Usage data | Legitimate interests |

We do **not** sell personal data, and we do not use it for third-party advertising.

## 5. AI interaction and call recording

Calls answered by LumiDesk are handled by an **automated AI assistant, not a human**, and calls are **recorded and transcribed** so the assistant can understand the caller and complete the booking. Our customers' agents disclose both of these at the start of each call, and offer the caller the option to speak to a person or not be recorded. The lawful basis and any consent required for recording are the responsibility of our business customer as controller, configured to the rules of their country.

## 6. Who we share data with (sub-processors)

We use carefully selected service providers ("sub-processors") to run the service. Each is bound by a data-processing agreement. Our current sub-processors are:

| Provider | Purpose | Location |
|---|---|---|
| **Retell AI** | Voice AI: call handling, recording, transcription | United States (processes globally) |
| **Twilio** | Telephony and confirmation SMS | United States / global |
| **Supabase** | Database and authentication hosting | [REGION — confirm EU region] |
| **Google (Calendar / Cloud)** | Calendar events for bookings | United States / global |
| **Stripe** | Payment processing | United States / global |

A current list is available at [LINK TO SUB-PROCESSOR PAGE]. We will give customers notice of new sub-processors as set out in our DPA. We may also disclose data where required by law or to protect our rights.

## 7. International data transfers

Some sub-processors are located outside the EU/EEA (notably in the United States). Where we transfer personal data internationally, we rely on an appropriate safeguard — the **EU–US Data Privacy Framework** where the provider is certified, and/or the European Commission's **Standard Contractual Clauses** with supplementary measures — a copy of which is available on request. [Confirm each provider's current transfer mechanism and your Supabase region before publishing.]

## 8. Data processing for our customers (DPA)

When a business uses LumiDesk to handle its calls, we act as its processor under a **Data Processing Agreement** that forms part of our Terms. It sets out our obligations under GDPR Article 28, the sub-processors above, security measures, breach notification, and assistance with data-subject requests. Our DPA is available at [LINK TO DPA].

## 9. How long we keep data (retention)

- **Account and business profile:** for as long as your account is active, then deleted or anonymised within [e.g. 90 days] of account closure, unless we must keep it longer for legal/accounting reasons.
- **Billing records:** retained as required by law (typically [6–7] years).
- **Call recordings and transcripts:** retained for **[RETENTION PERIOD — e.g. 30/90 days]**, then deleted, unless the controlling business configures a different period. [Confirm and configure retention in Retell — its default keeps recordings indefinitely.]
- **Bookings:** kept for the business while the account is active.

## 10. Your rights

Subject to applicable law (GDPR for EU/EEA individuals, and similar rights elsewhere), you have the right to: **access** your data, **rectify** inaccurate data, **erase** data, **restrict** or **object** to processing, **data portability**, and to **withdraw consent** where processing is based on consent. You can also lodge a complaint with your supervisory authority (in Finland, the Office of the Data Protection Ombudsman; elsewhere, your local authority).

- **Business customers:** contact [privacy@yourdomain] to exercise your rights.
- **Callers:** contact the business you called (the controller). We will help that business respond, including locating records by phone number across our systems.

We respond within one month, as required by GDPR.

## 11. Cookies

We use **strictly-necessary cookies** to keep you signed in and secure the app; these don't require consent. If and when we add analytics or other non-essential cookies, we will ask for your consent through a cookie banner first and describe them in a Cookie Policy. [Update this section to match the cookies you actually use.]

## 12. Security

We use measures appropriate to the risk, including encryption in transit (HTTPS), access controls, a privileged-role database model that scopes each business's data to that business, hashed passwords via our auth provider, and signed/verified webhooks. No system is perfectly secure, but we work to protect your data and will notify you and any regulator of a breach as required by law.

## 13. Children

LumiDesk is a business tool and is not directed to children. We don't knowingly collect data from children.

## 14. Changes to this policy

We may update this policy from time to time. We'll post the new version here with an updated "Last updated" date and, for material changes, notify account holders.

## 15. Contact

Questions or requests: **[privacy@yourdomain]**, or [LEGAL ENTITY NAME], [ADDRESS].

---

*This document is governed by the laws of [GOVERNING LAW / JURISDICTION]. It is a draft template, not legal advice; please have it reviewed by a qualified lawyer before publishing.*
