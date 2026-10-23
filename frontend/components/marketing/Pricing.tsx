"use client";

import { useState } from "react";
import Icon from "../Icon";
import { PillButton, SectionLabel } from "./ui";
import { Reveal, ShineCard } from "./motion";

type Tier = {
  name: string;
  monthly: number | null;
  who: string;
  features: string[];
  highlight?: boolean;
  cta: string;
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    monthly: 79,
    who: "For the solo operator who can't answer while working.",
    features: [
      "Up to 100 answered calls a month",
      "Answers 24/7 in English and your language",
      "Books into one calendar",
      "Lead details texted straight to you",
    ],
    cta: "Start free",
  },
  {
    name: "Pro",
    monthly: 149,
    who: "For busy teams that live and die by the phone.",
    features: [
      "Unlimited answered calls",
      "Everything in Starter",
      "Answers hours, pricing & service area",
      "Automatic text follow-up to every caller",
    ],
    highlight: true,
    cta: "Start free",
  },
  {
    name: "Custom",
    monthly: null,
    who: "For multi-location businesses and franchises.",
    features: [
      "Volume pricing",
      "Multiple numbers and locations",
      "Custom voice and call scripts",
      "Dedicated account manager",
    ],
    cta: "Talk to us",
  },
];

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
            One flat fee. Every call answered. Cancel anytime.
          </p>
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
                    {t.monthly == null ? (
                      <span className="font-display text-[40px] font-bold leading-none text-ink">Let&apos;s talk</span>
                    ) : (
                      <>
                        <span className="font-display text-[48px] font-bold leading-none text-ink">€{price(t.monthly)}</span>
                        <span className="pb-1.5 font-sans text-[14px] font-semibold text-ink/70">/mo</span>
                      </>
                    )}
                  </div>
                  {yearly && t.monthly != null && (
                    <div className="mt-1 font-sans text-[12.5px] font-semibold text-ink/60">billed yearly</div>
                  )}
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
                      href={t.monthly == null ? "#contact" : "/signup"}
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
            Placeholder pricing, final plans confirmed at launch. Every plan: no contract, cancel anytime, keep every lead you capture.
          </div>
        </Reveal>
      </div>
    </section>
  );
}
