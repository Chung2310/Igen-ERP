# Task 5 brief: Enforce custom fields on six entity write paths

## Scope

Wire Task 4 runtime validation into create/update for students, courses, batches, exams, resources and partners. No payments/notifications. No commits.

## Files

- Modify controllers/services for `student`, `course`, `batch`, `exam`, `resource`, `partner` under `server/modules/student-management`.
- Create `server/modules/student-management/services/custom-field-write-integration.test.ts`.
- You may create one focused helper file to avoid duplicating context/merge logic.

## Contract

Define/use:

```ts
type CustomFieldWriteContext = { tenantId: string; moduleKey: ModuleKey };
```

Controllers derive tenant via `resolveCustomFieldTenant(req.user!)` and pass exact module key to service. Existing owner resolution/access filtering remains unchanged.

Create:

```ts
const customFields = await validateCustomFieldValues({
  tenantId: context.tenantId,
  moduleKey: context.moduleKey,
  values: data.customFields ?? {},
  mode: "create",
});
```

Update must first load the existing entity in authorized owner scope, merge old + patch values, then validate the COMPLETE merged set in `update` mode. This enforces new required fields only when Save is attempted. If entity missing, preserve existing 404/null behavior. Do not validate reads.

Sanitize write data: persist only validated `customFields`; prevent direct update operators/prototype keys; do not let `companyCode`, tenant or module enter entity data through this change. Preserve existing fixed-field normalization/uniqueness and return shapes.

Bulk student/partner imports are outside scope unless they call the same single-create path; do not silently make partial bulk operations fail due to new dynamic required fields.

## Tests

Use dependency injection/stubs, no live Mongo. Cover all six create paths call validator with correct tenant/module/mode; all six update paths merge existing+patch and validate update; field belonging to students rejected on courses; tenant A definitions do not apply tenant B; old record read succeeds without required new field; old record save fails until supplied; hidden/archive omitted; missing entity behavior; existing normalization preserved. Verify controller passes authenticated tenant, not body value.

Run:

```powershell
npx.cmd tsx --test server/modules/student-management/services/custom-field-write-integration.test.ts
npm.cmd run typecheck
```

Write `.superpowers/sdd/task-5-report.md`. Preserve unrelated changes; no stage/commit.
