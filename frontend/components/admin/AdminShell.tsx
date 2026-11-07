"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import Wordmark from "../marketing/Wordmark";

const TABS = [
  { label: "Metrics", href: "/app/admin/metrics" },
  { label: "Businesses", href: "/app/admin/businesses" },
  { label: "Messages", href: "/app/admin/messages" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();

  // The admin login screen renders on its own, without the console nav.
  if (pathname === "/app/admin/login") return <>{children}</>;

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* slim brand strip — echoes the homepage */}
      <div className="border-b-2 border-ink bg-sun">
        <p className="mx-auto max-w-[1100px] px-5 py-1.5 text-center font-display text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink">
          Admin console — founders only
        </p>
      </div>

      {/* branded top nav */}
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-[clamp(16px,4vw,28px)] py-3">
          <Link href="/app/admin/metrics" className="flex items-center gap-2" aria-label="LumiDesk admin">
            <Wordmark className="text-[20px]" />
            <span className="rounded-full border-2 border-ink bg-flame px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-ink">
              admin
            </span>
          </Link>

          <nav className="order-3 -mx-1 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
            {TABS.map((t) => {
              const active = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`shrink-0 rounded-full border-2 px-4 py-1.5 font-display text-[13.5px] font-bold transition-colors ${
                    active
                      ? "border-ink bg-ink text-cream"
                      : "border-transparent text-ink/70 hover:border-ink hover:text-ink"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={signOut}
            className="ml-auto shrink-0 rounded-full border-2 border-ink/25 px-4 py-1.5 font-display text-[13px] font-bold text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-[clamp(16px,4vw,28px)] py-7">{children}</main>
    </div>
  );
}
