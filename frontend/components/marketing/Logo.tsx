/* eslint-disable @next/next/no-img-element */
// The real Lumidesk wordmark (white, transparent). Reads on dark / coloured
// surfaces; on light surfaces, wrap it in a dark chip.
export default function Logo({ className = "h-8" }: { className?: string }) {
  return <img src="/logo.png" alt="Lumidesk" className={`w-auto select-none ${className}`} draggable={false} />;
}
