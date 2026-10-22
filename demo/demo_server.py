"""LumiDesk — demo server for the live prototype presentation.

Why this file exists:
The full app.py drags in the LLM / RAG / torch / faiss stack, which is slow to
start and has many ways to fail in a live room. For the DEMO you only need the
three booking tools plus the post-call webhook. This server mounts ONLY those, so
it:
  - boots in ~2 seconds,
  - needs NO database, NO Google Calendar, NO Twilio, NO model files,
  - stores bookings AND the full call transcript in local files, and shows them
    on LIVE pages.

Two pages during the demo:
  http://localhost:8000/demo        -> bookings pop in the moment the agent books
  http://localhost:8000/dashboard   -> after the call ends, the whole conversation
                                       (every line) + the booking appear here

── Run it ────────────────────────────────────────────────────────────────
    cd /Users/farid/Voice_Agent
    export TOOLS_SHARED_SECRET=lumidesk-demo-secret     # same value goes in Retell
    uvicorn demo_server:app --port 8000

Then in a second terminal:
    ngrok http 8000                # gives you an https URL for Retell

Point Retell at that https URL:
    - each booking tool ->  <https-url>/tools/...
    - the agent webhook ->  <https-url>/webhooks/retell
"""
import datetime
import json
import os
from pathlib import Path

# Sensible demo defaults so nothing is "unconfigured" in a bad way.
os.environ.setdefault("TOOLS_SHARED_SECRET", "lumidesk-demo-secret")
os.environ.setdefault("DEFAULT_TZ", "Europe/Helsinki")
os.environ.setdefault("BOOKING_SLOT_MINUTES", "60")
os.environ.setdefault("BOOKING_DAY_START", "8")
os.environ.setdefault("BOOKING_DAY_END", "18")

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

import call_store  # pure-stdlib store for calls + bookings (no DB)

BOOKINGS_FILE = Path(__file__).with_name("demo_bookings.jsonl")
_bookings: list[dict] = []

# Load any bookings from earlier rehearsals so the page isn't empty on restart.
if BOOKINGS_FILE.exists():
    for line in BOOKINGS_FILE.read_text().splitlines():
        line = line.strip()
        if line:
            try:
                _bookings.append(json.loads(line))
            except json.JSONDecodeError:
                pass


def _demo_save(org_id, name, phone, email, service, start_dt, notes,
               calendar_event_id, call_id):
    """Replaces the DB save for the demo: append to a local file + memory.

    NOTE: call_id is stored so the dashboard can tie this booking to the call
    that produced it.
    """
    rec = {
        "id": f"demo-{len(_bookings) + 1:03d}",
        "org_id": org_id,
        "name": name or "",
        "phone": phone or "",
        "service": service or "appointment",
        "start": start_dt.isoformat() if hasattr(start_dt, "isoformat") else str(start_dt),
        "notes": notes or "",
        "call_id": call_id or "",
        "booked_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }
    _bookings.append(rec)
    with BOOKINGS_FILE.open("a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return rec["id"]


# Booking tools import the heavy repo (db, calendar, twilio). On your Mac the venv
# has all of that, so this works. In a bare environment it may not import — we keep
# the webhook + dashboard working either way.
_TOOLS_OK = False
_TOOLS_ERR = ""
try:
    import tools_api  # the real booking endpoints (check_availability / book_appointment / send_sms)
    # book_appointment() looks up _save_booking in the tools_api namespace at call
    # time, so this reassignment swaps the DB save for the local one.
    tools_api._save_booking = _demo_save
    _TOOLS_OK = True
except Exception as _e:  # pragma: no cover - only in a stripped environment
    _TOOLS_ERR = str(_e)

app = FastAPI(title="LumiDesk demo")
if _TOOLS_OK:
    app.include_router(tools_api.router)


# ── booking feed + status/delete ──────────────────────────────────────────
def _rewrite_bookings():
    """Persist the current _bookings list back to the jsonl file."""
    with BOOKINGS_FILE.open("w") as f:
        for b in _bookings:
            f.write(json.dumps(b, ensure_ascii=False) + "\n")


def _booking_set_status(bid, status):
    for b in _bookings:
        if b.get("id") == bid:
            b["status"] = "done" if status == "done" else "open"
            _rewrite_bookings()
            return True
    return False


def _booking_delete(bid):
    global _bookings
    before = len(_bookings)
    _bookings = [b for b in _bookings if b.get("id") != bid]
    if len(_bookings) != before:
        _rewrite_bookings()
        return True
    return False


@app.get("/demo/bookings.json")
def bookings_json():
    rows = list(reversed(_bookings))
    for b in rows:
        b.setdefault("status", "open")
    return JSONResponse(rows)


@app.post("/demo/bookings/{bid}/status")
async def set_booking_status(bid: str, request: Request):
    """Mark a booking done / open (body: {"status": "done"|"open"})."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    return {"ok": _booking_set_status(bid, (body or {}).get("status", "open"))}


@app.post("/demo/bookings/{bid}/delete")
def delete_booking_ep(bid: str):
    """Remove a booking from the bookings page."""
    return {"ok": _booking_delete(bid)}


# ── post-call webhook: Retell posts the finished call here ─────────────────
@app.post("/webhooks/retell")
async def retell_webhook(request: Request):
    """Receive Retell call events. We store call_ended / call_analyzed (which carry
    the transcript + summary); other events are acknowledged and ignored."""
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse({"received": False, "error": "bad json"}, status_code=400)
    try:
        rec = call_store.ingest_retell_event(payload)
    except Exception as e:  # never 500 back at Retell — just log and ack
        return JSONResponse({"received": True, "stored": False, "error": str(e)})
    return {"received": True, "stored": bool(rec), "event": payload.get("event")}


@app.get("/dashboard/calls.json")
def calls_json():
    return JSONResponse(call_store.feed())


@app.post("/dashboard/calls/{call_id}/status")
async def set_call_status(call_id: str, request: Request):
    """Mark a call resolved / open (body: {"status": "resolved"|"open"})."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    return {"ok": call_store.set_status(call_id, (body or {}).get("status", "open"))}


@app.post("/dashboard/calls/{call_id}/delete")
def delete_call_ep(call_id: str):
    """Remove a call from the dashboard (e.g. once the job is done)."""
    return {"ok": call_store.delete_call(call_id)}


@app.get("/health")
def health():
    return {"ok": True, "tools": _TOOLS_OK, "tools_error": _TOOLS_ERR}


@app.get("/assets/{name}")
def asset_file(name: str):
    """Serve the brand logo video / poster for the dashboard header."""
    p = Path(__file__).resolve().parent.parent / "assets" / name
    if "/" in name or ".." in name or not p.is_file():
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(str(p))


@app.get("/", response_class=HTMLResponse)
def root():
    return '<meta http-equiv="refresh" content="0; url=/dashboard">'


@app.get("/demo", response_class=HTMLResponse)
def demo_page():
    return _DEMO_HTML


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_page():
    return _DASHBOARD_HTML


# ── the live bookings page (kept as-is: booking pops in during the call) ───
_DEMO_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumiDesk — bookings</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
  :root{
    --ink:#12314C; --ink-2:#2B547A; --muted:#64788C; --muted-2:#9AAABB;
    --blue:#4A95F5; --blue-deep:#0B5CB6; --blue-soft:#A9CDFA; --blue-light:#EAF2FE; --blue-ink:#0B5CB6;
    --cream:#F6E6CC; --cream-2:#FBF0DC; --cream-tx:#B07C36;
    --ok:#2E9E6A; --ok-bg:#E6F5EC; --ok-line:#CDEBD9;
    --red:#D8603F; --red-bg:#FBEAE3; --red-line:#F3CFC2;
    --card:#FFFFFF; --line:#ECEEF2; --line-cool:#E4EBF3;
    --panel:#EFF5FE; --panel-line:#E1EAFB;
    --f:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --sh-card:0 18px 42px -26px rgba(16,58,110,.26), 0 2px 8px -3px rgba(16,58,110,.07);
    --sh-hover:0 36px 60px -30px rgba(11,92,182,.40), 0 12px 24px -14px rgba(16,58,110,.16);
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font-family:var(--f); color:var(--ink); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
       background:
         radial-gradient(1200px 680px at 86% -14%, rgba(74,149,245,.10) 0%, rgba(74,149,245,0) 54%),
         radial-gradient(900px 600px at 2% 120%, rgba(11,92,182,.05) 0%, rgba(11,92,182,0) 50%),
         #FFFFFF;
       min-height:100vh}
  ::selection{background:var(--blue-soft)}

  header{max-width:1140px; margin:0 auto; padding:30px 32px 8px; display:flex; align-items:center; gap:16px; flex-wrap:wrap}
  .logo{height:50px; width:auto; display:block; flex:none}
  .htag{align-self:center; color:var(--muted); font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
        padding-left:16px; margin-left:2px; border-left:1.5px solid var(--line)}
  .live{margin-left:auto; display:inline-flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; font-weight:700;
        background:rgba(255,255,255,.7); border:1px solid var(--line-cool); border-radius:999px; padding:7px 14px; backdrop-filter:blur(4px)}
  .ping{width:8px;height:8px;border-radius:50%;background:var(--ok); box-shadow:0 0 0 0 rgba(46,158,106,.5); animation:ping 1.9s infinite}
  @keyframes ping{0%{box-shadow:0 0 0 0 rgba(46,158,106,.45)}70%{box-shadow:0 0 0 7px rgba(46,158,106,0)}100%{box-shadow:0 0 0 0 rgba(46,158,106,0)}}

  .bar{max-width:1140px; margin:0 auto; padding:16px 32px 0; display:flex; align-items:center; gap:18px; flex-wrap:wrap}
  .nav{display:flex; gap:6px; background:rgba(255,255,255,.66); border:1px solid var(--line); border-radius:999px; padding:5px}
  .nav a{color:var(--muted); text-decoration:none; font-weight:700; font-size:13.5px; padding:8px 17px; border-radius:999px; transition:.16s}
  .nav a.on{color:#fff; background:linear-gradient(135deg,#4A95F5,#0B5CB6); box-shadow:0 10px 20px -11px rgba(11,92,182,.75)}
  .nav a:not(.on):hover{color:var(--ink)}
  .filters{margin-left:auto; display:flex; gap:8px; flex-wrap:wrap}
  .fbtn{border:1px solid var(--line); background:rgba(255,255,255,.7); color:var(--muted); font-weight:700; font-size:13px; font-family:var(--f);
        border-radius:999px; padding:8px 16px; cursor:pointer; transition:.15s}
  .fbtn:hover{border-color:var(--blue-soft); color:var(--ink)}
  .fbtn.on{background:var(--ink); color:#fff; border-color:transparent; box-shadow:0 10px 20px -12px rgba(20,49,63,.6)}
  .fbtn.on b{color:var(--blue-soft); font-weight:800}
  .fbtn b{color:var(--muted-2); font-weight:800; margin-left:3px}

  .wrap{max-width:1140px; margin:0 auto; padding:24px 32px 64px}
  .empty{margin-top:70px; text-align:center; color:var(--muted); font-size:16px; font-weight:600}

  .grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(336px,1fr)); gap:22px}
  .card{position:relative; background:linear-gradient(180deg,#fff,#FCFDFE); border-radius:24px; padding:22px; overflow:hidden;
        border:1px solid #E8EEF6; box-shadow:var(--sh-card);
        transition:transform .26s cubic-bezier(.2,.75,.2,1), box-shadow .26s, border-color .26s; animation:rise .5s cubic-bezier(.2,.7,.2,1) both;
        display:flex; flex-direction:column; gap:15px}
  .card:hover{transform:translateY(-7px); box-shadow:var(--sh-hover); border-color:#CDDFF7}
  .card.done{opacity:.64}
  @keyframes rise{from{opacity:0; transform:translateY(16px)} to{opacity:1; transform:none}}
  .top{display:flex; align-items:center; gap:13px}
  .avatar{width:46px;height:46px;border-radius:14px;flex:none; display:grid;place-items:center; color:#fff;
          background:linear-gradient(145deg,#5AA0F7,#0B5CB6); box-shadow:0 10px 20px -9px rgba(11,92,182,.7), inset 0 1px 0 rgba(255,255,255,.35)}
  .avatar svg{width:22px;height:22px}
  .who{min-width:0; flex:1}
  .svc{font-size:18px; font-weight:800; letter-spacing:-.015em; text-transform:capitalize; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
  .sub{color:var(--muted); font-size:12.5px; font-weight:600; margin-top:3px}
  .acts{display:flex; gap:7px; flex:none}
  .ic{width:32px;height:32px;border-radius:10px;border:1px solid var(--line); background:#fff; cursor:pointer;
      display:grid;place-items:center; color:var(--muted-2); transition:.15s}
  .ic svg{width:16px;height:16px}
  .ic:hover{transform:translateY(-1px)}
  .ic.res:hover{background:var(--ok-bg); border-color:var(--ok-line); color:var(--ok)}
  .ic.res.on{background:var(--ok-bg); border-color:var(--ok-line); color:var(--ok)}
  .ic.del:hover{background:var(--red-bg); border-color:var(--red-line); color:var(--red)}

  .pills{display:flex; gap:7px; flex-wrap:wrap}
  .pill{font-size:11px; font-weight:700; border-radius:999px; padding:5px 11px; letter-spacing:.05em; text-transform:uppercase; display:inline-flex; align-items:center; gap:5px}
  .pill svg{width:12px;height:12px}
  .pill.booked{background:var(--ok-bg); color:var(--ok)}
  .pill.done{background:var(--blue-light); color:var(--blue-ink)}

  .panel{background:var(--panel); border:1px solid var(--panel-line); border-radius:16px; padding:15px 16px}
  .when{display:flex; align-items:center; gap:10px; font-weight:800; font-size:15px; color:var(--ink)}
  .when .ci{width:28px;height:28px;border-radius:9px;flex:none;display:grid;place-items:center;background:var(--blue-light);color:var(--blue-deep)}
  .when .ci svg{width:16px;height:16px}
  .note{color:var(--muted); font-size:13px; margin-top:11px; padding-top:11px; border-top:1px solid var(--panel-line); font-weight:500}
  @media (max-width:520px){
    header{padding:22px 18px 6px} .bar{padding:14px 18px 0} .wrap{padding:20px 18px 48px}
    .htag{display:none} .grid{grid-template-columns:1fr; gap:16px}
  }
  @media (prefers-reduced-motion:reduce){*{animation:none!important; transition:none!important}}
</style>
</head>
<body>
  <header>
    <img class="logo" src="/assets/logo_white.png" alt="LumiDesk">
    <span class="htag">Bookings</span>
    <div class="live"><span class="ping"></span> Live</div>
  </header>
  <div class="bar">
    <nav class="nav"><a href="/dashboard">Calls</a><a href="/demo" class="on">Bookings</a></nav>
    <div class="filters" id="filters"></div>
  </div>
  <div class="wrap">
    <div id="grid" class="grid"><div class="empty">Waiting for the first booking&hellip;</div></div>
  </div>
<script>
  var CAL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  var WRENCH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/></svg>';
  var CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var REOPEN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6M3.5 8a9 9 0 1 0 2.2-3.4L3 8"/></svg>';
  var TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
  function esc(s){return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
  function fmtWhen(iso){try{return new Date(iso).toLocaleString('en-GB',{timeZone:'Europe/Helsinki',weekday:'long',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return iso||''}}

  var ROWS=[], FILTER='all';
  function counts(){var o=0,d=0;ROWS.forEach(function(b){b.status==='done'?d++:o++});return{all:ROWS.length,open:o,done:d}}
  function renderFilters(){
    var n=counts();
    var d=[['all','All',n.all],['open','Open',n.open],['done','Done',n.done]];
    document.getElementById('filters').innerHTML=d.map(function(x){
      return '<button class="fbtn '+(FILTER===x[0]?'on':'')+'" onclick="setFilter(&#39;'+x[0]+'&#39;)">'+x[1]+'<b>'+x[2]+'</b></button>';
    }).join('');
  }
  function setFilter(f){FILTER=f;renderFilters();renderGrid()}
  function visible(){
    if(FILTER==='open')return ROWS.filter(function(b){return b.status!=='done'});
    if(FILTER==='done')return ROWS.filter(function(b){return b.status==='done'});
    return ROWS;
  }
  function renderGrid(){
    var grid=document.getElementById('grid'), rows=visible();
    if(!rows.length){grid.innerHTML='<div class="empty">No bookings here yet&hellip;</div>';return}
    grid.innerHTML=rows.map(function(b,i){
      var done=b.status==='done';
      var tag=done?'<span class="pill done">'+CHECK+' Done</span>':'<span class="pill booked">'+CHECK+' Booked</span>';
      return '<div class="card '+(done?'done':'')+'" style="animation-delay:'+Math.min(i*55,400)+'ms">'
        +'<div class="top"><div class="avatar">'+WRENCH+'</div>'
        +'<div class="who"><div class="svc">'+esc(b.service||'Appointment')+'</div>'
        +'<div class="sub">'+esc(b.name||'Customer')+' · '+esc(b.phone||'')+'</div></div>'
        +'<div class="acts">'
        +'<button class="ic res '+(done?'on':'')+'" title="'+(done?'Mark not done':'Mark done')+'" onclick="toggleDone(event,&#39;'+b.id+'&#39;,'+(done?'false':'true')+')">'+(done?REOPEN:CHECK)+'</button>'
        +'<button class="ic del" title="Delete" onclick="delCard(event,&#39;'+b.id+'&#39;)">'+TRASH+'</button>'
        +'</div></div>'
        +'<div class="pills">'+tag+'</div>'
        +'<div class="panel"><div class="when"><span class="ci">'+CAL+'</span>'+fmtWhen(b.start)+'</div>'
        +(b.notes?'<div class="note">'+esc(b.notes)+'</div>':'')+'</div></div>';
    }).join('');
  }

  async function post(url,body){try{await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):null})}catch(e){}refresh()}
  function toggleDone(ev,id,to){ev.stopPropagation();post('/demo/bookings/'+id+'/status',{status:to?'done':'open'})}
  function delCard(ev,id){ev.stopPropagation();post('/demo/bookings/'+id+'/delete')}

  var last='';
  function refresh(){last='';tick()}
  async function tick(){
    try{
      var r=await fetch('/demo/bookings.json',{cache:'no-store'}); var t=await r.text(); if(t===last)return; last=t;
      ROWS=JSON.parse(t); renderFilters(); renderGrid();
    }catch(e){}
  }
  tick(); setInterval(tick,2000);
</script>
</body>
</html>
"""


# ── the call dashboard: full conversation + booking, the owner's screen ────
_DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LumiDesk — call dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
  :root{
    --ink:#12314C; --ink-2:#2B547A; --muted:#64788C; --muted-2:#9AAABB;
    --blue:#4A95F5; --blue-deep:#0B5CB6; --blue-soft:#A9CDFA; --blue-light:#EAF2FE; --blue-ink:#0B5CB6;
    --cream:#F6E6CC; --cream-2:#FBF0DC; --cream-tx:#B07C36;
    --ok:#2E9E6A; --ok-bg:#E6F5EC; --ok-line:#CDEBD9;
    --red:#D8603F; --red-bg:#FBEAE3; --red-line:#F3CFC2;
    --card:#FFFFFF; --line:#ECEEF2; --line-cool:#E4EBF3;
    --panel:#EFF5FE; --panel-line:#E1EAFB;
    --f:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --sh-card:0 18px 42px -26px rgba(16,58,110,.26), 0 2px 8px -3px rgba(16,58,110,.07);
    --sh-hover:0 36px 60px -30px rgba(11,92,182,.40), 0 12px 24px -14px rgba(16,58,110,.16);
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font-family:var(--f); color:var(--ink); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
       background:
         radial-gradient(1200px 680px at 86% -14%, rgba(74,149,245,.10) 0%, rgba(74,149,245,0) 54%),
         radial-gradient(900px 600px at 2% 120%, rgba(11,92,182,.05) 0%, rgba(11,92,182,0) 50%),
         #FFFFFF;
       min-height:100vh}
  ::selection{background:var(--blue-soft)}

  header{max-width:1140px; margin:0 auto; padding:30px 32px 8px; display:flex; align-items:center; gap:16px; flex-wrap:wrap}
  .logo{height:50px; width:auto; display:block; flex:none}
  .htag{align-self:center; color:var(--muted); font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
        padding-left:16px; margin-left:2px; border-left:1.5px solid var(--line)}
  .live{margin-left:auto; display:inline-flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; font-weight:700;
        background:rgba(255,255,255,.7); border:1px solid var(--line-cool); border-radius:999px; padding:7px 14px; backdrop-filter:blur(4px)}
  .ping{width:8px;height:8px;border-radius:50%;background:var(--ok); box-shadow:0 0 0 0 rgba(46,158,106,.5); animation:ping 1.9s infinite}
  @keyframes ping{0%{box-shadow:0 0 0 0 rgba(46,158,106,.45)}70%{box-shadow:0 0 0 7px rgba(46,158,106,0)}100%{box-shadow:0 0 0 0 rgba(46,158,106,0)}}

  .bar{max-width:1140px; margin:0 auto; padding:16px 32px 0; display:flex; align-items:center; gap:18px; flex-wrap:wrap}
  .nav{display:flex; gap:6px; background:rgba(255,255,255,.66); border:1px solid var(--line); border-radius:999px; padding:5px}
  .nav a{color:var(--muted); text-decoration:none; font-weight:700; font-size:13.5px; padding:8px 17px; border-radius:999px; transition:.16s}
  .nav a.on{color:#fff; background:linear-gradient(135deg,#4A95F5,#0B5CB6); box-shadow:0 10px 20px -11px rgba(11,92,182,.75)}
  .nav a:not(.on):hover{color:var(--ink)}
  .filters{margin-left:auto; display:flex; gap:8px; flex-wrap:wrap}
  .fbtn{border:1px solid var(--line); background:rgba(255,255,255,.7); color:var(--muted); font-weight:700; font-size:13px; font-family:var(--f);
        border-radius:999px; padding:8px 16px; cursor:pointer; transition:.15s}
  .fbtn:hover{border-color:var(--blue-soft); color:var(--ink)}
  .fbtn.on{background:var(--ink); color:#fff; border-color:transparent; box-shadow:0 10px 20px -12px rgba(20,49,63,.6)}
  .fbtn.on b{color:var(--blue-soft); font-weight:800}
  .fbtn b{color:var(--muted-2); font-weight:800; margin-left:3px}

  .wrap{max-width:1140px; margin:0 auto; padding:24px 32px 64px}
  .empty{margin-top:70px; text-align:center; color:var(--muted); font-size:16px; font-weight:600}

  .grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(336px,1fr)); gap:22px}
  .card{position:relative; background:linear-gradient(180deg,#fff,#FCFDFE); border-radius:24px; padding:22px 22px 18px; cursor:pointer;
        border:1px solid #E8EEF6; box-shadow:var(--sh-card);
        transition:transform .26s cubic-bezier(.2,.75,.2,1), box-shadow .26s, border-color .26s; animation:rise .5s cubic-bezier(.2,.7,.2,1) both;
        display:flex; flex-direction:column; gap:15px}
  .card:hover{transform:translateY(-7px); box-shadow:var(--sh-hover); border-color:#CDDFF7}
  .card.done{opacity:.66}
  @keyframes rise{from{opacity:0; transform:translateY(16px)} to{opacity:1; transform:none}}

  .chead{display:flex; align-items:center; gap:13px}
  .avatar{width:46px;height:46px;border-radius:14px;flex:none; display:grid;place-items:center; color:#fff;
          background:linear-gradient(145deg,#5AA0F7,#0B5CB6); box-shadow:0 10px 20px -9px rgba(11,92,182,.7), inset 0 1px 0 rgba(255,255,255,.35)}
  .avatar svg{width:22px;height:22px}
  .who{min-width:0; flex:1}
  .num{font-weight:800; font-size:16.5px; letter-spacing:-.02em; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
  .sub{color:var(--muted); font-size:12.5px; font-weight:600; margin-top:3px; text-transform:capitalize}
  .acts{display:flex; gap:7px; flex:none}
  .ic{width:32px;height:32px;border-radius:10px;border:1px solid var(--line); background:#fff; cursor:pointer;
      display:grid;place-items:center; color:var(--muted-2); transition:.15s}
  .ic svg{width:16px;height:16px}
  .ic:hover{transform:translateY(-1px)}
  .ic.res:hover{background:var(--ok-bg); border-color:var(--ok-line); color:var(--ok)}
  .ic.res.on{background:var(--ok-bg); border-color:var(--ok-line); color:var(--ok)}
  .ic.del:hover{background:var(--red-bg); border-color:var(--red-line); color:var(--red)}

  .pills{display:flex; gap:7px; flex-wrap:wrap}
  .pill{font-size:11px; font-weight:700; border-radius:999px; padding:5px 11px; letter-spacing:.05em; text-transform:uppercase}
  .pill.lang{background:var(--cream); color:var(--cream-tx)}
  .pill.dir{background:var(--cream-2); color:var(--cream-tx)}
  .pill.booked{background:var(--ok-bg); color:var(--ok)}
  .pill.res{background:#EFECE4; color:var(--muted)}

  .panel{background:var(--panel); border:1px solid var(--panel-line); border-radius:16px; padding:15px 16px}
  .sumlabel{font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; color:var(--blue-ink)}
  .sum{color:var(--ink-2); font-size:14px; line-height:1.52; margin-top:7px; font-weight:500;
       display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden}
  .bk{display:flex; align-items:center; gap:10px; background:var(--cream-2); border:1px solid #F2E6CF; border-radius:14px; padding:11px 14px}
  .bk .dot{width:26px;height:26px;border-radius:8px;flex:none;display:grid;place-items:center;background:var(--ok-bg);color:var(--ok)}
  .bk .dot svg{width:15px;height:15px}
  .bk .t{font-weight:700; color:var(--ink); font-size:13.5px; text-transform:capitalize}
  .bk .d{color:var(--muted); font-size:12px; margin-left:auto; text-align:right; font-weight:600}

  .cfoot{display:flex; align-items:center; gap:10px; margin-top:auto; padding-top:2px}
  .msgs{color:var(--muted); font-size:12.5px; font-weight:700; display:flex; align-items:center; gap:6px}
  .msgs svg{width:15px;height:15px}
  .view{margin-left:auto; border:0; cursor:pointer; font-family:var(--f); font-weight:700; font-size:13.5px; color:#fff;
        border-radius:999px; padding:10px 18px; display:flex; align-items:center; gap:7px;
        background:linear-gradient(135deg,#4A95F5,#0B5CB6); box-shadow:0 12px 22px -11px rgba(11,92,182,.8); transition:.16s}
  .view svg{width:15px;height:15px; transition:transform .18s}
  .view:hover{transform:translateY(-2px); box-shadow:0 16px 26px -12px rgba(11,92,182,.85)} .view:hover svg{transform:translateX(3px)}

  .ov{position:fixed; inset:0; background:rgba(16,44,62,.44); backdrop-filter:blur(4px); display:none;
      align-items:center; justify-content:center; padding:20px; z-index:50}
  .ov.show{display:flex}
  .modal{background:#fff; border-radius:26px; width:min(640px,100%); max-height:88vh; overflow:auto;
         box-shadow:0 44px 100px rgba(16,44,62,.42); animation:pop .26s cubic-bezier(.2,.7,.2,1)}
  @keyframes pop{from{opacity:0; transform:translateY(16px) scale(.98)} to{opacity:1; transform:none}}
  .mhead{position:sticky; top:0; background:#fff; padding:22px 26px 15px; border-bottom:1px solid var(--line); z-index:1}
  .mtop{display:flex; align-items:center; gap:12px; flex-wrap:wrap}
  .mtop .num{font-size:19px}
  .x{margin-left:auto; border:1px solid var(--line); background:#fff; color:var(--muted); width:35px;height:35px;
     border-radius:50%; font-size:17px; cursor:pointer; line-height:1}
  .x:hover{background:#F4F8FB; color:var(--ink)}
  .mtime{color:var(--muted); font-size:13px; margin-top:8px; text-transform:capitalize; font-weight:600}
  .msum{margin:16px 26px 0; background:var(--panel); border:1px solid var(--panel-line); border-radius:15px; padding:14px 16px;
        color:var(--ink-2); font-size:14px; line-height:1.56; font-weight:500}
  .msum b{color:var(--blue-ink); font-weight:800}
  .thread{padding:18px 26px 8px}
  .row{display:flex; margin:11px 0}
  .row.ai{justify-content:flex-start} .row.caller{justify-content:flex-end}
  .cell{display:flex; flex-direction:column; max-width:82%}
  .spk{font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--muted-2); margin:0 9px 4px}
  .row.caller .spk{text-align:right}
  .bub{padding:12px 16px; border-radius:18px; font-size:14.5px; line-height:1.46; font-weight:500}
  .ai .bub{background:#F1EEE6; color:var(--ink); border-bottom-left-radius:6px}
  .caller .bub{background:linear-gradient(145deg,#4A95F5,#0B5CB6); color:#fff; border-bottom-right-radius:6px;
               box-shadow:0 12px 22px -14px rgba(11,92,182,.75)}
  .mbk{margin:10px 26px 20px; background:var(--cream-2); border:1px solid #F2E6CF; border-left:5px solid var(--ok); border-radius:15px; padding:16px 18px}
  .mbk .t{font-weight:800; color:var(--ok); font-size:11px; letter-spacing:.09em; text-transform:uppercase; margin-bottom:6px; display:flex; align-items:center; gap:6px}
  .mbk .t svg{width:14px;height:14px}
  .mbk .svc{font-size:17px; font-weight:800; text-transform:capitalize; color:var(--ink)}
  .mbk .d{color:var(--muted); font-size:13.5px; margin-top:4px; font-weight:600}
  .mact{display:flex; gap:10px; padding:4px 26px 24px}
  .mbtn{border:0; border-radius:14px; padding:13px 16px; font-family:var(--f); font-weight:700; font-size:14px; cursor:pointer; transition:.15s}
  .mbtn:hover{transform:translateY(-1px)}
  .mbtn.res{background:var(--ok-bg); color:var(--ok); flex:1}
  .mbtn.reopen{background:#EEF2F6; color:var(--ink); flex:1}
  .mbtn.del{background:var(--red-bg); color:var(--red)}

  @media (max-width:520px){
    header{padding:22px 18px 6px} .bar{padding:14px 18px 0} .wrap{padding:20px 18px 48px}
    .htag{display:none} .grid{grid-template-columns:1fr; gap:16px}
  }
  @media (prefers-reduced-motion:reduce){*{animation:none!important; transition:none!important}}
</style>
</head>
<body>
  <header>
    <img class="logo" src="/assets/logo_white.png" alt="LumiDesk">
    <span class="htag">Call log</span>
    <div class="live"><span class="ping"></span> Live</div>
  </header>
  <div class="bar">
    <nav class="nav"><a href="/dashboard" class="on">Calls</a><a href="/demo">Bookings</a></nav>
    <div class="filters" id="filters"></div>
  </div>
  <div class="wrap">
    <div id="grid" class="grid"><div class="empty">Waiting for the first call&hellip;</div></div>
  </div>

  <div class="ov" id="ov"><div class="modal" id="modal"></div></div>

<script>
  var PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var REOPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6M3.5 8a9 9 0 1 0 2.2-3.4L3 8"/></svg>';
  var TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
  var CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  function esc(s){return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
  function fmtTime(iso){try{return new Date(iso).toLocaleString('en-GB',{timeZone:'Europe/Helsinki',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return iso||''}}
  function fmtDur(s){if(!s&&s!==0)return '';var m=Math.floor(s/60),r=s%60;return m?m+'m '+r+'s':r+'s'}
  function bookWhen(iso){try{return new Date(iso).toLocaleString('en-GB',{timeZone:'Europe/Helsinki',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}catch(e){return iso||''}}
  function pills(c){
    var out='';
    if(c.language&&c.language!=='—') out+='<span class="pill lang">'+esc(c.language)+'</span>';
    if(c.direction) out+='<span class="pill dir">'+esc(c.direction)+'</span>';
    if(c.booking) out+='<span class="pill booked">✓ Booked</span>';
    if(c.status==='resolved') out+='<span class="pill res">Resolved</span>';
    return out;
  }

  var CALLS=[], BYID={}, FILTER='all';
  function counts(){var o=0,r=0;CALLS.forEach(function(c){c.status==='resolved'?r++:o++});return{all:CALLS.length,open:o,resolved:r}}
  function renderFilters(){
    var n=counts();
    var d=[['all','All',n.all],['open','Open',n.open],['resolved','Resolved',n.resolved]];
    document.getElementById('filters').innerHTML=d.map(function(x){
      return '<button class="fbtn '+(FILTER===x[0]?'on':'')+'" onclick="setFilter(&#39;'+x[0]+'&#39;)">'+x[1]+'<b>'+x[2]+'</b></button>';
    }).join('');
  }
  function setFilter(f){FILTER=f;renderFilters();renderGrid()}
  function visible(){
    if(FILTER==='open')return CALLS.filter(function(c){return c.status!=='resolved'});
    if(FILTER==='resolved')return CALLS.filter(function(c){return c.status==='resolved'});
    return CALLS;
  }
  function renderGrid(){
    var grid=document.getElementById('grid'), rows=visible();
    if(!rows.length){grid.innerHTML='<div class="empty">No calls here yet&hellip;</div>';return}
    grid.innerHTML=rows.map(function(c,i){
      var done=c.status==='resolved';
      var dur=c.duration_sec!=null?' · '+fmtDur(c.duration_sec):'';
      var n=(c.turns||[]).length;
      var sumtxt = c.summary?esc(c.summary):((c.turns||[]).find(function(t){return t.text})||{}).text||'Tap to view the conversation';
      var bk = c.booking?('<div class="bk"><span class="dot">'+CAL+'</span><span class="t">'+esc(c.booking.service||'Appointment')+'</span><span class="d">'+esc(c.booking.name||'')+'<br>'+bookWhen(c.booking.start)+'</span></div>'):'';
      return '<div class="card '+(done?'done':'')+'" style="animation-delay:'+Math.min(i*55,400)+'ms" onclick="openCall(&#39;'+c.call_id+'&#39;)">'
        + '<div class="chead"><div class="avatar">'+PHONE+'</div>'
        +   '<div class="who"><div class="num">'+esc(c.from_number||'Caller')+'</div><div class="sub">'+esc(c.direction||'call')+dur+' · '+fmtTime(c.ended_at||c.started_at)+'</div></div>'
        +   '<div class="acts">'
        +     '<button class="ic res '+(done?'on':'')+'" title="'+(done?'Reopen':'Mark resolved')+'" onclick="toggleRes(event,&#39;'+c.call_id+'&#39;,'+(done?'false':'true')+')">'+(done?REOPEN:CHECK)+'</button>'
        +     '<button class="ic del" title="Delete" onclick="delCard(event,&#39;'+c.call_id+'&#39;)">'+TRASH+'</button>'
        +   '</div></div>'
        + '<div class="pills">'+pills(c)+'</div>'
        + '<div class="panel"><div class="sumlabel">Summary</div><div class="sum">'+esc(sumtxt)+'</div></div>'
        + bk
        + '<div class="cfoot"><span class="msgs">'+CHAT+' '+n+' messages</span>'
        +   '<button class="view" onclick="event.stopPropagation();openCall(&#39;'+c.call_id+'&#39;)">View '+CHEV+'</button></div>'
        + '</div>';
    }).join('');
  }

  function threadHTML(c){
    return (c.turns||[]).map(function(t){
      var who=t.speaker==='AI'?'ai':'caller', label=t.speaker==='AI'?'LumiDesk':'Caller';
      return '<div class="row '+who+'"><div class="cell"><div class="spk">'+label+'</div><div class="bub">'+esc(t.text)+'</div></div></div>';
    }).join('')||'<div class="msum">No transcript on this call.</div>';
  }
  function openCall(id){
    var c=BYID[id]; if(!c)return;
    var dur=c.duration_sec!=null?' · '+fmtDur(c.duration_sec):'';
    var mbk=c.booking?('<div class="mbk"><div class="t">'+CHECK+' Booked</div><div class="svc">'+esc(c.booking.service||'Appointment')+'</div><div class="d">'+esc(c.booking.name||'Customer')+' · '+esc(c.booking.phone||'')+'</div><div class="d">'+bookWhen(c.booking.start)+'</div></div>'):'';
    var act=(c.status==='resolved'
        ?'<button class="mbtn reopen" onclick="setStatus(&#39;'+id+'&#39;,&#39;open&#39;)">Reopen</button>'
        :'<button class="mbtn res" onclick="setStatus(&#39;'+id+'&#39;,&#39;resolved&#39;)">✓ Mark resolved</button>')
        +'<button class="mbtn del" onclick="del(&#39;'+id+'&#39;)">Delete</button>';
    document.getElementById('modal').innerHTML=
        '<div class="mhead"><div class="mtop"><div class="avatar">'+PHONE+'</div><div class="num">'+esc(c.from_number||'Caller')+'</div>'+pills(c)
      + '<button class="x" onclick="closeCall()">&times;</button></div><div class="mtime">'+esc(c.direction||'call')+dur+' · '+fmtTime(c.ended_at||c.started_at)+'</div></div>'
      + (c.summary?'<div class="msum"><b>Summary</b> — '+esc(c.summary)+'</div>':'')
      + '<div class="thread">'+threadHTML(c)+'</div>'+mbk+'<div class="mact">'+act+'</div>';
    document.getElementById('ov').classList.add('show');
  }
  function closeCall(){document.getElementById('ov').classList.remove('show')}
  document.getElementById('ov').addEventListener('click',function(e){if(e.target.id==='ov')closeCall()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeCall()});

  async function post(url,body){try{await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):null})}catch(e){}refresh()}
  function toggleRes(ev,id,to){ev.stopPropagation();post('/dashboard/calls/'+id+'/status',{status:to?'resolved':'open'})}
  function delCard(ev,id){ev.stopPropagation();post('/dashboard/calls/'+id+'/delete')}
  function setStatus(id,s){closeCall();post('/dashboard/calls/'+id+'/status',{status:s})}
  function del(id){closeCall();post('/dashboard/calls/'+id+'/delete')}

  var last='';
  function apply(calls){CALLS=calls;BYID={};calls.forEach(function(c){BYID[c.call_id]=c});renderFilters();renderGrid()}
  function refresh(){last='';tick()}
  async function tick(){
    try{var r=await fetch('/dashboard/calls.json',{cache:'no-store'});var t=await r.text();if(t===last)return;last=t;apply(JSON.parse(t))}catch(e){}
  }
  tick(); setInterval(tick,2000);
</script>
</body>
</html>
"""
