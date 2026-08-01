# Student Management Branch Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate classes/projects, courses, exams, resources, and broadcast notifications by the active branch while preserving administrator branch switching.

**Architecture:** The frontend treats `activeBranchId` as cache invalidation input for every module loader. Backend services combine the existing owner scope with the authenticated branch scope and validate referenced students/courses in that same scope.

**Tech Stack:** React 19 hooks, TypeScript, Express, Mongoose, Vitest.

## Global Constraints

- The server-derived `req.user.branchId` is authoritative; request data cannot override it.
- Administrators see the selected branch; non-admin roles remain bound to their assigned branch.
- Legacy records without `branchId` are fail-closed and not returned.
- Preserve existing owner/company authorization and API response shapes.

---

### Task 1: Frontend branch-change invalidation

**Files:**
- Modify: `src/modules/student-management/hooks/useBatches.ts`
- Modify: `src/modules/student-management/hooks/useCourses.ts`
- Modify: `src/modules/student-management/hooks/useExams.ts`
- Modify: `src/modules/student-management/hooks/useResources.ts`
- Modify: `src/modules/student-management/pages/Notifications/NotificationsPage.tsx`
- Test: `src/modules/student-management/hooks/branchAwareLoaders.test.ts`

**Interfaces:**
- Consumes: `useBranch(): { activeBranchId: string }`
- Produces: fetch callbacks whose dependency lists include `activeBranchId`

- [ ] Write a failing source-level regression test asserting all five loaders consume `useBranch` and depend on `activeBranchId`.
- [ ] Run `npx vitest run src/modules/student-management/hooks/branchAwareLoaders.test.ts` and verify it fails because the loaders are not branch-aware.
- [ ] Import `useBranch`, read `activeBranchId`, clear stale state at fetch start where appropriate, and include it in each fetch callback dependency list.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Notification backend branch scope

**Files:**
- Modify: `server/modules/student-management/services/notification.service.ts`
- Modify: `server/modules/student-management/controllers/notification.controller.ts`
- Modify: `server/modules/student-management/interfaces/notification.interface.ts`
- Test: `server/modules/student-management/services/notification.service.test.ts`

**Interfaces:**
- Produces: `createNotification(ownerId, branchId, data)`, `getNotifications(ownerId, filters, branchId)`, and `deleteNotification(ownerId, id, branchId)`

- [ ] Write failing tests asserting notification queries contain both owner and branch and installment student lookup contains the same branch.
- [ ] Run `npx vitest run server/modules/student-management/services/notification.service.test.ts` and verify expected branch assertions fail.
- [ ] Add branch scope to create/list/delete and installment student lookup; pass only `req.user.branchId` from the controller.
- [ ] Re-run the focused test and verify it passes.

### Task 3: Cross-entity branch validation

**Files:**
- Modify: `server/modules/student-management/services/batch.service.ts`
- Modify: `server/modules/student-management/services/course.service.ts`
- Test: `server/modules/student-management/services/batch.service.branch.test.ts`

**Interfaces:**
- Consumes: authenticated `branchId` passed by the existing controllers
- Produces: class/course lookup and uniqueness queries scoped to the active branch

- [ ] Write failing tests proving a class cannot reference a course from another branch and duplicate codes are evaluated per branch.
- [ ] Run `npx vitest run server/modules/student-management/services/batch.service.branch.test.ts` and verify the scope assertions fail.
- [ ] Add branch scope to referenced-course and duplicate-code queries for create/update paths, and scope course code uniqueness by branch.
- [ ] Re-run the focused test and verify it passes.

### Task 4: Full verification and delivery

**Files:**
- Verify all modified source and test files.

**Interfaces:**
- Produces: a branch-isolated student-management feature set ready to push.

- [ ] Run all new focused Vitest tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Review `git diff --check` and `git status --short`.
- [ ] Commit with a focused message and push `fix/student-branch-scope-v3` as previously authorized.
