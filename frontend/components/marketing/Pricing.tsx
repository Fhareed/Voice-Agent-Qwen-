"use client";

import { useState } from "react";
import Icon from "../Icon";
import { PillButton, SectionLabel } from "./ui";
import { Reveal, ShineCard } from "./motion";

type Tier = {
  name: string;
  monthly: number;
  setup?: number | null;
  priceSuffix?: string;
  who: string;
  features: string[];
  highlight?: boolean;
  cta: string;
  ctaHref: string;
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    monthly: 79,
    setup: 249,
    who: "For the solo operator who can't answer while working.",
    features: [
      "Inbound, answered 24/7",
      "Up to 100 calls a month",
      "Answers in English and your language",
      "Books one calendar, texts you every lead",
    ],
    cta: "Start free",
    ctaHref: "/signup",
  },
  {
    name: "Pro",
    monthly: 149,
    setup: 249,
    who: "For busy teams that live and die by the phone.",
    features: [
      "Everything in Starter",
      "Unlimited calls (fair use)",
      "Automatic text follow-up to every caller",
      "Answers hours, pricing & service area",
    ],
    highlight: true,
    cta: "Start free",
    ctaHref: "/signup",
  },
  {
    name: "Outbound",
    monthly: 99,
    setup: null,
    priceSuffix: "+ usage",
    who: "Add-on: let LumiDesk make the calls, too.",
    features: [
      "Outbound campaigns at scale",
      "Pay per connected call",
      "Confirmations & follow-ups",
      "Scripted lead qualification",
    ],
    cta: "Talk to us",
    ctaHref: "#contact",
  },
];

// Founding-customer offer: setup fee waived for our first customers. Flip to
// false when the founding period ends (and turn off WAIVE_SETUP_FEE on the
// backend to match).
const FOUNDING = true;

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const price = (m: number) => (yearly ? Math.round((m * 10) / 12) : m);

  return (
    <section id="pricing" className="border-t-2 border-ink bg-cream px-5 py-20 md:py-28">
      <div className="mx-auto max-w-[1180px]">
        <Reveal>
          <SectionLabel num="04">Pricing</SectionLabel>
          <h2 className="mt-4 max-w-3xl font-display text-[clamp(40px,6vw,76px)] font-bold uppercase leading-[0.92] tracking-[-0.03em] text-ink">
            Simple <span className="text-flame">pricing.</span>
          </h2>
          <p className="mt-5 max-w-xl font-sans text-[18px] text-muted">
            One-time setup, then a flat monthly fee. Every call answered. Cancel anytime.
          </p>
          {FOUNDING && (
            <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border-2 border-ink bg-sun px-4 py-2 font-display text-[13.5px] font-bold text-ink shadow-[4px_5px_0_#111827]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-flame" />
              Founding offer — we&apos;re waiving the €249 setup fee for our first customers.
            </div>
          )}
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-8 inline-flex items-center rounded-full border-2 border-ink bg-paper p-1">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-5 py-2 font-display text-[14px] font-bold transition-colors ${!yearly ? "bg-ink text-cream" : "text-ink"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-5 py-2 font-display text-[14px] font-bold transition-colors ${yearly ? "bg-ink text-cream" : "text-ink"}`}
            >
              Yearly · 2 months free
            </button>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <ShineCard
                max={6}
                className={`flex h-full flex-col rounded-[22px] border-[3px] border-ink p-7 shadow-hard ${
                  t.highlight ? "bg-flame" : "bg-paper"
                }`}
              >
                  <div className="font-display text-[20px] font-bold text-ink">{t.name}</div>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="font-display text-[48px] font-bold leading-none text-ink">€{price(t.monthly)}</span>
                    <span className="pb-1.5 font-sans text-[14px] font-semibold text-ink/70">/mo{t.priceSuffix ? ` ${t.priceSuffix}` : ""}</span>
                  </div>
                  {t.setup ? (
                    FOUNDING ? (
                      <div className="mt-1 font-sans text-[13px] font-bold text-ink">
                        <span className="text-ink/45 line-through">€{t.setup} setup</span> — €0, founding offer
                      </div>
                    ) : (
                      <div className="mt-1 font-sans text-[13px] font-semibold text-ink/60">+ €{t.setup} one-time setup</div>
                    )
                  ) : (
                    <div className="mt-1 font-sans text-[13px] font-semibold text-ink/60">Add-on to any plan</div>
                  )}
                  {yearly && t.setup ? (
                    <div className="mt-0.5 font-sans text-[12.5px] font-semibold text-ink/50">monthly billed yearly</div>
                  ) : null}
                  <p className="mt-3 font-sans text-[14px] text-ink/75">{t.who}</p>
                  <div className="my-5 h-0.5 w-full bg-ink/15" />
                  <ul className="flex flex-1 flex-col gap-3">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 font-sans text-[14px] font-medium text-ink">
                        <Icon name="i-check" className="lu mt-0.5 h-[18px] w-[18px] shrink-0 text-ink" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-7">
                    <PillButton
                      href={t.ctaHref}
                      variant={t.highlight ? "fill" : "outline"}
                      className="w-full"
                    >
                      {t.cta}
                    </PillButton>
                  </div>
              </ShineCard>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-8 rounded-[18px] border-2 border-ink bg-sun px-6 py-4 font-display text-[14px] font-bold text-ink">
            {FOUNDING
              ? "Founding customers pay no setup fee (normally €249) — concierge onboarding still included. No contract, cancel anytime, keep every lead you capture."
              : "Every plan includes a one-time €249 setup (concierge onboarding). No contract, cancel anytime, keep every lead you capture."}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
