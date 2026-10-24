"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function WelcomeView({ sessionId }: { sessionId: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"confirming" | "done" | "error">("confirming");
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      if (!sessionId) {
        setError("Missing payment reference.");
        setPhase("error");
        return;
      }
      try {
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "We couldn't confirm your payment.");
          setPhase("error");
          return;
        }
        setPhase("done");
        setTimeout(() => {
          router.replace("/app");
          router.refresh();
        }, 1800);
      } catch {
        setError("Couldn't reach the server.");
        setPhase("error");
      }
    })();
  }, [sessionId, router]);

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        {phase === "confirming" && (
          <>
            <span className="mb-5 inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-[#E7E6EC] border-t-cobalt" />
            <h1 className="font-display text-[23px] font-bold text-[#161616]">Payment received — setting up your receptionist…</h1>
            <p className="mt-2 text-[14px] text-[#6B6B70]">Writing your script, creating your voice agent, and wiring up bookings. A few seconds.</p>
          </>
        )}
        {phase === "done" && (
          <>
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-mint/15 text-[28px]">🎉</span>
            <h1 className="font-display text-[26px] font-bold text-[#161616]">You&apos;re live!</h1>
            <p className="mt-2 text-[14.5px] text-[#6B6B70]">Your AI receptionist is ready. Taking you to your dashboard…</p>
          </>
        )}
        {phase === "error" && (
          <div className="rounded-2xl border border-[#E7E6EC] bg-white p-8 shadow-[0_10px_28px_rgba(23,23,23,0.06)]">
            <h1 className="font-display text-[22px] font-bold text-[#161616]">Almost there</h1>
            <p className="mt-2 text-[14px] text-[#6B6B70]">Your payment went through. We hit a snag finishing setup — nothing you did wrong, and we&apos;ll sort it shortly.</p>
            {error && <p className="mt-3 rounded-xl border border-[#F5D6C6] bg-[#FDEFE7] px-3 py-2 text-[13px] font-semibold text-[#B3541F]">{error}</p>}
            <button
              type="button"
              onClick={() => { router.replace("/app"); router.refresh(); }}
              className="mt-5 inline-block rounded-full bg-cobalt px-6 py-2.5 font-display text-[14px] font-bold text-white"
            >
              Go to my dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
