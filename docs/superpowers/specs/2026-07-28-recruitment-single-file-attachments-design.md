# Recruitment Single-File Attachments Design

## Goal

Allow an authorized recruitment user to attach one private JD document to each recruitment job and one private CV to each applicant. Supported formats are PDF, DOC, and DOCX up to 10 MB.

## Data Model

Replace the applicant-only attachment ownership with a shared recruitment attachment owner:

- required `companyCode` and `branchId`;
- `ownerType`: `job` or `applicant`;
- `ownerId`: the scoped job or applicant ID;
- original and storage names, MIME type, byte size, private storage key, uploader, timestamps, version, and soft-delete metadata.

A partial unique index on `companyCode + branchId + ownerType + ownerId` where `isDeleted: false` guarantees at most one active file per owner. Existing applicant attachment behavior is migrated to `ownerType: applicant` before this branch is released.

## Security And Storage

- Every upload, metadata read, download, replacement, and deletion resolves scope from authenticated context.
- Owner references must exist inside the same `companyCode + branchId` scope.
- Files use Cloudinary `raw/authenticated` storage.
- The database never stores a public or reusable delivery URL.
- Download returns a short-lived signed URL only after authorization and scope validation.
- File names are sanitized and the extension must match the accepted MIME type.

## Replacement Flow

Upload the new file first. After successful upload, replace the active metadata record using an optimistic version check and mark the prior asset for deletion. Delete the old Cloudinary asset only after the new metadata is durable.

If the new upload fails, the old attachment remains active. If old-asset cleanup fails after replacement, report and retry cleanup without rolling back the valid new attachment. Concurrent replacements return a conflict and the newly uploaded but unreferenced asset is cleaned up.

## API

Use owner-specific authenticated endpoints while sharing one attachment service:

- `GET/POST /recruitment/jobs/:jobId/attachment`
- `GET/POST /recruitment/applicants/:applicantId/attachment`
- `GET /recruitment/attachments/:id/download`
- `DELETE /recruitment/attachments/:id`

Upload uses multipart field `file`. POST creates or replaces the owner's single attachment. Client bodies cannot provide company, branch, owner type, storage key, or public URL.

## User Experience

- The create/edit JD dialog includes an optional `File JD` picker.
- The create/edit applicant dialog includes an optional `CV` picker.
- Creation saves the JD/applicant first and then uploads its selected file.
- If record creation succeeds but file upload fails, keep the record and show a specific retry message.
- Job rows/details and applicant details show the active file name, size, download, replace, and delete controls.
- Accepted formats and the 10 MB limit are enforced before the upload request and again on the server.

## Testing

Backend tests cover owner scope, one-active-file uniqueness, MIME/extension and size validation, replacement ordering, version conflicts, old-asset cleanup, and cross-branch denial for both owner types.

Frontend tests cover selecting a JD file and CV during creation, upload-after-create sequencing, replacement, download, file validation, partial-success messaging, and state reset after a branch change.

## Out Of Scope

- Multiple files per JD or applicant.
- Public file links.
- File content parsing, OCR, or CV ranking.
- Emailing attachments or exposing them outside the internal ERP.
