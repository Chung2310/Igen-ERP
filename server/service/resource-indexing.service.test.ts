import { describe, expect, it } from "vitest";
import {
  createResourceIndexingService,
  type RegisterUploadedResourceInput,
  type ResourceIndexingRecord,
  type ResourceIndexingRepository,
  type SystemFolderUpsertInput,
} from "./resource-indexing.service";

function input(overrides: Partial<RegisterUploadedResourceInput> = {}): RegisterUploadedResourceInput {
  return {
    companyCode: "ACME",
    branchId: "branch-a",
    sourceType: "hr.contract",
    entityType: "employee",
    entityId: "employee-1",
    entityLabel: "NV001 - Nguyễn Văn A",
    sourceRecordId: "contract-1",
    sourceKey: "hr-contract:contract-1:asset-1",
    fileName: "hop-dong.pdf",
    fileUrl: "https://res.cloudinary.com/acme/hop-dong.pdf",
    mimeType: "application/pdf",
    size: 1024,
    storageProvider: "cloudinary",
    storagePublicId: "acme/hop-dong",
    uploaderId: "user-1",
    uploaderName: "Admin",
    ...overrides,
  };
}

function fakeRepository() {
  let sequence = 0;
  const folders: ResourceIndexingRecord[] = [];
  const files: ResourceIndexingRecord[] = [];

  const repository: ResourceIndexingRepository = {
    async findBySourceKey(companyCode, sourceKey) {
      return files.find((item) => item.companyCode === companyCode && item.sourceKey === sourceKey) || null;
    },
    async upsertSystemFolder(folder: SystemFolderUpsertInput) {
      const existing = folders.find((item) => item.companyCode === folder.companyCode && item.systemFolderKey === folder.systemFolderKey);
      if (existing) {
        existing.name = folder.name;
        existing.requiredPermissions = Array.from(new Set([...(existing.requiredPermissions || []), ...folder.requiredPermissions]));
        return existing;
      }
      const created: ResourceIndexingRecord = { _id: `folder-${++sequence}`, type: "folder", ...folder };
      folders.push(created);
      return created;
    },
    async createSystemFile(file) {
      const created: ResourceIndexingRecord = { _id: `file-${++sequence}`, type: "file", ...file };
      files.push(created);
      return created;
    },
    async setSourceDeleted(companyCode, sourceKey, deletedAt) {
      const existing = files.find((item) => item.companyCode === companyCode && item.sourceKey === sourceKey);
      if (!existing) return null;
      existing.isDeleted = deletedAt !== null;
      existing.deletedAt = deletedAt;
      return existing;
    },
    async setResourceDeleted(companyCode, resourceId, deletedAt) {
      const existing = files.find((item) => item.companyCode === companyCode && item._id === resourceId);
      if (!existing) return null;
      existing.isDeleted = deletedAt !== null;
      existing.deletedAt = deletedAt;
      return existing;
    },
    async setSourceRecordDeleted(companyCode, sourceType, sourceRecordId, deletedAt) {
      let changed = 0;
      for (const item of files) {
        if (item.companyCode !== companyCode || item.sourceType !== sourceType || item.sourceRecordId !== sourceRecordId) continue;
        item.isDeleted = deletedAt !== null;
        item.deletedAt = deletedAt;
        changed += 1;
      }
      return changed;
    },
    async setOlderSourceFieldDeleted(companyCode, sourceType, sourceRecordId, sourceField, keepResourceId, deletedAt) {
      let changed = 0;
      for (const item of files) {
        if (
          item.companyCode !== companyCode
          || item.sourceType !== sourceType
          || item.sourceRecordId !== sourceRecordId
          || item.sourceField !== sourceField
          || item._id >= keepResourceId
        ) continue;
        item.isDeleted = true;
        item.deletedAt = deletedAt;
        changed += 1;
      }
      return changed;
    },
  };

  return { repository, folders, files };
}

describe("ResourceIndexingService", () => {
  it("creates Function / Data group / Specific object and one indexed file", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);

    const resource = await service.registerUploadedResource(input());

    expect(fake.folders.map((folder) => folder.name)).toEqual([
      "Nhân sự",
      "Hợp đồng",
      "NV001 - Nguyễn Văn A",
    ]);
    expect(fake.folders[1].parentId).toBe(fake.folders[0]._id);
    expect(fake.folders[2].parentId).toBe(fake.folders[1]._id);
    expect(fake.folders[0].branchId).toBeUndefined();
    expect(fake.folders[1].branchId).toBeUndefined();
    expect(fake.folders[2].branchId).toBe("branch-a");
    expect(resource).toMatchObject({
      parentId: fake.folders[2]._id,
      managedType: "system",
      sourceKey: "hr-contract:contract-1:asset-1",
      requiredPermissions: ["hr:read"],
    });
  });

  it("returns the existing item when the same source key is retried", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);

    const first = await service.registerUploadedResource(input());
    const retried = await service.registerUploadedResource(input());

    expect(retried._id).toBe(first._id);
    expect(fake.files).toHaveLength(1);
    expect(fake.folders).toHaveLength(3);
  });

  it("accepts an authenticated storage asset without persisting a public URL", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);

    const resource = await service.registerUploadedResource(input({
      fileUrl: "",
      storageAccess: "authenticated",
      storageResourceType: "raw",
    }));

    expect(resource).toMatchObject({
      fileUrl: "",
      storageAccess: "authenticated",
      storageResourceType: "raw",
    });
  });

  it("updates an entity folder label without changing its stable identity", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);

    await service.registerUploadedResource(input());
    await service.registerUploadedResource(input({
      sourceKey: "hr-contract:contract-2:asset-2",
      sourceRecordId: "contract-2",
      entityLabel: "NV001 - Nguyễn Văn A (mới)",
    }));

    expect(fake.folders).toHaveLength(3);
    expect(fake.folders[2].name).toBe("NV001 - Nguyễn Văn A (mới)");
    expect(fake.files).toHaveLength(2);
  });

  it("trashes the previous resource when a replacement succeeds", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);
    await service.registerUploadedResource(input());

    const replacement = await service.replaceSourceResource(
      "ACME",
      "hr-contract:contract-1:asset-1",
      input({ sourceKey: "hr-contract:contract-1:asset-2", storagePublicId: "acme/hop-dong-v2" }),
    );

    expect(replacement.sourceKey).toBe("hr-contract:contract-1:asset-2");
    expect(fake.files[0].isDeleted).toBe(true);
    expect(fake.files[0].deletedAt).toBeInstanceOf(Date);
  });

  it("trashes a finalized managed upload by its resource id", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);
    const resource = await service.registerUploadedResource(input());

    await service.trashResourceById("ACME", resource._id, new Date("2026-08-08T00:00:00Z"));

    expect(fake.files[0]).toMatchObject({ isDeleted: true, deletedAt: new Date("2026-08-08T00:00:00Z") });
  });

  it("trashes every attachment belonging to a deleted source record", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);
    await service.registerUploadedResource(input());
    await service.registerUploadedResource(input({ sourceKey: "hr-contract:contract-1:asset-2", storagePublicId: "asset-2" }));

    await service.trashSourceRecordResources("ACME", "hr.contract", "contract-1");

    expect(fake.files).toHaveLength(2);
    expect(fake.files.every((file) => file.isDeleted)).toBe(true);
  });

  it("keeps only the latest upload active for the same source field", async () => {
    const fake = fakeRepository();
    const service = createResourceIndexingService(fake.repository);
    await service.registerUploadedResource(input({ sourceField: "document" }));

    await service.registerUploadedResource(input({
      sourceField: "document",
      sourceKey: "hr-contract:contract-1:document:asset-2",
      storagePublicId: "asset-2",
    }));

    expect(fake.files).toHaveLength(2);
    expect(fake.files[0].isDeleted).toBe(true);
    expect(fake.files[1].isDeleted).toBe(false);
  });
});
