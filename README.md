# LumiDesk

**An AI phone receptionist for small local service businesses.** It answers the
phone 24/7 in **Finnish or English** — automatically matching whichever language
the caller speaks — understands what they need, and books the job. The first
target market is **trades businesses (plumbing / LVI) in Oulu, Finland**, where a
missed call is a lost job.

This document is the single onboarding source of truth. If you are a new developer
or an AI assistant picking this project up, read this top to bottom first.

---

## 1. The goal & scope

- **Problem:** small trades businesses miss a large share of incoming calls (on a
  job, hands full, after hours). A missed call usually means the customer rings the
  next plumber — a directly lost, high-value job.
- **Product:** a phone number that is always answered by a natural-sounding
  assistant which handles the call in the caller's language and books the
  appointment straight into the business's calendar.
- **Beachhead:** Oulu plumbers / trades. (Clinics, salons, restaurants are "later".)
- **Business model:** subscription, roughly €200–300 / month per business.
- **Why us / moat:** the voice technology is a commodity anyone can rent. The
  defensible parts are the **Finnish localization, local trust** (a trust-sensitive
  market global vendors overlook), the vertical-specific booking workflow, and the
  customer relationships — not the raw voice tech.
- **Current stage:** validation. Working prototype exists; goal is to land the first
  paying Oulu customer. Not yet deployed to production.

---

## 2. The two layers (important mental model)

LumiDesk is deliberately split into a **rented engine** and an **owned product**:

- **Voice engine (rented — Retell):** [Retell](https://retellai.com) is a managed
  platform that handles the hard real-time parts: telephony (phone numbers),
  streaming speech-to-text, the LLM turn loop, streaming text-to-speech, barge-in.
  Retell is **infrastructure, not a competitor** — a plumber can't use Retell
  directly any more than they'd "just use AWS." The customer never sees it.
  - Finnish STT: **Soniox** · TTS: **ElevenLabs** (multilingual) · LLM: a strong
    multilingual model. All configured inside the Retell agent.
- **Product layer (owned — this repo):** a FastAPI backend that Retell calls, plus
  multi-tenant data, per-business knowledge, auth, and (planned) the dashboard the
  business logs into. This is the actual company.

Retell reaches the product layer through **webhook "tools"** — the mechanism that
turns the assistant from a chatbot into an agent that takes real actions (see §5).

---

## 3. How a real call flows (production shape)

```
Caller dials the business's number
        │
        ▼
   Retell answers ──► Soniox transcribes ──► LLM (receptionist prompt) ──► ElevenLabs speaks
        │                                            │
        │              when the caller wants to book │  calls webhook tools (HTTP POST)
        ▼                                            ▼
                         THIS BACKEND  (tools_api.py:  /tools/check_availability, /tools/book_appointment)
                                 │
                 ┌───────────────┼─────────────────────────┐
                 ▼               ▼                          ▼
        Supabase Postgres   Google Calendar            Twilio SMS
         (bookings row)     (real event)            (confirmation)
                 │
                 ▼
        Business dashboard (their bookings, calls, leads)
```

Every tool call carries an `org_id` so bookings/calendar route to the correct
business. Google Calendar and Twilio **degrade gracefully** — if they aren't
configured, booking still succeeds (saved to the DB, slots generated), so the flow
works end-to-end before any external credentials are wired.

---

## 4. Demo vs. production — what's real vs. temporary

The prototype you can run today **is** the real architecture. Only four pieces are
temporary and get swapped for the production versions:

| Demo (today) | Production (paying customers) |
|---|---|
| Retell agent tested in the browser | The *same* agent + a real phone number |
| `demo_server.py` on a laptop | The full `app.py` backend, deployed on a host, always on |
| **ngrok** tunnel | Gone — Retell calls a permanent URL (e.g. `api.lumidesk.ai`) |
| `demo_server` saves to a local JSONL + shows a placeholder page; stub time slots | Supabase `bookings` + real Google Calendar; the real dashboard |

**Scaling to many customers:** each business = one `org_id` + its own Retell agent
(with its business info) + its own phone number. All agents call the *same* backend,
passing their `org_id`. One backend serves everyone; scale it horizontally as volume
grows. You add a customer by adding a row, not by rebuilding.

---

## 5. The booking tools (`tools_api.py`) — the "agent actions"

An `APIRouter` mounted at `/tools`, exposing three POST webhooks Retell calls
mid-call. Every request must send header `X-LumiDesk-Secret: <TOOLS_SHARED_SECRET>`
(checked with `hmac.compare_digest`; **fails closed** with 503 if the env var is
unset). Definitions to paste into Retell live in `tool_schemas.json`.

1. **`/tools/check_availability`** — returns open appointment slots (`{iso, spoken}`).
   Real free/busy when Google Calendar is configured, else generated business-hour
   slots. Called before offering the caller any time.
2. **`/tools/book_appointment`** — parses the chosen ISO time, creates a Google
   Calendar event (if configured), inserts the source-of-truth `bookings` row, sends
   a Twilio SMS confirmation (if a phone is present). Returns a booking id + spoken
   confirmation.
3. **`/tools/send_sms`** — thin wrapper to send an extra text (not needed for the
   basic booking flow).

---

## 6. Repo map

**Entry points**
- `app.py` — the full product API: auth, orgs, per-org RAG knowledge base, a
  browser voice pipeline (`/ask`: STT→RAG+LLM→TTS), call-log CRM, website scrape,
  marketing-lead capture, and the booking tools router.
- `demo_server.py` — a stripped-down demo server that mounts **only** the booking
  tools and saves bookings to a local `demo_bookings.jsonl`, with a live "bookings"
  HTML page at `/demo`. Boots in ~2s, no DB/LLM/model stack. Used for the live demo.

**Core backend**
- `tools_api.py` — the three booking webhooks (see §5).
- `auth.py` — Supabase Auth signup/login + local JWT verification (ES256 via JWKS).
- `deps.py` — `require_org_member`: valid token **and** membership in the `X-Org-Id` org.
- `tenancy.py` — org create/list/role (raw SQL).
- `db.py` — lazy SQLAlchemy engine for Supabase Postgres (psycopg v3).
- `call_logs.py` — call-log mini-CRM (log turns, list calls, transcripts, status).
- `lead_extract.py` — LLM extraction of caller/intent/booking details from a transcript.
- `leads.py` — marketing-lead capture to `leads.jsonl`.
- `scrape.py` — website→text onboarding, with an SSRF guard.

**RAG (per-business knowledge base)**
- `kb.py` — per-tenant FAISS index under `tenant_indexes/<org_id>/` (path-traversal guarded).
- `rag_retriever.py` — embeddings (`all-MiniLM-L6-v2`, 384-dim) + FAISS load with a
  SHA-256 fingerprint integrity check.
- `rag_chain.py` — the LCEL RAG chain (retriever + receptionist prompt + LLM).
- `document_loader.py` — per-format loaders + text splitter (chunk 500 / overlap 50).

**Swappable vendors (chosen by env var, behind ABCs in `providers/base.py`)**
- `providers/` — `get_stt/get_tts/get_llm_provider/get_vector_store`. Implementations:
  `google_stt.py`, `groq_stt.py`, `elevenlabs_tts.py`, `ollama_llm.py`, `groq_llm.py`,
  `faiss_store.py`.
- `integrations/` — `calendar_google.py`, `sms_twilio.py` (both degrade gracefully).

**Data / schema**
- `db/001_orgs_and_memberships.sql` — multi-tenant foundation + RLS.
- `db/002_bookings.sql` — `bookings` table + indexes + RLS.
- `schema_call_logs.sql` — `call_logs` table + RLS.

**Config / ops**
- `requirements.txt`, `Dockerfile`, `docker-compose.yml`, `ruff.toml`,
  `.gitignore`, `.env.example`, `tool_schemas.json`, `.github/workflows/ci.yml` (CI).

**Web pages & site**
- `frontend.html`, `dashboard.html`, `demo.html` — pages `app.py` serves (landing,
  owner dashboard, and the browser demo/onboarding flow).
- `website/` — the marketing site (`index.html`) and its build spec.
- `example_docs/` — sample PDFs used to seed a demo knowledge base.
- `outreach/` — cold-email playbook + outreach tracker (sales material, not code).

**Dev / test scripts** (not part of the running app; run manually)
- `check_tools.py` — hermetic test of the booking tools (`python check_tools.py`).
- `check_auth.py`, `check_db.py`, `check_kb.py`, `check_secure.py`, `check_tenancy.py`
  — smoke tests for auth, DB, KB isolation, security gates, tenancy.
- `build_rag_index.py` — one-off script to build a demo org's index from `example_docs/` (legacy).

**Docs**
- `README.md` — this file.
- `DEMO_SPRINT.md` — the live bilingual-booking demo runbook (Retell settings, the
  ready-to-paste agent prompt, ngrok, the day-of script + backup plan).
- `BOOKING_TOOLS_SETUP.md` — production go-live checklist (Supabase migration, env,
  Google Calendar service account, Twilio, Retell wiring).
- `CUSTOMER_INTERVIEW_SCRIPT.md` — bilingual customer-discovery interview guide.
- `archive/` — superseded docs/scripts kept for reference; safe to delete.

---

## 7. How to run

### The demo (fastest — shows a real bilingual booking)
```
uvicorn demo_server:app --port 8000     # terminal 1  (secret defaults to lumidesk-demo-secret)
ngrok http 8000                          # terminal 2  → gives an https URL
```
Open `http://localhost:8000/demo` for the live bookings page. In Retell, add the two
tools from `tool_schemas.json` pointing at `https://<ngrok>/tools/...`, header
`X-LumiDesk-Secret: lumidesk-demo-secret`, and `Payload: args only` ON. Full
step-by-step in **DEMO_SPRINT.md**.

### The full app
1. Copy `.env.example` → `.env` and fill it in (see §8).
2. Run the SQL migrations in the Supabase SQL editor: `db/001_orgs_and_memberships.sql`,
   `db/002_bookings.sql`, `schema_call_logs.sql`.
3. `pip install -r requirements.txt`
4. `uvicorn app:app --port 8000`

---

## 8. Environment & secrets

All secrets live in **`.env`** (already git-ignored and not tracked — never commit it,
never hardcode keys in code). The committed **`.env.example`** is the authoritative key
list; copy it to `.env` and fill in values. It covers `DATABASE_URL`, the Supabase keys
(`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`),
`ELEVEN_API_KEY`, and `TENANT_INDEX_DIR`. The booking tools additionally need
`TOOLS_SHARED_SECRET` (guards `/tools/*`), plus the optional Google Calendar / Twilio
settings and provider selectors (`LLM_PROVIDER`/`STT_PROVIDER`/`TTS_PROVIDER`) — add
those to `.env` if they aren't already listed in your `.env.example`.

---

## 9. Current status

**Working**
- Retell agent answering in Finnish and English (auto language switch), Soniox STT.
- Booking tools tested end-to-end: Retell → ngrok → `demo_server` → booking appears
  live on `/demo`. `check_tools.py` passes.
- Multi-tenant schema, per-org FAISS RAG, Supabase JWT auth, org-membership gate.

**Demo-grade / temporary** (see §4)
- `demo_server` uses a local JSONL, not the DB; ngrok tunnel; stub time slots; no
  real phone number yet.

**Known gaps before production**
- Deploy `app.py` properly (permanent HTTPS host, workers, non-root, pinned deps).
- Per-business Google OAuth (currently a single calendar via env) for multi-customer calendars.
- Harden tenant isolation on the real path (RLS is currently a backstop; the app uses
  a privileged DB role and enforces scoping in Python).
- Add a `lookup_business_info` tool wired to the FAISS RAG so the agent can answer
  questions, not just book.
- A CI workflow exists (`.github/workflows/ci.yml`); the `check_*.py` smoke scripts
  are still run manually, not yet wired into pytest.
- Rotate any API keys that were ever exposed. (`.env` is already git-ignored and untracked.)

---

## 10. Roadmap — how we're proceeding

1. **Validate (now):** run customer interviews (`CUSTOMER_INTERVIEW_SCRIPT.md`), demo
   to the StartUp Express mentors (`DEMO_SPRINT.md`), and land the first paying Oulu plumber.
2. **First customer:** deploy the backend to a host (permanent URL), connect *their*
   Google Calendar, buy a Finnish phone number, point their Retell agent at the
   deployed backend. Same pieces as the demo, made permanent.
3. **Scale:** one `org_id` + agent + number per business, all on one backend; build
   the dashboard bookings view; harden security (RLS, per-business OAuth); add
   monitoring. Only build production hardening once paying customers justify it.

---

## 11. Security notes

- Secrets only in `.env` (git-ignored). Never hardcode keys; the old README's advice
  to hardcode an API key was wrong and has been removed.
- `/tools/*` fail closed without `TOOLS_SHARED_SECRET`; secret compared with `hmac.compare_digest`.
- `scrape.py` has an SSRF guard; FAISS load uses a SHA-256 fingerprint integrity check.
- GDPR / call-recording consent applies in Finland — handle disclosure before launch.
