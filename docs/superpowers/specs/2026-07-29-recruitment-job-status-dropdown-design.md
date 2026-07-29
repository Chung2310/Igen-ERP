# Recruitment Job Status Dropdown Design

## Goal

Move recruitment job status editing out of the JD detail dialog and into the jobs list so status changes are quicker and visible in context.

## User Interface

- Replace the read-only status badge in the jobs table with a dropdown in the existing `Trạng thái` column.
- The dropdown contains all supported statuses: `draft`, `open`, `paused`, and `closed`, using the existing Vietnamese labels.
- Remove the status field from the JD create/edit dialog.
- Remove the `Mở tuyển` and `Tạm dừng` action buttons. Keep the delete and edit actions unchanged.

## Interaction and Data Flow

1. The user selects a status different from the current value in a job row.
2. The row dropdown is disabled while the request is in flight to prevent duplicate submissions.
3. The UI calls the existing `recruitmentApi.changeJobStatus(job._id, job.version, nextStatus)` endpoint.
4. On success, the jobs list reloads from the server.
5. On failure, the existing error area displays the API message. A version conflict uses the existing friendly conflict message, and the list reloads to restore authoritative state.

No API or database changes are required.

## State Management

`RecruitmentJobsView` tracks the ID of the job currently changing status. Only that row's dropdown is disabled. The state is cleared after the request and list refresh finish.

## Testing

Add component coverage that verifies:

- the jobs list renders a status dropdown with the current value;
- selecting a different status calls `changeJobStatus` with the job ID, current version, and selected status;
- the old `Mở tuyển` and `Tạm dừng` buttons are absent;
- the JD detail dialog no longer contains a status selector.

Run the recruitment component tests and TypeScript typecheck.