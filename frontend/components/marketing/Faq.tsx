"use client";

import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import Icon from "../Icon";
import { SectionLabel } from "./ui";
import { motion, Reveal } from "./motion";

const QA = [
  {
    q: "Does it really sound human?",
    a: "Yes. Callers hear a natural, warm voice in English or the language they speak. Most never realize they aren't talking to a person.",
  },
  {
    q: "What happens when I'm busy?",
    a: "Lumidesk answers instead of you. It books the job, captures the details, and texts the caller back while you keep working.",
  },
  {
    q: "Which languages does it speak?",
    a: "English, plus the language your customers speak. Tell us which you need and we'll set it up — and we add new languages all the time.",
  },
  {
    q: "Will it work with my calendar?",
    a: "Yes. Lumidesk books straight into your calendar, so your schedule fills on its own. No double-booking, no back and forth.",
  },
  {
    q: "How long does setup take?",
    a: "About a day. Tell us your hours, services, and prices, and Lumidesk is answering calls by tomorrow.",
  },
  {
    q: "What if I want to cancel?",
    a: "Cancel anytime. No contracts, no penalties. You keep every lead and booking you've captured.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t-2 border-ink bg-cobalt px-5 py-20 text-cream md:py-28">
      <div className="mx-auto max-w-[900px]">
        <Reveal>
          <div className="font-display text-[12px] font-bold uppercase tracking-[0.18em] text-sun">06 — FAQ</div>
          <h2 className="mt-4 font-display text-[clamp(40px,6vw,76px)] font-bold uppercase leading-[0.92] tracking-[-0.03em]">
            Good <span className="text-sun">questions.</span>
          </h2>
        </Reveal>

        <div className="mt-10 space-y-3">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={i} delay={i * 0.04}>
                <div className="overflow-hidden rounded-[18px] border-2 border-ink bg-cream text-ink">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="font-display text-[17px] font-bold md:text-[19px]">{item.q}</span>
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink transition-all ${
                        isOpen ? "rotate-45 bg-flame" : "bg-paper"
                      }`}
                    >
                      <Icon name="i-plus" className="lu h-4 w-4 text-ink" />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <p className="px-5 pb-5 font-sans text-[15px] leading-relaxed text-ink/80">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
