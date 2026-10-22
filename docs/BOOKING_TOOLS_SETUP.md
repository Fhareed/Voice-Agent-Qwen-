# Booking tools — setup & go-live guide

This is Step 1 of turning LumiDesk into a real voice **agent**: a backend that can
check a calendar, book a real appointment, and text a confirmation. The code is
built and tested. This guide is the ordered checklist to make it live.

The tools are three webhooks your voice platform calls mid-call:

- `POST /tools/check_availability` — returns open slots
- `POST /tools/book_appointment` — creates the Google Calendar event, saves the booking, texts the caller
- `POST /tools/send_sms` — sends an extra text if needed

Every call must send the header `X-LumiDesk-Secret: <TOOLS_SHARED_SECRET>`.

---

## Step 1 — database (2 minutes)

In the Supabase SQL editor, run the new migration:

    db/002_bookings.sql

That creates the `bookings` table your dashboard reads from.

---

## Step 2 — environment variables

Add these to your `.env` (the code runs without the Google/Twilio ones — it just
skips the real calendar/SMS and still books into Supabase — so you can go in order):

    # required for the tools to accept calls at all
    TOOLS_SHARED_SECRET=change-me-to-a-long-random-string

    # timezone + appointment defaults
    DEFAULT_TZ=Europe/Helsinki        # or America/New_York, etc.
    BOOKING_SLOT_MINUTES=60
    BOOKING_DAY_START=8
    BOOKING_DAY_END=18

    # Google Calendar (Step 3)
    GOOGLE_CALENDAR_ID=the-business@gmail.com
    GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/path/to/service-account.json

    # Twilio SMS (Step 4)
    TWILIO_ACCOUNT_SID=ACxxxx
    TWILIO_AUTH_TOKEN=xxxx
    TWILIO_SMS_FROM=+1xxxxxxxxxx

Install the new dependencies:

    pip install -r requirements.txt

Test it works (no accounts needed — this is mocked and hermetic):

    python check_tools.py     # should print ALL TOOL TESTS PASSED

---

## Step 3 — Google Calendar (real bookings)

1. Google Cloud Console → create a project → enable the **Google Calendar API**.
2. Create a **Service Account** → create a **JSON key** → download it. Put the path
   in `GOOGLE_SERVICE_ACCOUNT_FILE`. Copy the service account's email
   (`...@...iam.gserviceaccount.com`).
3. In the business's Google Calendar → Settings → **Share with specific people** →
   add that service-account email with **"Make changes to events"**.
4. Set `GOOGLE_CALENDAR_ID` to that calendar's id (usually the account's email).

Now `check_availability` reads real free/busy and `book_appointment` creates real
events. (For multiple customers later, we store one Google token per business in
the DB instead of one calendar in env — that change is isolated to
`integrations/calendar_google.py`.)

---

## Step 4 — Twilio SMS (confirmations)

1. Create a Twilio account → get `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
2. Buy a phone number (or set up a Messaging Service) → put it in `TWILIO_SMS_FROM`.
3. For texting **US** numbers you must complete **A2P 10DLC** brand/campaign
   registration (~2 weeks, needs a registered business). Start this early.

---

## Step 5 — Retell agent (the streaming voice + phone part)

1. Create a Retell account → create an **Agent**.
2. Paste your receptionist prompt (reuse the one in `rag_chain.py`) as the system prompt.
3. Add the three **custom tools** from `tool_schemas.json`. For each: set the URL to
   your deployed backend (e.g. `https://api.lumidesk.ai/tools/...`), method POST, and
   add the header `X-LumiDesk-Secret` = your `TOOLS_SHARED_SECRET`. Set `org_id` to
   the business's id (one agent per business).
4. (Optional) Add a knowledge base so it can answer questions — upload the business
   info, or add a `lookup_business_info` tool later that queries your FAISS index.
5. Pick a voice (ElevenLabs), enable barge-in / interruption, and attach a phone number.

Retell runs the streaming STT→LLM→TTS loop; your tools make it act.

---

## Step 6 — test end to end

Call the number and book a job. Confirm all four happened:
- a real event on the Google Calendar,
- a confirmation SMS to the caller,
- a row in the Supabase `bookings` table,
- (once wired) the booking visible in your dashboard.

---

## What's built vs what's left

- **Built & tested:** the three tool endpoints, HMAC-style secret auth, Google
  Calendar module (service-account), Twilio SMS module, `bookings` table, and a
  hermetic test (`check_tools.py`).
- **You do:** create the Google/Twilio/Retell accounts and fill in `.env` (Steps 3–5).
- **Later:** per-business Google OAuth (multi-customer calendars), a
  `lookup_business_info` tool wired to your FAISS RAG, and showing bookings in the
  dashboard.
