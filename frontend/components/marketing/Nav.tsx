"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import Icon from "../Icon";
import Wordmark from "./Wordmark";
import { PillButton } from "./ui";

const LINKS = [
  { label: "How it works", href: "#features" },
  { label: "Who it's for", href: "#directions" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* slim promo strip (scrolls away) */}
      <div className="border-b-2 border-ink bg-sun">
        <p className="mx-auto max-w-[1180px] px-5 py-2 text-center font-display text-[12.5px] font-bold tracking-tight text-ink sm:text-[13px]">
          Answer every call, 24/7 — in English and your customers&apos; language.
        </p>
      </div>

      {/* floating liquid-glass nav */}
      <div className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <nav className="relative mx-auto flex max-w-[1180px] items-center justify-between gap-4 rounded-full border border-white/50 bg-white/55 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(17,24,39,0.05),0_14px_44px_-14px_rgba(17,24,39,0.32)] backdrop-blur-2xl backdrop-saturate-150 sm:px-5 sm:py-3">
          <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/70 via-white/10 to-transparent" />
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px rounded-full bg-white/80" />

          <Link href="/" aria-label="Lumidesk" className="relative flex items-center" onClick={() => setOpen(false)}>
            <Wordmark className="text-[21px] sm:text-[23px]" />
          </Link>

          <div className="relative hidden items-center gap-7 lg:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="relative font-sans text-[14px] font-semibold text-ink/70 transition-colors hover:text-ink after:absolute after:-bottom-1.5 after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:rounded-full after:bg-ink after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="relative flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full border-2 border-ink/20 px-5 py-2 font-display text-[13.5px] font-bold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream lg:inline-flex"
            >
              Log in
            </Link>
            <PillButton href="/signup" variant="flame" className="!px-4 !py-2.5 !text-[13px] sm:!px-5 sm:!text-[13.5px]">
              Start free
            </PillButton>
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 bg-white/60 text-ink lg:hidden"
            >
              <Icon name={open ? "i-x" : "i-menu"} className="lu h-5 w-5" />
            </button>
          </div>
        </nav>

        {/* mobile dropdown menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-2 max-w-[1180px] overflow-hidden rounded-[22px] border border-ink/10 bg-white/90 p-2 shadow-[0_14px_44px_-14px_rgba(17,24,39,0.3)] backdrop-blur-2xl lg:hidden"
            >
              <div className="flex flex-col">
                {LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 font-display text-[16px] font-bold text-ink transition-colors hover:bg-ink/5"
                  >
                    {l.label}
                  </a>
                ))}
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="mt-1 rounded-2xl border-2 border-ink px-4 py-3 text-center font-display text-[15px] font-bold text-ink"
                >
                  Log in
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
