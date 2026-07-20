# Task 7 brief: Reusable custom-field editor, renderer and details UI

## Scope

Build reusable UI components. Do not integrate into entity forms yet. Use current project styling/components and existing upload API. No commits/new packages.

## Files

- Create `src/modules/student-management/custom-fields/CustomFieldEditorModal.tsx`
- Create `src/modules/student-management/custom-fields/CustomFieldRenderer.tsx`
- Create `src/modules/student-management/custom-fields/CustomFieldsSection.tsx`
- Create `src/modules/student-management/custom-fields/CustomFieldDetails.tsx`
- Create focused component tests in same folder.

## Required UI

`CustomFieldsSection` controlled props:

```ts
{ moduleKey; values; onChange; errors?; mode:"create"|"edit"; disabled? }
```

It loads fields with Task6 hook, renders active visible fields ordered, preserves parent values, and shows `+ Thêm trường` plus per-field edit/archive controls only when `canManageCustomFields(userProfile.role)`. Creating a field must not reset parent values. Show load errors with retry without hiding fixed form content.

Editor supports label, all 18 types, placeholder, default, visible, required, select options, validation bounds and file/image settings including `maxSizeMb` 1..100, allowed MIME types, maxFiles. Hidden forces required off. Validate select options unique/nonempty, label nonempty, numeric ranges and safe pattern using same conservative frontend policy (maximum one quantifier). Submit errors stay in modal; preserve form on failure. Confirm archive and support restore where archived list is available; no hard delete.

Renderer is controlled and accessible. Map all 18 types. File/image uploads use `FormData` to existing `/student-management/upload`, validate MIME/size/count before request, keep current value and show inline retryable error on failure. Store only returned metadata. Dates/times use native controls consistent with existing form styles. Required marker and field-specific error/aria attributes.

Details renders label/value safely: formatted numbers/currency/date, links with safe protocol/rel, booleans Vietnamese, selections by option label, images/files as safe links/thumbnails. Hidden/archived definitions do not render; empty visible value displays `Chưa cập nhật`.

## Tests

Use React DOM harness available in repo. Cover user vs manager controls, all type render branches, controlled value changes, parent value preservation after create, hidden/archive, editor validation/failed submit preservation, maxSizeMb bounds, upload precheck/success/failure/retry, safe details links, accessibility labels/errors, restore/archive. Mock Task6 hook, auth and apiFetch.

Run:

```powershell
npx.cmd vitest run src/modules/student-management/custom-fields
npm.cmd run typecheck
```

Write `.superpowers/sdd/task-7-report.md`; no stage/commit.
