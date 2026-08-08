import type { ManagedUploadActor } from "../../../service/managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
  type SourceUploadReference,
} from "../../../service/source-upload-finalizer.service";
import type { ModuleKey } from "../interfaces/custom-field.interface";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

export interface CustomFieldResourceContext {
  tenantId: string;
  moduleKey: ModuleKey;
  actorId?: string;
  actorName?: string;
  branchId?: string;
}

function collectUploads(customFields: unknown): SourceUploadReference[] {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return [];
  const uploads: SourceUploadReference[] = [];
  for (const [key, value] of Object.entries(customFields)) {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((entry: any, index) => {
      if (entry && typeof entry === "object" && typeof entry.uploadToken === "string") {
        uploads.push({
          uploadToken: entry.uploadToken,
          sourceField: `customFields.${key}${Array.isArray(value) ? `.${index}` : ""}`,
        });
      }
    });
  }
  return uploads;
}

export function createCustomFieldResourceService(finalizer: SourceFinalizer) {
  return {
    async finalizeEntity(context: CustomFieldResourceContext, rawEntity: any) {
      if (!context.actorId) return [];
      const entity = typeof rawEntity?.toObject === "function" ? rawEntity.toObject() : rawEntity;
      const entityId = String(entity?._id || entity?.id || "");
      if (!entityId) return [];
      return finalizer.finalize({
        companyCode: context.tenantId,
        branchId: context.branchId || entity.branchId,
        actorId: context.actorId,
        actorName: context.actorName,
      }, {
        entityType: context.moduleKey,
        entityId,
        entityLabel: entity.fullName || entity.title || entity.name || entity.code || entityId,
        sourceRecordId: entityId,
        uploads: collectUploads(entity.customFields),
      });
    },
  };
}

export const customFieldResourceService = createCustomFieldResourceService(sourceUploadFinalizer);
