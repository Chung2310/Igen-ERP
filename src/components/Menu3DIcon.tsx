import { useId, type ElementType } from "react";

export interface Menu3DIconPalette {
  light: string;
  dark: string;
  edge: string;
}

interface Menu3DIconProps {
  icon: ElementType;
  palette: Menu3DIconPalette;
  className?: string;
}

export function Menu3DIcon({ icon: Icon, palette, className }: Menu3DIconProps) {
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 overflow-visible transition-transform group-hover:scale-105 ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor={palette.light} />
          <stop offset="0.55" stopColor={palette.dark} />
          <stop offset="1" stopColor={palette.edge} />
        </linearGradient>
      </defs>
      <Icon
        x="1"
        y="1.5"
        width="22"
        height="22"
        fill="none"
        stroke={palette.edge}
        strokeWidth={3.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Icon
        x="1"
        y="0.5"
        width="22"
        height="22"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Icon
        x="1"
        y="0.5"
        width="22"
        height="22"
        fill="none"
        stroke="#fff"
        strokeWidth={0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.65}
      />
    </svg>
  );
}
