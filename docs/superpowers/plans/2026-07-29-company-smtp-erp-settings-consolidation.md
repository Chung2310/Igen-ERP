# Company SMTP and ERP Settings Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Student/Worker Management's standalone Settings tab, relocate its company configuration into global ERP Configuration, and make `Company.smtpConfig` the only application SMTP source.

**Architecture:** Extract the non-SMTP student/worker settings into an admin-only global component composed by `ErpConfigTab`, and embed the existing company SMTP editor there. Backend email consumers resolve credentials through `companyEmailService`; legacy per-user SMTP storage remains dormant but is no longer exposed or used.

**Tech Stack:** React 19, TypeScript, Express, Mongoose, Vitest.

## Global Constraints

- Only `admin` may view or mutate company SMTP and student/worker company configuration.
- `Company.smtpConfig` is the only active application SMTP source.
- Legacy SMTP fields remain in stored user documents but are not read or written.
- Existing module-settings storage and entity-preset cache behavior remain authoritative.
- Existing environment SMTP fallback remains unchanged.

---

### Task 1: Remove the module Settings route

**Files:**
- Modify: `src/modules/student-management/StudentManagementTab.tsx`
- Test: `src/modules/student-management/settings-relocation.test.ts`

**Interfaces:**
- Consumes: existing student-management sub-tab router.
- Produces: navigation without `CÀI ĐẶT` or `cai-dat`.

- [ ] Write a failing source regression test asserting `StudentManagementTab` does not import/render `SettingsPage` and does not register `cai-dat`.
- [ ] Run `npx vitest run src/modules/student-management/settings-relocation.test.ts`; expect failure on the existing route.
- [ ] Remove the lazy import, navigation item, icon import, and switch case for the settings page.
- [ ] Re-run the focused test; expect all assertions to pass.

### Task 2: Relocate student/worker settings into ERP Configuration

**Files:**
- Create: `src/components/settings/StudentManagementErpSettings.tsx`
- Modify: `src/components/settings/ErpConfigTab.tsx`
- Modify: `src/pages/SettingsTab.tsx`
- Remove: `src/modules/student-management/pages/Settings/SettingsPage.tsx`
- Test: `src/components/settings/erp-company-settings.test.ts`

**Interfaces:**
- Consumes: `moduleSettingsApi`, entity-preset cache invalidation, `CompanySmtpSettingsTab`, and `useAuth().userProfile.role`.
- Produces: admin-only `companyModules` ERP sub-section containing student/worker configuration and SMTP.

- [ ] Write failing assertions that ERP Configuration composes both company-setting components only behind `userProfile?.role === "admin"`, while `SettingsTab` no longer exposes a standalone SMTP sub-tab.
- [ ] Run the focused test and verify the current structure fails.
- [ ] Extract only the entity/form settings state, loading, save handlers, and UI from `SettingsPage` into `StudentManagementErpSettings`.
- [ ] Add an admin-only internal ERP tab that renders `StudentManagementErpSettings` and `CompanySmtpSettingsTab`; remove the global standalone SMTP sub-tab registration.
- [ ] Delete the obsolete module settings page after imports are removed.
- [ ] Re-run the focused test and entity-preset tests; expect them to pass.

### Task 3: Eliminate legacy SMTP writes and request credentials

**Files:**
- Modify: `server/modules/student-management/routes/auth.routes.ts`
- Modify: `server/modules/student-management/routes/index.ts`
- Modify: `server/modules/student-management/controllers/auth.controller.ts`
- Modify: `server/modules/student-management/services/auth.service.ts`
- Modify: `server/modules/student-management/validations/auth.validation.ts`
- Test: `server/modules/student-management/services/company-smtp-only.test.ts`

**Interfaces:**
- Consumes: authenticated company code and `companyEmailService.resolveLegacySettings(companyCode)`.
- Produces: `/send-email` that ignores request/user SMTP credentials and no `/auth/smtp-settings` route.

- [ ] Write a failing regression test proving the legacy route is absent and `/send-email` does not accept or query per-user SMTP credentials.
- [ ] Run the focused test and verify it fails against the existing route/body fallback.
- [ ] Remove the route/controller/service/validation write path and reduce `/send-email` SMTP resolution to the authenticated company's configuration.
- [ ] Re-run the focused test and verify it passes.

### Task 4: Migrate email consumers to company SMTP only

**Files:**
- Modify: `server/modules/student-management/services/batch.service.ts`
- Modify: `server/modules/student-management/services/assignment.service.ts`
- Modify: `server/modules/student-management/services/student-online-attendance.service.ts`
- Test: `server/modules/student-management/services/company-smtp-consumers.test.ts`

**Interfaces:**
- Consumes: a company code derived from the actor/owner and `companyEmailService.resolveLegacySettings`.
- Produces: email flows with no fallback selection of `smtpHost smtpUser smtpPass` from `User`.

- [ ] Write failing source/service assertions covering batch, assignment, and online-attendance resolvers.
- [ ] Run the focused test and verify legacy fallback assertions fail.
- [ ] Retain only the minimal user lookup needed to derive `companyCode`, then call the company email service; remove user/admin SMTP-field fallback queries.
- [ ] Re-run focused and existing assignment/batch tests; expect them to pass.

### Task 5: Verify and deliver

**Files:**
- Verify all changed source, documentation, and test files.

**Interfaces:**
- Produces: a tested commit on `fix/student-branch-scope-v3` ready for the existing remote workflow.

- [ ] Run all new tests plus entity-preset, batch, assignment, and company-email route tests.
- [ ] Run TypeScript with the workspace dependency path.
- [ ] Run frontend and server production builds.
- [ ] Run `git diff --check` and review the complete diff.
- [ ] Commit the implementation and push `fix/student-branch-scope-v3` as previously authorized.
