/** Canonical permission catalog shared by authorization and permission-management UIs. */
export interface PermissionCatalogEntry {
  code: string;
  label: string;
  group: string;
  description?: string;
}

type PermissionAction = "read" | "manage";

const AREA_DEFINITIONS = [
  ["dashboard", "Tổng quan"],
  ["people", "Con người"],
  ["relationship", "Quan hệ"],
  ["hr", "Nhân sự"],
  ["timekeeping", "Chấm công"],
  ["payroll", "Tiền lương"],
  ["work", "Công việc"],
  ["inventory", "Kho & sản phẩm"],
  ["retail", "Bán lẻ"],
  ["finance", "Tài chính"],
  ["resource", "Tài nguyên"],
  ["chat", "Trò chuyện"],
  ["recruitment", "Tuyển dụng"],
  ["settings", "Cấu hình"],
  ["access", "Người dùng & vai trò"],
] as const;

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = AREA_DEFINITIONS.flatMap(([area, group]) => [
  { code: `${area}:read`, label: `Xem ${group.toLocaleLowerCase("vi")}`, group },
  { code: `${area}:manage`, label: `Quản lý ${group.toLocaleLowerCase("vi")}`, group },
]);

export const PERMISSION_CODES = PERMISSION_CATALOG.map((entry) => entry.code);
const CANONICAL_PERMISSION_CODES = new Set(PERMISSION_CODES);

export const LEGACY_PERMISSION_MAP: Readonly<Record<string, string>> = {
  "student:read": "people:read",
  "student:manage": "people:manage",
  "worker:read": "people:read",
  "worker:manage": "people:manage",
  "teacher:operate": "people:manage",
  "student-profile:read": "people:read",
  "student-profile:manage": "people:manage",
  "course:read": "people:read",
  "course:manage": "people:manage",
  "batch:read": "people:read",
  "batch:manage": "people:manage",
  "exam:read": "people:read",
  "exam:manage": "people:manage",
  "payment:read": "people:read",
  "payment:manage": "people:manage",
  "student-notification:read": "people:read",
  "student-notification:manage": "people:manage",
  "student-resource:read": "people:read",
  "student-resource:manage": "people:manage",
  "assignment:read": "people:read",
  "assignment:manage": "people:manage",
  "partner:read": "relationship:read",
  "partner:manage": "relationship:manage",
  "customer:read": "relationship:read",
  "customer:manage": "relationship:manage",
  "candidate:read": "relationship:read",
  "candidate:manage": "relationship:manage",
  "user:read": "access:read",
  "user:manage": "access:manage",
  "role:manage": "access:manage",
  "face:manage": "access:manage",
  "kanban:read": "work:read",
  "kanban:manage": "work:manage",
  "project:read": "work:read",
  "project:manage": "work:manage",
  "stock:read": "inventory:read",
  "stock:manage": "inventory:manage",
  "product:manage": "inventory:manage",
  "wallet:read": "finance:read",
  "wallet:manage": "finance:manage",
  "receivable:read": "finance:read",
  "receivable:collect": "finance:manage",
  "receivable:adjust": "finance:manage",
  "payroll:prepare": "payroll:manage",
  "payroll:pay": "payroll:manage",
  "leave:approve": "timekeeping:manage",
  "retail:operate": "retail:read",
  "retail:manager": "retail:manage",
  "company-email:manage": "settings:manage",
  "company-smtp:manage": "settings:manage",
  "company-payment:manage": "settings:manage",
  "student-settings:manage": "settings:manage",
  "custom-field:manage": "settings:manage",
  "settings:manage": "settings:manage",
};

export const RETIRED_STUDENT_PERMISSIONS = Object.keys(LEGACY_PERMISSION_MAP).filter((code) =>
  /^(student|student-profile|course|batch|exam|payment|student-notification|student-resource|assignment):/.test(code),
);

export function isCanonicalPermission(code: string): boolean {
  return CANONICAL_PERMISSION_CODES.has(code);
}

export function normalizeStoredPermissions(
  codes: readonly string[] = [],
  options: { allowWildcard?: boolean } = {},
): string[] {
  const normalized = new Set<string>();
  for (const code of codes) {
    if (code === "*") {
      if (options.allowWildcard) normalized.add(code);
      continue;
    }
    const mapped = isCanonicalPermission(code) ? code : LEGACY_PERMISSION_MAP[code];
    if (mapped) normalized.add(mapped);
  }

  for (const code of [...normalized]) {
    const [area, action] = code.split(":") as [string, PermissionAction];
    if (action === "manage") normalized.delete(`${area}:read`);
  }
  return [...normalized].sort();
}

export function expandEffectivePermissions(codes: readonly string[]): Set<string> {
  const expanded = new Set(codes);
  for (const code of codes) {
    if (code.endsWith(":manage")) expanded.add(`${code.slice(0, -":manage".length)}:read`);
  }
  return expanded;
}

/** @deprecated Use `recruitment:manage` directly. */
export const RECRUITMENT_PERMISSION = "recruitment:manage";
