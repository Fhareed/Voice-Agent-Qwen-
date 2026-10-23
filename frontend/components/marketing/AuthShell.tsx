"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "../Icon";
import Wordmark from "./Wordmark";
import { motion } from "./motion";

function FloatCards({ tone }: { tone: "login" | "signup" }) {
  // White mini-card reads on both the cobalt and flame panels.
  const inCard = { hidden: { opacity: 0, y: 24, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } };
  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden xl:block">
      {/* live-call mini card */}
      <motion.div
        variants={inCard}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute right-[5%] top-[22%] w-[260px] rotate-[4deg]"
      >
        <div className="animate-float overflow-hidden rounded-[18px] border-2 border-ink bg-white shadow-hard">
          <div className="flex items-center gap-2 border-b-2 border-ink bg-flame px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-ink" />
            <span className="font-display text-[11px] font-bold uppercase text-ink">Live call</span>
            <span className="ml-auto font-display text-[11px] font-bold text-ink">0:12</span>
          </div>
          <div className="space-y-2 p-3">
            <div className="max-w-[82%] rounded-xl rounded-tl-sm border-2 border-ink bg-periwinkle px-2.5 py-1.5 text-[11px] font-semibold text-ink">
              Are you open on Saturday?
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border-2 border-ink bg-mint px-2.5 py-1.5">
              <Icon name="i-check" className="lu h-3.5 w-3.5 text-ink" />
              <span className="font-display text-[11px] font-bold text-ink">Booked · Sat 10:00</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ALWAYS ON badge */}
      <motion.div
        variants={inCard}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute right-[40%] top-[12%]"
      >
        <div className="animate-float grid h-[76px] w-[76px] place-items-center rounded-full border-2 border-ink bg-sun text-center shadow-hard-sm" style={{ animationDelay: "0.6s" }}>
          <span className="px-1 font-display text-[10px] font-bold uppercase leading-tight text-ink">
            Always
            <br />
            on
          </span>
        </div>
      </motion.div>

      {/* new lead pill */}
      <motion.div
        variants={inCard}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.7, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="absolute right-[12%] top-[62%]"
      >
        <div className="animate-float flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3.5 py-2 shadow-hard-sm" style={{ animationDelay: "1.1s" }}>
          <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-rose text-cream">
            <Icon name="i-check" className="lu h-3 w-3" />
          </span>
          <span className="font-display text-[11px] font-bold uppercase text-ink">New lead captured</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function AuthShell({
  variant,
  title,
  subtitle,
  bullets,
  children,
}: {
  variant: "login" | "signup";
  title: ReactNode;
  subtitle: string;
  bullets?: string[];
  children: ReactNode;
}) {
  const panel =
    variant === "signup"
      ? { bg: "bg-flame", text: "text-ink", sub: "text-ink/75", ring: "border-ink/20", chip: "border-ink/50", dot: "text-cream" }
      : { bg: "bg-cobalt", text: "text-cream", sub: "text-cream/85", ring: "border-cream/25", chip: "border-cream/60", dot: "text-sun" };

  return (
    <div className="grid min-h-screen bg-cream lg:grid-cols-2">
      <div className={`relative hidden flex-col justify-between overflow-hidden p-10 lg:flex ${panel.bg} ${panel.text}`}>
        <FloatCards tone={variant} />

        <Link href="/" aria-label="Lumidesk" className="relative z-10">
          <Wordmark onDark={variant === "login"} className="text-[26px]" />
        </Link>

        <div className="relative z-10 max-w-sm">
          <h1 className="font-display text-[clamp(40px,4.4vw,64px)] font-bold uppercase leading-[0.92] tracking-[-0.03em]">{title}</h1>
          <p className={`mt-5 font-sans text-[17px] ${panel.sub}`}>{subtitle}</p>
          {bullets && (
            <ul className="mt-8 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-center gap-3 font-sans text-[15px] font-semibold">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${panel.chip}`}>
                    <Icon name="i-check" className={`lu h-3.5 w-3.5 ${panel.dot}`} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`relative z-10 font-display text-[13px] font-bold uppercase tracking-wide ${panel.sub}`}>
          Powered by DeepO3
        </div>

        <div className={`pointer-events-none absolute -right-28 -bottom-28 h-80 w-80 animate-spinslow rounded-full border-2 border-dashed ${panel.ring}`} />
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          <Link href="/" aria-label="Lumidesk" className="mb-8 inline-flex items-center lg:hidden">
            <Wordmark className="text-[24px]" />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
