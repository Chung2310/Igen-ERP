# Task 6 Report — Retail dashboard filters, KPIs, charts and tables

## Status

Implemented the branch-scoped Retail reporting dashboard with persisted date filters, backend-owned KPI display, dependency-free SVG/CSS charts, cashier/shift/debt tables, block skeletons, retry/export error handling, and stale-response protection.

## Files

- `src/modules/retail/pages/RetailReportsPage.tsx`
- `src/modules/retail/pages/RetailReportsPage.test.tsx`
- `src/modules/retail/components/reports/RetailReportFilters.tsx`
- `src/modules/retail/components/reports/RetailKpiGrid.tsx`
- `src/modules/retail/components/reports/RetailSalesCharts.tsx`
- `src/modules/retail/components/reports/RetailReportTables.tsx`
- `.superpowers/sdd/task-6-report.md`

The pre-existing unrelated modification to `.superpowers/sdd/task-3-report.md` was preserved and excluded from this task.

## RED evidence

Command:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx
```

The first sandboxed run could not start Vite because esbuild process spawning returned `EPERM`, so the same command was rerun outside the sandbox. Result: exit 1; 1 test file failed and 9/9 tests failed. The failures were caused by the Task 5 placeholder: the summary API had zero calls and the page did not contain the required filter controls, branch prompt, KPI region, charts, tables, or error states.

## GREEN and verification evidence

Focused page suite:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx
```

Result: exit 0; 1 test file passed, 9/9 tests passed. Coverage includes today/7-day/30-day/custom filters, URL reload persistence for preset and custom filters, inclusive 366-day validation, operator/manager KPI projection, empty data, refresh/export failures, retry, stale response sequencing, branch changes, and missing branch scope.

Expanded Retail frontend regression:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail src/config/retail-default-modules.test.ts src/modules/shared/lib/apiFetch.test.ts src/router/business-module-routes.test.tsx src/modules/business-module-isolation.test.ts
```

Result: exit 0; 16 test files passed, 45/45 tests passed.

TypeScript:

```powershell
..\..\node_modules\.bin\tsc.cmd --noEmit
```

Result: exit 0 with no diagnostics.

Diff checks:

```powershell
git -c safe.directory='D:/Igen Tech/Igen-ERP/.worktrees/retail-phase-4' diff --check
```

Result: exit 0; no whitespace errors.

## Implementation notes

- The URL stores only `reportPreset`, `reportFrom`, and `reportTo`, preserving unrelated parameters such as `sub=bao-cao`; it never persists company or branch scope.
- The page always obtains `companyCode` and `branchId` from `useRetailScope`. Data is keyed to that scope and disappears immediately when the active branch changes.
- Each request receives a monotonically increasing sequence. Effect cleanup and newer requests invalidate older responses so they cannot overwrite current data.
- Refresh failures retain the last successful dashboard for the same scope. Export failures use independent state and never clear report data.
- KPI components render cost, gross profit, and gross margin only when the corresponding optional backend fields are present. No client permission inference or business-metric recomputation was added.
- Charts use the report's `timeSeries` and `paymentMix` fields directly. Their only derived values are visual scales and SVG coordinates.
- Cashier, shift, and debt tables each use a horizontal overflow container. Controls have explicit labels, pressed/disabled state, status or alert roles, and Vietnamese copy.
- No chart package or other dependency was added.

## Self-review

- Scope: no company/branch selector or URL scope persistence; requests use the active Retail scope only.
- Privacy: profit KPI visibility is field-presence based; operator payloads cannot create blank or inferred profit cards.
- State: old responses are ignored, cross-branch report data is never rendered, and same-scope errors keep the last success.
- Filters: defaults delegate Vietnam business-day selection to the backend, presets serialize exactly as `7d`/`30d`, and custom ranges validate format/order/inclusive 366-day maximum.
- Presentation: child components format/display backend fields without recalculating net sales, profit, margin, debt, or cashier/shift totals.
- Accessibility/responsiveness: labeled controls, alerts/statuses, block skeletons, responsive SVG/cards, and table overflow are present.

No Critical or Important self-review findings remained.

## Concerns

- `retailReportsApi.summary` does not currently accept an `AbortSignal`; this task prevents stale writes through request-sequence invalidation, but superseded HTTP requests may still finish in the background.
- Full production build and the complete backend Retail suite remain the Phase 4 Task 7 completion gate; Task 6 ran the requested focused page suite, expanded Retail frontend regression, and TypeScript typecheck.
