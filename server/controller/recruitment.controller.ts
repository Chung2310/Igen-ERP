import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { RecruitmentScope } from "../utils/recruitment-scope";
import * as jobs from "../service/recruitment-job.service";
import * as pipelines from "../service/recruitment-pipeline.service";
import * as applicants from "../service/recruitment-applicant.service";
import * as interviews from "../service/recruitment-interview.service";
import * as attachments from "../service/recruitment-attachment.service";

export type RecruitmentRequest = AuthenticatedRequest & { recruitmentScope?: RecruitmentScope; file?: Express.Multer.File };
const scope = (req: RecruitmentRequest) => {
  if (!req.recruitmentScope) throw new Error("Recruitment scope is required");
  return req.recruitmentScope;
};
const actor = (req: RecruitmentRequest) => String(req.user?.id || "");
const asyncHandler = (handler: (req: RecruitmentRequest, res: Response) => Promise<any>) =>
  async (req: RecruitmentRequest, res: Response, next: NextFunction) => { try { await handler(req, res); } catch (error) { next(error); } };
const ok = (res: Response, data: any, status = 200) => res.status(status).json({ data });

export const recruitmentController = {
  listJobs: asyncHandler(async (req, res) => ok(res, await jobs.listJobs(scope(req), req.query))),
  createJob: asyncHandler(async (req, res) => ok(res, await jobs.createJob(scope(req), actor(req), req.body), 201)),
  getJob: asyncHandler(async (req, res) => ok(res, await jobs.getJob(scope(req), req.params.id))),
  updateJob: asyncHandler(async (req, res) => ok(res, await jobs.updateJob(scope(req), req.params.id, req.body.version, actor(req), req.body))),
  jobStatus: asyncHandler(async (req, res) => ok(res, await jobs.changeJobStatus(scope(req), req.params.id, req.body.version, actor(req), req.body.status))),
  deleteJob: asyncHandler(async (req, res) => ok(res, await jobs.softDeleteJob(scope(req), req.params.id, req.body.version, actor(req)))),
  restoreJob: asyncHandler(async (req, res) => ok(res, await jobs.restoreJob(scope(req), req.params.id, req.body.version, actor(req)))),
  getPipeline: asyncHandler(async (req, res) => ok(res, await pipelines.getOrCreatePipeline(scope(req), actor(req)))),
  savePipeline: asyncHandler(async (req, res) => ok(res, await pipelines.savePipeline(scope(req), actor(req), req.body.version, req.body.stages))),
  listApplicants: asyncHandler(async (req, res) => ok(res, await applicants.listApplicants(scope(req), req.query))),
  createApplicant: asyncHandler(async (req, res) => { const { confirmDuplicate, ...input } = req.body; ok(res, await applicants.createApplicant(scope(req), actor(req), input, confirmDuplicate), 201); }),
  getApplicant: asyncHandler(async (req, res) => ok(res, await applicants.getApplicant(scope(req), req.params.id))),
  updateApplicant: asyncHandler(async (req, res) => ok(res, await applicants.updateApplicant(scope(req), req.params.id, req.body.version, actor(req), req.body))),
  transitionApplicant: asyncHandler(async (req, res) => ok(res, await applicants.transitionApplicant(scope(req), req.params.id, req.body.version, actor(req), req.body.stageId, req.body.note))),
  deleteApplicant: asyncHandler(async (req, res) => ok(res, await applicants.softDeleteApplicant(scope(req), req.params.id, req.body.version, actor(req)))),
  restoreApplicant: asyncHandler(async (req, res) => ok(res, await applicants.restoreApplicant(scope(req), req.params.id, req.body.version, actor(req)))),
  applicantHistory: asyncHandler(async (req, res) => ok(res, await applicants.listApplicantHistory(scope(req), req.params.id))),
  listInterviews: asyncHandler(async (req, res) => ok(res, await interviews.listInterviews(scope(req), req.query))),
  createInterview: asyncHandler(async (req, res) => ok(res, await interviews.createInterview(scope(req), actor(req), req.body), 201)),
  getInterview: asyncHandler(async (req, res) => ok(res, await interviews.getInterview(scope(req), req.params.id))),
  updateInterview: asyncHandler(async (req, res) => ok(res, await interviews.updateInterview(scope(req), req.params.id, req.body.version, actor(req), req.body))),
  deleteInterview: asyncHandler(async (req, res) => ok(res, await interviews.softDeleteInterview(scope(req), req.params.id, req.body.version, actor(req)))),
  restoreInterview: asyncHandler(async (req, res) => ok(res, await interviews.restoreInterview(scope(req), req.params.id, req.body.version, actor(req)))),
  uploadAttachment: asyncHandler(async (req, res) => { if (!req.file) throw new Error("Attachment is required"); ok(res, await attachments.uploadApplicantAttachment(scope(req), actor(req), req.params.applicantId, req.file), 201); }),
  downloadAttachment: asyncHandler(async (req, res) => ok(res, await attachments.downloadApplicantAttachment(scope(req), req.params.id))),
  deleteAttachment: asyncHandler(async (req, res) => ok(res, await attachments.deleteApplicantAttachment(scope(req), req.params.id, actor(req)))),
};
