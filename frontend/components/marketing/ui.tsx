"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "../Icon";

type PillVariant = "fill" | "outline" | "flame" | "sun" | "cobalt";

const PILL_BASE =
  "group inline-flex items-center justify-center gap-2.5 rounded-full border-2 border-ink px-6 py-3.5 font-display text-[15px] font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0";
const PILL_VARIANT: Record<PillVariant, string> = {
  fill: "bg-ink text-cream hover:shadow-hard",
  outline: "bg-transparent text-ink hover:bg-ink hover:text-cream",
  flame: "bg-flame text-ink hover:shadow-hard",
  sun: "bg-sun text-ink hover:shadow-hard",
  cobalt: "bg-cobalt text-cream hover:shadow-hard",
};

export function PillButton({
  children,
  href,
  variant = "fill",
  icon = "i-arrow-ur",
  className = "",
  type,
  onClick,
  disabled,
}: {
  children: ReactNode;
  href?: string;
  variant?: PillVariant;
  icon?: string | null;
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls = `${PILL_BASE} ${PILL_VARIANT[variant]} ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      {icon && (
        <Icon
          name={icon}
          className="lu h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={`${cls} disabled:opacity-60`}>
      {inner}
    </button>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-4 py-1.5 font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-flame" />
      {children}
    </span>
  );
}

export function SectionLabel({ num, children }: { num: string; children: ReactNode }) {
  return (
    <div className="font-display text-[12px] font-bold uppercase tracking-[0.18em] text-flame">
      {num} — {children}
    </div>
  );
}

export function Marquee({
  items,
  dark = false,
  className = "",
  speed = "animate-marquee",
}: {
  items: string[];
  dark?: boolean;
  className?: string;
  speed?: string;
}) {
  const Row = (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span key={i} className="flex items-center font-display text-[clamp(18px,2.2vw,30px)] font-bold uppercase tracking-tight">
          <span className="px-6">{t}</span>
          <span className={dark ? "text-flame" : "text-flame"}>✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={`overflow-hidden border-y-2 border-ink ${dark ? "bg-ink text-cream" : "bg-sun text-ink"} py-3 ${className}`}>
      <div className={`flex w-max ${speed}`}>
        {Row}
        {Row}
      </div>
    </div>
  );
}
