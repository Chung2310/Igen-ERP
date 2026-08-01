import { Router, type NextFunction, type Response } from "express";
import multer from "multer";
import { recruitmentController as controller, type RecruitmentRequest } from "../controller/recruitment.controller";
import { RECRUITMENT_PERMISSION } from "../config/permission-catalog";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { resolveRecruitmentScope } from "../utils/recruitment-scope";
import { applicantBodySchema, applicantUpdateBodySchema, interviewBodySchema, interviewUpdateBodySchema, jobBodySchema, jobUpdateBodySchema, pipelineBodySchema, statusBodySchema, transitionBodySchema, validateBody, versionBodySchema } from "../validation/recruitment.validation";

export const recruitmentRouter = Router();
const permission = requirePermission(RECRUITMENT_PERMISSION);
async function permissionGuard(req: RecruitmentRequest, res: Response, next: NextFunction) { return permission(req, res, next); }
async function recruitmentScopeGuard(req: RecruitmentRequest, res: Response, next: NextFunction) {
  try { req.recruitmentScope = await resolveRecruitmentScope(req); return next(); }
  catch (error: any) { return res.status(403).json({ status: "error", message: error.message }); }
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

recruitmentRouter.use(requireAuth as any);
recruitmentRouter.use(requireModule("hr"));
recruitmentRouter.use(permissionGuard as any);
recruitmentRouter.use(recruitmentScopeGuard as any);

recruitmentRouter.get("/jobs", controller.listJobs);
recruitmentRouter.post("/jobs", validateBody(jobBodySchema), controller.createJob);
recruitmentRouter.get("/jobs/:id", controller.getJob);
recruitmentRouter.patch("/jobs/:id", validateBody(jobUpdateBodySchema), controller.updateJob);
recruitmentRouter.post("/jobs/:id/status", validateBody(statusBodySchema), controller.jobStatus);
recruitmentRouter.post("/jobs/:id/delete", validateBody(versionBodySchema), controller.deleteJob);
recruitmentRouter.post("/jobs/:id/restore", validateBody(versionBodySchema), controller.restoreJob);
recruitmentRouter.get("/pipeline", controller.getPipeline);
recruitmentRouter.put("/pipeline", validateBody(pipelineBodySchema), controller.savePipeline);
recruitmentRouter.get("/applicants", controller.listApplicants);
recruitmentRouter.post("/applicants", validateBody(applicantBodySchema), controller.createApplicant);
recruitmentRouter.get("/applicants/:id", controller.getApplicant);
recruitmentRouter.patch("/applicants/:id", validateBody(applicantUpdateBodySchema), controller.updateApplicant);
recruitmentRouter.post("/applicants/:id/transition", validateBody(transitionBodySchema), controller.transitionApplicant);
recruitmentRouter.post("/applicants/:id/delete", validateBody(versionBodySchema), controller.deleteApplicant);
recruitmentRouter.post("/applicants/:id/restore", validateBody(versionBodySchema), controller.restoreApplicant);
recruitmentRouter.get("/applicants/:id/history", controller.applicantHistory);
recruitmentRouter.get("/interviews", controller.listInterviews);
recruitmentRouter.post("/interviews", validateBody(interviewBodySchema), controller.createInterview);
recruitmentRouter.get("/interviews/:id", controller.getInterview);
recruitmentRouter.patch("/interviews/:id", validateBody(interviewUpdateBodySchema), controller.updateInterview);
recruitmentRouter.post("/interviews/:id/delete", validateBody(versionBodySchema), controller.deleteInterview);
recruitmentRouter.post("/interviews/:id/restore", validateBody(versionBodySchema), controller.restoreInterview);
recruitmentRouter.get("/jobs/:jobId/attachment", controller.getJobAttachment);
recruitmentRouter.post("/jobs/:jobId/attachment", upload.single("file"), controller.uploadJobAttachment);
recruitmentRouter.get("/applicants/:applicantId/attachment", controller.getApplicantAttachment);
recruitmentRouter.post("/applicants/:applicantId/attachment", upload.single("file"), controller.uploadApplicantAttachment);
recruitmentRouter.get("/attachments/:id/download", controller.downloadAttachment);
recruitmentRouter.delete("/attachments/:id", controller.deleteAttachment);
recruitmentRouter.post("/files/public", upload.single("file"), controller.uploadPublicFile);
recruitmentRouter.delete("/files/public", controller.deletePublicFile);

recruitmentRouter.use((error: any, _req: RecruitmentRequest, res: Response, _next: NextFunction) => {
  const message = error?.message || "Recruitment request failed";
  const status = /version conflict/i.test(message) ? 409 : /not found/i.test(message) ? 404 : error?.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  return res.status(status).json({ status: "error", message });
});
