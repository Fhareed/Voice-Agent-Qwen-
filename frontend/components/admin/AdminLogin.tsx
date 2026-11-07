"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Wordmark from "@/components/marketing/Wordmark";
import { PillButton } from "@/components/marketing/ui";

// The admin password gate. The customer is already signed in + on the email
// allowlist to reach this; this exchanges the shared admin password for a
// short-lived admin session (HttpOnly cookie, set by the proxy).
export default function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw) {
      setError("Enter the admin password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Admin login failed.");
        return;
      }
      router.replace("/app/admin/metrics");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 font-sans">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Wordmark className="text-[26px]" />
          <span className="rounded-full border-2 border-ink bg-sun px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            Admin
          </span>
        </div>

        <form
          onSubmit={submit}
          className="rounded-[22px] border-2 border-ink bg-paper p-7 shadow-hard"
        >
          <h1 className="font-display text-[22px] font-bold tracking-[-0.01em] text-ink">
            Admin sign-in
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Enter the admin password to open the console.
          </p>

          <label className="mt-5 mb-1.5 block font-display text-[12.5px] font-bold text-ink">
            Admin password
          </label>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(null);
            }}
            placeholder="••••••••"
            className="w-full rounded-xl border-2 border-ink bg-white px-3.5 py-2.5 font-sans text-[15px] text-ink outline-none transition-shadow focus:shadow-hard-sm"
          />

          {error && (
            <p className="mt-3 rounded-xl border-2 border-ink bg-rose/20 px-3 py-2 text-[13px] font-semibold text-ink">
              {error}
            </p>
          )}

          <div className="mt-5">
            <PillButton type="submit" variant="cobalt" icon={null} disabled={loading} className="w-full justify-center">
              {loading ? "Checking…" : "Enter admin"}
            </PillButton>
          </div>
        </form>

        <p className="mt-4 text-center text-[12.5px] text-muted">
          Not an admin?{" "}
          <a href="/app" className="font-semibold text-ink underline">
            Back to dashboard
          </a>
        </p>
      </div>
    </main>
  );
}
