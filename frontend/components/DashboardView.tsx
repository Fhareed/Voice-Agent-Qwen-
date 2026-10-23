"use client";

import { useEffect, useMemo, useRef } from "react";
import Icon from "./Icon";
import Sidebar from "./Sidebar";
import type { Booking, Call } from "@/lib/types";

const AV = ["#64748B", "#3F8F86", "#A9795A", "#7E6A99", "#B5697A", "#4E79B8", "#5B6CB0"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const URG = /urgent|emergency|burst|flood|no hot water|same.?day|leak|gas/i;

type Kind = "booked" | "urgent" | "new" | "follow" | "resolved";
const PILL: Record<Kind, { cls: string; label: string; tag: JSX.Element }> = {
  booked: { cls: "c-booked", label: "Booked", tag: <><Icon name="i-calendar-check" />Booked</> },
  urgent: { cls: "c-urgent", label: "Urgent", tag: <>Needs a slot</> },
  new: { cls: "c-new", label: "New", tag: <>Callback</> },
  follow: { cls: "c-follow", label: "Follow-up", tag: <>Call back</> },
  resolved: { cls: "c-resolved", label: "Resolved", tag: <>Closed</> },
};

function initials(n?: string | null) {
  if (!n || /^[+\d]/.test(n)) return null;
  const p = String(n).replace(/[—–-]/g, " ").split(/\s+/).filter(Boolean);
  const r = ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
  return r || null;
}
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
function dur(sec?: number | null) {
  if (sec == null) return "";
  sec = Math.round(sec);
  const mi = Math.floor(sec / 60);
  const se = sec % 60;
  return mi + "m " + (se < 10 ? "0" : "") + se + "s";
}
function lang(l?: string | null) {
  if (!l) return "";
  const s = l.toLowerCase();
  const mp: Record<string, string> = { finnish: "FI", fi: "FI", english: "EN", en: "EN", swedish: "SV", sv: "SV" };
  return mp[s] || s.slice(0, 2).toUpperCase();
}
function isToday(iso?: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function classify(c: Call): Kind {
  if (c.status === "resolved") return "resolved";
  if (c.is_booking) return "booked";
  const hay = `${c.summary ?? ""} ${c.intent ?? ""} ${c.transcript ?? ""}`.toLowerCase();
  if (URG.test(hay)) return "urgent";
  return initials(c.caller_name) ? "follow" : "new";
}

const SEG: [number, number, number, number][] = [
  [44.2, 94.8, 24.3, 93.0], [46.0, 84.5, 26.7, 79.3], [49.6, 74.6, 31.5, 66.2], [54.9, 65.6, 38.5, 54.1],
  [61.6, 57.6, 47.4, 43.4], [69.6, 50.9, 58.1, 34.5], [78.6, 45.6, 70.2, 27.5], [88.5, 42.0, 83.3, 22.7],
  [98.8, 40.2, 97.0, 20.3], [109.2, 40.2, 111.0, 20.3], [119.5, 42.0, 124.7, 22.7], [129.4, 45.6, 137.8, 27.5],
  [138.4, 50.9, 149.9, 34.5], [146.4, 57.6, 160.6, 43.4], [153.1, 65.6, 169.5, 54.1], [158.4, 74.6, 176.5, 66.2],
  [162.0, 84.5, 181.3, 79.3], [163.8, 94.8, 183.7, 93.0],
];
const ACT = ["#A3AF72", "#AEBEEC", "#EBD57B", "#EC9BCF"];
const INACT = "#E6DEC9";

function sparkBars(items: Array<{ date?: string | null }>, days = 9) {
  const counts: number[] = [];
  let max = 1;
  for (let k = days - 1; k >= 0; k--) {
    const d0 = new Date();
    d0.setHours(0, 0, 0, 0);
    d0.setDate(d0.getDate() - k);
    const d1 = new Date(d0);
    d1.setDate(d1.getDate() + 1);
    const c = items.filter((it) => {
      const t = it.date ? new Date(it.date) : null;
      return t && t >= d0 && t < d1;
    }).length;
    counts.push(c);
    if (c > max) max = c;
  }
  return counts.map((c) => Math.max(8, Math.round((c / max) * 100)));
}

export default function DashboardView({
  calls,
  bookings,
  orgName,
  loadError,
}: {
  calls: Call[];
  bookings: Booking[];
  orgName?: string | null;
  loadError?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const d = useMemo(() => {
    const now = new Date();
    const h = now.getHours();
    const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const greet = part + (orgName ? `, ${orgName}` : "");
    const datePill = "Today · " + now.getDate() + " " + MON[now.getMonth()];

    const newToday = calls.filter((c) => isToday(c.created_at) && c.status !== "resolved").length;
    const bookedToday = bookings.filter((b) => isToday(b.start_ts)).length;
    const callsToday = calls.filter((c) => isToday(c.created_at)).length;

    const sub =
      calls.length === 0
        ? null
        : { newToday, bookedToday };

    // Live banner
    const liveC = calls.find((c) => c.started_at && !c.ended_at && Date.now() - new Date(c.started_at).getTime() < 10 * 60000);
    let live: { name: string; snip: string; timer: string } | null = null;
    if (liveC) {
      const sec = Math.max(0, Math.floor((Date.now() - new Date(liveC.started_at as string).getTime()) / 1000));
      live = {
        name: "On a call now — " + (liveC.caller_name || liveC.caller_phone || "caller"),
        snip: liveC.summary || liveC.intent || "In progress…",
        timer: Math.floor(sec / 60) + ":" + ((sec % 60) < 10 ? "0" : "") + (sec % 60),
      };
    }

    const cards = calls.slice(0, 8).map((c, idx) => {
      const k = classify(c);
      const name = c.caller_name || c.caller_phone || "Unknown caller";
      const snip =
        c.summary ||
        ((c.transcript || "").split("\n").filter(Boolean)[0] || "").replace(/^(Caller|Assistant):\s*/, "") ||
        "No summary yet.";
      const meta = [when(c.created_at), dur(c.duration_sec), lang(c.language)].filter(Boolean).join(" · ");
      const ini = initials(c.caller_name);
      return { k, name, snip, meta, ini, color: AV[idx % AV.length] };
    });

    const unresolved = calls.filter((c) => c.status !== "resolved");
    const followers = unresolved.filter((c) => !c.is_booking);
    const tabs = {
      all: calls.length,
      unres: unresolved.length,
      booked: calls.filter((c) => c.is_booking).length,
      follow: followers.length,
    };

    // Gauge
    const todayCalls = calls.filter((c) => isToday(c.created_at));
    const handled = todayCalls.filter((c) => c.is_booking || c.status === "resolved").length;
    const pct = todayCalls.length ? Math.round((handled / todayCalls.length) * 100) : null;
    const lit = pct == null ? 0 : Math.round((pct / 100) * SEG.length);
    const gaugeFoot = todayCalls.length
      ? handled + " of " + todayCalls.length + " calls booked or resolved"
      : "No calls yet today";

    // Needs follow-up
    const follow = followers.slice(0, 5).map((c, idx) => {
      const name = c.caller_name || c.caller_phone || "Unknown caller";
      let s = c.intent || c.summary || "Needs a callback";
      if (s.length > 34) s = s.slice(0, 33) + "…";
      return { name, sub: s, ini: initials(c.caller_name), phone: c.caller_phone, color: AV[idx % AV.length] };
    });

    // This week rings
    const ws = mondayOf(new Date());
    const callsWk = calls.filter((c) => c.created_at && new Date(c.created_at) >= ws).length;
    const bookWk = bookings.filter((b) => b.start_ts && new Date(b.start_ts) >= ws).length;
    const C = 2 * Math.PI * 19;
    const bookFrac = callsWk ? Math.min(1, bookWk / callsWk) : bookWk ? 1 : 0;

    const sparkCalls = sparkBars(calls.map((c) => ({ date: c.created_at })));
    const sparkBooked = sparkBars(bookings.map((b) => ({ date: b.start_ts })));

    return {
      greet, datePill, sub, callsToday, bookedToday, live, cards, tabs,
      pct, lit, gaugeFoot, follow,
      callsWk, bookWk, C, bookFrac, sparkCalls, sparkBooked,
    };
  }, [calls, bookings, orgName]);

  // Card tilt (same feel as the approved design).
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion:reduce)").matches) return;
    const root = rootRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".card"));
    const move = (card: HTMLElement) => (e: MouseEvent) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.transform = `perspective(760px) rotateX(${((0.5 - py) * 9).toFixed(2)}deg) rotateY(${((px - 0.5) * 11).toFixed(2)}deg) translateY(-5px) scale(1.025)`;
      card.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    };
    const leave = (card: HTMLElement) => () => { card.style.transform = ""; };
    const handlers: Array<[HTMLElement, (e: MouseEvent) => void, () => void]> = [];
    cards.forEach((card) => {
      const m = move(card);
      const l = leave(card);
      card.addEventListener("mousemove", m);
      card.addEventListener("mouseleave", l);
      handlers.push([card, m, l]);
    });
    return () => handlers.forEach(([c, m, l]) => { c.removeEventListener("mousemove", m); c.removeEventListener("mouseleave", l); });
  }, [d]);

  return (
    <div className="panel" ref={rootRef}>
      <Sidebar active="calls" orgName={orgName} />
      <main className="content">
        <div className="top">
          <div className="greet">
            <h1>{d.greet}</h1>
            <div className="sub">
              {d.sub ? (
                <>
                  <b>{d.sub.newToday} call{d.sub.newToday === 1 ? "" : "s"}</b> waiting on you · {d.sub.bookedToday} booked today
                </>
              ) : loadError ? (
                "Couldn't reach the backend just now — showing an empty view."
              ) : (
                "Your receptionist is live. When calls come in, they appear here."
              )}
            </div>
          </div>
          <div className="tools">
            <label className="searchbox">
              <Icon name="i-search" />
              <input placeholder="Search calls, customers…" />
              <kbd>⌘K</kbd>
            </label>
            <button className="circbtn" aria-label="Notifications">
              <span className="dot" />
              <Icon name="i-bell" />
            </button>
            <span className="datepill">
              <Icon name="i-calendar" />
              {d.datePill}
            </span>
          </div>
        </div>

        <div className="statrow">
          <div className="stat">
            <div className="stat-l">
              <div className="lab">Calls today</div>
              <div className="big"><b>{d.callsToday}</b></div>
            </div>
            <div className="spark sp-blue">{d.sparkCalls.map((hgt, i) => <i key={i} style={{ height: hgt + "%" }} />)}</div>
          </div>
          <div className="stat">
            <div className="stat-l">
              <div className="lab">Booked today</div>
              <div className="big"><b>{d.bookedToday}</b></div>
            </div>
            <div className="spark sp-green">{d.sparkBooked.map((hgt, i) => <i key={i} style={{ height: hgt + "%" }} />)}</div>
          </div>
          <div className="stat">
            <div className="stat-l">
              <div className="lab">Answer time</div>
              <div className="big"><b>Instant</b></div>
              <div className="vs">answers every call on the first ring</div>
            </div>
            <div className="spark sp-slate">{Array.from({ length: 9 }).map((_, i) => <i key={i} style={{ height: "26%" }} />)}</div>
          </div>
        </div>

        <div className="grid">
          {d.live && (
            <div className="live">
              <span className="pulse" />
              <div className="lt"><b>{d.live.name}</b><span>{d.live.snip}</span></div>
              <span className="timer">{d.live.timer}</span>
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div className="callshead"><h2>Recent calls</h2><span className="more">View all</span></div>
            <div className="tabs">
              <span className="on">All <i>{d.tabs.all}</i></span>
              <span>Unresolved <i>{d.tabs.unres}</i></span>
              <span>Booked <i>{d.tabs.booked}</i></span>
              <span>Follow-up <i>{d.tabs.follow}</i></span>
            </div>
            <div className="calls">
              {d.cards.length === 0 ? (
                <div className="callsempty">
                  <div className="eico"><Icon name="i-phone" /></div>
                  <b>No calls yet</b>
                  <span>Your AI receptionist is answering. The moment someone calls, the call — who, why, and what it booked — lands right here.</span>
                </div>
              ) : (
                d.cards.map((c, i) => {
                  const p = PILL[c.k];
                  return (
                    <div className={`card ${p.cls}`} key={i}>
                      <div className="r1"><span className="pill">{p.label}</span><span className="time">{c.meta}</span></div>
                      <div className="who">{c.name}</div>
                      <div className="snip">{c.snip}</div>
                      <div className="r3">
                        {c.ini ? (
                          <span className="ava" style={{ background: c.color }}>{c.ini}</span>
                        ) : (
                          <span className="ava unknown"><Icon name="i-user" style={{ width: 16, height: 16 }} /></span>
                        )}
                        <span className="tag">{p.tag}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rail-col">
            <div className="wpanel">
              <h3>Today at a glance</h3>
              <div className="cap">How many calls turned into something</div>
              <div className="gauge">
                <svg className="gaugesvg" viewBox="0 0 208 108">
                  {SEG.map((s, i) => (
                    <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} stroke={i < d.lit ? ACT[i % ACT.length] : INACT} strokeWidth="7.5" strokeLinecap="round" />
                  ))}
                </svg>
                <div className="gval"><b>{d.pct == null ? "—" : d.pct + "%"}</b><span>handled</span></div>
              </div>
              <div className="gfoot">{d.gaugeFoot}</div>
            </div>

            <div className="wpanel">
              <h3>Needs follow-up</h3>
              <div className="cap" style={{ marginBottom: 4 }}>Calls that still need you</div>
              <div className="followlist">
                {d.follow.length === 0 ? (
                  <div className="emptymini">Nothing waiting — you&apos;re all caught up.</div>
                ) : (
                  d.follow.map((f, i) => (
                    <div className="fl" key={i}>
                      {f.ini ? (
                        <span className="ava" style={{ background: f.color }}>{f.ini}</span>
                      ) : (
                        <span className="ava unknown"><Icon name="i-user" style={{ width: 15, height: 15 }} /></span>
                      )}
                      <div className="t"><b>{f.name}</b><span>{f.sub}</span></div>
                      {f.phone ? (
                        <a className="cb" href={`tel:${f.phone.replace(/\s+/g, "")}`}><Icon name="i-phone" /></a>
                      ) : (
                        <span className="cb"><Icon name="i-phone" /></span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="wpanel">
              <h3>This week</h3>
              <div className="cap" style={{ marginBottom: 6 }}>Mon–Sun</div>
              <div className="ringrow">
                <div className="ring">
                  <svg width="46" height="46">
                    <circle cx="23" cy="23" r="19" fill="none" stroke="#ECECEC" strokeWidth="5" />
                    <circle cx="23" cy="23" r="19" fill="none" stroke="#6E7A43" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${d.callsWk > 0 ? d.C : 0} ${d.C}`} />
                  </svg>
                  <span className="rv">{d.callsWk}</span>
                </div>
                <div className="t"><b>Calls answered</b><span>{d.callsWk ? "all answered automatically" : "this week"}</span></div>
              </div>
              <div className="ringrow">
                <div className="ring">
                  <svg width="46" height="46">
                    <circle cx="23" cy="23" r="19" fill="none" stroke="#ECECEC" strokeWidth="5" />
                    <circle cx="23" cy="23" r="19" fill="none" stroke="#5A6DD4" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${d.bookFrac * d.C} ${d.C}`} />
                  </svg>
                  <span className="rv">{d.bookWk}</span>
                </div>
                <div className="t"><b>Turned into bookings</b><span>{d.bookWk ? "on the calendar this week" : "this week"}</span></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
