# Answerly — Landing Page Build Spec
### (What we learned from Botpress, translated for trade owners)

## The one rule that governs everything

Botpress sells to **developers and enterprise support teams**. Answerly sells to **plumbers, HVAC guys, and small-shop owners**. So we copy Botpress's *craft* — the polish, the glass, the interactive proof, the conversion flow — but we **do not** copy its voice or its "for tech people" feel. Every word on our page is in plumber-English, and every visual choice says *trustworthy and simple*, not *powerful and technical*.

Good news from the teardown: **Botpress is now light, warm, and colorful** (off-white background, gradient glass art) — not the dark dev look. That means our existing four-color light aesthetic is already on-trend. We're not starting a new direction; we're leveling ours up.

---

## What Botpress does well (and we'll borrow)

1. **Huge, plain, confident headline.** One bold sentence, ends in a period. No jargon. ("The AI-native customer support platform.")
2. **Two CTAs, repeated everywhere.** A solid primary ("Get a demo →") + a ghost secondary ("Try for free"), with tiny trust text under them ("SOC 2 compliant · No credit card required").
3. **Liquid-glass gradient art.** Translucent, glassy 3D shapes with a yellow→pink→purple→blue→green gradient, used as hero and section backgrounds. This is the "wow" layer.
4. **Interactive proof, not screenshots.** A live chat mockup, a dashboard with real-looking stats, and — critically — an **ROI savings calculator with sliders** ("Save $48,666/yr vs Zendesk"). They let you *play*, not just look.
5. **Big-number social proof.** "750k agents built · 10 yrs" + a star rating + logos, right under the hero.
6. **A numbered "how it works" stepper** (01 Build → 02 Resolve → 03 Escalate → 04 Improve) beside a product visual.
7. **Scroll-reveal motion.** Sections fade/slide up as you scroll — subtle, premium, never flashy.
8. **They run their own bot in the corner.** Dogfooding as a trust signal.

---

## The Answerly page, section by section

Our brand palette stays: **indigo #23003F · red #F94500 · light purple #BCACCE · light yellow #FFFDB4**, off-white ground, Fraunces (italic display) + Plus Jakarta Sans + IBM Plex Mono. The glass gradient uses *our* four colors instead of Botpress's.

**1. Nav (sticky, glass)**
Answerly wordmark · How it works · Pricing · [Try the demo] (ghost) · [Book a call] (solid red). Translucent frosted bar (backdrop-blur) so content glides under it.

**2. Hero**
- Headline (Fraunces italic): *"Never miss another job to a missed call."*
- Sub: "Answerly answers your phone 24/7, books the job, and texts you the lead — even when you're on a roof or asleep."
- CTAs: **[Hear it answer your business →]** (solid red) + **[Book a call]** (ghost). Trust line: "✓ Set up in 60 seconds  ✓ No credit card."
- Behind it: our liquid-glass shape — a translucent indigo→red→purple→yellow gradient blob with a glassy sheen (backdrop-filter blur + soft noise + highlight edges).

**3. Social proof strip**
Star rating + "answers calls for HVAC & plumbing shops across the US" + a couple of big numbers once we have them (e.g. "62% of calls to small shops go unanswered · Answerly catches them"). Until we have logos, use the stat, not fake logos.

**4. The interactive demo — the star of the page**
This is our version of Botpress's live mockups, and it's better because it's about *them*. Three tabs for how to set up:
- **Paste your website** (default) — drop your URL, it reads your site.
- **Answer a few questions** — the guided interview.
- **Upload a doc** — price list or service menu.
Then a big **"Hear it answer a customer"** call console (the demo we already built). Header: "Try it on your own business — right now."

**5. The missed-call ROI calculator**
Drop in the calculator we already built, styled over a glass gradient like Botpress's savings card. Sliders: calls/week, % missed, job value, close rate → "You're losing ~$X a month. Answerly recovers most of it." This is the number that makes an owner lean in.

**6. How it works (numbered stepper)**
01 Tell it about your business (60 sec) → 02 It answers every call → 03 It books jobs & captures leads → 04 You see everything in your dashboard. Beside it: a shot of the call log / dashboard we built.

**7. Problem/agitation band (over glass)**
Big line: *"Every missed call is a job that went to the next guy."* Short copy on the real cost — after-hours, on-the-job, weekends — the calls a busy owner can't physically answer.

**8. Objection-handling / trust**
Short FAQ-style: "Does it sound like a robot?" (no — hear the demo), "What if it doesn't know something?" (it takes a message, never makes things up), "How fast to set up?" (one minute). This is where we answer the Scoopy-style fears in plain sight.

**9. Final CTA band (big glass art)**
Our version of "Built for the tough tickets." → *"Your phone should never go to voicemail again."* + [Hear it answer your business →] + [Book a call]. Full-width liquid-glass prism art in our colors.

**10. Footer**
Answerly · How it works · Pricing · Book a call · contact email. And the small "Powered by DEEP03" credit, same as the app.

---

## The visual system (how to build the "liquid glass")

- **Glass gradient shapes:** a rotated element with `background: linear/conic-gradient` across indigo→red→purple→yellow, `filter: blur()` for the soft bloom, layered with a translucent `backdrop-filter: blur()` panel on top and a 1px highlight border (`rgba(255,255,255,.4)`) to fake the refractive edge. Add a faint noise overlay so it reads as *glass*, not flat gradient.
- **Cards:** frosted glass — semi-transparent white, `backdrop-filter: blur(14px)`, soft shadow, hairline border.
- **Motion:** scroll-reveal (fade + 20px rise) via `IntersectionObserver`; buttons lift on hover; the gradient slowly drifts. Respect `prefers-reduced-motion`. Nothing bounces or spins — premium means restrained.
- **Type:** Fraunces italic for the big statements (our signature), Plus Jakarta Sans for everything readable, IBM Plex Mono for the small labels/eyebrows.

---

## What ships vs what's later

**Ships in v1 (mostly built already):** hero, social-proof strip, the interactive demo (exists), the ROI calculator (exists), how-it-works, problem band, FAQ, final CTA, footer. The demo and calculator are done — this is mostly wrapping them in a landing page + writing the copy + the glass visual layer.

**Later:** real customer logos/testimonials (once you have them — never fake these), the "book a call" scheduling (start with a simple contact form or your email/Calendly), the website-scrape onboarding wired to the backend.

---

## Next step

I'll build the **hero section first** as a single rendered page so you can see the Botpress-grade glass aesthetic translated into Answerly's colors — before I build all ten sections. Approve the look, then I build the full page around the demo and calculator you already have.
