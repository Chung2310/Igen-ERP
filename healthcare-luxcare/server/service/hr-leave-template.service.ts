import { HRLeaveTemplateModel } from "../model/hr-leave-template.model";
import type { LeaveRequestKind } from "../interface/hr-leave.interface";
import type { LeaveScope } from "./leave-approval-scope.service";
import { leaveResourceService } from "./leave-resource.service";
import type { ManagedUploadActor } from "./managed-upload.service";

export class LeaveOperationError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

interface TemplateInput {
  name: string;
  requestKind: LeaveRequestKind;
  fileUrl: string;
  fileName: string;
  uploadToken: string;
}

interface TemplateDependencies {
  list(scope: LeaveScope): Promise<any[]>;
  create(value: any): Promise<any>;
  remove(scope: LeaveScope, id: string): Promise<any | null>;
  finalizeTemplate(actor: ManagedUploadActor, template: any): Promise<unknown>;
  trashTemplate(actor: ManagedUploadActor, template: any): Promise<unknown>;
}

export function createHrLeaveTemplateService(deps: TemplateDependencies) {
  return {
    listTemplates: (scope: LeaveScope) => deps.list(scope),
    async createTemplate(scope: LeaveScope, actor: ManagedUploadActor, input: TemplateInput) {
      const template = await deps.create({
        companyCode: scope.companyCode,
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        name: input.name,
        requestKind: input.requestKind,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        uploadToken: input.uploadToken,
        uploadedBy: actor.actorId,
      });
      await deps.finalizeTemplate(actor, template);
      return template;
    },
    async deleteTemplate(scope: LeaveScope, actor: ManagedUploadActor, id: string) {
      const template = await deps.remove(scope, id);
      if (!template) throw new LeaveOperationError("LEAVE_TEMPLATE_NOT_FOUND", 404, "Không tìm thấy biểu mẫu.");
      await deps.trashTemplate(actor, template);
      return template;
    },
  };
}

const filter = (scope: LeaveScope) => ({
  companyCode: scope.companyCode,
  ...(scope.branchId ? { branchId: scope.branchId } : {}),
});

export const hrLeaveTemplateService = createHrLeaveTemplateService({
  list: (scope) => HRLeaveTemplateModel.find(filter(scope)).sort({ createdAt: -1 }).lean(),
  create: (value) => HRLeaveTemplateModel.create(value),
  remove: (scope, id) => HRLeaveTemplateModel.findOneAndDelete({ _id: id, ...filter(scope) }).lean(),
  finalizeTemplate: (actor, template) => leaveResourceService.finalizeTemplate(actor, template),
  trashTemplate: (actor, template) => leaveResourceService.trashTemplate(actor, template),
});
