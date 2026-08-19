# Task 1 Report: Extract a shared email-template variable model and codec

Status: DONE

## Scope implemented

- Created shared template-editor variable type at `src/components/template-editor/templateEditorTypes.ts`
- Created shared template token codec at `src/components/template-editor/templateTokenCodec.ts`
- Updated `src/modules/marketing/components/marketingVariableRegistry.ts` to include the shared `key` field while preserving the existing marketing registry export and `getVariablesForType(...)` behavior
- Updated `src/modules/marketing/components/marketingTemplateTokenCodec.ts` to keep marketing-facing wrapper exports working while delegating to the shared codec
- Updated `src/modules/marketing/components/TemplateEditor.tsx` preview sample filling to use the shared codec helper
- Updated `src/modules/marketing/components/TemplateEditor.test.tsx` to cover both the shared codec signatures and the existing marketing wrapper behavior

## Constraints check

- Kept backend token format exactly as `{{key}}`
- Did not migrate any stored HR celebration templates
- Did not touch `companyEmailApi.saveCelebration`, `companyEmailApi.preview`, or `companyEmailApi.history`
- Did not touch HR image upload through `authService.uploadManagedFile(..., "hr.celebration")`
- Preserved marketing wrapper exports to avoid regressions in the existing Marketing token editor

## TDD evidence

### Red

Added the new shared-codec assertions first in `src/modules/marketing/components/TemplateEditor.test.tsx`, importing the future shared module directly.

Command:

`.\node_modules\.bin\vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Observed failure:

- Vitest failed to resolve `src/components/template-editor/templateTokenCodec.ts`
- Error: `Does the file exist?`

### Green

Implemented the shared type and codec, then rewired the marketing wrappers to delegate to them.

Command:

`.\node_modules\.bin\vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Observed pass:

- `Test Files  1 passed (1)`
- `Tests  14 passed (14)`

## Focused verification run

Command:

`.\node_modules\.bin\vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Result:

- Passed after the final code state with `14/14` tests green

## Commit

Created after staging:

- `refactor(template-editor): extract shared variable token codec`

## Concerns

- None for Task 1 scope

---

## Review follow-up: injected per-type variable list coverage

- Updated `src/modules/marketing/components/TemplateEditor.test.tsx` so the shared codec coverage now builds its injected variable list from `getVariablesForType("birthday")` instead of `Object.values(MARKETING_VARIABLE_REGISTRY)`.
- Added an assertion proving a birthday-scoped injected list leaves `{{orderCode}}` untouched, directly verifying the per-type filtering requirement from the task brief.

### Focused verification

Command:

`.\node_modules\.bin\vitest.cmd run src/modules/marketing/components/TemplateEditor.test.tsx --maxWorkers=1`

Result:

- Initial sandboxed run was blocked by `esbuild` `spawn EPERM`
- Re-ran the same focused command with approval outside the sandbox
- `Test Files  1 passed (1)`
- `Tests  14 passed (14)`
