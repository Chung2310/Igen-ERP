import { useId } from "react";

/** iGenAI's own outline mark: a conversation with an idea spark. */
export function AssistantAgentIcon({ className }: { className?: string }) {
  const gradientId = useId().replace(/:/g, "");
  return <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={gradientId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--color-primary)" />
        <stop offset="1" stopColor="#167ED5" />
      </linearGradient>
    </defs>
    <path d="M7 3.5h9.3a4.2 4.2 0 0 1 4.2 4.2v7.1a4.2 4.2 0 0 1-4.2 4.2H9.2l-4.5 2.3v-3.4a4.2 4.2 0 0 1-1.9-3.5V7.7A4.2 4.2 0 0 1 7 3.5Z" stroke={`url(#${gradientId})`} strokeWidth="1.8" strokeLinejoin="round" />
    <path d="m11.5 6.7 1.15 3.15L15.8 11l-3.15 1.15L11.5 15.3l-1.15-3.15L7.2 11l3.15-1.15L11.5 6.7Z" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M17.1 6.5v2.2m-1.1-1.1h2.2" stroke={`url(#${gradientId})`} strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
}
