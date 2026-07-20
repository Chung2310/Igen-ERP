# Task 4 report: Runtime custom-field value validation and six model envelopes

## Status

DONE

## Files

- Added `server/modules/student-management/services/custom-field-value.service.ts`.
- Added `server/modules/student-management/services/custom-field-value.service.test.ts`.
- Added `server/modules/student-management/utils/custom-field-pattern.util.ts` during the security review follow-up.
- Updated the student, course, batch, exam, resource, and partner interfaces with optional `CustomFieldValues` envelopes.
- Updated the same six Mongoose schemas with Mixed `customFields` storage defaulting to `{}`.
- Updated the same six create/update Joi schemas to accept only the `customFields` envelope while retaining existing top-level unknown-key rejection.
- Did not touch payments, notifications, entity write paths, or unrelated dirty files. Did not stage or commit.

## Implementation

- Exposes the required `validateCustomFieldValues({ tenantId, moduleKey, values, mode })` function and a `createCustomFieldValueValidator(repository)` factory for database-free dependency injection.
- Fetches definitions using the trusted `{ tenantId, moduleKey }` pair, rejects unknown and prototype-polluting keys, accepts only plain-object envelopes, and returns a fresh null-prototype result without mutating nested input metadata.
- Omits hidden/archived definitions and never requires them. Visible required fields are enforced against the supplied complete set in create and update modes; `0` and `false` remain present.
- Applies nonempty defaults only to absent create keys, then validates the default through the same runtime path.
- Normalizes and validates all 18 field types, including select membership/uniqueness, finite numbers and percent range, ISO-compatible date/time/date-time values, booleans, and file/image metadata.
- Enforces configured text, numeric, date/time, MIME type, file-size, and file-count constraints with Vietnamese errors containing the field label.
- Uses only the canonical positive, API-bounded `maxSizeMb` file-size constraint.

## Red/green evidence

- RED: `npx.cmd tsx --test server/modules/student-management/services/custom-field-value.service.test.ts` exited 1 with `ERR_MODULE_NOT_FOUND` for the not-yet-created `custom-field-value.service`.
- First GREEN attempt: 13/14 passed; one test fixture used `20.123` with `max: 20`, so the maximum rule correctly fired before the intended decimals assertion. The fixture was corrected to the in-range `15.123`; no production code changed for that failure.
- Final fresh focused run: 14 tests, 14 pass, 0 fail (duration 2883.204 ms), exit 0.

## Typecheck and diff audit

- `npm.cmd run typecheck` completed with `tsc --noEmit`, exit 0.
- `git diff --check` for the 18 tracked interface/model/Joi files exited 0. Git emitted only the repository's line-ending conversion warnings.
- Verified exactly six interface properties, six Mixed schema paths/defaults, and twelve create/update Joi envelope entries.

## P1 security review fixes

- Added a dependency-free conservative regular-expression safety scan at definition API acceptance and again at runtime. It rejects nested quantified groups (including `^(a+)+$`), quantified alternations, backreferences, lookarounds, malformed/unbalanced patterns, and patterns over 500 characters.
- Caps values subjected to a custom pattern at 4096 characters before constructing or evaluating native `RegExp`. The regression test replaces the global constructor with a sentinel and proves both the long catastrophic pattern and oversized safe-pattern input are rejected without reaching it.
- Rejects `constructor`, `prototype`, and `__proto__` both while generating Task 2 definition keys and defensively when runtime definitions are loaded, even if the client omitted those keys.
- Canonicalized file configuration to `maxSizeMb` bounded from 1 through 100 MB in Task 3 and removed the runtime/public `maxFileSize` path.

## Final review verification

- `npx.cmd tsx --test server/modules/student-management/services/custom-field.service.test.ts` — 11 tests, 11 pass, 0 fail, exit 0.
- `npx.cmd tsx --test server/modules/student-management/routes/custom-field.routes.test.ts` — 14 tests, 14 pass, 0 fail, exit 0.
- `npx.cmd tsx --test server/modules/student-management/services/custom-field-value.service.test.ts` — 16 tests, 16 pass, 0 fail, exit 0.
- `npm.cmd run typecheck` — `tsc --noEmit`, exit 0.

## Concerns

- The pattern validator is deliberately conservative and may reject some complex regular expressions that are safe in practice. This is an intentional tradeoff because custom patterns execute synchronously on the API server.
- The runtime lookup intentionally loads definitions for the tenant/module without filtering archived records in the repository query so archived incoming keys can be recognized and safely omitted, as required by this brief. Archived definitions are never validated or returned.

## Second P1 review wave

- RED: Task 4 focused tests showed wrapper depths 1–4 around an internally quantified group were classified as safe and reached the 4096-character fallback cap; Task 3 focused tests showed `maxSizeMb: 0.5` was accepted.
- Fixed the pattern scanner to propagate quantifier and alternation hazards from every closed child group into its parent. Patterns from `^((a+))+$` through four wrapper levels are now rejected before native `RegExp` construction; the 4096-character cap remains defense-in-depth.
- Changed both create and update definition validation to `Joi.number().min(1).max(100)`. Tests reject `0`, `0.5`, and `101`, and accept `1` and `100` in both schemas.

## Second review verification

- `npx.cmd tsx --test server/modules/student-management/services/custom-field.service.test.ts` — 11 tests, 11 pass, 0 fail, exit 0.
- `npx.cmd tsx --test server/modules/student-management/routes/custom-field.routes.test.ts` — 14 tests, 14 pass, 0 fail, exit 0.
- `npx.cmd tsx --test server/modules/student-management/services/custom-field-value.service.test.ts` — 16 tests, 16 pass, 0 fail, exit 0.
- `npm.cmd run typecheck` — `tsc --noEmit`, exit 0.

## Final regex hardening

- RED: the Task 4 focused suite showed `^a*a*a*a*a*a*b$` reached the native `RegExp` sentinel, while the safe one-quantifier pattern `^(?:ab)+$` was incorrectly rejected because the `?` in noncapturing-group syntax was counted as a quantifier.
- Added an expression-wide conservative budget of one quantifier token. The scanner counts `*`, `+`, `?`, and `{m,n}` outside escaped content and character classes, while explicitly skipping `(?:` group syntax. Existing nested-group/alternation checks and the 4096-character pre-evaluation cap remain active.
- The sentinel regression confirms the multi-quantifier pattern is rejected without constructing native `RegExp`; the safe one-quantifier noncapturing-group pattern is accepted and evaluated normally.

## Final hardening verification

- `npx.cmd tsx --test server/modules/student-management/services/custom-field-value.service.test.ts` — 18 tests, 18 pass, 0 fail, exit 0.
- `npm.cmd run typecheck` — `tsc --noEmit`, exit 0.
