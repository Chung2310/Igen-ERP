/**
 * Toàn bộ module học viên/lao động dùng chung đúng hai mã quyền: `people:read` để xem
 * và `people:manage` để thao tác. Các khu vực vẫn được liệt kê riêng để route khai báo
 * đúng ngữ nghĩa read/manage, nhưng không còn mã quyền chi tiết theo từng khu vực.
 */
// Shared workflow internals accept the permission of the active module. Module guards
// still isolate student and worker tenants before these permissions are evaluated.
export const STUDENT_AREA_PERMISSIONS = {
  "student-profile": { read: ["people:read"], manage: ["people:manage"] },
  course: { read: ["people:read"], manage: ["people:manage"] },
  batch: { read: ["people:read"], manage: ["people:manage"] },
  exam: { read: ["people:read"], manage: ["people:manage"] },
  payment: { read: ["people:read"], manage: ["people:manage"] },
  "student-notification": { read: ["people:read"], manage: ["people:manage"] },
  "student-resource": { read: ["people:read"], manage: ["people:manage"] },
  classroom: { read: ["people:read"], manage: ["people:manage"] },
  assignment: { read: ["people:read"], manage: ["people:manage"] },
  "student-quality": { read: ["people:read"], manage: ["people:manage"] },
  "learning-roadmap": { read: ["people:read"], manage: ["people:manage"] },
  "custom-field": { read: ["settings:read"], manage: ["settings:manage"] },
  "student-settings": { read: ["settings:read"], manage: ["settings:manage"] },
  "company-smtp": { read: ["settings:read"], manage: ["settings:manage"] },
} as const;
