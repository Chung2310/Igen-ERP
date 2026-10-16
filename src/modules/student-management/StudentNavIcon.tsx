import type { ReactNode } from "react";

type StudentNavIconProps = {
  slug: string;
  className?: string;
};

// Small, purpose-drawn outlines for the student workspace navigation.
export function StudentNavIcon({ slug, className = "h-[18px] w-[18px]" }: StudentNavIconProps) {
  let drawing: ReactNode;

  switch (slug) {
    case "tong-quan":
      drawing = <><rect x="3" y="3" width="7" height="7" rx="1.3" /><rect x="14" y="3" width="7" height="7" rx="1.3" /><rect x="3" y="14" width="7" height="7" rx="1.3" /><rect x="14" y="14" width="7" height="7" rx="1.3" /></>;
      break;
    case "khoa-hoc":
      drawing = <><path d="M12 5.5C9.6 4.1 6.8 3.7 3.5 4.5v14.2c3.3-.8 6.1-.4 8.5 1 2.4-1.4 5.2-1.8 8.5-1V4.5c-3.3-.8-6.1-.4-8.5 1Z" /><path d="M12 5.5v14.2M6 8c1.2-.1 2.3.1 3.3.5M15 8.5c1-.4 2.1-.6 3.3-.5" /></>;
      break;
    case "cong-viec":
      drawing = <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12c5.8 3.3 12.2 3.3 18 0M11 14h2" /></>;
      break;
    case "lop-hoc":
      drawing = <><path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z" /><path d="M6 11v5.5c3.7 2.5 8.3 2.5 12 0V11M21.5 9v6" /><circle cx="21.5" cy="16.5" r="1" /></>;
      break;
    case "chat-luong-hoc-vien":
      drawing = <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8.5 10l1.5 1.5 2.5-3M14.5 10H16M8.5 16l1.5 1.5 2.5-3M14.5 16H16" /></>;
      break;
    case "hoc-vien":
      drawing = <><circle cx="9" cy="8" r="2.5" /><path d="M3.5 19v-1.5a5.5 5.5 0 0 1 11 0V19M16 5.7a2.5 2.5 0 0 1 0 4.7M17 13a4.5 4.5 0 0 1 3.5 4.4V19" /></>;
      break;
    case "hoc-phi":
      drawing = <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6 15h4" /></>;
      break;
    case "lich-thi":
      drawing = <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7.5 3v4M16.5 3v4M3 9h18M8 14h3v3H8zM15 14h2" /></>;
      break;
    case "phong-hoc":
      drawing = <><path d="m3 9 9-5 9 5v11H3V9ZM8 20v-6h8v6M3 10h18" /><path d="M10 8h4M6 13h1M17 13h1" /></>;
      break;
    case "tai-nguyen":
      drawing = <><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M3 11h18M9 15h6" /></>;
      break;
    case "thong-bao":
      drawing = <><path d="M6 17h12l-1.5-2.4V10a4.5 4.5 0 0 0-9 0v4.6L6 17ZM10 20h4" /><path d="M12 3v2" /></>;
      break;
    case "bao-luu-hoc-lai":
      drawing = <><path d="M19 8a7.5 7.5 0 1 0 1 6M19 4v4h-4" /><path d="M9 11.5h6M12 8.5v6" /></>;
      break;
    default:
      drawing = <><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 5h7a5 5 0 0 1 0 10H9a4 4 0 0 0-4 4h12" /></>;
  }

  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawing}</svg>;
}
