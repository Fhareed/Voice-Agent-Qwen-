"use client";

import Link from "next/link";
import { useState } from "react";
import AuthShell from "@/components/marketing/AuthShell";
import { PillButton } from "@/components/marketing/ui";

const FIELD =
  "w-full rounded-[14px] border-2 border-ink bg-cream px-4 py-3 font-sans text-[15px] text-ink outline-none transition-shadow focus:shadow-hard-sm placeholder:text-ink/40";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      variant="login"
      title={<>Reset your <span className="text-sun">password.</span></>}
      subtitle="We'll email you a link to set a new one."
      bullets={["Every call, in one place", "Jobs booked while you work", "Never miss a lead again"]}
    >
      {sent ? (
        <div>
          <h2 className="font-display text-[26px] font-bold text-ink">Check your email</h2>
          <p className="mt-2 font-sans text-[14px] text-muted">
            If an account exists for <b className="text-ink">{email}</b>, we&apos;ve sent a link to reset
            your password. It expires shortly.
          </p>
          <p className="mt-6 text-center font-sans text-[14px] text-muted">
            <Link href="/login" className="font-bold text-ink underline underline-offset-2">Back to log in</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <h2 className="font-display text-[26px] font-bold text-ink">Forgot password</h2>
          <p className="mt-1 mb-6 font-sans text-[14px] text-muted">Enter your email and we&apos;ll send a reset link.</p>
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Email</label>
          <input
            type="email"
            autoComplete="email"
            className={`${FIELD} mb-4`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            required
          />
          {error && <p className="mb-3 font-sans text-[13px] font-semibold text-flame">{error}</p>}
          <PillButton type="submit" variant="fill" disabled={loading} className="w-full">
            {loading ? "Sending…" : "Send reset link"}
          </PillButton>
          <p className="mt-5 text-center font-sans text-[14px] text-muted">
            <Link href="/login" className="font-bold text-ink underline underline-offset-2">Back to log in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
