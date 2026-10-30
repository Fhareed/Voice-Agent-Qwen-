"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import Sidebar from "./Sidebar";
import type { KbStatus } from "@/lib/api";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const KIND: Record<string, { icon: string; label: string }> = {
  file: { icon: "i-book", label: "Document" },
  website: { icon: "i-globe", label: "Website" },
  text: { icon: "i-message", label: "Note" },
};

type Chunk = { text: string; source: string };

function when(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " h ago";
  if (s < 7 * 86400) return Math.floor(s / 86400) + " d ago";
  return d.getDate() + " " + MON[d.getMonth()];
}

type Tab = "text" | "website" | "file";
type Msg = { type: "ok" | "err"; text: string } | null;

export default function KnowledgeView({
  kb,
  orgName,
  loadError,
}: {
  kb: KbStatus;
  orgName?: string | null;
  loadError?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Review ("what's inside") modal
  const [reviewing, setReviewing] = useState(false);
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    if (!reviewing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewing(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [reviewing]);

  async function openReview() {
    setReviewing(true);
    setReviewErr(null);
    setChunks(null);
    try {
      const res = await fetch("/api/kb/chunks", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReviewErr(data.error || "Couldn't load the knowledge base.");
        return;
      }
      setChunks(Array.isArray(data.chunks) ? data.chunks : []);
    } catch {
      setReviewErr("Couldn't reach the server. Try again.");
    }
  }

  async function clearKb() {
    setClearing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/kb", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Couldn't clear it." });
        return;
      }
      setClearConfirm(false);
      setMsg({ type: "ok", text: "Knowledge base cleared." });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server. Try again." });
    } finally {
      setClearing(false);
    }
  }

  async function addText() {
    if (!text.trim()) {
      setMsg({ type: "err", text: "Add some text first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/kb/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Couldn't add that." });
        return;
      }
      setTitle("");
      setText("");
      setMsg({ type: "ok", text: `Added — ${data.chunks_added ?? 0} chunks indexed.` });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function addWebsite() {
    if (!url.trim()) {
      setMsg({ type: "err", text: "Enter a website address first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/kb/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Couldn't read that site." });
        return;
      }
      setUrl("");
      setMsg({ type: "ok", text: `Added — ${data.chunks ?? 0} chunks indexed.` });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function addFile() {
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setMsg({ type: "err", text: "Choose a file first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/kb/document", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Couldn't upload that." });
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      setMsg({
        type: "ok",
        text: `Uploaded ${data.filename || "file"} — ${data.chunks_added ?? 0} chunks indexed.`,
      });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const count = kb.sources.length;
  const canReview = kb.has_kb || count > 0;

  return (
    <div className="panel">
      <Sidebar active="knowledge" orgName={orgName} />
      <main className="content">
        <div className="top">
          <div className="greet">
            <h1>Knowledge base</h1>
            <div className="sub">
              What your receptionist knows. Add your services, prices, policies and FAQs so it
              answers callers correctly.
            </div>
          </div>
        </div>

        <div className="kbgrid">
          <div className="kbmain">
            <div className="kbcard">
              <h2 className="kbhead">Add knowledge</h2>
              <div className="kbtabs">
                <button className={tab === "text" ? "on" : ""} onClick={() => setTab("text")}>
                  <Icon name="i-message" />
                  Paste text
                </button>
                <button className={tab === "website" ? "on" : ""} onClick={() => setTab("website")}>
                  <Icon name="i-globe" />
                  Website
                </button>
                <button className={tab === "file" ? "on" : ""} onClick={() => setTab("file")}>
                  <Icon name="i-book" />
                  Upload file
                </button>
              </div>

              <div className="kbform">
                {tab === "text" && (
                  <>
                    <input
                      className="kbinput"
                      placeholder="Title (optional) — e.g. Pricing, Opening hours, FAQ"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <textarea
                      className="kbtext"
                      placeholder="Paste anything your receptionist should know — services, prices, policies, common questions and answers…"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <button className="kbbtn" onClick={addText} disabled={busy}>
                      {busy ? "Adding…" : "Add to knowledge base"}
                    </button>
                  </>
                )}

                {tab === "website" && (
                  <>
                    <input
                      className="kbinput"
                      placeholder="https://your-business.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <p className="kbhint">
                      We&apos;ll read the page and add it to what your receptionist knows.
                    </p>
                    <button className="kbbtn" onClick={addWebsite} disabled={busy}>
                      {busy ? "Reading…" : "Add website"}
                    </button>
                  </>
                )}

                {tab === "file" && (
                  <>
                    <div className="kbfiledrop">
                      <Icon name="i-book" />
                      <input
                        ref={fileRef}
                        type="file"
                        className="kbfile"
                        accept=".pdf,.txt,.md,.docx,.doc"
                      />
                      <p className="kbhint" style={{ marginTop: 8 }}>
                        PDF, Word, text or markdown.
                      </p>
                    </div>
                    <button className="kbbtn" onClick={addFile} disabled={busy}>
                      {busy ? "Uploading…" : "Upload document"}
                    </button>
                  </>
                )}
              </div>

              {msg && <div className={`kbmsg ${msg.type}`}>{msg.text}</div>}
            </div>
          </div>

          <div className="rail-col">
            <div className="kbstatus">
              <span className="kbstatus-ic">
                <Icon name="i-book" />
              </span>
              <div>
                <b>{kb.has_kb ? "Your knowledge base is live" : "No knowledge base yet"}</b>
                <span>
                  {loadError
                    ? "Couldn't load it just now — adding still works."
                    : count
                      ? `${count} source${count === 1 ? "" : "s"} added`
                      : "Add your first source — the receptionist uses this on calls."}
                </span>
              </div>
            </div>

            <div className="wpanel">
              <div className="kbknows-head">
                <h3>What your receptionist knows</h3>
                {canReview && !clearConfirm && (
                  <>
                    <button className="kbreview-btn" onClick={openReview}>
                      <Icon name="i-search" />
                      Review
                    </button>
                    <button className="kbclear-btn" onClick={() => setClearConfirm(true)}>
                      Clear
                    </button>
                  </>
                )}
                {clearConfirm && (
                  <span className="kbclear-confirm">
                    <span className="q">Clear all?</span>
                    <button className="yes" onClick={clearKb} disabled={clearing}>
                      {clearing ? "Clearing…" : "Yes"}
                    </button>
                    <button className="no" onClick={() => setClearConfirm(false)} disabled={clearing}>
                      No
                    </button>
                  </span>
                )}
              </div>
              {count === 0 ? (
                <div className="kbempty">Nothing added yet.</div>
              ) : (
                <div className="kblist">
                  {kb.sources.map((s, i) => {
                    const k = KIND[s.kind] || KIND.text;
                    const meta = [k.label, s.chunks ? `${s.chunks} chunks` : "", when(s.added_at)]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div className="kbrow" key={i}>
                        <span className="kbrow-ic">
                          <Icon name={k.icon} />
                        </span>
                        <div className="kbrow-t">
                          <b>{s.name}</b>
                          <span>{meta}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {reviewing && (
        <div className="kbrev-scrim" onClick={() => setReviewing(false)}>
          <div className="kbrev-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header className="kbrev-head">
              <div>
                <b>What your receptionist knows</b>
                <span>
                  {reviewErr
                    ? "—"
                    : chunks === null
                      ? "Loading…"
                      : `${chunks.length} passage${chunks.length === 1 ? "" : "s"} it can search`}
                </span>
              </div>
              <button className="kbrev-close" aria-label="Close" onClick={() => setReviewing(false)}>
                <Icon name="i-x" />
              </button>
            </header>
            <div className="kbrev-body">
              {reviewErr ? (
                <div className="kbrev-note err">{reviewErr}</div>
              ) : chunks === null ? (
                <div className="kbrev-note">Loading your knowledge base…</div>
              ) : chunks.length === 0 ? (
                <div className="kbrev-note">Nothing indexed yet.</div>
              ) : (
                chunks.map((c, i) => (
                  <div className="kbrev-chunk" key={i}>
                    {c.source && <span className="kbrev-src">{c.source}</span>}
                    <p>{c.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
