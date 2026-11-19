import type { SVGProps } from "react";

/** Chuỗi phòng tập: ba điểm kết nối quanh một quả tạ. */
export default function GymModuleIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M7.5 12h9M5.5 9v6M7.5 8v8M16.5 8v8M18.5 9v6" />
    <path d="M5.5 4.5h13M5.5 19.5h13M5.5 4.5v1.7M18.5 4.5v1.7M5.5 17.8v1.7M18.5 17.8v1.7" strokeWidth="1.35" />
    <circle cx="5.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="5.5" cy="19.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="19.5" r="1" fill="currentColor" stroke="none" />
  </svg>;
}
