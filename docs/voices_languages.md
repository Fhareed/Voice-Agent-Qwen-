# Languages & Voices for LumiDesk (Retell AI)

How LumiDesk should let a business pick a **language** (English, Arabic, Finnish to
start) and then a **voice** for that language, and how `provision_org()` should turn
those choices into the correct Retell agent settings.

> **The one rule that caused the last bug:** never ship a hand-typed `voice_id`.
> Voice IDs are account/provider-specific. The only trustworthy source of a real
> `voice_id` is **your own Retell account** — `GET /list-voices` or the dashboard
> voice library. Everything below marked *"confirm real ID in dashboard"* must be
> resolved to a real ID before it goes into code or the DB.

---

## 1. Languages Retell supports (and the exact codes)

Retell supports the three launch languages for **both** speech-to-text (understanding
the caller / ASR) and text-to-speech (the agent's voice / TTS). The code below is the
exact string that goes in the agent's `language` field.

| Language | Retell `language` code | STT (caller) | TTS (voice) |
|---|---|---|---|
| English (US) | `en-US` | ✅ | ✅ |
| **Arabic** | `ar-SA` | ✅ | ✅ |
| **Finnish** | `fi-FI` | ✅ | ✅ |

Source: Retell's language-support page lists the codes as "the values accepted by the
API `language` field," and every language in its TTS table also appears in its ASR
table — so all three have both directions.
([docs.retellai.com/build/language-support](https://docs.retellai.com/build/language-support))

Other English variants exist if ever needed: `en-GB`, `en-AU`, `en-NZ`, `en-IN`.

### Important caveats confirmed from Retell

- **Arabic is effectively Saudi/MSA.** The `ar-SA` code is the Arabic option. A
  Retell community thread shows that even a custom ElevenLabs voice trained on a
  Lebanese speaker still spoke **Saudi** Arabic after deployment — Lebanese/Levantine
  accent was only a feature request as of early 2026. For LumiDesk launch, treat
  Arabic = Modern Standard / Saudi Arabic.
  ([community thread](https://community.retellai.com/t/arabic-language-voice-agent-the-client-base-is-mainly-in-the-levant-region-so-i-need-support-for-lebanese-accent/1452))
- **Finnish ASR provider matters.** Retell's own earlier setup notes (see
  `archive/RETELL_SETUP.md`) chose **Soniox** for Finnish speech-in (Deepgram was weak
  at Finnish) and ElevenLabs for the Finnish voice. Retell picks the ASR provider
  automatically from the language, but if Finnish recognition is poor, check which ASR
  provider the agent is using in the dashboard.
- **Multilingual / code-switching:** there is **no `multi` language code**. A single
  agent speaks one `language`. If a caller may switch languages mid-call, Retell
  relies on ASR providers that support any-to-any code-switching (Deepgram, Soniox,
  AssemblyAI); Azure is single-language. For LumiDesk's "also answer in X" note this
  is a soft prompt instruction, not a second language code.
  ([docs.retellai.com/build/language-support](https://docs.retellai.com/build/language-support))

---

## 2. How to get REAL voice IDs (do this before shipping any voice)

Voice IDs are specific to your Retell account and the voice provider. There are two
equivalent ways to pull the real ones.

### A. The `GET /list-voices` API (authoritative, scriptable)

- **Endpoint:** `GET https://api.retellai.com/list-voices`
- **Auth header:** `Authorization: Bearer <RETELL_API_KEY>` (same key the code already
  reads in `retell_provision._key()`)
- **Returns:** a JSON array of voice objects. Each has:
  `voice_id` (e.g. `"retell-Cimo"`), `voice_name` (e.g. `"Adrian"`), `provider`,
  `gender` (`male`/`female`), and optionally `accent`, `age`, `avatar_url`,
  `preview_audio_url`.
- **Providers in the `provider` enum:** `elevenlabs`, `openai`, `cartesia`, `minimax`,
  `fish_audio`, `inworld`, `platform`, `xai` (xai only with the grok speech-to-speech
  model). PlayHT is **not** in the current spec.

Source: [docs.retellai.com/api-references/list-voices](https://docs.retellai.com/api-references/list-voices)

The `voice_id` is namespaced by provider, e.g. `retell-Cimo`, `cartesia-Grace`,
`11labs-<Name>`, `openai-<Name>`. The existing default `cartesia-Grace` follows this
exact convention — that is why it is real and works.

Quick pull (one-off helper, run with your key):

```bash
curl -s https://api.retellai.com/list-voices \
  -H "Authorization: Bearer $RETELL_API_KEY" \
| python3 -c 'import sys,json; [print(f"{v[\"voice_id\"]:<28} {v[\"voice_name\"]:<22} {v.get(\"provider\",\"\"):<12} {v.get(\"accent\",\"\")} {v.get(\"gender\",\"\")}") for v in json.load(sys.stdin)]'
```

Filter that output by `accent`/`provider` to find English, Arabic, and Finnish voices,
then copy the exact `voice_id` strings.

### B. The Retell dashboard voice library (click-to-copy)

1. Log in at [retellai.com](https://retellai.com) → open an agent (or **Create Agent**).
2. In the agent config, open the **Voice** picker — this is the voice library. You can
   filter/search and preview each voice.
3. Pick a voice; the exact `voice_id` is shown there and is what the agent stores. You
   can copy it from the agent's voice field.

### C. Importing / finding provider voices (e.g. ElevenLabs)

If a desired voice isn't already in Retell's library, you can import a custom provider
voice (Retell supports importing custom ElevenLabs voices). To get an ElevenLabs
voice's own ID: ElevenLabs app → **My Voices** → **More actions (⋯)** →
**Copy voice ID**; or via ElevenLabs' List Voices API.
([ElevenLabs help](https://elevenlabs.io/docs/help-center/technical/how-do-i-find-the-voice-id-of-my-voices-via-the-website-and-api))
After importing, re-run `GET /list-voices` to get the **Retell** `voice_id` for it —
that Retell ID, not the raw ElevenLabs ID, is what `voice_id` on the agent needs.

---

## 3. Candidate voices per language (NAMES ONLY — confirm real ID in dashboard)

These are real voice **names** known to exist on Retell's providers. **Do not type any
of these as an ID.** Pick 2–3 per language, find each one in your `GET /list-voices`
output or the dashboard, and copy its real `voice_id`.

### English (`en-US`)
- **Grace** — Cartesia, female, warm. *(already the working default `cartesia-Grace`)*
- **Cimo / Adrian** — Retell platform voices shown in Retell's own API docs example.
- Any Cartesia / ElevenLabs / OpenAI English voice with `accent: American` (or British)
  from your `list-voices` output.
- *Confirm real ID in dashboard for each.*

### Arabic (`ar-SA`) — Modern Standard / Saudi
ElevenLabs Arabic voices (import into Retell, then read the Retell `voice_id`):
- **Abdullah** (male, Modern Standard) — also "Abdullah – Saudi Arabic Narrator".
- **Adeeb** (male, Saudi — "Clear, Confident and Natural").
- **Abrar Sabbah** (female, Modern Standard — "Attractive and Smooth").
- *Source for names: ElevenLabs Arabic voice catalog ([famulor.io/voices/elevenlabs/languages/ar](https://www.famulor.io/voices/elevenlabs/languages/ar)). Confirm real ID in dashboard.*

### Finnish (`fi-FI`)
ElevenLabs Finnish voices (import into Retell, then read the Retell `voice_id`):
- **Lumi** (female), **Aurora** (female), **Kaisa** (female).
- **Aapo** (male), **Jaakko** (male), **Matias** (male).
- *Source for names: ElevenLabs Finnish voice catalog ([famulor.io/voices/elevenlabs/languages/fi](https://www.famulor.io/voices/elevenlabs/languages/fi)). Confirm real ID in dashboard.*

> Note: the famulor pages mirror the ElevenLabs voice library, so these names exist as
> ElevenLabs voices. Whether a given name is already in **your** Retell account depends
> on your account — add/import it if missing, then `list-voices` gives you the Retell
> `voice_id`.

---

## 4. Recommended implementation

### 4.1 Data model (per org, in `settings_store`)

Store the **language** and the **real resolved `voice_id`** on the org settings blob.
Do **not** store an abstract voice label (like the current `"Warm · female"`) and then
map it to an ID at provision time with a hardcoded table — that mapping table
(`VOICE_IDS`) is exactly where the guessed IDs crept in.

Settings keys:

| key | example | meaning |
|---|---|---|
| `default_language` | `"Finnish"` | the picked language (human label; existing key) |
| `voice_id` | `"11labs-Lumi"` | **real** Retell voice_id for the picked voice |
| `voice_label` | `"Lumi · female"` | optional, for display only |
| `languages_note` | `"also answer in Swedish"` | existing soft prompt hint |

`retell_voice_id` is already written back by `provision_org()` after creation — keep
that, but the **source of truth the user picks** should itself be a real `voice_id`.

### 4.2 Language → voice picker (onboarding + settings)

1. User picks a **language** from a fixed list: English, Arabic, Finnish
   (`OnboardingView.tsx` and `SettingsView.tsx` already have the language `<select>`).
2. The voice `<select>` is **filtered by the chosen language** — show the 2–3
   curated options for that language. Today `SettingsView.tsx` has a single flat
   `VOICES = ["Warm · female", …]` list that ignores language; replace it with a
   per-language map, where each option's **value is the real `voice_id`** and its
   label is the friendly name:

   ```ts
   const VOICES_BY_LANG: Record<string, {id: string; label: string}[]> = {
     English: [
       { id: "cartesia-Grace", label: "Grace · warm female" },
       // add 1–2 more real ids from GET /list-voices
     ],
     Arabic:  [ /* { id: "11labs-…", label: "Abdullah · male (MSA)" }, confirm real ids */ ],
     Finnish: [ /* { id: "11labs-…", label: "Lumi · female" }, confirm real ids */ ],
   };
   ```
   When language changes, reset the voice to that language's first option so you never
   save an English voice under Finnish.
3. Save `{ default_language, voice_id, voice_label }` via `settings_store.save_settings`.

   To keep this curated list honest, source it from a small checked-in file (or an
   admin endpoint that calls `GET /list-voices`) rather than hand-typing — so every id
   in it provably exists in the account.

### 4.3 What `provision_org()` must set on the Retell agent

Two fields on the agent body, both derived from the saved org settings:

- `language`: the Retell code for the picked language.
  - **Fix the current bug:** `_LANG_CODES` in `retell_provision.py` has **no Arabic
    entry**, so an Arabic org silently falls through to `en-US`. Add it:
    ```python
    _LANG_CODES = {
        "english": "en-US",
        "arabic":  "ar-SA",   # <-- add
        "finnish": "fi-FI",
        "swedish": "sv-SE",
        "german":  "de-DE",
    }
    ```
- `voice_id`: the **real** id picked by the user.
  - Prefer reading `settings["voice_id"]` directly (resolution order:
    explicit `voice_id` arg → `settings["voice_id"]` → `RETELL_DEFAULT_VOICE_ID` →
    `"cartesia-Grace"`).
  - **Retire the `VOICE_IDS` label→id table**, or keep it only as a legacy fallback
    for orgs that still have the old `"Warm · female"` label saved. The guessed entries
    (`cartesia-Sophie`, `cartesia-Oliver`, `cartesia-Marcus`) must be removed or
    replaced with ids verified via `GET /list-voices`. `cartesia-Grace` is the only one
    confirmed real by convention.

Sketch of the changed resolution in `provision_org()`:

```python
voice = (voice_id
         or _s(settings, "voice_id")                      # real id saved by picker
         or VOICE_IDS.get(_s(settings, "voice"))          # legacy label fallback
         or os.getenv("RETELL_DEFAULT_VOICE_ID")
         or "cartesia-Grace")
lang = _s(settings or {}, "default_language", "English")
lang_code = _LANG_CODES.get(lang.lower(), "en-US")
```

The agent body already sets `"language": lang_code` and `"voice_id": voice` — those two
lines are correct; the fix is purely in **where the values come from** (real ids +
Arabic code).

### 4.4 Validation / safety net

- Before `create-agent`, optionally call `GET /list-voices` once and assert the chosen
  `voice_id` is in the returned set; if not, fail loudly (raise `ProvisionError`)
  instead of shipping a bad id. This structurally prevents the guessed-ID class of bug.
- Keep `RETELL_DEFAULT_VOICE_ID` as the last-resort fallback and keep it a real id.

---

## Sources

- Retell language support & codes: https://docs.retellai.com/build/language-support
- Retell list-voices API: https://docs.retellai.com/api-references/list-voices
- Retell Arabic accent thread: https://community.retellai.com/t/arabic-language-voice-agent-the-client-base-is-mainly-in-the-levant-region-so-i-need-support-for-lebanese-accent/1452
- ElevenLabs find voice ID: https://elevenlabs.io/docs/help-center/technical/how-do-i-find-the-voice-id-of-my-voices-via-the-website-and-api
- ElevenLabs Arabic voice names: https://www.famulor.io/voices/elevenlabs/languages/ar
- ElevenLabs Finnish voice names: https://www.famulor.io/voices/elevenlabs/languages/fi
- Internal: `archive/RETELL_SETUP.md` (Finnish = Soniox ASR + ElevenLabs TTS decision)
