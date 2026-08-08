import {
  managedUploadService,
  type FinalizeManagedUploadInput,
  type ManagedUploadActor,
} from "./managed-upload.service";
import type { ResourceIndexingRecord } from "./resource-indexing.service";

export interface SourceUploadReference {
  uploadToken?: string;
  sourceField: string;
}

export interface FinalizeSourceUploadsInput extends Omit<FinalizeManagedUploadInput, "sourceField"> {
  uploads: SourceUploadReference[];
}

interface ManagedUploadFinalizer {
  finalizeManagedUpload(
    token: string,
    actor: ManagedUploadActor,
    source: FinalizeManagedUploadInput,
  ): Promise<ResourceIndexingRecord>;
}

export function createSourceUploadFinalizer(managedUpload: ManagedUploadFinalizer) {
  return {
    async finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput) {
      const seen = new Set<string>();
      const resources: ResourceIndexingRecord[] = [];
      for (const upload of input.uploads) {
        const token = String(upload.uploadToken || "").trim();
        if (!token || seen.has(token)) continue;
        seen.add(token);
        resources.push(await managedUpload.finalizeManagedUpload(token, actor, {
          entityType: input.entityType,
          entityId: input.entityId,
          entityLabel: input.entityLabel,
          sourceRecordId: input.sourceRecordId,
          sourceField: upload.sourceField,
          sourceAudienceIds: input.sourceAudienceIds,
          ...(input.expectedSourceType ? { expectedSourceType: input.expectedSourceType } : {}),
        }));
      }
      return resources;
    },
  };
}

export const sourceUploadFinalizer = createSourceUploadFinalizer(managedUploadService);
