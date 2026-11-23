import { useId, type SVGProps } from "react";

export type AssistantSidebarIconName =
  | "chat" | "studio" | "notebook" | "meeting" | "assistant"
  | "project" | "tools" | "agents" | "history" | "settings";

/** Filled 20 px artwork, matching the HR and Healthcare sidebar icons in proportions, gradient, and cutouts. */
export function AssistantSidebarIcon({
  name,
  active: _active,
  className = "size-5",
  ...props
}: SVGProps<SVGSVGElement> & { name: AssistantSidebarIconName; active?: boolean }) {
  const id = useId().replace(/:/g, "");
  const main = `url(#${id})`;
  const cutout = "var(--color-surface-container-lowest)";

  const shapes = {
    chat: (
      <>
        <path d="M5.4 3.5h13.2A2.9 2.9 0 0 1 21.5 6.4v8.6a2.9 2.9 0 0 1-2.9 2.9H9.3l-4.7 3.1a.65.65 0 0 1-1-.54V6.4a2.9 2.9 0 0 1 1.8-2.9Z" />
        <path
          d="M7.8 8.9h8.4m-8.4 3.8h5.4"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    studio: (
      <>
        <rect x="2.6" y="4.8" width="15.8" height="15.8" rx="3" />
        <circle cx="7.4" cy="9.6" r="1.4" fill={cutout} />
        <path
          d="m4.8 17.6 3.7-3.7 2.5 2.3 2.2-2.1 2.8 3.5"
          fill="none"
          stroke={cutout}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m19.3 1.8.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z" />
      </>
    ),
    notebook: (
      <>
        <rect x="4" y="2.6" width="16.4" height="18.8" rx="2.8" />
        <path
          d="M8.2 3.2v17.6M11.4 8.5h5.6m-5.6 3.7h5.6m-5.6 3.7h3.6"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
    meeting: (
      <>
        <rect x="8.3" y="2.4" width="7.4" height="11.8" rx="3.7" />
        <path
          d="M5.4 10.8a6.6 6.6 0 0 0 13.2 0M12 17.4v3.4m-3.4 0h6.8"
          fill="none"
          stroke={main}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.4 7.2h3.2m-3.2 2.8h3.2"
          fill="none"
          stroke={cutout}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ),
    assistant: (
      <>
        <path
          d="M12 2.4v2.8"
          fill="none"
          stroke={main}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <circle cx="12" cy="2.6" r="1.3" />
        <rect x="3" y="5.4" width="18" height="14.2" rx="4.2" />
        <rect x="1.3" y="10" width="1.9" height="4.8" rx=".95" />
        <rect x="20.8" y="10" width="1.9" height="4.8" rx=".95" />
        <circle cx="8.8" cy="11.6" r="1.45" fill={cutout} />
        <circle cx="15.2" cy="11.6" r="1.45" fill={cutout} />
        <path
          d="M9.1 15.6a3.5 3.5 0 0 0 5.8 0"
          fill="none"
          stroke={cutout}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
    project: (
      <>
        <path d="M2.6 6.4A2.6 2.6 0 0 1 5.2 3.8h4.2l2.1 2.2h7.3a2.6 2.6 0 0 1 2.6 2.6v9.2a2.6 2.6 0 0 1-2.6 2.6H5.2a2.6 2.6 0 0 1-2.6-2.6V6.4Z" />
        <path
          d="M3.2 9.8h17.6"
          fill="none"
          stroke={cutout}
          strokeWidth="1.8"
        />
      </>
    ),
    tools: (
      <>
        <circle cx="12" cy="12" r="9.4" />
        <path
          d="m16.2 7.8-2.3 5.7-6.1 2.7 2.3-5.7 6.1-2.7Z"
          fill={cutout}
        />
        <circle cx="12" cy="12" r="1.25" />
      </>
    ),
    agents: (
      <>
        <path
          d="M5.4 15.4V10a6.6 6.6 0 0 1 13.2 0v5.4"
          fill="none"
          stroke={main}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <rect x="2.4" y="10" width="3.8" height="6.8" rx="1.8" />
        <rect x="17.8" y="10" width="3.8" height="6.8" rx="1.8" />
        <path
          d="M6.4 16.5a3.5 3.5 0 0 0 3.5 3.2h1.6"
          fill="none"
          stroke={main}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="10.4" y="18.3" width="4.8" height="2.7" rx="1.35" />
        <circle cx="9.2" cy="13.2" r="1.05" />
        <circle cx="12" cy="13.2" r="1.05" />
        <circle cx="14.8" cy="13.2" r="1.05" />
      </>
    ),
    history: (
      <>
        <path
          d="M4.2 8.2A8.6 8.6 0 1 1 3.9 15"
          fill="none"
          stroke={main}
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M3.4 4.3v4.4h4.4"
          fill="none"
          stroke={main}
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.2 7.5v4.8l3.2 1.9"
          fill="none"
          stroke={main}
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
    settings: (
      <>
        <path d="M9.9 2.6h4.2l.65 2.4a7.3 7.3 0 0 1 1.7 1l2.35-.78 2.1 3.64-1.72 1.7a7.5 7.5 0 0 1 0 2l1.72 1.7-2.1 3.64-2.35-.78a7.3 7.3 0 0 1-1.7 1l-.65 2.4H9.9l-.65-2.4a7.3 7.3 0 0 1-1.7-1l-2.35.78-2.1-3.64 1.72-1.7a7.5 7.5 0 0 1 0-2L3.1 8.86l2.1-3.64 2.35.78a7.3 7.3 0 0 1 1.7-1l.65-2.4Z" />
        <circle cx="12" cy="11.56" r="3" fill={cutout} />
      </>
    ),
  };

  return (
    <svg
      {...props}
      className={className}
      viewBox="0 0 24 24"
      fill={main}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0">
          <stop offset="0%" stopColor="#00adfc" />
          <stop offset="55%" stopColor="#199bff" />
          <stop offset="100%" stopColor="#7567ff" />
        </linearGradient>
      </defs>
      {shapes[name]}
    </svg>
  );
}
