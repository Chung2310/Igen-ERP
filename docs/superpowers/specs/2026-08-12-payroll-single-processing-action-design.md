# Payroll Single Processing Action Design

## Goal

Replace the three separate draft-period controls—**Đồng bộ công**, **Khóa công**, and **Tính lương**—with one manager action. The action always uses the latest attendance data and may be run again while the payroll period remains in `draft` to refresh the payroll results.

## User Experience

The payroll screen shows one primary processing button only when the selected period has no payroll run or its run is in `draft`:

- No payroll run: **Tính lương**.
- Existing draft payroll run: **Cập nhật bảng lương**.
- While executing: **Đang tính lương...** or **Đang cập nhật...**; the button is disabled to prevent duplicate submissions.

The existing three buttons are removed. The warning that instructs the user to synchronize attendance manually is also removed because synchronization becomes part of the action. Review, close, reopen, and mark-paid controls remain unchanged. The processing action is hidden after the run leaves `draft`.

On success, the screen reloads the period and displays a success toast. On failure, it displays the backend error and keeps the period in the last state safely completed by the server. The user may press the button again to retry the complete operation.

## Backend Orchestration

Add one endpoint under the payroll API, protected by `payroll:manage`, that accepts a period key and orchestrates the existing business operations in this strict order:

1. Synchronize the latest attendance results for the period.
2. Lock the synchronized attendance results.
3. Create the payroll run, or update/recalculate the existing run when it is still `draft`.

The orchestrator stops immediately when a step fails and returns an error identifying the failed step. It does not attempt later steps after a failure. A retry starts the sequence again from synchronization; therefore each underlying operation must retain its current repeat-safe behavior.

The endpoint rejects processing when an existing run is in `review`, `closed`, or `paid`. It uses the same company and branch scope as the existing period endpoints. The existing snapshot, lock, and create-run endpoints remain available for compatibility, but `PayrollTab` no longer calls them directly.

## Boundaries

The orchestrator coordinates existing controller/service behavior rather than duplicating attendance or payroll calculation logic. A focused orchestration unit will expose the sequential contract so order and failure behavior can be tested without an HTTP server. The controller supplies the authenticated scope and actor, while the frontend owns only button labeling, loading state, and reload/toast behavior.

This change does not introduce a background job, progress polling, rollback of a successfully completed earlier step, or changes to workflow states.

## Error Handling

Errors are returned with the failed stage (`sync_attendance`, `lock_attendance`, or `calculate_payroll`) and the underlying message. No subsequent operation is invoked. The UI prevents an additional click while the request is active and always clears its loading state after success or failure.

If synchronization or locking completed before a later failure, those safe intermediate results remain stored. Pressing the button again re-runs synchronization, locking, and calculation from the beginning.

## Testing

Automated coverage will verify:

- The orchestration order is synchronize, lock, then create/update payroll.
- A failure at each stage prevents every later stage from running and identifies that stage.
- An existing `draft` run is updated; non-draft runs are rejected.
- The HTTP route requires `payroll:manage`.
- The frontend policy produces **Tính lương** for no run, **Cập nhật bảng lương** for a draft run, and hides the action for later workflow states.
- Loading labels and duplicate-click protection are represented by a small testable UI policy/state boundary.
- Payroll workflow tests and TypeScript typechecking still pass.
