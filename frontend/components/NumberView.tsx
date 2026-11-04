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

  // Release (not just unmap): actually tells Retell to let the number go, which is
  // what stops the recurring monthly charge. For a bought US/CA number that gives
  // the number back to Retell; for an imported number it disconnects the Retell
  // side while the underlying number stays with the customer's own carrier.
  async function release(e164: string, isUsCa: boolean) {
    if (busy) return;
    const warning = isUsCa
      ? `Release ${e164}? This gives the number back to Retell and stops its monthly charge. ` +
        `The number can't be recovered, and your AI line will stop taking calls on it.`
      : `Disconnect ${e164}? This removes it from your AI receptionist. Your number stays ` +
        `with your own carrier, but calls will no longer reach your AI line until you set it up again.`;
    if (!window.confirm(warning)) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/numbers/${encodeURIComponent(e164)}?release=true`, {
        method: "DELETE",
      });
      const data: DeleteResp = await res.json();
      if (!res.ok || data.error) {
        setMsg({ type: "err", text: data.error || "Couldn't release that number." });
        return;
      }
      setMsg({
        type: "ok",
        text: isUsCa
          ? `Released ${e164}. The monthly charge for it has stopped.`
          : `Disconnected ${e164} from your AI line.`,
      });
      await refresh();
    } catch {
      setMsg({ type: "err", text: "Network error while releasing your number." });
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
                    {list.map((n) => {
                      // +1 is the US/Canada dialling code. For an EU business a
                      // US/CA number is a forwarding target, not their local line.
                      const isUsCa = n.phone_e164.startsWith("+1");
                      return (
                        <div className="kbrow" key={n.phone_e164}>
                          <div className="kbrow-ic">
                            <Icon name="i-phone" />
                          </div>
                          <div className="kbrow-t">
                            <b>{n.phone_e164}</b>
                            <span>
                              {isUsCa
                                ? "US/Canada line — forward your local number here"
                                : (n.label ?? "Mapped number")}
                            </span>
                          </div>
                          {/* It's in this list, so it's mapped/routed to your org —
                              "Connected", not an overclaimed "Live". */}
                          <span style={pillStyle}>
                            <Icon name="i-check" />
                            Connected
                          </span>
                          <button
                            type="button"
                            className="kbrelease"
                            onClick={() => release(n.phone_e164, isUsCa)}
                            disabled={busy}
                            title={isUsCa ? "Release this number and stop its monthly charge" : "Disconnect this number from your AI line"}
                          >
                            <Icon name="i-x" />
                            {isUsCa ? "Release" : "Disconnect"}
                          </button>
                        </div>
                      );
                    })}
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

            {/* Primary, recommended for Finland/EU: keep your own number. */}
            <div className="kbhead">
              <Icon name="i-phone" />
              Keep your current number
            </div>

            <div className="kbhint">
              Recommended for most businesses, including Finland and the EU. Keep
              advertising your normal business number and forward it to your AI line
              below — callers still dial your familiar number, and the call rings
              straight through to your AI receptionist.
            </div>

            {/* Primary option 2: bring your own number over SIP. A clear disclosure
                button — obviously clickable, with a chevron that flips when open. */}
            <button
              type="button"
              className={`kbdisc${advanced ? " open" : ""}`}
              onClick={() => setAdvanced((v) => !v)}
              aria-expanded={advanced}
            >
              <Icon name="i-wrench" />
              Import your number (SIP / advanced)
              <Icon name="i-chevron-down" className="lu chev" />
            </button>

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
                  Bring your own number (Finland/EU, Twilio, or any carrier) in over
                  SIP/BYOC — it becomes your AI receptionist line directly, no
                  forwarding needed.
                </div>
              </form>
            )}

            {/* Secondary: buy a brand-new US/Canada number. */}
            <div className="kbhead" style={{ marginTop: 18 }}>
              <Icon name="i-globe" />
              Buy a new US/Canada number
            </div>

            <div className="kbhint">
              US/Canada only. Instant to set up. Elsewhere this won&apos;t be a local
              number your customers recognise — keep your own number instead (above).
            </div>

            <button
              type="button"
              className="kbbtn kbbtn-outline"
              onClick={provision}
              disabled={busy}
            >
              <Icon name="i-globe" />
              {busy ? "Setting up…" : "Buy a US/Canada number"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
