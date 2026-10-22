# LumiDesk — Prototype Demo Sprint
### For the StartUp Express mentors · you have a few days · goal: one clean, live bilingual booking

You already told them you have a prototype in testing. Good — mentors don't expect a
finished company. They expect to see it **works** and that you **understand the customer.**
A bilingual voice assistant that answers a call and books a job is a strong prototype.
We're building **one two-minute moment** and rehearsing it until it can't fail.

---

## The moment (what the mentors see)

1. You: *"Let me show you our AI receptionist — I'll call it now."*
2. You talk to the agent **in Finnish**. It answers, handles a burst-pipe emergency, gets the name, number and time, and books the job.
3. You switch to a second screen/tab — **the booking has appeared live** on the LumiDesk page.
4. (Optional flourish) You call again and speak **English** — it switches language automatically.

Total: ~2 minutes. That's the whole demo. Everything else is you talking.

---

## The 3-day plan

### Day 1 — Get it talking (~2–3 hrs). No tools yet.
- In Retell, open your agent and set:
  - **Language:** Finnish (`fi-FI`)
  - **Speech-to-text (ASR):** Soniox
  - **Voice (TTS):** ElevenLabs → pick a Finnish-capable voice (try 2–3, keep the most natural)
  - **LLM:** the strongest multilingual one Retell offers by default; temperature ~0.3
  - **Enable:** interruptions / barge-in
- Paste **the agent prompt** (below).
- Click **Test / Talk to agent.** Have a Finnish conversation. Then say a sentence in English mid-call and confirm it switches. Tune the voice until it sounds natural, then **stop.**

### Day 2 — Make it book (~2–3 hrs).
- Start the demo backend and tunnel it (commands below).
- Add the **3 tools** in Retell pointing at your ngrok URL (config below).
- Open the live page: **http://localhost:8000/demo** on a second screen or tab.
- Talk to the agent and **actually book a job** — watch it pop up on the page. Do this **3–4 full times** so it's muscle memory.

### Day 3 — Make it safe (~1–2 hrs). Do not skip this.
- **Record a perfect run** (screen + mic) as a backup video — see *Backup plan* below.
- Rehearse the 2-minute demo out loud **three times.**
- Prepare your intro line and what you'll say in the 2–3 seconds while it "thinks."

---

## The agent prompt (copy-paste into Retell)

> Business is filled in with a sample Oulu plumber so you can demo today. Change the
> `BUSINESS INFO` block if you want a different one. Leave everything else as-is.

```
IDENTITY
You are the friendly phone receptionist for Oulun Putkihuolto, a plumbing and heating (LVI)
company in Oulu, Finland. You are on a live phone call with a caller. You sound like a warm,
calm, human receptionist — never robotic, never scripted.

LANGUAGE (important)
- Open every call in Finnish.
- From the caller's first words, detect whether they are speaking Finnish or English, and
  continue the ENTIRE call in that language.
- If the caller switches language at any point, switch with them immediately.
- Keep every reply to ONE short spoken sentence. Never read long lists aloud.
- Finnish: natural spoken yleiskieli. English: plain and friendly.
- Example opening: "Kiitos kun soitit Oulun Putkihuoltoon, kuinka voin auttaa?"

BUSINESS INFO (only ever use what is here — never invent anything)
- Services: leak and burst-pipe repair, drain cleaning, boiler and radiator service, bathroom plumbing.
- Hours: Mon–Fri 8–18. Emergency call-outs possible outside hours.
- Service area: Oulu and about 30 km around.
- Pricing: call-out 60 €, hourly 75 € (say casually; if asked something not listed, say a plumber will confirm).

HANDLING THE CALL
- Greet briefly, then answer what they ask. Don't interrogate them.
- Emergencies (burst pipe, flooding, no heat): stay calm, reassure them, treat it as urgent, and offer the soonest time.
- If they want someone to come / want to book:
  1. Get their name, phone number, and a rough idea of when (a day or part of day is enough).
  2. Call check_availability to get real open times.
  3. Offer ONE or TWO of those times in a natural sentence, in the caller's language.
  4. When they pick one, call book_appointment with the exact `start` (the iso value from
     check_availability), their name, phone, and what they need.
  5. Confirm the day and time back to them in ONE warm sentence.
- Never ask for the same thing twice — remember what they've already told you.
- If you don't know something, say so and offer to take a message — don't grill them.

AFTER BOOKING
- Confirm the day and time in the caller's language, warmly, in one sentence.
- Do NOT promise a text message or email — just confirm the booking is made.

TOOLS
- check_availability(org_id, service) — get open times. Always call before offering any time.
- book_appointment(org_id, start, customer_name, customer_phone, service) — book a chosen time.
- send_sms(org_id, to, message) — not needed for this demo; ignore it.
- On EVERY tool call, pass org_id = "demo-oulu".

STYLE
- One sentence per turn. Warm, human, unhurried. You exist so no call is ever missed.
```

---

## Run commands (Day 2)

In your project folder, first terminal:

```
cd /Users/farid/Voice_Agent
export TOOLS_SHARED_SECRET=lumidesk-demo-secret
uvicorn demo_server:app --port 8000
```

Second terminal:

```
ngrok http 8000
```

ngrok prints an https URL like `https://abcd-1234.ngrok-free.app`. That's your base URL.

Open the live bookings page in your browser: **http://localhost:8000/demo**

> `demo_server.py` runs ONLY the booking tools — it starts in ~2 seconds, needs no database,
> no Google, no Twilio. Bookings save to a local file and show on the live page.

---

## Retell tool config (Day 2)

Add three custom tools. For **each one**: Method = `POST`, and add a header
`X-LumiDesk-Secret` = `lumidesk-demo-secret`.

| Tool | URL (replace with your ngrok URL) |
|---|---|
| check_availability | `https://YOUR-NGROK-URL/tools/check_availability` |
| book_appointment | `https://YOUR-NGROK-URL/tools/book_appointment` |
| send_sms | `https://YOUR-NGROK-URL/tools/send_sms` |

Parameters for each tool are in `tool_schemas.json`. Set `org_id = "demo-oulu"` (constant).

---

## Demo-day runbook (the exact 2 minutes)

**Before you walk in:** backend running, ngrok running, live page open on one tab, Retell
"Talk to agent" open on another, backup video open on a third. Phone hotspot ready.

**Your intro (say this):**
> "Small trades businesses miss a huge share of their calls because they're on a job, and a
> missed call is a lost customer. LumiDesk answers the phone for them, in Finnish or English.
> Let me show you — I'll be a customer with a burst pipe."

**The Finnish run — you say (as the customer):**
> "Hei, meillä on keittiössä hajonnut putki ja lattialla on vettä, tarvitsen putkimiehen pian."

Let it react, then when it asks, give:
> Name: **Matti Virtanen** · Phone: **040 123 4567** · When: **huomenna aamupäivällä** (tomorrow morning)

Pick a time it offers. When it confirms — **switch to the live page tab**:
> "And there's the booking — name, job, and time, straight into our system."

**Optional English run (shows the language switch):**
> "Hi, my bathroom sink is leaking badly — can someone come tomorrow?"

Point out: *"Same agent — it heard English and switched."*

**Close:**
> "This is live today. This week I'm interviewing Oulu plumbers to lock in the first paying customer."

---

## Backup plan (do NOT skip — live AI demos fail on bad wifi)

1. **Record a perfect run** on Day 3. On Mac: **QuickTime Player → File → New Screen Recording**,
   click the arrow next to record and **enable the microphone**, then do one flawless run
   (the Finnish call + the booking appearing). Save it.
2. Keep the video open in a tab. If anything glitches live, don't panic — say
   *"let me show you a recording of it in action"* and play it. **Mentors care that it works,
   not whether it's live in that second.**
3. Bring a **phone hotspot** in case the venue wifi is weak — tether your laptop to it before you start.

---

## If a mentor asks a hard question

- **"Is this real / live?"** → "Yes — that's a real call being transcribed, understood, and
  booked. The booking you saw is stored in our system."
- **"AI isn't reliable — won't it mess up with real customers?"** → "It doesn't have to be
  perfect — it's replacing a missed call, which fails 100% of the time. The owner stays in
  control: it never quotes prices or pretends to be them, it just makes sure the call is caught
  and the details reach their phone."
- **"What's your traction?"** → "I'm in customer discovery — interviewing Oulu plumbers this
  week to confirm the pain and price and sign the first one." (Give real numbers if you have them.)
- **"Why you / why now?"** → your StartUp Express angle: a trust-sensitive Finnish market that
  global AI vendors overlook, served by someone local and honest.

---

## What's built vs what you do

- **Built & tested (by us):** `demo_server.py` (reliable demo backend + live page), the three
  booking tools, the bilingual agent prompt, this runbook.
- **You do (Days 1–3):** finish the Retell agent, run the backend + ngrok, wire the 3 tools,
  rehearse, record the backup.
- **Safe fallback:** if you can't get ngrok/tools stable in time, demo **conversation-only** —
  the agent answers in Finnish/English and says a plumber will call back. Still impressive,
  zero backend. But the booking-appears-on-screen version is much stronger, so aim for it.
```
