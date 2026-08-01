# Recruitment Editing And Public File Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable jobs/applicants, immediate public Cloudinary JD/CV upload with URL fields, and fully Vietnamese recruitment labels and default stages.

**Architecture:** Add one branch-scoped temporary public upload API that returns Cloudinary URL metadata, then persist URL/public-ID pairs on the owning job or applicant through existing optimistic update services. Keep stable English enum values internally while translating presentation labels and migrating only known default pipeline names.

**Tech Stack:** TypeScript, Express, Mongoose, Multer, Cloudinary, React 19, Vitest, Testing Library.

## Global Constraints

- Every record mutation and cleanup operation requires authenticated `companyCode + branchId` scope.
- Only PDF, DOC, and DOCX files up to 10 MB are accepted.
- Upload uses server-held Cloudinary credentials and returns public `secure_url` plus `public_id`.
- Stable enum values and stable pipeline IDs remain English; user-visible labels are Vietnamese.
- Old application-owned assets are deleted only after the record points to the replacement.
- Use TDD for every behavior change.

---

### Task 1: Public Recruitment File Upload And Persisted URL Fields

**Files:**
- Modify: `server/service/cloudinary.service.ts`
- Modify: `server/service/recruitment-attachment.service.ts`
- Modify: `server/service/recruitment-attachment.service.test.ts`
- Modify: `server/model/recruitment-job.model.ts`
- Modify: `server/model/recruitment-applicant.model.ts`
- Modify: `server/model/recruitment-models.test.ts`
- Modify: `server/router/recruitment.router.ts`
- Modify: `server/router/recruitment.router.test.ts`
- Modify: `server/controller/recruitment.controller.ts`
- Modify: `src/services/recruitmentService.ts`
- Modify: `src/types/recruitment.ts`

**Interfaces:**
- Produces `uploadPublicRecruitmentFile(scope, file)` returning `{ url, publicId, originalName, size }`.
- Produces `deleteTemporaryPublicRecruitmentFile(scope, publicId)` restricted to the branch recruitment folder.
- Produces client methods `uploadPublicFile(file)` and `deleteTemporaryPublicFile(publicId)`.

- [ ] Write schema tests requiring `jdFileUrl`, `jdFilePublicId`, `cvUrl`, and `cvPublicId`, all defaulting to empty strings.
- [ ] Write service tests proving public upload validates file type/size, uses folder `igen_erp/recruitment/<company>/<branch>`, returns URL/public ID, and rejects cleanup outside that folder.
- [ ] Write router tests requiring authenticated permission-protected `POST /files/public` and `DELETE /files/public` routes.
- [ ] Run `npx vitest run server/model/recruitment-models.test.ts server/service/recruitment-attachment.service.test.ts server/router/recruitment.router.test.ts`; expect missing fields/functions/routes.
- [ ] Add Cloudinary methods with exact metadata:

```ts
type PublicRawAsset = { publicId: string; secureUrl: string; bytes: number };
uploadPublicRaw(buffer: Buffer, folder: string, filename: string): Promise<PublicRawAsset>;
deletePublicRaw(publicId: string): Promise<void>;
```

- [ ] Add URL/public-ID fields to both owner schemas and expose them in frontend types.
- [ ] Add scoped service, controller, router, and typed client methods; reuse the existing 10 MB memory upload middleware.
- [ ] Run focused tests, `npm run typecheck`, and `git diff --check`; expect pass.
- [ ] Commit `feat: add public recruitment file uploads`.

### Task 2: Safe URL Replacement In Job And Applicant Services

**Files:**
- Modify: `server/service/recruitment-job.service.ts`
- Modify: `server/service/recruitment-job.service.test.ts`
- Modify: `server/service/recruitment-applicant.service.ts`
- Modify: `server/service/recruitment-applicant.service.test.ts`

**Interfaces:**
- Consumes `cloudinaryService.deletePublicRaw(publicId)`.
- Existing `updateJob` and `updateApplicant` accept URL/public-ID pairs and delete a replaced owned asset after durable update.

- [ ] Write failing job and applicant service tests with existing public IDs, asserting scoped/versioned update happens before old asset deletion.
- [ ] Add tests proving manually changing a URL clears its public ID and never deletes an external URL.
- [ ] Run `npx vitest run server/service/recruitment-job.service.test.ts server/service/recruitment-applicant.service.test.ts`; expect missing cleanup behavior.
- [ ] Normalize each pair so `publicId` is retained only when it accompanies the uploaded URL, capture the previous public ID, update with optimistic version matching, then best-effort delete the previous asset.
- [ ] Run focused tests and `git diff --check`; expect pass.
- [ ] Commit `feat: persist recruitment document links safely`.

### Task 3: Vietnamese Pipeline Defaults And Status Labels

**Files:**
- Modify: `server/service/recruitment-pipeline.service.ts`
- Modify: `server/service/recruitment-pipeline.service.test.ts`
- Create: `src/components/hr/recruitment/recruitmentLabels.ts`
- Create: `src/components/hr/recruitment/recruitmentLabels.test.ts`
- Modify: `src/components/hr/recruitment/RecruitmentJobsView.tsx`
- Modify: `src/components/hr/recruitment/RecruitmentApplicantsView.tsx`

**Interfaces:**
- Produces `jobStatusLabels` and `applicantOutcomeLabels` keyed by stable enum values.
- `getOrCreatePipeline` returns Vietnamese default names and atomically migrates known English default names by stable ID.

- [ ] Write failing pipeline tests expecting `Hồ sơ mới`, `Sàng lọc`, `Phỏng vấn`, `Đề nghị nhận việc`, `Đã tuyển`, and `Từ chối`.
- [ ] Add a migration test where known default English names change but a custom stage name remains untouched and version increments.
- [ ] Write label tests requiring all job status and applicant outcome values to have Vietnamese labels.
- [ ] Run the two test files; expect English defaults and missing label module failures.
- [ ] Implement ID-and-name guarded migration and shared label maps; replace raw `outcome` rendering and local status labels.
- [ ] Run focused tests and typecheck; expect pass.
- [ ] Commit `feat: localize recruitment stages and statuses`.

### Task 4: Immediate Upload And Explicit Job/Applicant Editing

**Files:**
- Modify: `src/components/hr/recruitment/RecruitmentJobsView.tsx`
- Modify: `src/components/hr/recruitment/RecruitmentApplicantsView.tsx`
- Modify: `src/components/hr/recruitment/ApplicantDetailPanel.tsx`
- Modify: `src/components/hr/recruitment/RecruitmentTab.test.tsx`
- Modify: `src/components/hr/recruitment/recruitmentFile.ts`

**Interfaces:**
- Consumes `recruitmentApi.uploadPublicFile`, `deleteTemporaryPublicFile`, `updateJob`, and `updateApplicant`.
- Job form exposes `Link JD`; applicant form exposes `Link CV` and supports both create and edit modes.

- [ ] Add failing UI tests selecting files and asserting `uploadPublicFile` runs immediately before submit and returned URLs populate `Link JD`/`Link CV`.
- [ ] Add failing tests clicking explicit `Sửa tin tuyển dụng` and `Sửa ứng viên` buttons, changing fields, and asserting versioned update calls.
- [ ] Add failing tests for Vietnamese status/outcome rendering and disabled save during upload.
- [ ] Run `npx vitest run src/components/hr/recruitment/RecruitmentTab.test.tsx`; expect missing methods, inputs, and edit controls.
- [ ] Refactor file selection to validate then immediately upload, display progress/error, and populate URL/public-ID form state.
- [ ] Add edit icon buttons with Lucide `Pencil`, tooltips, and shared create/edit applicant form initialization.
- [ ] On close before save, call temporary cleanup for newly uploaded application-owned public IDs; after save, preserve them.
- [ ] Keep stage transitions separate from applicant field editing and refresh lists after successful saves.
- [ ] Run UI tests; expect pass.
- [ ] Commit `feat: edit recruitment records with instant uploads`.

### Task 5: Final Verification And Push

**Files:**
- Verify all files changed in Tasks 1-4.

- [ ] Run all recruitment tests:

```powershell
npx vitest run server/model/recruitment-models.test.ts server/service/recruitment-attachment.service.test.ts server/service/recruitment-job.service.test.ts server/service/recruitment-applicant.service.test.ts server/service/recruitment-pipeline.service.test.ts server/router/recruitment.router.test.ts src/components/hr/recruitment/recruitmentFile.test.ts src/components/hr/recruitment/recruitmentLabels.test.ts src/components/hr/recruitment/RecruitmentTab.test.tsx --pool=threads --maxWorkers=1
```

- [ ] Run `npm run typecheck`, `npm run build`, and `git diff --check`; expect exit code 0.
- [ ] Review `git diff origin/develop...HEAD` for branch-scope enforcement, public-ID cleanup ordering, and Vietnamese user-visible copy.
- [ ] Push `feat/branch-isolated-recruitment` without merging into `develop`.
