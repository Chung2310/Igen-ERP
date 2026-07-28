import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentAttachmentModel } from "../model/recruitment-attachment.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import { cloudinaryService } from "./cloudinary.service";
import { deleteTemporaryPublicRecruitmentFile, downloadApplicantAttachment, uploadApplicantAttachment, uploadOwnerAttachment, uploadPublicRecruitmentFile } from "./recruitment-attachment.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
describe("recruitment attachment service", () => {
  afterEach(() => vi.restoreAllMocks());
  it("rejects unsupported and oversized files", async () => {
    await expect(uploadApplicantAttachment(scope, "actor", "app", { originalname: "cv.exe", mimetype: "application/octet-stream", size: 1, buffer: Buffer.from("x") } as any)).rejects.toThrow("Unsupported attachment");
    await expect(uploadApplicantAttachment(scope, "actor", "app", { originalname: "cv.pdf", mimetype: "application/pdf", size: 11 * 1024 * 1024, buffer: Buffer.from("x") } as any)).rejects.toThrow("Attachment is too large");
  });
  it("uploads private metadata without a public URL and scopes downloads", async () => {
    vi.spyOn(RecruitmentApplicantModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "app" }) } as any);
    vi.spyOn(RecruitmentAttachmentModel, "findOne").mockReturnValueOnce({ lean: async () => null } as any);
    vi.spyOn(cloudinaryService, "uploadPrivateRaw").mockResolvedValue({ publicId: "recruitment/acme/a/key", resourceType: "raw", type: "authenticated", format: "pdf", bytes: 10 });
    const create = vi.spyOn(RecruitmentAttachmentModel, "create").mockImplementation(async (value: any) => value);
    const uploaded: any = await uploadApplicantAttachment(scope, "actor", "app", { originalname: "../CV A.pdf", mimetype: "application/pdf", size: 10, buffer: Buffer.from("pdf") } as any);
    expect(uploaded.url).toBeUndefined();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ ...scope, ownerType: "applicant", ownerId: "app", storageKey: "recruitment/acme/a/key" }));
    vi.spyOn(RecruitmentAttachmentModel, "findOne").mockReturnValue({ lean: async () => ({ storageKey: "key", originalName: "cv.pdf", mimeType: "application/pdf" }) } as any);
    vi.spyOn(cloudinaryService, "createSignedRawUrl").mockReturnValue("signed");
    await expect(downloadApplicantAttachment(scope, "attachment")).resolves.toEqual(expect.objectContaining({ signedUrl: "signed" }));
    expect(RecruitmentAttachmentModel.findOne).toHaveBeenCalledWith({ _id: "attachment", ...scope, isDeleted: false });
  });
  it("replaces a scoped JD file before deleting the previous private asset", async () => {
    vi.spyOn(RecruitmentJobModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "job" }) } as any);
    vi.spyOn(RecruitmentAttachmentModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "attachment", version: 3, storageKey: "old-key" }) } as any);
    vi.spyOn(cloudinaryService, "uploadPrivateRaw").mockResolvedValue({ publicId: "new-key", resourceType: "raw", type: "authenticated", format: "pdf", bytes: 10 });
    const update = vi.spyOn(RecruitmentAttachmentModel, "findOneAndUpdate").mockResolvedValue({ _id: "attachment", storageKey: "new-key" } as any);
    const remove = vi.spyOn(cloudinaryService, "deleteRawAsset").mockResolvedValue();
    await uploadOwnerAttachment(scope, "actor", "job", "job", { originalname: "jd.pdf", mimetype: "application/pdf", size: 10, buffer: Buffer.from("pdf") } as any, 3);
    expect(update).toHaveBeenCalledWith(
      { _id: "attachment", ...scope, ownerType: "job", ownerId: "job", isDeleted: false, version: 3 },
      expect.objectContaining({ $set: expect.objectContaining({ storageKey: "new-key" }), $inc: { version: 1 } }),
      { new: true, runValidators: true },
    );
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
    expect(remove).toHaveBeenCalledWith("old-key");
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
