# Branch Data Isolation Design

## Goal

Ensure inventory products, inventory categories, stock logs, and student-management records created while an administrator is operating in a branch are assigned to that branch and cannot be read, updated, or deleted from another branch.

## Scope

- Inventory CRUD resources: `products`, `categories`, and `stock-logs`.
- Student-management tenant records created through the module's authenticated controllers and services.
- Server-side authorization and persistence only. The client may continue sending the existing `x-branch-id` selection header.
- Existing records without `branchId` are not migrated automatically. A separate, explicit migration is required because the correct historical branch cannot be inferred safely.

## Branch Selection Rule

- `requireAuth` remains the source of truth for the effective `branchId`.
- An administrator must have an effective branch selected before creating an in-scope record.
- The server ignores or overwrites any client-provided `companyCode` or `branchId` with the authenticated scope.
- Requests without an effective branch return a clear `400` response instead of creating company-global data.

## Inventory Architecture

The CRUD controller passes an authenticated scope containing `companyCode` and `branchId` into the CRUD service. The service applies that scope to create, get-by-id, update, and delete operations for the three inventory models. List operations continue using the existing branch filter but use the same server-owned scope semantics.

Inventory uniqueness is branch-local:

- Product SKU is unique within `{ companyCode, branchId }`.
- Category name and code are unique within `{ companyCode, branchId }`.
- Schema-level global or company-only unique indexes are replaced by compound branch indexes.

Other generic CRUD models retain their current behavior; branch enforcement is introduced only for the inventory model set to avoid an unrelated authorization change.

## Student-Management Architecture

The student-management auth adapter preserves the effective `branchId`. Create controllers pass a server-owned write scope to services, and persisted tenant records include `branchId` alongside their existing `ownerId` and tenant fields. Read, update, and delete queries include the effective branch scope in addition to the existing owner scope.

The branch rule applies consistently to the principal module entities: students, courses, batches, exams, resources, partners, assignments, notifications, payments, and their categories/settings where those records are tenant-owned. Records created by public or token-based flows inherit the branch from their owning parent record rather than accepting a branch from the caller.

## Error Handling

- Missing effective branch on an authenticated admin create request: HTTP `400` with a Vietnamese message requiring branch selection.
- Cross-branch record access: return the same not-found response used for inaccessible records, avoiding disclosure that an ID exists in another branch.
- Invalid client-supplied branch values never override the authenticated branch.

## Testing

- Unit tests verify construction and enforcement of authenticated `{ companyCode, branchId }` write/read scopes.
- Controller/service tests verify inventory creates persist `branchId` and cross-branch get/update/delete queries cannot match.
- Student-management tests verify creates persist the authenticated branch and owner lookup remains branch-scoped.
- Tests verify missing-branch admin creates are rejected.
- Existing focused suites and repository typecheck must pass before completion.

## Data Compatibility

Existing branchless records remain untouched and will not appear while a branch scope is active. A future migration must require an explicit mapping from record IDs (or another authoritative business key) to branch IDs; it must not assign historical data heuristically.
