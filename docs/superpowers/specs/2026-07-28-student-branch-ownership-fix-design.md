# Student Branch Ownership Fix Design

## Context and root cause

Authenticated student-management requests already resolve the selected admin branch from `x-branch-id`, and student creation already passes that value as `branchId`. The visibility failure comes from ownership: manual creation keeps `ownerId` as the global admin user ID, and bulk import falls back to the creator ID. Branch-scoped reads construct an allowed owner set from users assigned to the selected branch, so a global admin-owned student is immediately excluded even though its `branchId` is correct.

## Goals

- A student created or imported while branch A is active is stored with `branchId = A`.
- The stored `ownerId` is an owner that belongs to branch A, with the branch ID as the deterministic fallback when no branch user exists.
- The student is visible from branch A immediately after creation and invisible from branch B.
- List, detail, update, delete, bulk delete, and payment operations cannot cross branch boundaries through an owner-ID mismatch.
- Existing superadmin and public-registration behavior remains supported.

## Ownership resolution

For authenticated admin and manager writes, `StudentController` resolves the create owner using the existing `resolveCreateOwnerId(user)` helper. That helper first selects the primary admin, manager, or user assigned to the selected branch and falls back to the selected branch ID. Manual creation and bulk import use the same resolved owner.

Normal users continue to own their own records. Superadmins continue to resolve an owner from the explicitly selected company; when a branch is available, owner resolution remains branch-aware.

## Query isolation

Owner scope remains for compatibility with existing data and role visibility, but it is no longer the only isolation boundary. Every authenticated student operation receives the selected `branchId` and adds it to its database query:

- list and count;
- detail lookup;
- update and delete;
- bulk delete;
- installment/payment mutations that start from a student lookup.

This prevents a shared or stale owner ID from exposing records from another branch. Admin and manager requests without a selected branch continue to be rejected before write operations. Reads without a branch do not silently broaden scope for ordinary tenant users.

## Create and import flow

Manual creation:

1. Main authentication validates `x-branch-id` against the admin company.
2. Student authentication copies the resolved branch into `req.user.branchId`.
3. Controller resolves a branch-local owner.
4. Service saves both the resolved `ownerId` and selected `branchId`.
5. A subsequent branch-scoped list returns the new record.

Bulk import follows the same owner and branch resolution rather than using the global creator ID.

## Existing malformed records

This change prevents new invisible records. It does not automatically migrate previously created records because assigning historical records to a branch without authoritative metadata could place them in the wrong branch. A separate audited migration can be added if historical recovery is required.

## Error handling

- Missing branch for tenant admin/manager operations returns a clear 400 response.
- Invalid or foreign branch headers remain rejected by the main authentication middleware.
- A record outside the selected branch behaves as not found for detail, update, and delete operations.

## Testing

Automated regression tests must prove:

- manual admin creation resolves a branch-local owner and persists the selected branch;
- bulk import uses the same branch-local owner;
- branch A list includes the new student;
- branch B list excludes it even if owner IDs overlap;
- detail, update, delete, bulk delete, and installment mutations reject cross-branch records;
- existing superadmin and public-registration tests remain green;
- TypeScript typecheck and production build pass.
