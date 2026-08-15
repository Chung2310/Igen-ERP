# Project-wide Permission Registry Refactor Design

## Context

Permission definitions are currently split between backend constants, a legacy mapping table, seeded database rows, route middleware, frontend fallbacks, and role-editor presentation code. This permits contradictory states: the UI can display codes that storage normalization removes, `manage` can hide its implied `read` state, and permission metadata loses its group when persisted.

This refactor replaces the existing permission vocabulary with one centrally declared registry. It is an intentional clean reset: existing role and user permission assignments are not migrated and legacy aliases are not retained.

## Decisions

- Permission actions are exactly `read` and `manage`.
- Permission codes use `<feature>:read` and `<feature>:manage`.
- `manage` always implies `read` for the same feature.
- Granularity is hybrid: ordinary domains use one feature pair; financially or operationally sensitive capabilities use dedicated feature pairs.
- The registry is the only source for authorization codes and role-editor metadata.
- Existing permission assignments are cleared during the controlled rollout and administrators reconfigure roles from the new catalog.
- Superadmin retains wildcard `*`; no other role or user may store wildcard access.
- No `LEGACY_PERMISSION_MAP`, runtime alias, or transitional compatibility path remains after rollout.

## Target Registry

### General domains

- `dashboard`
- `people`
- `relationship`
- `hr`
- `timekeeping`
- `work`
- `inventory`
- `retail`
- `resource`
- `chat`
- `recruitment`
- `settings`
- `access`

### Sensitive domains

- `payroll-period`
- `payroll-policy`
- `payroll-payment`
- `finance-wallet`
- `finance-receivable`
- `labor-partner`
- `labor-partner-policy`
- `labor-partner-settlement`
- `labor-partner-payout`

Every listed feature produces exactly two codes. Action-specific codes such as `approve`, `calculate`, `collect`, `adjust`, `operate`, `pay`, and `prepare` are removed. A mutation for one of those actions requires that feature's `manage` permission.

## Registry Structure

The backend owns a typed registry entry for each feature:

```ts
type PermissionFeatureDefinition = {
  feature: string;
  label: string;
  group: string;
  description: { read: string; manage: string };
};
```

Generated helpers expose:

- The complete permission catalog with code, action, label, group, and description.
- A `PermissionCode` type.
- The set of valid stored codes.
- `isPermissionCode(value)`.
- `effectivePermissions(codes)`, which adds the matching `read` code for each `manage` code.
- `compactStoredPermissions(codes)`, which validates all inputs and removes redundant `read` values when the same feature has `manage`.

Invalid codes cause a validation error. They are never dropped silently.

The frontend receives the registry through the permission-catalog API and must not maintain a separate authorization catalog or fallback map.

## Route Authorization Rules

- Read-only business endpoints use `<feature>:read`.
- Mutation endpoints use `<feature>:manage`.
- A `manage` holder passes a `read` guard through effective-permission expansion.
- Authentication-only self-service endpoints stay outside management authorization when their controller already scopes the operation to the authenticated user. Check-in/check-out are examples.
- Public endpoints remain public and must be explicitly allowlisted in the route inventory.
- Superadmin-only platform operations retain their role/platform guard in addition to any catalog permission used by shared middleware.

Sensitive route mapping follows the feature boundary:

- Payroll run lifecycle and results: `payroll-period`.
- Payroll calculation policy/formula configuration: `payroll-policy`.
- Payments, publication, and payment-sensitive exports: `payroll-payment`.
- Wallet operations: `finance-wallet`.
- Receivables, reminders, collection, and adjustment: `finance-receivable`.
- Labor-partner records and referrals: `labor-partner`.
- Commission policy configuration: `labor-partner-policy`.
- Settlement calculation/review/approval: `labor-partner-settlement`.
- Commission payout recording: `labor-partner-payout`.

## Authorization Runtime

`getEffectivePermissions` combines explicit user assignments and role assignments, validates them against the registry, and expands `manage` into `read`. It does not map old codes.

`requirePermission` accepts only typed/validated registry codes. Array input remains OR semantics. Modules should export constants derived from the central registry rather than handwritten string aliases.

Default system-role permissions are rewritten exclusively with new codes. Superadmin returns `Set(["*"])`. Administrator defaults may remain broad, but stored role configuration overrides defaults according to the existing role-assignment semantics.

## Database and Reset

The Permission schema adds required `group` and optional `action` metadata. Catalog seeding uses `$set` with `upsert: true`, so existing labels, descriptions, modules, groups, and actions are refreshed.

Rollout runs an idempotent, versioned reset operation:

1. Record a permission-registry version in a migration-state collection or equivalent existing migration mechanism.
2. Delete Permission rows not present in the new registry.
3. Upsert every registry row with current metadata.
4. Clear stored permission arrays from all non-superadmin `RolePermission` documents.
5. Clear custom permission arrays from all non-superadmin users.
6. Preserve superadmin wildcard behavior without storing wildcard in the Permission collection.
7. Mark the reset version complete so restarts do not repeatedly erase newly configured roles.

The reset logs counts only. It must not log user identities or complete role documents.

Because the user approved a clean reset, no old permission is translated. Deployment communication must state that administrators need to configure role permissions again.

## Role-management API

Create/update validates the entire payload before writing. The response contains:

```ts
{
  stored: string[];
  effective: string[];
}
```

`stored` is compact: `feature:manage` replaces the redundant matching `feature:read`. `effective` contains both. Invalid or unknown codes produce a 400 response listing rejected codes; a success response never hides a dropped code.

Company scope is resolved once in the controller and passed explicitly to the service. Missing company scope returns a stable 400 error. Hierarchy validation is enforced server-side: company admins cannot create or modify roles at superadmin level, regardless of UI behavior.

## Role Editor

The role modal groups permissions using server-provided `group` metadata. For each feature it renders `read` and `manage` together.

When `manage` is selected:

- `read` appears selected because it is effective.
- The `read` checkbox is disabled.
- Supporting text states that read access is included in management access.
- The payload contains only `manage` for that feature.

When `manage` is removed, the user may independently retain or remove `read`. The success toast reflects the stored result returned by the API. Validation errors identify unsupported codes and do not show a success message.

## Navigation and Component Guards

Navigation, route configuration, buttons, tabs, and feature panels use the same new codes. Local permission fallback tables are removed. UI guards improve discoverability but are not security boundaries; every protected API retains the corresponding backend guard.

Sensitive actions use the relevant `manage` code. Read-only tabs and data queries use `read`. Components should consume a shared frontend helper that expands `manage` to `read`, matching backend semantics.

## Static Enforcement and CI

The existing permission route inventory is expanded to enforce:

- Every permission literal and exported permission constant resolves to a registry code.
- No action suffix other than `read` or `manage` appears in authorization code.
- Protected GET/HEAD routes have an appropriate read or manage guard.
- Protected POST/PUT/PATCH/DELETE routes have a manage guard.
- Public and authentication-only self-service routes are explicitly classified.
- Every backend registry entry is returned by the catalog API and seedable into the Permission model.
- No frontend-local catalog or legacy fallback map exists.

CI also compares backend and frontend effective-permission behavior using shared contract fixtures.

## Delivery Phases

### Phase 1: Registry foundation

Create the typed registry, validation/compaction/effective helpers, schema metadata, catalog API, and static inventory rules. Existing routes are not switched until the registry tests cover all target features.

### Phase 2: Backend route conversion

Convert routes feature by feature, beginning with access/settings and general domains, followed by payroll, finance, retail, and labor-partner sensitive domains. Each batch updates constants and route tests together.

### Phase 3: Frontend conversion

Update AuthContext permission expansion, route configuration, navigation, component guards, role presentation, and RoleModal. Delete local legacy/fallback maps only after all frontend references use registry codes.

### Phase 4: Database reset and rollout

Add the versioned reset, rewrite default roles, update seeds, and deploy with administrator communication. The reset is enabled only when all route/UI inventory checks pass.

### Phase 5: Cleanup and enforcement

Delete legacy mapping code and obsolete tests, enable CI failures for unknown permission strings, and verify no old action-specific permission remains in production source.

## Testing

- Registry generation produces exactly two unique codes per feature.
- `manage` compacts storage and expands to `read` without changing other features.
- Unknown codes fail validation and are reported.
- Permission seeding updates existing metadata, including group.
- The reset is idempotent and runs once per registry version.
- Non-superadmin role/user assignments are cleared; superadmin remains functional.
- Every protected route passes the inventory rules.
- Each sensitive module has behavior tests proving read-only users cannot mutate and managers can read and mutate.
- Role API returns stored/effective arrays and enforces company/hierarchy rules.
- RoleModal displays groups, implied read state, disabled read checkbox, and server validation errors correctly.
- Navigation and API permissions agree for every target feature.
- Typecheck, backend tests, frontend tests, and production build pass before rollout.

## Rollout Risks

- The clean reset temporarily removes configured access until administrators reassign roles. Mitigation: communicate the deployment window and prepare documented role templates.
- Missing route conversion could deny access or leave an endpoint under-protected. Mitigation: route inventory must be green before enabling reset.
- Frontend/backend mismatch could hide available features. Mitigation: catalog API and shared contract fixtures replace duplicated lists.
- Broad administrator defaults could undermine sensitive feature separation. Mitigation: explicitly review and test every default role template before rollout.

## Acceptance Criteria

- Production authorization source contains only wildcard `*` for superadmin and registered `:read`/`:manage` codes.
- Every registry feature exposes exactly one read and one manage permission.
- No legacy alias or action-specific authorization suffix remains.
- Role saves never silently discard a code.
- `manage` is consistently effective as `read` in backend and frontend.
- The role editor displays meaningful groups from persisted catalog metadata.
- All protected routes are covered by automated permission inventory checks.
- The versioned clean reset completes once and role permissions can be safely reconfigured afterward.
