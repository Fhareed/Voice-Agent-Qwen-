import speech_recognition as sr
from langchain_ollama import OllamaLLM
from elevenlabs import generate, play, set_api_key
from langchain.chains import RetrievalQA
from rag_retriever import load_retriever
import sys
import os


os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Set your ElevenLabs API key
set_api_key("sk_3efc7c5f3f334bd4e0b57e427cddaeb7689b4ffbb8819e65")

# Config
ELEVENLABS_VOICE = "Charlotte"
ELEVENLABS_MODEL = "eleven_multilingual_v2"
llm = OllamaLLM(model="qwen:7b")
retriever = load_retriever()
qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever.as_retriever())

# Language mapping for speech recognition
lang_map = {
    "english": "en-US",
    "finnish": "fi-FI",
    "swedish": "sv-SE"
}

# Speak function
def speak(text):
    try:
        audio = generate(
            text=text,
            voice=ELEVENLABS_VOICE,
            model=ELEVENLABS_MODEL
        )
        play(audio)
    except Exception as e:
        print(f"❌ ElevenLabs Error: {e}")
        sys.exit(1)

# Listen function
def listen(language_code="en-US"):
    r = sr.Recognizer()
    with sr.Microphone() as source:
        r.adjust_for_ambient_noise(source, duration=1)
        print("🎤 Listening...")
        audio = r.listen(source)

    try:
        text = r.recognize_google(audio, language=language_code)
        print(f"🗣️ You said: {text}")
        return text
    except sr.UnknownValueError:
        return "Sorry, I couldn't understand that."
    except sr.RequestError:
        return "Speech recognition is not available."

# Language prompt
def ask_for_language():
    speak("Hello! My name is Charlotte. What language would you like me to speak? For example, English, Finnish or Swedish.")
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

# Main logic
selected_lang = ask_for_language()
language_code = lang_map.get(selected_lang, "en-US")
print(f"✅ Language selected: {selected_lang.capitalize()} ({language_code})")
speak(f"Okay, I will speak in {selected_lang} from now on.")

# Main loop
while True:
    user_input = listen(language_code)

    if "exit" in user_input.lower():
        speak("Goodbye!")
        break

    if "couldn't understand" in user_input or "not available" in user_input:
        speak(user_input)
        continue

    # Retrieval-augmented generation
    response = qa_chain.invoke({"query": user_input})
    print(f"🤖 Response: {response['result']}")
    speak(response["result"])
