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
- **Backend:** FastAPI (Python 3.10), Supabase Postgres. **Now deployed to the cloud (see §2a)** at `https://lumidesk-farid.duckdns.org` — no longer localhost + ngrok. Still runs locally for dev (uvicorn from the `.venv`, not conda base).
- **Voice:** **Retell AI** orchestrates the calls. STT = Soniox. TTS = ElevenLabs / Cartesia (English demo voice = `cartesia-Grace`). Agents + prompts configured in the Retell dashboard.
- **Agent tools** (FastAPI endpoints Retell calls mid-call): `/tools/check_availability`, `/tools/book_appointment`, `/tools/send_sms`, `/tools/search_knowledge` (per-org knowledge-base lookup). Google Calendar (per-org, via a **service account** the business shares their calendar with) + Twilio SMS. Auth via the `X-LumiDesk-Secret` shared-secret header. The caller's phone number is captured automatically from caller ID (Retell `{{user_number}}` → `X-Caller-Number` header), so the agent never asks for it.
- **Post-call webhook** logs finished calls to the `call_logs` table → shows on the dashboard.
- **Billing:** Stripe subscription, **pay-upfront**, then auto-provision the Retell agent on successful payment.
- **Repo:** github.com/Fhareed/Voice-Agent-Qwen- (branch `main`, currently public). Local path on my Mac: `~/Voice_Agent`. Main dashboard org is "Deep03".

## 2a. Hosting / deployment — the backend now runs in the cloud (NEW, big change)
The backend no longer depends on my laptop or ngrok. It runs 24/7 on a **free Oracle Cloud** ARM VM:
- **Server:** Oracle Cloud "Always Free" `VM.Standard.A1.Flex` (ARM, Ubuntu 22.04, 1 OCPU / 6 GB), region **Frankfurt (eu-frankfurt-1)**. Public IP `89.168.105.83`, SSH user `ubuntu` (private key is on my Mac in `~/Downloads`).
- **Permanent address:** `https://lumidesk-farid.duckdns.org` (free DuckDNS subdomain pointed at the VM's IP). This replaces the old changing ngrok URL everywhere, for good.
- **How it runs:** repo cloned at `/home/ubuntu/Voice-Agent-Qwen-` with its own `.venv`. A **systemd** service named `lumidesk` runs `uvicorn app:app` on `127.0.0.1:8000` and auto-restarts on crash/boot. **Caddy** is the reverse proxy in front, giving automatic Let's Encrypt **HTTPS** on the DuckDNS domain. Ports 80/443 are open in BOTH the Oracle security list AND the VM's iptables (both layers are required — classic Oracle gotcha).
- **Env on the server:** `.env` + the Google `service-account.json` were copied over (`chmod 600`). On the server, `PUBLIC_BASE_URL=https://lumidesk-farid.duckdns.org`, `GOOGLE_SERVICE_ACCOUNT_FILE` and `TENANT_INDEX_DIR` point to `/home/ubuntu/Voice-Agent-Qwen-/...`. The knowledge-base index dir (`tenant_indexes`) is **fresh/empty on the server** — KB content must be re-added via the Knowledge page.
- **Retell** is pointed at this domain: tool URLs `https://lumidesk-farid.duckdns.org/tools/*` and webhook `https://lumidesk-farid.duckdns.org/retell/webhook/<secret>`. **Verified end-to-end:** a live call checks availability, books, writes the event to Google Calendar, and logs to the dashboard — entirely server-side, laptop closed.
- **Redeploy after a code change:** push to GitHub, then on the server run `cd ~/Voice-Agent-Qwen- && git pull && sudo systemctl restart lumidesk`. Watch logs with `sudo journalctl -u lumidesk -f`.
- **Still local for now:** the **frontend** (Next.js dashboard). Next step is deploying it to **Vercel** with `BACKEND_URL=https://lumidesk-farid.duckdns.org`.

## 3. What's built (recent work)
- Full **self-serve flow**: signup → onboarding wizard → Stripe pay-upfront → auto-provision agent → live dashboard. Proven end-to-end.
- Dashboard with **Calls** and **Bookings** views.
- **Call-detail view**: click a call card to open a modal with the full transcript as chat bubbles, plus **Resolve / Unresolve / Delete**.
- **Google Calendar sync** (per-org, service-account): the agent checks real free/busy and writes bookings to the business's own Google Calendar. Hardened so a calendar hiccup never breaks a call or loses a booking, and fixed for Python-3.10 (`Z` timestamps) and for service-account attendee limits (caller email goes in the event description, not as a guest).
- **Knowledge Base** page + `search_knowledge` tool (RAG, Option B): per-org FAISS index the agent can query mid-call to answer business questions.
- **Caller-ID booking:** the agent uses the caller's phone number automatically (from caller ID) instead of asking — saves time and tokens.
- **Deployed to the cloud (see §2a):** off localhost + ngrok; the backend is now always-on at `lumidesk-farid.duckdns.org`.
- **CI** (GitHub Actions): on every push to `main` it runs `ruff` lint + a compile check + an import smoke test on the backend. (Note: CI does NOT yet check the frontend — a `next build`/`tsc` step could be added.)

## 4. CURRENT FOCUS — the Riyadh deal
- I had a strong demo call with a **prospect in Riyadh** (a customer-service agent who's been pushing for an AI receptionist at his company). He loved it — even offered free office space and talked about scaling together — and he's **referring a friend who owns a law firm**.
- **Next step: build an Arabic demo for next week**, to run for him + his law-firm friend.
- Demo theme / law firm name: **Qurrat Al-Ain** (قرة العين).
- **Dialect required: Najdi** (Riyadh / central Saudi). Voice must be **male** (market preference — a female voice can put Saudi callers off).
- Logistics learned: **WhatsApp voice calls don't work in Saudi** (we used Google Meet); his phone **can't dial international**, so I called the demo number on speaker in front of him. For the next demo, plan is to have the agent **call his Saudi mobile outbound** so he hears it on his own phone.

## 5. The Arabic agent plan
- **Voice:** No off-the-shelf Najdi TTS works inside Retell (Retell only supports 6 TTS engines; their Arabic is Modern Standard / generic). Plan: use a **free ElevenLabs voice-library Saudi male voice** — auditioning ~3 and letting the prospect's native ear pick the most "Riyadh." (Ruled out any "Jeddawi/Hijazi" = western and "Hasawi" = eastern voices.) Fallback: clone a **consented** Najdi male voice actor (~$100–450, Fiverr/Voice123) — never scrape a random voice (ToS + impersonation).
- **Known prompt-behaviour bugs being fixed:** (1) the agent repeated its greeting and re-asked for info already given; (2) it **booked appointments before the caller confirmed** and talked over the caller (felt scripted/script-reading). Fix = a tightened prompt: greet once, never re-ask, a **hard confirmation gate (never call book_appointment until the caller says yes to a specific time)**, answer the caller's questions first, and "one thing at a time" pacing — plus Retell turn-taking/interruption-sensitivity settings. This is now baked into `retell_provision.py`'s `build_prompt` (so new agents get it), and the live demo agent prompts were updated to match. **The Arabic version is in section 7 below.**
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
- **Deploy the frontend to Vercel** (pointed at `BACKEND_URL=https://lumidesk-farid.duckdns.org`) so the dashboard is online too, not tied to my Mac.
- **Re-add knowledge-base content** on the new server (the `tenant_indexes` dir is empty there) via the Knowledge page.
- **Fix `search_knowledge` in the live Retell agent:** give it `org_id` + `query` parameters and turn ON "Payload: args only" (it was returning 422 because the body shape didn't match).
- **Rotate secrets that were shown in screenshots** during setup (Retell webhook secret + API key, Stripe test key, Google service-account key) and update `.env` on both my Mac and the server.
- **Consider making the GitHub repo private** (it's currently public — no secrets are committed, but the full source is visible).

## 9. Artifacts already produced in the prior chat (I have these files)
- A Riyadh **sales-call cheat sheet** (pricing anchor, demo flow, objection handling).
- An **Arabic caller test-script** (3 realistic role-play scenarios).
- The fixed agent prompt (section 7).
If you need any of these, I can share them — or you can regenerate them from this context.

## 10. IMPORTANT — secrets are deliberately NOT in this document
API keys and passwords (Retell, Stripe, Supabase, ElevenLabs, Twilio) live in my `~/Voice_Agent/.env` on my Mac. I keep them out of any shared/pasted document on purpose. If the new session needs a value to do dev work, I'll provide it directly in that session — don't expect it here, and never ask me to paste secrets into a document that gets moved around.
