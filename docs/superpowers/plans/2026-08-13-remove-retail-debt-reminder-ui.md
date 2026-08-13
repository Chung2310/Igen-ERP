# Remove Retail Debt Reminder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every Retail user-facing debt-reminder entry while preserving the Finance reminder UI and Retail backend compatibility.

**Architecture:** Remove navigation permissions and rendering first, then remove the report action and orphaned frontend modules. Backend Retail reminder routes and services remain untouched.

**Tech Stack:** React, TypeScript, Vitest.

## Global Constraints

- Finance reminder UI remains unchanged.
- Retail backend reminder routes, jobs, models, and history remain unchanged.
- Legacy `sub=nhac-cong-no` URLs fall back through the existing sub-tab router.

---

### Task 1: Remove Retail navigation

**Files:**
- Modify: `src/modules/retail/retailTabPermissions.test.ts`
- Modify: `src/modules/retail/retailTabPermissions.ts`
- Modify: `src/modules/retail/RetailWorkspace.tsx`

- [ ] Update permission tests to exclude `nhac-cong-no` and run them to confirm RED.
- [ ] Remove the slug, tab definition, lazy page import, icon, and render branch.
- [ ] Run the permission tests and confirm GREEN.

### Task 2: Remove Retail report action and orphaned frontend modules

**Files:**
- Modify: `src/modules/retail/pages/RetailReportsPage.test.tsx`
- Modify: `src/modules/retail/pages/RetailReportsPage.tsx`
- Modify: `src/modules/retail/api/retailReports.api.ts`
- Delete: `src/modules/retail/pages/RetailDebtRemindersPage.tsx`
- Delete: `src/modules/retail/pages/RetailDebtRemindersPage.test.tsx`
- Delete: `src/modules/retail/api/retailDebtReminders.api.ts`

- [ ] Add an assertion that Retail Reports has no `Nhắc công nợ` button and confirm RED.
- [ ] Remove reminder state, handler, button, feedback, and frontend API method.
- [ ] Confirm no remaining frontend imports reference Retail reminder modules, then delete the orphaned files.
- [ ] Run targeted Retail and Finance reminder tests, typecheck, and lint.
