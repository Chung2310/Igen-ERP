# Workflow Reader View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the workflow operational detail screen with a read-only step reader while preserving manager editing controls.

**Architecture:** Keep `WorkflowTab` as the data/state coordinator. Replace the non-manager detail render with a reader view that renders workflow metadata and ordered steps; retain the existing wizard and step editor for managers.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing `WorkflowTab` component and project test/typecheck tooling.

## Global Constraints

- API, model, workflow data shape, and Kanban links remain unchanged.
- Regular users only read workflow steps; managers retain create/edit/delete actions.

### Task 1: Add reader-view regression coverage

**Files:**
- Create or modify: `src/components/hr/WorkflowTab.test.tsx`

- [ ] **Step 1:** Inspect existing frontend test conventions and add a test fixture containing a workflow with two ordered steps.
- [ ] **Step 2:** Add assertions that the reader renders workflow name, description, both step titles/content in order, and no participant/assignment controls for a regular user.
- [ ] **Step 3:** Run the focused test and confirm it fails because the current detail view still exposes operational controls.

### Task 2: Replace operational detail with reader view

**Files:**
- Modify: `src/components/hr/WorkflowTab.tsx`

- [ ] **Step 1:** Change the selected workflow render for regular users to show a reader view with back navigation, workflow metadata, ordered step cards, instructions, duration/deadline, and attachments/links.
- [ ] **Step 2:** Keep manager-only create/edit/delete controls and the existing wizard/editor paths intact.
- [ ] **Step 3:** Remove regular-user access to participant/task operation controls from the reader.
- [ ] **Step 4:** Run the focused reader test and confirm it passes.

### Task 3: Verify the feature

**Files:**
- No additional files.

- [ ] **Step 1:** Run the focused workflow reader test.
- [ ] **Step 2:** Run `npm run typecheck` and record any pre-existing unrelated failures separately.
- [ ] **Step 3:** Run `git diff --check` and inspect the final diff.
- [ ] **Step 4:** Commit with `feat(hr): show workflows as step-by-step guides`.
