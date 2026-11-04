"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AuthShell from "@/components/marketing/AuthShell";
import { PillButton } from "@/components/marketing/ui";

const FIELD =
  "w-full rounded-[14px] border-2 border-ink bg-cream px-4 py-3 font-sans text-[15px] text-ink outline-none transition-shadow focus:shadow-hard-sm placeholder:text-ink/40";

export default function ResetPage() {
  // undefined = still reading the URL; null = no token in URL; string = ready
  const [accessToken, setAccessToken] = useState<string | null | undefined>(undefined);
  const [linkExpired, setLinkExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase's default recovery link returns the session in the URL fragment,
    // e.g. /reset#access_token=...&type=recovery — readable here, client-side.
    try {
      const raw = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const h = new URLSearchParams(raw);
      const at = h.get("access_token");
      if (at) {
        setAccessToken(at);
        return;
      }
      // An expired or already-used link comes back as
      // #error=access_denied&error_description=...+expired (no access_token).
      if (h.get("error") || h.get("error_description")) {
        setLinkExpired(true);
      }
      setAccessToken(null);
    } catch {
      setAccessToken(null);
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "Couldn't reset your password.");
      else setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      variant="login"
      title={<>Set a new <span className="text-sun">password.</span></>}
      subtitle="Almost done — choose a new password."
    >
      {done ? (
        <div>
          <h2 className="font-display text-[26px] font-bold text-ink">Password updated</h2>
          <p className="mt-2 font-sans text-[14px] text-muted">You can now log in with your new password.</p>
          <div className="mt-6">
            <PillButton href="/login" variant="fill" className="w-full">Go to log in</PillButton>
          </div>
        </div>
      ) : accessToken === undefined ? (
        <p className="font-sans text-[14px] text-muted">Loading…</p>
      ) : accessToken === null ? (
        <div>
          <h2 className="font-display text-[26px] font-bold text-ink">
            {linkExpired ? "Link expired" : "Reset password"}
          </h2>
          <p className="mt-2 font-sans text-[14px] text-muted">
            {linkExpired
              ? "This reset link has expired — request a new one."
              : "Open this page from the reset link in your email."}{" "}
            <Link href="/forgot" className="font-bold text-ink underline underline-offset-2">Request a new link.</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <h2 className="font-display text-[26px] font-bold text-ink">New password</h2>
          <p className="mt-1 mb-6 font-sans text-[14px] text-muted">Choose a password you&apos;ll remember.</p>
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            className={`${FIELD} mb-4`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <label className="mb-1.5 block font-display text-[13px] font-bold text-ink">Confirm password</label>
          <input
            type="password"
            autoComplete="new-password"
            className={`${FIELD} mb-4`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <p className="mb-3 font-sans text-[13px] font-semibold text-flame">{error}</p>}
          <PillButton type="submit" variant="fill" disabled={loading} className="w-full">
            {loading ? "Saving…" : "Set new password"}
          </PillButton>
        </form>
      )}
    </AuthShell>
  );
}
