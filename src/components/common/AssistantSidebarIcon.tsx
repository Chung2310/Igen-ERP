import { useId, type ReactNode } from "react";

export type AssistantSidebarIconName =
  | "chat" | "studio" | "notebook" | "meeting" | "assistant"
  | "project" | "tools" | "agents" | "history" | "settings";

export function AssistantSidebarIcon({ name }: { name: AssistantSidebarIconName; active?: boolean }) {
  const gradientId = useId().replace(/:/g, "");
  const fill = `url(#${gradientId})`;
  const cutout = "var(--color-surface-container-lowest)";
  const filledArtwork: Record<AssistantSidebarIconName, ReactNode> = {
    chat: <><path d="M5 3.5h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9l-5.4 3.2c-.7.4-1.6-.1-1.6-.9V6.5a3 3 0 0 1 2-2.9Z"/><path d="M7.5 9h9m-9 4h6" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round"/></>,
    studio: <><rect x="2.5" y="7" width="15" height="14" rx="3"/><path d="m5.5 17 3-3 2.3 2 2-1.8 2 1.8" fill="none" stroke={cutout} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="11" r="1" fill={cutout}/><path d="M9 3h9a3 3 0 0 1 3 3v9h-2V7a2 2 0 0 0-2-2H9V3Z"/><path d="m20 1 .7 1.7L22.5 3l-1.8.7L20 5.5l-.7-1.8L17.5 3l1.8-.3L20 1Z"/></>,
    notebook: <><rect x="4" y="2.5" width="17" height="19" rx="3"/><path d="M8.5 3v18M12 9h5m-5 4h5" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round"/><path d="M2.5 8h4m-4 5h4" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round"/></>,
    meeting: <><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V22m-4 0h8" fill="none" stroke={fill} strokeWidth="2.3" strokeLinecap="round"/></>,
    assistant: <><rect x="3" y="7" width="18" height="14" rx="4"/><path d="M12 7V4m0 0h2" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="13" r="1.4" fill={cutout}/><circle cx="15" cy="13" r="1.4" fill={cutout}/><path d="M9 17h6" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round"/></>,
    project: <><path d="M2.5 8a3 3 0 0 1 3-3H10l2 2h6.5a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3V8Z"/><path d="M3 10h18" fill="none" stroke={cutout} strokeWidth="1.6"/></>,
    tools: <><circle cx="12" cy="12" r="9.5"/><path d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1 5.1-2.5Z" fill={cutout}/><circle cx="12" cy="12" r="1.2"/></>,
    agents: <><path d="M5 15.5V10a7 7 0 0 1 14 0v5.5h-2.5V10a4.5 4.5 0 0 0-9 0v5.5H5Z"/><rect x="2" y="10" width="4" height="7.5" rx="2"/><rect x="18" y="10" width="4" height="7.5" rx="2"/><path d="M18 16.5c0 2.8-1.7 4-5 4" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round"/><rect x="10.5" y="19" width="4" height="3" rx="1.5"/></>,
    history: <><path d="M12 2.5a9.5 9.5 0 1 1-9.4 11h2.5a7 7 0 1 0 2-6.4L10 10H2V2l3.2 3.2A9.4 9.4 0 0 1 12 2.5Z"/><path d="M12 7v5l3.5 2" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    settings: <><path d="M10 2h4l.7 2.2c.6.2 1.2.5 1.7.9l2.3-.5 2 3.5-1.6 1.7a8 8 0 0 1 0 2.2l1.6 1.7-2 3.5-2.3-.5c-.5.4-1.1.7-1.7.9L14 20h-4l-.7-2.4c-.6-.2-1.2-.5-1.7-.9l-2.3.5-2-3.5 1.6-1.7a8 8 0 0 1 0-2.2L3.3 8.1l2-3.5 2.3.5c.5-.4 1.1-.7 1.7-.9L10 2Z"/><circle cx="12" cy="11" r="2.8" fill={cutout}/></>,
  };
  return <svg viewBox="0 0 24 24" fill={fill} aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0"><stop offset="0%" stopColor="#00adfc"/><stop offset="55%" stopColor="#199bff"/><stop offset="100%" stopColor="#7567ff"/></linearGradient></defs>
    {filledArtwork[name]}
  </svg>;
}
