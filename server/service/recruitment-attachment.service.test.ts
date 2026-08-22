import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentAttachmentModel } from "../model/recruitment-attachment.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import { cloudinaryService } from "./cloudinary.service";
import { resourceIndexingService } from "./resource-indexing.service";
import { deleteApplicantAttachment, deleteTemporaryPublicRecruitmentFile, downloadApplicantAttachment, uploadApplicantAttachment, uploadOwnerAttachment, uploadPublicRecruitmentFile } from "./recruitment-attachment.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
describe("recruitment attachment service", () => {
  afterEach(() => vi.restoreAllMocks());
  it("rejects unsupported and oversized files", async () => {
    await expect(uploadApplicantAttachment(scope, "actor", "app", { originalname: "cv.exe", mimetype: "application/octet-stream", size: 1, buffer: Buffer.from("x") } as any)).rejects.toThrow("Unsupported attachment");
    await expect(uploadApplicantAttachment(scope, "actor", "app", { originalname: "cv.pdf", mimetype: "application/pdf", size: 11 * 1024 * 1024, buffer: Buffer.from("x") } as any)).rejects.toThrow("Attachment is too large");
  });
  it("uploads private metadata without a public URL and scopes downloads", async () => {
    vi.spyOn(RecruitmentApplicantModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "app", fullName: "Nguyen Van A" }) } as any);
    vi.spyOn(RecruitmentAttachmentModel, "findOne").mockReturnValueOnce({ lean: async () => null } as any);
    vi.spyOn(cloudinaryService, "uploadPrivateRaw").mockResolvedValue({ publicId: "recruitment/acme/a/key", resourceType: "raw", type: "authenticated", format: "pdf", bytes: 10 });
    const create = vi.spyOn(RecruitmentAttachmentModel, "create").mockImplementation(async (value: any) => ({ _id: "attachment", ...value }) as any);
    const index = vi.spyOn(resourceIndexingService, "registerUploadedResource").mockResolvedValue({ _id: "resource", type: "file", name: "CV A.pdf", parentId: "folder", companyCode: "ACME" });
    const uploaded: any = await uploadApplicantAttachment(scope, "actor", "app", { originalname: "../CV A.pdf", mimetype: "application/pdf", size: 10, buffer: Buffer.from("pdf") } as any);
    expect(uploaded.url).toBeUndefined();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ ...scope, ownerType: "applicant", ownerId: "app", storageKey: "recruitment/acme/a/key" }));
    expect(index).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "hr.recruitment.applicant",
      entityId: "app",
      entityLabel: "Nguyen Van A",
      sourceRecordId: "attachment",
      sourceKey: "hr.recruitment.applicant:attachment:file:recruitment/acme/a/key",
      storagePublicId: "recruitment/acme/a/key",
      storageResourceType: "raw",
      storageAccess: "authenticated",
    }));
    vi.spyOn(RecruitmentAttachmentModel, "findOne").mockReturnValue({ lean: async () => ({ storageKey: "key", originalName: "cv.pdf", mimeType: "application/pdf" }) } as any);
    vi.spyOn(cloudinaryService, "createSignedRawUrl").mockReturnValue("signed");
    await expect(downloadApplicantAttachment(scope, "attachment")).resolves.toEqual(expect.objectContaining({ signedUrl: "signed" }));
    expect(RecruitmentAttachmentModel.findOne).toHaveBeenCalledWith({ _id: "attachment", ...scope, isDeleted: false });
  });
  it("replaces a scoped JD resource while retaining the previous asset for trash retention", async () => {
    vi.spyOn(RecruitmentJobModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "job", code: "JOB-01", title: "Accountant" }) } as any);
    vi.spyOn(RecruitmentAttachmentModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "attachment", version: 3, storageKey: "old-key" }) } as any);
    vi.spyOn(cloudinaryService, "uploadPrivateRaw").mockResolvedValue({ publicId: "new-key", resourceType: "raw", type: "authenticated", format: "pdf", bytes: 10 });
    const update = vi.spyOn(RecruitmentAttachmentModel, "findOneAndUpdate").mockResolvedValue({ _id: "attachment", storageKey: "new-key" } as any);
    const remove = vi.spyOn(cloudinaryService, "deleteRawAsset").mockResolvedValue();
    const replace = vi.spyOn(resourceIndexingService, "replaceSourceResource").mockResolvedValue({ _id: "resource", type: "file", name: "jd.pdf", parentId: "folder", companyCode: "ACME" });
    await uploadOwnerAttachment(scope, "actor", "job", "job", { originalname: "jd.pdf", mimetype: "application/pdf", size: 10, buffer: Buffer.from("pdf") } as any, 3);
    expect(update).toHaveBeenCalledWith(
      { _id: "attachment", ...scope, ownerType: "job", ownerId: "job", isDeleted: false, version: 3 },
      expect.objectContaining({ $set: expect.objectContaining({ storageKey: "new-key" }), $inc: { version: 1 } }),
      { returnDocument: 'after', runValidators: true },
    );
    expect(replace).toHaveBeenCalledWith(
      "ACME",
      "hr.recruitment.job:attachment:file:old-key",
      expect.objectContaining({
        sourceType: "hr.recruitment.job",
        entityLabel: "JOB-01 - Accountant",
        sourceKey: "hr.recruitment.job:attachment:file:new-key",
        storageAccess: "authenticated",
      }),
    );
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
    expect(remove).not.toHaveBeenCalledWith("old-key");
  });
  it("soft deletes the attachment and moves its indexed resource to trash without deleting storage", async () => {
    vi.spyOn(RecruitmentAttachmentModel, "findOneAndUpdate").mockResolvedValue({ _id: "attachment", ownerType: "applicant", storageKey: "private-key" } as any);
    const trash = vi.spyOn(resourceIndexingService, "trashSourceResource").mockResolvedValue(null);
    const remove = vi.spyOn(cloudinaryService, "deleteRawAsset").mockResolvedValue();

    await deleteApplicantAttachment(scope, "attachment", "actor");

    expect(trash).toHaveBeenCalledWith("ACME", "hr.recruitment.applicant:attachment:file:private-key", expect.any(Date));
    expect(remove).not.toHaveBeenCalled();
  });
  it("uploads and cleans up public files only inside the scoped recruitment folder", async () => {
    vi.spyOn(cloudinaryService, "uploadPublicRaw").mockResolvedValue({ publicId: "igen_erp/recruitment/acme/branch-a/file", secureUrl: "https://cloudinary.test/file.pdf", bytes: 10 });
    await expect(uploadPublicRecruitmentFile(scope, { originalname: "jd.pdf", mimetype: "application/pdf", size: 10, buffer: Buffer.from("pdf") } as any)).resolves.toEqual({ url: "https://cloudinary.test/file.pdf", publicId: "igen_erp/recruitment/acme/branch-a/file", originalName: "jd.pdf", size: 10 });
    expect(cloudinaryService.uploadPublicRaw).toHaveBeenCalledWith(expect.any(Buffer), "igen_erp/recruitment/acme/branch-a", expect.stringMatching(/\.pdf$/));
    const remove = vi.spyOn(cloudinaryService, "deletePublicRaw").mockResolvedValue();
    await deleteTemporaryPublicRecruitmentFile(scope, "igen_erp/recruitment/acme/branch-a/file");
    expect(remove).toHaveBeenCalledWith("igen_erp/recruitment/acme/branch-a/file");
    await expect(deleteTemporaryPublicRecruitmentFile(scope, "igen_erp/recruitment/acme/other/file")).rejects.toThrow("Invalid public file scope");
  });
});
