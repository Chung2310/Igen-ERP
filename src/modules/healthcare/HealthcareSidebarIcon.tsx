import type { ReactNode, SVGProps } from "react";

export type HealthcareSidebarIconKind =
  | "module" | "patients" | "visits" | "appointments" | "care" | "settings" | "supplies" | "equipment";

type Props = SVGProps<SVGSVGElement> & { kind: HealthcareSidebarIconKind; size?: number | string };

// Match the HR rail's compact 24 px filled silhouettes and semantic theme color.
const cutout = "var(--color-surface-container-lowest)";
const artwork: Record<HealthcareSidebarIconKind, ReactNode> = {
  module: <path fillRule="evenodd" d="M6.4 2.5h11.2A2.4 2.4 0 0 1 20 4.9v16.6H4V4.9a2.4 2.4 0 0 1 2.4-2.4ZM10.5 6a.8.8 0 0 0-.8.8v2H7.8a.8.8 0 0 0-.8.8v1.8c0 .4.4.8.8.8h1.9v1.9c0 .4.4.8.8.8h1.8c.4 0 .8-.4.8-.8v-1.9H15c.4 0 .8-.4.8-.8V9.6a.8.8 0 0 0-.8-.8h-1.9v-2a.8.8 0 0 0-.8-.8h-1.8ZM9.5 21.5v-4.4c0-.4.4-.8.8-.8h3.4c.4 0 .8.4.8.8v4.4h-5Z" clipRule="evenodd" />,
  patients: <>
    <circle cx="12" cy="7.2" r="3.8" />
    <path d="M12 13c-5.2 0-8.3 2.8-8.3 7.3V21h16.6v-.7C20.3 15.8 17.2 13 12 13Z" />
  </>,
  visits: <>
    <rect x="4" y="4.2" width="16" height="17" rx="2.7" />
    <rect x="9" y="2.3" width="6" height="4" rx="1.3" />
    <path d="M12 9v5m-2.5-2.5h5M8 17.5h8" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
  </>,
  appointments: <>
    <rect x="3" y="4.4" width="18" height="17" rx="2.7" />
    <path d="M3 9.4h18m-13-7v4m8-4v4" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
    <path d="m8.2 15.2 2.5 2.4 5.1-5.1" fill="none" stroke={cutout} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  care: <>
    <path d="M12 21.3 4 14.1C-.5 10.1 3.1 3 8 4.3c1.7.5 3 1.7 4 3 1-1.3 2.3-2.5 4-3 4.9-1.3 8.5 5.8 4 9.8L12 21.3Z" />
    <path d="M12 9.6v5m-2.5-2.5h5" fill="none" stroke={cutout} strokeWidth="1.9" strokeLinecap="round" />
  </>,
  settings: <>
    <rect x="4" y="2.5" width="16" height="19" rx="2.8" />
    <path d="M8 7.7h1m3 0h4M8 12h1m3 0h4M8 16.3h1m3 0h4" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
  </>,
  supplies: <>
    <path d="M9 3h6a2 2 0 0 1 2 2v2h-2V5H9v2H7V5a2 2 0 0 1 2-2Z" />
    <path fillRule="evenodd" d="M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm7 4v2H9v2h2v2h2v-2h2v-2h-2v-2h-2Z" clipRule="evenodd" />
  </>,
  equipment: <>
    <path fillRule="evenodd" d="M4 3h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 3v10h12V6H6Zm2 5h2l1.3-2.2a.6.6 0 0 1 1 .1l1.2 3 1-1.5H16v1.5h-2.3l-1.1 1.7a.6.6 0 0 1-1.1-.1l-1.1-2.8-.5.8H8V11Z" clipRule="evenodd" />
    <path d="M11 19h2v2h4a1 1 0 0 1 0 2H7a1 1 0 0 1 0-2h4v-2Z" />
  </>,
};

export default function HealthcareSidebarIcon({ kind, size = 24, ...props }: Props) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor"
    aria-hidden="true" focusable="false" {...props}>{artwork[kind]}</svg>;
}
