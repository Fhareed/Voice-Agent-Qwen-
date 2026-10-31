# Lumidesk — Project Context Handoff

**To the new Claude:** This is a context transfer from a long prior conversation on another account. Read it fully, then continue helping me (Farid) from where we left off — don't make me re-explain. **To me (Farid):** paste this as your first message in the new account, or attach this file and say "continue from this context."

---

## 1. Who I am & what I'm building
- I'm **Farid**, founder. I'm building **Lumidesk** — an **AI phone receptionist** (AI voice agent) for small **local service businesses** (plumbers, HVAC, clinics, salons, law offices, real estate). It answers every call 24/7, talks naturally, books appointments into a calendar, texts a confirmation, and logs every call to a dashboard.
- Parent company: **DeepO3**. Reddit handle: **Fhareed**. Login email: **oladegafarid@outlook.com**.
- Stage: early / pre-revenue. The product works and I'm landing first customers.
- How I like to work: concise and action-oriented. I'm often prepping for a sales call on my phone. I push code to GitHub myself from my Mac.

## 2. Tech stack & architecture
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind. Dev at localhost:3000.
- **Backend:** FastAPI (Python 3.10), Supabase Postgres. Runs at localhost:8000 (uvicorn from the `.venv`, not conda base).
- **Voice:** **Retell AI** orchestrates the calls. STT = Soniox. TTS = ElevenLabs / Cartesia (English demo voice = `cartesia-Grace`). Agents + prompts configured in the Retell dashboard.
- **Booking tools** (FastAPI endpoints Retell calls mid-call): `/tools/check_availability`, `/tools/book_appointment`, `/tools/send_sms` — Google Calendar + Twilio SMS. Auth via a shared-secret header.
- **Post-call webhook** logs finished calls to the `call_logs` table → shows on the dashboard.
- **Billing:** Stripe subscription, **pay-upfront**, then auto-provision the Retell agent on successful payment.
- **Repo:** github.com/Fhareed/Voice-Agent-Qwen- (branch `main`). Local path on my Mac: `~/Voice_Agent`. Main dashboard org is "Deep03".

## 3. What's built (recent work)
- Full **self-serve flow**: signup → onboarding wizard → Stripe pay-upfront → auto-provision agent → live dashboard. Proven end-to-end.
- Dashboard with **Calls** and **Bookings** views.
- **Call-detail view** (newest): click a call card to open a modal with the full transcript as chat bubbles, plus **Resolve / Unresolve / Delete**. Committed + pushed.
- **CI** (GitHub Actions): on every push to `main` it runs `ruff` lint + a compile check + an import smoke test on the backend. (Note: CI does NOT yet check the frontend — a `next build`/`tsc` step could be added.)

## 4. CURRENT FOCUS — the Riyadh deal
- I had a strong demo call with a **prospect in Riyadh** (a customer-service agent who's been pushing for an AI receptionist at his company). He loved it — even offered free office space and talked about scaling together — and he's **referring a friend who owns a law firm**.
- **Next step: build an Arabic demo for next week**, to run for him + his law-firm friend.
- Demo theme / law firm name: **Qurrat Al-Ain** (قرة العين).
- **Dialect required: Najdi** (Riyadh / central Saudi). Voice must be **male** (market preference — a female voice can put Saudi callers off).
- Logistics learned: **WhatsApp voice calls don't work in Saudi** (we used Google Meet); his phone **can't dial international**, so I called the demo number on speaker in front of him. For the next demo, plan is to have the agent **call his Saudi mobile outbound** so he hears it on his own phone.

## 5. The Arabic agent plan
- **Voice:** No off-the-shelf Najdi TTS works inside Retell (Retell only supports 6 TTS engines; their Arabic is Modern Standard / generic). Plan: use a **free ElevenLabs voice-library Saudi male voice** — auditioning ~3 and letting the prospect's native ear pick the most "Riyadh." (Ruled out any "Jeddawi/Hijazi" = western and "Hasawi" = eastern voices.) Fallback: clone a **consented** Najdi male voice actor (~$100–450, Fiverr/Voice123) — never scrape a random voice (ToS + impersonation).
- **Known bug being fixed:** on the English demo, the agent repeated its greeting and re-asked for info the caller had already given. Fix = a tightened prompt (greet once, acknowledge given info, never re-ask, never restart) + Retell turn-taking/interruption settings. **The fixed prompt is in section 7 below.**
- **Saudi phone number:** a real local +966 number isn't feasible fast (CITC regulation needs a Saudi entity/address). For the demo: outbound call to his mobile, or a web call. Long-term: Unifonic (Saudi CPaaS) issues compliant +966 numbers that connect to Retell over SIP, or the customer provides their own number.
- **Test script:** I have 3 realistic Arabic caller role-play scenarios (Khalid the impatient businessman / Noura the worried tenant / Abu Sultan the older caller who switches to English) for a native tester to validate the agent before the demo.

## 6. Pricing (researched across markets)
- **Saudi (the live deal):** quote **SAR 2,500/month**. Anchor FIRST on the cost of a human receptionist (SAR 4,000–7,000/mo for one person; SAR 15,000+ for 24/7 coverage), THEN quote. Settle 1,800–1,900, hard floor ~1,500, add "+15% VAT," waive a ~SAR 2,000 setup fee as the closing lever. Flat monthly (never per-minute). WhatsApp confirmations preferred.
- **US:** ~$149/mo core ($49 entry / $299 upper).
- **Europe:** ~€149/mo core (my base is Finland; undercut VoiceFleet's €99 entry).
- **Early-bird offer for waitlist signups: 20% off for life.**

## 7. The fixed agent prompt (Qurrat Al-Ain — Najdi, repetition-proof)
Paste this as the agent's system prompt in Retell. Make sure the tool names `check_availability` and `book_appointment` match the agent's tool setup.

```
# IDENTITY
You are the virtual receptionist for Qurrat Al-Ain Law Firm (مكتب قرة العين للمحاماة), a law firm in Riyadh, Saudi Arabia. You answer incoming phone calls. Your job: greet callers warmly, understand what they need, answer basic questions about the firm, and book consultation appointments with a lawyer.

# LANGUAGE & VOICE
- Speak ONLY in natural, spoken Saudi (Najdi / Riyadh) Arabic — the way a real receptionist in Riyadh talks, NOT formal Modern Standard Arabic. Warm, polite, conversational.
- Keep every reply short — one or two sentences. Ask only ONE thing at a time. Never give a speech.
- If the caller switches to English, you may answer in English, then follow their lead.

# CRITICAL RULES (never break these)
1. Greet the caller ONCE, only at the very start. After that, NEVER say the greeting or the firm's name again.
2. Listen. If the caller has already told you something (their problem, name, or preferred time), acknowledge it and move on — NEVER ask again for information they already gave.
3. If you didn't catch something, just say: "عفواً، ممكن تعيد؟" Do NOT restart or repeat the greeting.
4. One step at a time. Never stack several questions in one turn.

# GREETING (say once, at the start only)
"السلام عليكم، مكتب قرة العين للمحاماة، معك المساعد الآلي. كيف أقدر أساعدك اليوم؟"

# WHAT YOU DO
- Answer basics: the firm books consultations with a lawyer; office hours; location.
- Book a consultation appointment.
- Take the caller's details for a callback if they prefer.
You do NOT give legal advice. If asked a legal question, say the lawyer will cover it in the consultation, and offer to book one.

# HOW TO BOOK
1. Ask, in one short question, what the consultation is about.
2. Get their full name and mobile number (don't re-ask anything already given).
3. Use the check_availability tool, then offer 1–2 options in natural spoken times ("بكرة الساعة ١١ الصبح، ولا بعد بكرة العصر؟").
4. When they choose, use the book_appointment tool with their name, phone, reason, and chosen time.
5. Confirm clearly, inserting the REAL day and time, e.g.: "تمام، حجزت لك موعد استشارة يوم الأحد الساعة ١١ الصبح. بوصلك رسالة تأكيد." Then ask if they need anything else.

# STYLE
Warm, respectful, efficient, human. Mirror the caller's pace. Don't over-explain. If it's after hours, still take their details and arrange a callback.

# ENDING
When they're done: "شكراً لتواصلك مع مكتب قرة العين، في أمان الله." Never repeat the greeting.
```

## 8. Open threads / to-dos
- **Riyadh (top priority):** pick the voice (prospect validates) → paste the prompt → set the agent's voice → run the Arabic test scenarios with a native speaker → fix any awkward wording → demo to him + his law-firm friend next week.
- **Waitlist emails** (early-access, "20% off for life") — drafted; I send them from Outlook.
- **Co-founder email** to zakikhan@outlook.com (a Reddit contact with startup-scaling experience) — drafted.
- Possibly get a **local Saudi number** (Unifonic) once there's a paying customer.
- Consider adding a frontend typecheck to CI.

## 9. Artifacts already produced in the prior chat (I have these files)
- A Riyadh **sales-call cheat sheet** (pricing anchor, demo flow, objection handling).
- An **Arabic caller test-script** (3 realistic role-play scenarios).
- The fixed agent prompt (section 7).
If you need any of these, I can share them — or you can regenerate them from this context.

## 10. IMPORTANT — secrets are deliberately NOT in this document
API keys and passwords (Retell, Stripe, Supabase, ElevenLabs, Twilio) live in my `~/Voice_Agent/.env` on my Mac. I keep them out of any shared/pasted document on purpose. If the new session needs a value to do dev work, I'll provide it directly in that session — don't expect it here, and never ask me to paste secrets into a document that gets moved around.
