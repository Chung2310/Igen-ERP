import { afterEach, describe, expect, it, vi } from "vitest";
import { managedUploadService } from "../service/managed-upload.service";
import {
  finalizeContractPendingUploads,
  finalizeExtensionPendingUploads,
  hrContractController,
} from "./hr-contract.controller";

afterEach(() => vi.restoreAllMocks());

function response() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

describe("hrContractController managed uploads", () => {
  it("returns a pending token without creating an ad-hoc ResourceItem", async () => {
    const createPendingUpload = vi.spyOn(managedUploadService, "createPendingUpload").mockResolvedValue({
      _id: "pending-1", token: "token-1", companyCode: "ACME", branchId: "branch-a", actorId: "user-1",
      actorName: "admin@acme.vn", sourceType: "hr.contract", fileName: "hop-dong.pdf",
      fileUrl: "https://res.cloudinary.com/acme/asset.pdf", mimeType: "application/pdf", size: 100,
      storageProvider: "cloudinary", storagePublicId: "asset-1", storageResourceType: "raw", status: "pending",
      createdAt: new Date("2026-08-08T00:00:00.000Z"), expiresAt: new Date("2026-08-09T00:00:00.000Z"),
    });
    const req: any = {
      user: { id: "user-1", email: "admin@acme.vn", companyCode: "ACME", branchId: "branch-a", role: "admin" },
      query: {},
      body: { file: "data:application/pdf;base64,QQ==", name: "hop-dong.pdf", mimeType: "application/pdf", size: 100, kind: "contract" },
    };
    const res = response();

    await hrContractController.uploadResource(req, res);

    expect(createPendingUpload).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "branch-a", actorId: "user-1", actorName: "admin@acme.vn" },
      { sourceType: "hr.contract", file: req.body.file, fileName: "hop-dong.pdf", mimeType: "application/pdf", size: 100 },
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      status: "success",
      data: { url: "https://res.cloudinary.com/acme/asset.pdf", uploadToken: "token-1" },
    });
  });

  it("finalizes contract and signed-image tokens against the saved contract", async () => {
    const finalizeManagedUpload = vi.fn(async (token: string) => ({
      _id: token === "contract-token" ? "resource-contract" : "resource-signed",
    }));

    const patch = await finalizeContractPendingUploads({
      contract: { _id: "contract-1", employeeId: "employee-1", employeeName: "NV001 - Nguyễn Văn A" },
      body: { contractFileUploadToken: "contract-token", signedImageUploadToken: "signed-token" },
      actor: { companyCode: "ACME", branchId: "branch-a", actorId: "user-1", actorName: "Admin" },
      finalizeManagedUpload: finalizeManagedUpload as any,
    });

    expect(finalizeManagedUpload).toHaveBeenNthCalledWith(1, "contract-token", expect.any(Object), {
      entityType: "employee",
      entityId: "employee-1",
      entityLabel: "NV001 - Nguyễn Văn A",
      sourceRecordId: "contract-1",
      sourceField: "contractFile",
    });
    expect(patch).toEqual({ contractResourceId: "resource-contract", signedImageResourceId: "resource-signed" });
  });

  it("finalizes extension tokens against the saved extension", async () => {
    const finalizeManagedUpload = vi.fn(async (token: string) => ({
      _id: token === "extension-token" ? "resource-extension" : "resource-extension-signed",
    }));

    const patch = await finalizeExtensionPendingUploads({
      extension: { _id: "extension-1", employeeId: "employee-1", employeeName: "NV001" },
      body: { extensionFileUploadToken: "extension-token", extensionSignedImageUploadToken: "signed-token" },
      actor: { companyCode: "ACME", branchId: "branch-a", actorId: "user-1", actorName: "Admin" },
      finalizeManagedUpload: finalizeManagedUpload as any,
    });

    expect(patch).toEqual({ extensionResourceId: "resource-extension", signedImageResourceId: "resource-extension-signed" });
    expect(finalizeManagedUpload).toHaveBeenLastCalledWith("signed-token", expect.any(Object), expect.objectContaining({
      sourceRecordId: "extension-1",
      sourceField: "extensionSignedImage",
    }));
  });
});
