import { useId } from "react";

type TrackingModeIconProps = {
  mode: "serial" | "quantity";
  className?: string;
};

/** Two-tone inventory pictograms that follow the sidebar icon language. */
export function TrackingModeIcon({ mode, className = "h-3.5 w-3.5" }: TrackingModeIconProps) {
  const gradientId = useId().replace(/:/g, "");
  const fill = `url(#${gradientId})`;

  return (
    <svg className={className} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#0866f5" />
          <stop offset="1" stopColor="#7138f5" />
        </linearGradient>
      </defs>
      {mode === "serial" ? (
        <>
          <rect x="8" y="2" width="20" height="32" rx="5" fill={fill} />
          <rect x="11" y="6" width="14" height="21" rx="2" fill="#fff" opacity=".94" />
          <path d="M14 12v9m3-11v13m3-11v9m3-8v7" stroke="#4b37e9" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="18" cy="30.5" r="1.5" fill="#fff" />
        </>
      ) : (
        <>
          <path d="m18 2 9 5v10l-9 5-9-5V7z" fill={fill} />
          <path d="m9 17 9 5v9l-9 5-9-5v-9z" fill="#80adff" />
          <path d="m27 17 9 5v9l-9 5-9-5v-9z" fill={fill} />
          <path d="m9 7 9 5 9-5M18 12v10M0 22l9 5 9-5M9 27v9m9-14 9 5 9-5m-9 5v9" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
