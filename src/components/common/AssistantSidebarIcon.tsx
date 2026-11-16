import { useId, type ReactNode } from "react";
import { AiAssistantIcon } from "./HeaderShortcutIcons";

export type AssistantSidebarIconName =
  | "chat" | "studio" | "notebook" | "meeting" | "assistant"
  | "project" | "tools" | "agents" | "history" | "settings";

const artwork: Record<Exclude<AssistantSidebarIconName, "agents" | "assistant">, ReactNode> = {
  chat: <>
    <path d="M6.25 4.75h11.5a2.75 2.75 0 0 1 2.75 2.75v7.75A2.75 2.75 0 0 1 17.75 18H9l-4.75 3v-13.5a2.75 2.75 0 0 1 2-2.65Z" />
    <path d="M8.5 9h7m-7 3.5h5" />
  </>,
  studio: <>
    <path d="M6.4 8.6V7.6a2.2 2.2 0 0 1 2.2-2.2h7.5a2.2 2.2 0 0 1 2.2 2.2v8.7a2.2 2.2 0 0 1-2.2 2.2H14" />
    <rect x="3.4" y="9.1" width="10.8" height="11.4" rx="2.2" />
    <circle cx="7.3" cy="12.5" r=".7" />
    <path d="m5.2 18.1 2.7-2.7 1.9 1.7 1.5-1.3 1.6 1.4" />
    <path d="m20.8 1.7.45 1.2 1.2.45-1.2.45-.45 1.2-.45-1.2-1.2-.45 1.2-.45Z" />
  </>,
  notebook: <>
    <rect x="5" y="3.75" width="15.25" height="16.5" rx="2.25" />
    <path d="M8.5 4v16m-3.25-11h2.9m-2.9 4h2.9m4.25-4h6m-6 4h6" />
  </>,
  meeting: <>
    <rect x="8.5" y="3" width="7" height="12" rx="3.5" />
    <path d="M5.25 11.25a6.75 6.75 0 0 0 13.5 0M12 18v3m-3.25 0h6.5" />
  </>,
  project: <>
    <path d="M3.75 8a2.5 2.5 0 0 1 2.5-2.5h3.5l2 2h6A2.5 2.5 0 0 1 20.25 10v6.75a2.5 2.5 0 0 1-2.5 2.5H6.25a2.5 2.5 0 0 1-2.5-2.5Z" />
    <path d="M4 9.5h16" />
  </>,
  tools: <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.25 4.75L8.5 15.5l2.25-4.75L15.5 8.5Z" />
    <circle cx="12" cy="12" r=".55" />
  </>,
  history: <>
    <path d="M4.5 8A8 8 0 1 1 4 14m.5-10v4h4" />
    <path d="M12 7.5v4.75l3 1.75" />
  </>,
  settings: <>
    <path d="M10 3.5h4l.55 2.15a6.8 6.8 0 0 1 1.55.9l2.1-.7 2 3.45-1.55 1.55a7 7 0 0 1 0 1.8l1.55 1.55-2 3.45-2.1-.7a6.8 6.8 0 0 1-1.55.9L14 20h-4l-.55-2.15a6.8 6.8 0 0 1-1.55-.9l-2.1.7-2-3.45L5.35 12.6a7 7 0 0 1 0-1.8L3.8 9.25l2-3.45 2.1.7a6.8 6.8 0 0 1 1.55-.9Z" />
    <circle cx="12" cy="11.7" r="2.4" />
  </>,
};

export function AssistantSidebarIcon({ name, active = false }: { name: AssistantSidebarIconName; active?: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  if (name === "agents") return <AssistantSupportIcon gradientId={gradientId} active={active} />;
  if (name === "assistant") return <AiAssistantIcon gradientId={active ? gradientId : undefined} />;
  if (name === "studio") return <AssistantStudioSidebarIcon active={active} />;
  return <svg viewBox="2 2 20 20" fill="none" stroke={active ? `url(#${gradientId})` : "currentColor"} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {active && <defs><linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="var(--color-primary)" /><stop offset="100%" stopColor="var(--color-purple-400)" /></linearGradient></defs>}
    {artwork[name]}
  </svg>;
}

function AssistantSupportIcon({ gradientId, active }: { gradientId: string; active: boolean }) {
  const color = active ? `url(#${gradientId})` : "currentColor";
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {active && <defs><linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="var(--color-primary)" /><stop offset="100%" stopColor="var(--color-purple-400)" /></linearGradient></defs>}
    <g stroke={color}>
      <path d="M5.4 16.7V9.8a6.6 6.6 0 0 1 13.2 0v6.9" />
      <rect x="2.4" y="10.4" width="3" height="6.6" rx="1.5" />
      <rect x="18.6" y="10.4" width="3" height="6.6" rx="1.5" />
      <path d="M5.4 16.7a3.4 3.4 0 0 0 3.4 3.4h1.7" />
      <rect x="10.5" y="18.9" width="4.5" height="2.4" rx="1.2" />
    </g>
    <g fill={color} stroke="none">
      <circle cx="9" cy="13.5" r=".65" />
      <circle cx="12" cy="13.5" r=".65" />
      <circle cx="15" cy="13.5" r=".65" />
    </g>
  </svg>;
}

function AssistantStudioSidebarIcon({ active }: { active: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  return <svg viewBox="2 1 21 21" className="assistant-studio-icon" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {active && <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--color-primary)" />
        <stop offset="100%" stopColor="var(--color-purple-400)" />
      </linearGradient>
    </defs>}
    <g stroke={active ? `url(#${gradientId})` : "currentColor"}>{artwork.studio}</g>
  </svg>;
}
