"use client";

import type { AdminMetrics } from "@/lib/api";
import { BarList, CallsChart, Label, PercentCard, StatTile } from "./ui";

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export default function MetricsView({ m, loadError }: { m: AdminMetrics | null; loadError?: boolean }) {
  // Defensive defaults so an older backend (missing the enriched fields) never crashes the page.
  const callsPerDay = m?.calls_per_day ?? [];
  const calls7 = m?.calls_7d ?? 0;
  const bookings7 = m?.bookings_7d ?? 0;

  if (!m) {
    return (
      <div className="rounded-[20px] border-2 border-ink bg-white p-8 text-center shadow-[4px_5px_0_#111827]">
        <p className="font-display text-[16px] font-bold text-ink">Couldn&apos;t load metrics</p>
        <p className="mt-1 font-sans text-[13.5px] text-muted">Is the backend running? Try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.03em] text-ink">Metrics</h1>
        <p className="mt-1 font-sans text-[14px] text-muted">
          Live counts across every business on LumiDesk.
        </p>
        {loadError && (
          <p className="mt-3 rounded-xl border-2 border-ink bg-flame/10 px-3 py-2 font-sans text-[13px] font-semibold text-ink">
            Some numbers couldn&apos;t load just now — showing what we have.
          </p>
        )}
      </div>

      {/* headline tiles */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Businesses" value={m.total_orgs} hint={`+${m.new_7d} this week`} icon="i-users" accent="cobalt" />
        <StatTile
          label="Subscribed"
          value={m.paid}
          hint={m.total_orgs ? `${pct(m.paid, m.total_orgs)}% of signups` : "no signups yet"}
          icon="i-star"
          accent="flame"
        />
        <StatTile label="Onboarded" value={m.onboarded} hint={`${m.with_number} with a number`} icon="i-check-circle" accent="mint" />
        <StatTile
          label="Active · 7d"
          value={m.active_7d ?? "—"}
          hint={m.total_users != null ? `${m.total_users} users total` : "logins"}
          icon="i-bell"
          accent="grape"
        />
        <StatTile label="Calls" value={m.total_calls} hint={`+${calls7} this week`} icon="i-phone" accent="ink" />
        <StatTile label="Bookings" value={m.total_bookings} hint={`+${bookings7} this week`} icon="i-calendar-check" accent="sun" />
      </div>

      {/* chart */}
      <CallsChart data={callsPerDay} />

      {/* conversion */}
      <div>
        <Label className="mb-2.5">Conversion</Label>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <PercentCard label="Subscribe rate" pct={pct(m.paid, m.total_orgs)} sub={`${m.paid} of ${m.total_orgs} businesses`} accent="flame" />
          <PercentCard label="Onboarded rate" pct={pct(m.onboarded, m.total_orgs)} sub={`${m.onboarded} of ${m.total_orgs} finished setup`} accent="cobalt" />
          <PercentCard label="Has a number" pct={pct(m.with_number, m.total_orgs)} sub={`${m.with_number} of ${m.total_orgs} live on a line`} accent="mint" />
        </div>
      </div>

      {/* breakdowns */}
      <div>
        <Label className="mb-2.5">Who&apos;s signing up</Label>
        <div className="grid gap-3.5 lg:grid-cols-3">
          <BarList title="By country" data={m.by_country} emptyHint="No countries recorded yet." />
          <BarList title="By plan" data={m.by_plan} emptyHint="No plans yet." />
          <BarList title="By language" data={m.by_language} emptyHint="No languages set yet." />
        </div>
      </div>
    </div>
  );
}
