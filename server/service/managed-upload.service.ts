import { randomUUID } from "node:crypto";
import { getResourceSourceDefinition } from "../config/resource-source-registry";
import { PendingUploadModel } from "../model/pending-upload.model";
import type { ResourceStorageProvider } from "../model/resource-item.model";
import { cloudinaryService, type PublicMediaAsset } from "./cloudinary.service";
import {
  resourceIndexingService,
  type RegisterUploadedResourceInput,
  type ResourceIndexingRecord,
} from "./resource-indexing.service";

export interface ManagedUploadActor {
  companyCode: string;
  branchId?: string;
  actorId: string;
  actorName?: string;
  trusted?: boolean;
}

export interface CreatePendingUploadInput {
  sourceType: string;
  file: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

export interface RecordPendingStoredAssetInput {
  sourceType: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  size?: number;
  storageProvider: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
}

export interface FinalizeManagedUploadInput {
  expectedSourceType?: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  sourceRecordId: string;
  sourceField?: string;
  sourceAudienceIds?: string[];
}

export interface PendingUploadRecord {
  _id: string;
  token: string;
  companyCode: string;
  branchId?: string;
  actorId: string;
  actorName?: string;
  sourceType: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  size?: number;
  storageProvider: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  status: "pending" | "finalized";
  finalizedResourceId?: string;
  createdAt: Date;
  expiresAt: Date;
}

export type PendingUploadCreate = Omit<PendingUploadRecord, "_id">;

export interface PendingUploadRepository {
  create(input: PendingUploadCreate): Promise<PendingUploadRecord>;
  findByToken(token: string): Promise<PendingUploadRecord | null>;
  markFinalized(token: string, resourceId: string): Promise<PendingUploadRecord | null>;
  findExpired(expiresBefore: Date, limit: number): Promise<PendingUploadRecord[]>;
  remove(token: string): Promise<void>;
}

export interface ManagedUploadStorage {
  upload(file: string, folder: string): Promise<PublicMediaAsset>;
  delete(asset: Pick<PendingUploadRecord, "storagePublicId" | "storageResourceType">): Promise<void>;
}

interface ManagedUploadIndexer {
  registerUploadedResource(input: RegisterUploadedResourceInput): Promise<ResourceIndexingRecord>;
  trashResourceById?(companyCode: string, resourceId: string, deletedAt?: Date): Promise<ResourceIndexingRecord | null>;
}

interface ManagedUploadDependencies {
  repository: PendingUploadRepository;
  storage: ManagedUploadStorage;
  indexer: ManagedUploadIndexer;
  createToken?: () => string;
  now?: () => Date;
}

function toRecord(value: any): PendingUploadRecord {
  return { ...value, _id: String(value._id) };
}

const mongooseRepository: PendingUploadRepository = {
  async create(input) {
    const record = await PendingUploadModel.create(input);
    return toRecord(record.toObject());
  },
  async findByToken(token) {
    const record = await PendingUploadModel.findOne({ token }).lean();
    return record ? toRecord(record) : null;
  },
  async markFinalized(token, resourceId) {
    const record = await PendingUploadModel.findOneAndUpdate(
      { token },
      { $set: { status: "finalized", finalizedResourceId: resourceId } },
      { new: true },
    ).lean();
    return record ? toRecord(record) : null;
  },
  async findExpired(expiresBefore, limit) {
    const records = await PendingUploadModel.find({ expiresAt: { $lte: expiresBefore } })
      .sort({ expiresAt: 1 })
      .limit(limit)
      .lean();
    return records.map(toRecord);
  },
  async remove(token) {
    await PendingUploadModel.deleteOne({ token });
  },
};

const cloudinaryStorage: ManagedUploadStorage = {
  upload: (file, folder) => cloudinaryService.uploadMediaAsset(file, folder),
  async delete(asset) {
    if (!asset.storagePublicId) return;
    await cloudinaryService.deletePublicMedia(asset.storagePublicId, asset.storageResourceType || "image");
  },
};

function required(value: string, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} là bắt buộc.`);
  return normalized;
}

function storageFolder(companyCode: string, sourceType: string): string {
  const sourcePath = sourceType.split(".").map((part) => part.replace(/[^a-z0-9_-]/gi, "").toLowerCase()).filter(Boolean).join("/");
  return `igen_erp/managed/${companyCode.toLowerCase()}/${sourcePath}`;
}

export function createManagedUploadService(dependencies: ManagedUploadDependencies) {
  const createToken = dependencies.createToken || randomUUID;
  const now = dependencies.now || (() => new Date());

  async function loadOwnedPending(token: string, actor: ManagedUploadActor): Promise<PendingUploadRecord> {
    const pending = await dependencies.repository.findByToken(required(token, "Mã upload"));
    if (!pending) throw new Error("Không tìm thấy upload đang chờ xử lý.");
    if (pending.companyCode !== required(actor.companyCode, "Mã công ty").toUpperCase()) {
      throw new Error("Upload không thuộc doanh nghiệp hiện tại.");
    }
    if (!actor.trusted && pending.actorId !== actor.actorId) {
      throw new Error("Upload không thuộc người tải lên hiện tại.");
    }
    if (pending.status === "pending" && pending.expiresAt.getTime() <= now().getTime()) {
      throw new Error("Upload đang chờ đã hết hạn.");
    }
    return pending;
  }

  return {
    async recordPendingStoredAsset(actor: ManagedUploadActor, input: RecordPendingStoredAssetInput): Promise<PendingUploadRecord> {
      const companyCode = required(actor.companyCode, "Mã công ty").toUpperCase();
      const actorId = required(actor.actorId, "Người tải lên");
      const sourceType = required(input.sourceType, "Nguồn upload").toLowerCase();
      getResourceSourceDefinition(sourceType);
      const createdAt = now();
      return dependencies.repository.create({
        token: createToken(),
        companyCode,
        branchId: actor.branchId,
        actorId,
        actorName: actor.actorName,
        sourceType,
        fileName: required(input.fileName, "Tên tệp"),
        fileUrl: required(input.fileUrl, "Đường dẫn tệp"),
        mimeType: input.mimeType || "",
        size: input.size || 0,
        storageProvider: input.storageProvider,
        storagePublicId: input.storagePublicId,
        storageResourceType: input.storageResourceType,
        status: "pending",
        createdAt,
        expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
      });
    },

    async createPendingUpload(actor: ManagedUploadActor, input: CreatePendingUploadInput): Promise<PendingUploadRecord> {
      const companyCode = required(actor.companyCode, "Mã công ty").toUpperCase();
      const actorId = required(actor.actorId, "Người tải lên");
      const sourceType = required(input.sourceType, "Nguồn upload").toLowerCase();
      getResourceSourceDefinition(sourceType);
      const createdAt = now();
      const asset = await dependencies.storage.upload(
        required(input.file, "Dữ liệu tệp"),
        storageFolder(companyCode, sourceType),
      );
      const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
      try {
        return await dependencies.repository.create({
          token: createToken(),
          companyCode,
          branchId: actor.branchId,
          actorId,
          actorName: actor.actorName,
          sourceType,
          fileName: required(input.fileName, "Tên tệp"),
          fileUrl: asset.secureUrl,
          mimeType: input.mimeType || "",
          size: input.size || asset.bytes,
          storageProvider: "cloudinary",
          storagePublicId: asset.publicId,
          storageResourceType: asset.resourceType,
          status: "pending",
          createdAt,
          expiresAt,
        });
      } catch (error) {
        await dependencies.storage.delete({ storagePublicId: asset.publicId, storageResourceType: asset.resourceType }).catch(() => undefined);
        throw error;
      }
    },

    async finalizeManagedUpload(
      token: string,
      actor: ManagedUploadActor,
      source: FinalizeManagedUploadInput,
    ): Promise<ResourceIndexingRecord> {
      const pending = await loadOwnedPending(token, actor);
      if (source.expectedSourceType && pending.sourceType !== source.expectedSourceType.toLowerCase()) {
        throw new Error("Upload không khớp chức năng nguồn đang hoàn tất.");
      }
      const sourceField = required(source.sourceField || "file", "Trường nguồn");
      const publicIdentity = pending.storagePublicId || pending.token;
      const resource = await dependencies.indexer.registerUploadedResource({
        companyCode: pending.companyCode,
        branchId: pending.branchId,
        sourceType: pending.sourceType,
        entityType: required(source.entityType, "Loại đối tượng"),
        entityId: required(source.entityId, "Mã đối tượng"),
        entityLabel: required(source.entityLabel, "Tên đối tượng"),
        sourceRecordId: required(source.sourceRecordId, "Mã bản ghi nguồn"),
        sourceField,
        sourceKey: `${pending.sourceType}:${source.sourceRecordId}:${sourceField}:${publicIdentity}`,
        fileName: pending.fileName,
        fileUrl: pending.fileUrl,
        mimeType: pending.mimeType,
        size: pending.size,
        storageProvider: pending.storageProvider,
        storagePublicId: pending.storagePublicId,
        storageResourceType: pending.storageResourceType,
        storageAccess: "public",
        uploaderId: pending.actorId,
        uploaderName: pending.actorName,
        sourceAudienceIds: source.sourceAudienceIds,
      });
      await dependencies.repository.markFinalized(pending.token, resource._id);
      return resource;
    },

    async discardPendingUpload(token: string, actor: ManagedUploadActor): Promise<void> {
      const pending = await loadOwnedPending(token, actor);
      if (pending.status === "finalized") throw new Error("Upload đã được gắn với dữ liệu nguồn.");
      await dependencies.storage.delete(pending);
      await dependencies.repository.remove(pending.token);
    },

    async trashFinalizedUpload(token: string, actor: ManagedUploadActor, deletedAt = new Date()): Promise<void> {
      const pending = await loadOwnedPending(token, actor);
      if (pending.status !== "finalized" || !pending.finalizedResourceId) return;
      if (!dependencies.indexer.trashResourceById) throw new Error("Bộ index tài nguyên không hỗ trợ xóa mềm theo upload.");
      await dependencies.indexer.trashResourceById(pending.companyCode, pending.finalizedResourceId, deletedAt);
    },

    async purgeExpiredUploadRecords(expiresBefore = now(), limit = 100) {
      const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit || 100)));
      const records = await dependencies.repository.findExpired(expiresBefore, safeLimit);
      let purged = 0;
      let failed = 0;
      for (const record of records) {
        try {
          if (record.status === "pending") await dependencies.storage.delete(record);
          await dependencies.repository.remove(record.token);
          purged += 1;
        } catch (error) {
          failed += 1;
          console.error(`[ManagedUpload] Không thể dọn upload hết hạn ${record.token}; giữ lại metadata.`, error);
        }
      }
      return { scanned: records.length, purged, failed };
    },
  };
}

export const managedUploadService = createManagedUploadService({
  repository: mongooseRepository,
  storage: cloudinaryStorage,
  indexer: resourceIndexingService,
});
