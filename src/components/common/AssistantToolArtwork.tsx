import type { ReactNode } from "react";

// Small hand-drawn illustrations keyed to the catalog IDs. Keep the artwork
// separate from the catalog so future API data can reuse these local assets.
const artwork: Record<string, ReactNode> = {
  "explain-excel": <><path d="M3.5 3.5h11v17h-11zM3.5 8h11M8.5 8v12.5M3.5 13h11" /><path d="m10.5 5.5 1-1.5 1 1.5M5.5 16.5l1.5 2m0-2-1.5 2" /></>,
  "business-plan": <><path d="M3.5 19.5V5.8c2.3-.8 4.4-.7 6.5.4 2.1-1.1 4.2-1.2 6.5-.4v13.7c-2.3-.8-4.4-.7-6.5.4-2.1-1.1-4.2-1.2-6.5-.4ZM10 6.2v13.7" /><path d="m5.5 15 2-2 1 1M12 15l2.5-4" /></>,
  "customer-persona": <><circle cx="9" cy="8" r="2.8" /><path d="M3.5 19c.3-3.4 2.2-5.2 5.5-5.2s5.2 1.8 5.5 5.2M2.5 10.5c.2-4.8 3.4-7.7 8-7.5M15.5 12.5c0 2.1-.7 3.7-1.9 5" /></>,
  "survey-analysis": <><path d="M3 5.5h13v10H9l-4.5 3v-3H3z" /><path d="M6 12l2-2 2 1 3-3M6 7.5h2" /></>,
  "sales-email": <><path d="M2.5 8h13v11h-13zM2.5 8 9 13l6.5-5" /><path d="m10 6 2-2 2 1.5 2.5-3" /></>,
  "report-email": <><path d="M3.5 4h10l2.5 3v13H3.5zM13.5 4v3h2.5" /><path d="M6 16.5v-2M9.5 16.5v-5M13 16.5V9M5.5 8.5h4" /></>,
  "customer-care-email": <><path d="M2.5 9h13v10h-13zM2.5 9 9 13.5 15.5 9" /><path d="M9 7 6.8 4.8c-1.3-1.3-3.2.1-2 1.5L9 10l4.2-3.7c1.2-1.4-.7-2.8-2-1.5L9 7Z" /></>,
  "task-email": <><path d="M3.5 4h12v16h-12zM6 8h2M6 12h2M6 16h2" /><path d="m10.5 8 1 1 2-2m-3 5 1 1 2-2m-3 5 1 1 2-2" /></>,
  "marketing-email": <><path d="M3.5 9.5 12 7v8l-8.5-2.5zM12 8.5c1.8 1 1.8 4 0 5M5.5 13l1.1 5h2.2l-1-4.4" /><path d="m2 6-.8-1M14.5 17l1 1" /></>,
  "campaign-ideas": <><path d="M9.5 3.5c-3.4 0-5.5 2.2-5.5 5.4 0 2 1.1 3.3 2.2 4.5.7.8 1 1.4 1 2.3h4.6c0-.9.3-1.5 1-2.3 1.1-1.2 2.2-2.5 2.2-4.5 0-3.2-2.1-5.4-5.5-5.4ZM7.5 18h4M8.3 20h2.4" /><path d="m7.4 9.4 1.4 1.4 2.6-2.7" /></>,
  "budget-summary": <><path d="M3 7.5V18a2 2 0 0 0 2 2h11V8H5a2 2 0 0 1 0-4h8M3 7.5A2 2 0 0 0 5 9.5h11" /><path d="M11 12.5h5v4h-5a2 2 0 0 1 0-4ZM12 14.5h.1" /></>,
  "job-description": <><path d="M3 4.5h13v15H3zM6 4.5V3h7v1.5" /><circle cx="7.5" cy="10" r="1.7" /><path d="M5.2 15c.3-1.5 1-2.2 2.3-2.2s2 .7 2.3 2.2M11.5 9h2M11.5 12h2M6 17h7.5" /></>,
  "meeting-summary": <><path d="M3 13.5h13M5 13.5V18m9-4.5V18M5 7.5c0-1.4 1-2.5 2.3-2.5S9.5 6.1 9.5 7.5M10.5 7.5c0-1.4 1-2.5 2.3-2.5S15 6.1 15 7.5" /><path d="M2.5 10h13.5M7 16h5" /></>,
  "strategy-outline": <><path d="M3.5 19V5h2v14M5.5 7h6l-1.6 2L11.5 11h-6M7 16c1.4-2.4 3-2.4 4.5-1s3.2 1.4 4.5-.5" /><circle cx="15.5" cy="14.5" r="1" /></>,
  "technical-brief": <><path d="M2.5 5h14v13h-14zM2.5 8h14M5.5 20h8" /><path d="m7.5 11-2 2 2 2M11.5 11l2 2-2 2M10 10.5l-1 5" /></>,
  "health-info": <><path d="M4 3h9l3 3v14H4zM13 3v3h3" /><path d="M8.2 9.5v6m-3-3h6M7 18h6" /></>,
  "lesson-outline": <><path d="M3 5c2.3-.8 4.3-.6 6.5.4 2.2-1 4.2-1.2 6.5-.4v13c-2.3-.8-4.3-.6-6.5.4-2.2-1-4.2-1.2-6.5-.4zM9.5 5.4v13" /><path d="M5 9h2M12 9h2M12 12h2" /></>,
  "official-email": <><path d="M4 3.5h10l2 2v15H4zM14 3.5v2h2M6.5 8.5h6M6.5 11h6M6.5 13.5h4" /><circle cx="12.5" cy="17" r="2" /></>,
};

export function AssistantToolArtwork({ id }: { id: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="mt-0.5 size-6 shrink-0 text-on-surface">
    {artwork[id]}
    <path d="m19 2 .7 2.3L22 5l-2.3.7L19 8l-.7-2.3L16 5l2.3-.7L19 2Z" className="fill-primary" stroke="none" />
  </svg>;
}
