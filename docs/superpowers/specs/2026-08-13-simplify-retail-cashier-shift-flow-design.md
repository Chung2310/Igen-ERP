# Simplified Retail Cashier Shift Flow Design

## Goal

Simplify cashier shifts to record the cash amount at opening and the actual cash amount at closing. New shifts will not support manual cash-in or cash-out movements and will not require manager approval after closing.

## New lifecycle

The active lifecycle becomes:

`open -> closed`

- A cashier opens a shift with a positive opening cash amount.
- Sales, payments, debts, and refunds continue to be linked to the open shift automatically through retail orders.
- The cashier closes the shift by submitting the actual counted cash and, when required, a variance reason.
- A successfully closed shift is complete. No manager approval or reconciliation action follows.

The `reconciled` status remains readable for historical records but is not produced by the new flow.

## Cash calculation

For new shifts, expected cash is:

`opening cash + cash collected from orders - cash refunded from orders`

Manual cash movements are not part of the new calculation because the feature that creates them will be removed.

Historical shifts may already contain `cashMovements`. When recalculating or closing such a legacy shift, the service will continue including those stored movements so historical financial results are not changed:

`opening cash + cash collected + legacy cash in - legacy cash out - cash refunded`

Variance remains:

`counted cash - expected cash`

The configured variance threshold and mandatory variance-reason rule remain unchanged.

## Backend changes

- Remove the `POST /retail/shifts/:id/cash-movements` route.
- Remove the cash-movement controller action and service mutation method.
- Remove the `POST /retail/shifts/:id/approve` route.
- Remove the approval controller action and service mutation method.
- New shifts will no longer explicitly initialize `cashMovements`; the legacy schema default remains for compatibility.
- Keep `cashMovements`, approval fields, and `reconciled` in the persistence schema and TypeScript interfaces so old records remain readable without a migration.
- Keep manager visibility of completed shift financial information; only the approval mutation is removed.

Requests to removed endpoints will follow the application's normal route-not-found behavior and cannot mutate shift data.

## Frontend changes

- Remove the `Thu/rút tiền trong ca` section, its local state, icons, and action handler.
- Remove the `Ca chờ duyệt` section and approval handler.
- Remove the `movement` and `approve` methods from the frontend shift API client.
- Keep opening cash and counted cash as Vietnamese-formatted currency inputs.
- Stop loading shift history on the cashier-shift page because it was used only by the approval queue. Existing report and history endpoints remain available to their other consumers.
- Update the page description so it describes only opening, blind counting, and closing.

## Compatibility and migration

No database migration will run. Existing fields and historical values remain intact. Existing `reconciled` shifts continue to display in history and reports. Existing open shifts that already contain movements retain those movements in their final expected-cash calculation, but no additional movement can be created after deployment.

## Testing

- Route tests prove the cash-movement and approval mutation routes are no longer mounted.
- Service tests prove new opening payloads do not explicitly write `cashMovements` and the expected-cash helper still supports stored legacy movements.
- Page tests prove the movement and approval interfaces are absent while opening and closing currency inputs remain available.
- Run all retail backend tests, all retail frontend tests, TypeScript typecheck, and `git diff --check`.

## Out of scope

- Migrating or deleting historical shift data.
- Removing manager access to shift history or financial reports.
- Changing employee work-schedule restrictions.
- Changing the variance threshold or variance-reason policy.
