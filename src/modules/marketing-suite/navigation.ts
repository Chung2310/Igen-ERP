import { BookOpen, HeartHandshake, Megaphone, MessageSquare, Settings } from "lucide-react";
import type { TabType } from "../../types";

/** Navigation only: existing tab IDs, company modules and permissions remain authoritative. */
export const MARKETING_SUITE_MENU = [
  { label: "CHIẾN DỊCH NỘI DUNG", title: "Chiến dịch", icon: Megaphone },
  { label: "OMNI INBOX", title: "Message Facebook", icon: MessageSquare },
  { label: "MARKETING", title: "Chăm sóc tự động", icon: HeartHandshake },
  { label: "KHO TRI THỨC", title: "Kho tri thức", icon: BookOpen },
  { label: "TÍCH HỢP MARKETING", title: "Tích hợp & cấu hình", icon: Settings },
] as const satisfies ReadonlyArray<{ label: TabType; title: string; icon: typeof Megaphone }>;
