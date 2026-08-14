/**
 * Toàn bộ module học viên/lao động dùng chung đúng hai mã quyền: `student:read` để xem
 * và `student:manage` để thao tác. Các khu vực vẫn được liệt kê riêng để route khai báo
 * đúng ngữ nghĩa read/manage, nhưng không còn mã quyền chi tiết theo từng khu vực.
 */
// Shared workflow internals accept the permission of the active module. Module guards
// still isolate student and worker tenants before these permissions are evaluated.
const STUDENT_READ = ["people:read", "people:manage", "people:read", "people:manage", "people:manage"];
const STUDENT_MANAGE = ["people:manage", "people:manage"];

export const STUDENT_AREA_PERMISSIONS = {
  "student-profile": { read: STUDENT_READ, manage: STUDENT_MANAGE },
  course: { read: STUDENT_READ, manage: STUDENT_MANAGE },
  batch: { read: STUDENT_READ, manage: STUDENT_MANAGE },
  exam: { read: STUDENT_READ, manage: STUDENT_MANAGE },
  payment: { read: STUDENT_READ, manage: STUDENT_MANAGE },
  "student-notification": { read: STUDENT_READ, manage: STUDENT_MANAGE },
  "student-resource": { read: STUDENT_READ, manage: STUDENT_MANAGE },
  "classroom": { read: STUDENT_READ, manage: STUDENT_MANAGE },
  assignment: { read: STUDENT_READ, manage: STUDENT_MANAGE },
  "student-quality": { read: STUDENT_READ, manage: STUDENT_MANAGE },
  "learning-roadmap": { read: STUDENT_READ, manage: STUDENT_MANAGE },
  "custom-field": { read: ["settings:manage"], manage: ["settings:manage"] },
  "student-settings": { read: ["settings:manage"], manage: ["settings:manage"] },
  "company-smtp": { read: ["settings:manage"], manage: ["settings:manage"] },
} as const;
