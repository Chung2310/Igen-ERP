# Worker Add Modal UI Design

## Goal

Make the worker-management “Add worker” popup match the student-management “Add student” popup, including shared visual behavior and advanced field-management capabilities, without changing worker persistence APIs or business rules.

## Approach

Extract the reusable modal shell and field presentation into an `EntityAddModal` component. The student and worker modals remain responsible for their own data loading, validation, submit callbacks, and entity-specific fields, while the shared component owns:

- backdrop, enter/exit animation, sizing, scrolling, header, and footer;
- consistent labels, input/select/textarea styling, focus states, loading state, and error panel;
- rendering visible/required standard fields and custom fields;
- optional standard-field editing/archive/delete actions for users with permission.

## Worker behavior

`AddWorkerModal` will retain full name, phone, email, ID card, birthday, registration date, status, address, note, and project assignment. It will add custom-field values and use the existing worker field configuration to determine visibility and required validation. Existing duplicate checks and `onSubmit` payload shape remain unchanged except for the supported custom-field values.

## Student compatibility

`AddStudentModal` will use the shared presentation layer without changing its API calls, center/batch/referral/face-capture flows, or custom-field editor behavior. Entity-specific sections remain composable through the shared modal.

## Validation

Add/update component tests covering modal rendering, worker required-field validation, custom-field rendering/value submission, duplicate detection, and successful submit. Run the relevant Vitest tests and TypeScript/build checks available in the repository.

## Scope boundaries

No backend route changes, database migrations, unrelated styling refactors, or changes to worker/student business permissions are included.
