# Task 2 report: Custom field configuration service

## Status

DONE

## Files

- Added `server/modules/student-management/services/custom-field.service.ts`
- Added `server/modules/student-management/services/custom-field.service.test.ts`
- Did not modify Task 1 implementation files.
- Did not stage, commit, or alter unrelated dirty files.

## Implementation

- Provides the required `CustomFieldService` API with injectable dependencies for database-free tests.
- Uses a fixed six-module registry (`students`, `courses`, `batches`, `exams`, `resources`, `partners`) for stored-value lookups.
- Generates Vietnamese-label camelCase ASCII keys, applies collision suffixes, obtains the next order from all fields, and maps Mongo duplicate-key errors to Vietnamese domain errors.
- Enforces visibility/required, archive/restore, type-change, option-validation, tenant-scoping, and stored-value semantics required by the brief.

## Red/green evidence

- RED: `npx.cmd tsx --test server/modules/student-management/services/custom-field.service.test.ts` failed before implementation with `ERR_MODULE_NOT_FOUND` for `custom-field.service`.
- GREEN: the same command passed after implementation: 10 tests, 10 pass, 0 fail.
- Original focused suite: 10 tests, 10 pass, 0 fail (duration 1956.2752 ms).

## Typecheck

- `npm.cmd run typecheck` exited 0 with `tsc --noEmit`.

## Self-review

- Confirmed no hard-delete path exists.
- Confirmed update, archive, and restore filters include the caller tenant.
- Confirmed stored-value query includes `$exists`, excludes null/empty string/empty array, and retains `false` and `0`.
- Confirmed the database unique index remains final collision enforcement and error code 11000 is translated.
- `git diff --check` reported no whitespace errors (only pre-existing CRLF warnings on unrelated documentation).

## Concerns

- None for Task 2 scope. The service queries `customFields.<key>` as required; persistence of that object on individual module entity schemas is intentionally outside this service task.

## Task 4 security review follow-up

- Added `constructor`, `prototype`, and `__proto__` to the field-name reserved-key set so definitions cannot create prototype-related storage paths.
- Added a regression test covering all three labels.
- Focused command: `npx.cmd tsx --test server/modules/student-management/services/custom-field.service.test.ts` — 11 tests, 11 pass, 0 fail, exit 0.
