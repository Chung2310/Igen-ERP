# Inventory Branch Loading Performance Design

## Problem

The inventory page subscribes to categories, products, and stock logs only when the authenticated user changes. Switching the active branch does not recreate those subscriptions, so the page can display the previous branch until the five-second polling interval runs. Selecting a branch also emits `branch-change`, which makes `BranchContext` reload the full branch list even though only the selected ID changed.

## Approved design

- Treat `activeBranchId` as an input to the inventory data lifecycle.
- When it changes, immediately cancel all requests and timers for the previous branch and start one fresh request for each inventory collection.
- Pass the selected branch explicitly through `x-branch-id` for inventory reads so an in-flight render cannot read a later local-storage value.
- Use `AbortController` in each subscription so a slow response from the previous branch cannot overwrite the new branch's data.
- Do not emit `branch-change` when the user only selects another existing branch. Keep the event for branch-management mutations that genuinely require reloading the branch list.
- Preserve the existing five-second background refresh behavior.

## Error and loading behavior

Inventory requests start only after authentication and an active branch are available. A branch switch sets all three inventory sections back to loading until their new branch request completes. Aborted requests are ignored and do not show error toasts.

## Verification

Automated tests cover explicit branch headers, immediate subscription replacement, timer cleanup, and abort cleanup. Existing typecheck and production build must continue to pass.
