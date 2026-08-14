# Remove Retail Debt Reminder UI

## Goal

Make Finance the only user-facing place for debt-reminder operations. Retail must no longer expose a debt-reminder tab, manual reminder action, run history, retry action, or navigation slug.

## Scope

- Remove the `Nhắc công nợ` tab from `RetailWorkspace`, including lazy imports and rendering branches.
- Remove `nhac-cong-no` from Retail tab types and permission resolution.
- Remove the `Nhắc công nợ` action and its request/loading/result state from Retail Reports.
- Remove frontend-only Retail reminder page/API modules and their obsolete tests when no references remain.
- Update Retail navigation and permission tests to prove the reminder entry is absent while all other Retail tabs remain available.
- Add a report-page regression test proving no debt-reminder action is rendered.

## Preserved Behavior

- Finance `Nhắc nợ` remains unchanged and is the sole UI for reminder runs, history, and retries.
- Retail backend reminder routes, jobs, services, models, and stored history remain intact for compatibility and safe migration.
- Retail order debt creation and Finance receivable synchronization remain unchanged.

## Error Handling and Compatibility

Existing deep links using `?sub=nhac-cong-no` fall back to the first allowed Retail tab. No redirect to Finance is added because cross-module access depends on Finance permissions and module enablement.

## Verification

- Retail tab permission tests contain no `nhac-cong-no` result.
- Retail workspace source/component tests contain no reminder tab.
- Retail reports test confirms no `Nhắc công nợ` button.
- Finance reminder tests continue to pass.
- Typecheck and targeted lint pass.
