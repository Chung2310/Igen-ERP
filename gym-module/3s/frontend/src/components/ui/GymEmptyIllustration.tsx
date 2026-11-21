export type GymEmptyIllustrationKind =
  | 'generic'
  | 'customers'
  | 'inbody'
  | 'nutrition'
  | 'roadmap'
  | 'workout'
  | 'progress'
  | 'trainers'
  | 'packages'
  | 'transfer'
  | 'knowledge'
  | 'search';

function Subject({ kind }: { kind: GymEmptyIllustrationKind }) {
  switch (kind) {
    case 'customers':
      return (
        <>
          <rect x="52" y="22" width="58" height="53" rx="5" />
          <circle cx="72" cy="42" r="7" />
          <path d="M59 62c1-8 6-12 13-12s12 4 13 12M91 38h11M91 45h9M91 52h6" />
        </>
      );
    case 'inbody':
      return (
        <>
          <rect x="54" y="21" width="52" height="55" rx="5" />
          <path d="M68 21v-4h24v4" />
          <path d="M63 45h9l4-8 6 16 5-10 4 2h6" />
          <path d="M64 62h16M86 62h10" />
        </>
      );
    case 'nutrition':
      return (
        <>
          <path d="M48 48h64c-2 16-14 26-32 26S50 64 48 48Z" />
          <path d="M44 48h72M64 38c0-5 4-8 4-13M80 36c0-5 4-8 4-13M96 38c0-5 4-8 4-13" />
        </>
      );
    case 'roadmap':
      return (
        <>
          <circle cx="53" cy="60" r="8" />
          <circle cx="80" cy="35" r="8" />
          <circle cx="108" cy="59" r="8" />
          <path d="m59 54 15-14m12 0 16 14M63 71h34" />
        </>
      );
    case 'workout':
      return (
        <>
          <rect x="46" y="37" width="8" height="22" rx="2" />
          <rect x="54" y="31" width="9" height="34" rx="2" />
          <path d="M63 48h34" />
          <rect x="97" y="31" width="9" height="34" rx="2" />
          <rect x="106" y="37" width="8" height="22" rx="2" />
        </>
      );
    case 'progress':
      return (
        <>
          <rect x="48" y="23" width="64" height="50" rx="5" />
          <path d="M58 61V51M72 61V43M86 61V48M100 61V35" />
          <path d="m58 46 14-10 14 7 14-12" />
        </>
      );
    case 'trainers':
      return (
        <>
          <rect x="47" y="27" width="36" height="43" rx="5" />
          <rect x="77" y="20" width="36" height="43" rx="5" />
          <circle cx="65" cy="42" r="5" />
          <path d="M56 58c1-5 4-8 9-8s8 3 9 8" />
          <circle cx="95" cy="35" r="5" />
          <path d="M86 51c1-5 4-8 9-8s8 3 9 8" />
        </>
      );
    case 'packages':
      return (
        <>
          <path d="M57 21h46v44l-8-5-7 5-8-5-8 5-7-5-8 5V21Z" />
          <path d="M67 34h25M67 42h17" />
          <circle cx="94" cy="62" r="12" />
          <path d="M94 56v12m4-9c-1-2-8-3-8 1 0 3 8 2 8 5 0 4-7 4-9 1" />
        </>
      );
    case 'transfer':
      return (
        <>
          <circle cx="67" cy="37" r="9" />
          <path d="M48 66c1-12 8-19 19-19s18 7 19 19" />
          <path d="M94 36h23m-8-8 8 8-8 8M94 57h23m-8-8 8 8-8 8" />
        </>
      );
    case 'knowledge':
      return (
        <>
          <path d="M43 33h29l7 8h38v30a5 5 0 0 1-5 5H48a5 5 0 0 1-5-5V33Z" />
          <path d="M43 43h74M67 55h26M67 63h17" />
        </>
      );
    case 'search':
      return (
        <>
          <path d="M55 22h34l12 12v39a5 5 0 0 1-5 5H55a5 5 0 0 1-5-5V27a5 5 0 0 1 5-5Z" />
          <path d="M89 22v12h12M61 43h24M61 52h17" />
          <circle cx="93" cy="63" r="10" />
          <path d="m100 70 9 9" />
        </>
      );
    default:
      return (
        <>
          <path d="M61 21h29l13 13v39a5 5 0 0 1-5 5H61a5 5 0 0 1-5-5V26a5 5 0 0 1 5-5Z" />
          <path d="M90 21v13h13M66 48h22M66 55h16m-15 13 5-6 4 3 6-7" />
        </>
      );
  }
}

export function GymEmptyIllustration({
  kind = 'generic',
  className = '',
}: {
  kind?: GymEmptyIllustrationKind;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 160 96"
      fill="none"
      className={`h-24 w-40 max-w-full text-[#475569] ${className}`.trim()}
      style={{ display: 'block', margin: '0 auto' }}
    >
      <g stroke="currentColor" strokeLinecap="round" opacity="0.12" strokeWidth="8">
        <path d="M20 70h35M32 82h27M105 73h35M109 84h19" />
      </g>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" opacity="0.65">
        <Subject kind={kind} />
        <path d="m118 19 1.5 4.5L124 25l-4.5 1.5L118 31l-1.5-4.5L112 25l4.5-1.5L118 19ZM44 30l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" />
      </g>
    </svg>
  );
}
