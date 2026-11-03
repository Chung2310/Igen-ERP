import { cn } from '../../lib/utils';

export type StudentEmptyIllustrationKind =
  | 'generic'
  | 'student'
  | 'quality'
  | 'course'
  | 'batch'
  | 'room'
  | 'fee'
  | 'exam'
  | 'resource'
  | 'notification'
  | 'roadmap'
  | 'partner'
  | 'enrollment';

function Subject({ kind }: { kind: StudentEmptyIllustrationKind }) {
  switch (kind) {
    case 'student':
    case 'quality':
      return <>
        <rect x="52" y="22" width="58" height="53" rx="5" />
        <circle cx="72" cy="42" r="7" />
        <path d="M59 62c1-8 6-12 13-12s12 4 13 12M91 38h11M91 45h9M91 52h6" />
        {kind === 'quality' ? <><circle cx="106" cy="65" r="9" /><path d="m112 72 8 8" /></> : null}
      </>;
    case 'course':
      return <>
        <path d="M80 28c-10-7-23-8-37-4v45c14-4 27-3 37 4 10-7 23-8 37-4V24c-14-4-27-3-37 4Zm0 0v45" />
        <path d="M51 37c8-1 14 0 21 3M51 46c8-1 14 0 21 3M88 40c7-3 13-4 21-3M88 49c7-3 13-4 21-3" />
      </>;
    case 'batch':
      return <>
        <rect x="48" y="23" width="64" height="49" rx="5" />
        <path d="M48 35h64M62 20v8M98 20v8" />
        <circle cx="69" cy="51" r="5" /><circle cx="91" cy="51" r="5" />
        <path d="M61 64c1-5 4-8 8-8s7 3 8 8M83 64c1-5 4-8 8-8s7 3 8 8" />
      </>;
    case 'room':
      return <>
        <path d="M48 74V24a5 5 0 0 1 5-5h54a5 5 0 0 1 5 5v50H48Z" />
        <path d="M60 74V48h40v26M60 31h12v9H60zM88 31h12v9H88zM87 59h5" />
      </>;
    case 'fee':
      return <>
        <path d="M57 21h46v44l-8-5-7 5-8-5-8 5-7-5-8 5V21Z" />
        <path d="M67 34h25M67 42h17" />
        <circle cx="94" cy="62" r="12" /><path d="M94 56v12m4-9c-1-2-8-3-8 1 0 3 8 2 8 5 0 4-7 4-9 1" />
      </>;
    case 'exam':
      return <>
        <path d="M57 21h35l12 12v41H57a5 5 0 0 1-5-5V26a5 5 0 0 1 5-5Z" />
        <path d="M92 21v12h12M64 43h14M64 53h14M64 63h14m8-19 3 3 5-6m-8 13 3 3 5-6" />
      </>;
    case 'resource':
      return <>
        <path d="M43 33h29l7 8h38v30a5 5 0 0 1-5 5H48a5 5 0 0 1-5-5V33Z" />
        <path d="M43 43h74M67 55h26M67 63h17" />
      </>;
    case 'notification':
      return <>
        <path d="M80 22c-12 0-20 9-20 22v11c0 5-3 8-7 11h54c-4-3-7-6-7-11V44c0-13-8-22-20-22Z" />
        <path d="M74 72c1 5 3 7 6 7s5-2 6-7" />
      </>;
    case 'roadmap':
      return <>
        <circle cx="53" cy="60" r="8" /><circle cx="80" cy="35" r="8" /><circle cx="108" cy="59" r="8" />
        <path d="m59 54 15-14m12 0 16 14M63 71h34" />
      </>;
    case 'partner':
      return <>
        <rect x="47" y="27" width="36" height="43" rx="5" />
        <rect x="77" y="20" width="36" height="43" rx="5" />
        <circle cx="65" cy="42" r="5" /><path d="M56 58c1-5 4-8 9-8s8 3 9 8" />
        <circle cx="95" cy="35" r="5" /><path d="M86 51c1-5 4-8 9-8s8 3 9 8" />
      </>;
    case 'enrollment':
      return <>
        <circle cx="67" cy="37" r="9" /><path d="M48 66c1-12 8-19 19-19s18 7 19 19" />
        <path d="M94 36h23m-8-8 8 8-8 8M94 57h23m-8-8 8 8-8 8" />
      </>;
    default:
      return <>
        <path d="M61 21h29l13 13v39a5 5 0 0 1-5 5H61a5 5 0 0 1-5-5V26a5 5 0 0 1 5-5Z" />
        <path d="M90 21v13h13M66 48h22M66 55h16m-15 13 5-6 4 3 6-7" />
      </>;
  }
}

export function StudentEmptyIllustration({ kind = 'generic', className }: { kind?: StudentEmptyIllustrationKind; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 160 96" fill="none" className={cn('h-24 w-40 text-on-surface-variant', className)}>
    <g stroke="currentColor" strokeLinecap="round" opacity="0.12" strokeWidth="8">
      <path d="M20 70h35M32 82h27M105 73h35M109 84h19" />
    </g>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" opacity="0.65">
      <Subject kind={kind} />
      <path d="m118 19 1.5 4.5L124 25l-4.5 1.5L118 31l-1.5-4.5L112 25l4.5-1.5L118 19ZM44 30l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
    </g>
  </svg>;
}
