# Task 2 brief: Custom field configuration service

## Context and constraints

Build service logic on top of Task 1 files. Scope only six module keys. Preserve unrelated dirty files. User explicitly waived all commits: do not stage or commit anything.

## Files

- Create `server/modules/student-management/services/custom-field.service.ts`
- Test `server/modules/student-management/services/custom-field.service.test.ts`
- Modify Task 1 files only if a test reveals a real contract defect.

## Required API

```ts
type CustomFieldContext = { tenantId: string; actorId: string };

CustomFieldService.list(tenantId: string, moduleKey: ModuleKey, includeArchived?: boolean): Promise<IFieldDefinition[]>
CustomFieldService.create(context: CustomFieldContext, input: CreateFieldInput): Promise<IFieldDefinition>
CustomFieldService.update(context: CustomFieldContext, id: string, input: UpdateFieldInput): Promise<IFieldDefinition>
CustomFieldService.archive(context: CustomFieldContext, id: string): Promise<IFieldDefinition>
CustomFieldService.restore(context: CustomFieldContext, id: string): Promise<IFieldDefinition>
CustomFieldService.hasStoredValues(tenantId: string, moduleKey: ModuleKey, key: string): Promise<boolean>
```

`CreateFieldInput` includes moduleKey, label, type and optional placeholder/defaultValue/options/validation/isVisible/isRequired. `UpdateFieldInput` excludes tenantId/moduleKey/key/createdBy and permits the mutable config plus order.

## Behavior

- Derive stable camelCase ASCII key from Vietnamese label; reject empty result and reserved `_id`, `ownerId`, `tenantId`, `customFields`, `createdAt`, `updatedAt`.
- Resolve key collision within tenant/module by suffixing `2`, `3`, ... atomically enough to rely on the DB unique index for final enforcement.
- New order is max active/archived order + 1.
- Hidden implies `isRequired=false`. Archived implies hidden and not required. Restore sets `isArchived=false`, `isVisible=true` and does not automatically make required.
- Never hard delete.
- Type cannot change when `hasStoredValues` is true; type may change when no data exists.
- Select types require non-empty unique options; non-select types remove/ignore options.
- `hasStoredValues` uses a fixed model registry for students/courses/batches/exams/resources/partners. Resolve company user ids from `User` by companyCode/tenantId, then query entity `ownerId` in those ids. Do not derive collection/model names from client input.
- Treat absent, null, empty string and empty array as no stored value; false and 0 are stored values.
- Map Mongo duplicate key error to a clear Vietnamese domain error.

## Tests

Use dependency injection or model stubs so tests need no live MongoDB. Cover slug/key, collision, order, list active/archive, hidden/required, archive/restore, type change with/without values, registry selection, false/0 detection, empty values, select options, reserved keys, tenant scoping, duplicate-key error.

Run red then green:

```powershell
npx.cmd tsx --test server/modules/student-management/services/custom-field.service.test.ts
npm.cmd run typecheck
```

## Report

Write `.superpowers/sdd/task-2-report.md` with status, files, red/green evidence, typecheck, self-review, concerns. Do not commit.
