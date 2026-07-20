# Task 4 brief: Runtime value validation and six model envelopes

## Scope

Create runtime validator for custom field values and add `customFields` storage envelopes to students, courses, batches, exams, resources, partners. Do not touch payments/notifications or write paths yet. No commits.

## Files

- Create `server/modules/student-management/services/custom-field-value.service.ts`
- Create `server/modules/student-management/services/custom-field-value.service.test.ts`
- Modify six interfaces in `server/modules/student-management/interfaces/{student,course,batch,exam,resource,partner}.interface.ts`
- Modify six models in `server/modules/student-management/models/{student,course,batch,exam,resource,partner}.model.ts`
- Modify six Joi files in `server/modules/student-management/validations/{student,course,batch,exam,resource,partner}.validation.ts`

## API

```ts
export async function validateCustomFieldValues(input: {
  tenantId: string;
  moduleKey: ModuleKey;
  values: unknown;
  mode: "create" | "update";
}): Promise<CustomFieldValues>
```

Allow dependency injection for definition repository in tests. Fetch definitions by tenant/module, never client-selected collection.

## Rules

- Reject non-plain-object values and keys `__proto__`, `prototype`, `constructor`.
- Reject unknown keys; omit hidden/archived keys from returned object and never require them.
- Required visible fields fail for both create and update. This task validates the supplied complete value set; Task 5 merges old/new before update.
- Missing/empty: null, undefined, blank string, empty array; boolean false and number 0 are present.
- Normalize text/email/phone/url strings; finite numbers only; percent 0..100; ISO-compatible date/time/datetime strings; select value must be in options; multiSelect must contain unique allowed values; checkbox/switch boolean only.
- File/image object requires nonempty url/fileName and optional mimeType/size. Respect definition validation for allowedMimeTypes, maxSizeMb, maxFiles. `file` and `image` accept one object; `multiImage` accepts array.
- Preserve defaults only on create when incoming key is absent and defaultValue is nonempty; then validate default.
- Return a new null-prototype-safe plain object; never mutate input.

## Model/interface/Joi envelope

- Each interface imports `CustomFieldValues` and adds `customFields?: CustomFieldValues`.
- Each Mongoose schema adds `customFields: { type: Schema.Types.Mixed, default: {} }`.
- Each create/update Joi schema adds `customFields: Joi.object().unknown(true).optional()` so envelope passes to runtime validator. No other behavior change.

## Tests

Cover all 18 field types, required/hidden/archived, unknown/prototype keys, tenant/module query, defaults only create, nonmutation, text/number/date/select/boolean/file validations, zero/false presence, constraints and error labels in Vietnamese. Add schema tests proving all six models expose Mixed `customFields` and validation schemas accept envelope but still reject unrelated top-level keys according to existing behavior.

Run:

```powershell
npx.cmd tsx --test server/modules/student-management/services/custom-field-value.service.test.ts
npm.cmd run typecheck
```

Write `.superpowers/sdd/task-4-report.md`. Preserve unrelated dirty changes; no stage/commit.
