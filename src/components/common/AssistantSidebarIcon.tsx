import type { ReactNode } from "react";

export type AssistantSidebarIconName =
  | "chat" | "studio" | "notebook" | "meeting" | "assistant"
  | "project" | "tools" | "history" | "settings";

const artwork: Record<AssistantSidebarIconName, ReactNode> = {
  chat: <>
    <path d="M7.2 3.5h10.6a3 3 0 0 1 3 3v9.2a3 3 0 0 1-3 3H9.4l-5.2 3V6.5a3 3 0 0 1 3-3Z" />
    <path d="M12.1 8.1v6.1m-3.05-3.05h6.1" />
  </>,
  studio: <>
    <path d="m11.3 2.8 1.7 5.1 5.1 1.7-5.1 1.7-1.7 5.1-1.7-5.1-5.1-1.7 5.1-1.7 1.7-5.1Z" />
    <path d="m18.9 15 .8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Z" />
  </>,
  notebook: <>
    <path d="M5.2 4.2h13.2a2.2 2.2 0 0 1 2.2 2.2v13.4a2.2 2.2 0 0 1-2.2 2.2H5.2a2.2 2.2 0 0 1-2.2-2.2V6.4a2.2 2.2 0 0 1 2.2-2.2Z" />
    <path d="M8 4.2v17.6m-4.9-12h3.1m-3.1 5h3.1M11.6 9.2h5.4m-5.4 4h5.4" />
  </>,
  meeting: <>
    <rect x="8.2" y="2.5" width="7.6" height="13.2" rx="3.8" />
    <path d="M5.2 11.8a6.8 6.8 0 0 0 13.6 0M12 18.6v3.1m-3.8 0h7.6" />
  </>,
  assistant: <>
    <rect x="3.8" y="7.1" width="16.4" height="12.8" rx="3.2" />
    <path d="M12 7.1V4.4m-1.4 0h2.8M3.8 12H2m20 0h-1.8M8.5 15.4h.1m6.8 0h.1" />
    <path d="M9.3 18h5.4" />
  </>,
  project: <>
    <rect x="2.8" y="3.2" width="7.2" height="6.4" rx="2" />
    <rect x="14" y="3.2" width="7.2" height="6.4" rx="2" />
    <rect x="8.4" y="15.4" width="7.2" height="6.4" rx="2" />
    <path d="M6.4 9.6v3h11.2v-3M12 12.6v2.8" />
  </>,
  tools: <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.7 8.3-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2Z" />
  </>,
  history: <>
    <path d="M4.6 8.1a8.5 8.5 0 1 1-1 5.2M4.6 3.8v4.3h4.3" />
    <path d="M12 7.5v4.8l3.3 2" />
  </>,
  settings: <>
    <path d="M3.2 6.1h17.6M3.2 12h17.6M3.2 17.9h17.6" />
    <circle cx="8" cy="6.1" r="2.2" fill="var(--color-surface-container-lowest)" />
    <circle cx="16" cy="12" r="2.2" fill="var(--color-surface-container-lowest)" />
    <circle cx="9.5" cy="17.9" r="2.2" fill="var(--color-surface-container-lowest)" />
  </>,
};

export function AssistantSidebarIcon({ name }: { name: AssistantSidebarIconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {artwork[name]}
  </svg>;
}
