"use client";

import { motion, useSpring, useTransform, type MotionValue } from "framer-motion";
import Icon from "../Icon";

export default function HeroArt({ mx, my }: { mx: MotionValue<number>; my: MotionValue<number> }) {
  // Each layer parallaxes a different amount → depth.
  const sp = { stiffness: 120, damping: 20 };
  const backX = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), sp);
  const backY = useSpring(useTransform(my, [-0.5, 0.5], [-10, 10]), sp);
  const midX = useSpring(useTransform(mx, [-0.5, 0.5], [-26, 26]), sp);
  const midY = useSpring(useTransform(my, [-0.5, 0.5], [-18, 18]), sp);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [12, -12]), sp);
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [-9, 9]), sp);
  const b1X = useSpring(useTransform(mx, [-0.5, 0.5], [-42, 42]), sp);
  const b1Y = useSpring(useTransform(my, [-0.5, 0.5], [-32, 32]), sp);
  const b2X = useSpring(useTransform(mx, [-0.5, 0.5], [38, -38]), sp);
  const b2Y = useSpring(useTransform(my, [-0.5, 0.5], [30, -30]), sp);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" style={{ perspective: 1000 }}>
      {/* spinning dashed ring */}
      <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 animate-spinslow rounded-full border-2 border-dashed border-ink/25" />

      {/* back cobalt card */}
      <motion.div
        style={{ x: backX, y: backY }}
        className="absolute left-[14%] top-[20%] h-[62%] w-[62%] -rotate-[10deg] rounded-[26px] border-2 border-ink bg-cobalt shadow-hard"
      />
      {/* back sun card */}
      <motion.div
        style={{ x: backX, y: backY }}
        className="absolute right-[10%] top-[14%] h-[40%] w-[40%] rotate-[8deg] rounded-[22px] border-2 border-ink bg-sun shadow-hard-sm"
      />

      {/* main live-call card */}
      <motion.div
        style={{ x: midX, y: midY, rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        className="absolute left-[8%] top-[12%] w-[74%] overflow-hidden rounded-[22px] border-[3px] border-ink bg-white shadow-hard-lg"
      >
        <div className="flex items-center gap-2 border-b-2 border-ink bg-flame px-4 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink/40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ink" />
          </span>
          <span className="font-display text-[12px] font-bold uppercase tracking-wide text-ink">Live call</span>
          <span className="ml-auto font-display text-[12px] font-bold text-ink">0:18</span>
        </div>
        <div className="space-y-2.5 p-4">
          <div className="max-w-[82%] rounded-2xl rounded-tl-sm border-2 border-ink bg-periwinkle px-3 py-2 text-[12.5px] font-semibold leading-snug text-ink">
            Do you cover Kempele for a blocked drain?
          </div>
          <div className="ml-auto max-w-[86%] rounded-2xl rounded-tr-sm border-2 border-ink bg-mint px-3 py-2 text-[12.5px] font-semibold leading-snug text-ink">
            Yes we do. I can book you in tomorrow at 9:00. Shall I lock it in?
          </div>
          <div className="flex items-center gap-2 rounded-xl border-2 border-ink bg-sun px-3 py-2">
            <Icon name="i-check" className="lu h-4 w-4 text-ink" />
            <span className="font-display text-[12.5px] font-bold text-ink">Booked · Tomorrow 9:00</span>
          </div>
        </div>
      </motion.div>

      {/* floating badge — ALWAYS ON */}
      <motion.div
        style={{ x: b1X, y: b1Y }}
        className="absolute left-[1%] -top-7 grid h-[86px] w-[86px] animate-float place-items-center rounded-full border-2 border-ink bg-sun text-center shadow-hard-sm"
      >
        <span className="px-2 font-display text-[11px] font-bold uppercase leading-tight text-ink">
          Always
          <br />
          on
        </span>
      </motion.div>

      {/* floating badge — BOOKS 24/7 */}
      <motion.div
        style={{ x: b2X, y: b2Y }}
        className="absolute bottom-[4%] right-[2%] grid h-[108px] w-[108px] place-items-center rounded-full border-2 border-ink bg-grape text-center text-cream shadow-hard"
      >
        <span className="flex flex-col items-center px-2 font-display text-[11px] font-bold uppercase leading-tight">
          Books
          <br />
          24 / 7
          <Icon name="i-arrow-ur" className="lu mt-1 h-4 w-4 text-cream" />
        </span>
      </motion.div>

      {/* small FI/EN pill */}
      <motion.div
        style={{ x: b1X, y: b2Y }}
        className="absolute bottom-[20%] left-[2%] flex items-center gap-1.5 rounded-full border-2 border-ink bg-rose px-3 py-1.5 text-cream shadow-hard-sm"
      >
        <Icon name="i-globe" className="lu h-3.5 w-3.5" />
        <span className="font-display text-[11px] font-bold uppercase">Any language</span>
      </motion.div>
    </div>
  );
}
