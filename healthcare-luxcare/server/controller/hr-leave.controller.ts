import type { Request, Response } from "express";
import { managedUploadService } from "../service/managed-upload.service";
import { hrLeaveTemplateService } from "../service/hr-leave-template.service";
import { hrLeaveApplicationService } from "../service/hr-leave-application.service";

interface HrLeaveControllerDependencies {
  templates: typeof hrLeaveTemplateService;
  applications: typeof hrLeaveApplicationService;
  createPendingUpload(actor: any, input: any): Promise<{ fileUrl: string; token: string }>;
}

const scope = (req: any) => ({
  companyCode: String(req.user?.companyCode || ""),
  ...(req.user?.branchId ? { branchId: String(req.user.branchId) } : {}),
});
const actor = (req: any) => ({
  ...scope(req),
  id: String(req.user?.id || ""),
  actorId: String(req.user?.id || ""),
  actorName: String(req.user?.email || ""),
  role: String(req.user?.role || "user"),
});
const fail = (res: Response, error: any) => res.status(error?.status || 500).json({
  status: "error",
  ...(error?.code ? { code: error.code } : {}),
  message: error?.message || "Không thể xử lý yêu cầu đơn từ.",
});

export function createHrLeaveController(deps: HrLeaveControllerDependencies) {
  return {
    async uploadFile(req: Request, res: Response) {
      try {
        const pending = await deps.createPendingUpload(actor(req), {
          sourceType: "hr.leave",
          file: req.body.file,
          fileName: req.body.fileName,
          mimeType: req.body.mimeType,
          size: req.body.size,
        });
        return res.status(201).json({ status: "success", data: { url: pending.fileUrl, uploadToken: pending.token } });
      } catch (error) { return fail(res, error); }
    },
    async listTemplates(req: Request, res: Response) {
      try { return res.json({ status: "success", data: await deps.templates.listTemplates(scope(req)) }); }
      catch (error) { return fail(res, error); }
    },
    async createTemplate(req: Request, res: Response) {
      try { return res.status(201).json({ status: "success", data: await deps.templates.createTemplate(scope(req), actor(req), req.body) }); }
      catch (error) { return fail(res, error); }
    },
    async deleteTemplate(req: Request, res: Response) {
      try { return res.json({ status: "success", data: await deps.templates.deleteTemplate(scope(req), actor(req), req.params.id) }); }
      catch (error) { return fail(res, error); }
    },
    async listApplications(req: Request, res: Response) {
      try { const result = await deps.applications.listApplications(scope(req), actor(req), req.query); return res.json({ status: "success", data: result.data, pagination: result.pagination }); }
      catch (error) { return fail(res, error); }
    },
    async createApplication(req: Request, res: Response) {
      try { return res.status(201).json({ status: "success", data: await deps.applications.createApplication(scope(req), actor(req), req.body) }); }
      catch (error) { return fail(res, error); }
    },
    async decideApplication(req: Request, res: Response) {
      try { return res.json({ status: "success", data: await deps.applications.decideApplication(scope(req), actor(req), req.params.id, req.body) }); }
      catch (error) { return fail(res, error); }
    },
    async deleteApplication(req: Request, res: Response) {
      try { return res.json({ status: "success", data: await deps.applications.deleteApplication(scope(req), actor(req), req.params.id) }); }
      catch (error) { return fail(res, error); }
    },
  };
}

export const hrLeaveController = createHrLeaveController({
  templates: hrLeaveTemplateService,
  applications: hrLeaveApplicationService,
  createPendingUpload: (uploadActor, input) => managedUploadService.createPendingUpload(uploadActor, input),
});
