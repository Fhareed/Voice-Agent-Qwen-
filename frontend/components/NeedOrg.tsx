"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown when a signed-in user has no organization yet.
export default function NeedOrg() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create your workspace.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#17181D] px-4">
      <div className="w-full max-w-[380px] bg-white rounded-[22px] p-7 shadow-[0_40px_90px_rgba(0,0,0,0.45)]">
        <form onSubmit={submit}>
          <h1 className="text-[20px] font-bold text-[#161616] tracking-tight">Name your business</h1>
          <p className="text-[13.5px] text-[#6B6B70] mt-1 mb-5">
            This is the workspace your calls and bookings live in.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-[#E7E6EC] text-[14px] text-[#161616] outline-none focus:border-[#2F6BFF] mb-4"
            placeholder="e.g. PriceVilla Plumbing"
            required
          />
          {error && <p className="text-[13px] text-[#C23B52] mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[#2F6BFF] text-white text-[14px] font-bold disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
