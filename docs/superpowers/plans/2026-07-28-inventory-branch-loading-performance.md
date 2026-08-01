# Inventory Branch Loading Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make inventory data refresh immediately and safely when an admin switches branches.

**Architecture:** Inventory subscriptions receive the active branch explicitly and own an abort controller for their request lifecycle. `InventoryTab` recreates subscriptions on branch changes, while `BranchContext` updates selection locally without re-fetching the branch list.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Fetch API

## Global Constraints

- Preserve five-second inventory polling.
- Never allow a response from the previous branch to overwrite the selected branch.
- Keep branch-management mutation events able to refresh the branch list.

---

### Task 1: Branch-aware cancellable inventory subscriptions

**Files:**
- Modify: `src/services/inventoryProductService.ts`
- Modify: `src/services/inventoryCategoryService.ts`
- Modify: `src/services/inventoryStockLogService.ts`
- Test: `src/services/inventorySubscriptions.test.ts`

**Interfaces:**
- Consumes: `branchId: string` from `BranchContext`
- Produces: `subscribe(branchId, callback, onError)` cleanup functions that abort requests and clear polling timers

- [ ] **Step 1: Write failing tests for explicit branch headers and abort cleanup**
- [ ] **Step 2: Run `npx vitest run src/services/inventorySubscriptions.test.ts` and confirm the expected failures**
- [ ] **Step 3: Add branch-aware headers and abort controllers to the three services**
- [ ] **Step 4: Re-run the focused test and confirm it passes**

### Task 2: Immediate inventory refresh without redundant branch-list reload

**Files:**
- Modify: `src/pages/InventoryTab.tsx`
- Modify: `src/context/BranchContext.tsx`
- Test: `src/pages/inventoryBranchRefresh.test.tsx`

**Interfaces:**
- Consumes: `activeBranchId` and branch loading state from `useBranch()`
- Produces: subscriptions recreated synchronously after branch selection

- [ ] **Step 1: Write a failing integration test that changes the active branch and expects fresh subscriptions immediately**
- [ ] **Step 2: Run `npx vitest run src/pages/inventoryBranchRefresh.test.tsx` and confirm it fails for the missing branch dependency**
- [ ] **Step 3: Bind the inventory effect to `activeBranchId`, reset loading state, and remove the selection-only event dispatch**
- [ ] **Step 4: Re-run the focused test and confirm it passes**

### Task 3: Regression verification

**Files:**
- Verify only

**Interfaces:**
- Consumes: completed Tasks 1-2
- Produces: verified frontend and production build

- [ ] **Step 1: Run the inventory-focused Vitest suite**
- [ ] **Step 2: Run `npm run typecheck`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Review `git diff --check` and the final diff**
