import type { ManagedUploadActor } from "./managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
} from "./source-upload-finalizer.service";
import { resourceIndexingService } from "./resource-indexing.service";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

interface SourceLifecycle {
  trashSourceRecordResources(companyCode: string, sourceType: string, sourceRecordId: string): Promise<number>;
}

export function createCrudResourceFinalizationService(finalizer: SourceFinalizer, lifecycle?: SourceLifecycle) {
  return {
    async finalize(modelName: string, rawItem: any, actor: ManagedUploadActor) {
      const item = typeof rawItem?.toObject === "function" ? rawItem.toObject() : rawItem;
      const sourceRecordId = String(item?._id || item?.id || "");
      if (!sourceRecordId) return [];

      if (modelName === "hr-leave-templates") {
        return finalizer.finalize(actor, {
          entityType: "leave-template",
          entityId: sourceRecordId,
          entityLabel: item.name || "Biểu mẫu nhân sự",
          sourceRecordId,
          uploads: [{ uploadToken: item.uploadToken, sourceField: "file" }],
        });
      }
      if (modelName === "hr-leave-applications") {
        return finalizer.finalize(actor, {
          entityType: "employee",
          entityId: String(item.employeeId || sourceRecordId),
          entityLabel: item.employeeName || "Nhân viên",
          sourceRecordId,
          uploads: (item.attachments || []).map((attachment: any, index: number) => ({
            uploadToken: attachment.uploadToken,
            sourceField: `attachments.${index}`,
          })),
        });
      }
      if (modelName === "training-courses") {
        return finalizer.finalize(actor, {
          entityType: "training-course",
          entityId: sourceRecordId,
          entityLabel: item.title || "Khóa đào tạo",
          sourceRecordId,
          uploads: (item.lessons || []).map((lesson: any, index: number) => ({
            uploadToken: lesson.uploadToken,
            sourceField: `lessons.${index}`,
          })),
        });
      }
      if (modelName === "products") {
        return finalizer.finalize(actor, {
          entityType: "product",
          entityId: sourceRecordId,
          entityLabel: [item.sku, item.name].filter(Boolean).join(" - ") || "Sản phẩm",
          sourceRecordId,
          uploads: [{ uploadToken: item.uploadToken, sourceField: "image" }],
        });
      }
      return [];
    },

    async trash(modelName: string, rawItem: any, actor: ManagedUploadActor) {
      if (!lifecycle) return 0;
      const item = typeof rawItem?.toObject === "function" ? rawItem.toObject() : rawItem;
      const sourceRecordId = String(item?._id || item?.id || "");
      if (!sourceRecordId) return 0;
      const sourceTypeByModel: Record<string, string> = {
        "hr-leave-templates": "hr.leave",
        "hr-leave-applications": "hr.leave",
        "training-courses": "hr.training",
        products: "inventory.product",
      };
      const sourceType = sourceTypeByModel[modelName];
      if (!sourceType) return 0;
      return lifecycle.trashSourceRecordResources(actor.companyCode, sourceType, sourceRecordId);
    },
  };
}

export const crudResourceFinalizationService = createCrudResourceFinalizationService(sourceUploadFinalizer, resourceIndexingService);
