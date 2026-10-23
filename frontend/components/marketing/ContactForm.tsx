"use client";

import { useState } from "react";
import Icon from "../Icon";
import { PillButton } from "./ui";

export default function ContactForm() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", business: "", note: "" });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, kind: "book", page: "home" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't send right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-[14px] border-2 border-ink bg-cream px-4 py-3 font-sans text-[15px] text-ink outline-none transition-shadow focus:shadow-hard-sm placeholder:text-ink/40";

  if (sent) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[22px] border-[3px] border-ink bg-mint p-10 text-center shadow-hard">
        <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-ink bg-cream">
          <Icon name="i-check" className="lu h-8 w-8 text-ink" />
        </div>
        <h3 className="mt-5 font-display text-[26px] font-bold text-ink">Got it. Talk soon.</h3>
        <p className="mt-2 max-w-sm font-sans text-[15px] text-ink/80">
          We&apos;ll reply within one business day with the next step to get your phone answered.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] border-[3px] border-ink bg-paper p-6 shadow-hard md:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Name</label>
          <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" required />
        </div>
        <div>
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Business</label>
          <input className={field} value={form.business} onChange={(e) => set("business", e.target.value)} placeholder="Business name" />
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Email</label>
        <input type="email" className={field} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@business.com" required />
      </div>
      <div className="mt-4">
        <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">What do you need?</label>
        <textarea
          className={`${field} min-h-[120px] resize-y`}
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Tell us about your business and how many calls you miss…"
        />
      </div>
      {error && <p className="mt-3 font-sans text-[13px] font-semibold text-flame">{error}</p>}
      <div className="mt-6">
        <PillButton type="submit" variant="fill" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Sending…" : "Send message"}
        </PillButton>
      </div>
    </form>
  );
}
