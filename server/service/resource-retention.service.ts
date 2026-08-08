import { ResourceItemModel, type ResourceStorageAccess, type ResourceStorageProvider } from "../model/resource-item.model";
import { cloudinaryService } from "./cloudinary.service";
import { managedUploadService } from "./managed-upload.service";

const RETENTION_MS = 15 * 24 * 60 * 60 * 1000;

export interface RetentionResourceItem {
  _id: string;
  managedType?: "user" | "system";
  storageProvider?: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  storageAccess?: ResourceStorageAccess;
}

export interface ResourceRetentionRepository {
  findExpired(cutoff: Date, limit: number): Promise<RetentionResourceItem[]>;
  deleteMetadata(id: string): Promise<void>;
}

export interface ResourceRetentionStorage {
  delete(item: RetentionResourceItem): Promise<void>;
}

interface RetentionLogger {
  error(message: string, error?: unknown): void;
  warn(message: string): void;
}

interface ResourceRetentionDependencies {
  repository: ResourceRetentionRepository;
  storage: ResourceRetentionStorage;
  logger?: RetentionLogger;
}

const mongooseRepository: ResourceRetentionRepository = {
  async findExpired(cutoff, limit) {
    const items = await ResourceItemModel.find({
      isDeleted: true,
      deletedAt: { $ne: null, $lte: cutoff },
    }).sort({ deletedAt: 1 }).limit(limit).lean();
    return items.map((item) => ({ ...item, _id: String(item._id) }));
  },
  async deleteMetadata(id) {
    await ResourceItemModel.deleteOne({ _id: id });
  },
};

const providerStorage: ResourceRetentionStorage = {
  async delete(item) {
    if (!item.storageProvider || !item.storagePublicId) return;
    if (item.storageProvider !== "cloudinary") {
      throw new Error(`Chưa hỗ trợ xóa storage provider: ${item.storageProvider}`);
    }
    if (item.storageAccess === "authenticated") {
      if (item.storageResourceType === "raw") {
        await cloudinaryService.deleteRawAsset(item.storagePublicId);
      } else {
        await cloudinaryService.deleteAsset(item.storagePublicId);
      }
      return;
    }
    await cloudinaryService.deletePublicMedia(item.storagePublicId, item.storageResourceType || "image");
  },
};

export function createResourceRetentionService(dependencies: ResourceRetentionDependencies) {
  const logger = dependencies.logger || console;
  return {
    async purgeExpiredResourceItems(now = new Date(), limit = 100) {
      const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit || 100)));
      const cutoff = new Date(now.getTime() - RETENTION_MS);
      const items = await dependencies.repository.findExpired(cutoff, safeLimit);
      let purged = 0;
      let failed = 0;

      for (const item of items) {
        try {
          if (item.storageProvider && item.storagePublicId) {
            await dependencies.storage.delete(item);
          } else if (item.managedType === "user") {
            logger.warn(`[ResourceRetention] Resource ${item._id} không có metadata storage; chỉ xóa metadata.`);
          }
          await dependencies.repository.deleteMetadata(item._id);
          purged += 1;
        } catch (error) {
          failed += 1;
          logger.error(`[ResourceRetention] Không thể purge resource ${item._id}; giữ lại metadata.`, error);
        }
      }

      return { scanned: items.length, purged, failed };
    },
  };
}

export const resourceRetentionService = createResourceRetentionService({
  repository: mongooseRepository,
  storage: providerStorage,
});

export function startResourceRetentionScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await resourceRetentionService.purgeExpiredResourceItems();
      await managedUploadService.purgeExpiredUploadRecords();
    } catch (error) {
      console.error("[ResourceRetention] Scheduler failed:", error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
