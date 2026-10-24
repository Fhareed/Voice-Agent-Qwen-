"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "./Icon";
import type { Settings } from "@/lib/api";

const INDUSTRIES = ["Plumbing & trades", "Electrical", "Salon & beauty", "Dental & clinic", "Restaurant", "Other"];
const LANGUAGES = ["English", "Finnish", "Swedish", "German", "Spanish", "French"];

const CARD = "rounded-2xl border border-[#E7E6EC] bg-white p-6 shadow-[0_10px_28px_rgba(23,23,23,0.05),0_2px_6px_rgba(23,23,23,0.03)] sm:p-7";
const INPUT = "w-full rounded-xl border border-[#E7E6EC] bg-white px-3.5 py-2.5 text-[14.5px] text-[#161616] outline-none transition-colors focus:border-cobalt placeholder:text-[#9AA0AB]";
const LABEL = "mb-1.5 block text-[12.5px] font-bold text-[#2A2A2E]";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-cobalt" : "bg-[#D7D9DF]"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function str(s: Settings, k: string, d = ""): string {
  const v = s[k];
  return typeof v === "string" && v.trim() ? v : d;
}

function buildHours(from: string, to: string, sat: boolean) {
  const wk = { open: true, from, to };
  return {
    mon: wk, tue: wk, wed: wk, thu: wk, fri: wk,
    sat: sat ? { open: true, from, to } : { open: false, from, to },
    sun: { open: false, from, to },
  };
}

export default function OnboardingView({ settings, orgName }: { settings: Settings; orgName?: string | null }) {
  const router = useRouter();
  const s = settings || {};

  const [businessName, setBusinessName] = useState(str(s, "business_name", orgName || ""));
  const [industry, setIndustry] = useState(str(s, "industry", "Plumbing & trades"));
  const [services, setServices] = useState(str(s, "services"));
  const [pricing, setPricing] = useState(str(s, "pricing"));
  const [area, setArea] = useState(str(s, "service_area"));
  const [language, setLanguage] = useState(str(s, "default_language", "English"));
  const [alwaysOpen, setAlwaysOpen] = useState(s.always_open !== false);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [openSat, setOpenSat] = useState(false);

  const [phase, setPhase] = useState<"form" | "redirecting">("form");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("redirecting");

    const patch: Record<string, unknown> = {
      business_name: businessName,
      industry,
      services,
      pricing,
      service_area: area,
      default_language: language,
      always_open: alwaysOpen,
    };
    if (!alwaysOpen) patch.hours = buildHours(from, to, openSat);

    // 1) Save the business details (onboarded is set only after payment).
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Couldn't save your details. Try again.");
        setPhase("form");
        return;
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
      setPhase("form");
      return;
    }

    // 2) Send them to Stripe Checkout. On return, /app/welcome provisions.
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't start checkout. Try again.");
        setPhase("form");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server. Try again.");
      setPhase("form");
    }
  }

  if (phase === "redirecting") {
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-6">
        <div className="flex max-w-sm flex-col items-center text-center">
          <span className="mb-5 inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-[#E7E6EC] border-t-cobalt" />
          <h1 className="font-display text-[22px] font-bold text-[#161616]">Taking you to secure checkout…</h1>
          <p className="mt-2 text-[14px] text-[#6B6B70]">You&apos;ll come right back, and your receptionist is set up automatically once payment clears.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream py-10">
      <div className="mx-auto max-w-[620px] px-[clamp(16px,4vw,28px)]">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-grid h-12 w-12 place-items-center rounded-2xl bg-cobalt/10 text-cobalt">
            <Icon name="i-sparkles" className="lu h-6 w-6" />
          </span>
          <h1 className="font-display text-[clamp(24px,3.6vw,30px)] font-bold tracking-[-0.02em] text-[#161616]">Set up your AI receptionist</h1>
          <p className="mt-1.5 text-[14.5px] text-[#6B6B70]">Tell us about your business — we&apos;ll build a receptionist that answers your calls in your voice. Takes about a minute.</p>
        </div>

        <form onSubmit={submit} className={CARD}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Business name</label>
              <input className={INPUT} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="PriceVilla Plumbing" required />
            </div>
            <div>
              <label className={LABEL}>Industry</label>
              <select className={INPUT} value={industry} onChange={(e) => setIndustry(e.target.value)}>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className={LABEL}>What services do you offer?</label>
            <textarea className={`${INPUT} h-20 resize-y`} value={services} onChange={(e) => setServices(e.target.value)} placeholder="e.g. leak & burst-pipe repair, drain cleaning, boiler and radiator service, bathroom plumbing" />
            <p className="mt-1.5 text-[12px] text-[#8E8E92]">Your receptionist will only talk about what you list here.</p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Pricing</label>
              <input className={INPUT} value={pricing} onChange={(e) => setPricing(e.target.value)} placeholder="e.g. €60 call-out, €75 / hour" />
            </div>
            <div>
              <label className={LABEL}>Service area</label>
              <input className={INPUT} value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Oulu and 30 km around" />
            </div>
          </div>

          <div className="mt-4">
            <label className={LABEL}>Main language</label>
            <select className={INPUT} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
            <p className="mt-1.5 text-[12px] text-[#8E8E92]">It can handle other languages too — you can add them later.</p>
          </div>

          <div className="mt-5 rounded-xl bg-[#F6F7F9] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-[#161616]">Answer 24/7</div>
                <div className="text-[12.5px] text-[#8E8E92]">Picks up at any hour, even outside opening times.</div>
              </div>
              <Toggle checked={alwaysOpen} onChange={setAlwaysOpen} />
            </div>
            {!alwaysOpen && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#EDEEF1] pt-4">
                <span className="text-[13px] font-semibold text-[#2A2A2E]">Weekdays</span>
                <input type="time" className={`${INPUT} !w-[120px] !py-2`} value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className="text-[#8E8E92]">–</span>
                <input type="time" className={`${INPUT} !w-[120px] !py-2`} value={to} onChange={(e) => setTo(e.target.value)} />
                <label className="ml-auto flex items-center gap-2 text-[13px] font-semibold text-[#2A2A2E]">
                  <Toggle checked={openSat} onChange={setOpenSat} /> Open Saturdays
                </label>
              </div>
            )}
          </div>

          {error && phase === "form" && (
            <p className="mt-4 rounded-xl border border-[#F5D6C6] bg-[#FDEFE7] px-3 py-2 text-[13px] font-semibold text-[#B3541F]">{error}</p>
          )}

          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cobalt px-6 py-3 font-display text-[15px] font-bold text-white shadow-[0_10px_22px_rgba(47,107,255,0.28)] transition-opacity hover:opacity-95"
          >
            Continue to payment
          </button>
          <p className="mt-3 text-center text-[12px] text-[#9AA0AB]">Secure checkout by Stripe · you can change any of this later in Settings.</p>
        </form>
      </div>
    </div>
  );
}
