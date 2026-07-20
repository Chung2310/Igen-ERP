# Task 9 brief: Courses, batches and exams UI integration

Integrate shared custom fields into the three main create/edit/detail flows: Thêm khóa học mới (`courses`), Mở lớp mới (`batches`), Tạo đợt thi (`exams`). No action subforms and no commit.

Files: `pages/Courses/CoursesPage.tsx`, `pages/Batches/BatchesPage.tsx`, `components/Exams/AddExamModal.tsx`, `pages/Exams/ExamsPage.tsx`, relevant frontend types, one focused test.

For each module: initialize/hydrate `customFields`, render `CustomFieldsSection` before form actions, send customFields on create/update, retain dirty values/server errors, and render `CustomFieldDetails` in existing detail view if one exists. Do not invent a new detail modal solely for this feature. Definition creation must not reset fixed inputs. Shared permission handles button visibility. Preserve existing fixed-field validation/normalization.

Test each module key, create payload, edit hydrate where edit exists, dirty preservation and detail where existing. Run focused new test + `npm.cmd run typecheck`. Write task9 report; no commit.
