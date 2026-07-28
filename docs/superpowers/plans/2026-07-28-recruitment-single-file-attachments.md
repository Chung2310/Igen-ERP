# Recruitment Single-File Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one private PDF/DOC/DOCX JD file per recruitment job and one private CV per applicant, including upload during create/edit flows.

**Architecture:** Generalize recruitment attachment ownership to `ownerType + ownerId` and enforce one active attachment using a partial unique index. Reuse the existing authenticated Cloudinary raw-file integration and expose owner-specific routes backed by one scoped service.

**Tech Stack:** TypeScript, Express, Mongoose, Multer, Cloudinary, React 19, Vitest, Testing Library.

## Global Constraints

- Every attachment query requires `companyCode + branchId` from authenticated context.
- Exactly one active attachment is allowed per JD or applicant.
- Only PDF, DOC, and DOCX files up to 10 MB are accepted.
- No public storage URL is persisted.
- New upload completes before old asset deletion.
- Use TDD for each behavior change.

---

### Task 1: Shared Single-File Attachment Model And Service

**Files:**
- Modify: `server/model/recruitment-attachment.model.ts`
- Modify: `server/model/recruitment-models.test.ts`
- Modify: `server/service/recruitment-attachment.service.ts`
- Modify: `server/service/recruitment-attachment.service.test.ts`

**Interfaces:**
- Produces `getOwnerAttachment(scope, ownerType, ownerId)`, `uploadOwnerAttachment(scope, actorId, ownerType, ownerId, file, version?)`, and existing scoped download/delete operations.

- [ ] Write failing schema tests requiring `ownerType`, `ownerId`, and the partial unique active-owner index.
- [ ] Write failing service tests proving both owner types are scope-validated and a successful replacement deletes the previous private asset only after new metadata is durable.
- [ ] Run `npx vitest run server/model/recruitment-models.test.ts server/service/recruitment-attachment.service.test.ts`; expect ownership/replacement assertions to fail.
- [ ] Replace `applicantId` with the following ownership fields and index:

```ts
ownerType: { type: String, enum: ["job", "applicant"], required: true },
ownerId: { type: Schema.Types.ObjectId, required: true },
RecruitmentAttachmentSchema.index(
  { companyCode: 1, branchId: 1, ownerType: 1, ownerId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
```

- [ ] Implement one shared owner validator using `RecruitmentJobModel` or `RecruitmentApplicantModel`, upload the new raw asset first, version-check the old metadata, persist the replacement, then delete the captured old storage key.
- [ ] Keep compatibility exports for applicant callers while routing them through `ownerType: "applicant"`.
- [ ] Run focused tests and `git diff --check`; expect all passing.
- [ ] Commit `feat: support single private files for recruitment owners`.

### Task 2: Owner-Specific Attachment API

**Files:**
- Modify: `server/controller/recruitment.controller.ts`
- Modify: `server/router/recruitment.router.ts`
- Modify: `server/router/recruitment.router.test.ts`
- Modify: `src/services/recruitmentService.ts`
- Modify: `src/types/recruitment.ts`

**Interfaces:**
- Produces `GET/POST /jobs/:jobId/attachment`, `GET/POST /applicants/:applicantId/attachment`, and existing authenticated attachment download/delete routes.

- [ ] Write failing router tests proving both owner routes exist behind the existing auth/module/permission/scope stack.
- [ ] Run `npx vitest run server/router/recruitment.router.test.ts`; expect missing route assertions.
- [ ] Add thin controller handlers that derive owner type from the route and never accept it from request bodies.
- [ ] Configure both POST routes with the existing 10 MB memory upload middleware and multipart field `file`.
- [ ] Replace client list/upload methods with typed `getJobAttachment`, `uploadJobAttachment`, `getApplicantAttachment`, and `uploadApplicantAttachment` methods.
- [ ] Run router tests and typecheck; expect passing.
- [ ] Commit `feat: expose JD and CV attachment endpoints`.

### Task 3: JD And Applicant File Fields

**Files:**
- Modify: `src/components/hr/recruitment/RecruitmentJobsView.tsx`
- Modify: `src/components/hr/recruitment/RecruitmentApplicantsView.tsx`
- Modify: `src/components/hr/recruitment/ApplicantDetailPanel.tsx`
- Modify: `src/components/hr/recruitment/RecruitmentTab.test.tsx`

**Interfaces:**
- Consumes the Task 2 typed client and uploads only after the owner record exists.

- [ ] Write failing UI tests selecting a JD PDF and applicant DOCX, asserting record creation occurs before attachment upload.
- [ ] Run `npx vitest run src/components/hr/recruitment/RecruitmentTab.test.tsx`; expect missing file controls or upload calls.
- [ ] Add optional `File JD` and `CV` file inputs with `accept=".pdf,.doc,.docx"`, client size/extension validation, selected-file name, and replace controls.
- [ ] After successful create/update, upload the selected file using the returned owner ID; on upload failure preserve the saved record and show a retry-specific message.
- [ ] Display the active JD file and CV with download, replace, and delete controls.
- [ ] Run UI tests, all recruitment tests, `npm run typecheck`, and `npm run build`.
- [ ] Commit `feat: add JD and CV file fields` and push `feat/branch-isolated-recruitment`.
