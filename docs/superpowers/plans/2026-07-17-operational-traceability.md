# Operational Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide shared, immutable, searchable operational traceability across management modules.

**Architecture:** Extend the append-only audit model with normalized entity references and query indexes. Services carry a trace context; the Super Admin UI consumes the timeline API without exposing redacted data.

**Tech Stack:** TypeScript, Express, Mongoose, React, node:test.

## Global Constraints

- Audit events are immutable and sensitive values are redacted before persistence and response.
- Privileged changes include correlation ID, actor, result, risk class and tenant where applicable.
- Existing behavior remains compatible when optional trace references are unavailable.

---

### Task 1: Traceable audit schema and query service

**Files:**
- Modify: `server/model/audit-event.model.ts`
- Modify: `server/service/super-admin-audit.service.ts`
- Test: `server/model/super-admin-security-models.test.ts`

- [ ] Write a failing schema test asserting `entityType`, `entityId`, `projectId`, `taskId`, `workflowId`, `tenantId` and compound timeline index are present.
- [ ] Run `npx tsx --test server/model/super-admin-security-models.test.ts`; expect failure.
- [ ] Add immutable optional references and an index on `{ companyCode: 1, occurredAt: -1 }`; extend timeline filters to match entity and project/task/workflow references.
- [ ] Re-run the test; expect pass.
- [ ] Commit `feat: add operational trace references`.

### Task 2: Trace timeline API and Super Admin UI

**Files:**
- Modify: `server/controller/super-admin.controller.ts`
- Modify: `server/router/super-admin.router.ts`
- Modify: `src/services/superAdminAuditService.ts`
- Modify: `src/components/super-admin/AuditTab.tsx`
- Test: `server/service/super-admin-audit.service.test.ts`

- [ ] Write a failing service test that queries by `correlationId` and entity reference.
- [ ] Run the focused test; expect failure.
- [ ] Add validated filters, cursor/page response metadata, and UI filter/detail rendering using only safe snapshots.
- [ ] Run focused tests, `npm run typecheck`, and `npm run build`; expect exit code 0.
- [ ] Commit `feat: add super admin trace timeline`.

### Task 3: Project and task event instrumentation

**Files:**
- Modify: `server/service/workflow-link.service.ts`
- Modify: Project and Kanban mutation services identified by repository search
- Test: matching service tests

- [ ] Write failing tests proving create/update/status/blocker events carry project/task/workflow references and correlation ID.
- [ ] Run focused tests; expect failure.
- [ ] Emit redacted lifecycle events at mutation boundaries with actor and reason where required.
- [ ] Run focused tests plus typecheck/build; expect pass.
- [ ] Commit `feat: trace project and task lifecycle changes`.
