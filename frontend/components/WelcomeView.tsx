"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SetupStatus } from "@/lib/api";

type Phase = "confirming" | "checking" | "live" | "needNumber" | "finishing" | "error";

export default function WelcomeView({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("confirming");
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const ran = useRef(false);

  function branch(s: SetupStatus) {
    if (s.ready) {
      setPhase("live");
      setTimeout(() => {
        router.replace("/app");
        router.refresh();
      }, 1800);
    } else if (s.has_agent && !s.has_number) {
      setPhase("needNumber");
    } else {
      setPhase("finishing");
    }
  }

  async function refreshStatus() {
    setPhase("checking");
    try {
      const res = await fetch("/api/setup/status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "We couldn't check your setup.");
        setPhase("error");
        return;
      }
      branch(data as SetupStatus);
    } catch {
      setError("Couldn't reach the server.");
      setPhase("error");
    }
  }

  async function retrySetup() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch("/api/onboarding/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRetryError(data.error || "Setup didn't finish. We'll keep trying.");
        return;
      }
      // Provisioned — re-check and re-branch on the fresh status.
      await refreshStatus();
    } catch {
      setRetryError("Couldn't reach the server.");
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      // Confirm the payment first when we came back from Stripe (best effort —
      // the setup status below is the source of truth for what to show).
      if (sessionId) {
        try {
          await fetch("/api/billing/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
        } catch {
          // ignore — fall through to the status check
        }
      }
      await refreshStatus();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        {(phase === "confirming" || phase === "checking") && (
          <>
            <span className="mb-5 inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-[#E7E6EC] border-t-cobalt" />
            <h1 className="font-display text-[23px] font-bold text-[#161616]">Payment received — setting up your receptionist…</h1>
            <p className="mt-2 text-[14px] text-[#6B6B70]">Writing your script, creating your voice agent, and wiring up bookings. A few seconds.</p>
          </>
        )}

        {phase === "live" && (
          <>
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-mint/15 text-[28px]">🎉</span>
            <h1 className="font-display text-[26px] font-bold text-[#161616]">You&apos;re live!</h1>
            <p className="mt-2 text-[14.5px] text-[#6B6B70]">Your AI receptionist is ready. Taking you to your dashboard…</p>
          </>
        )}

        {phase === "needNumber" && (
          <div className="rounded-2xl border border-[#E7E6EC] bg-white p-8 shadow-[0_10px_28px_rgba(23,23,23,0.06)]">
            <h1 className="font-display text-[22px] font-bold text-[#161616]">You&apos;re almost live</h1>
            <p className="mt-2 text-[14px] text-[#6B6B70]">Your receptionist is built and ready. It just needs a phone number so your callers can reach it.</p>
            <a
              href="/app/numbers"
              className="mt-5 inline-block rounded-full bg-cobalt px-6 py-2.5 font-display text-[14px] font-bold text-white"
            >
              Set up your phone number
            </a>
          </div>
        )}

        {phase === "finishing" && (
          <div className="rounded-2xl border border-[#E7E6EC] bg-white p-8 shadow-[0_10px_28px_rgba(23,23,23,0.06)]">
            <h1 className="font-display text-[22px] font-bold text-[#161616]">Finishing your setup</h1>
            <p className="mt-2 text-[14px] text-[#6B6B70]">
              {retryError
                ? "Your payment went through. We hit a snag finishing setup — nothing you did wrong, and we'll sort it shortly. You can try again below."
                : "We're putting the last pieces of your receptionist together. If this is taking a while, give it another try."}
            </p>
            {retryError && (
              <p className="mt-3 rounded-xl border border-[#F5D6C6] bg-[#FDEFE7] px-3 py-2 text-[13px] font-semibold text-[#B3541F]">{retryError}</p>
            )}
            <button
              type="button"
              onClick={retrySetup}
              disabled={retrying}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-cobalt px-6 py-2.5 font-display text-[14px] font-bold text-white disabled:opacity-60"
            >
              {retrying && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {retrying ? "Retrying…" : "Retry setup"}
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="rounded-2xl border border-[#E7E6EC] bg-white p-8 shadow-[0_10px_28px_rgba(23,23,23,0.06)]">
            <h1 className="font-display text-[22px] font-bold text-[#161616]">Almost there</h1>
            <p className="mt-2 text-[14px] text-[#6B6B70]">Your payment went through. We hit a snag finishing setup — nothing you did wrong, and we&apos;ll sort it shortly.</p>
            {error && <p className="mt-3 rounded-xl border border-[#F5D6C6] bg-[#FDEFE7] px-3 py-2 text-[13px] font-semibold text-[#B3541F]">{error}</p>}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={refreshStatus}
                className="inline-block rounded-full border border-[#E7E6EC] bg-white px-6 py-2.5 font-display text-[14px] font-bold text-[#161616]"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => { router.replace("/app"); router.refresh(); }}
                className="inline-block rounded-full bg-cobalt px-6 py-2.5 font-display text-[14px] font-bold text-white"
              >
                Go to my dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
