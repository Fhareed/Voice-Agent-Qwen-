"use client";

import { useMotionValue } from "framer-motion";
import Icon from "../Icon";
import ContactForm from "./ContactForm";
import EyeRow from "./Eyes";
import Faq from "./Faq";
import HeroArt from "./HeroArt";
import Pricing from "./Pricing";
import { CountUp, Magnetic, Reveal, ShineCard, Stagger, StaggerItem } from "./motion";
import { Badge, Marquee, PillButton, SectionLabel } from "./ui";

const MARQUEE = [
  "Answers every call",
  "Books jobs",
  "Never on hold",
  "24/7",
  "Speaks your language",
  "Captures every lead",
  "Texts back",
];

const FEATURES = [
  { n: "01", color: "bg-sun", icon: "i-phone", title: "Answers every call", desc: "Picks up on the first ring, every time, day or night. No hold music. No voicemail. No missed customers." },
  { n: "02", color: "bg-periwinkle", icon: "i-calendar", title: "Books the job", desc: "Checks your calendar and books the appointment while you work. The slot is filled before you reach for your phone." },
  { n: "03", color: "bg-rose", icon: "i-user", title: "Captures the lead", desc: "Takes the caller's name, number, and reason for calling. You get every detail, even on the calls you couldn't take." },
  { n: "04", color: "bg-mint", icon: "i-globe", title: "Speaks their language", desc: "Answers in English and the language your customers speak — natural, warm, and hard to tell from a person. Need a specific language? Just ask." },
];

const QUOTES = [
  { quote: "A missed call is a missed job. Simple as that.", attr: "WHY IT MATTERS", bg: "bg-paper" },
  { quote: "People hang up on voicemail. They don't hang up on a real voice.", attr: "WHAT WE BELIEVE", bg: "bg-sun" },
  { quote: "The best receptionist never sleeps, never breaks, never calls in sick.", attr: "HOW WE THINK", bg: "bg-paper" },
];

const NOTES = [
  { cat: "MISSED CALLS", title: "The Call You Didn't Take Cost €300", teaser: "The real price of one ring you let slide to voicemail." },
  { cat: "LOCAL SEO", title: "Found On Google, Lost On The Phone", teaser: "Ranking first means nothing if nobody picks up." },
  { cat: "TRUST", title: "A Voice Beats A Voicemail", teaser: "How answering live turns a first-time caller into a regular." },
];

export default function Home() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  return (
    <main className="overflow-hidden bg-cream text-ink">
      {/* ───── HERO ───── */}
      <section
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width - 0.5);
          my.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onMouseLeave={() => {
          mx.set(0);
          my.set(0);
        }}
        className="relative px-5 pb-16 pt-12 md:pt-16"
      >
        {/* soft colour blobs */}
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-flame/20 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-40 h-80 w-80 rounded-full bg-cobalt/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Reveal>
              <Badge>AI Phone Receptionist</Badge>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-5 font-display text-[clamp(48px,8vw,104px)] font-bold uppercase leading-[0.9] tracking-[-0.04em]">
                Never miss
                <br />
                another <span className="text-flame">job.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-lg font-sans text-[18px] leading-relaxed text-muted">
                Lumidesk answers every call in a real human voice, books the appointment, and texts the customer back.
                Even when you&apos;re on a roof, driving, or asleep.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <PillButton href="/signup" variant="flame">Start free</PillButton>
                </Magnetic>
                <PillButton href="#features" variant="outline" icon="i-arrow-d">Hear it answer</PillButton>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-8 flex flex-wrap gap-2.5">
                {["Always on", "Books 24/7", "Any language"].map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3.5 py-1.5 font-display text-[12px] font-bold uppercase tracking-wide">
                    <Icon name="i-check" className="lu h-3.5 w-3.5 text-flame" />
                    {b}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="relative">
            <HeroArt mx={mx} my={my} />
          </div>
        </div>
      </section>

      <Marquee items={MARQUEE} />

      {/* ───── STAT BAND ───── */}
      <section className="border-b-2 border-ink bg-ink px-5 py-12 text-cream">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-8 text-center md:grid-cols-3">
          <div>
            <div className="font-display text-[clamp(38px,6vw,64px)] font-bold leading-none text-flame">
              <CountUp to={100} suffix="%" />
            </div>
            <div className="mt-2 font-display text-[13px] font-bold uppercase tracking-wide text-cream/70">Calls answered</div>
          </div>
          <div>
            <div className="font-display text-[clamp(38px,6vw,64px)] font-bold leading-none text-sun">24/7</div>
            <div className="mt-2 font-display text-[13px] font-bold uppercase tracking-wide text-cream/70">Always on</div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="font-display text-[clamp(38px,6vw,64px)] font-bold uppercase leading-none text-mint">Any</div>
            <div className="mt-2 font-display text-[13px] font-bold uppercase tracking-wide text-cream/70">Language, on request</div>
          </div>
        </div>
      </section>

      {/* ───── FEATURES ───── */}
      <section id="features" className="border-b-2 border-ink bg-cream px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <SectionLabel num="01">How it works</SectionLabel>
            <h2 className="mt-4 max-w-3xl font-display text-[clamp(40px,6vw,76px)] font-bold uppercase leading-[0.92] tracking-[-0.03em]">
              What it <span className="text-flame">does.</span>
            </h2>
            <p className="mt-5 max-w-xl font-sans text-[18px] text-muted">
              Your phone rings. Lumidesk picks up. The job gets booked.
            </p>
          </Reveal>

          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <StaggerItem key={f.n}>
                <ShineCard max={10} className={`flex h-full flex-col rounded-[22px] border-[3px] border-ink ${f.color} p-6 shadow-hard`}>
                    <div className="flex items-center justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink bg-cream">
                        <Icon name={f.icon} className="lu h-5 w-5 text-ink" />
                      </span>
                      <span className="font-display text-[13px] font-bold text-ink/50">{f.n} / 04</span>
                    </div>
                    <h3 className="mt-5 font-display text-[22px] font-bold leading-tight text-ink">{f.title}</h3>
                    <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink/80">{f.desc}</p>
                </ShineCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ───── DIRECTIONS ───── */}
      <section id="directions" className="border-b-2 border-ink bg-cream px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <SectionLabel num="02">Who it&apos;s for</SectionLabel>
            <h2 className="mt-4 max-w-3xl font-display text-[clamp(40px,6vw,76px)] font-bold uppercase leading-[0.92] tracking-[-0.03em]">
              Works where <span className="text-flame">you</span> work.
            </h2>
            <p className="mt-5 max-w-xl font-sans text-[18px] text-muted">
              Different jobs. Same problem. The phone rings when your hands are full.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal>
              <ShineCard max={7} className="flex h-full flex-col justify-between rounded-[26px] border-[3px] border-ink bg-paper p-8 shadow-hard-lg md:p-10">
                  <span className="font-display text-[12px] font-bold uppercase tracking-[0.15em] text-flame">01 / Trades</span>
                  <h3 className="mt-6 font-display text-[clamp(30px,4vw,48px)] font-bold uppercase leading-[0.95] tracking-[-0.02em] text-ink">
                    Hands full? We&apos;ve got the <span className="text-flame">phone.</span>
                  </h3>
                  <p className="mt-5 font-sans text-[15px] leading-relaxed text-ink/80">
                    You&apos;re under a sink or up a ladder. Lumidesk answers, books the next call, and texts them back. You never stop working.
                  </p>
              </ShineCard>
            </Reveal>
            <Reveal delay={0.08}>
              <ShineCard max={7} className="flex h-full flex-col justify-between rounded-[26px] border-[3px] border-ink bg-cobalt p-8 text-cream shadow-hard-lg md:p-10">
                  <span className="font-display text-[12px] font-bold uppercase tracking-[0.15em] text-sun">02 / Clinics &amp; salons</span>
                  <h3 className="mt-6 font-display text-[clamp(30px,4vw,48px)] font-bold uppercase leading-[0.95] tracking-[-0.02em]">
                    A front desk that <span className="text-sun">never closes.</span>
                  </h3>
                  <p className="mt-5 font-sans text-[15px] leading-relaxed text-cream/85">
                    Your team is with a client, not stuck on the phone. Lumidesk handles bookings, questions, and reminders so nobody waits on hold.
                  </p>
              </ShineCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───── PHILOSOPHY ───── */}
      <section className="border-b-2 border-ink bg-cream px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <SectionLabel num="03">Why it matters</SectionLabel>
            <h2 className="mt-4 max-w-3xl font-display text-[clamp(40px,6vw,76px)] font-bold uppercase leading-[0.92] tracking-[-0.03em]">
              Small business. Big <span className="text-flame">presence.</span>
            </h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
            {QUOTES.map((q) => (
              <StaggerItem key={q.attr}>
                <ShineCard max={8} className={`flex h-full flex-col justify-between rounded-[22px] border-[3px] border-ink ${q.bg} p-7 shadow-hard`}>
                    <p className="font-display text-[22px] font-bold leading-snug tracking-tight text-ink">“{q.quote}”</p>
                    <div className="mt-8 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink/55">— {q.attr}</div>
                </ShineCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <Pricing />

      {/* ───── NOTES ───── */}
      <section className="border-t-2 border-ink bg-sun px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <div className="font-display text-[12px] font-bold uppercase tracking-[0.18em] text-flame">05 — From the studio</div>
            <h2 className="mt-4 max-w-3xl font-display text-[clamp(40px,6vw,76px)] font-bold uppercase leading-[0.92] tracking-[-0.03em] text-ink">
              From the <span className="text-cobalt">studio.</span>
            </h2>
            <p className="mt-5 max-w-xl font-sans text-[18px] text-ink/70">
              Short notes on calls, customers, and getting found.
            </p>
          </Reveal>
          <Stagger className="mt-12 grid gap-6 md:grid-cols-3">
            {NOTES.map((n) => (
              <StaggerItem key={n.cat}>
                <ShineCard max={7} className="flex h-full flex-col rounded-[22px] border-[3px] border-ink bg-cream p-7 shadow-hard">
                    <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-flame">{n.cat}</span>
                    <h3 className="mt-3 font-display text-[22px] font-bold leading-tight text-ink">{n.title}</h3>
                    <p className="mt-3 flex-1 font-sans text-[14px] text-ink/70">{n.teaser}</p>
                    <span className="mt-6 inline-flex items-center gap-1 font-display text-[14px] font-bold text-ink">Read more +</span>
                </ShineCard>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <Faq />

      {/* ───── CONTACT ───── */}
      <section id="contact" className="border-t-2 border-ink bg-cream px-5 py-20 md:py-28">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <SectionLabel num="07">Get in touch</SectionLabel>
            <h2 className="mt-4 max-w-4xl font-display text-[clamp(40px,6.5vw,84px)] font-bold uppercase leading-[0.9] tracking-[-0.03em]">
              Let&apos;s get you <span className="text-flame">answered.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid items-start gap-10 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="max-w-md font-sans text-[18px] text-muted">
                  Powered by DeepO3. Tell us about your business and we&apos;ll reply within one business day.
                </p>
              </Reveal>
              <Reveal delay={0.08}>
                <div className="mt-6 rounded-[20px] border-[3px] border-ink bg-sun p-6 shadow-hard">
                  <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-ink/60">Email us</div>
                  <a href="mailto:hello@lumidesk.ai" className="mt-1 flex items-center gap-2 font-display text-[clamp(20px,3vw,30px)] font-bold tracking-tight text-ink">
                    <Icon name="i-mail" className="lu h-6 w-6" />
                    hello@lumidesk.ai
                  </a>
                </div>
              </Reveal>
              <Reveal delay={0.14}>
                <div className="mt-4 flex items-center justify-between rounded-[20px] border-[3px] border-ink bg-rose p-6 text-cream shadow-hard">
                  <div>
                    <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-cream/80">Follow Lumidesk</div>
                    <div className="mt-1 font-display text-[22px] font-bold">Instagram</div>
                  </div>
                  <Icon name="i-instagram" className="lu h-8 w-8" />
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-10">
                  <EyeRow />
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───── FINAL CTA ───── */}
      <section className="border-t-2 border-ink bg-cream px-5 py-16 md:py-20">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <div className="rounded-[30px] border-[3px] border-ink bg-flame px-6 py-16 text-center shadow-hard-lg md:px-10 md:py-20">
              <h2 className="mx-auto max-w-3xl font-display text-[clamp(38px,7vw,88px)] font-bold uppercase leading-[0.9] tracking-[-0.03em] text-ink">
                Stop missing <span className="text-cream">jobs.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-lg font-sans text-[18px] text-ink/80">
                Every call answered, every lead captured, starting tomorrow.
              </p>
              <div className="mt-8 flex justify-center">
                <Magnetic>
                  <PillButton href="/signup" variant="fill">Start free</PillButton>
                </Magnetic>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
