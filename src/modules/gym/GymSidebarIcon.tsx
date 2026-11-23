import { useId, type SVGProps } from "react";
import type { GymTab } from "../../../shared/gym/types";

/** Filled 24 px sidebar icons with the HR brand gradient and cutouts. */
export default function GymSidebarIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: GymTab }) {
  const gradientId = useId().replace(/:/g, "");
  const fill = `url(#${gradientId})`;
  const cutout = "var(--color-surface-container-lowest)";

  const shape = {
    customers: (
      <>
        <circle cx="9" cy="8" r="3.6" />
        <circle cx="17.5" cy="9" r="2.7" />
        <path d="M2.4 20c0-3.7 2.6-6 6.6-6s6.6 2.3 6.6 6v1H2.4v-1Zm13.8-6c3.1.3 5.4 2.2 5.4 5.6V21h-4.4v-1c0-2.2-.5-4-1.3-5.6l.3-.4Z" />
      </>
    ),
    measurements: (
      <>
        <rect x="3" y="3.5" width="18" height="17" rx="3" />
        <path
          d="M7.5 11.2a4.5 4.5 0 0 1 9 0"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M12 11.5 14.3 8.8M7.5 16h9"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    "nutrition-plans": (
      <>
        <path d="M3 12.2h18v1a7.8 7.8 0 0 1-7.8 7.8h-2.4A7.8 7.8 0 0 1 3 13.2v-1Z" />
        <path d="M12.2 10.6c0-4.2 2.8-7 7.1-7.2-.2 4.3-2.9 7.2-7.1 7.2Z" />
        <path d="M10.4 10.6c-2.7 0-4.6-1.7-5-4.4 2.8.3 4.8 1.8 5 4.4Z" />
        <path
          d="M7.8 16h8.4"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    roadmaps: (
      <>
        <rect x="2.6" y="2.8" width="6.4" height="6.4" rx="2" />
        <rect x="15" y="14.8" width="6.4" height="6.4" rx="2" />
        <path
          d="M9 6h4.5a3.5 3.5 0 0 1 0 7h-3a3.5 3.5 0 0 0 0 7H15"
          fill="none"
          stroke={fill}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </>
    ),
    "workout-templates": (
      <>
        <path d="M6.2 4.5h2.2v1.3h7.2V4.5h2.2a2.7 2.7 0 0 1 2.7 2.7v12.1a2.7 2.7 0 0 1-2.7 2.7H6.2a2.7 2.7 0 0 1-2.7-2.7V7.2a2.7 2.7 0 0 1 2.7-2.7Z" />
        <rect x="8.5" y="2.2" width="7" height="4.2" rx="1.5" />
        <path
          d="M8 11.2h8M8 15.2h5.5"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    progress: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path
          d="m7 15.2 3.2-3.4 2.6 2.2 4.2-5"
          fill="none"
          stroke={cutout}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.6 9h2.4v2.4"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    knowledge: (
      <>
        <path d="M2.8 6.5A2.5 2.5 0 0 1 5.3 4h4.2l2 2.2h7.2a2.5 2.5 0 0 1 2.5 2.5v9.8a2.5 2.5 0 0 1-2.5 2.5H5.3a2.5 2.5 0 0 1-2.5-2.5V6.5Z" />
        <path
          d="M7.5 12h9m-9 3.5h6"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    trainers: (
      <>
        <path d="M12 2.2 20.4 5.8v5.8c0 4.9-3.2 8.2-8.4 10.2-5.2-2-8.4-5.3-8.4-10.2V5.8L12 2.2Z" />
        <path
          d="m8.6 12.1 2.3 2.3 4.7-4.8"
          fill="none"
          stroke={cutout}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    transfers: (
      <>
        <rect x="2.4" y="3.6" width="7.6" height="7" rx="2" />
        <rect x="14" y="13.4" width="7.6" height="7" rx="2" />
        <path
          d="M11 7h8m-2.6-2.5L19 7l-2.6 2.5M13 17H5m2.6-2.5L5 17l2.6 2.5"
          fill="none"
          stroke={fill}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  }[name];

  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill={fill}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2="24"
          y2="0"
        >
          <stop offset="0%" stopColor="#00adfc" />
          <stop offset="55%" stopColor="#199bff" />
          <stop offset="100%" stopColor="#7567ff" />
        </linearGradient>
      </defs>
      {shape}
    </svg>
  );
}
