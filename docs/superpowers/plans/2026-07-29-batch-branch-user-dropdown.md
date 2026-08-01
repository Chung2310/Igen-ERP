# Batch Branch User Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every active account in the current branch in the batch instructor dropdown and enforce the same scope when saving.

**Architecture:** The batch page requests the authenticated branch roster explicitly and formats every returned role. The users endpoint applies company, branch, and active-state filters. Batch assignment independently validates the selected account against the actor's company and branch.

**Tech Stack:** React, TypeScript, Express, Mongoose, Joi, Vitest/node:test.

## Global Constraints

- Do not migrate existing batch assignments.
- Never accept an inactive, cross-company, or cross-branch assignee.
- Preserve the optional unassigned value.

---

### Task 1: Branch roster formatting and loading

**Files:**
- Create: `src/modules/student-management/pages/Batches/instructorRoster.ts`
- Create: `src/modules/student-management/pages/Batches/instructorRoster.test.ts`
- Modify: `src/modules/student-management/pages/Batches/BatchesPage.tsx`

**Interfaces:**
- Produces: `buildInstructorOptions(users): { value: string; label: string }[]`.
- Consumes: `useBranch().activeBranchId`, `authService.getUsersByCompany(companyCode, branchId)`.

- [ ] Write failing tests proving active accounts of `admin`, `manager`, `branch_owner`, and `user` are included, inactive accounts are excluded, and labels contain the localized role.
- [ ] Run `vitest run src/modules/student-management/pages/Batches/instructorRoster.test.ts` and confirm the missing helper failure.
- [ ] Implement the helper and update `BatchesPage` to request the current branch explicitly and render all returned options without `role === "user"` filtering.
- [ ] Re-run the focused test and confirm it passes.
- [ ] Commit with `feat: show branch users in batch instructor dropdown`.

### Task 2: Scope the user roster endpoint

**Files:**
- Modify: `server/router/auth.router.ts`
- Modify: `server/controller/auth.controller.ts`
- Create: `server/controller/auth-users-branch-scope.test.ts`

**Interfaces:**
- Consumes query parameters `companyCode?: string`, `branchId?: string`.
- Produces a user query containing `{ companyCode, branchId, isActive: true }` after branch ownership validation.

- [ ] Write a failing test for a pure exported query builder proving branch and active-state scope.
- [ ] Run the focused test and confirm failure.
- [ ] Allow `branchId` in Joi query validation, add the active-state filter, and preserve the existing branch-company ownership check.
- [ ] Re-run the focused test and confirm it passes.
- [ ] Commit with `fix: scope active user roster by branch`.

### Task 3: Enforce assignment scope in the batch service

**Files:**
- Modify: `server/modules/student-management/services/batch.service.ts`
- Create: `server/modules/student-management/services/batch-instructor-scope.test.ts`

**Interfaces:**
- Extends `BatchActor` with `branchId?: string`.
- Produces `buildInstructorAssignmentQuery(actor, instructorId)` constrained by `_id`, `companyCode`, `branchId`, and `isActive: true`.

- [ ] Write failing tests proving all account roles in the same branch are accepted by the query shape while cross-branch/inactive records cannot match.
- [ ] Run the focused test and confirm failure.
- [ ] Remove the `role: "user"` constraint and implement company/branch/active constraints.
- [ ] Re-run focused batch tests and confirm they pass.
- [ ] Commit with `fix: validate batch assignee branch scope`.

### Task 4: Verification and push

- [ ] Run all new focused tests plus existing batch and branch tests.
- [ ] Run TypeScript typecheck and frontend/backend production builds.
- [ ] Inspect `git diff --check` and working-tree status.
- [ ] Push `fix/student-branch-scope-v3` after all checks pass.