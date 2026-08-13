# Kanban Project Details Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add validated project metadata, computed task progress, semi-automatic lifecycle, and project document upload/link support to Giao việc.

**Architecture:** Keep project persistence in the existing Project model, isolate validation/progress/lifecycle rules in a project service, and invoke lifecycle synchronization after task mutations. Return computed progress in project API responses, then render/edit the data in focused React components while reusing the existing attachment uploader.

**Tech Stack:** Express, Mongoose, TypeScript, React, Vitest.

---

### Task 1: Domain rules and persistence

**Files:** `server/service/kanban-project.service.test.ts`, `server/service/kanban-project.service.ts`, `server/interface/project.interface.ts`, `server/model/project.model.ts`

1. Write failing tests for progress, archived exclusion, empty projects, lifecycle transitions, date/priority/status validation, and attachments.
2. Run the focused test and confirm RED.
3. Implement the smallest domain helpers and schema fields.
4. Run the focused test and confirm GREEN.

### Task 2: Project API and task lifecycle wiring

**Files:** `server/router/kanban.router.ts`, `server/router/kanban-project-wiring.test.ts`

1. Write failing route/wiring tests for aggregate progress, create/update, and lifecycle sync after create/update/delete/reassignment.
2. Run the focused test and confirm RED.
3. Add GET aggregation, POST/PATCH validation and attachment finalization, plus task mutation sync.
4. Run focused server tests and confirm GREEN.

### Task 3: Project UI

**Files:** `src/types/hr.ts`, `src/components/hr/KanbanProjectSummary.tsx`, `src/components/hr/KanbanProjectSummary.test.tsx`, `src/components/hr/KanbanTab.tsx`

1. Write failing component tests for status, priority, dates, progress fraction/percent, documents, and missing-value labels.
2. Run the focused test and confirm RED.
3. Add project types, summary rendering, create/edit modal fields, attachment upload/link editing, and API refresh behavior.
4. Run focused frontend tests and confirm GREEN.

### Task 4: Verification and delivery

1. Run focused server/frontend tests, typecheck, and relevant lint.
2. Review the diff against the approved design and address findings.
3. Commit and push the feature branch.
