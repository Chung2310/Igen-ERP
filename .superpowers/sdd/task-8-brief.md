# Task 8 brief: Student form integration

Integrate shared custom-field UI into admin Add Student, Edit Student and Profile details only. Public registration remains exempt/out of scope. No commits.

Files: `src/modules/student-management/types.ts`, `components/Student/AddStudentModal.tsx`, `EditStudentModal.tsx`, `DetailTabs/ProfileTab.tsx`, plus focused test.

Requirements:
- Student type includes `customFields?: CustomFieldValues`.
- Add state initializes `{}` and preserves values on reset/failed create as current behavior dictates; payload sends customFields.
- Edit hydrates `student.customFields ?? {}` and sends patch. Display server validation/conflict messages without closing or losing form data.
- Render `<CustomFieldsSection moduleKey="students" ...>` near end of main form before actions in both Add/Edit. Button visible via shared role logic.
- Profile renders `<CustomFieldDetails moduleKey="students" values={student.customFields ?? {}} />`.
- Client required errors may guide user, but server remains authority. Existing fixed requiredFieldsConfig behavior remains unchanged.
- Creating a definition while modal is dirty must not reset fixed/dynamic values.

Tests: manager sees + Thêm trường, user does not; add payload; edit hydrate/payload; profile details; dirty preservation; required server error preserves modal; public registration untouched.

Run `npx.cmd vitest run src/modules/student-management/components/Student/StudentCustomFields.test.tsx` then `npm.cmd run typecheck`. Write `.superpowers/sdd/task-8-report.md`; no stage/commit.
