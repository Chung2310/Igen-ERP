import { useId, type SVGProps } from 'react';
import type { HrSidebarIconName } from './HrSidebarIcon';

export type HrFilledIconName = HrSidebarIconName;

function HrBrandGradient({ id }: { id: string }) {
  return <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0">
    <stop offset="0%" stopColor="#00adfc" />
    <stop offset="55%" stopColor="#199bff" />
    <stop offset="100%" stopColor="#7567ff" />
  </linearGradient>;
}

/** Filled companion to the rounded HR navigation icons. */
export function HrFilledSidebarIcon({ name, twoTone = false, ...props }: SVGProps<SVGSVGElement> & { name: HrFilledIconName; twoTone?: boolean }) {
  const gradientId = useId().replace(/:/g, '');
  const main = twoTone ? `url(#${gradientId})` : 'currentColor';
  const detail = main;
  const light = main;
  const cutout = 'var(--color-surface-container-lowest)';
  const shape = {
    organization: <>
      <rect x="2.7" y="2.8" width="6.3" height="6.3" rx="2" fill={light} />
      <rect x="15" y="8.9" width="6.3" height="6.3" rx="2" />
      <rect x="15" y="17" width="6.3" height="4.3" rx="1.7" fill={detail} />
      <path d="M5 9h2.3v5.3h5.5v-3H15v5.2H8.5A3.5 3.5 0 0 1 5 13V9Zm6.7 6.4H14v3.7h1v2.2h-1.3a2 2 0 0 1-2-2v-3.9Z" />
    </>,
    department: <>
      <path d="M4 20.4V7.2A2.2 2.2 0 0 1 6.2 5H10V4a2 2 0 0 1 2-2h5.2a2 2 0 0 1 2 2v16.4H4Z" />
      <path d="M7.4 8.5h2v2h-2zm5.2-2h2v2h-2zm3.3 0h2v2h-2zm-8.5 6h2v2h-2zm5.2-2h2v2h-2zm3.3 0h2v2h-2zm-5.2 6h3.8v3.9h-3.8z" fill={cutout} />
      <rect x="2.6" y="20" width="18.8" height="2" rx="1" fill={detail} />
    </>,
    branch: <path fillRule="evenodd" d="M12 2.2a7.5 7.5 0 0 0-7.5 7.5c0 5.4 5.9 11.1 6.8 11.9a1 1 0 0 0 1.4 0c.9-.8 6.8-6.5 6.8-11.9A7.5 7.5 0 0 0 12 2.2Zm0 4.6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" clipRule="evenodd" />,
    training: <>
      <path d="m2.2 8.7 9.1-4.5a1.7 1.7 0 0 1 1.4 0l9.1 4.5a1 1 0 0 1 0 1.8l-9.1 4.5a1.7 1.7 0 0 1-1.4 0l-9.1-4.5a1 1 0 0 1 0-1.8Z" />
      <path d="M5.8 12.8v4.1c3.7 3 8.7 3 12.4 0v-4.1l-5.3 2.6a2 2 0 0 1-1.8 0l-5.3-2.6Zm14.7-2.1H22v6h-1.5z" fill={detail} />
      <circle cx="21.25" cy="18.5" r="1.3" fill={light} />
    </>,
    workflow: <>
      <rect x="2.6" y="2.7" width="7.2" height="6.4" rx="2" fill={light} />
      <rect x="14.2" y="14.9" width="7.2" height="6.4" rx="2" fill={detail} />
      <path d="M5 9.1h2.4v4.2c0 .8.5 1.3 1.3 1.3h5.5V17H8.7A3.7 3.7 0 0 1 5 13.3V9.1Zm13 5.8h-2.4v-4.2c0-.8-.5-1.3-1.3-1.3H9.8V7h4.5a3.7 3.7 0 0 1 3.7 3.7v4.2Z" />
    </>,
    tasks: <>
      <path d="M6.2 4.5h2.2v1.3h7.2V4.5h2.2a2.7 2.7 0 0 1 2.7 2.7v12.1a2.7 2.7 0 0 1-2.7 2.7H6.2a2.7 2.7 0 0 1-2.7-2.7V7.2a2.7 2.7 0 0 1 2.7-2.7Z" />
      <rect x="8.5" y="2.2" width="7" height="4.3" rx="1.5" fill={detail} />
      <path d="M8 11h1m2.5 0H17M8 15.5h1m2.5 0H17" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
    </>,
    calendar: <>
      <rect x="2.7" y="4.5" width="18.6" height="17" rx="3" />
      <path d="M2.7 9.5h18.6" fill="none" stroke={cutout} strokeWidth="1.8" />
      <path d="M7.5 2.4v4.2m9-4.2v4.2" fill="none" stroke={detail} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="8" cy="13.5" r="1" fill={cutout} /><circle cx="12" cy="13.5" r="1" fill={cutout} /><circle cx="16" cy="13.5" r="1" fill={cutout} />
      <circle cx="8" cy="17.4" r="1" fill={cutout} /><circle cx="12" cy="17.4" r="1" fill={cutout} />
    </>,
    contract: <>
      <path d="M6.4 2.4h7.3l4.8 4.8v7.1l-6.2 6.2H6.4A2.4 2.4 0 0 1 4 18.1V4.8a2.4 2.4 0 0 1 2.4-2.4Z" />
      <path d="M13.7 2.4v4a.8.8 0 0 0 .8.8h4" fill={cutout} />
      <path d="M7.6 10.6h5.5m-5.5 3.3h3.5" fill="none" stroke={cutout} strokeWidth="1.7" strokeLinecap="round" />
      <path d="m14 19.3 5.3-5.3a1.8 1.8 0 0 1 2.5 2.5l-5.3 5.3-3.4.7.9-3.2Z" fill={detail} />
    </>,
    payroll: <>
      <rect x="4.5" y="2.8" width="15" height="2.2" rx="1" fill={detail} />
      <rect x="2.3" y="6" width="19.4" height="15" rx="3" />
      <path d="M6.6 10.8h4m-4 4.2h2.7" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.4" cy="13.6" r="2.7" fill={cutout} /><circle cx="16.4" cy="13.6" r="1.1" fill={detail} />
    </>,
    celebration: <>
      <rect x="2.4" y="6" width="19.2" height="15" rx="3" />
      <path d="m3.8 8.4 7.3 5.5a1.5 1.5 0 0 0 1.8 0l7.3-5.5" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 2v2.5m-1.25-1.25h2.5" fill="none" stroke={detail} strokeWidth="1.8" strokeLinecap="round" />
    </>,
    recruitment: <>
      <circle cx="8.8" cy="8" r="3.5" />
      <path d="M2.5 18.4c0-3.2 2.4-5.1 6.3-5.1 2.1 0 3.8.6 4.9 1.6a5.4 5.4 0 0 0-1 3.2v2.1H4.3a1.8 1.8 0 0 1-1.8-1.8Z" />
      <circle cx="17.3" cy="16.3" r="3.5" fill={detail} />
      <path d="m19.6 18.8 2.2 2.2" fill="none" stroke={detail} strokeWidth="2.5" strokeLinecap="round" />
    </>,
    business: <><path d="M3 21V7a2 2 0 0 1 2-2h5V3h9a2 2 0 0 1 2 2v16H3Z"/><path d="M6 9h2m-2 4h2m5-6h4m-4 4h4m-4 4h4" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round"/><path d="M9 17h4v4H9Z" fill={cutout}/></>,
    finance: <><path d="m2 9 10-6 10 6v2H2V9Zm2 3h3v7H4zm6 0h4v7h-4zm7 0h3v7h-3zM2 20h20v2H2z"/></>,
    retail: <><path d="M3 9h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Zm2-6h14l3 6H2l3-6Z"/><path d="M7 13h4v9H7zm8 0h4v4h-4z" fill={cutout}/></>,
    people: <><circle cx="9" cy="8" r="4"/><circle cx="18" cy="9" r="3"/><path d="M2 20c0-4 2.8-6.5 7-6.5s7 2.5 7 6.5v1H2Zm14.7-6.6c3.3.3 5.3 2.5 5.3 6.1V21h-4v-1c0-2.2-.5-4-1.3-5.6Z"/></>,
    students: <><path d="m2 9 10-5 10 5-10 5L2 9Zm4 5 6 2.8 6-2.8v4.2c-3.7 2.5-8.3 2.5-12 0V14Zm14-3h2v7h-2z"/></>,
    labor: <><rect x="3" y="7" width="18" height="14" rx="2.5"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" strokeWidth="2.3"/><path d="M4 13h16m-9 0h2" fill="none" stroke={cutout} strokeWidth="2"/></>,
    marketing: <><path d="M3 10h5l10-6v16L8 14H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2Zm4 5h3l2 6H8l-1-6Z"/><path d="m20 8 2-2m-2 8 2 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
  }[name];

  return <svg {...props} viewBox="0 0 24 24" fill={main} aria-hidden="true" focusable="false">
    {twoTone && <defs><HrBrandGradient id={gradientId} /></defs>}
    {shape}
  </svg>;
}

export function HrFilledSidebarToggleIcon({ collapsed, twoTone = false }: { collapsed: boolean; twoTone?: boolean }) {
  const gradientId = useId().replace(/:/g, '');
  const cutout = 'var(--color-surface-container-lowest)';
  return <svg className="size-5 text-primary" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    {twoTone ? <>
      <defs><HrBrandGradient id={gradientId} /></defs>
      <rect x="2" y="2" width="20" height="20" rx="4" fill={`url(#${gradientId})`} />
      <path d="M9 3.5v17" fill="none" stroke={cutout} strokeWidth="2" />
      <path d={collapsed ? 'm14 9 3 3-3 3' : 'm17 9-3 3 3 3'} fill="none" stroke={cutout} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </> : <>
      <path fillRule="evenodd" d="M5.5 2.5h13A3.5 3.5 0 0 1 22 6v12a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 18V6a3.5 3.5 0 0 1 3.5-3.5Zm0 2.2A1.3 1.3 0 0 0 4.2 6v12a1.3 1.3 0 0 0 1.3 1.3H9V4.7H5.5Zm6 0v14.6h7a1.3 1.3 0 0 0 1.3-1.3V6a1.3 1.3 0 0 0-1.3-1.3h-7Z" clipRule="evenodd" />
      <path d={collapsed ? 'm14 9 3 3-3 3' : 'm17 9-3 3 3 3'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>}
  </svg>;
}
