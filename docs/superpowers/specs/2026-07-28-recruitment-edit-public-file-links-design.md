# Recruitment Editing And Public File Links Design

## Goal

Complete the recruitment administration workflow by adding explicit edit actions for jobs and applicants, uploading JD/CV files to public Cloudinary storage immediately after file selection, filling the returned URL into the form, and presenting recruitment stages and statuses in Vietnamese.

## Scope

- Add clear edit controls for recruitment jobs and applicants.
- Reuse the job form for create and edit, and reuse the applicant form for create and edit.
- Add `jdFileUrl`/`jdFilePublicId` to jobs and `cvUrl`/`cvPublicId` to applicants.
- Upload one PDF, DOC, or DOCX file up to 10 MB immediately when selected.
- Return the Cloudinary `secure_url` and public ID from an authenticated recruitment upload endpoint.
- Translate default pipeline stages already stored in English and create all new defaults in Vietnamese.
- Display all job statuses and applicant outcomes in Vietnamese while preserving stable English enum values internally.

The existing private attachment records and endpoints remain readable for compatibility, but the create/edit forms use the new public URL fields. No cross-branch file or record access is allowed.

## Architecture

### Public Upload API

Add an authenticated, recruitment-permission-protected multipart endpoint for temporary public uploads. The server validates extension, MIME type, and size, then uploads the raw file into a company-and-branch-specific Cloudinary folder. The response contains:

```ts
{
  url: string;
  publicId: string;
  originalName: string;
  size: number;
}
```

The browser never receives Cloudinary credentials and never uses unsigned upload presets. Cloudinary service support returns both `secure_url` and `public_id` and can delete public raw assets by public ID.

### Record Storage

Recruitment jobs store `jdFileUrl` and `jdFilePublicId`. Applicants store `cvUrl` and `cvPublicId`. URLs are editable text inputs so an administrator can paste an external public URL; in that case the public ID is cleared because the asset is not owned by this application.

Create and update services continue enforcing `companyCode + branchId`. File metadata fields cannot be used to address another record or branch.

### Upload Lifecycle

Selecting a file starts upload immediately. During upload, form submission and repeated selection are disabled. On success, the returned URL is placed into `Link JD` or `Link CV` and the public ID is held in form state. On failure, the existing URL remains unchanged and a Vietnamese error is shown.

When a saved record replaces an application-owned file, the record update succeeds first and the previous Cloudinary asset is deleted afterward. A deletion failure is logged and does not roll back the saved URL. If a newly uploaded file is abandoned by closing the form before save, the client calls a scoped cleanup endpoint on a best-effort basis. Cleanup is limited to public IDs under the authenticated company/branch recruitment folder.

## Editing Workflows

### Job

Each job row exposes an edit icon with a tooltip. Opening it loads all current fields and the JD link. Saving uses the existing optimistic `version` update API. Status options are displayed as `Nháp`, `Đang tuyển`, `Tạm dừng`, and `Đã đóng` while stored values remain `draft`, `open`, `paused`, and `closed`.

### Applicant

Each applicant row and applicant detail panel expose an edit action. The create and edit form share the same fields. Edit uses the existing optimistic `version` update API and does not directly modify `stageId` or `outcome`; stage movement remains the dedicated transition workflow. The CV URL and uploaded public ID are included in normal applicant updates.

Applicant outcomes are displayed as `Đang xử lý`, `Đã tuyển`, `Từ chối`, and `Đã rút hồ sơ` while stored enum values remain stable.

## Vietnamese Pipeline Migration

New default stages are:

| Stable ID | Vietnamese name |
| --- | --- |
| `new` | Hồ sơ mới |
| `screening` | Sàng lọc |
| `interview` | Phỏng vấn |
| `offer` | Đề nghị nhận việc |
| `hired` | Đã tuyển |
| `rejected` | Từ chối |

When a pipeline is read, only known default English names associated with these stable IDs are translated. Custom names are preserved. If translation changes a pipeline, the service persists the translated stages and increments the pipeline version atomically before returning it.

## Error Handling

- Reject unsupported or oversized files before Cloudinary upload.
- Keep the prior form URL when upload fails.
- Show version-conflict messages and reload the affected list after concurrent edits.
- Do not delete the previous public asset until the record points at the replacement.
- Reject cleanup requests for public IDs outside the authenticated recruitment folder.

## Testing

- Cloudinary service tests cover public raw upload metadata and deletion.
- Router/controller tests cover authentication, permissions, multipart upload, and cleanup routing.
- Model/service tests cover new URL fields, branch-scoped edits, and safe replacement cleanup.
- Pipeline tests cover Vietnamese defaults, migration of known English defaults, preservation of custom names, and version increments.
- UI tests cover immediate upload and URL fill, job editing, applicant editing, Vietnamese status/outcome labels, and upload error behavior.
- Final verification runs focused recruitment tests, typecheck, production build, and `git diff --check`.
