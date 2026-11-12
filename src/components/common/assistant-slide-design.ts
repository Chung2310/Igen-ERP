import type { AssistantSlideContent, AssistantSlideLayout, AssistantSlideThemeId } from "../../shared/assistant-slide";

export interface AssistantSlideTheme {
  id: AssistantSlideThemeId;
  label: string;
  description: string;
  canvas: string;
  paper: string;
  ink: string;
  muted: string;
  primary: string;
  secondary: string;
  soft: string;
  line: string;
  cards: readonly [string, string, string, string, string];
  accents: readonly [string, string, string, string, string];
}

const baseAssistantSlideThemes = [
  { id: "ocean", label: "Biển xanh", description: "Sáng rõ, tin cậy", canvas: "#EFF6FF", paper: "#FFFFFF", ink: "#172554", muted: "#475569", primary: "#2563EB", secondary: "#06B6D4", soft: "#DBEAFE", line: "#93C5FD", cards: ["#DBEAFE", "#CFFAFE", "#DCFCE7", "#FEF3C7", "#FCE7F3"] },
  { id: "meadow", label: "Vườn tươi", description: "Tươi mới, gần gũi", canvas: "#F0FDF4", paper: "#FFFFFF", ink: "#14532D", muted: "#3F5F4A", primary: "#16A34A", secondary: "#0D9488", soft: "#DCFCE7", line: "#86EFAC", cards: ["#DCFCE7", "#CCFBF1", "#FEF3C7", "#E0E7FF", "#FCE7F3"] },
  { id: "sunrise", label: "Nắng ấm", description: "Nổi bật, lạc quan", canvas: "#FFF7ED", paper: "#FFFFFF", ink: "#431407", muted: "#6B4F45", primary: "#EA580C", secondary: "#E11D48", soft: "#FFEDD5", line: "#FDBA74", cards: ["#FFEDD5", "#FFE4E6", "#FEF3C7", "#E0F2FE", "#F3E8FF"] },
  { id: "berry", label: "Sắc màu", description: "Sáng tạo, sinh động", canvas: "#FDF4FF", paper: "#FFFFFF", ink: "#3B0764", muted: "#65506D", primary: "#A21CAF", secondary: "#DB2777", soft: "#FAE8FF", line: "#E879F9", cards: ["#FAE8FF", "#FCE7F3", "#DBEAFE", "#DCFCE7", "#FEF3C7"] },
] as const;

const assistantSlideAccents: Record<AssistantSlideThemeId, AssistantSlideTheme["accents"]> = {
  ocean: ["#3154D8", "#C75132", "#0F766E", "#A73E72", "#A16207"],
  meadow: ["#15803D", "#0F766E", "#A16207", "#4338CA", "#A73E72"],
  sunrise: ["#C2410C", "#BE123C", "#0F766E", "#1D4ED8", "#7E22CE"],
  berry: ["#86198F", "#BE185D", "#1D4ED8", "#15803D", "#A16207"],
};

export const assistantSlideThemes: AssistantSlideTheme[] = baseAssistantSlideThemes.map(theme => ({
  ...theme,
  ...(theme.id === "ocean" ? {
    label: "Nắng kem",
    description: "Nền kem, cobalt và điểm nhấn đa sắc",
    canvas: "#FBF8F0",
    ink: "#202B3C",
    muted: "#5F6672",
    primary: "#3154D8",
    secondary: "#C75132",
    soft: "#EAF0FF",
    line: "#D8DFEA",
    cards: ["#E5EDFF", "#FDE8DC", "#DDF2E5", "#F4DFF0", "#F8EEC1"] as [string, string, string, string, string],
  } : {}),
  accents: assistantSlideAccents[theme.id as AssistantSlideThemeId],
}));

export const assistantSlideLayoutOptions: Array<{ id: AssistantSlideLayout | "auto"; label: string; description: string }> = [
  { id: "auto", label: "Tự chọn", description: "Chọn cách trình bày theo nội dung" },
  { id: "cards", label: "Thẻ ý chính", description: "Chia nội dung thành các ý nổi bật" },
  { id: "timeline", label: "Dòng thời gian", description: "Sắp xếp các mốc theo trình tự" },
  { id: "steps", label: "Các bước", description: "Làm rõ từng bước thực hiện" },
  { id: "comparison", label: "So sánh", description: "Nhóm hai vế để đối chiếu" },
  { id: "chart", label: "Biểu đồ", description: "Dùng số liệu có sẵn trong slide" },
];

export interface AssistantSlideMetric {
  label: string;
  rawValue: string;
  value: number;
  unit: string;
}

function parseLocaleNumber(raw: string): number {
  let value = raw.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  else if (/^\d{1,3}(,\d{3})+$/.test(value)) value = value.replace(/,/g, "");
  else value = value.replace(",", ".");
  return Number(value);
}

export function getSlideMetrics(slide: AssistantSlideContent): AssistantSlideMetric[] {
  const result: AssistantSlideMetric[] = [];
  for (const bullet of slide.bullets) {
    if (/^\s*(?:(?:bước|mốc|giai đoạn|phần)\s*)?\d+[.)-]\s/i.test(bullet)) continue;
    const match = bullet.match(/(?<![\p{L}\p{N}])(\d[\d.,]*)\s*(%|triệu|tỷ|đồng|vnđ|vnd|ngày|tháng|năm|người|khách hàng|khách|đơn vị|lượt|lần)\b/iu);
    if (!match) continue;
    const value = parseLocaleNumber(match[1]);
    const unit = match[2].toLocaleLowerCase("vi-VN");
    if (!Number.isFinite(value) || value < 0) continue;
    result.push({ label: bullet, rawValue: `${match[1]} ${match[2]}`.trim(), value, unit });
  }
  return result.length > 1 && new Set(result.map(item => item.unit)).size === 1 ? result : [];
}

export function inferSlideLayout(slide: AssistantSlideContent): AssistantSlideLayout {
  if (slide.layout) return slide.layout;
  if (getSlideMetrics(slide).length >= 2) return "chart";
  const source = `${slide.title} ${slide.keyMessage} ${slide.bullets.join(" ")}`.toLocaleLowerCase("vi-VN");
  if (/\b(timeline|lộ trình|theo thời gian|tháng|tuần|năm|giai đoạn|mốc)\b/.test(source)) return "timeline";
  if (/\b(so sánh|đối chiếu|trước và sau|khác biệt|vs\.?|so với)\b/.test(source)) return "comparison";
  if (/\b(bước|quy trình|thực hiện|bắt đầu|tiếp theo|cuối cùng|đầu tiên)\b/.test(source)) return "steps";
  return "cards";
}

export function getAssistantSlideTheme(id: AssistantSlideThemeId | undefined): AssistantSlideTheme {
  return assistantSlideThemes.find(theme => theme.id === id) || assistantSlideThemes[0];
}
