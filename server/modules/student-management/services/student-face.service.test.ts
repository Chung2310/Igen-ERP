import { describe, expect, it, vi } from "vitest";
import { createStudentFaceService } from "./student-face.service";

describe("StudentFaceService resource indexing", () => {
  it("indexes accepted enrollment evidence only after the student is saved", async () => {
    const calls: string[] = [];
    const registerUploadedResource = vi.fn(async () => { calls.push("index"); return {} as any; });
    const service = createStudentFaceService({
      insightFace: {
        getRegistrationStatus: vi.fn(),
        registerFace: vi.fn(async () => ({ registered: true } as any)),
        deleteRegistration: vi.fn(),
      },
      cloudinary: {
        uploadPrivateImage: vi.fn(async () => ({ publicId: "face/evidence-1", resourceType: "image", type: "authenticated", format: "jpg", bytes: 42 })),
        deleteAsset: vi.fn(),
      },
      audit: { create: vi.fn(async () => undefined) },
      indexer: { registerUploadedResource, replaceSourceResource: vi.fn(), trashSourceRecordResources: vi.fn() },
    });
    const student: any = {
      id: "student-1",
      ownerId: "ACME",
      fullName: "Nguyen Van A",
      studentCode: "ST001",
      faceEnrollment: undefined,
      save: vi.fn(async () => { calls.push("save"); }),
    };

    await service.register("actor-1", student, { buffer: Buffer.from("image"), mimetype: "image/jpeg" }, {
      companyCode: "ACME",
      branchId: "branch-a",
    });

    expect(calls).toEqual(["save", "index"]);
    expect(registerUploadedResource).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME",
      sourceType: "student.face",
      entityId: "student-1",
      entityLabel: "Nguyen Van A",
      storagePublicId: "face/evidence-1",
      storageResourceType: "image",
      storageAccess: "authenticated",
    }));
  });

  it("moves replaced and removed face evidence to resource trash without deleting storage immediately", async () => {
    const replaceSourceResource = vi.fn(async () => ({} as any));
    const trashSourceRecordResources = vi.fn(async () => 1);
    const deleteAsset = vi.fn();
    const service = createStudentFaceService({
      insightFace: {
        getRegistrationStatus: vi.fn(),
        registerFace: vi.fn(async () => ({ registered: true } as any)),
        deleteRegistration: vi.fn(),
      },
      cloudinary: {
        uploadPrivateImage: vi.fn(async () => ({ publicId: "face/evidence-2", resourceType: "image", type: "authenticated", format: "jpg", bytes: 42 })),
        deleteAsset,
      },
      audit: { create: vi.fn(async () => undefined) },
      indexer: { registerUploadedResource: vi.fn(), replaceSourceResource, trashSourceRecordResources },
    });
    const student: any = {
      id: "student-1", ownerId: "ACME", fullName: "Nguyen A",
      faceEnrollment: { registered: true, insightFaceUserId: "face-user", lastEvidencePublicId: "face/evidence-1" },
      save: vi.fn(async () => undefined),
    };

    await service.register("actor-1", student, { buffer: Buffer.from("image"), mimetype: "image/jpeg" }, { companyCode: "ACME" });
    await service.remove("actor-1", student, { companyCode: "ACME" });

    expect(replaceSourceResource).toHaveBeenCalledWith(
      "ACME",
      "student.face:student-1:evidence:face/evidence-1",
      expect.objectContaining({ storagePublicId: "face/evidence-2" }),
    );
    expect(trashSourceRecordResources).toHaveBeenCalledWith("ACME", "student.face", "student-1");
    expect(deleteAsset).not.toHaveBeenCalled();
  });
});
