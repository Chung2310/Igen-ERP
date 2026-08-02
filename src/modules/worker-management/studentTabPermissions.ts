import { canReadWorkerArea } from "./workerPermissionPolicy";

const ORDERED_TABS = [
  ["tong-quan", null],
  ["khoa-hoc", "course"],
  ["lop-hoc", "batch"],
  ["hoc-vien", "student-profile"],
  ["hoc-phi", "payment"],
  ["lich-thi", "exam"],
  ["tai-nguyen", "student-resource"],
  ["thong-bao", "student-notification"],
] as const;

export function getAllowedStudentTabSlugs(
  permissions: readonly string[],
  preset: "student" | "candidate" | "worker" | "customer",
) {
  const hasUmbrella = permissions.some((code) =>
    ["*", "worker:read", "worker:manage"].includes(code),
  );
  return ORDERED_TABS.flatMap(([slug, area]) => {
    if (slug === "tong-quan") return hasUmbrella ? [slug] : [];
    if (
      preset !== "student" &&
      ["lop-hoc", "hoc-phi", "lich-thi", "tai-nguyen"].includes(slug)
    )
      return [];
    const effectiveArea =
      preset === "worker" && slug === "khoa-hoc" ? "batch" : area;
    return effectiveArea && canReadWorkerArea(permissions, effectiveArea)
      ? [slug]
      : [];
  });
}
