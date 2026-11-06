# LumiDesk — Security & Trust

**DRAFT — not legal advice.** This page describes how LumiDesk (provided by **DeepO3**) protects data, as a plain-language overview for customers. It is not a security certification or a contractual guarantee. Have it reviewed and keep it accurate as the product changes. Fill the bracketed `[…]` fields before publishing.

**Last updated:** [DATE]

---

## Our approach

LumiDesk handles phone calls and bookings on behalf of businesses, so protecting that data is core to the product. We aim to collect only what's needed, scope each business's data to that business, and work with reputable infrastructure providers.

## How we protect data

- **Encryption in transit.** Traffic to and from LumiDesk is served over HTTPS/TLS.
- **Access controls.** Protected endpoints require a valid login, and every action is scoped to an organization the user is actually a member of.
- **Per-tenant data isolation.** Each business's data (calls, bookings, settings, knowledge base) is scoped to that business; the backend connects with a privileged role and enforces tenant scoping in code, so one business cannot read another's data.
- **Password handling.** Passwords are stored **hashed** by our authentication provider — LumiDesk never stores plaintext passwords. Payment card details are handled by our payment provider (Stripe) and are **not** stored by LumiDesk.
- **Signed, verified webhooks.** Incoming webhooks (e.g. call events, billing events) are verified before they are trusted, and booking tools authenticate with a per-organization token.
- **Least data.** We don't ask callers for their phone number — it's captured from the call — and the AI only uses the business information the customer provides.

## Sub-processors and data location

We rely on established sub-processors, each under a data-processing agreement: **Retell** (voice/recording/transcription), **Twilio** (telephony/SMS), **Supabase** (database/auth), **Google** (calendar), and **Stripe** (payments). Some operate outside the EU/EEA; where they do, we rely on an appropriate transfer safeguard. The current list and locations are in our [Sub-processor list](./subprocessors.md), and our obligations are set out in our [DPA](./dpa.md). [Confirm your Supabase region — an EU region is recommended.]

## Data retention

We keep personal data only as long as needed. Call recordings and transcripts are retained for a defined period and then deleted. [Confirm the retention period and configure it with Retell, whose default retains recordings indefinitely.]

## If something goes wrong

No system is perfectly secure. If a personal-data breach occurs, we will investigate, contain it, and notify affected customers and the relevant supervisory authority as required by GDPR.

## Reporting a vulnerability

Found a security issue? Please email **[security@yourdomain]** — we appreciate responsible disclosure and will respond promptly.

## Contact

**[contact email]** — DeepO3, [registered address, Finland].
