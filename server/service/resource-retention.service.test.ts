import { describe, expect, it, vi } from "vitest";
import {
  createResourceRetentionService,
  type RetentionResourceItem,
} from "./resource-retention.service";

const expiredItem = (overrides: Partial<RetentionResourceItem> = {}): RetentionResourceItem => ({
  _id: "resource-1",
  managedType: "system",
  storageProvider: "cloudinary",
  storagePublicId: "asset-1",
  storageResourceType: "raw",
  storageAccess: "authenticated",
  ...overrides,
});

describe("ResourceRetentionService", () => {
  it("deletes storage before removing expired resource metadata", async () => {
    const calls: string[] = [];
    const repository = {
      findExpired: vi.fn(async () => [expiredItem()]),
      deleteMetadata: vi.fn(async () => { calls.push("metadata"); }),
    };
    const storage = { delete: vi.fn(async () => { calls.push("storage"); }) };
    const service = createResourceRetentionService({ repository, storage });

    await expect(service.purgeExpiredResourceItems(new Date("2026-08-08T00:00:00Z"), 100))
      .resolves.toEqual({ scanned: 1, purged: 1, failed: 0 });
    expect(calls).toEqual(["storage", "metadata"]);
  });

  it("keeps metadata when storage deletion fails", async () => {
    const repository = {
      findExpired: vi.fn(async () => [expiredItem()]),
      deleteMetadata: vi.fn(async () => undefined),
    };
    const storage = { delete: vi.fn(async () => { throw new Error("provider unavailable"); }) };
    const service = createResourceRetentionService({ repository, storage, logger: { error: vi.fn(), warn: vi.fn() } });

    await expect(service.purgeExpiredResourceItems(new Date(), 100))
      .resolves.toEqual({ scanned: 1, purged: 0, failed: 1 });
    expect(repository.deleteMetadata).not.toHaveBeenCalled();
  });

  it("removes legacy metadata-only items without calling storage", async () => {
    const repository = {
      findExpired: vi.fn(async () => [expiredItem({ managedType: "user", storageProvider: undefined, storagePublicId: undefined })]),
      deleteMetadata: vi.fn(async () => undefined),
    };
    const storage = { delete: vi.fn(async () => undefined) };
    const service = createResourceRetentionService({ repository, storage, logger: { error: vi.fn(), warn: vi.fn() } });

    await expect(service.purgeExpiredResourceItems(new Date(), 10))
      .resolves.toEqual({ scanned: 1, purged: 1, failed: 0 });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(repository.deleteMetadata).toHaveBeenCalledWith("resource-1");
  });
});
