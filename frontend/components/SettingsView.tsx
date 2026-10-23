"use client";

import { useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import Sidebar from "./Sidebar";
import type { Settings } from "@/lib/api";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];
const TIMEZONES = [
  "Europe/Helsinki", "Europe/Stockholm", "Europe/London", "Europe/Berlin",
  "UTC", "America/New_York", "America/Los_Angeles", "Asia/Dubai",
];
const INDUSTRIES = ["Plumbing & trades", "Electrical", "Salon & beauty", "Dental & clinic", "Restaurant", "Other"];
const LANGUAGES = ["English", "Finnish", "Swedish", "German", "Spanish", "French"];
const VOICES = ["Warm · female", "Professional · female", "Friendly · male", "Professional · male"];

type DayHours = { open: boolean; from: string; to: string };
interface Form {
  business_name: string;
  contact_email: string;
  timezone: string;
  industry: string;
  phone_number: string;
  always_open: boolean;
  hours: Record<string, DayHours>;
  default_language: string;
  voice: string;
  languages_note: string;
  notify_email: string;
  notify_leads: boolean;
  notify_bookings: boolean;
  daily_summary: boolean;
  plan: string;
}

function defaults(s: Settings, orgName?: string | null): Form {
  const g = <T,>(k: string, d: T): T => (s[k] === undefined || s[k] === null ? d : (s[k] as T));
  const hours: Record<string, DayHours> = {};
  const savedHours = (s.hours as Record<string, DayHours>) || {};
  for (const d of DAYS) {
    const h = savedHours[d.key] || {};
    hours[d.key] = {
      open: h.open ?? (d.key !== "sat" && d.key !== "sun"),
      from: h.from || "09:00",
      to: h.to || "17:00",
    };
  }
  return {
    business_name: g("business_name", orgName || ""),
    contact_email: g("contact_email", ""),
    timezone: g("timezone", "Europe/Helsinki"),
    industry: g("industry", "Plumbing & trades"),
    phone_number: g("phone_number", ""),
    always_open: g("always_open", true),
    hours,
    default_language: g("default_language", "English"),
    voice: g("voice", "Warm · female"),
    languages_note: g("languages_note", ""),
    notify_email: g("notify_email", ""),
    notify_leads: g("notify_leads", true),
    notify_bookings: g("notify_bookings", true),
    daily_summary: g("daily_summary", false),
    plan: g("plan", "Starter"),
  };
}

const CARD = "rounded-2xl border border-[#E7E6EC] bg-white p-6 shadow-[0_10px_28px_rgba(23,23,23,0.05),0_2px_6px_rgba(23,23,23,0.03)]";
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

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <h2 className="font-display text-[18px] font-bold tracking-[-0.01em] text-[#161616]">{title}</h2>
      <p className="mt-1 mb-5 text-[13.5px] text-[#6B6B70]">{desc}</p>
      {children}
    </section>
  );
}

export default function SettingsView({
  settings,
  orgName,
  loadError,
}: {
  settings: Settings;
  orgName?: string | null;
  loadError?: boolean;
}) {
  const initial = useMemo(() => defaults(settings, orgName), [settings, orgName]);
  const initialJson = useRef(JSON.stringify(initial));
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== initialJson.current;

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }
  function setDay(key: string, patch: Partial<DayHours>) {
    setForm((f) => ({ ...f, hours: { ...f.hours, [key]: { ...f.hours[key], ...patch } } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save. Try again.");
        return;
      }
      initialJson.current = JSON.stringify(form);
      setSaved(true);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <Sidebar active="settings" orgName={form.business_name || orgName} />
      <main className="content">
        <div className="mx-auto max-w-[760px] pb-28">
          <div className="mb-6">
            <h1 className="font-display text-[clamp(26px,3.4vw,34px)] font-bold tracking-[-0.02em] text-[#161616]">Settings</h1>
            <p className="mt-1 text-[14px] text-[#6B6B70]">
              Manage your business, hours, and how Lumidesk answers.
            </p>
            {loadError && (
              <p className="mt-3 rounded-xl border border-[#F5D6C6] bg-[#FDEFE7] px-3 py-2 text-[13px] font-semibold text-[#B3541F]">
                Couldn&apos;t load your saved settings just now — showing defaults. Saving will still work.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {/* Business profile */}
            <Section title="Business profile" desc="The basics about your business. The name shows on your dashboard.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Business name</label>
                  <input className={INPUT} value={form.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="e.g. PriceVilla Plumbing" />
                </div>
                <div>
                  <label className={LABEL}>Contact email</label>
                  <input type="email" className={INPUT} value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="you@business.com" />
                </div>
                <div>
                  <label className={LABEL}>Industry</label>
                  <select className={INPUT} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Timezone</label>
                  <select className={INPUT} value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                    {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            {/* Phone number */}
            <Section title="Your number" desc="The phone number customers call. Lumidesk answers everything that rings here.">
              <label className={LABEL}>Phone number</label>
              <input className={INPUT} value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)} placeholder="+358 …" />
              <p className="mt-2 text-[12.5px] text-[#8E8E92]">
                Don&apos;t have a number yet? Save your details and we&apos;ll provision one and set up forwarding for you.
              </p>
            </Section>

            {/* Hours */}
            <Section title="Business hours" desc="When you're open. Lumidesk uses this to answer “are you open?” and to book sensibly.">
              <div className="flex items-center justify-between rounded-xl bg-[#F6F7F9] px-4 py-3">
                <div>
                  <div className="text-[14px] font-bold text-[#161616]">Answer 24/7</div>
                  <div className="text-[12.5px] text-[#8E8E92]">Lumidesk picks up at any hour, even outside opening times.</div>
                </div>
                <Toggle checked={form.always_open} onChange={(v) => set("always_open", v)} />
              </div>

              {!form.always_open && (
                <div className="mt-4 flex flex-col divide-y divide-[#EDEEF1]">
                  {DAYS.map((d) => {
                    const h = form.hours[d.key];
                    return (
                      <div key={d.key} className="flex flex-wrap items-center gap-3 py-2.5">
                        <div className="flex w-[130px] items-center gap-2.5">
                          <Toggle checked={h.open} onChange={(v) => setDay(d.key, { open: v })} />
                          <span className="text-[13.5px] font-semibold text-[#2A2A2E]">{d.label}</span>
                        </div>
                        {h.open ? (
                          <div className="flex items-center gap-2">
                            <input type="time" className={`${INPUT} !w-[120px] !py-2`} value={h.from} onChange={(e) => setDay(d.key, { from: e.target.value })} />
                            <span className="text-[#8E8E92]">–</span>
                            <input type="time" className={`${INPUT} !w-[120px] !py-2`} value={h.to} onChange={(e) => setDay(d.key, { to: e.target.value })} />
                          </div>
                        ) : (
                          <span className="text-[13px] text-[#9AA0AB]">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Voice & language */}
            <Section title="Voice & language" desc="How Lumidesk sounds, and the languages it answers in.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Default language</label>
                  <select className={INPUT} value={form.default_language} onChange={(e) => set("default_language", e.target.value)}>
                    {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Voice</label>
                  <select className={INPUT} value={form.voice} onChange={(e) => set("voice", e.target.value)}>
                    {VOICES.map((v) => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className={LABEL}>Other languages to support</label>
                <input className={INPUT} value={form.languages_note} onChange={(e) => set("languages_note", e.target.value)} placeholder="e.g. also answer in Estonian and Russian" />
                <p className="mt-2 text-[12.5px] text-[#8E8E92]">Tell us which languages your customers use and we&apos;ll switch them on.</p>
              </div>
            </Section>

            {/* Notifications */}
            <Section title="Notifications" desc="Where Lumidesk sends you leads and bookings.">
              <label className={LABEL}>Notify email</label>
              <input type="email" className={INPUT} value={form.notify_email} onChange={(e) => set("notify_email", e.target.value)} placeholder="where to send alerts" />
              <div className="mt-4 flex flex-col divide-y divide-[#EDEEF1]">
                {[
                  { k: "notify_leads" as const, t: "New lead captured", d: "Email me when a caller leaves their details." },
                  { k: "notify_bookings" as const, t: "New booking made", d: "Email me when a job gets booked." },
                  { k: "daily_summary" as const, t: "Daily summary", d: "A once-a-day recap of calls and bookings." },
                ].map((row) => (
                  <div key={row.k} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-[14px] font-semibold text-[#161616]">{row.t}</div>
                      <div className="text-[12.5px] text-[#8E8E92]">{row.d}</div>
                    </div>
                    <Toggle checked={form[row.k]} onChange={(v) => set(row.k, v)} />
                  </div>
                ))}
              </div>
            </Section>

            {/* Plan */}
            <Section title="Plan" desc="Your current Lumidesk plan.">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F6F7F9] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-cobalt/10 text-cobalt">
                    <Icon name="i-sparkles" className="lu h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-display text-[16px] font-bold text-[#161616]">{form.plan}</div>
                    <div className="text-[12.5px] text-[#8E8E92]">Billed monthly · cancel anytime</div>
                  </div>
                </div>
                <a href="/#pricing" className="rounded-full border-2 border-[#161616] px-4 py-2 text-[13px] font-bold text-[#161616] transition-colors hover:bg-[#161616] hover:text-white">
                  Manage plan
                </a>
              </div>
            </Section>
          </div>
        </div>

        {/* sticky save bar */}
        {(dirty || saved) && (
          <div className="sticky bottom-0 z-10 -mx-[clamp(18px,3vw,32px)] mt-4 border-t border-[#E7E6EC] bg-white/85 px-[clamp(18px,3vw,32px)] py-3 backdrop-blur">
            <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#6B6B70]">
                {error ? <span className="text-[#B3541F]">{error}</span> : saved ? "All changes saved." : "You have unsaved changes."}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="inline-flex items-center gap-2 rounded-full bg-cobalt px-5 py-2.5 font-display text-[14px] font-bold text-white shadow-[0_8px_18px_rgba(47,107,255,0.26)] transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
