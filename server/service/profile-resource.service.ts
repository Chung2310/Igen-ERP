import type { ManagedUploadActor } from "./managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
} from "./source-upload-finalizer.service";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

export function createProfileResourceService(finalizer: SourceFinalizer) {
  return {
    async finalizeAvatar(actor: ManagedUploadActor, user: any, uploadToken?: string) {
      const userId = String(user._id || user.id || user.uid);
      return finalizer.finalize(actor, {
        entityType: "user",
        entityId: userId,
        entityLabel: user.displayName || user.email || userId,
        sourceRecordId: userId,
        uploads: [{ uploadToken, sourceField: "photoURL" }],
      });
    },
  };
}

export const profileResourceService = createProfileResourceService(sourceUploadFinalizer);
