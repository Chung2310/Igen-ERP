import { useId } from "react";
import type { HealthcareTab } from "../../router/subTabRoutes";

/** Filled 20 px artwork, matching the HR sidebar icons. */
export default function HealthcareSidebarIcon({ name }: { name: HealthcareTab }) {
  const id = useId().replace(/:/g, "");
  const color = `url(#${id})`;
  const cutout = "var(--color-surface-container-lowest)";
  const shapes = {
    patients: (
      <>
        <circle cx="8" cy="7.5" r="3.2" fill={color} />
        <circle cx="17.2" cy="8.7" r="2.6" fill={color} />
        <path
          d="M2.3 19.8v-1.4c0-3.1 2.2-5.1 5.7-5.1s5.7 2 5.7 5.1v1.4H2.3Zm13.1-5.5c3.5-.3 6.3 1.5 6.3 4.6v.9h-5.9v-1.4c0-1.5-.3-2.9-1-4.1h.6Z"
          fill={color}
        />
      </>
    ),
    visits: (
      <>
        <rect x="3.4" y="2.3" width="17.2" height="19.4" rx="3" fill={color} />
        <path
          d="M7.5 7.8h9m-9 3.4h5.4m-5.4 4.2 2.1 2.1 5-5"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    appointments: (
      <>
        <rect x="2.5" y="4.4" width="19" height="17" rx="3" fill={color} />
        <path
          d="M2.8 10h18.4M7.4 2.5v4m9.2-4v4M12 13v5m-2.5-2.5h5"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    care: (
      <>
        <path
          d="M12 21.2S2.5 15.8 2.5 9.6a5.2 5.2 0 0 1 9.5-2.9 5.2 5.2 0 0 1 9.5 2.9c0 6.2-9.5 11.6-9.5 11.6Z"
          fill={color}
        />
        <path
          d="M6.6 12h3l1.2-2 2.3 4.2 1.4-2.2h2.9"
          fill="none"
          stroke={cutout}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    settings: (
      <>
        <rect x="3.2" y="2.5" width="17.6" height="19" rx="3" fill={color} />
        <path
          d="M7.4 8h9.2m-9.2 4h9.2m-9.2 4h5.8"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    equipment: (
      <>
        <rect x="2.2" y="3.4" width="19.6" height="14.7" rx="3" fill={color} />
        <path
          d="M8.3 21h7.4M12 18.2V21M6.7 8.6h10.6m-10.6 3.5h6"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    supplies: (
      <>
        <path d="m12 2 9.2 5v10L12 22l-9.2-5V7L12 2Z" fill={color} />
        <path d="m3 7.2 9 4.8 9-4.8M12 12v9.5" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0">
          <stop offset="0%" stopColor="#00adfc" />
          <stop offset="55%" stopColor="#199bff" />
          <stop offset="100%" stopColor="#7567ff" />
        </linearGradient>
      </defs>
      {shapes[name]}
    </svg>
  );
}
