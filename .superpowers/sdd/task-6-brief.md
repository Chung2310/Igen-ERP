# Task 6 brief: Frontend custom-field API, state and role capability

## Scope

Create frontend contracts/API/hook/permissions for six module keys. No UI renderer yet. No commits.

## Files

- Create `src/modules/student-management/custom-fields/types.ts`
- Create `src/modules/student-management/custom-fields/api.ts`
- Create `src/modules/student-management/custom-fields/useCustomFields.ts`
- Create `src/modules/student-management/custom-fields/permissions.ts`
- Create focused Vitest tests for hook/API/permissions under same folder.

## Contracts

Mirror backend exact ModuleKey, DynamicFieldType, FieldDefinition, value/file metadata, CreateFieldInput and UpdateFieldInput. Canonical file config uses `maxSizeMb` 1..100; never expose maxFileSize. API base is `/student-management/custom-fields` because `apiFetch` adds `/api/v1`.

```ts
canManageCustomFields(role?: string | null): boolean
```

true only for `superadmin`, `admin`, `manager` (Leader).

```ts
useCustomFields(moduleKey): {
  fields; loading; error;
  refresh(): Promise<void>;
  createField(input): Promise<FieldDefinition>;
  updateField(id,input): Promise<FieldDefinition>;
  archiveField(id): Promise<void>;
  restoreField(id): Promise<FieldDefinition>;
}
```

- Load active fields on mount/module change; protect against stale response after module change/unmount.
- Mutations update local state ordered by `order`, preserve archived fields only if loaded, and dispatch `CustomEvent("custom-fields:changed", {detail:{moduleKey}})`.
- Hook instances for same module listen and refresh; avoid self-trigger duplicate request by tagging event source or suppressing own listener.
- Errors become user-readable strings while mutation promises still reject for form handling.
- No global cache dependency/new package.

## Tests

Mock `apiFetch`; verify exact URLs/method/body, six keys/types, roles, initial load, stale response protection, create/update/archive/restore state, event sync without duplicate self-fetch, sorting, loading/error/reject behavior.

Run:

```powershell
npx.cmd vitest run src/modules/student-management/custom-fields
npm.cmd run typecheck
```

Write `.superpowers/sdd/task-6-report.md`. Preserve unrelated changes; no stage/commit.
