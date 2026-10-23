"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The Lumidesk wordmark in the home-page display face (Space Grotesk, bold,
 * tight tracking — identical to the headlines). It types itself in, holds,
 * deletes, and types again, looping forever, with a blinking caret.
 * The full word's width is always reserved, so the typing never shifts the
 * layout around it. Reduced-motion users just see the finished word.
 */
export default function Wordmark({
  onDark = false,
  className = "",
}: {
  onDark?: boolean;
  className?: string;
}) {
  const full = "Lumidesk";
  const [n, setN] = useState(0);
  const phase = useRef<"typing" | "deleting">("typing");

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion:reduce)").matches) {
      setN(full.length);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    if (phase.current === "typing") {
      if (n < full.length) t = setTimeout(() => setN(n + 1), 115);
      else
        t = setTimeout(() => {
          phase.current = "deleting";
          setN(full.length - 1);
        }, 2000);
    } else {
      if (n > 0) t = setTimeout(() => setN(n - 1), 60);
      else
        t = setTimeout(() => {
          phase.current = "typing";
          setN(1);
        }, 600);
    }
    return () => clearTimeout(t);
  }, [n]);

  const ink = onDark ? "text-cream" : "text-ink";
  const caretBg = onDark ? "bg-cream" : "bg-ink";

  return (
    <span
      className={`relative inline-flex items-center font-display font-bold tracking-[-0.03em] ${ink} ${className}`}
      aria-label="Lumidesk"
    >
      {/* reserves the full width so typing never reflows the layout */}
      <span aria-hidden="true" className="invisible">
        {full}.
      </span>
      {/* the animated overlay */}
      <span aria-hidden="true" className="absolute inset-0 inline-flex items-center whitespace-nowrap">
        <span>{full.slice(0, n)}</span>
        <span className="text-flame">{n === full.length ? "." : ""}</span>
        <span
          className={`ml-[2px] inline-block w-[0.07em] animate-blink rounded-[1px] ${caretBg}`}
          style={{ height: "0.9em" }}
        />
      </span>
    </span>
  );
}
