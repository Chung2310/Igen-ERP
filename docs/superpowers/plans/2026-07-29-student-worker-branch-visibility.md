# Student/Worker Branch Visibility Implementation Plan

> Execute with `superpowers:executing-plans` and follow test-driven development for each behavior change.

**Goal:** Make the student/worker module consistently show the selected branch to admins while preserving fixed branch isolation for branch roles, and provide an explicit admin-only workflow for legacy records without `branchId`.

**Architecture:** Normal student routes remain fail-closed and always consume the authenticated branch resolved by the core auth middleware. Legacy unassigned records use separate admin-only endpoints so they can never leak into a normal branch list. The UI removes the ambiguous all-branches selection and exposes legacy records as a distinct mode with a validated branch-assignment action.

**Tech stack:** React, TypeScript, Express, Mongoose, Joi, Vitest.

## Task 1: Make normal branch selection and authorization fail closed

**Files:**
- Create: `src/context/branchSelection.ts`
- Create: `src/context/branchSelection.test.ts`
- Modify: `src/context/BranchContext.tsx`
- Modify: `src/pages/Header.tsx`
- Modify: `server/modules/student-management/middlewares/auth.middleware.branch.test.ts`
- Modify: `server/modules/student-management/middlewares/auth.middleware.ts`

1. Add failing tests proving a saved valid branch is retained, an empty/invalid saved value resolves to the first active branch, and branchless admins are rejected by normal student middleware.
2. Run the focused tests and confirm they fail for the missing behavior.
3. Implement the pure branch resolver, use it in `BranchContext`, remove the “Tất cả chi nhánh” option, and require a branch for admin/manager/branch_owner on normal student routes.
4. Run focused tests and the frontend typecheck/build.
5. Commit the task.

## Task 2: Add isolated admin-only legacy student APIs

**Files:**
- Modify: `server/modules/student-management/middlewares/auth.middleware.ts`
- Modify: `server/modules/student-management/middlewares/auth.middleware.branch.test.ts`
- Modify: `server/modules/student-management/validations/student.validation.ts`
- Modify: `server/modules/student-management/routes/student.routes.ts`
- Modify: `server/modules/student-management/controllers/student.controller.ts`
- Modify: `server/modules/student-management/services/student.service.ts`
- Create: `server/modules/student-management/services/student.service.branch.test.ts`

1. Add failing tests proving only admins may enter the legacy route, normal lists query exactly the selected branch, unassigned lists query only missing/empty `branchId`, and assignment rejects inactive/foreign-company branches.
2. Run focused tests and confirm expected failures.
3. Add an admin-only auth variant for routes declared before normal `router.use(authMiddleware)`.
4. Add `GET /students/unassigned` and `PATCH /students/:id/assign-branch` with Joi validation.
5. Implement company-wide owner scoping for admin legacy reads and atomic assignment limited to an unassigned student plus an active branch in the same company.
6. Run focused tests and server typecheck/build.
7. Commit the task.

## Task 3: Add the admin legacy UI without weakening normal editing

**Files:**
- Modify: `src/modules/student-management/hooks/useStudents.ts`
- Modify: `src/modules/student-management/pages/Students/StudentsPage.tsx`
- Modify: `src/modules/student-management/components/Student/EditStudentModal.tsx`
- Create: `src/modules/student-management/components/Student/AssignStudentBranchModal.tsx`
- Create: `src/modules/student-management/hooks/studentListScope.ts`
- Create: `src/modules/student-management/hooks/studentListScope.test.ts`

1. Add failing tests for endpoint selection: normal mode uses `/students`, admin legacy mode uses `/students/unassigned`, and non-admin roles cannot select legacy mode.
2. Run focused tests and confirm expected failures.
3. Extend the hook with an explicit list scope and refetch when branch/scope changes.
4. Add an admin-only “Chưa gán chi nhánh” view and assignment modal; after assignment, refresh both the legacy list and current branch data.
5. Remove `branchId` from the general edit-student payload so reassignment is possible only through the dedicated validated endpoint.
6. Run focused tests and frontend typecheck/build.
7. Commit the task.

## Task 4: Regression verification and branch handoff

1. Run all focused branch/student tests.
2. Run repository lint/typecheck/build commands relevant to frontend and backend.
3. Inspect the diff for accidental changes and verify no normal endpoint can return branchless or cross-branch records.
4. Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`.
5. Push `fix/student-branch-scope-v2` only after verification, as already authorized by the user’s earlier request to preserve the code remotely.
