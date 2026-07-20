# Task 3 report: Custom field API and role guard

## Status

DONE

## Files

- Added `server/modules/student-management/validations/custom-field.validation.ts`.
- Added `server/modules/student-management/controllers/custom-field.controller.ts`.
- Added `server/modules/student-management/routes/custom-field.routes.ts`.
- Added `server/modules/student-management/routes/custom-field.routes.test.ts`.
- Mounted the route at `/custom-fields` in `server/modules/student-management/router.ts` (under the existing `/api/v1` API router).
- Did not stage, commit, or modify unrelated dirty files.

## Implementation

- Authenticates all endpoints; only `superadmin`, `admin`, and `manager` can create, update, archive, or restore. All authenticated roles may list.
- Validates the six exact module keys, 24-character Mongo ObjectIds, strict body keys, protected server-owned fields, select options, all Task 1 field types, and bounded type-specific validation keys. Prototype-polluting validation keys and unsafe regular-expression constructs are rejected.
- Publishes `maxSizeMb` as the single file-size configuration key, bounded from 1 through 100 MB; the former `maxFileSize` key is rejected as unknown.
- Derives tenant and actor exclusively from the authenticated user. `includeArchived=true` is honored only for managing roles.
- Uses Task 2 service methods and returns the required success envelopes, including 201 on create and 400/404/409 mappings for expected domain errors; unexpected errors go to `next`.

## Red/green evidence

- RED: `npx.cmd tsx --test server/modules/student-management/routes/custom-field.routes.test.ts` failed before implementation with `ERR_MODULE_NOT_FOUND` for `custom-field.controller`.
- GREEN: final focused command passed: 11 tests, 11 pass, 0 fail (duration 3859.4212 ms). Tests execute middleware, validation, route-stack, and controller handlers without Mongo.

## Typecheck

- `npm.cmd run typecheck` exited 0 with `tsc --noEmit`.

## Task 4 security review follow-up

- Added a shared conservative pattern-safety validator to reject nested quantified groups, quantified alternations, backreferences, lookarounds, unbalanced patterns, and patterns longer than 500 characters before definitions are accepted.
- Canonicalized file configuration from `maxFileSize` to bounded `maxSizeMb` across create/update definition validation and all 18-type API coverage.
- Focused command: `npx.cmd tsx --test server/modules/student-management/routes/custom-field.routes.test.ts` — 14 tests, 14 pass, 0 fail, exit 0.

## Concerns

- The parent `studentManagementRouter` imports unrelated route modules with standalone-process side effects, so the focused test verifies its mount path from the router source. The four invalid-input cases run through a real Express app with the actual custom-field router, authentication, validation middleware, and scoped error handler.

## Review fixes

- Added the existing student-management `errorMiddleware` after the custom-field route declarations, scoped to this router. Joi errors now produce the established `{ success: false, error }` JSON response with HTTP 400 instead of Express's default 500/HTML response.
- Changed the parent mount to `/student-management/custom-fields`, yielding the documented `/api/v1/student-management/custom-fields` endpoint because the API router mounts `studentManagementRouter` at `/api/v1`.
- Added route-stack regression coverage for invalid module, ObjectId, body, and query payloads, plus an assertion for the exact parent mount path.

## Review verification

- RED: focused test reproduced the defects: an invalid module returned HTTP 500 before the scoped error middleware, and the parent router source still mounted `/custom-fields`.
- GREEN: `npx.cmd tsx --test server/modules/student-management/routes/custom-field.routes.test.ts` passed: 13 tests, 13 pass, 0 fail (duration 3474.7788 ms).
- `npm.cmd run typecheck` exited 0 with `tsc --noEmit`.
