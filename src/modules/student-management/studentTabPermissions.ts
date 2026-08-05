import { canReadStudentArea } from "../../utils/studentPermissionPolicy";

const ORDERED_TABS = [
  ["tong-quan", null],
  ["khoa-hoc", "course"],
  ["lop-hoc", "batch"],
  ["chat-luong-hoc-vien", "student-quality"],
  ["hoc-vien", "student-profile"],
  ["hoc-phi", "payment"],
  ["lich-thi", "exam"],
  ["phong-hoc", "classroom"],
  ["tai-nguyen", "student-resource"],
  ["thong-bao", "student-notification"],
] as const;

export function getAllowedStudentTabSlugs(
  permissions: readonly string[],
  preset: "student" | "candidate" | "worker" | "customer",
) {
  const hasUmbrella = permissions.some((code) => ["*", "student:read", "student:manage"].includes(code));
  return ORDERED_TABS.flatMap(([slug, area]) => {
    if (slug === "tong-quan") return hasUmbrella ? [slug] : [];
    if (preset !== "student" && ["lop-hoc", "chat-luong-hoc-vien", "hoc-phi", "lich-thi", "tai-nguyen", "phong-hoc"].includes(slug)) return [];
    const effectiveArea = preset === "worker" && slug === "khoa-hoc" ? "batch" : area;
    return effectiveArea && canReadStudentArea(permissions, effectiveArea) ? [slug] : [];
  });
}
