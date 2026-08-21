import io
import os
import time

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

from providers import get_llm_provider, get_stt, get_tts, get_vector_store
from rag_chain import build_qa_chain

# Load variables from a local .env file (if present) into the environment.
load_dotenv()
os.environ["TOKENIZERS_PARALLELISM"] = "false"

app = FastAPI()

# Wire up the capabilities through the provider layer.
# To swap any vendor, edit providers/__init__.py -- not this file.
stt = get_stt()
tts = get_tts()
llm = get_llm_provider().get_llm()
retriever = get_vector_store().get_retriever()
qa_chain = build_qa_chain(llm, retriever)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("frontend.html", "r", encoding="utf-8") as f:
        return f.read()


@app.post("/ask")
async def ask(audio: UploadFile = File(...), language: str = Form("english")):
    t0 = time.perf_counter()
    audio_bytes = await audio.read()

    user_text = stt.transcribe(audio_bytes, language)
    t_stt = time.perf_counter()
    if not user_text:
        return JSONResponse({"error": "Could not transcribe audio."}, status_code=400)

    answer = qa_chain.invoke(user_text)
    t_llm = time.perf_counter()

    try:
        audio_response = tts.synthesize(answer)
    except Exception as e:
        print(f"❌ TTS error: {e}")
        return JSONResponse({"error": "Could not synthesize speech."}, status_code=500)
    t_tts = time.perf_counter()

    # Latency breakdown — shows which stage is the bottleneck, printed per request.
    print(
        f"⏱  transcribe {t_stt - t0:5.2f}s | retrieve+think {t_llm - t_stt:5.2f}s | "
        f"speak {t_tts - t_llm:5.2f}s | TOTAL {t_tts - t0:5.2f}s  |  you said: {user_text!r}"
    )

    return StreamingResponse(io.BytesIO(audio_response), media_type="audio/mpeg")
