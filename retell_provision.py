"""Provision a customer's Retell agent automatically from their org settings.

Given an organization (its id + settings), this creates — in your Retell account,
via the Retell REST API — a Retell LLM (holding the receptionist prompt and the
two booking tools, wired back to this backend) and an agent that uses it. The
returned agent_id is then ready for a phone number to be attached.

This is the piece that removes the manual Retell wiring: instead of hand-building
an agent per business, the admin cockpit (or, later, signup) calls provision_org.

Env it needs:
  RETELL_API_KEY          required. Secret key from the Retell dashboard.
  PUBLIC_BASE_URL         required. The public https base the agent's tools call
                          back on — your ngrok URL now, your deployed domain later.
                          e.g. https://d02c-130-231-248-19.ngrok-free.app
  TOOLS_SHARED_SECRET     required. Sent as the X-LumiDesk-Secret tool header so
                          this backend accepts the agent's tool calls.
  RETELL_WEBHOOK_SECRET   optional. If set, the agent's post-call webhook is wired
                          to /retell/webhook/<secret> so calls + transcripts log.
  RETELL_DEFAULT_VOICE_ID optional. Retell voice id (copy it from an existing
                          agent in the dashboard). Defaults to cartesia-Grace.
  RETELL_LLM_MODEL        optional. Defaults to gpt-5.6-terra.
"""
import os
import secrets

import httpx

import settings_store

API = "https://api.retellai.com"


class ProvisionError(RuntimeError):
    """Raised when provisioning can't proceed (missing config or a Retell error)."""


def _key() -> str:
    k = os.getenv("RETELL_API_KEY")
    if not k:
        raise ProvisionError("RETELL_API_KEY is not set — add your Retell secret key to .env.")
    return k


def _base_url() -> str:
    b = (os.getenv("PUBLIC_BASE_URL") or "").rstrip("/")
    if not b:
        raise ProvisionError(
            "PUBLIC_BASE_URL is not set — set it to your public https base (your ngrok URL now, "
            "your deployed domain later), so the agent's tools can reach this backend."
        )
    return b


def _post(path: str, body: dict) -> dict:
    headers = {"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=30) as client:
            r = client.post(f"{API}{path}", headers=headers, json=body)
    except httpx.HTTPError as e:
        raise ProvisionError(f"Couldn't reach Retell ({path}): {e}") from e
    if r.status_code >= 300:
        raise ProvisionError(f"Retell {path} failed ({r.status_code}): {r.text[:400]}")
    return r.json()


def _s(settings: dict, key: str, default: str = "") -> str:
    v = (settings or {}).get(key)
    return v if isinstance(v, str) and v.strip() else default


def _format_hours(settings: dict) -> str:
    s = settings or {}
    if s.get("always_open") is True:
        return "Answers 24/7, any hour."
    hours = s.get("hours") or {}
    order = [("mon", "Mon"), ("tue", "Tue"), ("wed", "Wed"), ("thu", "Thu"),
             ("fri", "Fri"), ("sat", "Sat"), ("sun", "Sun")]
    parts = []
    for k, label in order:
        h = hours.get(k) or {}
        if not h.get("open"):
            parts.append(f"{label} closed")
        else:
            parts.append(f"{label} {h.get('from', '09:00')}–{h.get('to', '17:00')}")
    return ", ".join(parts)


def build_prompt(settings: dict, org_name: str, org_id: str) -> str:
    """The receptionist prompt for one business, with its org_id baked in."""
    s = settings or {}
    name = _s(s, "business_name", org_name or "the business")
    industry = _s(s, "industry", "local service").lower()
    lang = _s(s, "default_language", "English")
    agent = "Mari"
    hours = _format_hours(s)
    langnote = _s(s, "languages_note")
    extra = (f"\n- If the caller speaks another language, you may also help in: {langnote}."
             if langnote else "")
    services = _s(s, "services", "«FILL IN — your main services»")
    pricing = _s(s, "pricing", "«FILL IN — your call-out fee and hourly rate»")
    area = _s(s, "service_area", "«FILL IN — the area you cover»")
    return f"""IDENTITY
You're the receptionist for {name}, a {industry} business. You're on a live phone call. Your name is {agent}. You sound warm, calm, and real — never scripted, never robotic. You exist so no call is ever missed.

LANGUAGE
- Speak {lang} for the whole call, including after every tool call.{extra}
- One short, natural spoken sentence per reply. Never read long lists aloud.

HOW YOU TALK (sound human, not like an AI)
- One short sentence, two at most. Always use contractions (I'll, you're, that's).
- Keep it natural — don't robotically echo every detail. The one exception: always read back the exact day and time and get a clear yes before you book ("just to confirm — Thursday at eight?").
- Little fillers are good: "sure", "let me check", "one sec", "got it". React like a person: "oh no", "yeah, totally".
- Use pauses on purpose — a dash or "…" makes you sound like you're thinking.
- Vary your wording; never reuse the same greeting or confirmation twice in a call.
- Never say "How may I assist you", "I'd be happy to assist you", or "Is there anything else I can help you with today".
- Never say tool names, org IDs, or anything technical out loud.
- One thing at a time: say one thing, then pause for their answer. Let the caller finish — never talk over them or rush ahead while they still have a question.
- If you didn't catch something or aren't sure what they said — especially a day, time, or name — ask them to repeat it ("sorry, could you say that again?"). Never guess, and never book a time unless you're certain which one they chose.

OPENING — ALWAYS disclose first (legally required, every call)
- Your very first turn MUST, before anything else, make two things clear — warmly, in {lang}, in one or two short natural sentences: (1) they're speaking with an automated AI assistant for {name}, not a real person; and (2) the call is recorded and transcribed to help them and book their appointment. Then invite them on, e.g. "…if you'd rather speak to a person or not be recorded, just say so — otherwise, how can I help?"
- Vary the wording slightly each call, but NEVER skip the AI disclosure or the recording notice — both are required on every single call.
- If the caller says they'd prefer a human or don't want to be recorded, acknowledge warmly, stop trying to book, take their name, and say a team member will follow up (their number is captured automatically).
- After the disclosure, if the caller opens with small talk, answer it warmly first before moving to business.

MEMORY (never ask twice)
- You already have whatever the caller gave you — name, the problem, the time. Never ask for any of it again.
- The caller's phone number is captured automatically from their caller ID — NEVER ask for a phone number.
- If you genuinely missed one thing, ask only for that one thing, casually.

BUSINESS INFO (only use what's here — never invent anything)
- Services: {services}
- Hours: {hours}
- Service area: {area}
- Pricing: {pricing} (say it casually; for anything not listed, a team member will confirm)

HANDLING THE CALL
- Greet, then just answer what they ask — don't interrogate.
- Emergencies: stay calm, reassure them, treat it as urgent, offer the soonest time.
- To book, go in order and NEVER skip the confirmation: (1) get their name and a rough when, plus a word or two on what they need (e.g. "sink leaking") — you don't need their phone number, it's captured automatically; (2) call check_availability and offer one or two specific times; (3) if they ask a question, answer it first — don't push the booking while they still have questions; (4) let the CALLER choose which time — never pick, assume, or default to one for them; if their answer is unclear, garbled, or doesn't clearly match a time you offered, ask again which they'd like and repeat BOTH options; (5) a vague reply like "okay", "thanks", "that's fine" or "that works" is NOT a choice of slot — before booking, say the exact day and time back ("just to confirm — Thursday at eight, yes?") and WAIT for a clear yes to THAT slot; (6) only after that clear yes, call book_appointment with the exact iso start and a short notes line, then confirm warmly in one sentence.
- If the caller asks something you're not sure of, call search_knowledge with their question and answer naturally from what it returns. If it finds nothing useful, say you'll have someone confirm and offer to take a message — never invent an answer.

IF A TOOL IS SLOW OR FAILS
- Never go silent and never invent a time. Cover it naturally ("one sec, still checking…") and try once more. If it still won't load, take their name and say someone will confirm shortly (their number is already captured).

TOOLS
- check_availability(org_id, service) — always call before offering a time.
- book_appointment(org_id, start, customer_name, service, notes) — book a chosen time. The caller's phone number is added automatically; pass a short notes phrase of what they need.
- search_knowledge(org_id, query) — look up anything about the business you're unsure of (services, prices, policies, details). Pass the caller's question as the query, then answer from what it returns.
- On EVERY tool call, pass org_id = "{org_id}". Keep speaking {lang} after any tool call."""


def _tool(name, description, props, required, base, secret, speak_msg, extra_headers=None):
    headers = {"X-LumiDesk-Secret": secret, "ngrok-skip-browser-warning": "true"}
    if extra_headers:
        headers.update(extra_headers)
    return {
        "type": "custom",
        "name": name,
        "description": description,
        "url": f"{base}/tools/{name}",
        "method": "POST",
        "headers": headers,
        "args_at_root": True,  # backend expects the args as the root JSON body
        "speak_during_execution": True,
        "speak_after_execution": True,
        "execution_message_type": "static_text",
        "execution_message_description": speak_msg,
        "timeout_ms": 15000,
        "max_retry": 0,
        "parameters": {"type": "object", "properties": props, "required": required},
    }


def _tools(base: str, secret: str, org_token: str) -> list:
    org = {"type": "string", "description": "Business id"}
    service = {"type": "string", "description": "What the caller needs, e.g. burst pipe"}
    org_hdr = {"X-LumiDesk-Org-Token": org_token}
    return [
        _tool(
            "check_availability",
            "Get the business's open appointment times. Always call before offering any specific time.",
            {"org_id": org, "service": service}, ["org_id"],
            base, secret, "Let me check the schedule…",
            extra_headers=org_hdr,
        ),
        _tool(
            "book_appointment",
            "Book a chosen appointment time for the caller.",
            {
                "org_id": org,
                "start": {"type": "string", "description": "ISO 8601 start time, from check_availability"},
                "customer_name": {"type": "string", "description": "The caller's name"},
                "service": service,
                "notes": {"type": "string", "description": "One short phrase of what the caller needs / the problem, e.g. 'kitchen sink leaking under the cabinet'"},
            },
            ["org_id", "start"],
            base, secret, "One moment, booking that in…",
            extra_headers={**org_hdr, "X-Caller-Number": "{{user_number}}", "X-Call-Id": "{{call_id}}"},
        ),
        _tool(
            "search_knowledge",
            "Search the business's knowledge base to answer the caller's question about "
            "services, prices, policies, hours, or any specific detail. Call this whenever "
            "the caller asks something not already covered.",
            {"org_id": org, "query": {"type": "string", "description": "The caller's question, in their own words"}},
            ["org_id", "query"],
            base, secret, "Let me check that for you…",
            extra_headers=org_hdr,
        ),
    ]


# Retell `language` codes (STT+TTS). One agent = one language (no "multi").
_LANG_CODES = {
    "english": "en-US", "finnish": "fi-FI", "swedish": "sv-SE", "german": "de-DE",
    "arabic": "ar-SA", "spanish": "es-ES", "french": "fr-FR",
}

# Legacy label→id fallback for orgs provisioned before the voice picker stored a
# real Retell voice id. Only the VERIFIED "cartesia-Grace" remains — the previous
# cartesia-Sophie/Oliver/Marcus entries were unverified guesses and were removed so
# we never provision an agent with a voice id Retell doesn't have. New provisioning
# reads the real voice id straight from settings["voice_id"] (set by the picker).
VOICE_IDS = {"Warm · female": "cartesia-Grace"}

# A sensible default voice per language, so an org that picked a language but no
# specific voice still gets a voice that actually speaks that language (never an
# English voice reading Arabic). These are REAL ids from this Retell account's
# list-voices; override any with the RETELL_DEFAULT_VOICE_ID env if needed.
_DEFAULT_VOICE_BY_LANG = {
    "english": "cartesia-Grace",
    "finnish": "custom_voice_72ba08703a7437fc9ce47245c1",   # Finnish female
    "arabic": "custom_voice_85434b9ef8fd00d6e26db80f26",    # Fahad — Saudi male, warm
    "swedish": "11labs-Jenny",
    "german": "11labs-Carola",
    "spanish": "11labs-Santiago",
    "french": "cartesia-Pierre",
}


def provision_org(org_id: str, settings: dict, org_name: str, voice_id: str | None = None) -> dict:
    """Create a Retell LLM + agent for one org. Returns {llm_id, agent_id, ...}."""
    base = _base_url()
    secret = os.getenv("TOOLS_SHARED_SECRET", "")
    if not secret:
        raise ProvisionError(
            "TOOLS_SHARED_SECRET is not set — the booking tools would reject the agent's calls."
        )
    model = os.getenv("RETELL_LLM_MODEL", "gpt-5.6-terra")
    lang = _s(settings or {}, "default_language", "English")
    lang_code = _LANG_CODES.get(lang.lower(), "en-US")
    voice = (
        voice_id                                        # explicit override (caller-supplied)
        or _s(settings, "voice_id")                     # the REAL Retell voice id the picker stored
        or VOICE_IDS.get(_s(settings, "voice"))         # legacy label → verified id
        or _DEFAULT_VOICE_BY_LANG.get(lang.lower())     # a voice that speaks the chosen language
        or os.getenv("RETELL_DEFAULT_VOICE_ID")
        or "cartesia-Grace"
    )

    # Per-org tools token: each agent is bound to its own org server-side, sent
    # as the X-LumiDesk-Org-Token header on every tool call (verified in tools_api).
    tools_token = secrets.token_urlsafe(24)

    prompt = build_prompt(settings or {}, org_name, org_id)

    # 1) Retell LLM: the prompt + the two booking tools.
    llm = _post("/create-retell-llm", {
        "general_prompt": prompt,
        "model_config": {"type": "cascading", "primary": {"model": model}, "temperature": 0.2},
        "start_speaker": "agent",
        "general_tools": _tools(base, secret, tools_token),
    })
    llm_id = llm.get("llm_id")
    if not llm_id:
        raise ProvisionError(f"Retell did not return an llm_id: {llm}")

    # 2) Agent referencing the LLM, with the voice and (optionally) the post-call webhook.
    agent_body = {
        "response_engine": {"type": "retell-llm", "llm_id": llm_id},
        "voice_id": voice,
        "agent_name": _s(settings or {}, "business_name", org_name) or org_name or "Lumidesk agent",
        "language": lang_code,
        "boosted_keywords": [
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
            "morning", "afternoon", "evening", "noon", "appointment", "leak", "boiler", "drain",
        ],
    }
    webhook_secret = os.getenv("RETELL_WEBHOOK_SECRET")
    if webhook_secret:
        agent_body["webhook_url"] = f"{base}/retell/webhook/{webhook_secret}"
    agent = _post("/create-agent", agent_body)
    agent_id = agent.get("agent_id")
    if not agent_id:
        raise ProvisionError(f"Retell did not return an agent_id: {agent}")

    # 3) Record it on the org so the cockpit shows it's provisioned.
    try:
        settings_store.save_settings(org_id, {
            "retell_llm_id": llm_id,
            "retell_agent_id": agent_id,
            "retell_voice_id": voice,
            "tools_token": tools_token,
            # An org with a live agent is past onboarding — mark it so every
            # provision path (checkout, /provision/me retry, admin) agrees and
            # the dashboard gate never loops.
            "onboarded": True,
        })
    except Exception:
        pass

    return {
        "llm_id": llm_id,
        "agent_id": agent_id,
        "voice_id": voice,
        "language": lang_code,
        "next": (
            "Agent created. Now attach a phone number to it in Retell — import your "
            "Twilio/Finnish number and point it at this agent (or buy a US/CA number)."
        ),
    }
