# Company Holiday Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a company-wide Vietnam holiday calendar that admins can synchronize, supplement, and enable or disable, then use it consistently in attendance and workflow scheduling.

**Architecture:** A dedicated Mongoose model stores local-date rules and immutable system provenance. A focused service owns synchronization, authorization-safe mutations, and working-day calculations; controllers and UI consume that service instead of duplicating weekend logic.

**Tech Stack:** TypeScript 5.8, Express 4, Mongoose 9, Joi 18, React 19, Vitest 4, Testing Library.

## Global Constraints

- Calendar rules apply to the entire company only.
- Use local `YYYY-MM-DD` dates in `Asia/Ho_Chi_Minh`.
- System-generated rows cannot be deleted or have source fields edited; admins can only enable or disable them.
- Admin-created rows are edited or disabled, never physically deleted.
- Disabling requires a reason and all administrative changes are audited.
- `working_override` wins over an applied holiday on the same date, while management APIs prevent conflicting active records.
- Sync is idempotent and preserves admin-controlled state.
- Do not add automated legal-data scraping, payroll/overtime calculation, or employee-specific calendars.

---

### Task 1: Calendar domain model and Vietnam 2026 provider

**Files:**
- Create: `server/interface/company-work-calendar.interface.ts`
- Create: `server/model/company-work-calendar.model.ts`
- Create: `server/model/company-work-calendar-audit.model.ts`
- Create: `server/service/vietnam-holiday-provider.ts`
- Test: `server/service/vietnam-holiday-provider.test.ts`

**Interfaces:**
- Produces: `CompanyWorkCalendarDayType`, `CompanyWorkCalendarSource`, `ICompanyWorkCalendarDay`, `VIETNAM_HOLIDAYS_BY_YEAR`, and `getVietnamHolidayBaseline(year)`.

- [ ] **Step 1: Write the failing provider tests**

Assert that `getVietnamHolidayBaseline(2026)` returns unique stable `sourceKey` values, includes New Year, the five official Tet dates, Hung Kings day plus substitute holiday, 30 April, 1 May, and the two announced National Day dates; assert an unsupported year throws `UnsupportedHolidayYearError`.

- [ ] **Step 2: Run the provider test and verify it fails**

Run: `npx vitest run server/service/vietnam-holiday-provider.test.ts`
Expected: FAIL because the provider module does not exist.

- [ ] **Step 3: Implement focused domain types, schemas, and provider**

Use string-date schema validation and indexes:

```ts
export type CompanyWorkCalendarDayType = "holiday" | "substitute_holiday" | "working_override";
export type CompanyWorkCalendarSource = "system" | "admin";

CompanyWorkCalendarDaySchema.index(
  { companyCode: 1, sourceYear: 1, sourceKey: 1 },
  { unique: true, partialFilterExpression: { source: "system", sourceKey: { $type: "string" } } }
);
CompanyWorkCalendarDaySchema.index({ companyCode: 1, date: 1, isApplied: 1 });
```

The provider returns explicit, reviewed dates and never calculates lunar dates at query time.

- [ ] **Step 4: Run provider tests and typecheck**

Run: `npx vitest run server/service/vietnam-holiday-provider.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/interface/company-work-calendar.interface.ts server/model/company-work-calendar.model.ts server/model/company-work-calendar-audit.model.ts server/service/vietnam-holiday-provider.ts server/service/vietnam-holiday-provider.test.ts
git commit -m "feat: add company holiday calendar domain"
```

### Task 2: Shared work-calendar calculation and synchronization service

**Files:**
- Create: `server/service/company-work-calendar.service.ts`
- Test: `server/service/company-work-calendar.service.test.ts`

**Interfaces:**
- Consumes: calendar models and `getVietnamHolidayBaseline(year)` from Task 1.
- Produces: `toVietnamDate(date)`, `syncYear(companyCode, year, actorId)`, `isWorkingDay(companyCode, date)`, `listWorkingDates(companyCode, start, end)`, `countWorkingDays(companyCode, start, end)`, `addWorkingDays(companyCode, start, days)`, `createAdminDay(...)`, and `updateDay(...)`.

- [ ] **Step 1: Write failing pure-calculation and service tests**

Cover Monday-Friday fallback, disabled holidays, applied holidays, weekend working overrides, inclusive ranges, consecutive holidays, invalid ranges, idempotent sync, preservation of a disabled system row, conflict rejection, required disable reason, and audit payloads. Mock model calls with Vitest so tests do not require MongoDB.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run server/service/company-work-calendar.service.test.ts`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement range-safe calculations**

Load rules once per range and evaluate with this precedence:

```ts
if (rules.some((rule) => rule.isApplied && rule.dayType === "working_override")) return true;
if (rules.some((rule) => rule.isApplied && rule.dayType !== "working_override")) return false;
return workingDays.includes(dayOfWeekInVietnam(localDate));
```

Use bounded ISO-date iteration and reject ranges longer than 3660 days. Use `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" })` for instant-to-local conversion.

- [ ] **Step 4: Implement mutations, conflicts, sync preservation, and audit writes**

System upserts use `$set` for system fields and `$setOnInsert: { isApplied: true }`. Update uses a strict allowlist based on `source`; reject disabling without trimmed `adminReason`. Create audit rows with before/after snapshots.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx vitest run server/service/company-work-calendar.service.test.ts server/service/vietnam-holiday-provider.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/service/company-work-calendar.service.ts server/service/company-work-calendar.service.test.ts
git commit -m "feat: add shared work calendar service"
```

### Task 3: Management API and validation

**Files:**
- Create: `server/controller/company-work-calendar.controller.ts`
- Create: `server/controller/company-work-calendar.controller.test.ts`
- Modify: `server/router/timekeeping.router.ts`
- Test: `server/router/timekeeping.work-calendar.test.ts`

**Interfaces:**
- Consumes: Task 2 service methods.
- Produces: GET list, POST sync, POST admin day, PATCH entry, and GET audit endpoints under `/api/v1/timekeeping/work-calendar`.

- [ ] **Step 1: Write failing controller authorization tests**

Test unauthenticated routing, user/manager rejection, admin and superadmin access, company code sourced from `req.user`, validation of year/date/type/reason, immutable system fields, and Vietnamese error responses.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run server/controller/company-work-calendar.controller.test.ts server/router/timekeeping.work-calendar.test.ts`
Expected: FAIL because routes and controller do not exist.

- [ ] **Step 3: Implement controller methods**

Each method calls `requireCalendarAdmin(req)` and uses `req.user.companyCode`; list accepts a four-digit year. Map domain validation/conflict errors to 400/409 and unexpected errors to 500.

- [ ] **Step 4: Add strict Joi schemas and routes**

Create schemas for `{ year }`, admin creation `{ date, name, dayType, isApplied? }`, and update `{ name?, date?, dayType?, isApplied?, adminReason? }` with `.unknown(false)`.

- [ ] **Step 5: Run API tests and typecheck**

Run: `npx vitest run server/controller/company-work-calendar.controller.test.ts server/router/timekeeping.work-calendar.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/controller/company-work-calendar.controller.ts server/controller/company-work-calendar.controller.test.ts server/router/timekeeping.router.ts server/router/timekeeping.work-calendar.test.ts
git commit -m "feat: expose company work calendar management API"
```

### Task 4: Attendance status integration

**Files:**
- Modify: `server/controller/timekeeping.controller.ts`
- Create: `server/controller/timekeeping.calendar.test.ts`
- Modify: `src/pages/DashboardTab.tsx`
- Create: `src/pages/dashboard-work-calendar.test.tsx`

**Interfaces:**
- Consumes: `toVietnamDate` and `isWorkingDay` from Task 2.
- Produces: `GET /today` response data containing `{ log, workCalendar: { date, isWorkingDay, label? } }` and dashboard suppression of missing-attendance prompts on non-working days.

- [ ] **Step 1: Write failing controller and dashboard tests**

Assert `/today` uses the Vietnam date independent of server timezone, returns calendar context, keeps check-in possible on holidays, and suppresses only missing-attendance messaging rather than the check-in control.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run server/controller/timekeeping.calendar.test.ts src/pages/dashboard-work-calendar.test.tsx`
Expected: FAIL on the old response shape and dashboard behavior.

- [ ] **Step 3: Implement server response context**

Fetch the applied label and working decision with the log. Preserve compatibility by returning existing log fields alongside `workCalendar`, or update the single frontend consumer atomically if the response wrapper must change.

- [ ] **Step 4: Implement dashboard behavior**

Represent the response with a typed `workCalendar` field and gate only missing-attendance warnings on `workCalendar.isWorkingDay`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npx vitest run server/controller/timekeeping.calendar.test.ts src/pages/dashboard-work-calendar.test.tsx && yarn typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/controller/timekeeping.controller.ts server/controller/timekeeping.calendar.test.ts src/pages/DashboardTab.tsx src/pages/dashboard-work-calendar.test.tsx
git commit -m "feat: apply company calendar to attendance status"
```

### Task 5: Workflow scheduling integration

**Files:**
- Modify: `server/service/workflow-link.service.ts`
- Create: `server/service/workflow-link.calendar.test.ts`
- Modify: `src/components/hr/workflow/schedule.ts`
- Modify: relevant workflow API response in `server/service/workflow-link.service.ts`

**Interfaces:**
- Consumes: Task 2 range operations.
- Produces: async server schedule calculation using company calendar rules and a frontend preview based on server-provided schedule dates rather than fixed weekend rules.

- [ ] **Step 1: Write failing schedule tests**

Cover a deadline spanning 30 April/1 May, a Saturday working override, a disabled holiday, multiple workflow steps, and identical preview/server date strings.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run server/service/workflow-link.calendar.test.ts`
Expected: FAIL because current scheduling checks only weekday numbers.

- [ ] **Step 3: Replace weekday helpers with calendar-aware scheduling**

Make schedule generation async, prefetch rules across a safe horizon, and use the shared evaluator. Update all internal callers and preserve existing deadline-time semantics.

- [ ] **Step 4: Remove independent weekend-only preview authority**

Return calculated step windows with workflow data or provide applied date rules to the preview; keep `schedule.ts` as formatting/mapping code, not a competing business-rule implementation.

- [ ] **Step 5: Run workflow tests and typecheck**

Run: `npx vitest run server/service/workflow-link.calendar.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/service/workflow-link.service.ts server/service/workflow-link.calendar.test.ts src/components/hr/workflow/schedule.ts
git commit -m "feat: apply company calendar to workflow deadlines"
```

### Task 6: Admin management UI and HR calendar overlay

**Files:**
- Create: `src/services/companyWorkCalendarService.ts`
- Create: `src/components/settings/CompanyWorkCalendarTab.tsx`
- Create: `src/components/settings/CompanyWorkCalendarTab.test.tsx`
- Modify: `src/components/settings/ErpConfigTab.tsx`
- Modify: `src/components/hr/CalendarTab.tsx`
- Create: `src/components/hr/calendar-holiday-overlay.test.tsx`

**Interfaces:**
- Consumes: Task 3 endpoints.
- Produces: typed client API, admin year management panel, and read-only applied holiday overlays.

- [ ] **Step 1: Write failing component tests**

Test year selection, synchronization, source badges, locked system fields, admin row editing, required disable reason dialog, API error toast, and applied-only HR calendar overlays.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/components/settings/CompanyWorkCalendarTab.test.tsx src/components/hr/calendar-holiday-overlay.test.tsx`
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement typed client service**

Expose `listWorkCalendar(year)`, `syncWorkCalendar(year)`, `createWorkCalendarDay(input)`, and `updateWorkCalendarDay(id, input)` using the existing token/error conventions.

- [ ] **Step 4: Implement management panel**

Render Vietnamese labels, year selector, sync/add actions, filters, table/cards responsive layout, source badges, apply switch, and reason modal. System rows expose no edit action.

- [ ] **Step 5: Embed in ERP settings and add calendar overlays**

Show management only to admin/superadmin. Fetch applied entries for the visible calendar year and merge them only for display, without creating `hr-calendar-events` records.

- [ ] **Step 6: Run UI tests and typecheck**

Run: `npx vitest run src/components/settings/CompanyWorkCalendarTab.test.tsx src/components/hr/calendar-holiday-overlay.test.tsx && yarn typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/companyWorkCalendarService.ts src/components/settings/CompanyWorkCalendarTab.tsx src/components/settings/CompanyWorkCalendarTab.test.tsx src/components/settings/ErpConfigTab.tsx src/components/hr/CalendarTab.tsx src/components/hr/calendar-holiday-overlay.test.tsx
git commit -m "feat: add company holiday calendar management UI"
```

### Task 7: Leave snapshots and full verification

**Files:**
- Modify: `server/interface/hr-leave.interface.ts`
- Modify: `server/model/hr-leave-application.model.ts`
- Modify: `server/controller/crud.controller.ts`
- Create: `server/controller/hr-leave-calendar.test.ts`
- Modify: `docs/superpowers/specs/2026-07-21-company-holiday-calendar-design.md` only if implementation facts require clarification.

**Interfaces:**
- Consumes: `listWorkingDates` from Task 2.
- Produces: approved leave records with immutable `chargeableDates: string[]` and `chargeableDays: number` snapshots.

- [ ] **Step 1: Write failing approval snapshot tests**

Assert an approval spanning weekend and holiday stores only working dates, later calendar edits do not alter the stored snapshot, and non-leave application types do not receive a full-day snapshot incorrectly.

- [ ] **Step 2: Run test and verify failure**

Run: `npx vitest run server/controller/hr-leave-calendar.test.ts`
Expected: FAIL because snapshot fields are absent.

- [ ] **Step 3: Implement approval-time snapshot**

Add optional schema fields and calculate them immediately before the pending-to-approved update. Do not recalculate already-approved records during unrelated edits.

- [ ] **Step 4: Run all feature tests**

Run: `npx vitest run server/service/vietnam-holiday-provider.test.ts server/service/company-work-calendar.service.test.ts server/controller/company-work-calendar.controller.test.ts server/router/timekeeping.work-calendar.test.ts server/controller/timekeeping.calendar.test.ts server/service/workflow-link.calendar.test.ts server/controller/hr-leave-calendar.test.ts src/pages/dashboard-work-calendar.test.tsx src/components/settings/CompanyWorkCalendarTab.test.tsx src/components/hr/calendar-holiday-overlay.test.tsx`
Expected: PASS with zero failed tests.

- [ ] **Step 5: Run repository verification**

Run: `yarn typecheck && yarn build`
Expected: both commands exit 0.

- [ ] **Step 6: Inspect final diff and commit**

Run: `git diff --check && git status --short`
Expected: no whitespace errors and only intended files.

```bash
git add server/interface/hr-leave.interface.ts server/model/hr-leave-application.model.ts server/controller/crud.controller.ts server/controller/hr-leave-calendar.test.ts
git commit -m "feat: snapshot holiday-aware leave days"
```
