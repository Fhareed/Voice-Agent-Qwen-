"use client";

import Link from "next/link";
import Icon from "../Icon";
import Wordmark from "./Wordmark";

export default function Footer() {
  return (
    <footer className="border-t-2 border-ink bg-cream">
      <div className="mx-auto max-w-[1180px] px-5 py-12">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <Link href="/" aria-label="Lumidesk" className="inline-flex items-center">
              <Wordmark className="text-[28px]" />
            </Link>
            <p className="mt-3 max-w-xs font-sans text-[14px] text-muted">
              Your phone, always answered. Powered by DeepO3.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 font-sans text-[14px] font-semibold text-ink/80">
            <a href="#features" className="hover:text-ink">How it works</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
            <Link href="/login" className="hover:text-ink">Log in</Link>
            <Link href="/signup" className="hover:text-ink">Start free</Link>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#contact"
              aria-label="Instagram"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink text-ink transition-colors hover:bg-ink hover:text-cream"
            >
              <Icon name="i-instagram" className="lu h-5 w-5" />
            </a>
            <a
              href="#contact"
              aria-label="Email"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-ink text-ink transition-colors hover:bg-ink hover:text-cream"
            >
              <Icon name="i-mail" className="lu h-5 w-5" />
            </a>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t-2 border-ink pt-6 text-[13px] font-semibold text-muted md:flex-row md:items-center">
          <span>© 2026 Lumidesk. All rights reserved.</span>
          <span>Made for businesses that refuse to miss a call.</span>
        </div>
      </div>
    </footer>
  );
}
