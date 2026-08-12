# Payroll Formula Library Design

## Goal

Create a no-code payroll formula library for custom allowances, bonuses, deductions, and adjustments. Formulas use only approved system variables and safe operators, conditions, rounding rules, and execution priority.

## Scope

The library supplements the existing statutory payroll policy. It does not replace insurance, personal income tax, overtime statutory rules, or the core net-pay calculation. Version one uses system variables only; managers cannot define arbitrary per-period variables.

## Formula lifecycle and permissions

- The existing manager permission (`payroll:manage`) controls create, edit, clone, activate, and retire operations.
- Formulas have `draft`, `active`, and `retired` states.
- Draft formulas can be edited directly.
- Active formulas can be edited with optimistic versioning. The save confirmation offers configuration-only saving or saving followed by recalculation of the selected payroll period when that period is absent or `draft`.
- Retired formulas must be reactivated or cloned before editing.
- Active formula cards use a strong visual highlight and an **Đang áp dụng** badge.

## Data model

Each formula stores:

- Company scope, code, name, description, version, status, and audit actors/timestamps.
- Effective start and optional end date.
- Result bucket: `allowance`, `bonus`, `deduction`, or `adjustment`.
- Integer execution priority.
- A condition set, numeric expression tree, and rounding rule.

An expression node is one of:

- A numeric constant.
- An approved variable reference.
- A binary arithmetic operation (`add`, `subtract`, `multiply`, `divide`).
- A percentage operation.
- A `min` or `max` operation.

A condition set contains zero or more comparisons and one shared combinator, `and` or `or`. Comparisons support `equal`, `notEqual`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, and `lessThanOrEqual`. Nested condition groups are not supported.

Rounding modes are `none`, `nearest`, `up`, and `down`, with units restricted to `1`, `10`, `100`, or `1000` VND.

Formulas cannot reference other formulas or their results. Priority determines deterministic evaluation and display order only. Results are accumulated into their configured buckets.

## Approved variable catalog

Version one exposes read-only variables with Vietnamese labels, descriptions, units, and stable machine keys:

- Monthly salary and attendance-adjusted salary.
- Standard and actual work days.
- Standard and actual work hours.
- Shortage minutes, late minutes, and early-leave minutes.
- Paid-leave days.
- Weekday, rest-day, and holiday overtime hours.
- Employee tenure in months.

Sales and product-count variables are excluded until a canonical employee-period data source exists. The catalog is centralized so later variables can be added without changing stored expression syntax.

## Safe evaluation

- Formulas are stored and evaluated as validated structures; JavaScript, `eval`, scripts, and free-form expression text are prohibited.
- Both save-time and execution-time validation reject unknown variables/operators, malformed nodes, excessive expression depth, invalid rounding, and non-finite constants.
- Constant division by zero is rejected at save time. Runtime division by zero or a missing required variable produces a blocking employee calculation issue.
- Evaluation returns both the numeric result and trace steps suitable for payroll explanation views.
- Execution order is stable by ascending priority, then code. Duplicate priorities are allowed because formula results are independent.

## No-code user interface

The payroll configuration area gains a **Thư viện công thức** section. Cards show name, result bucket, status, priority, effective period, and a Vietnamese summary.

The create/edit modal contains:

1. General information and result bucket.
2. Optional condition rows using variable, comparison, and value controls plus one `VÀ/HOẶC` selector.
3. A block-based numeric expression builder using approved variables, constants, and operators.
4. Rounding and priority controls.
5. Preview with sample inputs, calculated result, and trace steps.

Initial reusable templates are attendance allowance, work-day bonus, and late-arrival deduction. They are created as drafts so each company explicitly reviews and activates them.

## Payroll integration

When a payroll period is calculated or refreshed:

1. Load active formulas effective on the payroll calculation date.
2. Build a read-only variable context for each employee from contract, attendance, leave, overtime, and employment data.
3. Evaluate conditions and expressions in deterministic priority order.
4. Apply rounding and accumulate results into allowance, bonus, deduction, or adjustment totals.
5. Feed accumulated totals into the existing statutory payroll calculation.

Each payroll line snapshot records formula code, formula version, result bucket, input variables used, computed value, and trace steps. Closed and paid periods therefore retain their historical result when library formulas change later.

## Error handling

- Invalid definitions return stable API error codes and field-addressable validation details.
- A save failure prevents optional payroll recalculation.
- A recalculation failure after a successful active-formula save reports partial success and does not roll back the formula.
- An employee-specific evaluation failure blocks that employee calculation and identifies the formula and reason.

## Testing

- Expression validation and evaluation for every node and comparison type.
- `and`/`or` conditions, all rounding modes, depth limits, missing variables, and division by zero.
- Deterministic priority ordering and accumulation into all four result buckets.
- Formula version and trace persistence in payroll snapshots.
- CRUD, lifecycle, optimistic concurrency, tenant scoping, and manager permission tests.
- No-code builder serialization, validation, preview, active-save confirmation, and active-card highlighting.
- Regression coverage for existing statutory payroll policies and payroll period recalculation.

## Out of scope

- Replacing statutory insurance, tax, overtime, or net-pay logic.
- Free-form source code or Excel-like formulas.
- Nested condition groups.
- Formula-to-formula references.
- User-defined variables, sales variables, or product-count variables in version one.
- Automatically reopening review, closed, or paid payroll periods.
