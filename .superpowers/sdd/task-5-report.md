# Task 5 Report — Frontend retail reporting wiring

## Status

Implemented the Retail report types, scoped summary/export client, `bao-cao` permission/tab wiring, and a compile-only placeholder page for Task 6.

## TDD and verification

1. `npx vitest run src/modules/retail/retailTabPermissions.test.ts src/modules/retail/api/retailReports.api.test.ts`
   - Initial sandbox attempt: startup failed with `spawn EPERM` while Vite/esbuild loaded config; no tests executed.
   - Approved rerun (RED): exit 1. Permission suite had 3 expected failures because `bao-cao` was absent; API suite failed to resolve the not-yet-created `retailReports.api` module.
2. `npx vitest run src/modules/retail/retailTabPermissions.test.ts src/modules/retail/api/retailReports.api.test.ts`
   - GREEN: exit 0; 2 files passed, 7 tests passed.
3. `npm run typecheck`
   - Environment failure: the worktree has no local `node_modules`, so the script could not find `node_modules/typescript/bin/tsc`.
4. `node ../../node_modules/typescript/bin/tsc --noEmit`
   - First run: exit 1 with 3 test-only typing errors around Vitest spy instances/matcher generics.
   - After correcting those test typings: exit 0 with no diagnostics.
5. `npx vitest run src/modules/retail src/modules/shared/lib/apiFetch.test.ts`
   - Frontend retail regression: exit 0; 12 files passed, 27 tests passed.

## Files

- `src/modules/retail/types.ts`
- `src/modules/retail/api/retailReports.api.ts`
- `src/modules/retail/api/retailReports.api.test.ts`
- `src/modules/retail/retailTabPermissions.ts`
- `src/modules/retail/retailTabPermissions.test.ts`
- `src/modules/retail/RetailWorkspace.tsx`
- `src/modules/retail/pages/RetailReportsPage.tsx`
- `.superpowers/sdd/task-5-report.md`

## Self-review

- `RetailReport` mirrors the backend `RetailReportModel`, including optional `totalCost`, `grossProfit`, and `grossMarginPercent` projection fields.
- `RetailReportFilters` permits the backend-supported default-today, preset, or complete custom-range shapes and prevents mixing preset with dates.
- Summary and export always merge `companyCode` and `branchId` with the selected filter. The client never sends `includeProfit`.
- Export uses the current access token, parses API errors through the shared API error convention, prefers RFC 5987 filenames, sanitizes unsafe filename characters, removes the temporary anchor, and revokes the object URL in `finally`.
- `bao-cao` is operational for operator/manager/wildcard users, while `cai-dat` remains manager/wildcard only.
- No backend files or permissions were changed.
- The existing unrelated modification to `.superpowers/sdd/task-3-report.md` was preserved and excluded from this task's commit.

## Concerns / handoff

- `RetailReportsPage.tsx` is intentionally a minimal compile placeholder. Task 6 owns the complete dashboard and will replace it.
- The worktree relies on the parent repository dependencies; use `node ../../node_modules/typescript/bin/tsc --noEmit` for typechecking unless dependencies are installed inside the worktree.
