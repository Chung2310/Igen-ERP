import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentJobModel } from "../model/recruitment-job.model";
import { RecruitmentPipelineModel } from "../model/recruitment-pipeline.model";
import { RecruitmentStageHistoryModel } from "../model/recruitment-stage-history.model";
import { UserModel } from "../model/user.model";
import type { RecruitmentScope } from "../utils/recruitment-scope";

type ApplicantInput = Record<string, any> & { jobId: string; fullName: string };
const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const normalizePhone = (value: unknown) => String(value || "").replace(/[^\d+]/g, "");

async function validateRecruiter(scope: RecruitmentScope, recruiterId?: string | null) {
  if (!recruiterId) return;
  const recruiter = await UserModel.findOne({
    _id: recruiterId, companyCode: scope.companyCode, branchId: scope.branchId, isActive: true,
  }).select("_id").lean();
  if (!recruiter) throw new Error("Recruiter not found in branch");
}

export async function createApplicant(
  scope: RecruitmentScope,
  actorId: string,
  input: ApplicantInput,
  confirmDuplicate = false,
) {
  const job: any = await RecruitmentJobModel.findOne({ _id: input.jobId, ...scope, isDeleted: false }).lean();
  if (!job || job.status !== "open") throw new Error("Open job not found");
  const pipeline: any = await RecruitmentPipelineModel.findOne({ ...scope, isDeleted: false }).lean();
  const firstStage = [...(pipeline?.stages || [])]
    .filter((stage: any) => stage.isActive)
    .sort((a: any, b: any) => a.position - b.position)[0];
  if (!firstStage) throw new Error("Active pipeline stage not found");
  await validateRecruiter(scope, input.recruiterId);
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const duplicateTerms: Record<string, string>[] = [];
  if (normalizedEmail) duplicateTerms.push({ normalizedEmail });
  if (normalizedPhone) duplicateTerms.push({ normalizedPhone });
  if (!confirmDuplicate && duplicateTerms.length) {
    const matches = await RecruitmentApplicantModel.find({ ...scope, isDeleted: false, $or: duplicateTerms })
      .select("_id fullName email phone jobId createdAt")
      .lean();
    if (matches.length) return { duplicateWarning: true, matches };
  }
  return RecruitmentApplicantModel.create({
    ...input, ...scope, normalizedEmail, normalizedPhone, stageId: firstStage.id,
    outcome: "active", createdBy: actorId, updatedBy: actorId,
  });
}

export async function listApplicants(scope: RecruitmentScope, filters: Record<string, any> = {}) {
  const query: Record<string, any> = { ...scope, isDeleted: Boolean(filters.deleted) };
  for (const key of ["jobId", "stageId", "outcome", "recruiterId", "source"]) if (filters[key]) query[key] = filters[key];
  if (filters.search) query.$or = ["fullName", "email", "phone"].map((key) => ({ [key]: { $regex: String(filters.search), $options: "i" } }));
  return RecruitmentApplicantModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function getApplicant(scope: RecruitmentScope, id: string, includeDeleted = false) {
  const applicant = await RecruitmentApplicantModel.findOne({ _id: id, ...scope, isDeleted: includeDeleted }).lean();
  if (!applicant) throw new Error("Applicant not found");
  return applicant;
}

export async function updateApplicant(scope: RecruitmentScope, id: string, version: number, actorId: string, input: Record<string, any>) {
  await validateRecruiter(scope, input.recruiterId);
  const { companyCode: _companyCode, branchId: _branchId, stageId: _stageId, outcome: _outcome, version: _version, ...safe } = input;
  if ("email" in safe) safe.normalizedEmail = normalizeEmail(safe.email);
  if ("phone" in safe) safe.normalizedPhone = normalizePhone(safe.phone);
  const updated = await RecruitmentApplicantModel.findOneAndUpdate(
    { _id: id, ...scope, isDeleted: false, version },
    { $set: { ...safe, updatedBy: actorId }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new Error("Applicant version conflict");
  return updated;
}

export async function transitionApplicant(scope: RecruitmentScope, id: string, version: number, actorId: string, toStageId: string, note = "") {
  const [pipeline, applicant]: any[] = await Promise.all([
    RecruitmentPipelineModel.findOne({ ...scope, isDeleted: false }).lean(),
    RecruitmentApplicantModel.findOne({ _id: id, ...scope, isDeleted: false }).lean(),
  ]);
  if (!applicant) throw new Error("Applicant not found");
  if (applicant.version !== version) throw new Error("Applicant version conflict");
  const fromStage = pipeline?.stages?.find((stage: any) => stage.id === applicant.stageId);
  const toStage = pipeline?.stages?.find((stage: any) => stage.id === toStageId && stage.isActive);
  if (!fromStage || !toStage) throw new Error("Pipeline stage not found");
  const updated = await RecruitmentApplicantModel.findOneAndUpdate(
    { _id: id, ...scope, isDeleted: false, version },
    { $set: { stageId: toStage.id, outcome: toStage.terminalOutcome || "active", updatedBy: actorId }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new Error("Applicant version conflict");
  await RecruitmentStageHistoryModel.create({
    ...scope, applicantId: id, fromStageId: fromStage.id, fromStageName: fromStage.name,
    toStageId: toStage.id, toStageName: toStage.name, actorId, note,
  });
  return updated;
}

async function deleteState(scope: RecruitmentScope, id: string, version: number, actorId: string, restore: boolean) {
  const updated = await RecruitmentApplicantModel.findOneAndUpdate(
    { _id: id, ...scope, isDeleted: !restore, version },
    { $set: { isDeleted: !restore, deletedAt: restore ? new Date() : null, deletedBy: restore ? actorId : null, updatedBy: actorId }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new Error("Applicant version conflict");
  return updated;
}

export const softDeleteApplicant = (scope: RecruitmentScope, id: string, version: number, actorId: string) => deleteState(scope, id, version, actorId, true);
export const restoreApplicant = (scope: RecruitmentScope, id: string, version: number, actorId: string) => deleteState(scope, id, version, actorId, false);
