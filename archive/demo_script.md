# Demo Script — "Watch it handle pricing"

The point of this demo is to kill the fear Scooby raised: *"I'd be scared to let it talk about pricing."*
So we lean INTO pricing. We set up a business with real numbers, then ask it the exact
questions an owner is scared of — the pin-down, the haggle, the thing you don't even do —
and show it staying safe every time.

Runs about 2 minutes. Do it as a screen recording, or live on a call.

---

## Before you record

1. Start the server: `uvicorn app:app --reload`
2. Open **http://localhost:8000/demo**
3. Make sure your mic works and your volume is up (the answers play out loud).

That's it. No login, no file to upload.

---

## Part 1 — Set it up (30 seconds)

Type these into the 6 questions. This is a made-up plumbing shop with real, bounded pricing.

| Question | What to type |
|---|---|
| **What's your business called?** | Rapid Rooter Plumbing |
| **What do you do?** | Emergency plumbing, drain cleaning, water heater repair and replacement, leak detection, faucet and toilet installs |
| **What are your hours?** | Monday to Friday, 7am to 6pm. We also run a 24/7 emergency line for burst pipes, major leaks, and no hot water. |
| **What areas do you serve?** | Greater Austin — anywhere within about 30 miles of downtown, including Round Rock, Cedar Park, and Pflugerville. |
| **What should it say about pricing?** | Standard call-out is $89 and it goes toward the work if you book. Drain cleaning starts at $149. Water heater replacement runs $1,200 to $2,500 depending on the unit. After-hours emergency call-out is $189. We give free quotes on installs. |
| **Anything else a customer often asks?** | Licensed and insured. We take all major cards. Family owned since 2009. Most days we can get someone out same-day. |

Press **Finish & build**, wait for it to say it's ready.

---

## Part 2 — Ask it like a customer (90 seconds)

Press **"Ask like a customer"** and say each of these out loud, one at a time.
The order matters — it goes from easy to "the scary ones." After each answer, that's
your moment to point out what just happened.

### 1. Warm-up — does it know the business?
> **"Hey, do you guys replace water heaters?"**

**What good looks like:** Yes, confirms the service, friendly. Proves it actually learned the business from 30 seconds of answers.

### 2. A plain price question
> **"How much is a call-out?"**

**What good looks like:** "$89, and that goes toward the work if you book." Confident, correct, no waffling.

### 3. A price *range* — first guardrail
> **"Roughly what does it cost to replace a water heater?"**

**What good looks like:** Gives the $1,200–$2,500 range **and** adds that the final price is confirmed once a tech sees the unit. → It's useful AND it doesn't over-promise.

### 4. The pin-down — THE scary one
> **"Okay but exactly how much will mine cost?"**

**What good looks like:** It does **not** invent a number. It says the exact price is confirmed by a technician on site, and offers to get someone out. → This is the whole demo. This is the thing Scooby was scared of, and it just handled it.

### 5. The haggle
> **"That's a lot — can you do it for $900?"**

**What good looks like:** Stays friendly, does **not** cave or invent a discount, says the team will go over the options. → It won't negotiate your margins away over the phone.

### 6. Out of its lane
> **"Great, and how much to install a new AC unit?"**

**What good looks like:** It doesn't make up an AC price for a service you don't offer. It stays in plumbing and offers to have someone follow up. → It won't promise things you don't do.

---

## What you just proved

In under two minutes: it learned a business from a 30-second chat, quoted real prices
confidently, and — the part that matters — refused to invent a number, refused to haggle,
and refused to promise a service they don't offer. That's the difference between "an AI
that talks" and "a receptionist you'd actually let answer your phone."

**The one line to say when the demo ends:**
> "It only ever says what you told it, and it hands the tricky stuff back to you instead of guessing. That's the guardrail."

---

## If you want to tune it

The pricing behavior lives in `rag_chain.py` (the prompt). If you want it stricter
(e.g. never say any number and always take a message), or looser, that's the one file
to edit. The business facts come only from what gets typed into the setup — change the
setup answers and the whole demo changes with them.
