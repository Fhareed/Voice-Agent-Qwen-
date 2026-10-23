"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import Sidebar from "./Sidebar";
import type { Booking } from "@/lib/types";

const START = 8, END = 18, HOUR = 62;
const AVCOLORS = ["#64748B", "#3F8F86", "#A9795A", "#7E6A99", "#B5697A", "#4E79B8", "#5B6CB0"];
const WD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ROTATE = ["blue", "purple", "peach", "yellow"];

type VStatus = "completed" | "confirmed" | "urgent" | "cancelled" | "no_show";
const STATUS: Record<VStatus, { bar: string; text: string; pill: string; pillbg: string; icon: string; label: string; fill: string | null }> = {
  completed: { bar: "#2BA564", text: "Job completed", pill: "#2BA564", pillbg: "#E4F6EC", icon: "i-check-circle", label: "Completed", fill: "green" },
  confirmed: { bar: "#2F6BFF", text: "Confirmed", pill: "#2F6BFF", pillbg: "#E6EEFF", icon: "i-check-circle", label: "Confirmed", fill: null },
  urgent: { bar: "#E0509A", text: "Urgent · same day", pill: "#B23172", pillbg: "#FBE1EF", icon: "i-alert", label: "Urgent", fill: "pink" },
  cancelled: { bar: "#8A93A6", text: "Cancelled", pill: "#6B7280", pillbg: "#EEF0F3", icon: "i-x", label: "Cancelled", fill: "slate" },
  no_show: { bar: "#B3541F", text: "No-show", pill: "#B3541F", pillbg: "#FBE8DC", icon: "i-alert", label: "No-show", fill: "slate" },
};

function pad(n: number) { return (n < 10 ? "0" : "") + n; }
function hm(d: Date) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
function mins(t: string) { const p = t.split(":"); return +p[0] * 60 + +p[1]; }
function top(t: string) { return ((mins(t) - START * 60) / 60) * HOUR; }
function hgt(a: string, b: string) { return Math.max(26, ((mins(b) - mins(a)) / 60) * HOUR - 4); }
function initials(n?: string | null) {
  if (!n || /^[+\d]/.test(n)) return null;
  const p = String(n).replace(/[—–-]/g, " ").split(/\s+/).filter(Boolean);
  const r = ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
  return r || null;
}
function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function visStatus(b: Booking): VStatus {
  const s = b.status || "booked";
  if (s === "completed") return "completed";
  if (s === "cancelled") return "cancelled";
  if (s === "no_show") return "no_show";
  const hay = `${b.service ?? ""} ${b.notes ?? ""}`.toLowerCase();
  if (/urgent|emergency|burst|flood|no hot water|same.?day|leak/.test(hay)) return "urgent";
  return "confirmed";
}

interface Appt {
  idx: number; day: number; s: string; e: string; start: Date; end: Date;
  name: string; phone: string; email: string; svc: string; note: string;
  created: Date | null; vstatus: VStatus; color: string;
}

export default function BookingsView({
  bookings,
  orgName,
  loadError,
}: {
  bookings: Booking[];
  orgName?: string | null;
  loadError?: boolean;
}) {
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const d = useMemo(() => {
    const parsed = bookings
      .map((b) => {
        const st = b.start_ts ? new Date(b.start_ts) : null;
        let en = b.end_ts ? new Date(b.end_ts) : null;
        if (st && (!en || isNaN(en.getTime()))) en = new Date(st.getTime() + 60 * 60000);
        return st && !isNaN(st.getTime()) ? { raw: b, start: st, end: en as Date } : null;
      })
      .filter((x): x is { raw: Booking; start: Date; end: Date } => x !== null);

    const now = new Date();
    let ref = now;
    if (parsed.length) {
      ref = [...parsed].sort((a, c) => Math.abs(a.start.getTime() - now.getTime()) - Math.abs(c.start.getTime() - now.getTime()))[0].start;
    }
    const weekStart = mondayOf(ref);
    const dayIndex = (dt: Date) => {
      const x = new Date(dt);
      x.setHours(0, 0, 0, 0);
      return Math.round((x.getTime() - weekStart.getTime()) / 86400000);
    };

    const friday = new Date(weekStart);
    friday.setDate(friday.getDate() + 4);
    const monthLabel =
      weekStart.getMonth() === friday.getMonth()
        ? MON[weekStart.getMonth()] + " " + weekStart.getFullYear()
        : MON[weekStart.getMonth()] + "–" + MON[friday.getMonth()] + " " + friday.getFullYear();

    const DAYS: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const dd = new Date(weekStart);
      dd.setDate(dd.getDate() + i);
      DAYS.push(dd);
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let today = Math.round((todayStart.getTime() - weekStart.getTime()) / 86400000);
    if (today < 0 || today > 4) today = -1;

    const appts: Appt[] = [];
    parsed.forEach((x) => {
      const di = dayIndex(x.start);
      if (di < 0 || di > 4) return;
      const vs = visStatus(x.raw);
      const st = STATUS[vs];
      appts.push({
        idx: appts.length,
        day: di, s: hm(x.start), e: hm(x.end), start: x.start, end: x.end,
        name: x.raw.customer_name || x.raw.customer_phone || "Unknown caller",
        phone: x.raw.customer_phone || "", email: x.raw.customer_email || "",
        svc: x.raw.service || "Appointment", note: x.raw.notes || "",
        created: x.raw.created_at ? new Date(x.raw.created_at) : null,
        vstatus: vs, color: st.fill || ROTATE[appts.length % ROTATE.length],
      });
    });
    appts.sort((a, b) => a.day - b.day || mins(a.s) - mins(b.s));
    appts.forEach((a, i) => (a.idx = i));

    // now line position
    let nowTop: number | null = null;
    if (today >= 0) {
      const nm = now.getHours() * 60 + now.getMinutes();
      if (nm >= START * 60 && nm <= END * 60) nowTop = ((nm - START * 60) / 60) * HOUR;
    }

    // stats
    const all = bookings.length;
    const done = bookings.filter((b) => b.status === "completed").length;
    const bad = bookings.filter((b) => b.status === "cancelled" || b.status === "no_show").length;

    const sparkFrom = (pred: (b: Booking) => boolean, days = 9) => {
      const counts: number[] = [];
      let max = 1;
      for (let k = days - 1; k >= 0; k--) {
        const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - k);
        const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
        const c = bookings.filter((b) => {
          if (!pred(b)) return false;
          const t = b.start_ts ? new Date(b.start_ts) : null;
          return t && t >= d0 && t < d1;
        }).length;
        counts.push(c); if (c > max) max = c;
      }
      return counts.map((c) => Math.max(8, Math.round((c / max) * 100)));
    };

    const hours: number[] = [];
    for (let h = START; h <= END; h++) hours.push(h);

    return {
      appts, DAYS, today, nowTop, monthLabel, hours,
      total: bookings.length, raw: bookings.length,
      stBooked: appts.length,
      stDone: all ? Math.round((done / all) * 100) + "%" : "—",
      stDoneSub: all ? `${done} of ${all} jobs` : "no jobs yet",
      stCancel: all ? Math.round((bad / all) * 100) + "%" : "—",
      stCancelSub: all ? `${bad} of ${all} jobs` : "no jobs yet",
      sparkBooked: sparkFrom(() => true),
      sparkDone: sparkFrom((b) => b.status === "completed"),
      sparkCancel: sparkFrom((b) => b.status === "cancelled" || b.status === "no_show"),
    };
  }, [bookings]);

  const sel = selIdx != null ? d.appts[selIdx] : undefined;

  function selectAppt(i: number) {
    setSelIdx(i);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setSelIdx(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // tilt on the stat cards
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion:reduce)").matches) return;
    const root = rootRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".tiltcard"));
    const handlers: Array<[HTMLElement, (e: MouseEvent) => void, () => void]> = [];
    cards.forEach((card) => {
      const m = (e: MouseEvent) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(760px) rotateX(${((0.5 - py) * 7).toFixed(2)}deg) rotateY(${((px - 0.5) * 9).toFixed(2)}deg) translateY(-3px) scale(1.02)`;
        card.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      };
      const l = () => { card.style.transform = ""; };
      card.addEventListener("mousemove", m);
      card.addEventListener("mouseleave", l);
      handlers.push([card, m, l]);
    });
    return () => handlers.forEach(([c, m, l]) => { c.removeEventListener("mousemove", m); c.removeEventListener("mouseleave", l); });
  }, [d]);

  const selStatus = sel ? STATUS[sel.vstatus] : null;
  const selMins = sel ? Math.round((sel.end.getTime() - sel.start.getTime()) / 60000) : 0;

  return (
    <div className="panel" ref={rootRef}>
      <Sidebar active="bookings" orgName={orgName} />
      <div className="main">
        <div className="work">
          <div className="whead">
            <h1>Bookings</h1>
            <div className="loc">
              <button className="circbtn" aria-label="Notifications"><span className="dot" /><Icon name="i-bell" /></button>
            </div>
          </div>

          <div className="toolbar">
            <button className="todaybtn">Today</button>
            <div className="monthnav">
              <span className="nv"><Icon name="i-chev-l" /></span>
              <span>{d.monthLabel}</span>
              <span className="nv"><Icon name="i-chev-r" /></span>
            </div>
            <div className="seg"><span>Day</span><span className="on">Week</span><span>Month</span></div>
            <div className="filter"><Icon name="i-check-circle" />All status<Icon name="i-chevron-down" className="lu ch" /></div>
            <div className="filter"><Icon name="i-users" />All plumbers<Icon name="i-chevron-down" className="lu ch" /></div>
          </div>

          <div className="stats">
            <div className="stat tiltcard">
              <div className="stat-l">
                <div className="lab">Jobs booked <span className="sub">· this week</span></div>
                <div className="big"><b>{d.stBooked}</b></div>
                <div className="vs">in the week shown</div>
              </div>
              <div className="spark sp-blue">{d.sparkBooked.map((h, i) => <i key={i} style={{ height: h + "%" }} />)}</div>
            </div>
            <div className="stat tiltcard">
              <div className="stat-l">
                <div className="lab">Completed <span className="sub">· all time</span></div>
                <div className="big"><b>{d.stDone}</b></div>
                <div className="vs">{d.stDoneSub}</div>
              </div>
              <div className="spark sp-green">{d.sparkDone.map((h, i) => <i key={i} style={{ height: h + "%" }} />)}</div>
            </div>
            <div className="stat tiltcard">
              <div className="stat-l">
                <div className="lab">Cancelled / no-show <span className="sub">· all time</span></div>
                <div className="big"><b>{d.stCancel}</b></div>
                <div className="vs">{d.stCancelSub}</div>
              </div>
              <div className="spark sp-peach">{d.sparkCancel.map((h, i) => <i key={i} style={{ height: h + "%" }} />)}</div>
            </div>
          </div>

          <div className="cal">
            <div className="dayhead">
              <div className="tz">GMT+3</div>
              {d.DAYS.map((day, i) => {
                const cnt = d.appts.filter((a) => a.day === i).length;
                return (
                  <div className={`dh${i === d.today ? " today" : ""}`} key={i}>
                    <span className="dnum">{day.getDate()}</span>
                    <span className="dmeta"><b>{WD[i]}</b><span>{cnt} job{cnt === 1 ? "" : "s"}</span></span>
                  </div>
                );
              })}
            </div>
            <div className="calbody">
              <div className="timecol">
                {d.hours.map((h, i) => {
                  const lab = h % 12 || 12;
                  return <div className="tl" key={i}><span>{lab}:00 {h < 12 ? "AM" : "PM"}</span></div>;
                })}
              </div>
              {[0, 1, 2, 3, 4].map((day) => (
                <div className="daycol" key={day}>
                  {day === d.today && d.nowTop != null && <div className="nowline" style={{ top: d.nowTop }} />}
                  {d.appts.filter((a) => a.day === day).map((a) => (
                    <div
                      key={a.idx}
                      className={`appt f-${a.color}${a.idx === selIdx ? " sel" : ""}`}
                      style={{ top: Math.max(0, top(a.s)), height: hgt(a.s, a.e) }}
                      onClick={() => selectAppt(a.idx)}
                    >
                      <div className="at">{a.s}–{a.e}</div>
                      <div className="an">{a.name}</div>
                      <div className="as">{a.svc}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {d.appts.length === 0 && (
              <div className="calempty">
                <div className="eico"><Icon name="i-calendar" /></div>
                <b>{d.raw ? "No bookings this week" : "No bookings yet"}</b>
                <span>
                  {loadError
                    ? "Couldn't reach the backend just now."
                    : d.raw
                      ? `You have ${d.raw} booking${d.raw === 1 ? "" : "s"} in other weeks. Use the arrows to find them.`
                      : "When your AI receptionist books a job over the phone, it shows up on this calendar automatically."}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={`scrim${open ? " open" : ""}`} onClick={close} />
        <aside className={`detail${open ? " open" : ""}`}>
          <button className="dclose" aria-label="Close" onClick={close}><Icon name="i-x" /></button>
          {sel && selStatus && (
            <>
              <div className="dstatus" style={{ background: selStatus.bar }}>
                <span><Icon name={selStatus.icon} /></span>
                <span>{selStatus.text}</span>
              </div>
              <div className="dbody">
                <div className="dcust">
                  {initials(sel.name) ? (
                    <span className="ava" style={{ background: AVCOLORS[sel.idx % AVCOLORS.length] }}>{initials(sel.name)}</span>
                  ) : (
                    <span className="ava" style={{ background: "#9AA0AB" }}><Icon name="i-user" style={{ width: 18, height: 18 }} /></span>
                  )}
                  <div>
                    <div className="nm">{sel.name}</div>
                    <div className="ph">{sel.phone || "No number on file"}</div>
                  </div>
                  <span className="edit"><Icon name="i-pencil" /></span>
                </div>
                <div className="dtime">
                  <span className="ic"><Icon name="i-clock" /></span>
                  <div className="tt">
                    <b>{sel.s} → {sel.e}</b>
                    <span>{WD[sel.day].charAt(0) + WD[sel.day].slice(1).toLowerCase()} {sel.start.getDate()} {MON[sel.start.getMonth()]} · {selMins} min</span>
                  </div>
                  <span className="st" style={{ color: selStatus.pill, background: selStatus.pillbg }}>{selStatus.label}</span>
                </div>
                <div className="dnote">{sel.note || "No note on this job."}</div>
                <div className="dacts">
                  {sel.phone ? (
                    <a className="dbtn" href={`tel:${sel.phone.replace(/\s+/g, "")}`}><Icon name="i-phone" />Call customer</a>
                  ) : (
                    <button className="dbtn" style={{ opacity: 0.5 }} disabled><Icon name="i-phone" />No number</button>
                  )}
                  <button className="dmore" aria-label="More options"><Icon name="i-more" /></button>
                </div>
                <div className="dsec">
                  <h4>Job details</h4>
                  <div className="facts">
                    <div className="fact"><span className="ic"><Icon name="i-wrench" /></span><div><div className="l">Service</div><div className="v">{sel.svc}</div></div></div>
                    <div className="fact"><span className="ic"><Icon name="i-user" /></span><div><div className="l">Contact</div><div className="v">{sel.email || sel.phone || "—"}</div></div></div>
                    <div className="fact"><span className="ic"><Icon name="i-calendar" /></span><div><div className="l">Booked on</div><div className="v">{sel.created ? `${sel.created.getDate()} ${MON[sel.created.getMonth()]} ${sel.created.getFullYear()}` : "—"}</div></div></div>
                    <div className="fact"><span className="ic"><Icon name="i-sparkles" /></span><div><div className="l">Booked by</div><div className="v">Lumidesk receptionist · by phone</div></div></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
