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
- **Running costs:** hosting is now **$0** (Oracle). Separately, Retell bills a small monthly **phone-number rental** (~$1–2/number) to my card; call usage is covered by Retell **signup credits** for now, then per-minute (~$0.10–0.15/min) once they run out. Hosting is the only thing we moved off-laptop — the telephony cost is separate and normal.

## 3. What's built (recent work)
- Full **self-serve flow**: signup → onboarding wizard → Stripe pay-upfront → auto-provision agent → live dashboard. Proven end-to-end.
- Dashboard with **Calls** and **Bookings** views.
- **Call-detail view**: click a call card to open a modal with the full transcript as chat bubbles, plus **Resolve / Unresolve / Delete**.
- **Google Calendar sync** (per-org, service-account): the agent checks real free/busy and writes bookings to the business's own Google Calendar. Hardened so a calendar hiccup never breaks a call or loses a booking, and fixed for Python-3.10 (`Z` timestamps) and for service-account attendee limits (caller email goes in the event description, not as a guest).
- **Knowledge Base** page + `search_knowledge` tool (RAG, Option B): per-org FAISS index the agent can query mid-call to answer business questions.
- **Caller-ID booking:** the agent uses the caller's phone number automatically (from caller ID) instead of asking — saves time and tokens. The booking event now writes a clear description (service, customer, phone, details).
- **Smarter availability:** `check_availability` offers the earliest open slot on each *different* day (Tue, Wed, Thu…) instead of several times on the soonest day, so the agent gives a real choice of days.
- **Confirmation-gate prompt:** the agent waits for a clear "yes" to a specific time before booking, answers the caller's questions first, and paces one thing at a time (baked into `retell_provision.py` and the live demo agent).
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

## 6. Pricing (FINALIZED Nov 2026 — validated against real call costs)
**Locked structure (EU / homepage — live in `frontend/components/marketing/Pricing.tsx`):**
- **One-time setup fee: €249** — concierge onboarding (provisioning, business training, number + calendar setup). Raises commitment, filters tire-kickers; waivable for annual prepay.
- **Starter — €79/mo:** inbound 24/7, up to 100 calls/mo, books one calendar, texts you every lead.
- **Pro — €149/mo (most popular):** everything in Starter + unlimited calls (fair-use ~500/mo; genuine high-volume → Custom) + automatic text follow-up + answers hours/pricing/service area.
- **Outbound add-on — €99/mo + ~€0.45 per connected call:** outbound campaigns, confirmations & follow-ups, scripted lead qualification. Usage-priced so margin can't go underwater.

**Unit economics (from 33 real Retell test calls):** blended **$0.166/min** → ~**€0.40 per real 2–3 min booking call**, all-in (voice + LLM + telephony). Fixed ~€5/mo per customer (number €2 + SMS + infra share). Gross margins **~55–70%** at normal volume. Pro breakeven ≈ 360 calls/mo (hence the fair-use line). The LLM tier is the main cost lever.

**By market (research):**
- **Saudi (the live deal):** quote **SAR 2,500/month**. Anchor FIRST on the cost of a human receptionist (SAR 4,000–7,000/mo for one person; SAR 15,000+ for 24/7 coverage), THEN quote. Settle 1,800–1,900, hard floor ~1,500, add "+15% VAT," waive a ~SAR 2,000 setup fee as the closing lever. Flat monthly (never per-minute). WhatsApp confirmations preferred.
- **US:** ~$149/mo core ($49 entry / $299 upper).
- **Europe:** ~€149/mo core (my base is Finland; undercut VoiceFleet's €99 entry).
- **Early-bird offer for waitlist signups: 20% off for life.**

## 6b. Differentiation — how we stand out (researched Nov 2026)
**Honest headline:** the moat is NOT the AI voice. Retell/ElevenLabs-class tech is available to everyone — anyone can spin up an agent. Our edge is go-to-market: language + local trust + done-for-you onboarding + inbound *and* outbound + the data/relationship we own per customer.

**1. Local-language, local-market focus — not a checkbox.** The incumbents (Smith.ai, Ruby, Goodcall, My AI Front Desk, Rosie, Abby…) are English-first and US-focused; the "multilingual" platforms (thoughtly, famulor, autocalls, edesy) list Finnish/Arabic as *supported* but don't localize the product, onboarding or go-to-market. We're built to be the *local* answer: native-quality Finnish (Nordics) and Najdi-dialect Arabic (Gulf), tuned for local service businesses. Being the trusted local option beats being the 20th English tool.

**2. Inbound + outbound in one product.** Receptionist tools answer; outbound tools dial — rarely the same product. We do both for the same SMB: catch the demand that comes in, and reach out to create more (confirmations, follow-ups, lead qualification). Roughly doubles value-per-customer vs inbound-only incumbents.

**3. Done-for-you, owned full stack — not a thin wrapper.** We own the multi-tenant backend, dashboard, knowledge base, calendar booking and provisioning, and onboard each business hands-on (the €249 concierge setup). The SMB gets a working front desk without touching config; we own the data, bookings and relationship — stickier and more defensible than reselling someone else's agent.

**4. Vertical workflow depth.** Not just a talking bot: books into their calendar, texts/WhatsApps confirmations, answers from a KB of their services & prices. Built for plumbers, clinics, salons — where the phone *is* the business.

**Honest caveats (for us, not the pitch):**
- Voice tech is not the moat. Defensibility = language + local trust + onboarding + distribution + proprietary per-vertical call/outcome data + the owned customer relationship.
- Markets aren't empty: GCC has an early funded local player — **Sawt** (~$1M pre-seed, Riyadh, 2024, Arabic-native voice; aimed more at customer-support/call-centre than SMB local-service). Several horizontal platforms already "support" Finnish. Edge = focus + execution + being local, not "the only one."
- Defensibility compounds by being first and focused in a niche the big players won't prioritize (local references, integrations, per-vertical data).

**Investor one-liner:** "We're not building a better AI voice — we're the local front desk for service businesses in the markets the English incumbents ignore, doing both inbound *and* outbound, fully done-for-you."

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

## 7a. Outbound calling (NEW feature + a second live lead — Tarek / Morocco)
A Reddit prospect, **Infamous_Delivery476 ("Tarek", based in Morocco)**, saw the inbound demo and asked for an **outbound** calling agent: it calls a list of people, runs a script, and asks them questions. He's fine with multiple numbers (e.g. 5) for parallel calling, roughly once or twice a month per campaign. He's sending the full requirements (goal, who he's calling, the script) **by email**; I sent him the DeepO3 site + my email. **Status: waiting on his email — do NOT quote a firm price until the volume is known.**

**Feasibility — very doable; it reuses ~90% of what's already built.** Retell does outbound natively (its create-phone-call API dials out using the same agent/prompt system). The backend, Oracle hosting, webhook logging and dashboard all work for outbound unchanged. The only NEW pieces are small: (1) trigger calls from a list/batch (a short loop over Retell's outbound API), (2) an outbound-flavoured script (agent opens, says why it's calling, asks the questions), (3) capture the answers (Retell post-call analysis extracts structured data per call). Outbound is a smaller lift than the inbound receptionist that's already live.

**Cost model (I had this wrong on the call):** cost is driven by total call-**minutes** (~$0.10–0.15/min all-in: LLM + voice + telephony + engine), NOT by the number of agents. Phone numbers are cheap (~$1–2/mo each); more numbers = parallelism/speed, not proportionally more cost. So price on expected total minutes, not "per agent." Example: 200 calls × 2 min ≈ $50–70 usage + ~$10 for five numbers ≈ ~$80/mo cost.

**Pricing approach:** a one-time **setup fee** (build + script + numbers — my "25% upfront" deposit belongs here) + a **monthly** fee (base + usage tiers), anchored on value (far cheaper than paying humans to dial), not just cost. On the call I improvised ~$150–200/mo + 25% upfront — not binding, and possibly too low depending on volume; re-quote properly once he sends numbers.

**Open questions his email must answer:** the goal (lead-qualify / delivery-confirm / survey / follow-up), the **volume** (calls per campaign × length × frequency — this sets the price), **who** he's calling (his own existing customers = clean; cold strangers = outbound-calling regulations apply: consent, calling hours, AI disclosure — varies by country), and the **language** (Morocco may need Darija or French).

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
- **Outbound calling — BUILT (Nov 2026).** New Outbound page (`/app/outbound`): create a campaign (name, goal, script, paste a list of numbers), launch it, and watch each call's status + outcome. Backend: `outbound.py` (one reusable outbound Retell agent per org, placed via `/v2/create-phone-call` with the per-call script + name passed as dynamic variables), `outbound_store.py`, `outbound_api.py` (`/outbound/campaigns…`), and `retell_webhook.py` now attaches each finished outbound call to its campaign target via call metadata. New tables in `sql/006_outbound.sql`. **To go live: (1) run `sql/006_outbound.sql` in the Supabase SQL editor; (2) set `RETELL_OUTBOUND_FROM_NUMBER` in the server `.env` to a number registered in Retell (Retell-bought numbers only dial US — import a SIP number for other countries, e.g. Tarek's lists); (3) push on the Mac → `git pull` + `sudo systemctl restart lumidesk` on the server. The outbound agent auto-provisions on the first launch.**
- **Turn on SMS confirmations:** the code already texts a booking confirmation to the caller, but Twilio isn't configured on the server (returns `not_configured`), so no texts actually send yet. Add `TWILIO_ACCOUNT_SID / AUTH_TOKEN / SMS_FROM` to the server `.env` to enable. Optional follow-on: also text the **business owner** a "new booking" alert (needs the owner's number saved as a per-org setting + a few lines of code).

- **Booking accuracy / ASR — call-quality bug (found Nov 3 live test):** the caller said "Thursday" but ASR mis-heard it ("Thursday"→"Because", "leak"→"SIM" — accent + short words), and the agent then DEFAULTED to the first offered slot (Tuesday) and treated a generic "okay, thank you" as confirmation — booking the wrong day. Fix: (a) prompt — when the caller's day/time choice is unclear or garbled, RE-ASK which option; never default to one; the confirmation gate must restate the SPECIFIC slot and require an explicit yes to THAT slot, not a generic "okay"; (b) Retell — keyword/ASR boosting for day names (Monday…Sunday) + "leak", and tune turn-taking / interruption sensitivity. Part of the call-quality work.

## 9. Artifacts already produced in the prior chat (I have these files)
- A Riyadh **sales-call cheat sheet** (pricing anchor, demo flow, objection handling).
- An **Arabic caller test-script** (3 realistic role-play scenarios).
- The fixed agent prompt (section 7).
If you need any of these, I can share them — or you can regenerate them from this context.

## 10. IMPORTANT — secrets are deliberately NOT in this document
API keys and passwords (Retell, Stripe, Supabase, ElevenLabs, Twilio) live in my `~/Voice_Agent/.env` on my Mac. I keep them out of any shared/pasted document on purpose. If the new session needs a value to do dev work, I'll provide it directly in that session — don't expect it here, and never ask me to paste secrets into a document that gets moved around.
