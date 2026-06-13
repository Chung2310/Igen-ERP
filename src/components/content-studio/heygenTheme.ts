export const HEYGEN_THEME = {
  surface: "bg-white",
  surfaceMuted: "bg-slate-50",
  surfaceSoft: "bg-slate-100",
  border: "border-slate-200",
  accentBorder: "border-cyan-400",
  accentBg: "bg-cyan-50",
  accentSolid: "bg-cyan-600",
  accentSolidHover: "hover:bg-cyan-700",
  textMuted: "text-slate-500",
} as const;

export const HEYGEN_MODEL_OPTIONS = [
  { id: "Avatar V", description: "Chuyen dong tu nhien theo noi dung.", icon: "V", engineType: "avatar_v" as const },
  { id: "Avatar IV", description: "Chuyen dong tieu chuan, de dung.", icon: "IV", engineType: "avatar_iv" as const },
] as const;

export const HEYGEN_CAPTION_STYLES = [
  { id: "brand", label: "Brand Kit", sample: "Bring your story to life" },
  { id: "clean", label: "Clean", sample: "Bring your story to life" },
  { id: "outline", label: "Outline", sample: "BRING YOUR STORY TO LIFE" },
  { id: "highlight", label: "Highlight", sample: "Bring your story to life" },
] as const;

export const HEYGEN_CAPTION_FONTS = [
  "Georgia, serif",
  "\"Racing Sans One\", sans-serif",
  "\"Trebuchet MS\", sans-serif",
  "\"Times New Roman\", serif",
];
