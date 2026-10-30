"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "./Icon";

function initials(name?: string | null) {
  if (!name) return "LD";
  const parts = name.replace(/[—–-]/g, " ").split(/\s+/).filter(Boolean);
  const r = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return r || name.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  active,
  orgName,
}: {
  active: "calls" | "bookings" | "knowledge" | "settings";
  orgName?: string | null;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <nav className="side">
      <Link href="/app" className="logolink" aria-label="Lumidesk">
        <span className="logo" />
      </Link>
      <Link href="/app" className={`sideicon${active === "calls" ? " on" : ""}`} title="Calls">
        <Icon name="i-phone" />
      </Link>
      <Link
        href="/app/bookings"
        className={`sideicon${active === "bookings" ? " on" : ""}`}
        title="Bookings"
      >
        <Icon name="i-calendar" />
      </Link>
      <Link
        href="/app/knowledge"
        className={`sideicon${active === "knowledge" ? " on" : ""}`}
        title="Knowledge"
      >
        <Icon name="i-book" />
      </Link>
      <div className="sideicon" title="Customers (coming soon)">
        <Icon name="i-users" />
      </div>
      <div className="sideicon" title="Reports (coming soon)">
        <Icon name="i-chart" />
      </div>
      <Link
        href="/app/settings"
        className={`sideicon${active === "settings" ? " on" : ""}`}
        title="Settings"
      >
        <Icon name="i-settings" />
      </Link>
      <div className="sp" />
      <button
        type="button"
        className="ava me"
        title={`${orgName ?? "Account"} — sign out`}
        onClick={logout}
        style={{ border: 0, cursor: "pointer" }}
      >
        {initials(orgName)}
      </button>
    </nav>
  );
}
