# Batch Instructor Dropdown — Branch User Visibility Design

**Date:** 2026-07-29

## Goal

When opening or editing a class, show every active user account in the selected branch in the instructor/person-in-charge dropdown, regardless of the account role. Keep assignment isolated to the selected branch.

## User experience

- The dropdown lists every active account whose `companyCode` matches the current tenant and whose `branchId` matches the authenticated/selected branch.
- Each option displays `displayName (role label)` and stores the account id as `instructorId`.
- Inactive or locked accounts are not offered for new assignments.
- The empty “not assigned” option remains available when the configured field is optional.
- Admin and superadmin must have an explicit active branch before the branch roster is loaded.

## Data flow

1. The batch page reads the active branch from `BranchContext`.
2. It requests `/api/v1/auth/users` with the selected company and branch.
3. The auth users endpoint validates that the requested branch belongs to the company and returns only that branch's active accounts.
4. The frontend does not filter by role; it formats the returned role for display.
5. Batch create/update sends the selected id as `instructorId`.
6. The batch service validates the assignee is active, belongs to the actor's company, and belongs to the actor's authenticated branch before saving.

## Authorization rules

- `admin`: may choose any active account in the branch currently selected in the UI.
- `manager`, `branch_owner`, `user`: may choose any active account in their assigned branch.
- `superadmin`: must supply a valid company and branch context; the target must belong to both.
- A forged request that targets another branch, company, inactive account, or nonexistent account is rejected.

## Compatibility

Existing batches keep their current `instructorId` and enriched instructor name. The change applies to the available choices for new assignments or reassignment; it does not migrate historical data.

## Testing

- Frontend pure test: all active branch users are retained regardless of role and labels include the role.
- Auth/controller test: requested branch scope is applied and inactive users are excluded.
- Batch service test: same-branch active accounts of multiple roles are accepted; cross-branch and inactive accounts are rejected.
- Run focused tests, TypeScript typecheck, and production builds.