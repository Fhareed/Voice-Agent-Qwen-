"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import Sidebar from "./Sidebar";
import type { CalendarStatus } from "@/lib/api";

type Msg = { type: "ok" | "err"; text: string } | null;

export default function CalendarView({
  status,
  orgName,
  loadError,
}: {
  status: CalendarStatus;
  orgName?: string | null;
  loadError?: boolean;
}) {
  const router = useRouter();
  const [calId, setCalId] = useState(status.calendar_id || "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState(false);

  const email = status.service_account_email;

  function copyEmail() {
    if (!email) return;
    try {
      navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  async function connect() {
    if (!calId.trim()) {
      setMsg({ type: "err", text: "Enter your Calendar ID first." });
      return;
    }
    if (!consent) {
      setMsg({ type: "err", text: "Please tick the authorization box to continue." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar_id: calId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Couldn't connect." });
        return;
      }
      setMsg({ type: data.tested_ok ? "ok" : "err", text: data.message || "Saved." });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/calendar", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Couldn't disconnect." });
        return;
      }
      setCalId("");
      setConsent(false);
      setMsg({ type: "ok", text: "Calendar disconnected." });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <Sidebar active="calendar" orgName={orgName} />
      <main className="content">
        <div className="top">
          <div className="greet">
            <h1>Calendar sync</h1>
            <div className="sub">
              Connect your Google Calendar so every booking your receptionist makes lands straight
              on it — and it only offers callers times you&apos;re actually free.
            </div>
          </div>
        </div>

        <div className="kbgrid">
          <div className="kbmain">
            <div className="kbcard">
              <h2 className="kbhead">Connect your Google Calendar</h2>

              {!status.service_account_ready && (
                <div className="kbmsg err" style={{ marginTop: 0, marginBottom: 14 }}>
                  Calendar sync isn&apos;t set up on the server yet (the Google service account is
                  missing). Add it in the backend, then connect here.
                </div>
              )}

              <div className="calstep">
                <span className="calnum">1</span>
                <div style={{ flex: 1 }}>
                  <b>Share your calendar with this address</b>
                  <p className="kbhint">
                    In Google Calendar → Settings → your calendar → <i>Share with specific people</i>{" "}
                    → add this email and set <i>Make changes to events</i>.
                  </p>
                  <div className="calemail">
                    <span>{email || "— service account not configured —"}</span>
                    {email && (
                      <button className="calcopy" onClick={copyEmail}>
                        {copied ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="calstep">
                <span className="calnum">2</span>
                <div style={{ flex: 1 }}>
                  <b>Paste your Calendar ID</b>
                  <p className="kbhint">
                    Usually just your Gmail address (e.g. you@gmail.com). For another calendar, find
                    its ID in that calendar&apos;s settings.
                  </p>
                  <input
                    className="kbinput"
                    placeholder="you@gmail.com"
                    value={calId}
                    onChange={(e) => setCalId(e.target.value)}
                    style={{ width: "100%" }}
                  />
                  <label className="calconsent">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      I&apos;m authorized to connect this calendar on behalf of my business, and
                      agree it will be used to check availability and create bookings.
                    </span>
                  </label>
                  <button className="kbbtn" onClick={connect} disabled={busy}>
                    {busy ? "Connecting…" : status.connected ? "Reconnect & test" : "Connect & test"}
                  </button>
                </div>
              </div>

              {msg && <div className={`kbmsg ${msg.type}`}>{msg.text}</div>}
            </div>
          </div>

          <div className="rail-col">
            <div className="kbstatus">
              <span className="kbstatus-ic">
                <Icon name={status.connected ? "i-calendar-check" : "i-calendar"} />
              </span>
              <div>
                <b>{status.connected ? "Calendar connected" : "Not connected yet"}</b>
                <span>
                  {loadError
                    ? "Couldn't load status just now."
                    : status.connected
                      ? status.calendar_id
                      : "Bookings won't hit a calendar until you connect one."}
                </span>
              </div>
            </div>

            {status.connected && (
              <div className="wpanel">
                <h3>Connected calendar</h3>
                <div className="calrow">
                  <span className="calrow-l">Calendar</span>
                  <span className="calrow-v">{status.calendar_id}</span>
                </div>
                <button
                  className="kbclear-btn"
                  style={{ marginTop: 12 }}
                  onClick={disconnect}
                  disabled={busy}
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
