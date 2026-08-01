# Company SMTP and ERP Settings Consolidation Design

## Goal

Remove the standalone Settings area from the Student/Worker Management module and consolidate its company-level configuration into System Settings → ERP Configuration. Use one company SMTP configuration for every student-management email flow.

## Scope

This change covers:

- Removing the `CÀI ĐẶT` navigation item, `cai-dat` sub-route, and standalone settings page from Student/Worker Management.
- Moving the current entity preset, labels, and student/worker form configuration into the existing global ERP Configuration area.
- Keeping the existing company SMTP editor backed by `Company.smtpConfig`, but presenting it within ERP Configuration instead of as a separate settings sub-tab.
- Restricting both company SMTP and student/worker ERP configuration to users with the `admin` role.
- Migrating all student-management email consumers to resolve SMTP only from the authenticated company configuration.

This change does not delete legacy SMTP fields from stored user documents. Removing those fields requires a separate database migration and is outside this scope.

## User Experience

### Student/Worker Management

The module no longer displays a Settings tab. Existing operational tabs continue to work unchanged. A direct URL targeting the removed `cai-dat` slug falls back to the module's default valid tab through the existing sub-tab router behavior.

### System Settings

The existing ERP Configuration screen gains two admin-only sections:

1. Student/Worker configuration: entity preset, display terminology, and configurable form settings currently managed by the module settings page.
2. Company email: the existing `CompanySmtpSettingsTab` controls for host, port, TLS, account, sender identity, password, connection verification, and test email.

Non-admin users can continue using the other System Settings sections permitted to them, but do not see or mount either company configuration section. Deep links cannot bypass this UI restriction, and backend routes remain authoritative.

## Data Ownership

### Student/Worker configuration

Existing module-settings APIs and storage remain authoritative. The UI is relocated, not duplicated, and continues using the current entity-preset cache invalidation behavior so operational pages reflect saved changes.

### SMTP configuration

`Company.smtpConfig` is the only active application-level SMTP source. The `/api/company-email/smtp` endpoints remain responsible for reading, saving, verifying, and testing the configuration. SMTP passwords remain encrypted and are never returned to the browser.

The legacy `/student-management/auth/smtp-settings` write endpoint and the SMTP editor in `SettingsPage` are removed. Legacy SMTP fields on `User` remain dormant for backward-compatible schema reads but are no longer written or used as fallback credentials.

## Email Resolution Flow

Student-management email consumers resolve the sender in this order:

1. Determine the company code from the authenticated actor or record owner using the existing ownership rules.
2. Call `companyEmailService.resolveLegacySettings(companyCode)` to adapt `Company.smtpConfig` to the current `EmailService` settings interface.
3. If the company has no SMTP configuration, allow `EmailService` to apply the existing environment fallback or return its existing configuration-missing error.

The following flows must use this path without reading SMTP fields from a user document:

- Batch/class instructor assignment emails.
- General student/worker assignment emails.
- Online attendance emails.
- Notification and SMTP readiness checks in Student/Worker Management.

Request bodies cannot supply arbitrary SMTP credentials for normal email sending. Connection testing and saving occur only through the admin-only company-email endpoints.

## Authorization and Error Handling

- Only `admin` may read, save, verify, or test company SMTP.
- Only `admin` may view or change student/worker company configuration inside ERP Configuration.
- Backend authorization returns `403` for non-admin callers even if they manually invoke an endpoint.
- Missing company SMTP uses the existing user-facing configuration error rather than exposing credential details.
- Failed verification, saving, and test-email operations preserve the current form values and display the normalized API error.

## Component Boundaries

- `SettingsTab` continues to own global settings navigation and admin visibility.
- `ErpConfigTab` composes the company-level student/worker configuration and SMTP sections.
- A focused student/worker configuration component is extracted from the current module `SettingsPage`; it owns only that form and its module-settings API interactions.
- `CompanySmtpSettingsTab` remains the single SMTP editor and is embedded by `ErpConfigTab`.
- Student-management services receive company SMTP through `companyEmailService`; they do not own credential lookup logic.

## Compatibility

- Existing `Company.smtpConfig` records continue working without migration.
- Existing student/worker settings remain in their current storage and retain their current semantics.
- Legacy user SMTP values are ignored after deployment but retained in the schema and database.
- Existing environment SMTP fallback remains available when company SMTP is not configured, matching current `EmailService` behavior.

## Testing

Automated regression coverage must prove:

- Student/Worker Management no longer registers or renders the Settings tab or `cai-dat` route.
- ERP Configuration renders the relocated student/worker settings and SMTP sections for `admin` only.
- Non-admin users cannot mount company configuration through UI state or deep links.
- Company SMTP API routes continue rejecting non-admin callers.
- Batch, assignment, attendance, and notification email paths resolve company SMTP and do not query legacy user SMTP fields.
- Entity-preset updates still refresh Student/Worker Management labels and behavior.
- TypeScript checks and the production client/server builds pass.
