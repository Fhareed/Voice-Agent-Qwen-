"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import type { SupportThread } from "@/lib/api";

const CARD =
  "rounded-2xl border border-[#E7E6EC] bg-white p-6 shadow-[0_10px_28px_rgba(23,23,23,0.05),0_2px_6px_rgba(23,23,23,0.03)]";
const INPUT =
  "w-full rounded-xl border border-[#E7E6EC] bg-white px-3.5 py-2.5 text-[14.5px] text-[#161616] outline-none transition-colors focus:border-cobalt placeholder:text-[#9AA0AB]";
const LABEL = "mb-1.5 block text-[12.5px] font-bold text-[#2A2A2E]";

function fmt(ts: string | null): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function ThreadCard({
  thread,
  onUpdated,
}: {
  thread: SupportThread;
  onUpdated: (t: SupportThread) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/${encodeURIComponent(thread.thread_id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send. Try again.");
        return;
      }
      setDraft("");
      if (data.thread) onUpdated(data.thread as SupportThread);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#EDEEF1] bg-[#FAFBFC] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {thread.subject && (
            <div className="text-[14px] font-bold text-[#161616]">{thread.subject}</div>
          )}
          <div className="mt-0.5 text-[11.5px] text-[#9AA0AB]">Started {fmt(thread.created_at)}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            thread.status === "replied"
              ? "bg-[#EAF8EF] text-[#1C7A43]"
              : "bg-[#FFF3DB] text-[#9A6A00]"
          }`}
        >
          {thread.status === "replied" ? "Replied" : "Open"}
        </span>
      </div>

      {/* Conversation */}
      <div className="mt-3 flex flex-col gap-2.5">
        {thread.messages.map((m) => {
          const isAdmin = m.sender === "admin";
          return (
            <div key={m.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  isAdmin
                    ? "border border-[#D9E4FF] bg-[#F2F6FF]"
                    : "border border-[#E7E6EC] bg-white"
                }`}
              >
                <div
                  className={`text-[10.5px] font-bold uppercase tracking-wide ${
                    isAdmin ? "text-cobalt" : "text-[#8E8E92]"
                  }`}
                >
                  {isAdmin ? "LumiDesk team" : "You"}
                </div>
                <div className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-[#2A2A2E]">
                  {m.body}
                </div>
                <div className="mt-0.5 text-[11px] text-[#9AA0AB]">{fmt(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply — always available, including after the team has replied */}
      <div className="mt-3 border-t border-[#EDEEF1] pt-3">
        <textarea
          className={`${INPUT} min-h-[60px] resize-y`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply to this conversation…"
        />
        {error && <p className="mt-1.5 text-[12px] font-semibold text-[#B3541F]">{error}</p>}
        <div className="mt-2">
          <button
            type="button"
            onClick={send}
            disabled={sending || !draft.trim()}
            className="rounded-full bg-cobalt px-5 py-2 font-display text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupportView({ orgName }: { orgName?: string | null }) {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/support", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      setThreads(data.threads ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startThread() {
    if (!message.trim()) {
      setError("Please write a message first.");
      return;
    }
    setSending(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not send your message. Try again.");
        return;
      }
      setSubject("");
      setMessage("");
      setSent(true);
      if (data.thread) setThreads((prev) => [data.thread as SupportThread, ...prev]);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSending(false);
    }
  }

  function onThreadUpdated(updated: SupportThread) {
    setThreads((prev) => {
      const rest = prev.filter((t) => t.thread_id !== updated.thread_id);
      return [updated, ...rest];
    });
  }

  return (
    <div className="panel">
      <Sidebar active="support" orgName={orgName} />
      <main className="content">
        <div className="mx-auto max-w-[760px] pb-28">
          <div className="mb-6">
            <h1 className="font-display text-[clamp(26px,3.4vw,34px)] font-bold tracking-[-0.02em] text-[#161616]">
              Support
            </h1>
            <p className="mt-1 text-[14px] text-[#6B6B70]">
              Message the LumiDesk team — a question, a bug, or anything you need. Replies show up
              right here, and you can keep the conversation going.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {/* New thread */}
            <section className={CARD}>
              <h2 className="font-display text-[18px] font-bold tracking-[-0.01em] text-[#161616]">
                New message
              </h2>
              <p className="mt-1 mb-5 text-[13.5px] text-[#6B6B70]">
                Tell us what&apos;s going on. The more detail, the faster we can help.
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className={LABEL}>Subject (optional)</label>
                  <input
                    className={INPUT}
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setSent(false);
                    }}
                    placeholder="e.g. Call forwarding isn't working"
                  />
                </div>
                <div>
                  <label className={LABEL}>Message</label>
                  <textarea
                    className={`${INPUT} min-h-[120px] resize-y`}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setSent(false);
                    }}
                    placeholder="Describe your question or the problem you're seeing…"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-[#F5D6C6] bg-[#FDEFE7] px-3 py-2 text-[13px] font-semibold text-[#B3541F]">
                    {error}
                  </p>
                )}
                {sent && (
                  <p className="rounded-xl border border-[#CDEBD6] bg-[#EAF8EF] px-3 py-2 text-[13px] font-semibold text-[#1C7A43]">
                    Sent — we&apos;ve got your message and will get back to you.
                  </p>
                )}

                <div>
                  <button
                    type="button"
                    onClick={startThread}
                    disabled={sending || !message.trim()}
                    className="rounded-full bg-cobalt px-6 py-2.5 font-display text-[14px] font-bold text-white transition-opacity disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send message"}
                  </button>
                </div>
              </div>
            </section>

            {/* Conversations */}
            <section className={CARD}>
              <h2 className="font-display text-[18px] font-bold tracking-[-0.01em] text-[#161616]">
                Your conversations
              </h2>
              <p className="mt-1 mb-5 text-[13.5px] text-[#6B6B70]">
                Everything you&apos;ve sent, and our replies. Reply any time to keep a thread going.
              </p>

              {loading ? (
                <p className="text-[13.5px] text-[#8E8E92]">Loading…</p>
              ) : loadError ? (
                <p className="rounded-xl border border-[#F5D6C6] bg-[#FDEFE7] px-3 py-2 text-[13px] font-semibold text-[#B3541F]">
                  Couldn&apos;t load your conversations just now. You can still start a new one above.
                </p>
              ) : threads.length === 0 ? (
                <p className="text-[13.5px] text-[#8E8E92]">
                  No conversations yet. Send us your first message above.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  {threads.map((t) => (
                    <ThreadCard key={t.thread_id} thread={t} onUpdated={onThreadUpdated} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
