# Retell setup pack — Finnish voice agent (free browser test)

Goal of this step: build the agent in Retell and **talk to it in your browser** — no phone
number, no deployment, ~$0. You'll validate the Finnish voice quality and the booking
conversation before spending anything.

Providers for Finnish (decided): **Speech-in = Soniox**, **Speech-out = ElevenLabs (Finnish voice)**.
Skip Deepgram (weak at Finnish) and Fish Audio (not available in Retell).

---

## 1. Create the account (you)

Go to retellai.com → sign up. You get **$10 free credit** and free in-browser testing.
No card needed to test.

## 2. Create an agent

Dashboard → **Create Agent** → start from a blank / single-prompt agent.

Set:
- **Language:** Finnish (`fi-FI`)
- **ASR / speech-to-text provider:** Soniox
- **Voice / TTS:** ElevenLabs → pick a Finnish-capable voice (test 2–3 and keep the most natural)
- **LLM:** start with a strong multilingual model (GPT-4o / Gemini / Claude — whichever Retell offers by default); temperature ~0.3
- **Enable:** interruptions / barge-in, and end-of-speech detection (defaults are usually fine)

## 3. Paste this system prompt

Fill the `[[...]]` business block with a real test business (use a plumber, a clinic, or
your own details). Everything else can stay as-is.

```
You are the phone receptionist for [[BUSINESS NAME]], a [[TYPE OF BUSINESS]] in [[CITY/AREA]].
You are on a live phone call with a caller.

LANGUAGE
- Speak ONLY Finnish (standard yleiskieli), warm and natural, like a friendly human receptionist.
- Keep every reply to ONE short spoken sentence. Never read long lists aloud.

BUSINESS INFO (only ever use what's here — never invent anything):
- Services: [[e.g. leak repairs, boiler service, drain cleaning]]
- Hours: [[e.g. Mon–Fri 8–18]]
- Service area: [[e.g. Oulu and 30 km around]]
- Pricing: [[e.g. call-out 60€; hourly 75€ — or "not listed"]]
- Notes: [[anything else useful]]

HOW TO HANDLE A CALL
- Greet briefly, then just answer what they ask. Don't interrogate them.
- If they want to book or schedule a visit:
  1. Get their name and phone number and a rough idea of when (a day/part of day is enough).
  2. Call the tool `check_availability` to get real open times.
  3. Offer ONE or TWO of those times in a natural sentence.
  4. When they pick one, call `book_appointment` with the exact `start` (the iso value from
     check_availability), their name, phone, and what they need.
  5. Confirm in one short sentence and let the call wind down.
- NEVER ask for the same thing twice — piece together what they've already said.
- Prices: only say numbers that are in the business info, casually. If a price isn't listed,
  say someone will confirm it.
- If you don't know something or they get frustrated, don't grill them — say no problem and
  that someone will call them right back, then wrap up.
- Only say what's in the business info. If asked something you don't know, say so and offer
  to take a message.

TOOLS
- check_availability(org_id, service) — get open appointment times. Call before offering times.
- book_appointment(org_id, start, customer_name, customer_phone, service) — book a chosen time.
- send_sms(org_id, to, message) — only for sending an extra text (address, link). Booking
  already texts its own confirmation.
Always pass org_id = "[[YOUR TEST ORG ID]]" on every tool call.
```

(If you'd rather have the whole prompt written in Finnish, tell me — I'll translate it. The
instruction above already makes it *speak* Finnish; this is about the prompt text itself.)

## 4. Test the conversation first (no tools yet)

Before wiring tools, click **Test / Talk to agent** in the dashboard and have a Finnish
conversation. Judge: does Soniox catch your Finnish? Does the ElevenLabs voice sound natural?
Tune the voice and prompt until it feels right. This is the free validation you wanted.

## 5. Wire the three booking tools (free, local, via ngrok)

Retell needs to reach your booking webhooks. You don't have to deploy — tunnel your local
backend:

1. Run the backend locally:  `uvicorn app:app --port 8000`
2. Install ngrok (free) and run:  `ngrok http 8000`  → it gives you an https URL like
   `https://xxxx.ngrok-free.app`
3. In Retell, add the 3 custom tools from `tool_schemas.json`. For each:
   - URL = `https://xxxx.ngrok-free.app/tools/<name>`  (check_availability / book_appointment / send_sms)
   - Method = POST
   - Add header `X-LumiDesk-Secret` = your `TOOLS_SHARED_SECRET`
   - Set `org_id` to your test org id
4. Talk to the agent again and actually book — it should hit your local backend, insert a row
   in Supabase `bookings`, and (once Google Calendar + Twilio are set) create the event + text.

## 6. What comes after this step

Only once the browser agent is good:
- Buy a phone number (Finnish number for a Finland-first launch — note: the US A2P 10DLC
  process does NOT apply to Finnish numbers).
- Deploy the backend properly (HTTPS, workers, non-root, pinned deps) — the production-hardening
  step — so Retell calls a stable URL instead of ngrok.
- Wire Google Calendar (service account) and Twilio SMS per BOOKING_TOOLS_SETUP.md.

That's the free path to a working, hearable Finnish agent before any spend.
