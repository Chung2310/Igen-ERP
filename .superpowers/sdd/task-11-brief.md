# Task 11 brief: Acceptance regression and verification

Audit the entire dynamic custom field implementation against the approved six-form scope. Add only high-value acceptance tests needed to cover cross-layer gaps; do not duplicate focused tests. No commit.

Required checks: exact six modules; four roles; tenant isolation; create/update old required semantics; hidden/archive/restore; unknown/unsafe keys; file limits; CAS conflict; six frontend buttons/forms/payloads/details; exclusions unchanged. Verify no accidental payment/notification/action-form integration.

Create `server/modules/student-management/custom-fields.acceptance.test.ts` and/or `src/modules/student-management/custom-fields/CustomFieldsAcceptance.test.tsx` only where cross-layer assertions are practical without live Mongo/browser. Source-audit assertions are acceptable for mount/form wiring; prefer behavior tests.

Run fresh:

```powershell
npx.cmd tsx --test server/modules/student-management/models/custom-field-definition.model.test.ts server/modules/student-management/utils/custom-field.util.test.ts server/modules/student-management/services/custom-field.service.test.ts server/modules/student-management/routes/custom-field.routes.test.ts server/modules/student-management/services/custom-field-value.service.test.ts server/modules/student-management/services/custom-field-write-integration.test.ts server/modules/student-management/custom-fields.acceptance.test.ts
npx.cmd vitest run src/modules/student-management/custom-fields src/modules/student-management/components/Student/StudentCustomFields.test.tsx
npm.cmd run typecheck
npm.cmd run build
```

If a command exposes a feature defect, fix only in-scope defects and add regression. Report exact counts and output in `.superpowers/sdd/task-11-report.md`. No stage/commit.
