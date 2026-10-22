# LumiDesk — Deployment & Go-Live Runbook (first real customer, single tenant)

This is a top-to-bottom checklist to take LumiDesk live for **one** business using **the owner's own accounts**. Do it in one sitting. Each phase ends with a "Verify this worked" check — don't move on until it passes.

- **Code**: FastAPI app, ships as a Docker container. Repo: `https://github.com/Fhareed/Voice-Agent-Qwen-.git`, branch `main`.
- **Container entrypoint** (from the `Dockerfile`): `uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}` (honors Render's injected `$PORT`). Health endpoint: `GET /health` → `{"status":"ok"}`.
- **Deploy target**: Render (Docker web service from the GitHub repo) + Supabase (Postgres + Auth).
- **Voice platform**: Retell. Retell does its own speech/LLM; LumiDesk only exposes the booking webhooks (`/tools/*`), the post-call webhook (`/retell/webhook/{secret}`), and the owner dashboard API.

> **Legend**
> `⟨FOUNDER⟩` = a value or action only you can provide (account IDs, keys, clicking "accept" in your own dashboards). These are called out again in the summary.
> `(labels may differ slightly)` = exact menu wording in a third-party UI may have changed since writing; the location is right even if the label moved.

> **Read this once before you start.** This runbook ships alongside a Track-1 code change (the `lumidesk_track1/` file set). Apply that change to your repo and push it to `main` **before** Phase 5. Two earlier concerns are now handled in that code:
> 1. **Startup no longer crashes without voice keys — fixed.** The STT/TTS/LLM/vector-store providers now build *lazily* (on first use), not at import (`app.py`), so the web service always boots and `/health` passes even if a voice-provider key is missing. The phone path (Retell webhook), booking tools, auth, and the dashboard APIs don't touch those providers at all. You should still set `LLM_PROVIDER=groq` + `GROQ_API_KEY` (and `ELEVEN_API_KEY`) so the in-browser demo and knowledge-base answers work — just know a missing key degrades only those, it no longer takes the service down. Default `LLM_PROVIDER` is `ollama`, which does **not** exist on Render, so you must override it to `groq`.
> 2. **The three new integrations are included in this change set** — `POST /retell/webhook/{secret}` (writes finished calls into Postgres `call_logs`, resolving the business by dialed number), migrations `db/003_org_phone_numbers.sql` + `db/004_call_logs_retell_fields.sql`, and `GET/PATCH/DELETE /bookings`. They are already wired into `app.py`. Just make sure the change is pushed to `main` so Render builds it.

---

## Phase 0 — Accounts & tooling you need open (5 min)

Have these logged in before you start:

- [ ] `⟨FOUNDER⟩` GitHub account with push access to `Fhareed/Voice-Agent-Qwen-`.
- [ ] `⟨FOUNDER⟩` Supabase account (the project that is already your DB).
- [ ] `⟨FOUNDER⟩` Google Cloud account + the **business's Google Calendar** login.
- [ ] `⟨FOUNDER⟩` Twilio account.
- [ ] `⟨FOUNDER⟩` Render account (connect it to GitHub).
- [ ] `⟨FOUNDER⟩` Retell account with the agent already built.
- [ ] `⟨FOUNDER⟩` Stripe account.
- [ ] A terminal with `curl` and `python3` (for generating secrets and smoke tests).

Keep a scratch note open. You will collect ~20 values as you go; the final Render env list in Phase 5 needs all of them.

---

## Phase 1 — Supabase (prod): migrations, connection string, auth keys, first org

### 1.1 Run the 5 SQL migrations **in this order**

Open your Supabase project → **SQL Editor** → **New query**. Paste the contents of each file, Run, then repeat with the next. Order matters because later tables reference `organizations`, and `004` alters `call_logs` so it must run after `schema_call_logs.sql`.

1. [ ] `db/001_orgs_and_memberships.sql` — creates `public.organizations`, `public.memberships`, the `is_org_member()` / `create_organization()` functions, and turns on Row-Level Security.
2. [ ] `db/002_bookings.sql` — creates `public.bookings` (references `organizations`).
3. [ ] `schema_call_logs.sql` — creates `call_logs` (references `organizations`). *(This file is at the repo root, not in `db/`.)*
4. [ ] `db/004_call_logs_retell_fields.sql` — adds the phone-call columns (`from_number`, `to_number`, `direction`, `duration_sec`, `language`, `started_at`, `ended_at`) to `call_logs`. *(New — run it right after `schema_call_logs.sql`.)*
5. [ ] `db/003_org_phone_numbers.sql` — maps a dialed phone number (E.164) → `org_id`, so an incoming number resolves to the right business. *(New — for the first customer you can skip populating rows and rely on `RETELL_DEFAULT_ORG_ID` instead, but still run the migration so the table exists.)*

All five are idempotent (`create table if not exists` / `add column if not exists`), so they are safe to re-run.

### 1.2 Get the `DATABASE_URL` connection string

Supabase → **Project Settings → Database → Connection string** (labels may differ slightly). You'll see **Direct**, **Session pooler**, and **Transaction pooler** options.

- [ ] Choose **Session pooler** (host looks like `aws-0-<region>.pooler.supabase.com`, **port `5432`**). This is the right one for a long-lived server like Render that keeps a SQLAlchemy connection pool open, and it works over IPv4.
- Port note: **`5432` = direct/session** (session pooler keeps a dedicated connection — safe for SQLAlchemy's pooled engine with `pool_pre_ping`, which this app uses). **`6543` = transaction pooler** — avoid it here; it recycles connections per-transaction and can break prepared statements under `psycopg`. If you must use `6543`, you'd need to disable statement caching, so just use `5432`.
- [ ] `⟨FOUNDER⟩` The string contains your **DB password**. Copy the full string; this becomes env var **`DATABASE_URL`**.

> The app rewrites `postgresql://` → `postgresql+psycopg://` itself (`db.py`), so paste the plain `postgresql://...` string Supabase gives you — don't hand-edit the scheme.

### 1.3 Capture the Auth keys

Supabase → **Project Settings → API** (and **Auth**) (labels may differ slightly). Collect:

- [ ] **`SUPABASE_URL`** = your project URL, e.g. `https://<project-ref>.supabase.co`.
- [ ] **`SUPABASE_PUBLISHABLE_KEY`** = the project's publishable/anon API key. *(This is what `auth.py` uses to build the Supabase client for signup/login.)*
- [ ] **`SUPABASE_JWKS_URL`** = `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`.
- [ ] **`SUPABASE_SECRET_KEY`** = the project's secret/service-role key. **Note:** the staged code does **not** currently read this var (token verification uses the JWKS URL, and the client uses the publishable key). Capture it and set it in Render for forward-compatibility, but it is not required by the current code — see the gaps list.

> **Token-verification prerequisite.** `auth.py` verifies login tokens with algorithm **`ES256`** against the JWKS URL. Your Supabase project must be issuing **asymmetric (ECC / ES256) JWT signing keys** (the current Supabase default via **Auth → JWT keys / Signing keys**). If the project is still on a legacy HS256 shared secret, token verification will fail and `/auth/me`, `/orgs`, `/calls`, `/bookings` will all 401. Confirm ES256 is active.

### 1.4 Create the first org + owner, capture `org_id`

You need one owner login and one org. Two ways — pick one.

**Option A — via the app (do this after Phase 5 deploy, using the live URL).** Replace `<BASE>` with the Render URL.

```bash
# 1) create the owner account
curl -s -X POST <BASE>/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"OWNER_EMAIL","password":"STRONG_PASSWORD"}'

# 2) log in to get a token
curl -s -X POST <BASE>/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"OWNER_EMAIL","password":"STRONG_PASSWORD"}'
#   -> {"access_token":"eyJ...","token_type":"bearer"}

# 3) create the org (becomes owner); capture org_id from the response
curl -s -X POST <BASE>/orgs \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"THE BUSINESS NAME"}'
#   -> {"org_id":"<UUID>","name":"...","role":"owner"}
```

> **Email-confirmation gotcha.** If Supabase has "Confirm email" enabled (**Auth → Providers / Sign In → Email**), step 2 returns `Login failed — is the email confirmed?` until you click the confirmation email. For a smooth first go-live, either click the confirmation link, or temporarily turn off email confirmation in Supabase, create the owner, then turn it back on.

**Option B — pure SQL (works before deploy).** You still need an `auth.users` row first (create the owner in Supabase → **Authentication → Users → Add user**, which gives you a user UUID), then:

```sql
insert into public.organizations (name) values ('THE BUSINESS NAME')
returning id;   -- copy this org_id

insert into public.memberships (org_id, user_id, role)
values ('<org_id_from_above>', '<owner_user_uuid>', 'owner');
```

- [ ] `⟨FOUNDER⟩` Record the returned **`org_id`** (a UUID). This becomes env var **`RETELL_DEFAULT_ORG_ID`** and is also the `org_id` you'll set on the Retell tools (Phase 6).

### ✅ Verify Phase 1

- In Supabase → **Table Editor**, confirm tables exist: `organizations`, `memberships`, `bookings`, `call_logs`, and `org_phone_numbers`.
- `select * from organizations;` returns your one row; `select * from memberships;` shows your owner with `role = 'owner'`.
- You have all of: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWKS_URL`, `SUPABASE_SECRET_KEY`, and `org_id` written down.

---

## Phase 2 — Generate the shared secrets

Two long random secrets. Generate them now; you'll paste them into Render (Phase 5) and Retell (Phase 6).

- [ ] **`TOOLS_SHARED_SECRET`** — guards the booking webhooks (`tools_api.py` checks header `X-LumiDesk-Secret` against it with a constant-time compare; if the var is unset the tools return **503**).
- [ ] **`RETELL_WEBHOOK_SECRET`** — the path segment in `POST /retell/webhook/{secret}`; the request is rejected unless the `{secret}` in the URL equals this var.

Generate each (run twice, once per secret):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
# or:
openssl rand -base64 48 | tr -d '\n'; echo
```

- [ ] `⟨FOUNDER⟩` Save both values in your scratch note. Treat them like passwords.

### ✅ Verify Phase 2

You have two distinct, long (40+ char) random strings recorded, labeled `TOOLS_SHARED_SECRET` and `RETELL_WEBHOOK_SECRET`.

---

## Phase 3 — Google Calendar (service account)

The app reads free/busy and creates events on **one** calendar via a Google **service account** (`integrations/calendar_google.py`). No per-user OAuth.

### 3.1 Create the service account + key

1. [ ] `⟨FOUNDER⟩` Google Cloud Console → create or pick a project.
2. [ ] Enable the **Google Calendar API** (APIs & Services → Library → "Google Calendar API" → Enable).
3. [ ] APIs & Services → **Credentials → Create credentials → Service account**. Give it a name (e.g. `lumidesk-calendar`). No special roles needed.
4. [ ] Open the new service account → **Keys → Add key → Create new key → JSON**. A `.json` file downloads. `⟨FOUNDER⟩` Keep this file safe — it is a credential.
5. [ ] Note the service account's **email** (looks like `lumidesk-calendar@<project>.iam.gserviceaccount.com`).

### 3.2 Share the business's calendar with the service account

1. [ ] `⟨FOUNDER⟩` In **Google Calendar** (logged in as the business), open the target calendar → **Settings and sharing**.
2. [ ] Under **Share with specific people** → add the service-account email → permission **"Make changes to events"**.
3. [ ] Under **Integrate calendar**, copy the **Calendar ID** (often the business's Gmail address, or an `...@group.calendar.google.com` string).

### 3.3 Set the calendar env vars

- [ ] **`GOOGLE_CALENDAR_ID`** = the Calendar ID from 3.2.
- [ ] **`GOOGLE_SERVICE_ACCOUNT_FILE`** = the **path on the server** to the JSON key (set in Phase 5; the code reads a file at this path).
- [ ] **`DEFAULT_TZ`** = `Europe/Helsinki` (this is the code default; set explicitly). Must be a valid IANA tz.
- [ ] **`BOOKING_SLOT_MINUTES`** = appointment length, e.g. `60` (default).
- [ ] **`BOOKING_DAY_START`** = business open hour, 24h int, e.g. `8` (default).
- [ ] **`BOOKING_DAY_END`** = business close hour, 24h int, e.g. `18` (default). *(Slots are Mon–Fri only in the MVP.)*

### 3.4 Getting the JSON key **onto Render** — two options

The code calls `service_account.Credentials.from_service_account_file(GOOGLE_SERVICE_ACCOUNT_FILE)`, i.e. it reads a **file path**. So:

- **Option A — Render Secret File (recommended, no code change).** In Render: the service's **Environment → Secret Files** (labels may differ slightly). Add a secret file, e.g. named `service_account.json`, paste the JSON contents. Render mounts it (commonly at `/etc/secrets/service_account.json`). Then set **`GOOGLE_SERVICE_ACCOUNT_FILE=/etc/secrets/service_account.json`** (use the exact mount path Render shows).
- **Option B — base64 env var.** Put the whole JSON, base64-encoded, into an env var (e.g. `GOOGLE_SERVICE_ACCOUNT_B64`). **This requires a code/startup change the staged repo does not have** — the app only reads a file path, so you'd need an entrypoint step that decodes the var to a file and points `GOOGLE_SERVICE_ACCOUNT_FILE` at it. Prefer Option A unless you specifically want base64.

> Note: until both `GOOGLE_CALENDAR_ID` and `GOOGLE_SERVICE_ACCOUNT_FILE` are set, `is_configured()` returns False and the booking tools **gracefully fall back** to generated time slots and skip the real event — useful during setup, but you want it fully wired before go-live.

### ✅ Verify Phase 3

- After Phase 5 deploy, the availability tool reports a real connection:
  ```bash
  curl -s -X POST <BASE>/tools/check_availability \
    -H "X-LumiDesk-Secret: $TOOLS_SHARED_SECRET" \
    -H 'Content-Type: application/json' \
    -d '{"org_id":"<ORG_ID>","days":5}'
  ```
  Response includes **`"calendar_connected": true`** and a `slots` list. If it's `false`, the calendar env vars or the JSON file path are wrong.

---

## Phase 4 — Twilio (SMS confirmations)

Booking confirmations are sent via Twilio (`integrations/sms_twilio.py`). If unset, SMS is a safe no-op (`{"sent": false, "reason": "not_configured"}`) and bookings still succeed.

1. [ ] `⟨FOUNDER⟩` Twilio Console → get/choose an **SMS-capable number** (or a Messaging Service).
2. [ ] Copy from the Console dashboard:
   - [ ] **`TWILIO_ACCOUNT_SID`** (starts `AC...`).
   - [ ] **`TWILIO_AUTH_TOKEN`**.
   - [ ] **`TWILIO_SMS_FROM`** = the Twilio number in E.164 (e.g. `+3584571234567`) **or** a Messaging Service SID (`MG...`).

**Finland / EU caveats (brief):**
- Finland supports **alphanumeric sender IDs** (e.g. the business name as the "from"). If you use one, **recipients cannot reply** — but the confirmation SMS text says "Reply here if you need to change it", so either use a real two-way number or adjust that wording.
- A local **Finnish long code / number** may require a Twilio **regulatory bundle** (business address/identity) before Twilio will provision or send — allow lead time.
- Sending to EU numbers may require the destination be reachable from your number's country; test to a real Finnish mobile early.

### ✅ Verify Phase 4

After Phase 5 deploy, fire a test SMS to your own phone:
```bash
curl -s -X POST <BASE>/tools/send_sms \
  -H "X-LumiDesk-Secret: $TOOLS_SHARED_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"org_id":"<ORG_ID>","to":"+YOUR_MOBILE_E164","message":"LumiDesk test"}'
```
Response `{"sent": true, "sid": "SM..."}` and the text arrives. `{"sent": false, "reason": "..."}` tells you what's wrong (bad creds, unverified number on a trial account, sender-ID issue).

---

## Phase 5 — Render (Docker web service)

### 5.1 Create the service

1. [ ] `⟨FOUNDER⟩` Render Dashboard → **New → Web Service** → connect the GitHub repo `Fhareed/Voice-Agent-Qwen-`, branch **`main`**.
2. [ ] **Runtime / environment: Docker** (Render auto-detects the `Dockerfile`). Do **not** set a build/start command — the Dockerfile's `CMD` runs `uvicorn app:app --host 0.0.0.0 --port 8000`.
3. [ ] **Health Check Path**: set to **`/health`** (Settings → Health & Alerts, labels may differ slightly).
4. [ ] Instance type: the image installs CPU PyTorch + sentence-transformers, so pick an instance with **enough RAM** (≥1–2 GB) and expect a multi-minute first build.

> Port: the app listens on 8000 (the Dockerfile `EXPOSE`s it). Render routes to the port the process binds; the Dockerfile already binds `0.0.0.0:8000`. If Render injects a `$PORT`, it is **not** honored by the hard-coded `--port 8000` in the Dockerfile — leave Render's port detection to the exposed 8000, and if Render can't reach it, that's the thing to revisit (see gaps list).

### 5.2 Set environment variables

In Render: **Settings → Environment** (labels may differ slightly). Add every var below. Values you don't have yet are flagged `⟨FOUNDER⟩`.

**Database & Auth (Phase 1):**
- [ ] `DATABASE_URL` = `⟨FOUNDER⟩` session-pooler string (port 5432)
- [ ] `SUPABASE_URL` = `⟨FOUNDER⟩`
- [ ] `SUPABASE_PUBLISHABLE_KEY` = `⟨FOUNDER⟩`
- [ ] `SUPABASE_JWKS_URL` = `⟨FOUNDER⟩` (`.../auth/v1/.well-known/jwks.json`)
- [ ] `SUPABASE_SECRET_KEY` = `⟨FOUNDER⟩` *(not read by current code; set for forward-compat)*

**Shared secrets (Phase 2):**
- [ ] `TOOLS_SHARED_SECRET` = `⟨FOUNDER⟩`
- [ ] `RETELL_WEBHOOK_SECRET` = `⟨FOUNDER⟩`

**Retell webhook routing (new integration):**
- [ ] `RETELL_DEFAULT_ORG_ID` = `⟨FOUNDER⟩` the `org_id` from Phase 1.4 (single-tenant fallback used when a dialed number isn't mapped in `org_phone_numbers`)

**Google Calendar (Phase 3):**
- [ ] `GOOGLE_CALENDAR_ID` = `⟨FOUNDER⟩`
- [ ] `GOOGLE_SERVICE_ACCOUNT_FILE` = path to the Secret File, e.g. `/etc/secrets/service_account.json`
- [ ] `DEFAULT_TZ` = `Europe/Helsinki`
- [ ] `BOOKING_SLOT_MINUTES` = `60`
- [ ] `BOOKING_DAY_START` = `8`
- [ ] `BOOKING_DAY_END` = `18`
- [ ] *(plus the Secret File itself, per Phase 3.4 Option A)*

**Twilio (Phase 4):**
- [ ] `TWILIO_ACCOUNT_SID` = `⟨FOUNDER⟩`
- [ ] `TWILIO_AUTH_TOKEN` = `⟨FOUNDER⟩`
- [ ] `TWILIO_SMS_FROM` = `⟨FOUNDER⟩`

**Voice-pipeline providers (see 5.6 — required so the container boots):**
- [ ] `LLM_PROVIDER` = `groq` *(the code default is `ollama`, which expects a local Ollama that Render doesn't have — set `groq` for a hosted LLM)*
- [ ] `STT_PROVIDER` = `groq` *(default `google`)*
- [ ] `TTS_PROVIDER` = `elevenlabs` *(default)*
- [ ] `VECTOR_STORE` = `faiss` *(default)*
- [ ] Provider API keys — **`⟨FOUNDER⟩` and name unconfirmed**: almost certainly a Groq key (e.g. `GROQ_API_KEY`) and an ElevenLabs key (e.g. `ELEVENLABS_API_KEY`). Confirm the exact names in the real `providers/*.py` on `main` (see gaps list) and set them.

**Optional / filesystem:**
- [ ] `LUMIDESK_SITE_ORIGIN` = your marketing domain(s), comma-separated, for CORS on `/leads` (optional; defaults to `*`).
- [ ] `TENANT_INDEX_DIR` = where per-org FAISS indexes are written (default `tenant_indexes`; **ephemeral on Render** — fine for the phone flow which doesn't use the app's own RAG).
- [ ] `LEADS_FILE` = path for the marketing leads file (default `leads.jsonl`; also ephemeral).

### 5.3 Deploy

- [ ] Trigger the first deploy. Watch the logs; the build is slow (PyTorch + models).
- [ ] `⟨FOUNDER⟩` Copy the public URL Render assigns, e.g. `https://lumidesk.onrender.com`. This is `<BASE>` everywhere below.

### ✅ Verify Phase 5

- [ ] `curl -s <BASE>/health` → `{"status":"ok"}` (Render shows the service "Live").
- [ ] Booking tools reachable and authed:
  ```bash
  # no secret -> 401
  curl -s -o /dev/null -w "%{http_code}\n" -X POST <BASE>/tools/check_availability \
    -H 'Content-Type: application/json' -d '{"org_id":"x"}'        # expect 401

  # with secret -> 200 + slots
  curl -s -X POST <BASE>/tools/check_availability \
    -H "X-LumiDesk-Secret: $TOOLS_SHARED_SECRET" \
    -H 'Content-Type: application/json' -d '{"org_id":"<ORG_ID>","days":5}'
  ```
- [ ] Owner login works end-to-end (run the Phase 1.4 Option-A curls against `<BASE>`).

> **If the service won't go Live / health check never passes:** most likely the container crashed at import because a voice provider constructor threw for a missing key (see 5.6 and the gaps list). Check Render logs for the traceback and set the missing provider key, or confirm with the dev that providers are lazy enough to boot without them.

### 5.6 Why the provider vars matter (read if boot fails)

`app.py` builds `stt = get_stt()`, `tts = get_tts()`, `llm = get_llm_provider().get_llm()`, `vector_store = get_vector_store()` **at import time**. If any of those constructors needs an API key that isn't set, the whole process can fail to start and Render marks the deploy failed. Retell does its own speech/LLM, so the phone flow doesn't *use* this pipeline — but the container still has to construct it to boot. Setting `LLM_PROVIDER=groq`/`STT_PROVIDER=groq` plus the matching keys is the safe path. The exact key names live in the provider modules, which aren't in the staged snapshot — confirm them on `main`.

---

## Phase 6 — Retell (agent tools, post-call webhook, phone number, disclosure)

### 6.1 Point the custom tools at the deployed backend

Use `tool_schemas.json` as the source for the three tool definitions. For each tool in Retell's agent → **Tools / Functions** (labels may differ slightly):

- [ ] `check_availability` → `POST <BASE>/tools/check_availability`
- [ ] `book_appointment` → `POST <BASE>/tools/book_appointment`
- [ ] `send_sms` → `POST <BASE>/tools/send_sms`
- [ ] On **every** tool, add header **`X-LumiDesk-Secret`** = your `TOOLS_SHARED_SECRET`.
- [ ] On **every** tool, set the **`org_id`** parameter to a constant = the `org_id` from Phase 1.4 (one agent = one business). `book_appointment` also requires `start` and `customer_phone`; `start` must be an exact `iso` value returned by `check_availability`.

Copy the parameter shapes (names, required fields) directly from `tool_schemas.json` so the agent sends what the endpoints expect (`BookIn`, `CheckAvailabilityIn`, `SmsIn` in `tools_api.py`).

### 6.2 Set the post-call webhook

- [ ] In the agent's **Webhook / post-call webhook** setting, set the URL to:
  ```
  https://<render-url>/retell/webhook/<RETELL_WEBHOOK_SECRET>
  ```
  (literal `<RETELL_WEBHOOK_SECRET>` replaced by the actual secret string from Phase 2). The endpoint rejects the call unless the path secret matches the env var; it writes the finished call into `call_logs`, resolving the business from the dialed `to_number` (falling back to `RETELL_DEFAULT_ORG_ID`).

### 6.3 Buy / attach a phone number

- [ ] `⟨FOUNDER⟩` In Retell, buy or attach a phone number and bind it to this agent. `⟨FOUNDER⟩` Record the number — this is what the business advertises / forwards to.
- [ ] (Single tenant: you can rely on `RETELL_DEFAULT_ORG_ID`. For multi-tenant later, insert a row in `org_phone_numbers` mapping this E.164 number → `org_id`.)

### 6.4 Add the recording / AI disclosure to the opening line

Finland is an **all-party-consent** jurisdiction (EU): callers must be told the call is handled by an AI assistant and, if recorded/transcribed, that too, up front. Add a disclosure sentence to the agent's **opening message / first utterance**.

- [ ] Example English opening line:
  > "Hi, thanks for calling [Business Name]. You're speaking with an automated AI assistant, and this call may be recorded and transcribed to help with your request. How can I help you today?"
- [ ] (Provide a Finnish equivalent if the agent answers in Finnish.)

### ✅ Verify Phase 6

- [ ] In Retell's tool tester (or a real call), `check_availability` returns slots (proves the URL + `X-LumiDesk-Secret` + `org_id` are correct).
- [ ] The post-call webhook URL is saved and includes the correct secret segment.
- [ ] The agent's first line contains the AI/recording disclosure.

---

## Phase 7 — Stripe (first sale, no code)

Manual Payment Link is enough for the first paying customer. Metered/automated billing is a **later phase** — do not build it now.

1. [ ] `⟨FOUNDER⟩` Stripe Dashboard → **Products → Add product**: name it (e.g. "LumiDesk — AI Receptionist, Monthly"), price **~€200–300/month**, recurring **monthly**, currency EUR.
2. [ ] **Payment Links → Create** for that price. Choose whether to collect tax/VAT and billing address as needed for Finland.
3. [ ] `⟨FOUNDER⟩` Copy the Payment Link URL.
4. [ ] Send it to the business owner (email/SMS/WhatsApp). On payment, Stripe emails you both a receipt and starts the subscription.

### ✅ Verify Phase 7

- [ ] Opening the link in a browser shows the correct business name, €-amount, and "monthly". (Use a test card in test mode first if you want to dry-run.)

---

## Phase 8 — End-to-end dress rehearsal (place a real call)

Do this with the real Retell number, the real deployed backend, and your own mobile as the "customer". Keep the Render logs and the business's Google Calendar open.

1. [ ] **Call the Retell number** from your mobile. Confirm you hear the opening line **with the AI/recording disclosure**.
2. [ ] **Ask a knowledge-base question** the agent should know (e.g. "What are your opening hours?" / "Do you do emergency callouts?"). Confirm a sensible answer. *(This is answered by Retell's own LLM + whatever knowledge you loaded into the agent, not the app's `/ask` pipeline.)*
3. [ ] **Ask to book.** The agent should call `check_availability` and offer specific times.
4. [ ] **Pick a time and give your name + mobile number.** The agent calls `book_appointment`.
5. [ ] **Verify the calendar event**: a new event appears on the business's Google Calendar at the chosen time, titled `"<service> — <name/phone>"`, with your phone/notes in the description.
6. [ ] **Verify the SMS**: your mobile receives "You're booked for `<service>` on `<day/time>`…".
7. [ ] **Verify the booking via the dashboard API** (owner token + `X-Org-Id`):
   ```bash
   curl -s <BASE>/bookings \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "X-Org-Id: <ORG_ID>"
   ```
   Your booking is listed (new `GET /bookings` endpoint).
8. [ ] **Hang up, wait for the post-call webhook**, then verify the call was logged:
   ```bash
   curl -s <BASE>/calls \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "X-Org-Id: <ORG_ID>"
   ```
   The finished call appears with a transcript (written by `POST /retell/webhook/<secret>` into `call_logs`). You can also confirm directly in Supabase: `select * from call_logs order by created_at desc limit 1;`.
9. [ ] **Resolve a call**: `curl -s -X PATCH <BASE>/calls/<CALL_ROW_ID> -H "Authorization: Bearer <ACCESS_TOKEN>" -H "X-Org-Id: <ORG_ID>" -H 'Content-Type: application/json' -d '{"status":"resolved"}'` → `{"ok":true,...,"status":"resolved"}`.
10. [ ] **Update / cancel a booking**: `PATCH /bookings/<id>` (e.g. change the time) and `DELETE /bookings/<id>` (cancel) — both owner-token + `X-Org-Id` (new endpoints). Confirm the row changes/disappears via `GET /bookings`.

### ✅ Verify Phase 8 (go-live gate)

All ten steps pass: live call → KB answer → booking → **real calendar event** + **real SMS** + **booking in `GET /bookings`** + **call in `/calls`** + resolve/delete work. If every box is checked, you are live for the first customer.

---

## Appendix A — Complete env var inventory (Render)

| Var | Required? | Source / notes |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase session pooler, port 5432 |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Used by `auth.py` client |
| `SUPABASE_JWKS_URL` | Yes | `.../auth/v1/.well-known/jwks.json` |
| `SUPABASE_SECRET_KEY` | No (not read by code) | Capture & set for forward-compat |
| `TOOLS_SHARED_SECRET` | Yes | Guards `/tools/*`; also set in Retell headers |
| `RETELL_WEBHOOK_SECRET` | Yes (new) | Path segment of `/retell/webhook/{secret}` |
| `RETELL_DEFAULT_ORG_ID` | Yes (new) | Single-tenant fallback org |
| `GOOGLE_CALENDAR_ID` | Yes (for real bookings) | Calendar ID |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | Yes (for real bookings) | Path to Secret File JSON |
| `DEFAULT_TZ` | Recommended | `Europe/Helsinki` |
| `BOOKING_SLOT_MINUTES` | Optional | default 60 |
| `BOOKING_DAY_START` | Optional | default 8 |
| `BOOKING_DAY_END` | Optional | default 18 |
| `TWILIO_ACCOUNT_SID` | Yes (for SMS) | |
| `TWILIO_AUTH_TOKEN` | Yes (for SMS) | |
| `TWILIO_SMS_FROM` | Yes (for SMS) | number or `MG...` |
| `LLM_PROVIDER` | Set to `groq` | default `ollama` won't work on Render |
| `STT_PROVIDER` | Set to `groq` | default `google` |
| `TTS_PROVIDER` | `elevenlabs` | default |
| `VECTOR_STORE` | `faiss` | default |
| provider API key(s) | Likely yes | name unconfirmed — e.g. `GROQ_API_KEY`, `ELEVENLABS_API_KEY`; confirm on `main` |
| `LUMIDESK_SITE_ORIGIN` | Optional | CORS for `/leads` |
| `TENANT_INDEX_DIR` | Optional | default `tenant_indexes` (ephemeral) |
| `LEADS_FILE` | Optional | default `leads.jsonl` (ephemeral) |

## Appendix B — Endpoint quick reference (what to hit, how it auths)

- `GET /health` — no auth. Render health check. *(Does not test the DB.)*
- `POST /tools/check_availability` · `POST /tools/book_appointment` · `POST /tools/send_sms` — header `X-LumiDesk-Secret`. Called by Retell. Body carries `org_id`.
- `POST /retell/webhook/{secret}` *(new)* — secret in path == `RETELL_WEBHOOK_SECRET`. Retell post-call → writes `call_logs`.
- `POST /auth/signup` · `POST /auth/login` · `GET /auth/me` — Supabase Auth; login returns a Bearer token.
- `POST /orgs` · `GET /orgs` — Bearer token.
- `GET /calls` · `PATCH /calls/{id}` · `POST /calls/{id}/finalize` — Bearer token **+** `X-Org-Id` header.
- `GET /bookings` · `PATCH /bookings/{id}` · `DELETE /bookings/{id}` *(new)* — Bearer token **+** `X-Org-Id` header.
