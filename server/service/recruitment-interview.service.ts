import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentInterviewModel } from "../model/recruitment-interview.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import { UserModel } from "../model/user.model";
import type { RecruitmentScope } from "../utils/recruitment-scope";

async function validateReferences(scope: RecruitmentScope, input: Record<string, any>) {
  if (!input.applicantId || !input.jobId) throw new Error("Applicant and job are required");
  const [applicant, job]: any[] = await Promise.all([
    RecruitmentApplicantModel.findOne({ _id: input.applicantId, ...scope, isDeleted: false }).lean(),
    RecruitmentJobModel.findOne({ _id: input.jobId, ...scope, isDeleted: false }).lean(),
  ]);
  if (!applicant || !job || String(applicant.jobId) !== String(job._id)) throw new Error("Applicant or job not found in branch");
  const interviewerIds = [...new Set((input.interviewerIds || []).map(String))];
  if (interviewerIds.length) {
    const count = await UserModel.countDocuments({ _id: { $in: interviewerIds }, ...scope, isActive: true });
    if (count !== interviewerIds.length) throw new Error("Interviewer not found in branch");
  }
  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error("Interview end must follow start");
}

export async function createInterview(scope: RecruitmentScope, actorId: string, input: Record<string, any>) {
  await validateReferences(scope, input);
  return RecruitmentInterviewModel.create({ ...input, ...scope, createdBy: actorId, updatedBy: actorId });
}

export async function listInterviews(scope: RecruitmentScope, filters: Record<string, any> = {}) {
  const query: Record<string, any> = { ...scope, isDeleted: Boolean(filters.deleted) };
  for (const key of ["jobId", "applicantId", "status"]) if (filters[key]) query[key] = filters[key];
  if (filters.interviewerId) query.interviewerIds = filters.interviewerId;
  if (filters.from || filters.to) query.scheduledStart = { ...(filters.from && { $gte: new Date(filters.from) }), ...(filters.to && { $lte: new Date(filters.to) }) };
  return RecruitmentInterviewModel.find(query).sort({ scheduledStart: 1 }).lean();
}

export async function getInterview(scope: RecruitmentScope, id: string, includeDeleted = false) {
  const value = await RecruitmentInterviewModel.findOne({ _id: id, ...scope, isDeleted: includeDeleted }).lean();
  if (!value) throw new Error("Interview not found");
  return value;
}

export async function updateInterview(scope: RecruitmentScope, id: string, version: number, actorId: string, input: Record<string, any>) {
  const { companyCode: _companyCode, branchId: _branchId, version: _version, ...safe } = input;
  if (safe.applicantId || safe.jobId || safe.interviewerIds || safe.scheduledStart || safe.scheduledEnd) {
    const current: any = await getInterview(scope, id);
    await validateReferences(scope, { ...current, ...safe });
  }
  const value = await RecruitmentInterviewModel.findOneAndUpdate(
    { _id: id, ...scope, isDeleted: false, version },
    { $set: { ...safe, updatedBy: actorId }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!value) throw new Error("Interview version conflict");
  return value;
}

async function deleteState(scope: RecruitmentScope, id: string, version: number, actorId: string, deleting: boolean) {
  const value = await RecruitmentInterviewModel.findOneAndUpdate(
    { _id: id, ...scope, isDeleted: !deleting, version },
    { $set: { isDeleted: deleting, deletedAt: deleting ? new Date() : null, deletedBy: deleting ? actorId : null, updatedBy: actorId }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!value) throw new Error("Interview version conflict");
  return value;
}
export const softDeleteInterview = (scope: RecruitmentScope, id: string, version: number, actorId: string) => deleteState(scope, id, version, actorId, true);
export const restoreInterview = (scope: RecruitmentScope, id: string, version: number, actorId: string) => deleteState(scope, id, version, actorId, false);
