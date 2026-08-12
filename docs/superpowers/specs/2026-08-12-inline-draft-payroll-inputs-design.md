# Inline Draft Payroll Inputs Design

## Goal

Move payroll-period input editing into the existing payroll calculation table. Managers edit draft payroll values inline instead of using a separate reconciliation table.

## Layout

- Remove the standalone **Dữ liệu đầu vào theo kỳ** panel.
- Keep the custom-variable catalog as a separate configuration panel because it defines which optional columns exist.
- Extend the existing payroll table with editable columns for agreed salary, reconciled work days/hours, allowance, bonus, deduction, and each active custom variable.
- When no payroll run exists or the run is `draft`, managers can edit these cells inline.
- `review`, `closed`, and `paid` tables remain read-only.

## Editing states

- An untouched cell displays its effective value and source value when they differ.
- A locally edited but unsaved cell uses an amber treatment and an **Chưa lưu** indicator.
- A persisted period override uses a cyan treatment and exposes its original system value for comparison.
- Explicit `0` remains a valid override. An empty field means no local edit unless the user explicitly selects restore-to-source.
- Draft edits are keyed by employee and field, so filtering, searching, and sorting do not discard unsaved changes.

## Saving

- A single **Lưu thay đổi** action appears when at least one cell is dirty.
- Clicking it opens a confirmation dialog requiring one reconciliation reason for the entire batch.
- Only dirty employees and changed fields are sent to the existing bulk period-input API.
- Successful rows clear their local dirty state and reload persisted overrides.
- Failed or version-conflicted rows retain their unsaved values and show row-level feedback.
- Partial success is supported; successful rows are not rolled back because another row failed.
- Saving marks the period as **Bảng lương cần cập nhật** but never recalculates automatically.

## Restore to source

- A persisted override cell provides **Hoàn tác về dữ liệu nguồn**.
- Restore is treated as an explicit field-clear operation, not as numeric zero.
- Restores participate in the same dirty-state and batch-save flow and require the shared reason.
- After persistence, the cell displays the current contract, attendance, approved adjustment, or custom-variable default value.

## Audit and concurrency

- The backend stores before/after values, actor, timestamp, and batch reason for every changed or cleared field.
- Existing optimistic row versions remain required.
- Version conflicts never overwrite newer persisted input data.
- The table reloads successful rows while preserving conflicting local edits for manual review.

## Data flow

The payroll tab loads payroll rows and period-input metadata together. A focused inline-edit helper combines source values, persisted overrides, and local drafts without changing calculation results until the user saves and later runs **Cập nhật bảng lương**.

The existing period-input API is extended with explicit `clearFields` support. This avoids ambiguity between a missing JSON property, a restore request, and an explicit zero.

## Testing

- Dirty state survives filtering and sorting.
- Explicit zero differs from restore-to-source.
- Persisted overrides and unsaved edits have distinct visual states.
- The save button appears only for dirty cells and requires a reason.
- Bulk partial success clears successful rows and retains failed rows.
- Restore sends `clearFields` and reloads the source value.
- Non-draft periods are read-only.
- The standalone period-input table is no longer rendered.
- Existing period-input resolver, locking, audit, formula, and payroll calculation tests remain green.

## Out of scope

- Autosaving on blur.
- Per-row save buttons.
- Editing review, closed, or paid periods.
- Automatically recalculating payroll after saving inputs.
- Moving the custom-variable catalog into the payroll row table.
