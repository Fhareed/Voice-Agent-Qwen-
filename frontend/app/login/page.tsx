"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/marketing/AuthShell";
import { PillButton } from "@/components/marketing/ui";

const FIELD =
  "w-full rounded-[14px] border-2 border-ink bg-cream px-4 py-3 font-sans text-[15px] text-ink outline-none transition-shadow focus:shadow-hard-sm placeholder:text-ink/40";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "org">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Login failed.");
      if (data.needOrg) setStep("org");
      else {
        router.replace("/app");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Could not create your workspace.");
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
      variant="login"
      title={<>Welcome <span className="text-sun">back.</span></>}
      subtitle="Log in to see your calls, bookings, and leads."
      bullets={["Every call, in one place", "Jobs booked while you work", "Never miss a lead again"]}
    >
      {step === "login" ? (
        <form onSubmit={submitLogin}>
          <h2 className="font-display text-[26px] font-bold text-ink">Log in</h2>
          <p className="mt-1 mb-6 font-sans text-[14px] text-muted">Welcome back to your dashboard.</p>
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Email</label>
          <input type="email" autoComplete="email" className={`${FIELD} mb-4`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" required />
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Password</label>
          <input type="password" autoComplete="current-password" className={`${FIELD} mb-4`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
          {error && <p className="mb-3 font-sans text-[13px] font-semibold text-flame">{error}</p>}
          <PillButton type="submit" variant="fill" disabled={loading} className="w-full">
            {loading ? "Logging in…" : "Log in"}
          </PillButton>
          <p className="mt-5 text-center font-sans text-[14px] text-muted">
            New to Lumidesk?{" "}
            <Link href="/signup" className="font-bold text-ink underline underline-offset-2">Create an account.</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={submitOrg}>
          <h2 className="font-display text-[26px] font-bold text-ink">Name your business</h2>
          <p className="mt-1 mb-6 font-sans text-[14px] text-muted">One more step — this is the workspace your calls live in.</p>
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Business name</label>
          <input type="text" className={`${FIELD} mb-4`} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. PriceVilla Plumbing" required />
          {error && <p className="mb-3 font-sans text-[13px] font-semibold text-flame">{error}</p>}
          <PillButton type="submit" variant="fill" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create workspace"}
          </PillButton>
        </form>
      )}
    </AuthShell>
  );
}
