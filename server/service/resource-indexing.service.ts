import {
  buildResourceSourceRoute,
  buildSystemFolderKey,
  getResourceSourceDefinition,
} from "../config/resource-source-registry";
import {
  ResourceItemModel,
  type ResourceStorageAccess,
  type ResourceStorageProvider,
} from "../model/resource-item.model";

export interface RegisterUploadedResourceInput {
  companyCode: string;
  branchId?: string;
  sourceType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  sourceRecordId: string;
  sourceField?: string;
  sourceKey: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  size?: number;
  storageProvider: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  storageAccess?: ResourceStorageAccess;
  uploaderId?: string;
  uploaderName?: string;
  sourceAudienceIds?: string[];
}

export interface ResourceIndexingRecord {
  _id: string;
  companyCode: string;
  section?: "local" | "drive";
  type: "folder" | "file";
  name: string;
  parentId: string | null;
  managedType?: "user" | "system";
  systemFolderKey?: string;
  sourceKey?: string;
  sourceType?: string;
  sourceModule?: string;
  sourceGroup?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceEntityLabel?: string;
  sourceRecordId?: string;
  sourceField?: string;
  sourceRoute?: string;
  branchId?: string;
  requiredPermissions?: string[];
  sourceAudienceIds?: string[];
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  storageProvider?: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  storageAccess?: ResourceStorageAccess;
  creatorUid?: string;
  creatorName?: string;
  isFixed?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | null;
}

export interface SystemFolderUpsertInput {
  companyCode: string;
  name: string;
  parentId: string | null;
  systemFolderKey: string;
  sourceType?: string;
  sourceModule: string;
  sourceGroup?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceEntityLabel?: string;
  sourceRoute?: string;
  branchId?: string;
  requiredPermissions: string[];
  sourceAudienceIds?: string[];
}

export interface SystemFileCreateInput extends Omit<ResourceIndexingRecord, "_id" | "type"> {
  type?: never;
}

export interface ResourceIndexingRepository {
  findBySourceKey(companyCode: string, sourceKey: string): Promise<ResourceIndexingRecord | null>;
  upsertSystemFolder(input: SystemFolderUpsertInput): Promise<ResourceIndexingRecord>;
  createSystemFile(input: SystemFileCreateInput): Promise<ResourceIndexingRecord>;
  setSourceDeleted(companyCode: string, sourceKey: string, deletedAt: Date | null): Promise<ResourceIndexingRecord | null>;
  setResourceDeleted(companyCode: string, resourceId: string, deletedAt: Date | null): Promise<ResourceIndexingRecord | null>;
  setSourceRecordDeleted(companyCode: string, sourceType: string, sourceRecordId: string, deletedAt: Date | null): Promise<number>;
  setOlderSourceFieldDeleted(
    companyCode: string,
    sourceType: string,
    sourceRecordId: string,
    sourceField: string,
    keepResourceId: string,
    deletedAt: Date,
  ): Promise<number>;
}

function toRecord(value: any): ResourceIndexingRecord {
  return { ...value, _id: String(value._id), parentId: value.parentId ? String(value.parentId) : null };
}

const mongooseRepository: ResourceIndexingRepository = {
  async findBySourceKey(companyCode, sourceKey) {
    const item = await ResourceItemModel.findOne({ companyCode, sourceKey }).lean();
    return item ? toRecord(item) : null;
  },

  async upsertSystemFolder(input) {
    const item = await ResourceItemModel.findOneAndUpdate(
      { companyCode: input.companyCode, systemFolderKey: input.systemFolderKey },
      {
        $set: {
          name: input.name,
          parentId: input.parentId,
          sourceRoute: input.sourceRoute,
          sourceEntityLabel: input.sourceEntityLabel,
          sourceAudienceIds: input.sourceAudienceIds,
        },
        $setOnInsert: {
          companyCode: input.companyCode,
          section: "local",
          type: "folder",
          managedType: "system",
          isFixed: true,
          isDeleted: false,
          systemFolderKey: input.systemFolderKey,
          sourceType: input.sourceType,
          sourceModule: input.sourceModule,
          sourceGroup: input.sourceGroup,
          sourceEntityType: input.sourceEntityType,
          sourceEntityId: input.sourceEntityId,
          branchId: input.branchId,
          creatorUid: "system",
          creatorName: "Hệ thống",
        },
        $addToSet: { requiredPermissions: { $each: input.requiredPermissions } },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    ).lean();
    if (!item) throw new Error("Không thể tạo thư mục tài nguyên hệ thống.");
    return toRecord(item);
  },

  async createSystemFile(input) {
    const item = await ResourceItemModel.create({ ...input, section: "local", type: "file" });
    return toRecord(item.toObject());
  },

  async setSourceDeleted(companyCode, sourceKey, deletedAt) {
    const update = deletedAt
      ? { $set: { isDeleted: true, deletedAt } }
      : { $set: { isDeleted: false }, $unset: { deletedAt: 1 } };
    const item = await ResourceItemModel.findOneAndUpdate(
      { companyCode, sourceKey, managedType: "system" },
      update,
      { returnDocument: 'after' },
    ).lean();
    return item ? toRecord(item) : null;
  },
  async setResourceDeleted(companyCode, resourceId, deletedAt) {
    const update = deletedAt
      ? { $set: { isDeleted: true, deletedAt } }
      : { $set: { isDeleted: false }, $unset: { deletedAt: 1 } };
    const item = await ResourceItemModel.findOneAndUpdate(
      { _id: resourceId, companyCode, managedType: "system" },
      update,
      { returnDocument: 'after' },
    ).lean();
    return item ? toRecord(item) : null;
  },
  async setSourceRecordDeleted(companyCode, sourceType, sourceRecordId, deletedAt) {
    const update = deletedAt
      ? { $set: { isDeleted: true, deletedAt } }
      : { $set: { isDeleted: false }, $unset: { deletedAt: 1 } };
    const result = await ResourceItemModel.updateMany(
      { companyCode, sourceType, sourceRecordId, managedType: "system" },
      update,
    );
    return result.modifiedCount;
  },
  async setOlderSourceFieldDeleted(companyCode, sourceType, sourceRecordId, sourceField, keepResourceId, deletedAt) {
    const result = await ResourceItemModel.updateMany(
      {
        companyCode,
        sourceType,
        sourceRecordId,
        sourceField,
        _id: { $lt: keepResourceId },
        managedType: "system",
        isDeleted: false,
      },
      { $set: { isDeleted: true, deletedAt } },
    );
    return result.modifiedCount;
  },
};

function requireText(value: string, label: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} là bắt buộc.`);
  return normalized;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;
}

export function createResourceIndexingService(repository: ResourceIndexingRepository = mongooseRepository) {
  return {
    async registerUploadedResource(rawInput: RegisterUploadedResourceInput): Promise<ResourceIndexingRecord> {
      const input = {
        ...rawInput,
        companyCode: requireText(rawInput.companyCode, "Mã công ty").toUpperCase(),
        sourceKey: requireText(rawInput.sourceKey, "Khóa nguồn"),
        entityId: requireText(rawInput.entityId, "Mã đối tượng"),
        entityLabel: requireText(rawInput.entityLabel, "Tên đối tượng"),
        sourceRecordId: requireText(rawInput.sourceRecordId, "Mã bản ghi nguồn"),
        sourceField: String(rawInput.sourceField || "").trim() || undefined,
        fileName: requireText(rawInput.fileName, "Tên tệp"),
        fileUrl: rawInput.storageAccess === "authenticated"
          ? String(rawInput.fileUrl || "").trim()
          : requireText(rawInput.fileUrl, "Đường dẫn tệp"),
      };
      const definition = getResourceSourceDefinition(input.sourceType);
      const existing = await repository.findBySourceKey(input.companyCode, input.sourceKey);
      const retirePreviousFieldVersion = async (resource: ResourceIndexingRecord) => {
        if (input.sourceField) {
          await repository.setOlderSourceFieldDeleted(
            input.companyCode,
            definition.sourceType,
            input.sourceRecordId,
            input.sourceField,
            resource._id,
            new Date(),
          );
        }
        return resource;
      };
      if (existing) return retirePreviousFieldVersion(existing);

      const moduleFolder = await repository.upsertSystemFolder({
        companyCode: input.companyCode,
        name: definition.moduleLabel,
        parentId: null,
        systemFolderKey: buildSystemFolderKey(input.companyCode, "module", input.sourceType),
        sourceModule: definition.moduleKey,
        requiredPermissions: definition.requiredPermissions,
      });
      const groupFolder = await repository.upsertSystemFolder({
        companyCode: input.companyCode,
        name: definition.groupLabel,
        parentId: moduleFolder._id,
        systemFolderKey: buildSystemFolderKey(input.companyCode, "group", input.sourceType),
        sourceType: definition.sourceType,
        sourceModule: definition.moduleKey,
        sourceGroup: definition.groupKey,
        requiredPermissions: definition.requiredPermissions,
      });
      const sourceRoute = buildResourceSourceRoute(definition, input.entityId);
      const entityFolder = await repository.upsertSystemFolder({
        companyCode: input.companyCode,
        name: input.entityLabel,
        parentId: groupFolder._id,
        systemFolderKey: buildSystemFolderKey(input.companyCode, "entity", input.sourceType, input.entityId),
        sourceType: definition.sourceType,
        sourceModule: definition.moduleKey,
        sourceGroup: definition.groupKey,
        sourceEntityType: input.entityType,
        sourceEntityId: input.entityId,
        sourceEntityLabel: input.entityLabel,
        sourceRoute,
        branchId: input.branchId,
        requiredPermissions: definition.requiredPermissions,
        sourceAudienceIds: input.sourceAudienceIds,
      });

      try {
        const created = await repository.createSystemFile({
          companyCode: input.companyCode,
          section: "local",
          name: input.fileName,
          parentId: entityFolder._id,
          managedType: "system",
          isFixed: true,
          isDeleted: false,
          sourceKey: input.sourceKey,
          sourceType: definition.sourceType,
          sourceModule: definition.moduleKey,
          sourceGroup: definition.groupKey,
          sourceEntityType: input.entityType,
          sourceEntityId: input.entityId,
          sourceEntityLabel: input.entityLabel,
          sourceRecordId: input.sourceRecordId,
          sourceField: input.sourceField,
          sourceRoute,
          branchId: input.branchId,
          requiredPermissions: definition.requiredPermissions,
          sourceAudienceIds: input.sourceAudienceIds,
          fileUrl: input.fileUrl,
          mimeType: input.mimeType || "",
          size: input.size || 0,
          storageProvider: input.storageProvider,
          storagePublicId: input.storagePublicId,
          storageResourceType: input.storageResourceType,
          storageAccess: input.storageAccess,
          creatorUid: input.uploaderId || "system",
          creatorName: input.uploaderName || "Hệ thống",
        });
        return retirePreviousFieldVersion(created);
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          const winner = await repository.findBySourceKey(input.companyCode, input.sourceKey);
          if (winner) return retirePreviousFieldVersion(winner);
        }
        throw error;
      }
    },

    async trashSourceResource(companyCode: string, sourceKey: string, deletedAt = new Date()) {
      return repository.setSourceDeleted(companyCode.toUpperCase(), sourceKey, deletedAt);
    },

    async trashResourceById(companyCode: string, resourceId: string, deletedAt = new Date()) {
      return repository.setResourceDeleted(companyCode.toUpperCase(), resourceId, deletedAt);
    },

    async trashSourceRecordResources(companyCode: string, sourceType: string, sourceRecordId: string, deletedAt = new Date()) {
      getResourceSourceDefinition(sourceType);
      return repository.setSourceRecordDeleted(
        companyCode.toUpperCase(),
        sourceType.toLowerCase(),
        requireText(sourceRecordId, "Mã bản ghi nguồn"),
        deletedAt,
      );
    },

    async restoreSourceResource(companyCode: string, sourceKey: string) {
      return repository.setSourceDeleted(companyCode.toUpperCase(), sourceKey, null);
    },

    async replaceSourceResource(
      companyCode: string,
      previousSourceKey: string,
      next: RegisterUploadedResourceInput,
    ): Promise<ResourceIndexingRecord> {
      const deletedAt = new Date();
      const previous = await repository.setSourceDeleted(companyCode.toUpperCase(), previousSourceKey, deletedAt);
      try {
        return await this.registerUploadedResource(next);
      } catch (error) {
        if (previous) await repository.setSourceDeleted(companyCode.toUpperCase(), previousSourceKey, null);
        throw error;
      }
    },
  };
}

export const resourceIndexingService = createResourceIndexingService();
