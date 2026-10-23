"use client";

import { motion, useMotionValue } from "framer-motion";
import { useEffect, useRef } from "react";

function EyeWindow({ color, className = "" }: { color: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const ang = Math.atan2(dy, dx);
      const dist = Math.min(5, Math.hypot(dx, dy) / 35);
      px.set(Math.cos(ang) * dist);
      py.set(Math.sin(ang) * dist);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [px, py]);

  return (
    <div ref={ref} className={`w-[30%] max-w-[120px] overflow-hidden rounded-[16px] border-2 border-ink shadow-hard ${className}`} style={{ background: color }}>
      <div className="flex items-center gap-1.5 border-b-2 border-ink px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full border-[1.5px] border-ink" />
        <span className="h-2 w-2 rounded-full border-[1.5px] border-ink" />
        <span className="h-2 w-2 rounded-full border-[1.5px] border-ink" />
      </div>
      <div className="flex items-center justify-center gap-3 py-4">
        {[0, 1].map((i) => (
          <div key={i} className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-white">
            <motion.span style={{ x: px, y: py }} className="h-3 w-3 rounded-full bg-ink" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EyeRow() {
  return (
    <div className="flex items-end justify-center gap-4">
      <EyeWindow color="#2457FF" className="translate-y-2" />
      <EyeWindow color="#FF6B35" className="scale-110" />
      <EyeWindow color="#FFD84D" className="translate-y-2" />
    </div>
  );
}
