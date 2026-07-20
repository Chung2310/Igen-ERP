# Task 1 brief: Contract, schema và tenant boundary

## Context

Xây nền tảng backend cho trường động của 6 module: `students`, `courses`, `batches`, `exams`, `resources`, `partners`. Làm trực tiếp trên nhánh `fix/modal`. Không sửa hoặc stage các thay đổi HR/Kanban và hai tài liệu đang modified.

## Global constraints

- Chỉ `superadmin`, `admin`, `manager` được quản lý trường; `manager` là Leader.
- Tenant lấy từ `companyCode`, fallback `centerId`, không lấy tùy ý từ body.
- Không áp dụng payments, notifications hoặc form hành động phụ.
- Thực hiện TDD và chỉ sửa file thuộc task này.

## Files

- Create `server/modules/student-management/interfaces/custom-field.interface.ts`
- Create `server/modules/student-management/models/custom-field-definition.model.ts`
- Create `server/modules/student-management/utils/custom-field.util.ts`
- Test `server/modules/student-management/models/custom-field-definition.model.test.ts`
- Test `server/modules/student-management/utils/custom-field.util.test.ts`

## Required interfaces

```ts
export const MODULE_KEYS = ["students", "courses", "batches", "exams", "resources", "partners"] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const DYNAMIC_FIELD_TYPES = [
  "shortText", "longText", "email", "phone", "url", "number", "percent",
  "currency", "date", "time", "dateTime", "singleSelect", "multiSelect",
  "checkbox", "switch", "file", "image", "multiImage",
] as const;
export type DynamicFieldType = typeof DYNAMIC_FIELD_TYPES[number];
export type CustomFieldValue = string | number | boolean | string[] |
  { url: string; fileName: string; mimeType?: string; size?: number } |
  Array<{ url: string; fileName: string; mimeType?: string; size?: number }> | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;
```

Define `IFieldDefinition` with: tenantId, moduleKey, key, label, type, placeholder?, defaultValue?, options?, validation?, isVisible, isRequired, isArchived, order, createdBy, updatedBy, timestamps.

Schema indexes:

```ts
customFieldDefinitionSchema.index({ tenantId: 1, moduleKey: 1, key: 1 }, { unique: true });
customFieldDefinitionSchema.index({ tenantId: 1, moduleKey: 1, isArchived: 1, order: 1 });
```

Utilities:

```ts
resolveCustomFieldTenant(user: { companyCode?: string; centerId?: string }): string
canManageCustomFields(role: string): boolean
```

Tenant resolver must reject/throw if neither companyCode nor centerId is present.

## Required tests

- Unique compound index exists.
- Query/order index exists.
- Roles superadmin/admin/manager return true; user/unknown return false.
- companyCode wins over centerId; centerId fallback; missing tenant throws.
- Module keys and field types match the exact arrays above.

Run:

```powershell
npx.cmd tsx --test server/modules/student-management/models/custom-field-definition.model.test.ts server/modules/student-management/utils/custom-field.util.test.ts
npm.cmd run typecheck
```

Commit only task files with message `feat: add custom field definition schema`. If Git permissions block commit, leave files unstaged and report it; do not stage unrelated changes.

## Report

Write full report to `.superpowers/sdd/task-1-report.md`: status, files, red/green test evidence, typecheck, commit hash or permission blocker, self-review and concerns.
