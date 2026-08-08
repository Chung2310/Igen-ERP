import { describe, expect, it, vi } from "vitest";
import { createMediaController } from "./media.controller";

function response() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return res;
}

describe("mediaController managed upload", () => {
  it("creates a tenant-bound pending upload when sourceType is present", async () => {
    const createPendingUpload = vi.fn(async () => ({
      _id: "pending-1",
      token: "token-1",
      companyCode: "ACME",
      branchId: "branch-a",
      actorId: "user-1",
      actorName: "admin@acme.vn",
      sourceType: "hr.contract",
      fileName: "hop-dong.pdf",
      fileUrl: "https://res.cloudinary.com/acme/file.pdf",
      mimeType: "application/pdf",
      size: 10,
      storageProvider: "cloudinary" as const,
      storagePublicId: "asset-1",
      storageResourceType: "raw",
      status: "pending" as const,
      createdAt: new Date("2026-08-08T00:00:00.000Z"),
      expiresAt: new Date("2026-08-09T00:00:00.000Z"),
    }));
    const controller = createMediaController({
      cloudinary: { uploadMedia: vi.fn() },
      managedUpload: { createPendingUpload },
    });
    const req: any = {
      user: { id: "user-1", email: "admin@acme.vn", companyCode: "ACME", branchId: "branch-a" },
      body: {
        file: "data:application/pdf;base64,QQ==",
        name: "hop-dong.pdf",
        mimeType: "application/pdf",
        size: 10,
        sourceType: "hr.contract",
        folder: "client/cannot/choose",
      },
    };
    const res = response();

    await controller.upload(req, res);

    expect(createPendingUpload).toHaveBeenCalledWith(
      { companyCode: "ACME", branchId: "branch-a", actorId: "user-1", actorName: "admin@acme.vn" },
      {
        sourceType: "hr.contract",
        file: "data:application/pdf;base64,QQ==",
        fileName: "hop-dong.pdf",
        mimeType: "application/pdf",
        size: 10,
      },
    );
    expect(res.body).toEqual(expect.objectContaining({
      status: "success",
      url: "https://res.cloudinary.com/acme/file.pdf",
      storagePublicId: "asset-1",
      uploadToken: "token-1",
    }));
  });

  it("keeps the legacy upload response while callers are migrated", async () => {
    const uploadMedia = vi.fn(async () => "https://res.cloudinary.com/acme/legacy.png");
    const controller = createMediaController({
      cloudinary: { uploadMedia },
      managedUpload: { createPendingUpload: vi.fn() },
    });
    const req: any = { user: { id: "user-1", companyCode: "ACME" }, body: { file: "data:image/png;base64,QQ==", folder: "igen_erp/legacy" } };
    const res = response();

    await controller.upload(req, res);

    expect(uploadMedia).toHaveBeenCalledWith(req.body.file, "igen_erp/legacy");
    expect(res.body).toEqual({ status: "success", url: "https://res.cloudinary.com/acme/legacy.png" });
  });

  it("allows only a superadmin to bind a managed upload to a selected tenant", async () => {
    const createPendingUpload = vi.fn(async () => ({
      token: "token-1", fileUrl: "https://example.com/import.xlsx", storagePublicId: "asset-1",
    } as any));
    const controller = createMediaController({
      cloudinary: { uploadMedia: vi.fn() },
      managedUpload: { createPendingUpload },
    });
    const req: any = {
      user: { id: "super-1", role: "superadmin", companyCode: "SYSTEM", email: "root@example.com" },
      body: { file: "data:base64,QQ==", sourceType: "import.student", companyCode: "ACME", fileName: "students.xlsx" },
    };

    await controller.upload(req, response());

    expect(createPendingUpload).toHaveBeenCalledWith(
      expect.objectContaining({ companyCode: "ACME", actorId: "super-1" }),
      expect.objectContaining({ sourceType: "import.student" }),
    );
  });
});
