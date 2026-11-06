import { useId } from "react";

type ArtworkProps = { className?: string };

export function ChatBrandMark({ className }: ArtworkProps) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-mark`} x1="6" y1="7" x2="41" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ADFC" />
          <stop offset="1" stopColor="#4269F0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="11" fill="var(--color-primary-container)" />
      <path d="M10 15a6 6 0 0 1 6-6h17a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H23l-8 6v-6a6 6 0 0 1-5-6V15Z" fill={`url(#${id}-mark)`} />
      <path d="M17 19h15M17 25h10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChatWelcomeArtwork({ className }: ArtworkProps) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 184 136" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-bubble`} x1="30" y1="18" x2="155" y2="116" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ADFC" />
          <stop offset="1" stopColor="#4269F0" />
        </linearGradient>
        <linearGradient id={`${id}-small`} x1="123" y1="69" x2="164" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#54D4FF" />
          <stop offset="1" stopColor="#008ACB" />
        </linearGradient>
      </defs>
      <circle cx="91" cy="68" r="59" fill="currentColor" opacity=".06" />
      <circle cx="155" cy="30" r="5" fill="#00ADFC" opacity=".26" />
      <circle cx="28" cy="102" r="4" fill="#4269F0" opacity=".25" />
      <path d="M42 36a16 16 0 0 1 16-16h67a16 16 0 0 1 16 16v43a16 16 0 0 1-16 16H76l-21 16V95a16 16 0 0 1-13-16V36Z" fill={`url(#${id}-bubble)`} />
      <path d="M60 46h60M60 59h47M60 72h32" stroke="white" strokeWidth="5" strokeLinecap="round" opacity=".92" />
      <path d="M130 73h21a13 13 0 0 1 13 13v15a13 13 0 0 1-13 13h-9l-11 8v-8h-1a13 13 0 0 1-13-13V86a13 13 0 0 1 13-13Z" fill={`url(#${id}-small)`} stroke="var(--color-surface-container-lowest)" strokeWidth="4" />
      <path d="M132 94h18" stroke="white" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function ChatCloudArtwork({ className }: ArtworkProps) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-cloud`} x1="8" y1="10" x2="39" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#54D4FF" />
          <stop offset=".52" stopColor="#00ADFC" />
          <stop offset="1" stopColor="#4269F0" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="var(--color-primary-container)" />
      <path d="M13.5 35h21a8 8 0 0 0 1.3-15.9A12.5 12.5 0 0 0 12 22.4 6.5 6.5 0 0 0 13.5 35Z" fill={`url(#${id}-cloud)`} />
      <path d="M20 25.5h8m-4-4v8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

type EmptyArtworkKind = "message" | "search" | "people";

export function ChatEmptyIllustration({ kind, className }: ArtworkProps & { kind: EmptyArtworkKind }) {
  const id = useId();
  return (
    <svg className={className} viewBox="0 0 160 96" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-accent`} x1="40" y1="20" x2="116" y2="79" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ADFC" />
          <stop offset="1" stopColor="#4269F0" />
        </linearGradient>
      </defs>
      <path d="M16 77h36m-23 8h20m59-7h37m-28 8h19" stroke="var(--color-on-surface-variant)" strokeWidth="7" strokeLinecap="round" opacity=".1" />
      <circle cx="80" cy="48" r="39" fill="var(--color-primary-container)" opacity=".65" />
      {kind === "message" && (
        <>
          <path d="M45 28a7 7 0 0 1 7-7h51a7 7 0 0 1 7 7v29a7 7 0 0 1-7 7H71L57 75V64h-5a7 7 0 0 1-7-7V28Z" fill="var(--color-surface-container-lowest)" stroke={`url(#${id}-accent)`} strokeWidth="2" />
          <path d="M60 36h35M60 45h27" stroke={`url(#${id}-accent)`} strokeWidth="3" strokeLinecap="round" />
          <circle cx="112" cy="66" r="13" fill={`url(#${id}-accent)`} />
          <path d="M112 60v12m-6-6h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {kind === "search" && (
        <>
          <path d="M49 24h42l13 13v36a5 5 0 0 1-5 5H49a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5Z" fill="var(--color-surface-container-lowest)" stroke="var(--color-outline)" strokeWidth="1.6" />
          <path d="M91 24v13h13M56 42h26M56 51h18" stroke="var(--color-outline)" strokeWidth="2" strokeLinecap="round" />
          <circle cx="96" cy="60" r="13" fill="var(--color-surface-container-lowest)" stroke={`url(#${id}-accent)`} strokeWidth="3" />
          <path d="m106 70 12 12" stroke={`url(#${id}-accent)`} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === "people" && (
        <>
          <circle cx="65" cy="36" r="10" fill="var(--color-surface-container-lowest)" stroke={`url(#${id}-accent)`} strokeWidth="2" />
          <path d="M43 73c0-14 8-22 22-22s22 8 22 22" fill="var(--color-surface-container-lowest)" stroke={`url(#${id}-accent)`} strokeWidth="2" />
          <circle cx="102" cy="41" r="8" fill="var(--color-surface-container-lowest)" stroke="var(--color-outline)" strokeWidth="1.8" />
          <path d="M91 56c9-7 24-3 27 17H94" stroke="var(--color-outline)" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
      <path d="m117 18 1.5 4.5L123 24l-4.5 1.5L117 30l-1.5-4.5L111 24l4.5-1.5L117 18Z" fill={`url(#${id}-accent)`} opacity=".65" />
    </svg>
  );
}
