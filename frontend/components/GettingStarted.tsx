"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Settings } from "@/lib/api";

// Self-contained inline icon glyphs — no sprite / <use> / Icon-module dependency,
// so they render identically in every browser and can't be affected by stale
// module caching or the dashboard's global svg CSS. Explicit viewBox + size.
const GLYPHS: Record<string, ReactNode> = {
  "i-settings": (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "i-book": (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  "i-calendar-check": (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </>
  ),
  "i-wrench": (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  "i-sparkles": (
    <path d="M12 4l1.8 4.6a3 3 0 0 0 1.6 1.6L20 12l-4.6 1.8a3 3 0 0 0-1.6 1.6L12 20l-1.8-4.6a3 3 0 0 0-1.6-1.6L4 12l4.6-1.8a3 3 0 0 0 1.6-1.6z" />
  ),
  "i-check": <path d="M20 6 9 17l-5-5" />,
  "i-phone": (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
};

function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {GLYPHS[name]}
    </svg>
  );
}

// A friendly, dismissible setup checklist shown at the top of the dashboard for
// a brand-new business. Each step links to the page that completes it, and the
// "done" state is derived from the org's saved settings + setup status — so it
// checks itself off as the owner works through setup. Dismiss is persisted to
// the org settings (guide_dismissed) via the existing PATCH /api/settings proxy.

type Step = {
  key: string;
  icon: string;
  title: string;
  tip: string;
  href: string;
  cta: string;
  done: boolean;
};

function s(settings: Settings, k: string): string {
  const v = settings[k];
  return typeof v === "string" ? v.trim() : "";
}

export default function GettingStarted({
  settings,
  paid,
  hasNumber,
  orgName,
}: {
  settings: Settings;
  paid?: boolean;
  hasNumber?: boolean;
  orgName?: string | null;
}) {
  const initiallyDismissed = settings?.guide_dismissed === true;
  const [hidden, setHidden] = useState(initiallyDismissed);
  const [saving, setSaving] = useState(false);

  const kbSources = Array.isArray(settings?.kb_sources) ? (settings.kb_sources as unknown[]) : [];
  const steps: Step[] = [
    {
      key: "profile",
      icon: "i-settings",
      title: "Complete your business profile",
      tip: "Your name, email, hours and voice — this is how your receptionist introduces itself.",
      href: "/app/settings",
      cta: "Open settings",
      done: !!s(settings, "business_name") && !!s(settings, "contact_email"),
    },
    {
      key: "knowledge",
      icon: "i-book",
      title: "Add your knowledge base",
      tip: "Upload a doc or paste your services so the receptionist can answer real questions.",
      href: "/app/knowledge",
      cta: "Add knowledge",
      done: kbSources.length > 0,
    },
    {
      key: "calendar",
      icon: "i-calendar-check",
      title: "Connect your calendar",
      tip: "Let callers book straight into your calendar — no back-and-forth.",
      href: "/app/calendar",
      cta: "Connect calendar",
      done: !!s(settings, "google_calendar_id"),
    },
    {
      key: "number",
      icon: "i-wrench",
      title: "Get your phone number",
      tip: "The number customers call. Your receptionist answers everything that rings here.",
      href: "/app/numbers",
      cta: "Set up number",
      done: !!hasNumber || !!s(settings, "retell_phone_number"),
    },
    {
      key: "plan",
      icon: "i-sparkles",
      title: "Choose your plan",
      tip: "Pick a plan to take your receptionist live for real calls.",
      href: "/app/settings",
      cta: "Choose plan",
      done: !!paid,
    },
  ];

  const doneCount = steps.filter((st) => st.done).length;
  const total = steps.length;
  const pct = Math.round((doneCount / total) * 100);
  const allDone = doneCount === total;

  async function dismiss() {
    setHidden(true);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guide_dismissed: true }),
      });
    } catch {
      // Non-blocking — it's hidden locally either way; it may reappear next load.
    } finally {
      setSaving(false);
    }
  }

  async function reopen() {
    setHidden(false);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guide_dismissed: false }),
      });
    } catch {
      /* ignore */
    }
  }

  // Dismissed → leave a small, unobtrusive way back in.
  if (hidden) {
    return (
      <button
        type="button"
        onClick={reopen}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#E7E6EC] bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[#6B6B70] shadow-[0_6px_18px_rgba(23,23,23,0.04)] transition-colors hover:border-cobalt hover:text-cobalt"
      >
        <Glyph name="i-sparkles" size={15} />
        Show setup guide
      </button>
    );
  }

  // Everything done → a compact congratulations state with a way to tuck it away.
  if (allDone) {
    return (
      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#CDEBD6] bg-[#EAF8EF] px-5 py-4 shadow-[0_10px_28px_rgba(23,23,23,0.05)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 9999,
              flex: "0 0 auto",
              background: "#1C7A43",
              color: "#fff",
            }}
          >
            <Glyph name="i-check" size={18} />
          </span>
          <div>
            <div className="font-display text-[15px] font-bold text-[#161616]">You&apos;re all set up 🎉</div>
            <div className="mt-0.5 text-[13.5px] text-[#2A6B45]">
              Your receptionist is ready. Call your number anytime to hear it live.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={saving}
          className="shrink-0 self-start rounded-full border border-[#9FD3B4] bg-white px-4 py-2 font-display text-[12.5px] font-bold text-[#1C7A43] transition-opacity disabled:opacity-50 sm:self-auto"
        >
          Dismiss
        </button>
      </section>
    );
  }

  return (
    <section className="mb-5 rounded-2xl border border-[#E7E6EC] bg-white p-5 shadow-[0_10px_28px_rgba(23,23,23,0.05),0_2px_6px_rgba(23,23,23,0.03)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Glyph name="i-sparkles" size={18} />
            <h2 className="font-display text-[18px] font-bold tracking-[-0.01em] text-[#161616]">
              Welcome{orgName ? `, ${orgName}` : ""} — let&apos;s get you set up
            </h2>
          </div>
          <p className="mt-1 text-[13.5px] text-[#6B6B70]">
            A few quick steps and your AI receptionist is ready for real calls. Work through them in any order.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={saving}
          aria-label="Hide setup guide"
          className="shrink-0 rounded-full border border-[#E7E6EC] bg-white px-3 py-1.5 text-[12px] font-bold text-[#8E8E92] transition-colors hover:border-[#D7D9DF] hover:text-[#6B6B70] disabled:opacity-50"
        >
          Hide
        </button>
      </div>

      {/* Progress */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EFEFF2]">
          <div
            className="h-full rounded-full bg-cobalt transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[12.5px] font-bold text-[#6B6B70]">
          {doneCount} of {total} done
        </span>
      </div>

      {/* Steps */}
      <div className="mt-4 flex flex-col divide-y divide-[#EDEEF1]">
        {steps.map((st, i) => {
          const accents = [
            { bg: "#EAF0FF", fg: "#2F6BFF" }, // cobalt
            { bg: "#F1ECFF", fg: "#7C5CFF" }, // grape
            { bg: "#E6F8F0", fg: "#149A6B" }, // mint
            { bg: "#FFEDE4", fg: "#E4572E" }, // flame
            { bg: "#FFF5D6", fg: "#A5790B" }, // sun
          ];
          const a = accents[i % accents.length];
          return (
          <div key={st.key} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 12,
                flex: "0 0 auto",
                ...(st.done
                  ? { background: "#1C7A43", color: "#fff" }
                  : { background: a.bg, color: a.fg }),
              }}
            >
              <Glyph name={st.done ? "i-check" : st.icon} size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-[14px] font-bold ${st.done ? "text-[#8E8E92] line-through" : "text-[#161616]"}`}>
                {st.title}
              </div>
              {!st.done && <div className="mt-0.5 text-[12.5px] text-[#8E8E92]">{st.tip}</div>}
            </div>
            {st.done ? (
              <span className="shrink-0 text-[12px] font-bold text-[#1C7A43]">Done</span>
            ) : (
              <Link
                href={st.href}
                className="shrink-0 rounded-full bg-cobalt px-4 py-2 font-display text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
              >
                {st.cta}
              </Link>
            )}
          </div>
          );
        })}
      </div>

      {/* Final tip — hearing it live */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#F6F7F9] px-4 py-3">
        <span className="shrink-0" style={{ marginTop: 2 }}>
          <Glyph name="i-phone" size={16} />
        </span>
        <p className="text-[12.5px] text-[#6B6B70]">
          <b className="text-[#2A2A2E]">Tip:</b> once you have a number, call it yourself to hear your
          receptionist answer — it&apos;s the fastest way to see what your customers will experience.
        </p>
      </div>
    </section>
  );
}
