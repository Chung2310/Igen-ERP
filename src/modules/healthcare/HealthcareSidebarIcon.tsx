import { useId, type SVGProps } from "react";
import type { HealthcareTab } from "../../router/subTabRoutes";

/** Filled 20 px artwork, matching the HR sidebar icons in proportions, gradient, and cutouts. */
export default function HealthcareSidebarIcon({
  name,
  className = "size-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: HealthcareTab }) {
  const id = useId().replace(/:/g, "");
  const main = `url(#${id})`;
  const cutout = "var(--color-surface-container-lowest)";

  const shapes = {
    patients: (
      <>
        <circle cx="9" cy="7.8" r="3.6" />
        <circle cx="17.5" cy="9" r="2.7" />
        <path d="M2.4 19.6c0-3.6 2.6-5.8 6.6-5.8s6.6 2.2 6.6 5.8v1.2H2.4v-1.2Zm13.8-5.9c3.1.2 5.4 2.1 5.4 5.5v1.6h-4.4v-1.2c0-2.1-.5-4-1.4-5.4l.4-.5Z" />
      </>
    ),
    visits: (
      <>
        <path d="M6.2 4.5h2.2v1.3h7.2V4.5h2.2a2.7 2.7 0 0 1 2.7 2.7v12.1a2.7 2.7 0 0 1-2.7 2.7H6.2a2.7 2.7 0 0 1-2.7-2.7V7.2a2.7 2.7 0 0 1 2.7-2.7Z" />
        <rect x="8.5" y="2.2" width="7" height="4.3" rx="1.5" />
        <path
          d="M12 10.2v5.6m-2.8-2.8h5.6"
          fill="none"
          stroke={cutout}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    ),
    appointments: (
      <>
        <rect x="2.7" y="4.5" width="18.6" height="17" rx="3" />
        <path d="M2.7 9.5h18.6" fill="none" stroke={cutout} strokeWidth="1.8" />
        <path
          d="M7.5 2.4v4.2m9-4.2v4.2"
          fill="none"
          stroke={main}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M12 12.6v5m-2.5-2.5h5"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </>
    ),
    care: (
      <>
        <path d="M12 21.1S2.4 15.7 2.4 9.5a5.3 5.3 0 0 1 9.6-3 5.3 5.3 0 0 1 9.6 3c0 6.2-9.6 11.6-9.6 11.6Z" />
        <path
          d="M6.3 12.2h3l1.3-2.3 2.2 4.4 1.4-2.1h3.5"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    settings: (
      <>
        <rect x="3" y="3.2" width="18" height="4.8" rx="1.8" />
        <rect x="3" y="9.6" width="18" height="4.8" rx="1.8" />
        <rect x="3" y="16" width="18" height="4.8" rx="1.8" />
        <circle cx="6.5" cy="5.6" r="1.05" fill={cutout} />
        <circle cx="6.5" cy="12" r="1.05" fill={cutout} />
        <circle cx="6.5" cy="18.4" r="1.05" fill={cutout} />
        <path
          d="M9.8 5.6h7.6M9.8 12h7.6M9.8 18.4h5.2"
          fill="none"
          stroke={cutout}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
    equipment: (
      <>
        <rect x="2.4" y="3.2" width="19.2" height="13.8" rx="2.8" />
        <path
          d="M10.8 17h2.4v2.6h3.2a1.1 1.1 0 1 1 0 2.2H7.6a1.1 1.1 0 1 1 0-2.2h3.2V17Z"
        />
        <path
          d="M6.2 10.2h2.8l1.4-2.6 2.2 5 1.5-2.4h3.7"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    supplies: (
      <>
        <path d="m12 2.2 9.2 4.9v9.8L12 21.8l-9.2-4.9V7.1L12 2.2Z" />
        <path
          d="m3.1 7.3 8.9 4.7 8.9-4.7M12 12v9.4"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </>
    ),
  };

  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill={main}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0%" stopColor="#4db2fa" />
          <stop offset="48%" stopColor="#2196f3" />
          <stop offset="100%" stopColor="#1982e6" />
        </linearGradient>
      </defs>
      {shapes[name]}
    </svg>
  );
}
