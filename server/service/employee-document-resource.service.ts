import type { ManagedUploadActor } from "./managed-upload.service";
import { sourceUploadFinalizer, type FinalizeSourceUploadsInput } from "./source-upload-finalizer.service";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

export function createEmployeeDocumentResourceService(finalizer: SourceFinalizer) {
  return {
    async finalizeJobDescription(actor: ManagedUploadActor, user: any, uploadToken?: string) {
      const userId = String(user._id || user.id || user.uid);
      return finalizer.finalize(actor, {
        entityType: "employee",
        entityId: userId,
        entityLabel: user.displayName || user.email || userId,
        sourceRecordId: userId,
        uploads: [{ uploadToken, sourceField: "jobDescriptionLink" }],
      });
    },
  };
}

export const employeeDocumentResourceService = createEmployeeDocumentResourceService(sourceUploadFinalizer);
