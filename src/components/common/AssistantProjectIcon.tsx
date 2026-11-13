import type { ReactNode } from "react";
import { cn } from "../../modules/student-management/lib/utils";
import type { ProjectIcon, ProjectTone } from "./assistant-project-data";

export const projectIconOptions: Array<{ id: ProjectIcon; label: string }> = [
  { id: "folder", label: "Thư mục" }, { id: "globe", label: "Toàn cầu" }, { id: "heart", label: "Trái tim" }, { id: "chart", label: "Biểu đồ" },
  { id: "pen", label: "Bút" }, { id: "file", label: "Tài liệu" }, { id: "book", label: "Sách" }, { id: "briefcase", label: "Công việc" },
  { id: "calendar", label: "Lịch" }, { id: "code", label: "Mã nguồn" }, { id: "image", label: "Hình ảnh" }, { id: "music", label: "Âm nhạc" },
  { id: "video", label: "Video" }, { id: "bulb", label: "Ý tưởng" }, { id: "rocket", label: "Tên lửa" }, { id: "target", label: "Mục tiêu" },
  { id: "users", label: "Nhóm" }, { id: "chat", label: "Trò chuyện" }, { id: "shield", label: "Bảo vệ" }, { id: "puzzle", label: "Mảnh ghép" },
  { id: "leaf", label: "Lá cây" }, { id: "gear", label: "Thiết lập" }, { id: "star", label: "Ngôi sao" }, { id: "flag", label: "Lá cờ" },
  { id: "building", label: "Tòa nhà" }, { id: "layers", label: "Nhiều lớp" }, { id: "link", label: "Liên kết" }, { id: "compass", label: "La bàn" },
];

const drawings: Record<ProjectIcon, ReactNode> = {
  folder: <><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" /><path d="M3.5 10h17" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.8 12h16.4M12 3.5c-5 4.5-5 12.5 0 17m0-17c5 4.5 5 12.5 0 17" /></>,
  heart: <path d="M12 20 4.7 12.7C1.3 9.3 3.7 4.5 8 4.5c1.9 0 3.2.9 4 2.2.8-1.3 2.1-2.2 4-2.2 4.3 0 6.7 4.8 3.3 8.2Z" />,
  chart: <><path d="M4 4.5v14.8h16" /><path d="M7 15v-3m4 3V8m4 7V6m4 9v-4" /></>,
  pen: <><path d="m5 18.5 3.7-.8L19 7.4a2 2 0 0 0-2.8-2.8L5.9 14.9Z" /><path d="m14.9 5.9 3.2 3.2M4.5 20h15" /></>,
  file: <><path d="M6 3.5h8l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19.5V5a1.5 1.5 0 0 1 1-1.5Z" /><path d="M14 3.5v4h4M8 12h7m-7 3h7m-7 3h5" /></>,
  book: <><path d="M12 6c-2.6-1.8-5.5-1.7-8.5-1v13c3-.7 5.9-.8 8.5 1 2.6-1.8 5.5-1.7 8.5-1V5c-3-.7-5.9-.8-8.5 1Z" /><path d="M12 6v13" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 12.5c5.5 2.5 11.5 2.5 17 0M11 13.5h2" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M8 3.5v4m8-4v4M4 10h16M8 14h3m-3 3h3m3-3h2" /></>,
  code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4 10 20" /></>,
  image: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="m5 18 5-5 3 3 2.5-2.5L19 17" /></>,
  music: <><path d="M10 17V5l9-2v12M10 8l9-2" /><ellipse cx="7.5" cy="18" rx="2.5" ry="1.7" /><ellipse cx="16.5" cy="16" rx="2.5" ry="1.7" /></>,
  video: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" /></>,
  bulb: <><path d="M8.5 17c0-2-3-3.2-3-7a6.5 6.5 0 0 1 13 0c0 3.8-3 5-3 7Z" /><path d="M9 17h6m-5.5 3h5m-3.5 2h2" /></>,
  rocket: <><path d="M10 16c-2.5-2.5-2.8-5.8-.5-8.5C12 4.5 16 3.4 20 4c.6 4-1.1 8-3.5 10.5-2.7 2.3-6 2-8.5-.5Z" /><circle cx="14.5" cy="9.5" r="1.5" /><path d="m8 13-3.5 1L3 18l4-1m4 0-1 3.5L6 22l1-4M5 9c.3-1.8 1.5-3 3-3.5" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-2c0-3 2.2-4.5 5.5-4.5s5.5 1.5 5.5 4.5v2Z" /><path d="M16 5.5a2.8 2.8 0 0 1 0 5.5m1.5 2c2.4.4 3.5 1.7 3.5 4V19h-3.5" /></>,
  chat: <><path d="M5.5 4.5h13A2.5 2.5 0 0 1 21 7v9a2.5 2.5 0 0 1-2.5 2.5H9L4 21V7a2.5 2.5 0 0 1 1.5-2.5Z" /><path d="M8 9h8m-8 4h6" /></>,
  shield: <><path d="m12 3 8 3v5c0 5-3 8.5-8 10-5-1.5-8-5-8-10V6Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  puzzle: <path d="M8 4h3v2a2 2 0 1 0 4 0V4h5v5h-2a2 2 0 1 0 0 4h2v7h-5v-2a2 2 0 1 0-4 0v2H4v-7h2a2 2 0 1 0 0-4H4V4Z" />,
  leaf: <><path d="M20 4c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 10-6 9-16Z" /><path d="M5 20c3-5 7-8 12-11" /></>,
  gear: <><path d="M10 3h4l.5 2a7 7 0 0 1 1.7 1l2-.6 2 3.4-1.5 1.5a7 7 0 0 1 0 2l1.5 1.5-2 3.4-2-.6a7 7 0 0 1-1.7 1l-.5 2h-4l-.5-2a7 7 0 0 1-1.7-1l-2 .6-2-3.4 1.5-1.5a7 7 0 0 1 0-2L3.8 8.8l2-3.4 2 .6a7 7 0 0 1 1.7-1Z" /><circle cx="12" cy="12" r="2.5" /></>,
  star: <path d="m12 3 2.7 5.7 6.3.9-4.5 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9Z" />,
  flag: <><path d="M5 21V4m0 1c5-3 8 3 14 0v11c-6 3-9-3-14 0" /></>,
  building: <><path d="M5 21V5l7-2 7 2v16Z" /><path d="M3 21h18M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2M11 21v-4h2v4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 12 9 5 9-5m-18 4 9 5 9-5" /></>,
  link: <><path d="M10 8 8.5 9.5a4 4 0 0 0 5.7 5.7L16 13.4M14 16l1.5-1.5a4 4 0 0 0-5.7-5.7L8 10.6" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
};

const toneText: Record<ProjectTone, string> = { primary: "text-primary", secondary: "text-secondary", tertiary: "text-tertiary", error: "text-error" };

export function AssistantProjectIcon({ icon, tone, className }: { icon: ProjectIcon; tone: ProjectTone; className?: string }) {
  return <svg className={cn("size-4 shrink-0", toneText[tone], className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {drawings[icon] ?? drawings.folder}
  </svg>;
}
