import { describe, expect, it, vi } from "vitest";
import { InsightFaceBusinessError } from "../service/insightface.service";
import { createFaceManagementController } from "./face-management.controller";

function response() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function request(overrides: any = {}) {
  return {
    params: { id: "507f1f77bcf86cd799439011" },
    user: { id: "507f191e810c19729de860ea", companyCode: "ACME", role: "admin" },
    file: { buffer: Buffer.from("image"), mimetype: "image/jpeg" },
    ...overrides,
  } as any;
}

function dependencies() {
  return {
    insightFace: {
      getRegistrationStatus: vi.fn().mockResolvedValue({ registered: false }),
      registerFace: vi.fn().mockResolvedValue({ registered: true, created: true }),
      deleteRegistration: vi.fn().mockResolvedValue({ deleted: true }),
    },
    cloudinary: {
      uploadPrivateImage: vi.fn().mockResolvedValue({
        publicId: "face/evidence/1", resourceType: "image", type: "authenticated",
        format: "jpg", bytes: 10,
      }),
      deleteAsset: vi.fn().mockResolvedValue(undefined),
    },
    audit: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe("face management controller", () => {
  it("uploads evidence, registers, and writes a success audit", async () => {
    const deps = dependencies();
    const controller = createFaceManagementController(deps as any);
    const res = response();
    await controller.register(request(), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ registered: true }));
    expect(deps.cloudinary.deleteAsset).not.toHaveBeenCalled();
    expect(deps.audit.create).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME", action: "register", outcome: "success",
      evidence: expect.objectContaining({ publicId: "face/evidence/1" }),
    }));
  });

  it("deletes uploaded evidence and audits rejected enrollment", async () => {
    const deps = dependencies();
    deps.insightFace.registerFace.mockRejectedValue(new InsightFaceBusinessError("spoof_detected"));
    const controller = createFaceManagementController(deps as any);
    const res = response();
    await controller.register(request(), res);
    expect(deps.cloudinary.deleteAsset).toHaveBeenCalledWith("face/evidence/1");
    expect(deps.audit.create).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "rejected", reasonCode: "spoof_detected",
    }));
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns registration status for the target user", async () => {
    const deps = dependencies();
    deps.insightFace.getRegistrationStatus.mockResolvedValue({ registered: true });
    const controller = createFaceManagementController(deps as any);
    const res = response();
    await controller.status(request({ file: undefined }), res);
    expect(deps.insightFace.getRegistrationStatus).toHaveBeenCalledWith("507f1f77bcf86cd799439011");
    expect(res.json).toHaveBeenCalledWith({ registered: true });
  });

  it("deletes registration and writes delete audit", async () => {
    const deps = dependencies();
    const controller = createFaceManagementController(deps as any);
    const res = response();
    await controller.remove(request({ file: undefined }), res);
    expect(deps.audit.create).toHaveBeenCalledWith(expect.objectContaining({
      action: "delete", outcome: "success",
    }));
    expect(res.json).toHaveBeenCalledWith({ deleted: true });
  });
});