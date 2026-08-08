import type { ManagedUploadActor } from "./managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
} from "./source-upload-finalizer.service";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

function memberId(member: any): string {
  return String(member?.userId?._id || member?.userId?.id || member?.userId || "");
}

export function createChatResourceIndexingService(finalizer: SourceFinalizer) {
  return {
    async finalizeMessage(actor: ManagedUploadActor, message: any, room: any) {
      return finalizer.finalize(actor, {
        entityType: "chat-room",
        entityId: String(room._id),
        entityLabel: room.name || "Cuộc trò chuyện",
        sourceRecordId: String(message._id),
        sourceAudienceIds: (room.members || []).map(memberId).filter(Boolean),
        uploads: (message.attachments || []).map((attachment: any, index: number) => ({
          uploadToken: attachment.uploadToken,
          sourceField: `attachments.${index}`,
        })),
      });
    },
  };
}

export const chatResourceIndexingService = createChatResourceIndexingService(sourceUploadFinalizer);
