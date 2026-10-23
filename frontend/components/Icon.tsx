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
  return (
    <svg className={className} style={style} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  );
}
