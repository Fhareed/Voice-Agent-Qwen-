"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import type { Call } from "@/lib/types";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function initials(n?: string | null) {
  if (!n || /^[+\d]/.test(n)) return null;
  const p = String(n).replace(/[—–-]/g, " ").split(/\s+/).filter(Boolean);
  const r = ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
  return r || null;
}
function dur(sec?: number | null) {
  if (sec == null) return null;
  sec = Math.round(sec);
  const mi = Math.floor(sec / 60);
  const se = sec % 60;
  return mi + "m " + (se < 10 ? "0" : "") + se + "s";
}
function langLabel(l?: string | null) {
  if (!l) return null;
  const s = l.toLowerCase();
  const mp: Record<string, string> = { fi: "Finnish", en: "English", sv: "Swedish" };
  return mp[s] || l.charAt(0).toUpperCase() + l.slice(1);
}
function fullWhen(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const h = d.getHours();
  const am = h < 12 ? "AM" : "PM";
  const hr = h % 12 || 12;
  const min = d.getMinutes();
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} · ${hr}:${min < 10 ? "0" : ""}${min} ${am}`;
}

type Turn = { who: "caller" | "assistant"; text: string };
function parseTranscript(t?: string | null): Turn[] {
  if (!t) return [];
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const turns: Turn[] = [];
  const head = /^(Caller|Customer|User|Human|Assistant|Agent|AI|Bot)\s*:\s*(.*)$/i;
  for (const line of lines) {
    const m = head.exec(line);
    if (m) {
      const who = /^(assistant|agent|ai|bot)$/i.test(m[1]) ? "assistant" : "caller";
      turns.push({ who, text: m[2] });
    } else if (turns.length) {
      turns[turns.length - 1].text += " " + line;
    } else {
      turns.push({ who: "caller", text: line });
    }
  }
  return turns.filter((t) => t.text.trim());
}

export default function CallDetail({
  call,
  onClose,
  onStatusChange,
  onDelete,
  busy,
  error,
}: {
  call: Call;
  onClose: () => void;
  onStatusChange: (next: "resolved" | "unresolved") => void;
  onDelete: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const resolved = call.status === "resolved";
  const name = call.caller_name || call.caller_phone || "Unknown caller";
  const ini = initials(call.caller_name);
  const turns = useMemo(() => parseTranscript(call.transcript), [call.transcript]);

  const meta: { icon: string; text: string }[] = [];
  const w = fullWhen(call.started_at || call.created_at);
  if (w) meta.push({ icon: "i-calendar", text: w });
  const dr = dur(call.duration_sec);
  if (dr) meta.push({ icon: "i-clock", text: dr });
  const lg = langLabel(call.language);
  if (lg) meta.push({ icon: "i-globe", text: lg });
  meta.push({ icon: "i-phone", text: (call.direction || "inbound") === "outbound" ? "Outbound" : "Inbound" });

  const tel = call.caller_phone ? call.caller_phone.replace(/\s+/g, "") : "";

  return (
    <div className="cdscrim" onClick={onClose}>
      <div className="cdmodal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="cdhead">
          <div className="cdwho">
            {ini ? (
              <span className="ava cdava">{ini}</span>
            ) : (
              <span className="ava cdava unknown"><Icon name="i-user" style={{ width: 20, height: 20 }} /></span>
            )}
            <div className="cdwho-t">
              <div className="cdname">{name}</div>
              <div className="cdphone">{call.caller_phone || "No number on file"}</div>
            </div>
          </div>
          <span className={`cdpill ${resolved ? "is-resolved" : "is-open"}`}>
            {resolved ? "Resolved" : "Unresolved"}
          </span>
          <button className="cdclose" onClick={onClose} aria-label="Close"><Icon name="i-x" /></button>
        </header>

        <div className="cdmeta">
          {meta.map((m, i) => (
            <span key={i}><Icon name={m.icon} />{m.text}</span>
          ))}
        </div>

        <div className="cdscroll">
          {call.summary && (
            <div className="cdsummary">
              <h4>Summary</h4>
              <p>{call.summary}</p>
            </div>
          )}
          {call.is_booking && call.booking_details && (
            <div className="cdbooking">
              <span className="cdbk-ic"><Icon name="i-calendar-check" /></span>
              <div>
                <div className="cdbk-l">Booked on this call</div>
                <div className="cdbk-v">{call.booking_details}</div>
              </div>
            </div>
          )}
          <h4 className="cdth">Transcript</h4>
          {turns.length === 0 ? (
            <div className="cdempty">No transcript was captured for this call.</div>
          ) : (
            <div className="cdchat">
              {turns.map((t, i) => (
                <div key={i} className={`cdturn ${t.who}`}>
                  <span className="cdrole">{t.who === "assistant" ? "Lumidesk" : "Caller"}</span>
                  <div className="cdbubble">{t.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="cderror">{error}</div>}

        <footer className="cdacts">
          <button
            className={`cdbtn ${resolved ? "cdghost" : "cdprimary"}`}
            onClick={() => onStatusChange(resolved ? "unresolved" : "resolved")}
            disabled={busy}
          >
            <Icon name="i-check-circle" />
            {resolved ? "Mark unresolved" : "Mark resolved"}
          </button>
          {tel ? (
            <a className="cdbtn cdghost" href={`tel:${tel}`}><Icon name="i-phone" />Call back</a>
          ) : null}
          <span className="cdspacer" />
          {confirmDelete ? (
            <span className="cdconfirm">
              <span className="cdconfirm-q">Delete?</span>
              <button className="cdbtn cddanger" onClick={onDelete} disabled={busy}>
                {busy ? "Deleting…" : "Yes, delete"}
              </button>
              <button className="cdbtn cdghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
            </span>
          ) : (
            <button className="cdbtn cddelete" onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete call">
              <Icon name="i-x" />Delete
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
