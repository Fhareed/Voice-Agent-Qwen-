"""Outbound calling via Retell — one reusable outbound agent per org, plus the
call-placing helper.

Inbound agents are provisioned by retell_provision.py (one per business, attached
to a phone number). Outbound is different: we keep ONE outbound agent per org and
feed each call its script + the person's name through Retell *dynamic variables*,
so a new campaign never needs a new agent. create_outbound_call() then rings one
number with that agent via Retell's POST /v2/create-phone-call.

Env:
  RETELL_API_KEY                 required (shared with retell_provision).
  PUBLIC_BASE_URL                required — the agent's post-call webhook calls back here.
  RETELL_OUTBOUND_FROM_NUMBER    the E.164 number to dial OUT from. Must be
                                 registered in your Retell account. (Retell-bought
                                 numbers only dial US; import a SIP number for
                                 other countries.) A campaign may override it.
  RETELL_DEFAULT_VOICE_ID / RETELL_LLM_MODEL   optional (as in retell_provision).
"""
import os

import settings_store
from retell_provision import ProvisionError, _post, _s

_LANG_CODES = {"english": "en-US", "finnish": "fi-FI", "swedish": "sv-SE", "german": "de-DE"}

# {{customer_name}}, {{goal}} and {{script}} are Retell dynamic variables, filled
# per-call. %%AGENT%%, %%BUSINESS%% and %%LANG%% are baked in when the per-org
# agent is created.
_OUTBOUND_TEMPLATE = """IDENTITY
You're %%AGENT%%, calling on behalf of %%BUSINESS%%. This is an OUTBOUND call to {{customer_name}}. You sound warm, calm and real — never scripted, never robotic.

WHY YOU'RE CALLING
{{goal}}

YOUR SCRIPT / WHAT TO COVER
{{script}}

HOW YOU TALK (sound human, not like an AI)
- One short sentence, two at most. Always use contractions (I'll, you're, that's).
- Open by greeting them by name, saying who you're with and why you're calling — briefly — then ask if it's a good moment.
- If it's a bad time, offer to call back another time and let them go politely.
- Ask one thing at a time, then pause and actually listen. Never talk over them.
- React like a person: "sure", "got it", "no problem". Vary your wording.
- If they're not interested, thank them warmly and wrap up — never push hard.
- Never invent facts about the business. If you don't know, say someone will follow up.
- If asked directly whether you're an AI, be honest and brief.

VOICEMAIL
- If you reach voicemail, leave ONE short, friendly message: who you're with, why you called, and that you'll try again — then end.

WRAPPING UP
- Once you've covered the script and have their answers, confirm anything important in one sentence, thank them by name, and end the call.

LANGUAGE
- Speak %%LANG%% for the whole call.
"""


def _outbound_prompt(business: str, lang: str, agent: str = "Mari") -> str:
    return (
        _OUTBOUND_TEMPLATE
        .replace("%%AGENT%%", agent)
        .replace("%%BUSINESS%%", business)
        .replace("%%LANG%%", lang)
    )


def provision_outbound_org(org_id: str, settings: dict | None = None) -> str:
    """Create (once) the org's outbound Retell LLM + agent. Returns the agent_id."""
    settings = settings if settings is not None else settings_store.get_settings(org_id)
    base = (os.getenv("PUBLIC_BASE_URL") or "").rstrip("/")
    if not base:
        raise ProvisionError("PUBLIC_BASE_URL is not set — set it to your public https base.")
    business = _s(settings, "business_name", "the business")
    lang = _s(settings, "default_language", "English")
    lang_code = _LANG_CODES.get(lang.lower(), "en-US")
    voice = os.getenv("RETELL_DEFAULT_VOICE_ID") or "cartesia-Grace"
    model = os.getenv("RETELL_LLM_MODEL", "gpt-5.6-terra")

    llm = _post("/create-retell-llm", {
        "general_prompt": _outbound_prompt(business, lang),
        "model_config": {"type": "cascading", "primary": {"model": model}, "temperature": 0.3},
        "start_speaker": "agent",
    })
    llm_id = llm.get("llm_id")
    if not llm_id:
        raise ProvisionError(f"Retell did not return an llm_id for the outbound agent: {llm}")

    agent_body = {
        "response_engine": {"type": "retell-llm", "llm_id": llm_id},
        "voice_id": voice,
        "agent_name": f"{business} — outbound",
        "language": lang_code,
    }
    webhook_secret = os.getenv("RETELL_WEBHOOK_SECRET")
    if webhook_secret:
        agent_body["webhook_url"] = f"{base}/retell/webhook/{webhook_secret}"
    agent = _post("/create-agent", agent_body)
    agent_id = agent.get("agent_id")
    if not agent_id:
        raise ProvisionError(f"Retell did not return an agent_id for the outbound agent: {agent}")

    try:
        settings_store.save_settings(org_id, {
            "retell_outbound_agent_id": agent_id,
            "retell_outbound_llm_id": llm_id,
        })
    except Exception:
        pass
    return agent_id


def get_or_create_outbound_agent(org_id: str) -> str:
    """Return the org's outbound agent_id, provisioning it on first use."""
    settings = settings_store.get_settings(org_id)
    existing = _s(settings, "retell_outbound_agent_id")
    if existing:
        return existing
    return provision_outbound_org(org_id, settings)


def create_outbound_call(
    *,
    org_id: str,
    campaign_id: str,
    target_id: str,
    to_number: str,
    customer_name: str = "",
    goal: str = "",
    script: str = "",
    from_number: str | None = None,
) -> str | None:
    """Ring one number with the org's outbound agent. Returns the Retell call_id."""
    api_from = (from_number or os.getenv("RETELL_OUTBOUND_FROM_NUMBER") or "").strip()
    if not api_from:
        raise ProvisionError(
            "No outbound number set — set RETELL_OUTBOUND_FROM_NUMBER (a number registered "
            "in Retell) or the campaign's from_number."
        )
    agent_id = get_or_create_outbound_agent(org_id)
    body = {
        "from_number": api_from,
        "to_number": (to_number or "").strip(),
        "override_agent_id": agent_id,
        "metadata": {
            "org_id": org_id,
            "campaign_id": campaign_id,
            "target_id": target_id,
            "direction": "outbound",
        },
        "retell_llm_dynamic_variables": {
            "customer_name": customer_name or "there",
            "goal": goal or "",
            "script": script or "",
        },
    }
    res = _post("/v2/create-phone-call", body)
    return res.get("call_id")
