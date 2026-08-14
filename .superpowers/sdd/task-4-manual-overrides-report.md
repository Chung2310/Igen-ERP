# Task 4 Report: Editable Payroll Result Cells and Derived Preview

## Status

Implemented on `feat/payroll-inline-period-inputs`. The payroll table now consumes the authoritative employee-aggregated `run.effectiveLines`, exposes editable core result components and active custom variables only for managers on draft runs, keeps `deductionTotal` and `net` derived/read-only, and saves employee-keyed overrides through the bulk line-override API with optimistic versions and one trimmed reason.

## RED evidence

1. Helper module missing:

   ```powershell
   npx vitest run src/components/hr/payroll/payrollLineOverrides.test.ts
   ```

   Result: `FAIL`, 1 failed suite, expected error `Cannot find module './payrollLineOverrides'`. The first sandboxed attempt failed earlier with `spawn EPERM`; the same command was rerun with permission for esbuild child processes.

2. Payroll table still rendered period inputs and ignored `effectiveLines`:

   ```powershell
   npx vitest run src/components/hr/PayrollTab.test.tsx
   ```

   Result: `FAIL`, 5/5 tests failed. Primary expected failures were missing `baseSalary-e1` result input and missing authoritative effective row values in draft/review/closed/no-manage arrangements.

3. Literal removal of the old fixed labels:

   ```powershell
   npx vitest run src/components/hr/PayrollTab.test.tsx -t "keeps the custom catalog"
   ```

   Result: `FAIL`, 1 failed / 4 skipped because the old exact `Thưởng` column label remained. The result label was changed to `Tổng thưởng`.

4. Formula-detail regression guard:

   ```powershell
   npx vitest run src/components/hr/PayrollTab.test.tsx -t "keeps the custom catalog"
   ```

   Result: `FAIL`, 1 failed / 5 skipped because `Chi tiết adjustedBase-e1` was absent. The detail action was restored next to the editable/read-only adjusted-base value.

## GREEN evidence

1. Helper implementation:

   ```powershell
   npx vitest run src/components/hr/payroll/payrollLineOverrides.test.ts
   ```

   Result: `PASS`, 1 file and 6 tests passed.

2. Literal label and formula-detail micro-cycles:

   ```powershell
   npx vitest run src/components/hr/PayrollTab.test.tsx -t "keeps the custom catalog"
   ```

   Results after each implementation: `PASS`, 1 selected test passed.

3. Final guarded verification:

   ```powershell
   npx vitest run src/components/hr/PayrollTab.test.tsx src/components/hr/payroll/payrollLineOverrides.test.ts
   if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   npx tsc --noEmit --pretty false
   if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   git diff --check
   if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
   ```

   Result: exit `0`; Vitest reported 2 files and 12 tests passed; TypeScript emitted no errors; `git diff --check` emitted only Git's existing LF-to-CRLF working-copy warnings.

   Note: an earlier unguarded combined verification exposed a TypeScript error (`exact` is not a valid `ByRoleOptions` property) even though the final command masked the aggregate exit. The test was corrected and the guarded verification above was rerun successfully.

## Files

- `src/services/payrollService.ts`
- `src/components/hr/payroll/payrollLineOverrides.ts`
- `src/components/hr/payroll/payrollLineOverrides.test.ts`
- `src/components/hr/PayrollTab.tsx`
- `src/components/hr/PayrollTab.test.tsx`
- `.superpowers/sdd/task-4-manual-overrides-report.md`

## Self-review

- The six fixed period-input field keys and exact labels are absent from the table; the custom-variable catalog panel remains mounted unchanged.
- All 11 backend-supported result fields plus active custom variables are editable only for `canManage && run.status === "draft"`.
- Persisted overrides are cyan, unsaved drafts are amber, restore emits `clearFields`, and drafts stay employee/field keyed across table sorting/filtering.
- Payloads use nested `values`, optional `customValues`, trimmed shared `reason`, and GET/effective-line versions; partial failures retain only failed drafts and row errors.
- Preview matches the backend resolver formula and preserves hidden system income; `deductionTotal` and `net` are text-only.
- Review, closed, and no-manage modes show effective component values without inputs, restore controls, or save action.

## Concerns

No known blocking concerns. The table intentionally requires the Task 3 `effectiveLines` contract for any existing run rather than falling back to immutable system-only `run.lines`.
