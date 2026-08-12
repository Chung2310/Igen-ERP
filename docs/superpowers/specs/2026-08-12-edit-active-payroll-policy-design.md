# Edit Active Payroll Policy Design

## Goal

Allow payroll managers to edit the currently active payroll formula without automatically recalculating payroll. After saving an active formula, the manager may optionally recalculate the payroll period currently selected in the payroll screen.

## User experience

- Managers can edit policies in `draft` or `active` status.
- Saving a draft policy keeps the existing direct-save behavior.
- Saving an active policy opens a confirmation dialog with three choices:
  - **Chỉ lưu cấu hình** updates the policy only.
  - **Lưu và cập nhật bảng lương** updates the policy, then recalculates the period currently selected in the payroll screen.
  - **Hủy** closes the confirmation without saving.
- Recalculation is available only when the selected period has no payroll run yet or its run is still `draft`.
- For `review`, `closed`, and `paid` runs, the dialog explains that the period cannot be recalculated and only offers configuration-only saving.
- If the policy save succeeds but recalculation fails, the saved policy remains in place. The UI reports the partial result and tells the manager to use **Cập nhật bảng lương** to retry.

## Policy versioning and historical data

- Updating an active policy uses the existing `expectedVersion` concurrency check and increments its version.
- Updating a policy does not mutate payroll calculation revisions or finalized payroll results.
- A recalculated draft run records the updated policy identity and version through the existing payroll calculation flow.
- Closed and paid periods remain immutable.

## Component and data flow

### Policy actions

`getPayrollPolicyActions` returns `edit` for both `draft` and `active` policies. Retired policies continue to require reactivation or cloning before editing.

### Policy manager

`PayrollPolicyManager` receives the selected period's run status and an optional recalculation callback from `PayrollTab`.

When an active policy form is submitted, the manager stores the pending definition and opens the save confirmation. It calls the existing update API only after the user chooses one of the save actions. For **Lưu và cập nhật bảng lương**, it waits for the update to succeed, refreshes the policy list, and then invokes the recalculation callback.

### Payroll tab

`PayrollTab` passes the current run status and a callback that invokes the existing period-processing operation. The callback operates only on the period currently selected when the confirmation is shown.

## Active-policy visual treatment

The active policy card uses an indigo-tinted background, stronger indigo border, subtle shadow, and a visible **Đang áp dụng** badge. Draft and retired cards keep the neutral treatment. The treatment is status-driven and does not depend on list position.

## Error handling

- Version conflicts and validation errors keep the editor or confirmation open and show the API message.
- A save failure prevents recalculation.
- A recalculation failure after a successful save closes the edit flow, refreshes the policy data, and shows a specific partial-success message.
- The update API remains protected by the existing `payroll:manage` permission.

## Tests

- Policy-action unit test: active policies include `edit`.
- Manager component tests: active edit opens confirmation; configuration-only choice updates without recalculation; save-and-update choice updates then recalculates; non-draft periods do not offer recalculation.
- Visual-state test: active card exposes the active badge and highlighted status styling.
- Backend policy-operation test: active policy updates are accepted with `expectedVersion`; conflicting versions still fail.
- Existing payroll processing and typecheck suites remain green.

## Out of scope

- Automatically recalculating every draft payroll period affected by the policy.
- Editing retired policies directly.
- Reopening review, closed, or paid periods from this confirmation.
- Rolling back a saved formula when the optional recalculation fails.
