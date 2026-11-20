import { managedUploadService, type ManagedUploadActor } from "./managed-upload.service";
import { sourceUploadFinalizer, type FinalizeSourceUploadsInput } from "./source-upload-finalizer.service";

interface LeaveResourceDependencies {
  finalize(actor: ManagedUploadActor, input: FinalizeSourceUploadsInput): Promise<unknown[]>;
  trash(token: string, actor: ManagedUploadActor): Promise<void>;
}

export function createLeaveResourceService(deps: LeaveResourceDependencies) {
  const trashTokens = async (actor: ManagedUploadActor, tokens: Array<string | undefined>) => {
    for (const token of tokens) if (token?.trim()) await deps.trash(token, actor);
  };
  return {
    finalizeTemplate(actor: ManagedUploadActor, template: any) {
      return deps.finalize(actor, {
        entityType: "leave-template",
        entityId: String(template._id),
        entityLabel: template.name,
        sourceRecordId: String(template._id),
        expectedSourceType: "hr.leave",
        uploads: [{ uploadToken: template.uploadToken, sourceField: "file" }],
      });
    },
    finalizeApplication(actor: ManagedUploadActor, application: any) {
      return deps.finalize(actor, {
        entityType: "employee",
        entityId: String(application.employeeId),
        entityLabel: application.employeeName,
        sourceRecordId: String(application._id),
        expectedSourceType: "hr.leave",
        sourceAudienceIds: [String(application.employeeId)],
        uploads: (application.attachments || []).map((item: any, index: number) => ({
          uploadToken: item.uploadToken,
          sourceField: `attachments.${index}`,
        })),
      });
    },
    trashTemplate(actor: ManagedUploadActor, template: any) {
      return trashTokens(actor, [template.uploadToken]);
    },
    trashApplication(actor: ManagedUploadActor, application: any) {
      return trashTokens(actor, (application.attachments || []).map((item: any) => item.uploadToken));
    },
  };
}

export const leaveResourceService = createLeaveResourceService({
  finalize: (actor, input) => sourceUploadFinalizer.finalize(actor, input),
  trash: (token, actor) => managedUploadService.trashFinalizedUpload(token, actor),
});
