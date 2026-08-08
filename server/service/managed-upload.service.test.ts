import { describe, expect, it, vi } from "vitest";
import {
  createManagedUploadService,
  type ManagedUploadActor,
  type PendingUploadRecord,
  type PendingUploadRepository,
} from "./managed-upload.service";

const actor: ManagedUploadActor = {
  companyCode: "ACME",
  branchId: "branch-a",
  actorId: "user-1",
  actorName: "Admin",
};

function fakeRepository(): PendingUploadRepository & { records: PendingUploadRecord[] } {
  const records: PendingUploadRecord[] = [];
  return {
    records,
    async create(input) {
      const record = { _id: `pending-${records.length + 1}`, ...input };
      records.push(record);
      return record;
    },
    async findByToken(token) {
      return records.find((record) => record.token === token) || null;
    },
    async markFinalized(token, resourceId) {
      const record = records.find((entry) => entry.token === token);
      if (!record) return null;
      record.status = "finalized";
      record.finalizedResourceId = resourceId;
      return record;
    },
    async findExpired(expiresBefore, limit) {
      return records.filter((record) => record.expiresAt <= expiresBefore).slice(0, limit);
    },
    async remove(token) {
      const index = records.findIndex((record) => record.token === token);
      if (index < 0) return;
      records.splice(index, 1);
    },
  };
}

describe("ManagedUploadService", () => {
  it("records an already-uploaded validated asset as a pending managed upload", async () => {
    const repository = fakeRepository();
    const service = createManagedUploadService({
      repository,
      storage: { upload: vi.fn(), delete: vi.fn() },
      indexer: { registerUploadedResource: vi.fn() },
      createToken: () => "stored-token",
      now: () => new Date("2026-08-08T00:00:00.000Z"),
    });

    const pending = await service.recordPendingStoredAsset(actor, {
      sourceType: "student.custom-field",
      fileName: "photo.png",
      fileUrl: "https://cdn.test/photo.png",
      mimeType: "image/png",
      size: 12,
      storageProvider: "cloudinary",
      storagePublicId: "student/photo-1",
      storageResourceType: "image",
    });

    expect(pending).toMatchObject({ token: "stored-token", sourceType: "student.custom-field", storagePublicId: "student/photo-1" });
  });

  it("uploads into a server-derived folder and persists tenant-bound metadata", async () => {
    const repository = fakeRepository();
    const upload = vi.fn(async () => ({
      secureUrl: "https://res.cloudinary.com/acme/asset.pdf",
      publicId: "managed/acme/hr-contract/asset",
      resourceType: "raw",
      bytes: 2048,
    }));
    const service = createManagedUploadService({
      repository,
      storage: { upload, delete: vi.fn() },
      indexer: { registerUploadedResource: vi.fn() },
      createToken: () => "token-1",
      now: () => new Date("2026-08-08T00:00:00.000Z"),
    });

    const pending = await service.createPendingUpload(actor, {
      sourceType: "hr.contract",
      file: "data:application/pdf;base64,QQ==",
      fileName: "hop-dong.pdf",
      mimeType: "application/pdf",
      size: 2048,
    });

    expect(upload).toHaveBeenCalledWith(
      "data:application/pdf;base64,QQ==",
      "igen_erp/managed/acme/hr/contract",
    );
    expect(pending).toMatchObject({ token: "token-1", companyCode: "ACME", actorId: "user-1", sourceType: "hr.contract" });
    expect(pending.expiresAt.toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });

  it("rejects finalization by a different actor", async () => {
    const repository = fakeRepository();
    await repository.create({
      token: "token-1",
      companyCode: "ACME",
      branchId: "branch-a",
      actorId: "user-1",
      actorName: "Admin",
      sourceType: "hr.contract",
      fileName: "hop-dong.pdf",
      fileUrl: "https://res.cloudinary.com/acme/asset.pdf",
      mimeType: "application/pdf",
      size: 100,
      storageProvider: "cloudinary",
      storagePublicId: "asset-1",
      status: "pending",
      createdAt: new Date("2026-08-08T00:00:00.000Z"),
      expiresAt: new Date("2026-08-09T00:00:00.000Z"),
    });
    const service = createManagedUploadService({
      repository,
      storage: { upload: vi.fn(), delete: vi.fn() },
      indexer: { registerUploadedResource: vi.fn() },
      now: () => new Date("2026-08-08T01:00:00.000Z"),
    });

    await expect(service.finalizeManagedUpload("token-1", { ...actor, actorId: "user-2" }, {
      entityType: "employee",
      entityId: "employee-1",
      entityLabel: "NV001 - Nguyễn Văn A",
      sourceRecordId: "contract-1",
      sourceField: "document",
    })).rejects.toThrow(/không thuộc người tải lên/i);
  });

  it("finalizes idempotently with a server-generated source key", async () => {
    const repository = fakeRepository();
    await repository.create({
      token: "token-1", companyCode: "ACME", branchId: "branch-a", actorId: "user-1", actorName: "Admin",
      sourceType: "hr.contract", fileName: "hop-dong.pdf", fileUrl: "https://res.cloudinary.com/acme/asset.pdf",
      mimeType: "application/pdf", size: 100, storageProvider: "cloudinary", storagePublicId: "asset-1",
      status: "pending", createdAt: new Date("2026-08-08T00:00:00.000Z"), expiresAt: new Date("2026-08-09T00:00:00.000Z"),
    });
    const registerUploadedResource = vi.fn(async (input) => ({ _id: "resource-1", type: "file" as const, ...input, parentId: "folder-1", name: input.fileName }));
    const service = createManagedUploadService({
      repository,
      storage: { upload: vi.fn(), delete: vi.fn() },
      indexer: { registerUploadedResource },
      now: () => new Date("2026-08-08T01:00:00.000Z"),
    });
    const source = { entityType: "employee", entityId: "employee-1", entityLabel: "NV001", sourceRecordId: "contract-1", sourceField: "document" };

    const first = await service.finalizeManagedUpload("token-1", actor, source);
    const retried = await service.finalizeManagedUpload("token-1", actor, source);

    expect(first._id).toBe("resource-1");
    expect(retried._id).toBe("resource-1");
    expect(registerUploadedResource).toHaveBeenLastCalledWith(expect.objectContaining({
      sourceKey: "hr.contract:contract-1:document:asset-1",
      companyCode: "ACME",
      branchId: "branch-a",
    }));
    expect(repository.records[0].status).toBe("finalized");
  });

  it("purges expired pending storage before metadata but keeps finalized storage", async () => {
    const repository = fakeRepository();
    await repository.create({
      token: "pending-token", companyCode: "ACME", actorId: "user-1", sourceType: "hr.contract",
      fileName: "pending.pdf", fileUrl: "https://example.com/pending.pdf", storageProvider: "cloudinary",
      storagePublicId: "pending-asset", status: "pending", createdAt: new Date("2026-08-01"), expiresAt: new Date("2026-08-02"),
    });
    await repository.create({
      token: "final-token", companyCode: "ACME", actorId: "user-1", sourceType: "hr.contract",
      fileName: "final.pdf", fileUrl: "https://example.com/final.pdf", storageProvider: "cloudinary",
      storagePublicId: "final-asset", status: "finalized", finalizedResourceId: "resource-1",
      createdAt: new Date("2026-08-01"), expiresAt: new Date("2026-08-02"),
    });
    const deletedAssets: string[] = [];
    const service = createManagedUploadService({
      repository,
      storage: { upload: vi.fn(), delete: vi.fn(async (item) => { deletedAssets.push(String(item.storagePublicId)); }) },
      indexer: { registerUploadedResource: vi.fn() },
    });

    await expect(service.purgeExpiredUploadRecords(new Date("2026-08-08")))
      .resolves.toEqual({ scanned: 2, purged: 2, failed: 0 });
    expect(deletedAssets).toEqual(["pending-asset"]);
    expect(repository.records).toHaveLength(0);
  });

  it("trashes the indexed resource for a finalized upload token", async () => {
    const repository = fakeRepository();
    await repository.create({
      token: "token-1", companyCode: "ACME", actorId: "uploader-1", sourceType: "hr.contract",
      fileName: "contract.pdf", fileUrl: "https://example.com/contract.pdf", storageProvider: "cloudinary",
      status: "finalized", finalizedResourceId: "resource-1", createdAt: new Date("2026-08-01"), expiresAt: new Date("2026-08-09"),
    });
    const trashResourceById = vi.fn(async () => ({ _id: "resource-1" } as any));
    const service = createManagedUploadService({
      repository,
      storage: { upload: vi.fn(), delete: vi.fn() },
      indexer: { registerUploadedResource: vi.fn(), trashResourceById },
    });

    await service.trashFinalizedUpload("token-1", { companyCode: "ACME", actorId: "admin-1", trusted: true });

    expect(trashResourceById).toHaveBeenCalledWith("ACME", "resource-1", expect.any(Date));
  });

  it("rejects finalization when the source flow does not match the pending upload", async () => {
    const repository = fakeRepository();
    await repository.create({
      token: "token-1", companyCode: "ACME", actorId: "user-1", sourceType: "hr.contract",
      fileName: "contract.pdf", fileUrl: "https://example.com/contract.pdf", storageProvider: "cloudinary",
      status: "pending", createdAt: new Date("2026-08-01"), expiresAt: new Date("2026-08-09"),
    });
    const service = createManagedUploadService({
      repository,
      storage: { upload: vi.fn(), delete: vi.fn() },
      indexer: { registerUploadedResource: vi.fn() },
      now: () => new Date("2026-08-08"),
    });

    await expect(service.finalizeManagedUpload("token-1", actor, {
      expectedSourceType: "import.worker",
      entityType: "import-run", entityId: "run-1", entityLabel: "workers.xlsx", sourceRecordId: "run-1",
    })).rejects.toThrow(/không khớp chức năng nguồn/i);
  });
});
