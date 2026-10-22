import io
import os
import tempfile
import time
from urllib.parse import quote

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

import call_logs
import bookings_store
from auth import get_current_user, sign_in, sign_up
from leads import save_lead
from deps import require_org_member
from lead_extract import extract_lead
from providers import get_llm_provider, get_stt, get_tts, get_vector_store
from rag_chain import build_qa_chain
from retell_webhook import router as retell_router
from scrape import scrape_site
from tenancy import create_org, list_orgs
from tools_api import router as tools_router

# File types a user is allowed to upload into their knowledge base.
_ALLOWED_UPLOAD_EXTS = {".pdf", ".txt", ".md", ".docx", ".doc"}

# A single shared knowledge base used only by the public /demo/* endpoints.
# It holds no real customer data — just whatever the demo visitor typed in.
DEMO_ORG = "demo-preview"

# Load variables from a local .env file (if present) into the environment.
load_dotenv()
os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = FastAPI()

# Allow the marketing site (served from another origin) to POST to /leads.
# Set LUMIDESK_SITE_ORIGIN to your domain(s) in production, e.g.
#   LUMIDESK_SITE_ORIGIN="https://lumidesk.ai,https://www.lumidesk.ai"
_SITE_ORIGINS = [o.strip() for o in os.getenv("LUMIDESK_SITE_ORIGIN", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_SITE_ORIGINS or ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Booking tools the voice agent (Retell/Vapi) calls mid-call:
#   POST /tools/check_availability, /tools/book_appointment, /tools/send_sms
app.include_router(tools_router)

# Retell's post-call webhook -> writes the finished call into Postgres call_logs:
#   POST /retell/webhook/{secret}
app.include_router(retell_router)

# Wire up the capabilities through the provider layer.
# To swap any vendor, edit providers/__init__.py -- not this file.
#
# These are built LAZILY (on first use), never at import, so the web service
# always boots -- even on a host with no voice-provider keys set. The phone path
# (Retell webhook), booking tools, auth, and the dashboard APIs don't touch them;
# only the in-browser voice demo and knowledge-base ingest do. A misconfigured
# TTS/LLM key can no longer take the whole service down at startup.
_providers: dict = {}


def _stt():
    if "stt" not in _providers:
        _providers["stt"] = get_stt()
    return _providers["stt"]


def _tts():
    if "tts" not in _providers:
        _providers["tts"] = get_tts()
    return _providers["tts"]


def _llm():
    if "llm" not in _providers:
        _providers["llm"] = get_llm_provider().get_llm()
    return _providers["llm"]


# The knowledge base is PER-ORG, so we can't build one shared chain at startup;
# we keep the vector store and pick the right org's documents on each request.
def _vs():
    if "vs" not in _providers:
        _providers["vs"] = get_vector_store()
    return _providers["vs"]


class Credentials(BaseModel):
    email: str
    password: str


@app.get("/health")
def health():
    return {"status": "ok"}


class LeadIn(BaseModel):
    kind: str = "book"        # "book" (contact form) or "demo" (hear-it-live gate)
    name: str = ""
    phone: str = ""
    business: str = ""
    website: str = ""
    email: str = ""
    note: str = ""
    page: str = ""
    ts: str = ""


@app.post("/leads")
def create_lead(body: LeadIn):
    """Public: capture a marketing-site lead ('Book a demo' / 'Hear it live').

    Intentionally unauthenticated (the whole point is anonymous visitors). We only
    require a name plus at least one way to reach them, then store it via leads.py.
    """
    if not body.name.strip() or not (body.phone.strip() or body.email.strip()):
        return JSONResponse(
            {"error": "A name and a phone or email are required."}, status_code=400
        )
    data = body.model_dump() if hasattr(body, "model_dump") else body.dict()
    save_lead(data)
    return {"ok": True}


@app.post("/auth/signup")
def auth_signup(creds: Credentials):
    try:
        res = sign_up(creds.email, creds.password)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    user = getattr(res, "user", None)
    return {"user_id": getattr(user, "id", None), "email": getattr(user, "email", None)}


@app.post("/auth/login")
def auth_login(creds: Credentials):
    try:
        res = sign_in(creds.email, creds.password)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=401)
    session = getattr(res, "session", None)
    if not session:
        return JSONResponse({"error": "Login failed — is the email confirmed?"}, status_code=401)
    return {"access_token": session.access_token, "token_type": "bearer"}


@app.get("/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    """Protected: proves the login token is valid and identifies the caller."""
    return user


class OrgCreate(BaseModel):
    name: str


@app.post("/orgs")
def create_org_endpoint(body: OrgCreate, user: dict = Depends(get_current_user)):
    """Create an organization; the logged-in user becomes its owner."""
    org_id = create_org(body.name, user["id"])
    return {"org_id": org_id, "name": body.name, "role": "owner"}


@app.get("/orgs")
def list_orgs_endpoint(user: dict = Depends(get_current_user)):
    """List the organizations the logged-in user belongs to."""
    return {"orgs": list_orgs(user["id"])}


@app.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    ctx: dict = Depends(require_org_member),
):
    """Protected: add a document to the CALLER'S org knowledge base.

    The org comes from ctx (derived from the login token + X-Org-Id membership
    check), never from the uploaded data — so a user can only ever add documents
    to an org they actually belong to.
    """
    org_id = ctx["org_id"]
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in _ALLOWED_UPLOAD_EXTS:
        return JSONResponse(
            {"error": f"Unsupported file type: {suffix or '(none)'}"},
            status_code=400,
        )

    data = await file.read()
    # Write to a temp file so the document loaders (which read from disk) can use it.
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        chunks = _vs().add_documents(org_id, file_paths=[tmp_path])
    finally:
        os.remove(tmp_path)

    return {"org_id": org_id, "filename": file.filename, "chunks_added": chunks}


@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("web/frontend.html", "r", encoding="utf-8") as f:
        return f.read()


def _voice_answer(
    org_id: str,
    audio_bytes: bytes,
    language: str,
    call_id: str | None = None,
    log: bool = False,
    history: str = "",
):
    """Shared voice pipeline: transcribe -> retrieve+answer over org's KB -> speak.

    Returns a StreamingResponse of mp3 audio, or a JSONResponse error. The
    recognized caller text and the spoken reply are returned as response headers
    (X-Caller-Text / X-Reply-Text, URL-encoded) so the browser can build a live
    transcript. When log=True and a call_id is given, the exchange is appended to
    the org's call log AFTER the audio is sent, so logging never slows the reply.
    """
    t0 = time.perf_counter()
    if not _vs().has_index(org_id):
        return JSONResponse(
            {"error": "No knowledge base yet — set it up first."}, status_code=404
        )

    user_text = _stt().transcribe(audio_bytes, language)
    t_stt = time.perf_counter()
    if not user_text:
        return JSONResponse({"error": "Could not transcribe audio."}, status_code=400)

    retriever = _vs().get_retriever(org_id)
    qa_chain = build_qa_chain(_llm(), retriever)
    answer = qa_chain.invoke({"question": user_text, "history": history or ""})
    t_llm = time.perf_counter()

    try:
        audio_response = _tts().synthesize(answer)
    except Exception as e:
        print(f"❌ TTS error: {e}")
        return JSONResponse({"error": "Could not synthesize speech."}, status_code=500)
    t_tts = time.perf_counter()

    print(
        f"⏱  transcribe {t_stt - t0:5.2f}s | retrieve+think {t_llm - t_stt:5.2f}s | "
        f"speak {t_tts - t_llm:5.2f}s | TOTAL {t_tts - t0:5.2f}s  |  you said: {user_text!r}"
    )

    headers = {
        "X-Caller-Text": quote(user_text or ""),
        "X-Reply-Text": quote(answer or ""),
    }
    resp = StreamingResponse(
        io.BytesIO(audio_response), media_type="audio/mpeg", headers=headers
    )
    if log and call_id:
        # Runs after the response is streamed, so it adds no latency to the reply.
        resp.background = BackgroundTask(
            call_logs.log_turn, org_id, call_id, user_text, answer
        )
    return resp


@app.post("/ask")
async def ask(
    audio: UploadFile = File(...),
    language: str = Form("english"),
    call_id: str = Form(None),
    history: str = Form(""),
    # The org comes from the logged-in user's membership (X-Org-Id header,
    # verified against the database), not from anything the caller claims.
    ctx: dict = Depends(require_org_member),
):
    audio_bytes = await audio.read()
    return _voice_answer(
        ctx["org_id"], audio_bytes, language, call_id=call_id, log=True, history=history
    )


# ── Call log / mini-CRM (owner-facing, per org) ───────────────────

class StatusUpdate(BaseModel):
    status: str  # 'resolved' | 'unresolved'


@app.get("/calls")
def list_calls_endpoint(ctx: dict = Depends(require_org_member)):
    """List this org's logged calls, newest first."""
    return {"calls": call_logs.list_calls(ctx["org_id"])}


@app.patch("/calls/{call_row_id}")
def update_call_status(
    call_row_id: str,
    body: StatusUpdate,
    ctx: dict = Depends(require_org_member),
):
    """Mark a call resolved or unresolved."""
    try:
        call_logs.set_status(ctx["org_id"], call_row_id, body.status)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return {"ok": True, "id": call_row_id, "status": body.status}


@app.post("/calls/{call_row_id}/finalize")
def finalize_call(call_row_id: str, ctx: dict = Depends(require_org_member)):
    """When a call ends, pull the lead details out of its transcript and save them."""
    transcript = call_logs.get_transcript(ctx["org_id"], call_row_id)
    if transcript is None:
        return JSONResponse({"error": "Call not found."}, status_code=404)
    fields = extract_lead(_llm(), transcript)
    call_logs.save_extract(ctx["org_id"], call_row_id, fields)
    return {"ok": True, "id": call_row_id, **fields}


# ── Bookings (owner-facing, per org) ──────────────────────────────
# Bookings are WRITTEN live during a call by /tools/book_appointment. These
# endpoints are the dashboard's read + manage side.

class BookingStatusUpdate(BaseModel):
    status: str  # 'booked' | 'cancelled' | 'completed' | 'no_show'


@app.get("/bookings")
def list_bookings_endpoint(ctx: dict = Depends(require_org_member)):
    """List this org's bookings, soonest first."""
    return {"bookings": bookings_store.list_bookings(ctx["org_id"])}


@app.patch("/bookings/{booking_id}")
def update_booking_status(
    booking_id: str,
    body: BookingStatusUpdate,
    ctx: dict = Depends(require_org_member),
):
    """Mark a booking done/cancelled/etc. (dashboard done-toggle -> 'completed')."""
    try:
        changed = bookings_store.set_booking_status(ctx["org_id"], booking_id, body.status)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    if not changed:
        return JSONResponse({"error": "Booking not found."}, status_code=404)
    return {"ok": True, "id": booking_id, "status": body.status}


@app.delete("/bookings/{booking_id}")
def delete_booking_endpoint(booking_id: str, ctx: dict = Depends(require_org_member)):
    """Remove a booking from the dashboard (does not touch the calendar event)."""
    if not bookings_store.delete_booking(ctx["org_id"], booking_id):
        return JSONResponse({"error": "Booking not found."}, status_code=404)
    return {"ok": True, "id": booking_id}


@app.get("/dashboard", response_class=HTMLResponse)
def serve_dashboard():
    with open("web/dashboard.html", "r", encoding="utf-8") as f:
        return f.read()


# ── Polished UI pages (the redesigned Calls dashboard + Bookings calendar) ──
# Served additively so they don't disturb the existing pages. They currently
# render example data; wiring them to live /calls and /bookings is the next step.
@app.get("/ui/dashboard", response_class=HTMLResponse)
def serve_ui_dashboard():
    with open("web/ui/dashboard.html", "r", encoding="utf-8") as f:
        return f.read()


@app.get("/ui/bookings", response_class=HTMLResponse)
def serve_ui_bookings():
    with open("web/ui/bookings.html", "r", encoding="utf-8") as f:
        return f.read()


class ScrapeIn(BaseModel):
    url: str = ""


@app.post("/scrape")
def scrape_endpoint(body: ScrapeIn, ctx: dict = Depends(require_org_member)):
    """Onboard by website: read the caller's site and add it to their knowledge base."""
    try:
        result = scrape_site(body.url)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception:
        return JSONResponse({"error": "Couldn't reach that site right now."}, status_code=502)
    chunks = _vs().add_documents(ctx["org_id"], texts=[result["text"]])
    return {
        "ok": True, "org_id": ctx["org_id"],
        "pages": result["pages"], "chars": result["chars"], "chunks": chunks,
    }


# ── Public demo endpoints (no login) ──────────────────────────────
# These power the owner-facing demo page. They use ONE shared demo knowledge
# base and hold no real customer data, so they are intentionally unauthenticated.

class DemoSetup(BaseModel):
    business: str = ""
    services: str = ""
    hours: str = ""
    area: str = ""
    pricing: str = ""
    notes: str = ""


@app.get("/demo", response_class=HTMLResponse)
def serve_demo():
    with open("web/demo.html", "r", encoding="utf-8") as f:
        return f.read()


@app.post("/demo/setup")
def demo_setup(body: DemoSetup):
    """Build the demo assistant's knowledge from the guided-interview answers."""
    text = (
        f"Business name: {body.business}\n"
        f"Services offered: {body.services}\n"
        f"Hours, including after-hours and emergencies: {body.hours}\n"
        f"Service area: {body.area}\n"
        f"Pricing and quotes: {body.pricing}\n"
        f"Other useful notes: {body.notes}\n"
    )
    chunks = _vs().build_index(DEMO_ORG, texts=[text])
    return {"ok": True, "chunks": chunks, "business": body.business}


@app.post("/demo/ask")
async def demo_ask(
    audio: UploadFile = File(...),
    language: str = Form("english"),
    call_id: str = Form(None),
    history: str = Form(""),
):
    """Answer a spoken question from the demo knowledge base (no login).

    log=False on purpose: demo calls are NEVER written to the database (the demo
    builds its call log in the browser instead), so trying the pitch can't crowd
    a real customer's data.
    """
    audio_bytes = await audio.read()
    return _voice_answer(
        DEMO_ORG, audio_bytes, language, call_id=call_id, log=False, history=history
    )


class TranscriptIn(BaseModel):
    transcript: str = ""


@app.post("/demo/summarize")
def demo_summarize(body: TranscriptIn):
    """Extract lead details from a demo call's transcript. Returns them; stores nothing."""
    return extract_lead(_llm(), body.transcript)


@app.post("/demo/scrape")
def demo_scrape(body: ScrapeIn):
    """Public onboarding-by-website for the demo: read the site, build the demo KB.

    SSRF-guarded inside scrape_site(); this endpoint is intentionally unauthenticated
    like the rest of /demo, and only ever writes to the shared demo knowledge base.
    """
    try:
        result = scrape_site(body.url)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    except Exception:
        return JSONResponse({"error": "Couldn't reach that site right now."}, status_code=502)
    chunks = _vs().build_index(DEMO_ORG, texts=[result["text"]])
    return {"ok": True, "pages": result["pages"], "chars": result["chars"], "chunks": chunks}
