import type { ReactNode } from "react";

export type AssistantSidebarIconName =
  | "chat" | "studio" | "notebook" | "meeting" | "assistant"
  | "project" | "tools" | "history" | "settings";

const artwork: Record<AssistantSidebarIconName, ReactNode> = {
  chat: <>
    <path d="M6.25 4.75h11.5a2.75 2.75 0 0 1 2.75 2.75v7.75A2.75 2.75 0 0 1 17.75 18H9l-4.75 3v-13.5a2.75 2.75 0 0 1 2-2.65Z" />
    <path d="M8.5 9h7m-7 3.5h5" />
  </>,
  studio: <>
    <rect x="3.75" y="5.25" width="16.5" height="14.25" rx="2.4" />
    <circle cx="9" cy="9.5" r="1.15" />
    <path d="m5.75 17 4-3.9 2.65 2.55 2.4-2.3 3.45 3.65M17.25 2.5l.65 1.9 1.9.65-1.9.65-.65 1.9-.65-1.9-1.9-.65 1.9-.65Z" />
  </>,
  notebook: <>
    <rect x="5" y="3.75" width="15.25" height="16.5" rx="2.25" />
    <path d="M8.5 4v16m-3.25-11h2.9m-2.9 4h2.9m4.25-4h6m-6 4h6" />
  </>,
  meeting: <>
    <rect x="8.5" y="3" width="7" height="12" rx="3.5" />
    <path d="M5.25 11.25a6.75 6.75 0 0 0 13.5 0M12 18v3m-3.25 0h6.5" />
  </>,
  assistant: <>
    <path d="M12 6V4" />
    <circle cx="12" cy="3" r="1" />
    <rect x="5" y="7" width="14" height="13" rx="4" />
    <circle cx="9.5" cy="13" r=".75" />
    <circle cx="14.5" cy="13" r=".75" />
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

export function AssistantSidebarIcon({ name }: { name: AssistantSidebarIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {artwork[name]}
  </svg>;
}
