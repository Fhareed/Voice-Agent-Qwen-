import os
import sys

import speech_recognition as sr
from dotenv import load_dotenv
from elevenlabs import ElevenLabs, play
from langchain_ollama import OllamaLLM

from rag_chain import build_qa_chain
from rag_retriever import load_retriever

# Load variables from a local .env file (if present) into the environment.
load_dotenv()

# Safety/perf
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# ---- Config ----
ELEVENLABS_VOICE = "Charlotte"
ELEVENLABS_MODEL = "eleven_multilingual_v2"

# Get API key from env (rotate your leaked key in the dashboard, then export it)
ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY")
if not ELEVEN_API_KEY:
    print("❌ ELEVEN_API_KEY not set. Run: export ELEVEN_API_KEY=your_key_here")
    sys.exit(1)

# Initialize clients
tts_client = ElevenLabs(api_key=ELEVEN_API_KEY)

def _get_all_voices():
    """Return a list of voice objects across SDK variants."""
    # Newer SDKs
    try:
        resp = tts_client.voices.get_all()
        return resp.voices
    except AttributeError:
        pass
    # Some variants expose .list()
    try:
        resp = tts_client.voices.list()
        return resp.voices
    except AttributeError:
        pass
    # Last-ditch: sometimes .voices is already a list-like
    v = getattr(tts_client, "voices", None)
    if isinstance(v, (list, tuple)):
        return list(v)
    raise RuntimeError("Unable to list ElevenLabs voices with this SDK version.")

def list_available_voices():
    voices = _get_all_voices()
    print("🔊 Available voices:")
    for v in voices:
        # voice objects usually have .voice_id and .name
        vid = getattr(v, "voice_id", None) or getattr(v, "id", None)
        name = getattr(v, "name", None)
        print(f"- name: {name} | voice_id: {vid}")
    return voices

def resolve_voice_id(desired_name_or_id: str) -> str:
    voices = _get_all_voices()
    # direct id match
    for v in voices:
        vid = getattr(v, "voice_id", None) or getattr(v, "id", None)
        if vid and vid == desired_name_or_id:
            return vid
    # name (case-insensitive)
    for v in voices:
        name = getattr(v, "name", None)
        vid = getattr(v, "voice_id", None) or getattr(v, "id", None)
        if name and name.lower() == desired_name_or_id.lower():
            return vid
    # fallback to first
    if voices:
        fallback = getattr(voices[0], "voice_id", None) or getattr(voices[0], "id", None)
        print(f"⚠️ Voice '{desired_name_or_id}' not found. Falling back to: {fallback}")
        return fallback
    raise RuntimeError("No ElevenLabs voices available in this account.")

list_available_voices()  # one-time: prints what's available
VOICE_ID = "hpp4J3VqNfWAUOO0d1Us"  # Bella (works on the free plan)
MODEL_ID = "eleven_multilingual_v2"
# If your Ollama is not on default localhost:11434, add base_url="http://host:11434"
llm = OllamaLLM(model="qwen:7b")

# RAG retriever / chain
retriever = load_retriever()
qa_chain = build_qa_chain(llm, retriever.as_retriever())

# Language mapping for speech recognition
lang_map = {"english": "en-US", "finnish": "fi-FI", "swedish": "sv-SE"}

def speak(text: str):
    try:
        audio = tts_client.text_to_speech.convert(
            voice_id=VOICE_ID,           # <-- ID, not "Charlotte"
            model_id=MODEL_ID,
            text=text,
            output_format="mp3_44100_128",
        )
        play(audio)
    except Exception as e:
        print(f"❌ ElevenLabs Error: {e}")
        sys.exit(1)

def listen(language_code="en-US"):
    r = sr.Recognizer()
    try:
        with sr.Microphone() as source:
            r.adjust_for_ambient_noise(source, duration=1)
            print("🎤 Listening...")
            audio = r.listen(source)
        text = r.recognize_google(audio, language=language_code)
        print(f"🗣️ You said: {text}")
        return text
    except sr.UnknownValueError:
        return "Sorry, I couldn't understand that."
    except sr.RequestError:
        return "Speech recognition is not available."
    except OSError as e:
        # Often raised if PyAudio/PortAudio is missing or no mic
        print(f"🎙️ Microphone error: {e}")
        print("Tip (macOS): brew install portaudio && pip install pyaudio")
        sys.exit(1)

def ask_for_language():
    speak(
        "Hello! My name is Charlotte. What language would you like me to speak? "
        "For example, English, Finnish or Swedish."
    )
    lang_input = listen().lower()
    if "finnish" in lang_input or "suomi" in lang_input:
        return "finnish"
    elif "swedish" in lang_input or "ruotsi" in lang_input:
        return "swedish"
    elif "english" in lang_input:
        return "english"
    else:
        speak("Sorry, I did not understand. I will default to English.")
        return "english"

if __name__ == "__main__":
    selected_lang = ask_for_language()
    language_code = lang_map.get(selected_lang, "en-US")
    print(f"✅ Language selected: {selected_lang.capitalize()} ({language_code})")
    speak(f"Okay, I will speak in {selected_lang} from now on.")

    while True:
        user_input = listen(language_code)

        if "exit" in user_input.lower():
            speak("Goodbye!")
            break

        if "couldn't understand" in user_input or "not available" in user_input:
            speak(user_input)
            continue

        try:
            answer = qa_chain.invoke(user_input)
        except Exception as e:
            answer = f"Sorry, I hit an error with retrieval: {e}"
            print(f"❌ RAG error: {e}")

        print(f"🤖 Response: {answer}")
        speak(answer)