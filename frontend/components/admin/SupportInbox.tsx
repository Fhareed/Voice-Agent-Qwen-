"use client";

import { useEffect, useState } from "react";
import type { SupportThread } from "@/lib/api";
import { CARD, fmtDate } from "./ui";

function SupportRow({ t, onUpdated }: { t: SupportThread; onUpdated: (thread: SupportThread) => void }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendReply() {
    if (!draft.trim()) {
      setError("Write a reply first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/support/${encodeURIComponent(t.thread_id)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send your reply.");
        return;
      }
      setDraft("");
      if (data.thread) onUpdated(data.thread as SupportThread);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSending(false);
    }
  }

  const replied = t.status === "replied";

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display text-[13.5px] font-bold text-ink">{t.email || "Unknown sender"}</div>
          {t.subject && <div className="mt-0.5 font-sans text-[12.5px] font-semibold text-ink/70">{t.subject}</div>}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full border-2 border-ink px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide ${
              replied ? "bg-mint/25 text-[#0E8F63]" : "bg-sun/40 text-ink"
            }`}
          >
            {replied ? "Replied" : "Open"}
          </span>
          <span className="font-sans text-[11.5px] text-muted">{fmtDate(t.updated_at)}</span>
        </div>
      </div>

      {/* full conversation */}
      <div className="mt-3 flex flex-col gap-2">
        {t.messages.map((msg) => {
          const isAdmin = msg.sender === "admin";
          return (
            <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl border-2 px-3 py-2 ${
                  isAdmin ? "border-cobalt/40 bg-cobalt/[0.07]" : "border-ink/10 bg-cream"
                }`}
              >
                <div className={`font-display text-[10px] font-bold uppercase tracking-wide ${isAdmin ? "text-cobalt" : "text-ink/50"}`}>
                  {isAdmin ? "You" : "Customer"}
                </div>
                <div className="mt-0.5 whitespace-pre-wrap break-words font-sans text-[13px] text-ink">{msg.body}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* reply — always available so the conversation can continue */}
      <div className="mt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply… the customer sees this on their Support page and can reply back."
          className="min-h-[64px] w-full resize-y rounded-xl border-2 border-ink/15 bg-white px-3 py-2 font-sans text-[13px] text-ink outline-none focus:border-ink"
        />
        {error && <p className="mt-1.5 font-sans text-[12px] font-semibold text-flame">{error}</p>}
        <div className="mt-2">
          <button
            type="button"
            onClick={sendReply}
            disabled={sending || !draft.trim()}
            className="rounded-full border-2 border-ink bg-cobalt px-4 py-1.5 font-display text-[12.5px] font-bold text-cream transition-all hover:shadow-[4px_5px_0_#111827] disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupportInbox() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/support", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(true);
        return;
      }
      setThreads(data.threads ?? []);
      setOpenCount(data.open_count ?? 0);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onUpdated(updated: SupportThread) {
    setThreads((prev) => prev.map((t) => (t.thread_id === updated.thread_id ? updated : t)));
    setOpenCount((prev) => Math.max(0, prev - 1));
  }

  const shown = onlyOpen ? threads.filter((t) => t.status !== "replied") : threads;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.03em] text-ink">
            Messages
            {openCount > 0 && (
              <span className="rounded-full border-2 border-ink bg-sun/50 px-2.5 py-0.5 font-display text-[13px] font-bold text-ink">
                {openCount} open
              </span>
            )}
          </h1>
          <p className="mt-1 font-sans text-[14px] text-muted">
            Conversations with customers. Your replies show on their Support page — and they can reply back.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 font-display text-[12.5px] font-bold text-ink/70">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="h-4 w-4 accent-[#2F6BFF]" />
            Open only
          </label>
          <button
            type="button"
            onClick={load}
            className="rounded-full border-2 border-ink/20 bg-white px-4 py-1.5 font-display text-[12.5px] font-bold text-ink transition-colors hover:border-ink"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="font-sans text-[13px] text-muted">Loading…</p>
      ) : error ? (
        <p className="rounded-xl border-2 border-ink bg-flame/10 px-3 py-2 font-sans text-[13px] font-semibold text-ink">
          Couldn&apos;t load messages just now. Is the backend running?
        </p>
      ) : shown.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-ink/30 bg-white px-6 py-14 text-center">
          <p className="font-display text-[16px] font-bold text-ink">
            {onlyOpen ? "No open conversations — you're all caught up." : "No conversations yet"}
          </p>
          <p className="mt-1 font-sans text-[13.5px] text-muted">Messages customers send from the app land here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {shown.map((t) => (
            <SupportRow key={t.thread_id} t={t} onUpdated={onUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
