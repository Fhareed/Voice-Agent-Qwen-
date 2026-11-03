"use client";

import { useState, type CSSProperties } from "react";
import Icon from "./Icon";
import Sidebar from "./Sidebar";
import type { NumberRow } from "@/lib/api";

type Msg = { type: "ok" | "err"; text: string } | null;

type ProvisionResp = {
  ok?: true;
  phone_number?: string;
  reused?: boolean;
  error?: string;
};

type ImportResp = {
  ok?: true;
  phone_number?: string;
  error?: string;
};

type DeleteResp = {
  ok?: true;
  error?: string;
};

type ListResp = {
  numbers?: NumberRow[];
  error?: string;
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: "rgba(34,197,94,0.12)",
  color: "#16a34a",
  whiteSpace: "nowrap",
};

const removeBtnStyle: CSSProperties = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  color: "#ef4444",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: "4px 6px",
};

export default function NumberView({
  numbers,
  orgName,
  loadError,
}: {
  numbers: NumberRow[];
  orgName?: string | null;
  loadError?: boolean;
}) {
  const [list, setList] = useState<NumberRow[]>(numbers);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  // Import (SIP) form state
  const [impPhone, setImpPhone] = useState("");
  const [impUri, setImpUri] = useState("");
  const [impUser, setImpUser] = useState("");
  const [impPass, setImpPass] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/numbers");
      const data: ListResp = await res.json();
      if (!res.ok || data.error) {
        setMsg({ type: "err", text: data.error || "Couldn't load your numbers." });
        return;
      }
      setList(data.numbers ?? []);
    } catch {
      setMsg({ type: "err", text: "Network error while loading your numbers." });
    }
  }

  async function provision() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/numbers/provision", { method: "POST" });
      const data: ProvisionResp = await res.json();
      if (!res.ok || data.error || !data.phone_number) {
        setMsg({ type: "err", text: data.error || "Couldn't set up a number. Please try again." });
        return;
      }
      const reused = data.reused ? " (reused your existing number)" : "";
      setMsg({ type: "ok", text: `Your number is ${data.phone_number}.${reused}` });
      await refresh();
    } catch {
      setMsg({ type: "err", text: "Network error while setting up your number." });
    } finally {
      setBusy(false);
    }
  }

  async function importNumber() {
    if (busy) return;
    if (!impPhone.trim() || !impUri.trim()) {
      setMsg({ type: "err", text: "Phone number and SIP termination URI are required." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/numbers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: impPhone.trim(),
          termination_uri: impUri.trim(),
          sip_user: impUser.trim(),
          sip_pass: impPass,
        }),
      });
      const data: ImportResp = await res.json();
      if (!res.ok || data.error || !data.phone_number) {
        setMsg({ type: "err", text: data.error || "Couldn't import that number." });
        return;
      }
      setMsg({ type: "ok", text: `Imported ${data.phone_number}.` });
      setImpPhone("");
      setImpUri("");
      setImpUser("");
      setImpPass("");
      await refresh();
    } catch {
      setMsg({ type: "err", text: "Network error while importing your number." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(e164: string) {
    if (busy) return;
    if (!window.confirm(`Remove ${e164} from your dashboard? Your number won't be deleted.`)) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/numbers/${encodeURIComponent(e164)}?release=false`, {
        method: "DELETE",
      });
      const data: DeleteResp = await res.json();
      if (!res.ok || data.error) {
        setMsg({ type: "err", text: data.error || "Couldn't remove that number." });
        return;
      }
      setMsg({ type: "ok", text: `Removed ${e164}.` });
      await refresh();
    } catch {
      setMsg({ type: "err", text: "Network error while removing your number." });
    } finally {
      setBusy(false);
    }
  }

  const hasNumber = list.length > 0;

  return (
    <div className="panel">
      <Sidebar active="numbers" orgName={orgName} />
      <main className="content">
        <div className="top">
          <div className="greet">
            <h1>Phone number</h1>
            <div className="sub">
              Give your AI receptionist a number so it can start taking calls.
            </div>
          </div>
        </div>

        {loadError && (
          <div className="kbmsg err">
            <Icon name="i-x" />
            We couldn&apos;t load your number settings. Try refreshing the page.
          </div>
        )}

        {msg && (
          <div className={`kbmsg ${msg.type}`}>
            <Icon name={msg.type === "ok" ? "i-check-circle" : "i-x"} />
            {msg.text}
          </div>
        )}

        <div className="kbgrid">
          <div className="kbmain">
            <div className="kbcard">
              <div className="kbhead">
                <Icon name="i-phone" />
                Your number
              </div>

              {hasNumber ? (
                <>
                  <div className="kblist">
                    {list.map((n) => (
                      <div className="kbrow" key={n.phone_e164}>
                        <div className="kbrow-ic">
                          <Icon name="i-phone" />
                        </div>
                        <div className="kbrow-t">
                          <b>{n.phone_e164}</b>
                          <span>{n.label ?? "Active number"}</span>
                        </div>
                        <span style={pillStyle}>
                          <Icon name="i-check" />
                          Live
                        </span>
                        <button
                          type="button"
                          style={removeBtnStyle}
                          onClick={() => remove(n.phone_e164)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="kbhint">
                    Finnish and EU businesses usually keep their own number and forward it to
                    this one — your customers still dial your familiar local number. US
                    businesses can advertise this number directly.
                  </div>
                </>
              ) : (
                <div className="kbempty">
                  <Icon name="i-phone" />
                  No number yet — set one up on the right.
                </div>
              )}
            </div>
          </div>

          <div className="kbcard">
            <div className="kbhead">
              <Icon name="i-plus" />
              Set up your number
            </div>

            <button type="button" className="kbbtn" onClick={provision} disabled={busy}>
              <Icon name="i-phone" />
              {busy ? "Setting up…" : "Get my number"}
            </button>

            <div className="kbhint">
              US/Canada numbers are instant. Outside the US, keep your current number and
              forward it here.
            </div>

            <div className="kbtabs">
              <button
                type="button"
                className={advanced ? "on" : ""}
                onClick={() => setAdvanced((v) => !v)}
              >
                <Icon name="i-settings" />
                Advanced
              </button>
            </div>

            {advanced && (
              <form
                className="kbform"
                onSubmit={(e) => {
                  e.preventDefault();
                  importNumber();
                }}
              >
                <div className="kbhead">
                  <Icon name="i-wrench" />
                  Import your own number (SIP)
                </div>

                <input
                  className="kbinput"
                  type="tel"
                  placeholder="Phone number (E.164, e.g. +358…)"
                  value={impPhone}
                  onChange={(e) => setImpPhone(e.target.value)}
                  disabled={busy}
                />
                <input
                  className="kbinput"
                  type="text"
                  placeholder="SIP termination URI"
                  value={impUri}
                  onChange={(e) => setImpUri(e.target.value)}
                  disabled={busy}
                />
                <input
                  className="kbinput"
                  type="text"
                  placeholder="SIP username (optional)"
                  value={impUser}
                  onChange={(e) => setImpUser(e.target.value)}
                  disabled={busy}
                />
                <input
                  className="kbinput"
                  type="password"
                  placeholder="SIP password (optional)"
                  value={impPass}
                  onChange={(e) => setImpPass(e.target.value)}
                  disabled={busy}
                />

                <button type="submit" className="kbbtn" disabled={busy}>
                  <Icon name="i-arrow-ur" />
                  {busy ? "Importing…" : "Import number"}
                </button>

                <div className="kbhint">
                  For bringing a number from Twilio or your own carrier over SIP.
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
