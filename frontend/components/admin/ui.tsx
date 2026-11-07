"use client";

// Shared admin primitives, styled to match the marketing homepage: neo-brutalist
// ink borders + hard offset shadows, Space Grotesk (font-display) numbers and
// UPPERCASE tracked labels, the brand accent palette (flame/sun/cobalt/mint/grape).
import type { ReactNode } from "react";
import Icon from "../Icon";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Locale-independent (UTC) so server + client render the same string — no hydration mismatch.
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export const CARD = "rounded-[20px] border-2 border-ink bg-white shadow-[4px_5px_0_#111827]";

export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${CARD} ${className}`}>{children}</div>;
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-display text-[11px] font-bold uppercase tracking-[0.16em] text-ink/55 ${className}`}>
      {children}
    </div>
  );
}

type Accent = "flame" | "sun" | "cobalt" | "mint" | "grape" | "ink";
const ACCENT_BG: Record<Accent, string> = {
  flame: "bg-flame/15 text-flame",
  sun: "bg-sun/25 text-[#A5790B]",
  cobalt: "bg-cobalt/15 text-cobalt",
  mint: "bg-mint/20 text-[#0E8F63]",
  grape: "bg-grape/15 text-grape",
  ink: "bg-ink/10 text-ink",
};

export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = "ink",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
  accent?: Accent;
}) {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${ACCENT_BG[accent]}`}>
            <Icon name={icon} style={{ width: 15, height: 15 }} />
          </span>
        )}
        <Label>{label}</Label>
      </div>
      <div className="mt-2.5 font-display text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">{value}</div>
      {hint && <div className="mt-1.5 font-sans text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

export function PercentCard({ label, pct, sub, accent = "cobalt" }: { label: string; pct: number; sub: string; accent?: Accent }) {
  const bar = accent === "flame" ? "bg-flame" : accent === "mint" ? "bg-mint" : "bg-cobalt";
  return (
    <div className={`${CARD} p-5`}>
      <Label>{label}</Label>
      <div className="mt-2 font-display text-[34px] font-bold leading-none tracking-[-0.02em] text-ink">{pct}%</div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full border border-ink/15 bg-cream">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
      <div className="mt-2 font-sans text-[12px] text-muted">{sub}</div>
    </div>
  );
}

const BAR_COLORS = ["bg-ink", "bg-cobalt", "bg-flame", "bg-grape", "bg-mint", "bg-sun"];

export function BarList({
  title,
  data,
  emptyHint = "No data yet.",
}: {
  title: string;
  data: Record<string, number>;
  emptyHint?: string;
}) {
  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? Math.max(...entries.map(([, v]) => v)) : 0;
  return (
    <div className={`${CARD} p-5`}>
      <Label>{title}</Label>
      {entries.length === 0 ? (
        <p className="mt-3 font-sans text-[13px] text-muted">{emptyHint}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {entries.map(([k, v], i) => (
            <div key={k} className="flex items-center gap-3">
              <div className="w-[34%] min-w-0 shrink-0 truncate font-sans text-[13.5px] font-semibold text-ink" title={k}>
                {k === "—" ? "Not set" : k}
              </div>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream">
                <div
                  className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${max ? Math.max(6, (v / max) * 100) : 0}%` }}
                />
              </div>
              <div className="w-8 shrink-0 text-right font-display text-[14px] font-bold text-ink">{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple, dependency-free bar chart for "calls per day — last 30". Inline SVG so
// it scales cleanly and matches the brand (ink bars, last bar flame).
export function CallsChart({ data }: { data: { date: string; count: number }[] }) {
  const series = data && data.length ? data : [];
  if (series.length === 0) {
    return (
      <div className={`${CARD} p-5`}>
        <Label>Calls per day — last 30</Label>
        <p className="mt-3 font-sans text-[13px] text-muted">No calls yet. This fills in as calls come through.</p>
      </div>
    );
  }
  const W = 720;
  const H = 150;
  const pad = 6;
  const n = series.length;
  const max = Math.max(1, ...series.map((d) => d.count));
  const slot = (W - pad * 2) / n;
  const bw = Math.max(2, slot * 0.64);
  const total = series.reduce((a, d) => a + d.count, 0);
  const peak = Math.max(...series.map((d) => d.count));
  const last = series[series.length - 1];

  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label>Calls per day — last 30</Label>
        <div className="font-sans text-[12px] text-muted">
          <b className="font-display text-ink">{total}</b> in 30d · peak <b className="font-display text-ink">{peak}</b>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-[150px] w-full" role="img" aria-label="Calls per day">
        <line x1={pad} y1={H - 14} x2={W - pad} y2={H - 14} stroke="#111827" strokeWidth="1.5" />
        {series.map((d, i) => {
          const h = max ? (d.count / max) * (H - 26) : 0;
          const x = pad + i * slot + (slot - bw) / 2;
          const y = H - 14 - h;
          const isLast = i === n - 1;
          return (
            <rect
              key={d.date + i}
              x={x}
              y={y}
              width={bw}
              height={Math.max(h, d.count > 0 ? 2 : 0)}
              rx="2"
              fill={isLast ? "#FF6B35" : "#111827"}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between font-sans text-[11px] text-muted">
        <span>{series[0]?.date?.slice(5)}</span>
        <span>today ({last?.count})</span>
      </div>
    </div>
  );
}
