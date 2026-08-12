# Payroll Period Inputs Design

## Goal

Allow payroll managers to enter employee-specific inputs for a payroll period, overriding source salary, reconciled attendance, allowances, bonuses, deductions, and approved custom variables without modifying contracts or attendance records.

## Permissions and locking

- Read access follows existing payroll read access.
- Create, update, clear, and bulk-save operations require `payroll:manage`.
- Inputs are editable only when the selected payroll period has no run or its run is `draft`.
- `review`, `closed`, and `paid` periods are read-only.
- Reopening an eligible period to `draft` through the existing reason/permission workflow restores editability. Paid periods remain non-reopenable.
- Every write requires a reconciliation reason and uses optimistic versioning.

## Period input model

`PayrollPeriodInput` is scoped by company, branch, period, and employee. It contains optional overrides for:

- Agreed monthly salary.
- Reconciled work days.
- Reconciled work hours.
- Allowance total.
- Bonus total.
- Deduction total.
- Values for activated custom variables.

An absent field means use the existing source. A stored numeric zero is an explicit override and is never treated as absent. Each changed field records the actor, timestamp, reason, prior value, and new value in payroll audit metadata.

## Override precedence

During payroll calculation the effective value order is:

1. Period override.
2. Contract, attendance snapshot, or approved adjustment source.
3. Existing legacy fallback.

Agreed salary overrides the salary used for the selected period only. Reconciled days and hours override their corresponding snapshot fields independently; the system does not derive one override from the other.

Allowance, bonus, and deduction overrides replace their respective approved adjustment totals for that employee and period. They do not stack on top of the adjustment total. The UI always shows both source and effective values.

Saving input data does not automatically calculate payroll. The period is marked as needing payroll refresh and the UI displays **Bảng lương cần cập nhật** until the manager runs **Cập nhật bảng lương**.

## Custom variable catalog

Managers can define tenant-scoped custom variables with:

- Stable code, display name, description, unit, optional default value, status, and version.
- Units: `money`, `number`, `days`, `hours`, `minutes`, and `percent`.
- Lifecycle states: `draft`, `active`, and `retired`.

Draft variables can be edited. Once activated, the code is immutable so stored formulas remain valid. Retired variables are hidden from new period-entry columns but remain readable by historical snapshots. Variables referenced by closed payroll snapshots cannot be deleted.

Engine keys use the namespace `custom.<code>`. The formula engine validates custom keys against the active catalog for the same company. An employee without an explicit period value uses the catalog default. If neither exists, formula evaluation reports a blocking missing-variable issue.

## Snapshot provenance

Payroll calculation records the effective inputs used per employee. Each value includes its key, numeric value, and provenance:

- `period_override` for explicit period input.
- `system` for contract, attendance, or approved adjustment data.
- `default` for a custom variable default.
- `legacy_fallback` where the existing compatibility fallback was required.

Payroll line snapshots retain period-input version, custom-variable versions, resolved values, and provenance. Later edits therefore cannot change reviewed, closed, or paid payroll history.

## API behavior

The payroll API exposes:

- List effective/source period inputs for the selected branch and period.
- Upsert one employee row with `expectedVersion` and reason.
- Clear selected override fields to return them to source values.
- Bulk-save rows with independent validation and results per employee.
- CRUD/lifecycle endpoints for custom-variable definitions.

Bulk save is not all-or-nothing: valid rows are committed, while invalid or conflicting rows return stable employee-level error codes. Tenant and branch scope is applied to every lookup and mutation.

## Reconciliation table UI

The payroll tab gains a centralized **Dữ liệu đầu vào theo kỳ** table. Each employee is one row. Columns include agreed salary, reconciled days/hours, allowance, bonus, deduction, and one column for each active custom variable.

The table supports:

- Employee search and filtering.
- Inline numeric editing.
- Source value and override indicators.
- Save one row or all changed rows.
- Clear an override to restore its source value.
- A required reason before saving.
- Read-only presentation for non-draft periods.
- Row-level success, validation, and version-conflict feedback.

Version one supports manual entry only. Excel import/export is deferred.

## Validation and errors

- All stored values must be finite numbers.
- Salary, days, hours, allowance, bonus, and deduction cannot be negative.
- Custom values follow their unit rules; percent values must be within the catalog-defined percentage range of `0` through `100`.
- Reconciled days and hours are validated independently and may both be present.
- Writes without a non-empty reason fail validation.
- Version conflicts do not overwrite the newer row.
- Locked-period writes return a stable `PAYROLL_PERIOD_INPUT_LOCKED` conflict.

## Formula integration

The existing formula context builder consumes effective period inputs before evaluation. System variables such as `monthlySalary`, `standardWorkDays`, `actualWorkDays`, `standardWorkHours`, and `actualWorkHours` use period overrides when present. Active custom variables are added under `custom.<code>` with override/default provenance.

Formula traces and payroll snapshots include the resolved input provenance. Formulas remain independent and continue to execute by priority then code.

## Testing

- Explicit zero versus absent overrides.
- Salary, days, hours, allowance, bonus, and deduction precedence.
- Independent day/hour overrides without implicit conversion.
- Draft/no-run editability and review/closed/paid locking.
- Optimistic version conflicts and required reasons.
- Per-row bulk-save partial success.
- Custom-variable lifecycle, immutable active codes, namespace validation, defaults, and missing values.
- Formula context and snapshot provenance.
- Tenant/branch isolation and `payroll:manage` route protection.
- Reconciliation table row save, bulk save, clear override, source/effective display, refresh-needed badge, and read-only state.

## Out of scope

- Updating contract or attendance source records from payroll overrides.
- Automatically recalculating payroll after saving inputs.
- Excel import/export in version one.
- Text, date, or boolean custom variables.
- Editing inputs for review, closed, or paid periods without first reopening through the existing workflow.
