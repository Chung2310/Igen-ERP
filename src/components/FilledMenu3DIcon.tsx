import { useId } from "react";

export interface Menu3DIconPalette {
  light: string;
  dark: string;
  edge: string;
}

export type FilledMenu3DIconShape =
  | "overview" | "people" | "partners" | "warehouse" | "repair" | "student"
  | "work" | "customer" | "retail" | "finance" | "marketing"
  | "folder" | "chat" | "shield" | "settings" | "guide";

interface ShapeLayers {
  body: string;
  light?: string;
  shade?: string;
}

const shapes: Record<FilledMenu3DIconShape, ShapeLayers> = {
  overview: {
    body: "M4 2.5h5A2.5 2.5 0 0 1 11.5 5v4A2.5 2.5 0 0 1 9 11.5H4A2.5 2.5 0 0 1 1.5 9V5A2.5 2.5 0 0 1 4 2.5Zm11 0h5A2.5 2.5 0 0 1 22.5 5v4a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 12.5 9V5A2.5 2.5 0 0 1 15 2.5ZM4 12.5h5a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 9 21.5H4A2.5 2.5 0 0 1 1.5 19v-4A2.5 2.5 0 0 1 4 12.5Zm11 0h5a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5h-5a2.5 2.5 0 0 1-2.5-2.5v-4a2.5 2.5 0 0 1 2.5-2.5Z",
    light: "M3.5 5a1 1 0 0 1 1-1H9v2H3.5V5Zm11 0a1 1 0 0 1 1-1H20v2h-5.5V5Zm-11 10a1 1 0 0 1 1-1H9v2H3.5v-1Zm11 0a1 1 0 0 1 1-1H20v2h-5.5v-1Z",
  },
  people: {
    body: "M8.3 2.5a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4Zm8.4 1.4a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM8.3 11.5c3.7 0 6.6 2.7 6.6 6.2v1.5c0 1.1-.9 2-2 2H3.7c-1.1 0-2-.9-2-2v-1.5c0-3.5 2.9-6.2 6.6-6.2Zm8.6.2c3.2 0 5.4 2.5 5.4 5.7v1.7c0 1.2-.9 2.1-2.1 2.1h-4.8c.3-.6.4-1.2.4-2v-1.5c0-2.2-.7-4.2-1.9-5.7.9-.2 1.9-.3 3-.3Z",
    light: "M8.3 3.5c1.1 0 2.1.5 2.7 1.3a3.5 3.5 0 0 0-4.8 3.3 3.3 0 0 1 2.1-1.3Zm0 9.3c2.6 0 4.7 1.5 5.3 3.8-1.1-1.5-3-2.3-5.3-2.3s-4.2.8-5.3 2.3c.6-2.3 2.7-3.8 5.3-3.8Z",
  },
  partners: {
    body: "M1.5 7.5 5.2 4l4.2 2.8-4.3 7.5-3.6-2V7.5Zm21 0L18.8 4l-4.2 2.8 4.3 7.5 3.6-2V7.5ZM9.3 7.4l2.2-1.2c1-.6 2.2-.5 3.2.1l3.8 2.5-2.6 3.3-2.8-1.6-2.1 1.7 5.9 4.2a1.9 1.9 0 0 1-2.2 3.1l-1.1-.8a1.8 1.8 0 0 1-2.7.8l-1.2-.9a1.8 1.8 0 0 1-2.7.7l-3.2-2.5a2.7 2.7 0 0 1-.5-3.7l4-5.7Z",
    light: "M2.6 7.7 5.4 5l1.2.8-3.7 5.7-.3-.2V7.7Zm15.9-2.7 2.9 2.7v3.6l-.3.2-3.8-5.7 1.2-.8Z",
  },
  warehouse: {
    body: "M12 1.8 22 7v10L12 22.3 2 17V7L12 1.8Z",
    light: "M12 1.8 22 7l-10 5.2L2 7 12 1.8Z",
    shade: "M12 12.2 22 7v10l-10 5.3V12.2Z",
  },
  repair: {
    body: "M20.8 2.7a5.7 5.7 0 0 0-6.9 7.4l-9.7 9.7a2.3 2.3 0 0 0 3.3 3.2l9.7-9.7a5.7 5.7 0 0 0 6.8-7l-3.6 3.6-3.1-.8-.8-3.1 4.3-3.3Z",
    light: "M20.8 2.7a5.7 5.7 0 0 0-6.9 7.4l-8.5 8.5 2 2 9.8-9.8a5.7 5.7 0 0 0 6.8-4.5l-3.6 3.6-3.1-.8-.8-3.1 4.3-3.3Z",
    shade: "M5.4 18.6a2.3 2.3 0 0 0-.8 3.6 2.3 2.3 0 0 0 3.6-.8l-2.8-2.8Z",
  },
  student: {
    body: "M12 2.5 23 8.2 12 14 1 8.2 12 2.5ZM5.5 12.1 12 15.5l6.5-3.4v4.6c0 2.5-2.9 4.1-6.5 4.1s-6.5-1.6-6.5-4.1v-4.6ZM21 9.5h1.2v8H21v-8Z",
    light: "M12 3.6 20.7 8.2 12 12.8 3.3 8.2 12 3.6Z",
    shade: "M5.5 15.9c1.4 1.3 3.7 2 6.5 2s5.1-.7 6.5-2v1c0 2.3-2.9 3.9-6.5 3.9s-6.5-1.6-6.5-3.9v-1Z",
  },
  work: {
    body: "M8 2.5h8A2.5 2.5 0 0 1 18.5 5v2h2A2.5 2.5 0 0 1 23 9.5v10a2.5 2.5 0 0 1-2.5 2.5h-17A2.5 2.5 0 0 1 1 19.5v-10A2.5 2.5 0 0 1 3.5 7h2V5A2.5 2.5 0 0 1 8 2.5Zm0 3V7h8V5.5H8Z",
    light: "M3.5 8.5h17A1 1 0 0 1 21.5 9.5v3c-4.9 2.4-14.1 2.4-19 0v-3a1 1 0 0 1 1-1Z",
    shade: "M10 11.5h4v4h-4v-4Z",
  },
  customer: {
    body: "M4 2.5h16A2.5 2.5 0 0 1 22.5 5v14A2.5 2.5 0 0 1 20 21.5H4A2.5 2.5 0 0 1 1.5 19V5A2.5 2.5 0 0 1 4 2.5Z",
    light: "M12 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM6.5 18c.4-2.7 2.6-4.5 5.5-4.5s5.1 1.8 5.5 4.5h-11Z",
    shade: "M4 4h16v1H4V4Z",
  },
  retail: {
    body: "M6 7.5h12l2.4 12.6a2 2 0 0 1-2 2.4H5.6a2 2 0 0 1-2-2.4L6 7.5Zm2-1.5a4 4 0 0 1 8 0v2h-2.5V6a1.5 1.5 0 0 0-3 0v2H8V6Z",
    light: "M7.2 9.2h9.6l.6 3.2H6.6l.6-3.2Z",
  },
  finance: {
    body: "M12 1.5 22.5 7v2.5h-21V7L12 1.5ZM3.5 10.5h3v8h-3v-8Zm7 0h3v8h-3v-8Zm7 0h3v8h-3v-8ZM2.5 19.5h19v2h-19v-2Z",
    light: "M12 3.2 20 7.3H4L12 3.2Z",
  },
  marketing: {
    body: "M3 8.2h4.8L20 3.5v16.8L7.8 15.6H3A2.5 2.5 0 0 1 .5 13.1v-2.4A2.5 2.5 0 0 1 3 8.2Zm4.2 7.4 2.2 6h4.1l-2.6-5.1-3.7-.9Z",
    light: "M3 9.6h4.8L18.5 5.5v6.2L7.8 14.2H3a1.1 1.1 0 0 1-1.1-1.1v-2.4A1.1 1.1 0 0 1 3 9.6Z",
  },
  folder: {
    body: "M4 3.5h5l2 2h9A3 3 0 0 1 23 8.5v10a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3Z",
    light: "M4 5h4.4l2 2H20a1.5 1.5 0 0 1 1.5 1.5v2H2.5v-4A1.5 1.5 0 0 1 4 5Z",
  },
  chat: {
    body: "M4 2.5h16A3 3 0 0 1 23 5.5v10a3 3 0 0 1-3 3H9l-5.5 3.3v-3.3A3 3 0 0 1 1 15.5v-10A3 3 0 0 1 4 2.5Z",
    light: "M4 4h16a1.5 1.5 0 0 1 1.5 1.5v2H2.5v-2A1.5 1.5 0 0 1 4 4Z",
    shade: "M6 10h3v3H6v-3Zm5 0h3v3h-3v-3Zm5 0h3v3h-3v-3Z",
  },
  shield: {
    body: "M12 1.5 22 5.7v6c0 5.4-3.9 9.3-10 10.8C5.9 21 2 17.1 2 11.7v-6L12 1.5Z",
    light: "M12 3.6 20 7v4.7c0 4.1-2.9 7.1-8 8.6V3.6Z",
  },
  settings: {
    body: "m10 1.5 4 0 .6 2.2 2 .9 2-.9 2.8 2.8-.9 2 .9 2 2.2.6v4l-2.2.6-.9 2 .9 2-2.8 2.8-2-.9-2 .9-.6 2.2h-4l-.6-2.2-2-.9-2 .9-2.8-2.8.9-2-.9-2-2.2-.6v-4l2.2-.6.9-2-.9-2 2.8-2.8 2 .9 2-.9.6-2.2Z",
    light: "M12 7.2a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6Z",
    shade: "M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z",
  },
  guide: {
    body: "M2 3.8c3.3-1.4 6.8-1.2 10 1 3.2-2.2 6.7-2.4 10-1v16c-3.3-1.4-6.8-1.2-10 1-3.2-2.2-6.7-2.4-10-1v-16Z",
    light: "M12 4.8c3.2-2.2 6.7-2.4 10-1v14c-3.3-1.4-6.8-1.2-10 1v-14Z",
    shade: "M11.4 4.5h1.2v15.7h-1.2V4.5Z",
  },
};

export function FilledMenu3DIcon({ shape, palette, className }: { shape: FilledMenu3DIconShape; palette: Menu3DIconPalette; className?: string }) {
  const id = useId().replace(/:/g, "");
  const layers = shapes[shape];

  return (
    <svg aria-hidden="true" className={`shrink-0 overflow-visible transition-transform group-hover:scale-105 ${className ?? ""}`} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id={`${id}-face`} x1="4" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor={palette.light} />
          <stop offset="0.55" stopColor={palette.dark} />
          <stop offset="1" stopColor={palette.edge} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="0.7" stdDeviation="0.45" floodColor={palette.edge} floodOpacity="0.22" />
        </filter>
      </defs>
      <g filter={`url(#${id}-shadow)`}>
        <path d={layers.body} fill={`url(#${id}-face)`} />
        {layers.light ? <path d={layers.light} fill={palette.light} opacity="0.8" /> : null}
        {layers.shade ? <path d={layers.shade} fill={palette.edge} opacity="0.55" /> : null}
      </g>
    </svg>
  );
}
