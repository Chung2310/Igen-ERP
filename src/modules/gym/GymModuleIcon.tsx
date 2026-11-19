import type { SVGProps } from "react";

type GymModuleIconProps = SVGProps<SVGSVGElement> & { size?: number | string; weight?: "regular" | "fill" | string };

/** Ba cơ sở kết nối và quả tạ ở trung tâm. */
export default function GymModuleIcon({ size = 24, weight = "regular", ...props }: GymModuleIconProps) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M4 6.5h16M4 8v3m8-3v2m8-2v3" strokeWidth="1.4" />
    <circle cx="4" cy="6.5" r={weight === "fill" ? "1.7" : "1.3"} fill="currentColor" stroke="none" />
    <circle cx="12" cy="6.5" r={weight === "fill" ? "1.7" : "1.3"} fill="currentColor" stroke="none" />
    <circle cx="20" cy="6.5" r={weight === "fill" ? "1.7" : "1.3"} fill="currentColor" stroke="none" />
    <path d="M6 15.5h12M3 12.5v6m3-7v8m12-8v8m3-7v6" strokeWidth="2" />
  </svg>;
}
