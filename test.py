from elevenlabs import generate, play, set_api_key
from elevenlabs import set_api_key, voices


set_api_key("sk_3efc7c5f3f334bd4e0b57e427cddaeb7689b4ffbb8819e65") 
 # Replace with your ElevenLabs key
for v in voices():
    print(f"{v.name} — {v.labels}")
available_voices = voices()
for voice in available_voices:
    print(f"{voice.name} — {voice.voice_id}")

audio = generate(
    text="Hello there! Welcome to your AI voice assistant.",
    voice="Sarah",
    model="eleven_monolingual_v1"
)

play(audio)

"""Aria — 9BWtsMINqrJLrRacOk9x
Sarah — EXAVITQu4vr4xnSDxMaL
Laura — FGY2WhTYpPnrIDTdsKH5
Charlie — IKne3meq5aSn9XLyUdCD
George — JBFqnCBsd6RMkjVDRZzb
Callum — N2lVS1w4EtoT3dr4eOWO
River — SAz9YHcvj6GT2YYXdXww
Liam — TX3LPaxmHKxFdv7VOQHJ
Charlotte — XB0fDUnXU5powFXDhCwa
Alice — Xb7hH8MSUJpSbSDYk0k2
Matilda — XrExE9yKIg1WjnnlVkGX
Will — bIHbv24MWmeRgasZH58o
Jessica — cgSgspJ2msm6clMCkdW9
Eric — cjVigY5qzO86Huf0OWal
Chris — iP95p4xoKVk53GoZ742B
Brian — nPczCjzI2devNBz1zQrb
Daniel — onwK4e9ZLuTAKqWW03F9
Lily — pFZP5JQG7iQjIQuC4Bku
Bill — pqHfZKP75CvOlQylNhV4"""