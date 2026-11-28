import { Router, type NextFunction, type Response } from "express";
import Joi from "joi";
import multer from "multer";
import { recruitmentController as controller, type RecruitmentRequest } from "../controller/recruitment.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { resolveRecruitmentScope } from "../utils/recruitment-scope";
import { applicantBodySchema, applicantHistoryQuerySchema, applicantUpdateBodySchema, interviewBodySchema, interviewUpdateBodySchema, jobBodySchema, jobUpdateBodySchema, statusBodySchema, transitionBodySchema, validateBody, validateQuery, versionBodySchema } from "../validation/recruitment.validation";

export const recruitmentRouter = Router();
const readPermission = requirePermission("recruitment:read");
const managePermission = requirePermission("recruitment:manage");
async function readPermissionGuard(req: RecruitmentRequest, res: Response, next: NextFunction) { return readPermission(req, res, next); }
async function managePermissionGuard(req: RecruitmentRequest, res: Response, next: NextFunction) { return managePermission(req, res, next); }
async function recruitmentScopeGuard(req: RecruitmentRequest, res: Response, next: NextFunction) {
  try { req.recruitmentScope = await resolveRecruitmentScope(req); return next(); }
  catch (error: any) { return res.status(403).json({ status: "error", message: error.message }); }
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const assistantReportQuerySchema = Joi.object({
  reportType: Joi.string().valid("overview", "interviews", "interview-count", "interviewers", "interview-results", "hires", "onboarded", "job-applications", "staffing-gaps", "job-deadlines", "applicants-by-department").required(),
  from: Joi.date().iso(), to: Joi.date().iso(), search: Joi.string().trim().max(200), rank: Joi.string().valid("most", "least"),
  branchId: Joi.string(), companyCode: Joi.string(), page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100),
}).unknown(false);
function validateAssistantReportQuery(req: any, res: Response, next: NextFunction) {
  const result = assistantReportQuerySchema.validate(req.query, { abortEarly: false, convert: true, stripUnknown: false });
  if (result.error) return res.status(400).json({ status: "error", message: result.error.message });
  return next();
}

recruitmentRouter.use(requireAuth as any);
recruitmentRouter.use(requireModule("hr"));
recruitmentRouter.use(recruitmentScopeGuard as any);

recruitmentRouter.get("/jobs", readPermissionGuard as any, controller.listJobs);
recruitmentRouter.get("/reports/assistant", readPermissionGuard as any, validateAssistantReportQuery, controller.assistantReport);
recruitmentRouter.post("/jobs", managePermissionGuard as any, validateBody(jobBodySchema), controller.createJob);
recruitmentRouter.get("/jobs/:id", readPermissionGuard as any, controller.getJob);
recruitmentRouter.patch("/jobs/:id", managePermissionGuard as any, validateBody(jobUpdateBodySchema), controller.updateJob);
recruitmentRouter.post("/jobs/:id/status", managePermissionGuard as any, validateBody(statusBodySchema), controller.jobStatus);
recruitmentRouter.post("/jobs/:id/delete", managePermissionGuard as any, validateBody(versionBodySchema), controller.deleteJob);
recruitmentRouter.post("/jobs/:id/restore", managePermissionGuard as any, validateBody(versionBodySchema), controller.restoreJob);
recruitmentRouter.get("/pipeline", readPermissionGuard as any, controller.getPipeline);
recruitmentRouter.get("/applicants", readPermissionGuard as any, controller.listApplicants);
recruitmentRouter.post("/applicants", managePermissionGuard as any, validateBody(applicantBodySchema), controller.createApplicant);
recruitmentRouter.get("/applicants/:id", readPermissionGuard as any, controller.getApplicant);
recruitmentRouter.patch("/applicants/:id", managePermissionGuard as any, validateBody(applicantUpdateBodySchema), controller.updateApplicant);
recruitmentRouter.post("/applicants/:id/transition", managePermissionGuard as any, validateBody(transitionBodySchema), controller.transitionApplicant);
recruitmentRouter.post("/applicants/:id/delete", managePermissionGuard as any, validateBody(versionBodySchema), controller.deleteApplicant);
recruitmentRouter.post("/applicants/:id/restore", managePermissionGuard as any, validateBody(versionBodySchema), controller.restoreApplicant);
recruitmentRouter.get("/applicants/:id/history", readPermissionGuard as any, validateQuery(applicantHistoryQuerySchema), controller.applicantHistory);
recruitmentRouter.get("/interviews", readPermissionGuard as any, controller.listInterviews);
recruitmentRouter.post("/interviews", managePermissionGuard as any, validateBody(interviewBodySchema), controller.createInterview);
recruitmentRouter.get("/interviews/:id", readPermissionGuard as any, controller.getInterview);
recruitmentRouter.patch("/interviews/:id", managePermissionGuard as any, validateBody(interviewUpdateBodySchema), controller.updateInterview);
recruitmentRouter.post("/interviews/:id/delete", managePermissionGuard as any, validateBody(versionBodySchema), controller.deleteInterview);
recruitmentRouter.post("/interviews/:id/restore", managePermissionGuard as any, validateBody(versionBodySchema), controller.restoreInterview);
recruitmentRouter.get("/jobs/:jobId/attachment", readPermissionGuard as any, controller.getJobAttachment);
recruitmentRouter.post("/jobs/:jobId/attachment", managePermissionGuard as any, upload.single("file"), controller.uploadJobAttachment);
recruitmentRouter.get("/applicants/:applicantId/attachment", readPermissionGuard as any, controller.getApplicantAttachment);
recruitmentRouter.post("/applicants/:applicantId/attachment", managePermissionGuard as any, upload.single("file"), controller.uploadApplicantAttachment);
recruitmentRouter.get("/attachments/:id/download", readPermissionGuard as any, controller.downloadAttachment);
recruitmentRouter.delete("/attachments/:id", managePermissionGuard as any, controller.deleteAttachment);
recruitmentRouter.post("/files/public", managePermissionGuard as any, upload.single("file"), controller.uploadPublicFile);
recruitmentRouter.delete("/files/public", managePermissionGuard as any, controller.deletePublicFile);

recruitmentRouter.use((error: any, _req: RecruitmentRequest, res: Response, _next: NextFunction) => {
  const message = error?.message || "Recruitment request failed";
  const status = /version conflict/i.test(message) ? 409 : /not found/i.test(message) ? 404 : error?.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  return res.status(status).json({ status: "error", message });
});
