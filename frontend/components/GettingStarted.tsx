"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import type { Settings } from "@/lib/api";

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
        <Icon name="i-sparkles" style={{ width: 15, height: 15 }} />
        Show setup guide
      </button>
    );
  }

  // Everything done → a compact congratulations state with a way to tuck it away.
  if (allDone) {
    return (
      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#CDEBD6] bg-[#EAF8EF] px-5 py-4 shadow-[0_10px_28px_rgba(23,23,23,0.05)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1C7A43] text-white">
            <Icon name="i-check" style={{ width: 18, height: 18 }} />
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
            <Icon name="i-sparkles" style={{ width: 18, height: 18 }} />
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
        {steps.map((st) => (
          <div key={st.key} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                st.done ? "bg-[#1C7A43] text-white" : "bg-[#F2F3F5] text-[#8E8E92]"
              }`}
            >
              <Icon name={st.done ? "i-check" : st.icon} style={{ width: 16, height: 16 }} />
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
        ))}
      </div>

      {/* Final tip — hearing it live */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#F6F7F9] px-4 py-3">
        <Icon name="i-phone" style={{ width: 16, height: 16, marginTop: 2 }} />
        <p className="text-[12.5px] text-[#6B6B70]">
          <b className="text-[#2A2A2E]">Tip:</b> once you have a number, call it yourself to hear your
          receptionist answer — it&apos;s the fastest way to see what your customers will experience.
        </p>
      </div>
    </section>
  );
}
