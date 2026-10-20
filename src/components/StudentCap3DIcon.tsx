import { useId } from "react";

interface StudentCap3DIconProps {
  className?: string;
}

export function StudentCap3DIcon({ className }: StudentCap3DIconProps) {
  const id = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${id}-top`} x1="4" y1="4" x2="18" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B7A2FF" />
          <stop offset="0.55" stopColor="#8162D5" />
          <stop offset="1" stopColor="#513895" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="8" y1="12" x2="17" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6D4EB8" />
          <stop offset="1" stopColor="#38246E" />
        </linearGradient>
        <linearGradient id={`${id}-tassel`} x1="18" y1="9" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE190" />
          <stop offset="1" stopColor="#E79928" />
        </linearGradient>
      </defs>
      <ellipse cx="12" cy="20.5" rx="8.2" ry="1.4" fill="#32205A" opacity="0.15" />
      <path d="M5.7 11.5v4.1c0 2 2.8 3.6 6.3 3.6s6.3-1.6 6.3-3.6v-4.1L12 14.8l-6.3-3.3Z" fill={`url(#${id}-side)`} />
      <path d="M5.7 15.1c1.2 1.4 3.5 2.3 6.3 2.3s5.1-.9 6.3-2.3v1.1c0 1.8-2.8 3.2-6.3 3.2s-6.3-1.4-6.3-3.2v-1.1Z" fill="#493084" />
      <path d="M1.8 9.3 11 4.7c.6-.3 1.4-.3 2 0l9.2 4.6c.7.4.7 1.3 0 1.7L13 15.6c-.6.3-1.4.3-2 0L1.8 11c-.7-.4-.7-1.3 0-1.7Z" fill={`url(#${id}-top)`} stroke="#4E368E" strokeWidth="0.6" />
      <path d="m2.2 9.8 9 4.5c.5.2 1.1.2 1.6 0l9-4.5" stroke="#D2C5FF" strokeWidth="0.7" opacity="0.8" />
      <path d="m12 9.5 7.2 2.1v5.1" stroke="#F4B84F" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19.2" cy="17.1" r="1.1" fill={`url(#${id}-tassel)`} />
      <path d="m18.5 17.8-.7 2.3 1.4-.5 1.4.5-.7-2.3" fill={`url(#${id}-tassel)`} />
      <path d="M5.4 8.4 11 5.6" stroke="#E4DAFF" strokeWidth="0.8" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}
