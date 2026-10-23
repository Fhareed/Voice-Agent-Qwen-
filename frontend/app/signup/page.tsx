"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/marketing/AuthShell";
import Icon from "@/components/Icon";
import { PillButton } from "@/components/marketing/ui";

const FIELD =
  "w-full rounded-[14px] border-2 border-ink bg-cream px-4 py-3 font-sans text-[15px] text-ink outline-none transition-shadow focus:shadow-hard-sm placeholder:text-ink/40";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", business: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Could not create your account.");
      if (data.needsConfirmation) {
        setConfirm(true);
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      variant="signup"
      title={<>Start answering <span className="text-cream">today.</span></>}
      subtitle="Create your account and Lumidesk is picking up your calls by tomorrow."
      bullets={["Never miss another call, day or night", "Jobs booked into your calendar", "Every lead captured and texted back"]}
    >
      {confirm ? (
        <div className="rounded-[18px] border-2 border-ink bg-mint p-7 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-ink bg-cream">
            <Icon name="i-mail" className="lu h-7 w-7 text-ink" />
          </div>
          <h2 className="mt-4 font-display text-[22px] font-bold text-ink">Check your email</h2>
          <p className="mt-2 font-sans text-[14px] text-ink/80">
            Your account is created. Confirm it from the email we just sent, then log in.
          </p>
          <div className="mt-5">
            <PillButton href="/login" variant="fill" className="w-full">Go to login</PillButton>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <h2 className="font-display text-[26px] font-bold text-ink">Create your account</h2>
          <p className="mt-1 mb-6 font-sans text-[14px] text-muted">Free to start. No card required.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Your name</label>
              <input className={FIELD} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" required />
            </div>
            <div>
              <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Business</label>
              <input className={FIELD} value={form.business} onChange={(e) => set("business", e.target.value)} placeholder="Business name" required />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Email</label>
            <input type="email" autoComplete="email" className={FIELD} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@business.com" required />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Password</label>
            <input type="password" autoComplete="new-password" className={FIELD} value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" minLength={8} required />
          </div>
          {error && <p className="mt-3 font-sans text-[13px] font-semibold text-flame">{error}</p>}
          <div className="mt-6">
            <PillButton type="submit" variant="fill" disabled={loading} className="w-full">
              {loading ? "Creating…" : "Create account"}
            </PillButton>
          </div>
          <p className="mt-3 text-center font-sans text-[12.5px] text-muted">Free to start. No card required. Cancel anytime.</p>
          <p className="mt-4 text-center font-sans text-[14px] text-muted">
            Already with us?{" "}
            <Link href="/login" className="font-bold text-ink underline underline-offset-2">Log in.</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
