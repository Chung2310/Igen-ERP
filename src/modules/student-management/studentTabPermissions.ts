import { canReadStudentArea } from "../../utils/studentPermissionPolicy";

const ORDERED_TABS = [
  ["tong-quan", null],
  ["khoa-hoc", "course"],
  ["lop-hoc", "batch"],
  ["chat-luong-hoc-vien", "student-quality"],
  ["lo-trinh-va-cho-lop", "learning-roadmap"],
  ["bao-luu-hoc-lai", "batch"],
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
  role?: string,
) {
  const hasUmbrella = permissions.some((code) => ["*", "student:read", "student:manage", "teacher:operate"].includes(code));
  const isTeacherOnly = role === "teacher";
  return ORDERED_TABS.flatMap(([slug, area]) => {
    // Các thao tác của giảng viên đều bắt đầu từ lớp học được phân công;
    // không hiển thị các khu vực quản trị học viên, học phí hay cấu hình.
    if (isTeacherOnly && ![
      "khoa-hoc",
      "lop-hoc",
      "chat-luong-hoc-vien",
      "hoc-vien",
      "lich-thi",
      "tai-nguyen",
      "thong-bao",
    ].includes(slug)) return [];
    if (slug === "tong-quan") return hasUmbrella ? [slug] : [];
    if (preset !== "student" && ["lop-hoc", "chat-luong-hoc-vien", "lo-trinh-va-cho-lop", "hoc-phi", "lich-thi", "tai-nguyen", "phong-hoc"].includes(slug)) return [];
    const effectiveArea = preset === "worker" && slug === "khoa-hoc" ? "batch" : area;
    return effectiveArea && canReadStudentArea(permissions, effectiveArea) ? [slug] : [];
  });
}
