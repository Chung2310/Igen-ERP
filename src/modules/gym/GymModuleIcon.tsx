import type { SVGProps } from "react";

type GymModuleIconProps = SVGProps<SVGSVGElement> & { size?: number | string; weight?: "regular" | "fill" | string };

/** Quả tạ của phân hệ Quản lý phòng Gym. */
export default function GymModuleIcon({ size = 24, weight = "regular", ...props }: GymModuleIconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M7 12h10" strokeWidth="2.2" />
    <rect x="4" y="6" width="3" height="12" rx="1" fill={weight === "fill" ? "currentColor" : "none"} />
    <rect x="1.5" y="8.5" width="2.5" height="7" rx="0.8" fill={weight === "fill" ? "currentColor" : "none"} />
    <rect x="17" y="6" width="3" height="12" rx="1" fill={weight === "fill" ? "currentColor" : "none"} />
    <rect x="20" y="8.5" width="2.5" height="7" rx="0.8" fill={weight === "fill" ? "currentColor" : "none"} />
  </svg>;
}
