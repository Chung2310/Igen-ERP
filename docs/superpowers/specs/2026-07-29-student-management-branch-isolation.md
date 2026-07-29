# Student Management Branch Isolation Design

## Goal

Ensure classes/projects, courses, exams, resources, and broadcast notifications always display and mutate data for the authenticated user's current branch. Administrators may switch branches and must immediately see the selected branch's data; other roles remain restricted to their assigned branch.

## Design

- Keep branch selection authoritative in `BranchContext`; API requests continue sending the selected branch through the existing authentication interceptor.
- Make every affected frontend data loader depend on `activeBranchId`, so switching branches invalidates local state and triggers a new request.
- Keep existing owner/company authorization and add branch scope to notification list/delete operations, matching the scope already used by batches, courses, exams, and resources.
- Store the authenticated branch on notification creation and restrict installment updates to students in that same branch.
- Validate cross-entity assignments (class to course, exam to students) within the active branch. Never trust a branch supplied by request body or query string.
- Legacy notifications without `branchId` remain hidden rather than being exposed across branches.

## Verification

- Regression tests prove frontend loaders are invalidated by branch changes.
- Service/controller tests prove notification list, delete, and installment student updates are branch-scoped.
- Existing student-management tests, TypeScript checks, and production build must pass.
