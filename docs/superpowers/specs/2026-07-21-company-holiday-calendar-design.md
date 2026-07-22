# Company Holiday Calendar Design

## Goal

Add a company-wide work calendar that automatically provides Vietnam public holidays while allowing administrators to control whether generated dates apply and to add company-specific holidays or working-day overrides.

The calendar becomes the shared source for leave-day counting, workflow deadlines, attendance expectations, the HR calendar, and dashboard reminders.

## Scope

- Every calendar rule applies to the entire company.
- The system generates a baseline holiday calendar for a selected year.
- Admins and superadmins may enable or disable generated entries but may not delete or edit their source date and name.
- Admins and superadmins may add and edit company-specific holidays, substitute holidays, and working-day overrides.
- Entries are disabled instead of physically deleted.
- Administrative changes record the actor, timestamp, reason, and before/after values.
- Dates are interpreted in `Asia/Ho_Chi_Minh` and stored as local `YYYY-MM-DD` calendar dates.

Department-specific, employee-specific, and nationality-specific calendars are outside this version.

## Data Model

Create a dedicated company work-calendar collection rather than representing holidays as ordinary HR calendar events.

```ts
interface CompanyWorkCalendarDay {
  companyCode: string;
  date: string; // YYYY-MM-DD in the company timezone
  name: string;
  dayType: "holiday" | "substitute_holiday" | "working_override";
  source: "system" | "admin";
  sourceKey?: string;
  sourceYear: number;
  isApplied: boolean;
  adminReason?: string;
  lastAdminAction?: "created" | "updated" | "enabled" | "disabled";
  lastAdminBy?: string;
  lastAdminAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

`sourceKey` is a stable identifier for a generated holiday, allowing synchronization to upsert a record without replacing the administrator-controlled `isApplied` value.

Use a unique index on `(companyCode, date, dayType, source, sourceKey)`, with a partial form where necessary for admin-created rows. Service-level validation prevents conflicting applied rules on the same date.

Store audit records separately:

```ts
interface CompanyWorkCalendarAudit {
  companyCode: string;
  calendarDayId: string;
  action: "created" | "updated" | "enabled" | "disabled" | "synced";
  actorId: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  createdAt: Date;
}
```

## Authorization and Editing Rules

- Only admin and superadmin roles can synchronize or manage the calendar.
- A system entry exposes only the `isApplied` control. Disabling it requires a non-empty reason.
- An admin entry can be edited. Disabling it also requires a non-empty reason.
- No management API physically deletes an entry.
- Calendar queries remain company-scoped regardless of any client-supplied company code.
- The server rejects simultaneous applied holiday and working override rules for the same company and date.

## Automatic Synchronization

The sync endpoint accepts a year and produces the known Vietnam holiday baseline for that year. It uses idempotent upserts keyed by company, year, and stable source key.

Synchronization:

- creates missing system entries;
- refreshes system-owned fields such as the official name and date;
- preserves `isApplied`, `adminReason`, and last-admin metadata after an administrator has acted;
- never modifies admin-created entries;
- records a sync audit entry;
- can safely be run repeatedly.

Year-specific official dates remain explicit calendar data. Lunar holidays, Tet ranges, National Day choices, substitute holidays, and announced workday swaps are not calculated dynamically during business queries. This avoids changing historical calculations when rules or external announcements change.

The initial implementation may ship a verified year provider for supported years. Unsupported years return an explicit error and leave existing calendar data unchanged; an admin can still add dates manually.

## Working-Day Service

Create a server-side `CompanyWorkCalendarService` as the single authority for calendar calculations:

```ts
isWorkingDay(companyCode, date): Promise<boolean>
addWorkingDays(companyCode, startDate, days): Promise<string>
countWorkingDays(companyCode, startDate, endDate): Promise<number>
listWorkingDates(companyCode, startDate, endDate): Promise<string[]>
```

Evaluation order for a date:

1. An applied `working_override` makes the date a working day.
2. An applied `holiday` or `substitute_holiday` makes the date non-working.
3. Otherwise, the company's configured weekly `workingDays` decides.

The service loads calendar entries for a date range in one query and performs range calculations in memory. Callers must not query once per date.

Frontend schedule previews must consume a server-calculated result or the same returned calendar-day data. The current fixed weekend-only preview must not remain an independent source of truth.

## Module Integration

### Leave applications

For a full-day leave request, the chargeable dates are the dates in the inclusive range for which `isWorkingDay` is true. Store `chargeableDays` and `chargeableDates` as an approval-time snapshot so later calendar edits do not silently rewrite approved leave balances.

Half-day leave calculation can reuse the same working-date decision, but expanding the leave balance system beyond the fields already present is not required unless it is needed by the current leave UI.

### Workflow deadlines

Replace the current weekday-only functions in the workflow link service with the shared calendar service. Task generation and schedule preview must return identical dates. Applied holidays are skipped; applied working overrides can be counted even when they fall on a normally non-working weekday.

### Attendance and dashboard

Today-status responses include whether the local date is a working day and the applicable calendar label. On non-working days, the dashboard does not show a missing-attendance warning.

This version does not prohibit check-in on a non-working day because that could block legitimate overtime. It marks the context for later overtime policy instead.

### HR calendar

Holiday entries appear as read-only calendar overlays sourced from the work-calendar API. They are not copied into `hr-calendar-events`, preventing collisions with ordinary events and leave records.

## Management UI

Add a work-calendar section under the existing work-hours/settings area:

- year selector;
- `Đồng bộ lịch nghỉ lễ` action;
- `Thêm ngày` action;
- filters for applied state, source, and day type;
- columns for date, name, type, source, status, and last update;
- an `Áp dụng` switch;
- a system badge and locked source fields for generated entries;
- editable fields for admin entries;
- a required-reason dialog when disabling an entry.

Disabled dates remain visible in management views and are excluded from business calculations. Calendar and employee-facing views show applied entries only.

## API Shape

Use focused endpoints rather than generic CRUD so authorization and source-field restrictions are centralized:

```text
GET   /api/v1/timekeeping/work-calendar?year=2026
POST  /api/v1/timekeeping/work-calendar/sync
POST  /api/v1/timekeeping/work-calendar
PATCH /api/v1/timekeeping/work-calendar/:id
GET   /api/v1/timekeeping/work-calendar/:id/audit
```

`sync` accepts `{ year }`. Create and update schemas use strict allowlists; system entries reject changes to their date, name, type, source, or source key.

## Error Handling

- Reject invalid local-date strings and unsupported years with validation errors.
- Reject conflicts without changing either existing entry.
- Treat repeated synchronization as success.
- Perform an entry mutation and its audit write transactionally where MongoDB transactions are available.
- Never silently fall back to weekend-only calculations after a calendar query failure. Return a service error so callers do not produce incorrect leave or deadline results.
- Display actionable Vietnamese error messages in the management UI.

## Testing

Unit tests cover:

- weekday fallback using company-configured working days;
- applied and disabled holidays;
- working overrides on weekends;
- conflict detection;
- inclusive range counting;
- add-working-days behavior across consecutive holidays;
- `Asia/Ho_Chi_Minh` date boundaries.

Service and controller tests cover:

- admin/superadmin authorization;
- tenant isolation;
- immutable source fields on system entries;
- required disable reason;
- idempotent synchronization;
- preservation of an admin-disabled state after resynchronization;
- audit creation.

Integration tests cover:

- leave spanning a weekend and public holiday;
- workflow deadlines spanning holidays and working overrides;
- matching server and UI schedule results;
- dashboard behavior on a holiday;
- two companies applying different states to the same baseline holiday.

## Delivery Boundaries

This feature delivers the calendar source, management workflow, shared calculation service, and integrations needed to remove holiday dates from existing workday calculations. It does not introduce employee-specific calendars, automated legal-data scraping, payroll/overtime calculation, or retroactive recalculation of already approved leave and generated tasks.
