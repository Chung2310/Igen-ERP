# Module 3 Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Module 3 requirements: visible completed-session progress, enrollment history for existing classes, and learner suspension/resumption without changing remaining sessions.

**Architecture:** The batch service remains the authority for session limits and enrollment state. It backfills missing enrollment records from a batch's current learners before returning them or accepting attendance. A narrow enrollment-state endpoint updates suspension metadata; the React management modal uses it without changing class membership.

**Tech Stack:** TypeScript, Express, Mongoose, React 19, Vitest, Tailwind.

## Global Constraints

- Do not rename a batch after creation; retain attendance and enrollment history.
- Count sessions only from valid scheduled dates, excluding configured holidays.
- `remainingSessions` is always `max(allowedSessions - attendedSessions, 0)`.
- A suspended learner cannot receive new present/late attendance; resuming only changes status and preserves session counts.
- Existing worker changes in this workspace are in scope and must not be discarded.

---

### Task 1: Show class session progress

**Files:**
- Modify: `src/modules/student-management/pages/Batches/BatchesPage.tsx`

**Produces:** `renderProgressChips(batch)` presents both `doneSessions/totalSessions` and remaining sessions.

- [ ] **Step 1: Confirm the current card/table copy only renders remaining sessions.**

Run: `rg -n "Còn .*buổi|doneSessions" src/modules/student-management/pages/Batches/BatchesPage.tsx`

Expected: `doneSessions` is absent from the rendered copy.

- [ ] **Step 2: Render completed sessions with the server-computed progress.**

```tsx
if (p.progressLevel === 'grey') return `Đã học ${p.doneSessions}/${p.totalSessions} buổi`;
return `Đã học ${p.doneSessions}/${p.totalSessions} • còn ${p.remainingSessions} buổi`;
```

- [ ] **Step 3: Build the client.**

Run: `npm run build`

Expected: exit code 0.

### Task 2: Backfill enrollments for old classes

**Files:**
- Modify: `server/modules/student-management/services/batch.service.ts`
- Modify: `server/modules/student-management/controllers/batch.controller.ts`
- Test: `server/modules/student-management/utils/session-count.test.ts`

**Produces:** `BatchService.getEnrollments()` creates missing enrollment rows for current `learnerIds` before returning them; attendance checks use the same records.

- [ ] **Step 1: Write a failing utility test for the historical attendance count.**

```ts
it('counts one consumed session even when a learner has duplicate records in the same session', () => {
  assert.equal(countConsumedSessions(sessions, 'student-1'), 1);
});
```

- [ ] **Step 2: Run the test and observe its expected missing-export failure.**

Run: `npx vitest run server/modules/student-management/utils/session-count.test.ts`

Expected: FAIL because `countConsumedSessions` is not exported.

- [ ] **Step 3: Add the shared pure helper and use it when seeding/backfilling enrollment counts.**

```ts
export function countConsumedSessions(
  sessions: Array<{ records: Array<{ studentId: string; status: string }> }>,
  studentId: string,
): number {
  return sessions.filter((session) => session.records.some(
    (record) => record.studentId === studentId && ['present', 'late'].includes(record.status),
  )).length;
}
```

- [ ] **Step 4: Add `BatchService.getEnrollments(ownerId, batchId, branchId)`.**

It must load the scoped `Batch`, create rows for every current learner with `allowedSessions` from the batch schedule and `attendedSessions` from historical attendance, then return all enrollment rows. The controller must call this service instead of querying rows directly.

- [ ] **Step 5: Run the utility tests.**

Run: `npx vitest run server/modules/student-management/utils/session-count.test.ts server/modules/student-management/utils/batch-progress.test.ts`

Expected: all tests pass.

### Task 3: Suspend and resume enrollment

**Files:**
- Modify: `server/modules/student-management/interfaces/batch-enrollment.interface.ts`
- Modify: `server/modules/student-management/models/batch-enrollment.model.ts`
- Modify: `server/modules/student-management/services/batch.service.ts`
- Modify: `server/modules/student-management/controllers/batch.controller.ts`
- Modify: `server/modules/student-management/routes/batch.routes.ts`
- Modify: `server/modules/student-management/validations/batch.validation.ts`
- Modify: `src/modules/student-management/types.ts`
- Modify: `src/modules/student-management/components/Batches/ManageLearnersModal.tsx`

**Produces:** `PATCH /batches/:id/learners/:studentId/enrollment-status` with `{ status, reason?, expectedReturnAt? }`; status is limited to `Bảo lưu` and `Đang học`.

- [ ] **Step 1: Write a failing pure state-transition test.**

```ts
it('retains allowed and attended sessions when resuming an enrollment', () => {
  expect(transitionEnrollmentStatus(seed, 'Đang học')).toMatchObject({
    allowedSessions: 12,
    attendedSessions: 5,
    status: 'Đang học',
  });
});
```

- [ ] **Step 2: Run the test and observe the missing helper failure.**

Run: `npx vitest run server/modules/student-management/utils/enrollment-status.test.ts`

Expected: FAIL because the transition helper does not exist.

- [ ] **Step 3: Implement the transition helper and service endpoint.**

Suspending stores `suspendedAt`, `suspensionReason`, and optional `expectedReturnAt`, with a history record. Resuming clears only those pause fields and adds a history record; it must not alter session counts.

- [ ] **Step 4: Reject attendance for a suspended learner.**

`assertWithinSessionQuota` must reject `present`/`late` records where the enrollment status is `Bảo lưu`.

- [ ] **Step 5: Add modal controls and metadata.**

The learner row displays the status and provides Bảo lưu/Tiếp tục actions. Suspension asks for a reason and optional return date using the browser's native prompts to keep this scoped change small.

- [ ] **Step 6: Run focused tests and typecheck.**

Run: `npx vitest run server/modules/student-management/utils/*.test.ts && npm run typecheck`

Expected: exit code 0.

### Task 4: Final verification and documentation check

**Files:**
- Modify: `docs/Kế hoạch thay đổi kèm ranking.md`

- [ ] **Step 1: Add implementation notes to Module 3 covering lazy backfill and the suspension workflow.**

- [ ] **Step 2: Run unit tests, typecheck, and production build.**

Run: `npx vitest run server/modules/student-management/utils/*.test.ts`, `npm run typecheck`, and `npm run build`.

Expected: all commands exit code 0.

- [ ] **Step 3: Review the final diff.**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; report all uncommitted files without committing them.