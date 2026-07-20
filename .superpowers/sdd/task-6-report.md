# Task 6 report: frontend custom-field API, state and role capability

## Delivered

- Added shared frontend contracts for the six module keys, all 18 dynamic field types, field/value/file metadata, field validation including canonical `maxSizeMb`, and create/update inputs.
- Added `apiFetch` client wrappers under `/student-management/custom-fields` for list, create, update, archive, and restore.
- Added `useCustomFields(moduleKey)` with ordered local state, readable error state, stale request protection, mutation rejection propagation, window-event peer refresh, and self-event suppression.
- Added `canManageCustomFields(role)` granting only `superadmin`, `admin`, and `manager`.
- Added focused API/hook/role tests. The hook tests use a local React harness because this repository does not include the `@testing-library/dom` package required by `@testing-library/react`.

## TDD evidence

The initial focused run was red because `permissions`, `types`, `api`, and `useCustomFields` did not yet exist. After implementation, the focused suite passed.

## Verification

```text
npx.cmd vitest run src/modules/student-management/custom-fields
Test Files  2 passed (2)
Tests  10 passed (10)

npm.cmd run typecheck
Exit code 0
```

## Concerns

- No UI renderer or form integration was added; that is intentionally outside Task 6 scope.
- No files were staged or committed.

## Follow-up review fixes

- Replaced boolean self-event suppression with a stable hook-instance `sourceId`. Events now use `{ moduleKey, sourceId }`; listeners ignore only their own source ID and continue to refresh peer instances.
- Mutation completion is scoped to its initiating module and lifecycle. It increments the shared request version before calling the API, which invalidates older refreshes; it applies local state, error state, and event dispatch only while that module remains active and the hook is mounted.
- Added the branded `MaxSizeMb` contract and `createMaxSizeMb` checked constructor. Runtime API validation rejects file limits outside 1..100 before `apiFetch` is called.
- Added regression coverage for source identity, unmount/module-switch delayed mutations, refresh-vs-mutation ordering, peer events after a module switch, and file-limit boundaries.

### Follow-up verification

```text
npx.cmd vitest run src/modules/student-management/custom-fields
Test Files  2 passed (2)
Tests  18 passed (18)

npm.cmd run typecheck
Exit code 0
```

## Final race fix

- A successful in-scope mutation now advances `requestVersion` immediately before applying its local state and broadcasting its change. This invalidates refreshes that began while the mutation was pending, while a refresh that begins after mutation completion receives a newer version and applies normally.
- Added explicit regressions for both orderings.

### Final verification

```text
npx.cmd vitest run src/modules/student-management/custom-fields
Test Files  2 passed (2)
Tests  20 passed (20)

npm.cmd run typecheck
Exit code 0
```

## Loading lifecycle fix

- Refreshes now maintain an in-flight count per module. Each refresh increments before the request and decrements in `finally`, even when its data/error result is stale.
- Version checks still protect fields and errors. The visible `loading` state is only updated for the mounted current module and turns false only when that module has no remaining refreshes.
- Added races covering stale refresh settlement after mutation invalidation and two overlapping refreshes, ensuring the first completion cannot clear loading while the second is pending.

### Loading verification

```text
npx.cmd vitest run src/modules/student-management/custom-fields
Test Files  2 passed (2)
Tests  21 passed (21)

npm.cmd run typecheck
Exit code 0
```
