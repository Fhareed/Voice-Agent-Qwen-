"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "./Icon";
import Sidebar from "./Sidebar";
import type { OutboundCampaign, OutboundCampaignSummary } from "@/lib/api";

type Msg = { type: "ok" | "err"; text: string } | null;

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#EDEEF1", fg: "#6B6B70", label: "Pending" },
  calling: { bg: "#DCEAFB", fg: "#1E4FA0", label: "Calling…" },
  completed: { bg: "#E4F6EC", fg: "#1E6B42", label: "Completed" },
  no_answer: { bg: "#FBF0CE", fg: "#7A5E12", label: "No answer" },
  failed: { bg: "#FDECEC", fg: "#B42318", label: "Failed" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        fontSize: 11.5,
        fontWeight: 700,
        borderRadius: 999,
        padding: "3px 10px",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
    >
      {s.label}
    </span>
  );
}

function parseTargets(raw: string): { name: string; phone: string }[] {
  const out: { name: string; phone: string }[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/[,\t]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) out.push({ name: parts[0], phone: parts.slice(1).join(" ") });
    else out.push({ name: "", phone: parts[0] });
  }
  return out.filter((t) => t.phone);
}

export default function OutboundView({
  campaigns: initial,
  orgName,
  loadError,
}: {
  campaigns: OutboundCampaignSummary[];
  orgName?: string | null;
  loadError?: boolean;
}) {
  const [campaigns, setCampaigns] = useState<OutboundCampaignSummary[]>(initial);
  const [sel, setSel] = useState<OutboundCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [script, setScript] = useState("");
  const [numbers, setNumbers] = useState("");

  const refreshList = useCallback(async () => {
    try {
      const r = await fetch("/api/outbound/campaigns", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && Array.isArray(d.campaigns)) setCampaigns(d.campaigns);
    } catch {
      /* ignore */
    }
  }, []);

  const openCampaign = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/outbound/campaigns/${id}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setSel(d as OutboundCampaign);
      else setMsg({ type: "err", text: d.error || "Couldn't open that campaign." });
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server." });
    }
  }, []);

  // Poll while the open campaign is running, so statuses update live.
  useEffect(() => {
    if (!sel || sel.status !== "running") return;
    const id = setInterval(() => {
      openCampaign(sel.id);
      refreshList();
    }, 4000);
    return () => clearInterval(id);
  }, [sel, openCampaign, refreshList]);

  async function createCampaign() {
    const targets = parseTargets(numbers);
    if (!name.trim()) {
      setMsg({ type: "err", text: "Give the campaign a name." });
      return;
    }
    if (!targets.length) {
      setMsg({ type: "err", text: "Add at least one phone number." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/outbound/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, goal, script, targets }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ type: "err", text: d.error || "Couldn't create it." });
        return;
      }
      setName("");
      setGoal("");
      setScript("");
      setNumbers("");
      setMsg({ type: "ok", text: `Campaign created — ${targets.length} number(s) ready to call.` });
      await refreshList();
      if (d.id) openCampaign(d.id);
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    if (!sel) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/outbound/campaigns/${sel.id}/launch`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ type: "err", text: d.error || "Couldn't launch it." });
        return;
      }
      setMsg({ type: "ok", text: `Launching ${d.launching ?? ""} call(s)…` });
      openCampaign(sel.id);
      refreshList();
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this campaign and its call results?")) return;
    try {
      const r = await fetch(`/api/outbound/campaigns/${id}`, { method: "DELETE" });
      if (r.ok) {
        if (sel?.id === id) setSel(null);
        refreshList();
      }
    } catch {
      /* ignore */
    }
  }

  const pendingCount = sel ? sel.targets.filter((t) => t.status === "pending").length : 0;

  return (
    <div className="panel">
      <Sidebar active="outbound" orgName={orgName} />
      <main className="content">
        <div className="top">
          <div className="greet">
            <h1>Outbound</h1>
            <div className="sub">
              Let LumiDesk make the calls. Create a campaign, drop in a list of numbers, and it rings
              each one — confirmations, follow-ups, lead qualification.
            </div>
          </div>
        </div>

        {loadError && (
          <div className="kbmsg err" style={{ marginBottom: 16 }}>
            Couldn’t load your campaigns. Refresh to try again.
          </div>
        )}

        <div className="kbgrid">
          <div className="kbmain">
            {/* New campaign */}
            <div className="kbcard">
              <h2 className="kbhead">New campaign</h2>
              <div className="kbform">
                <input
                  className="kbinput"
                  placeholder="Campaign name — e.g. March appointment reminders"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="kbinput"
                  placeholder="Goal — what's this call for? (context for the agent)"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
                <textarea
                  className="kbtext"
                  style={{ minHeight: 110 }}
                  placeholder="Script — what the agent should say / ask. e.g. 'Confirm their Tuesday 2pm appointment and ask if they need directions.'"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                />
                <textarea
                  className="kbtext"
                  style={{ minHeight: 110 }}
                  placeholder={"Numbers — one per line.\nName, +358401234567\n+358401234568"}
                  value={numbers}
                  onChange={(e) => setNumbers(e.target.value)}
                />
                <p className="kbhint">
                  One per line. Use “Name, +number” to greet them by name, or just the number (E.164,
                  e.g. +358…).
                </p>
                <button className="kbbtn" onClick={createCampaign} disabled={busy}>
                  {busy ? "Working…" : "Create campaign"}
                </button>
              </div>
              {msg && <div className={`kbmsg ${msg.type}`}>{msg.text}</div>}
            </div>

            {/* Selected campaign detail */}
            {sel && (
              <div className="kbcard" style={{ marginTop: 20 }}>
                <div className="kbknows-head">
                  <h3>{sel.name}</h3>
                  <button className="kbclear-btn" onClick={() => remove(sel.id)}>
                    Delete
                  </button>
                </div>
                <div className="kbhint" style={{ marginBottom: 12 }}>
                  {sel.goal || "No goal set."} · status: <b>{sel.status}</b>
                </div>
                {pendingCount > 0 && (
                  <button
                    className="kbbtn"
                    onClick={launch}
                    disabled={busy}
                    style={{ marginBottom: 14 }}
                  >
                    <Icon name="i-zap" />
                    {busy ? "Launching…" : `Launch ${pendingCount} call${pendingCount > 1 ? "s" : ""}`}
                  </button>
                )}
                <div className="kblist">
                  {sel.targets.map((t) => (
                    <div className="kbrow" key={t.id} style={{ alignItems: "flex-start" }}>
                      <div className="kbrow-ic">
                        <Icon name="i-phone" />
                      </div>
                      <div className="kbrow-t" style={{ flex: 1 }}>
                        <b>{t.name || t.phone}</b>
                        <span>
                          {t.name ? t.phone : ""}
                          {t.outcome ? `${t.name ? " — " : ""}${t.outcome}` : ""}
                        </span>
                      </div>
                      <StatusPill status={t.status} />
                    </div>
                  ))}
                  {!sel.targets.length && <div className="kbempty">No numbers in this campaign.</div>}
                </div>
              </div>
            )}
          </div>

          {/* Campaign list rail */}
          <div className="kbcard" style={{ alignSelf: "start" }}>
            <h3 className="kbhead">Campaigns</h3>
            <div className="kblist">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  className="kbrow"
                  onClick={() => openCampaign(c.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: sel?.id === c.id ? "var(--canvas)" : "none",
                    border: 0,
                    cursor: "pointer",
                    borderRadius: 10,
                  }}
                >
                  <div className="kbrow-ic">
                    <Icon name="i-zap" />
                  </div>
                  <div className="kbrow-t" style={{ flex: 1 }}>
                    <b>{c.name}</b>
                    <span>
                      {c.completed}/{c.total} done{c.failed ? ` · ${c.failed} failed` : ""} · {c.status}
                    </span>
                  </div>
                </button>
              ))}
              {!campaigns.length && (
                <div className="kbempty">No campaigns yet. Create one on the left.</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
