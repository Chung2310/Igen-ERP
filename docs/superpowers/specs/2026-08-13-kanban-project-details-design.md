# Kanban project details and calculated progress

## Goal

Projects in Giao việc need operational metadata, project-level documents, and trustworthy progress calculated from their tasks.

## Project fields

Each project stores:

- `name`;
- `status`: `not_started`, `in_progress`, `paused`, `completed`, or `cancelled`;
- `priority`: `low`, `medium`, `high`, or `urgent`;
- `startAt`: planned start date/time;
- `dueAt`: planned deadline;
- `completedAt`: actual completion date/time, managed by the lifecycle rules;
- `attachments`: uploaded files or external links using the same attachment shape as Kanban tasks.

`startAt`, `dueAt`, and `completedAt` are optional for legacy projects. When both planned dates are present, `dueAt` cannot precede `startAt`. An actual completion timestamp cannot precede `startAt`.

## Documents

Managers can upload multiple project files through the existing media relay or add external links. Each uploaded file is limited to 25 MB. Project attachments are independent of task attachments and support viewing/downloading and removal while editing the project.

The server accepts only finalized uploaded attachment metadata, including a valid media upload token where required by the existing media finalization flow. Link attachments require an HTTP or HTTPS URL.

## Calculated progress

Progress is calculated at read time from tasks scoped to the same company and linked by `projectId`; no percentage is stored on the project.

- Completed tasks have status `Done` or `done`.
- Archived tasks have status `Archived` and are excluded from both numerator and denominator.
- All other linked tasks are incomplete.
- `completedTaskCount` is the number of completed tasks.
- `totalTaskCount` is the number of non-archived tasks.
- `completionPercent` is the rounded integer percentage of completed over total.
- A project with no eligible task returns `0/0` and `0%`.

Example: two completed tasks and one incomplete task return `2/3` and `67%`.

The projects list endpoint performs an aggregate task count for all returned project IDs, avoiding one task query per project.

## Status lifecycle

Project status is semi-automatic:

- A new project defaults to `not_started`.
- A manager can set `not_started`, `in_progress`, `paused`, or `cancelled` manually.
- A project cannot be set manually to `completed` while any eligible task is incomplete or when it has no eligible tasks.
- When every eligible task becomes complete, the project automatically becomes `completed` and records `completedAt`.
- When a completed task is reopened and the project was automatically completed, the project returns to `in_progress` and clears `completedAt`.
- `paused` and `cancelled` are manual override states and task changes do not automatically leave those states.
- A project whose planned start is in the future can remain `not_started`; reaching the start time does not require a background job. Task activity may transition it to `in_progress`.

Task create, update, status move, deletion, and project reassignment synchronize both the previous and new affected projects after the task mutation succeeds.

## API and permissions

- `GET /api/v1/kanban/projects` returns project metadata plus calculated progress.
- `POST /api/v1/kanban/projects` creates a project with validated metadata and attachments.
- `PATCH /api/v1/kanban/projects/:id` updates project metadata and documents.
- Existing delete behavior remains and unlinks project tasks.
- `project:read` is required to view projects and progress.
- `project:manage` is required to create, edit, upload/link documents, change status, or delete.
- Company and branch scoping continue to apply to every operation.

## User interface

The grouped-project header shows:

- project name and task count;
- localized status and priority badges;
- planned start and deadline;
- progress as `completed/total · percent%` and a progress bar.

Expanding a project shows its task table plus actual completion time and project documents. Managers see edit and delete actions. The create/edit project modal contains visible labels for status, priority, planned start, deadline, and documents. Actual completion time is read-only because lifecycle rules own it.

Dates are shown in Vietnamese local time. Missing optional values display `Chưa thiết lập`, not a misleading default.

## Error handling

The API rejects invalid date ordering, invalid status/priority, malformed attachments, unauthorized mutation, and premature completion with Vietnamese user-facing messages. The UI preserves entered values and displays the returned error instead of silently closing the modal.

## Testing

- Model tests cover new fields and attachment schema.
- API tests cover scope, permissions, field validation, date ordering, and attachment validation.
- Progress tests cover `2/3 = 67%`, archived exclusion, legacy task statuses, and no-task projects.
- Lifecycle tests cover automatic completion, reopening, paused/cancelled overrides, deletion, and reassignment affecting both projects.
- UI tests cover visible metadata, progress bar/text, create/edit fields, upload/link documents, validation errors, and read-only actual completion time.
