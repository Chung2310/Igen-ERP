import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentAttachmentModel } from "../model/recruitment-attachment.model";
import { cloudinaryService } from "./cloudinary.service";
import { downloadApplicantAttachment, uploadApplicantAttachment } from "./recruitment-attachment.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
describe("recruitment attachment service", () => {
  afterEach(() => vi.restoreAllMocks());
  it("rejects unsupported and oversized files", async () => {
    await expect(uploadApplicantAttachment(scope, "actor", "app", { originalname: "cv.exe", mimetype: "application/octet-stream", size: 1, buffer: Buffer.from("x") } as any)).rejects.toThrow("Unsupported attachment");
    await expect(uploadApplicantAttachment(scope, "actor", "app", { originalname: "cv.pdf", mimetype: "application/pdf", size: 11 * 1024 * 1024, buffer: Buffer.from("x") } as any)).rejects.toThrow("Attachment is too large");
  });
  it("uploads private metadata without a public URL and scopes downloads", async () => {
    vi.spyOn(RecruitmentApplicantModel, "findOne").mockReturnValue({ lean: async () => ({ _id: "app" }) } as any);
    vi.spyOn(cloudinaryService, "uploadPrivateRaw").mockResolvedValue({ publicId: "recruitment/acme/a/key", resourceType: "raw", type: "authenticated", format: "pdf", bytes: 10 });
    const create = vi.spyOn(RecruitmentAttachmentModel, "create").mockImplementation(async (value: any) => value);
    const uploaded: any = await uploadApplicantAttachment(scope, "actor", "app", { originalname: "../CV A.pdf", mimetype: "application/pdf", size: 10, buffer: Buffer.from("pdf") } as any);
    expect(uploaded.url).toBeUndefined();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ ...scope, storageKey: "recruitment/acme/a/key" }));
    vi.spyOn(RecruitmentAttachmentModel, "findOne").mockReturnValue({ lean: async () => ({ storageKey: "key", originalName: "cv.pdf", mimeType: "application/pdf" }) } as any);
    vi.spyOn(cloudinaryService, "createSignedRawUrl").mockReturnValue("signed");
    await expect(downloadApplicantAttachment(scope, "attachment")).resolves.toEqual(expect.objectContaining({ signedUrl: "signed" }));
    expect(RecruitmentAttachmentModel.findOne).toHaveBeenCalledWith({ _id: "attachment", ...scope, isDeleted: false });
  });
});
