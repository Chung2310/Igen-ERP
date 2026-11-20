import { useId, type ReactNode } from 'react';

export type GymSidebarIconName =
  | 'customers' | 'transfer' | 'knowledge' | 'profile' | 'dashboard'
  | 'body' | 'nutrition' | 'roadmap' | 'workout' | 'progress'
  | 'assistant' | 'sessions' | 'me' | 'admin' | 'trainers' | 'packages';

function GymGlyph({ name }: { name: GymSidebarIconName }) {
  const gradientId = useId().replace(/:/g, '');
  const fill = `url(#${gradientId})`;
  const detail = 'var(--gym-erp-card)';

  const glyphs: Record<GymSidebarIconName, ReactNode> = {
    customers: (
      <>
        <circle cx="8.5" cy="7.5" r="3.1" fill={fill} />
        <circle cx="17.2" cy="8.5" r="2.4" fill={fill} />
        <path d="M2.5 19.5c0-3.2 2.6-5.5 6-5.5s6 2.3 6 5.5v1h-12v-1Z" fill={fill} />
        <path d="M15.5 14.4c3.5-.1 6 2.1 6 5v1h-4.8" fill={fill} />
      </>
    ),
    transfer: (
      <>
        <path d="M3 6.5h14l-3.2-3.2 1.4-1.4L21 7.7l-5.8 5.8-1.4-1.4L17 9H3V6.5Z" fill={fill} stroke="none" />
        <path d="M21 17.5H7l3.2 3.2-1.4 1.4L3 16.3l5.8-5.8 1.4 1.4L7 15h14v2.5Z" fill={fill} stroke="none" />
      </>
    ),
    knowledge: (
      <>
        <path d="M3 5.2c3.1-1.3 6.1-1.1 9 1.1 2.9-2.2 5.9-2.4 9-1.1v14c-3.1-1.3-6.1-1.1-9 1.1-2.9-2.2-5.9-2.4-9-1.1v-14Z" fill={fill} />
        <path d="M12 6.5v13.8M5.5 8c1.7-.5 3.2-.2 4.5.5M18.5 8c-1.7-.5-3.2-.2-4.5.5" stroke={detail} />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="7.7" r="3.5" fill={fill} />
        <path d="M4.2 20c0-4.1 3.2-6.5 7.8-6.5s7.8 2.4 7.8 6.5v.5H4.2V20Z" fill={fill} />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1.8" fill={fill} />
        <rect x="13" y="3" width="8" height="5" rx="1.8" fill={fill} />
        <rect x="13" y="10" width="8" height="11" rx="1.8" fill={fill} />
        <rect x="3" y="13" width="8" height="8" rx="1.8" fill={fill} />
      </>
    ),
    body: (
      <>
        <circle cx="12" cy="5.7" r="2.7" fill={fill} />
        <path d="M7.2 11h9.6l2.2 9H5l2.2-9Z" fill={fill} />
        <path d="M9.2 11.4 12 15l2.8-3.6" stroke={detail} />
      </>
    ),
    nutrition: (
      <>
        <path d="M7.5 8.5c-.8-1.2-.8-2.5 0-3.7M12 7.5c-.8-1.2-.8-2.5 0-3.7M16.5 8.5c.8-1.2.8-2.5 0-3.7" fill="none" />
        <path d="M3.2 11h17.6l-1.5 5.2a6.9 6.9 0 0 1-6.6 4.8h-1.4a6.9 6.9 0 0 1-6.6-4.8L3.2 11Z" fill={fill} />
        <path d="M6.2 14.5h11.6" stroke={detail} />
      </>
    ),
    roadmap: (
      <>
        <path d="m3 5 5-2 8 2 5-2v16l-5 2-8-2-5 2V5Z" fill={fill} />
        <path d="M8 3v16M16 5v16" stroke={detail} />
        <path d="M5.2 14.5c1.2-3.5 3.2-4.4 5.1-2.4s3.3 2.4 5.5-2.7" stroke={detail} />
        <circle cx="15.8" cy="9.4" r="1.1" fill={detail} stroke="none" />
      </>
    ),
    workout: (
      <>
        <rect x="2.5" y="9" width="2" height="6" rx="1" fill={fill} />
        <rect x="6.5" y="6.5" width="2.5" height="11" rx="1" fill={fill} />
        <path d="M9 12h6" />
        <rect x="15.5" y="6.5" width="2.5" height="11" rx="1" fill={fill} />
        <rect x="19.5" y="9" width="2" height="6" rx="1" fill={fill} />
      </>
    ),
    packages: (
      <>
        <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Z" fill={fill} stroke="none" />
        <path d="m3.5 7 8.5 4 8.5-4M12 11v9M8.1 4.8l8.7 4.1M7 13.5l2.5 1.2" stroke={detail} />
      </>
    ),
    progress: (
      <>
        <path d="M3.5 20.5V4M3.5 20.5h17" />
        <path d="M6.5 16.5 10 12l3.2 2.3 5.3-7.1" />
        <path d="M15.5 7.2h3v3" />
        <path d="M5.5 18.5 10 13l3.2 2.3 4.4-5.9v8.6H5.5Z" fill={fill} stroke="none" />
        <path d="M6.5 16.5 10 12l3.2 2.3 5.3-7.1M15.5 7.2h3v3" stroke={detail} />
      </>
    ),
    assistant: (
      <>
        <path d="M4 4.5h13a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-5.5 3v-3.2A3 3 0 0 1 3 14.5v-7a3 3 0 0 1 1-3Z" fill={fill} />
        <path d="m11 7 .8 2.2L14 10l-2.2.8L11 13l-.8-2.2L8 10l2.2-.8L11 7ZM16.5 12l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3Z" fill={detail} stroke="none" />
      </>
    ),
    sessions: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" fill={fill} />
        <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" stroke={detail} />
        <path d="m8 15 2.3 2.3L16 12" stroke={detail} strokeWidth="1.5" />
      </>
    ),
    me: (
      <>
        <rect x="2.8" y="4.2" width="18.4" height="15.6" rx="2.2" fill={fill} />
        <circle cx="8.3" cy="10" r="2.3" fill={detail} stroke="none" />
        <path d="M4.7 16c.5-2 1.7-3 3.6-3s3.1 1 3.6 3M14 9h4.3M14 12h4.3M14 15h2.8" stroke={detail} />
      </>
    ),
    admin: (
      <>
        <path d="M12 2.8 20 6v5.6c0 4.5-3.2 7.6-8 9.6-4.8-2-8-5.1-8-9.6V6l8-3.2Z" fill={fill} />
        <path d="m8 12.2 2.6 2.6 5.5-5.6" stroke={detail} strokeWidth="1.5" />
      </>
    ),
    trainers: (
      <>
        <circle cx="12" cy="6.5" r="3" fill={fill} />
        <path d="M5.5 20v-2.3c0-3.3 2.8-5.7 6.5-5.7s6.5 2.4 6.5 5.7V20h-13Z" fill={fill} />
        <path d="M2.5 13h2v4h-2zM19.5 13h2v4h-2z" fill={fill} stroke="none" />
        <path d="M4.5 15h2M17.5 15h2" stroke={fill} />
        <path d="M9 13.5 12 17l3-3.5" stroke={detail} />
      </>
    ),
  };

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={fill}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0">
          <stop offset="0%" stopColor="#00adfc" />
          <stop offset="55%" stopColor="#199bff" />
          <stop offset="100%" stopColor="#7567ff" />
        </linearGradient>
      </defs>
      {glyphs[name]}
    </svg>
  );
}

export function GymSidebarIcon({ name }: { name: GymSidebarIconName }) {
  return (
    <span className="gym-nav-icon" aria-hidden="true">
      <GymGlyph name={name} />
    </span>
  );
}

export function GymSidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path fillRule="evenodd" d="M5.5 2.5h13A3.5 3.5 0 0 1 22 6v12a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 18V6a3.5 3.5 0 0 1 3.5-3.5Zm0 2.2A1.3 1.3 0 0 0 4.2 6v12a1.3 1.3 0 0 0 1.3 1.3H9V4.7H5.5Zm6 0v14.6h7a1.3 1.3 0 0 0 1.3-1.3V6a1.3 1.3 0 0 0-1.3-1.3h-7Z" clipRule="evenodd" />
      <path d={collapsed ? 'm14 9 3 3-3 3' : 'm17 9-3 3 3 3'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
