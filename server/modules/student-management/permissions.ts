export const STUDENT_AREA_PERMISSIONS = {
  "student-profile": {
    read: ["student:read", "student:manage", "student-profile:read", "student-profile:manage"],
    manage: ["student:manage", "student-profile:manage"],
  },
  course: { read: ["student:read", "student:manage", "course:read", "course:manage"], manage: ["student:manage", "course:manage"] },
  batch: { read: ["student:read", "student:manage", "batch:read", "batch:manage"], manage: ["student:manage", "batch:manage"] },
  exam: { read: ["student:read", "student:manage", "exam:read", "exam:manage"], manage: ["student:manage", "exam:manage"] },
  payment: { read: ["student:read", "student:manage", "payment:read", "payment:manage"], manage: ["student:manage", "payment:manage"] },
  "student-notification": { read: ["student:read", "student:manage", "student-notification:read", "student-notification:manage"], manage: ["student:manage", "student-notification:manage"] },
  "student-resource": { read: ["student:read", "student:manage", "student-resource:read", "student-resource:manage"], manage: ["student:manage", "student-resource:manage"] },
  assignment: { read: ["student:read", "student:manage", "assignment:read", "assignment:manage"], manage: ["student:manage", "assignment:manage"] },
  "custom-field": { read: ["custom-field:manage"], manage: ["custom-field:manage"] },
  "student-settings": { read: ["student-settings:manage"], manage: ["student-settings:manage"] },
  "company-smtp": { read: ["company-smtp:manage"], manage: ["company-smtp:manage"] },
} as const;
