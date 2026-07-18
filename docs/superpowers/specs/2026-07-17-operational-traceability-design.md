# Operational Traceability Foundation

## Goal

Make every important operational change traceable across tenant, project, task, workflow, user and integration context, so a Super Admin can reconstruct what happened, who acted, what changed, and what remains blocked.

## Scope: phase 1

- A shared trace-context contract with correlation ID, tenant, project, task, workflow, incident and actor references.
- Immutable audit records with safe before/after snapshots and reason fields for sensitive changes.
- Searchable chronological timeline API, scoped by tenant and object references.
- A reusable Super Admin trace timeline UI.
- Instrument the existing Project, Kanban Task, Workflow, User & Access, Tenant, Session and integration-administration boundaries incrementally.

## Architecture

The existing append-only `AuditEvent` collection remains the source of truth. It gains optional object-reference fields and compound indexes for timeline queries; sensitive payloads continue through redaction before persistence. A request trace-context middleware creates or accepts a correlation ID and carries stable references to service calls.

Each domain service emits concise, immutable events for lifecycle transitions and privileged mutations. The timeline query reads audit events only, joins lightweight display metadata where required, and never exposes secret values. It accepts tenant, object type/id, actor, action family, result and time-range filters.

## Required event context

Every new event contains: `eventId`, `occurredAt`, `correlationId`, actor, result, risk class, environment and tenant where applicable. Domain events add any applicable `projectId`, `taskId`, `workflowId`, `incidentId`, `integrationId` and a normalized `entityType`/`entityId` pair.

High-risk changes additionally require a human-readable `reason`; before/after snapshots include only changed, non-sensitive fields. Events are append-only and are never updated or deleted.

## Timeline behavior

The Super Admin timeline shows newest-first entries and supports cursor pagination. Selecting an event reveals its correlation chain, linked entity references, safe changed fields, reason, result and responsible actor. Filtering by a project or task returns related workflow, access and integration events that share a direct reference or correlation ID.

## Data safety and failures

- Redaction is applied before persistence and before response serialization.
- Missing optional context does not block legacy operations; new privileged operations must provide it.
- Invalid reference/filter combinations return validation errors.
- Audit-write failure blocks dangerous actions but is recorded and surfaced for standard actions according to the existing action-runtime policy.

## Verification

- Model tests prove indexes, immutability and redaction.
- Service tests prove emitted events include correlation and references.
- Router tests prove tenant isolation and filters.
- UI tests cover filtering, event detail and safely rendered snapshots.

## Delivery sequence

1. Extend the audit schema, trace context and timeline query.
2. Instrument Project and Kanban Task lifecycle/actions.
3. Instrument Workflow, User & Access, Tenant and integration changes.
4. Add the Super Admin trace timeline and project control views.
5. Add Incident/Problem Management after all source modules produce reliable linked events.
