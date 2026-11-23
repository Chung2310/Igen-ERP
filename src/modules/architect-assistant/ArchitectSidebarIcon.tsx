import { useId, type SVGProps } from "react";
import type { ArchitectureToolId } from "../../shared/architecture-assistant";

export type ArchitectSidebarIconName = "back" | ArchitectureToolId;

/** Filled 24 px sidebar icons with the HR brand gradient and cutouts. */
export default function ArchitectSidebarIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: ArchitectSidebarIconName }) {
  const gradientId = useId().replace(/:/g, "");
  const fill = `url(#${gradientId})`;
  const cutout = "var(--color-surface-container-lowest)";

  const shape = {
    back: (
      <>
        <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="4.5" />
        <path
          d="M15.5 12H8.8m0 0 3.2-3.2M8.8 12l3.2 3.2"
          fill="none"
          stroke={cutout}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    plan: (
      <>
        <rect x="2.8" y="3" width="18.4" height="18" rx="3" />
        <path
          d="M2.8 10.5h9.2v10.5M12 10.5h3.5M12 3v4.5M17.5 15.5h3.7"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    render: (
      <>
        <rect x="2.6" y="3.8" width="18.8" height="16.4" rx="3" />
        <circle cx="8.4" cy="9.2" r="1.7" fill={cutout} />
        <path
          d="m4.8 18.2 5.4-5.4a1.2 1.2 0 0 1 1.7 0l2.2 2.2 1.8-1.8a1.2 1.2 0 0 1 1.7 0l2.4 2.4v2.6H4.8Z"
          fill={cutout}
        />
      </>
    ),
    enhance: (
      <>
        <path d="m11.5 2.2 2.2 6.5 6.5 2.2-6.5 2.2-2.2 6.5-2.2-6.5-6.5-2.2 6.5-2.2 2.2-6.5Z" />
        <path d="m18.5 15 1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1 1.1-2.7Z" />
      </>
    ),
    upscale: (
      <>
        <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="3.2" />
        <path
          d="M14 7.2h2.8V10m0-2.8-4 4M10 16.8H7.2V14m0 2.8 4-4"
          fill="none"
          stroke={cutout}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    sync: (
      <>
        <path d="m12 2.6 9.2 4.8-9.2 4.8-9.2-4.8L12 2.6Z" />
        <path
          d="m3.4 12.2 8.6 4.5 8.6-4.5"
          fill="none"
          stroke={fill}
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m3.4 16.4 8.6 4.5 8.6-4.5"
          fill="none"
          stroke={fill}
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    edit: (
      <>
        <path d="m15.3 3.4 5.3 5.3-11 11-6.2 1.2 1.2-6.2 10.7-11.3Z" />
        <path
          d="m13.1 5.6 5.3 5.3"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    staging: (
      <>
        <path d="M5.5 6.8A2.8 2.8 0 0 1 8.3 4h7.4a2.8 2.8 0 0 1 2.8 2.8v4.4H5.5V6.8Z" />
        <path d="M2.5 11.4a2.2 2.2 0 0 1 2.2-2.2h1.6v4.6h11.4V9.2h1.6a2.2 2.2 0 0 1 2.2 2.2v5.4a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-5.4Z" />
        <path
          d="M6.2 18.8v2M17.8 18.8v2"
          fill="none"
          stroke={fill}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </>
    ),
    canvas: (
      <>
        <rect x="2.6" y="2.6" width="8.4" height="8.4" rx="2.2" />
        <rect x="13" y="2.6" width="8.4" height="8.4" rx="2.2" />
        <rect x="2.6" y="13" width="8.4" height="8.4" rx="2.2" />
        <rect x="13" y="13" width="8.4" height="8.4" rx="2.2" />
      </>
    ),
    utilities: (
      <>
        <path d="M20.6 6.4a5.4 5.4 0 0 1-7.1 6.7l-7.2 7.2a2.2 2.2 0 0 1-3.1-3.1l7.2-7.2a5.4 5.4 0 0 1 6.7-7.1l-3.1 3.1.9 2.6 2.6.9 3.1-3.1Z" />
      </>
    ),
    visual: (
      <>
        <rect x="2.8" y="4" width="18.4" height="16" rx="3" />
        <circle cx="12" cy="12" r="3.4" fill={cutout} />
        <circle cx="12" cy="12" r="1.4" />
      </>
    ),
    texture: (
      <>
        <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="3" />
        <path
          d="M7.5 7.5h4v4h-4zm5 5h4v4h-4z"
          fill={cutout}
        />
      </>
    ),
    human: (
      <>
        <circle cx="12" cy="7.5" r="3.8" />
        <path d="M3.5 20.5c0-4 3.4-6.7 8.5-6.7s8.5 2.7 8.5 6.7v.8h-17v-.8Z" />
      </>
    ),
    video: (
      <>
        <rect x="2.4" y="5.2" width="14.2" height="13.6" rx="3" />
        <path d="m16.6 10.2 5-3v9.6l-5-3v-3.6Z" />
        <path d="m8 9.6 4.2 2.4L8 14.4V9.6Z" fill={cutout} />
      </>
    ),
    library: (
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
    renders: (
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
