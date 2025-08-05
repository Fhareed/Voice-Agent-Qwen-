from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse
import speech_recognition as sr
from langchain_ollama import OllamaLLM
from elevenlabs import generate, set_api_key
from langchain.chains import RetrievalQA
from rag_retriever import load_retriever
import io
import os

app = FastAPI()

os.environ["TOKENIZERS_PARALLELISM"] = "false"
set_api_key("sk_3efc7c5f3f334bd4e0b57e427cddaeb7689b4ffbb8819e65")

ELEVENLABS_VOICE = "Charlotte"
ELEVENLABS_MODEL = "eleven_multilingual_v2"
llm = OllamaLLM(model="qwen:7b")
retriever = load_retriever()
qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever.as_retriever())

lang_map = {
    "english": "en-US",
    "finnish": "fi-FI",
    "swedish": "sv-SE"
}

def transcribe_audio(audio_bytes, language_code="en-US"):
    r = sr.Recognizer()
    with sr.AudioFile(io.BytesIO(audio_bytes)) as source:
        audio = r.record(source)
    try:
        text = r.recognize_google(audio, language=language_code)
        return text
    except sr.UnknownValueError:
        return None
    except sr.RequestError:
        return None

def synthesize_speech(text, voice=ELEVENLABS_VOICE, model=ELEVENLABS_MODEL):
    try:
        audio = generate(
            text=text,
            voice=voice,
            model=model
        )
        return audio
    except Exception as e:
        print(f"❌ ElevenLabs Error: {e}")
        return None

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    with open("frontend.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/ask")
async def ask(
    audio: UploadFile = File(...),
    language: str = Form("english")
):
    language_code = lang_map.get(language.lower(), "en-US")
    audio_bytes = await audio.read()
    user_text = transcribe_audio(audio_bytes, language_code)
    if not user_text:
        return JSONResponse({"error": "Could not transcribe audio."}, status_code=400)
    response = qa_chain.invoke({"query": user_text})
    answer = response["result"]
    audio_response = synthesize_speech(answer)
    if not audio_response:
        return JSONResponse({"error": "Could not synthesize speech."}, status_code=500)
    return StreamingResponse(io.BytesIO(audio_response), media_type="audio/mpeg") 