import type { ManagedUploadActor } from "../../../service/managed-upload.service";
import {
  sourceUploadFinalizer,
  type FinalizeSourceUploadsInput,
} from "../../../service/source-upload-finalizer.service";

interface SourceFinalizer {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
}

export function createAssignmentResourceService(finalizer: SourceFinalizer) {
  return {
    async finalizeAssignment(actor: ManagedUploadActor, assignment: any, batch: any) {
      return finalizer.finalize(actor, {
        entityType: "batch",
        entityId: String(batch._id || batch.id),
        entityLabel: batch.code || batch.name || String(batch._id || batch.id),
        sourceRecordId: String(assignment._id || assignment.id),
        uploads: (assignment.attachments || []).map((attachment: any, index: number) => ({
          uploadToken: attachment.uploadToken,
          sourceField: `attachments.${index}`,
        })),
      });
    },

    async finalizeSubmission(actor: ManagedUploadActor, submission: any, student: any) {
      return finalizer.finalize(actor, {
        entityType: "student",
        entityId: String(student._id || student.id),
        entityLabel: student.fullName || String(student._id || student.id),
        sourceRecordId: String(submission._id || submission.id),
        uploads: (submission.attachments || []).map((attachment: any, index: number) => ({
          uploadToken: attachment.uploadToken,
          sourceField: `attachments.${index}`,
        })),
      });
    },
  };
}

export const assignmentResourceService = createAssignmentResourceService(sourceUploadFinalizer);
