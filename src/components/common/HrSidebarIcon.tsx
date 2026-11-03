import type { SVGProps } from 'react';

export type HrSidebarIconName =
  | 'organization' | 'department' | 'branch' | 'training' | 'workflow'
  | 'tasks' | 'calendar' | 'contract' | 'payroll' | 'celebration' | 'recruitment'
  | 'business' | 'finance' | 'retail' | 'people' | 'students' | 'labor' | 'marketing';

/** Original, rounded line artwork for the HR navigation. */
export function HrSidebarIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: HrSidebarIconName }) {
  const shape = {
    organization: <><rect x="3.25" y="3" width="5.5" height="5.5" rx="1.65"/><path d="M6 8.5v7.2m0 0h5.2m0 0V12.9c0-1 .7-1.7 1.7-1.7h3.2"/><rect x="15.2" y="9.25" width="5.5" height="5.5" rx="1.65"/><rect x="15.2" y="17" width="5.5" height="4" rx="1.5"/><path d="M11.2 15.7v3.3h4"/></>,
    department: <><path d="M4.5 20V7.2c0-1 .8-1.7 1.7-1.7h4.1V3.8c0-.9.7-1.5 1.5-1.5h5.7c.9 0 1.5.6 1.5 1.5V20"/><path d="M3 20.3h18M8 9.5h1m-1 3.5h1m6-3.5h1m-1 3.5h1m-5 7v-3.5h2.5V20"/></>,
    branch: <><path d="M12 21s6.8-6.3 6.8-11.5a6.8 6.8 0 0 0-13.6 0C5.2 14.7 12 21 12 21Z"/><circle cx="12" cy="9.4" r="2.4"/></>,
    training: <><path d="m2.4 9.3 9.6-4.5 9.6 4.5-9.6 4.6-9.6-4.6Z"/><path d="M6.1 11.2v5c3.4 2.9 8.4 2.9 11.8 0v-5M21.6 9.4v7.2"/><circle cx="21.6" cy="18.6" r="1"/></>,
    workflow: <><rect x="3" y="3.1" width="7" height="5.3" rx="1.8"/><rect x="14" y="15.6" width="7" height="5.3" rx="1.8"/><path d="M6.5 8.4v5.9c0 1.4 1 2.3 2.3 2.3H14m3.5-1V10c0-1.4-1-2.3-2.3-2.3H10"/><path d="m12.7 5.6-2.7 2.1 2.7 2.1"/></>,
    tasks: <><rect x="4" y="4.5" width="16" height="17" rx="2.7"/><path d="M9 4.5v-1c0-.8.6-1.4 1.4-1.4h3.2c.8 0 1.4.6 1.4 1.4v1M8 10h.2m3.1 0h5M8 15h.2m3.1 0h5"/></>,
    calendar: <><rect x="3" y="5.4" width="18" height="16" rx="2.8"/><path d="M7.6 2.4v5.4m8.8-5.4v5.4M3 10.1h18"/><path d="M8 14.2h.2m3.8 0h.2m3.8 0h.2M8 18h.2m3.8 0h.2"/></>,
    contract: <><path d="M13.9 3.2H6.7c-1.4 0-2.4 1-2.4 2.4v13.1c0 1.4 1 2.4 2.4 2.4h10.8"/><path d="m13.9 3.2 4.5 4.5h-4.5V3.2ZM8 11h5m-5 3h3"/><path d="m13.4 18.8 5.8-5.8a1.7 1.7 0 0 1 2.3 2.3l-5.8 5.8-3.2.7.9-3Z"/></>,
    payroll: <><rect x="2.7" y="5.4" width="18.6" height="13.2" rx="3.1"/><path d="M6.4 9h4.3m-4.3 5.9h3.2"/><circle cx="16.7" cy="12" r="2.4"/><path d="M4.8 5.4V3.3h14.4"/></>,
    celebration: <><rect x="2.8" y="5.8" width="18.4" height="14.1" rx="2.7"/><path d="m3.8 7 8.2 6.4L20.2 7"/><path d="M16.8 2.2v2.5m-1.25-1.25h2.5"/></>,
    recruitment: <><circle cx="9.3" cy="8" r="3.1"/><path d="M3.2 19.6v-1.4c0-2.6 2.3-4.3 6.1-4.3 1.6 0 2.9.3 3.9 1"/><circle cx="17.3" cy="16.7" r="3.2"/><path d="m19.6 19 2 2"/></>,
    business: <><rect x="4" y="5" width="16" height="16" rx="2.8"/><path d="M8.2 5V3.2h7.6V5M8 9.5h1m5 0h1m-7 3.7h1m5 0h1M9.5 21v-4h5v4"/></>,
    finance: <><path d="M2.7 9.1 12 4l9.3 5.1M4 10.5h16M5.1 19.9h13.8M3.2 21.6h17.6M7.2 11.5v7.2m4.8-7.2v7.2m4.8-7.2v7.2"/><circle cx="12" cy="7.8" r=".7"/></>,
    retail: <><path d="m3.1 5.2 1.4 1.2 2 10.1h11.9l2.1-7.9H5.1"/><path d="M8 12.4h8.9"/><circle cx="8.3" cy="20.3" r="1.2"/><circle cx="17.3" cy="20.3" r="1.2"/></>,
    people: <><circle cx="8.5" cy="8" r="2.7"/><circle cx="16.7" cy="9" r="2.2"/><path d="M2.8 19.5v-1.2c0-2.9 2.2-4.8 5.7-4.8s5.7 1.9 5.7 4.8v1.2m2.6-5c2.7 0 4.4 1.5 4.4 4v1"/></>,
    students: <><path d="m2.5 8.6 9.5-4.2 9.5 4.2-9.5 4.3-9.5-4.3ZM5.7 11v5.3c3.8 2.5 8.8 2.5 12.6 0V11m3.2-2.4v7.2"/><circle cx="21.5" cy="17.9" r=".7"/></>,
    labor: <><rect x="3.2" y="7" width="17.6" height="13.2" rx="2.7"/><path d="M8.3 7V5c0-1.1.9-2 2-2h3.4c1.1 0 2 .9 2 2v2M3.2 12h17.6m-10.4 0v2h3.2v-2"/></>,
    marketing: <><path d="M3 10.4v4.1c0 1 .7 1.7 1.7 1.7h2.8l2.1 4.3h2.8l-2-4.8 8.1-3.6V6.9L7.5 10.4H4.7c-1 0-1.7 0-1.7 0Z"/><path d="M20.3 8.4c1.3 1.4 1.3 3.1 0 4.4M7.5 10.4v5.8"/></>,
  }[name];

  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shape}</svg>;
}
