export const HEYGEN_THEME = {
  surface: "bg-surface-container-lowest",
  surfaceMuted: "bg-surface-container-low",
  surfaceSoft: "bg-surface-container",
  border: "border-outline-variant",
  accentBorder: "border-primary",
  accentBg: "bg-primary/10",
  accentSolid: "bg-primary",
  accentSolidHover: "hover:bg-primary/90",
  textMuted: "text-on-surface-variant",
} as const;

export const HEYGEN_MODEL_OPTIONS = [
  { id: "Avatar V", description: "Chuyển động tự nhiên theo nội dung.", icon: "V", engineType: "avatar_v" as const },
  { id: "Avatar IV", description: "Chuyển động tiêu chuẩn, dễ dùng.", icon: "IV", engineType: "avatar_iv" as const },
  { id: "Avatar III", description: "Sử dụng API v2 và giọng đọc HeyGen.", icon: "III", engineType: "avatar_iii" as const },
] as const;

export const HEYGEN_CAPTION_STYLES = [
  { id: "brand", label: "Brand Kit", sample: "Bring your story to life" },
  { id: "clean", label: "Clean", sample: "Bring your story to life" },
  { id: "outline", label: "Outline", sample: "BRING YOUR STORY TO LIFE" },
  { id: "highlight", label: "Highlight", sample: "Bring your story to life" },
] as const;

export const HEYGEN_CAPTION_FONTS = [
  '"Be Vietnam Pro", Inter, sans-serif',
  'Inter, "Segoe UI", sans-serif',
  'Georgia, "Times New Roman", serif',
  '"Times New Roman", Georgia, serif',
];
