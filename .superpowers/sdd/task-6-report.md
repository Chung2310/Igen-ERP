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

---

## Review fix follow-up

### Status and files

Addressed all review findings in a separate fix commit. The follow-up changes:

- `src/modules/retail/components/reports/retailReportRange.ts` — one calendar/inclusive-range validator shared by persisted URL parsing and the custom filter form.
- `src/modules/retail/components/reports/RetailReportFilters.tsx` — shared validation plus an accessible preset group and linked invalid-input error semantics.
- `src/modules/retail/pages/RetailReportsPage.tsx` — canonical persisted-filter parsing and export context sequencing/cancellation.
- `src/modules/retail/api/retailReports.api.ts` — optional export `AbortSignal` and abort guards before fetch, after fetch/error parsing, and after blob loading before any download side effect.
- `src/modules/retail/components/reports/RetailSalesCharts.tsx` — separate actual rendered-series maximum from the safe SVG denominator.
- `src/modules/retail/pages/RetailReportsPage.test.tsx` — invalid persisted URL, stale summary rejection, stale export filter/branch, and accessibility regressions.
- `src/modules/retail/api/retailReports.api.test.ts` — abort-during-blob regression proving no object URL or anchor click.
- `src/modules/retail/components/reports/RetailSalesCharts.test.tsx` — rendered-series maximum and zero-maximum regressions.
- `.superpowers/sdd/task-6-report.md` — this review evidence.

The unrelated pre-existing `.superpowers/sdd/task-3-report.md` modification remains outside this work.

### RED evidence

Command:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx src/modules/retail/components/reports/RetailSalesCharts.test.tsx src/modules/retail/api/retailReports.api.test.ts
```

Result: exit 1; 3 test files failed; 7 failed and 14 passed. Failures reproduced all missing review behavior: reversed persisted ranges were sent to the API instead of falling back, report URL keys remained non-canonical, the preset wrapper had no `group` role, custom inputs lacked linked invalid state, export accepted no signal and downloaded after abort, page exports had no context invalidation, chart maximum included unrendered gross sales, and the zero chart displayed a synthetic maximum of 1. The newly added stale summary rejection regression already passed, confirming the existing summary sequence guard handled both late resolution and rejection.

### Targeted GREEN evidence

Shared URL validation and accessibility:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx -t "falls back|validates reversed"
```

Result: exit 0; 2 tests passed and 10 were skipped by the name filter.

Chart presentation scale:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/components/reports/RetailSalesCharts.test.tsx
```

Result: exit 0; 1 test file passed, 2/2 tests passed.

Export API cancellation:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/api/retailReports.api.test.ts
```

Result: exit 0; 1 test file passed, 7/7 tests passed.

Page export sequencing:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx -t "refresh or export|invalidates pending exports"
```

Result: exit 0; 2 tests passed and 10 were skipped by the name filter.

Integrated focused suite:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx src/modules/retail/components/reports/RetailSalesCharts.test.tsx src/modules/retail/api/retailReports.api.test.ts
```

Result: exit 0; 3 test files passed, 21/21 tests passed.

### Regression and type verification

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail src/config/retail-default-modules.test.ts src/modules/shared/lib/apiFetch.test.ts src/router/business-module-routes.test.tsx src/modules/business-module-isolation.test.ts
```

Result: exit 0; 17 test files passed, 51/51 tests passed.

```powershell
..\..\node_modules\.bin\tsc.cmd --noEmit
```

Result: exit 0 with no diagnostics.

### Review self-check

- Invalid, reversed, over-366-day, incomplete, ambiguous, or unknown persisted report filters now become `{}` and the URL is rewritten to the canonical today form while preserving unrelated parameters.
- Valid preset and custom shapes use the same canonical writer; custom UI and URL initialization call the same validation function.
- Filter/branch changes invalidate the active export sequence, abort the controller, clear current export state, and make late success/failure unable to update the new context.
- The API passes the signal to `fetch` and checks it after `blob()` before creating an object URL, so a superseded workbook cannot click-download even when a mocked or already-completed response ignores transport cancellation.
- Trend labels and paths use only net sales, collected amount, and refunds. The actual maximum may be zero; only the private coordinate denominator is clamped to one.
- Stale summary success and rejection paths are both covered.
- Presets expose a labeled `group`; both custom date inputs expose `aria-invalid` and reference the rendered alert through `aria-describedby`.

No Critical, Important, or Minor review findings remain. No dependencies or backend files changed.

### Follow-up concerns

- Summary requests still use sequence invalidation rather than transport abort because the existing shared `apiFetch` summary contract does not accept a signal. Both stale success and stale rejection are prevented from changing visible state.

---

## Commit-phase race follow-up

### Root cause

The first review fix aborted pending exports in a passive `useEffect`. A newly committed scope/filter could therefore exist while the old controller remained live until passive effects ran. Because the export API performs the final anchor click synchronously after its last abort check, an old export completing inside another layout effect could still download. The same implementation also canonicalized the URL from the lazy state initializer and assigned the export context ref directly during render.

### RED evidence

Command:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx -t "without mutating history|in commit phase"
```

Result: exit 1; 1 test file failed; 2 tests failed and 12 were skipped by the name filter.

- The sibling render probe observed `?sub=bao-cao&keep=1` instead of the original invalid `reportFrom`/`reportTo`, proving the lazy initializer mutated history during render.
- The commit-race harness changed branch and synchronously completed the old export from a parent layout effect. The old signal was eventually aborted, but the anchor click spy had already recorded one download before passive cleanup.

### GREEN evidence

Targeted commit-window regressions:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx -t "without mutating history|in commit phase"
```

Result: exit 0; 1 test file passed; 2 tests passed and 12 were skipped by the name filter.

Focused Task 6 page/component/API tests:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail/pages/RetailReportsPage.test.tsx src/modules/retail/components/reports/RetailSalesCharts.test.tsx src/modules/retail/api/retailReports.api.test.ts
```

Result: exit 0; 3 test files passed, 23/23 tests passed.

Expanded Retail frontend regression:

```powershell
..\..\node_modules\.bin\vitest.cmd run src/modules/retail src/config/retail-default-modules.test.ts src/modules/shared/lib/apiFetch.test.ts src/router/business-module-routes.test.tsx src/modules/business-module-isolation.test.ts
```

Result: exit 0; 17 test files passed, 53/53 tests passed.

TypeScript:

```powershell
..\..\node_modules\.bin\tsc.cmd --noEmit
```

Result: exit 0 with no diagnostics.

### Files

- `src/modules/retail/pages/RetailReportsPage.tsx`
- `src/modules/retail/pages/RetailReportsPage.test.tsx`
- `.superpowers/sdd/task-6-report.md`

### Self-review

- `readFiltersFromUrl` only parses and returns state; it no longer writes history.
- URL canonicalization runs in `useLayoutEffect` after commit and the URL writer deletes only the three report keys, preserving `sub` and unrelated keys such as the tested `keep=1`.
- Filter changes no longer write history from the event handler; the committed filter state is the single source for URL canonicalization.
- Export sequence invalidation, controller abort, and committed context-ref update execute together in a layout effect. Cleanup aborts the old controller before layout work for the new tree can finish a stale download.
- The export context ref is never assigned during render. Export completion compares against the context last recorded in commit phase.
- The race test uses a controlled adapter boundary to perform the same synchronous click side effect as the real API, from a parent layout effect before passive effects can run. The new code aborts first and records zero clicks.

No remaining Task 6 review concern was found. The unrelated pre-existing `.superpowers/sdd/task-3-report.md` modification remains excluded.
