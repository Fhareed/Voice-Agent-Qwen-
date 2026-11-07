import type { CSSProperties } from "react";

export default function Icon({
  name,
  className = "lu",
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  // viewBox matches every sprite symbol (all are 0 0 24 24). Without it, a few
  // browsers/zoom levels mis-place a <use>-referenced symbol; with it the icon
  // always scales to — and centers within — its CSS box.
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}
