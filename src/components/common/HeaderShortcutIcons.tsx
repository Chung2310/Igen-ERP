import { useId, type SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function AttendanceCheckInIcon(props: IconProps) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="2.5" y="4" width="19" height="17" rx="2.5" strokeWidth="1.7" />
    <path d="M7.5 2.5v3M16.5 2.5v3M2.5 9h19" strokeWidth="1.7" />
    <path d="m7.5 14.7 2.7 2.6 6.3-6.1" strokeWidth="2" />
  </svg>;
}

function WalletGradient({ id }: { id: string }) {
  return <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="3" y1="5" x2="25" y2="23">
    <stop offset="0%" stopColor="#7865ed" />
    <stop offset="65%" stopColor="#9b6eea" />
    <stop offset="100%" stopColor="#c377d5" />
  </linearGradient>;
}

export function PaidWalletIcon(props: IconProps) {
  const gradientId = useId();
  return <svg {...props} viewBox="0 0 28 28" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <defs><WalletGradient id={gradientId} /></defs>
    <path d="M5 8V6.5A3.5 3.5 0 0 1 8.5 3H22" stroke={`url(#${gradientId})`} strokeWidth="2" />
    <rect x="3" y="7" width="22" height="18" rx="4" fill={`url(#${gradientId})`} />
    <path d="M18 12.5h7v7h-7a3.5 3.5 0 0 1 0-7Z" fill="#f8f1ff" />
    <circle cx="18" cy="16" r="1.2" fill="#ffbe58" />
  </svg>;
}

export function UpgradeGiftIcon(props: IconProps) {
  const boxId = useId();
  const ribbonId = useId();
  return <svg {...props} viewBox="0 0 28 28" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={boxId} x1="4" y1="12" x2="23" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffd66b" />
        <stop offset="100%" stopColor="#ff984a" />
      </linearGradient>
      <linearGradient id={ribbonId} x1="8" y1="4" x2="19" y2="25" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ff7766" />
        <stop offset="100%" stopColor="#f44776" />
      </linearGradient>
    </defs>
    <path d="M5 15h18v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8Z" fill={`url(#${boxId})`} />
    <rect x="3" y="11" width="22" height="5" rx="1.5" fill={`url(#${boxId})`} />
    <path d="M14 11C10 11 7 9.8 7 7.4A3 3 0 0 1 10 4.5c2.1 0 3.3 2.3 4 6.5ZM14 11c4 0 7-1.2 7-3.6a3 3 0 0 0-3-2.9c-2.1 0-3.3 2.3-4 6.5Z" fill={`url(#${ribbonId})`} />
    <path d="M3.5 13.5h21" stroke={`url(#${ribbonId})`} strokeWidth="1.5" />
    <path d="M12.7 11h2.6v14h-2.6z" fill={`url(#${ribbonId})`} />
    <circle cx="24" cy="4" r="1.3" fill="#00adfc" />
  </svg>;
}

export function AiAssistantIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M9.5 6V4.9a2.5 2.5 0 0 1 5 0V6" />
    <rect x="3" y="6" width="18" height="15" rx="7.5" />
    <path d="M3 11.5H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1m18-4h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1" />
    <circle cx="9" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>;
}

export function MorePoliciesIcon(props: IconProps) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9" />
    <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>;
}
