import { RecruitmentJobModel } from "../model/recruitment-job.model";
import type { RecruitmentScope } from "../utils/recruitment-scope";
import { cloudinaryService } from "./cloudinary.service";

type JobStatus = "draft" | "open" | "paused" | "closed";
type JobInput = Record<string, any> & { code?: string; status?: JobStatus };

function assertReadyToOpen(job: JobInput) {
  const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : null;
  if (
    !String(job.title || "").trim() ||
    !String(job.description || "").trim() ||
    !String(job.requirements || "").trim() ||
    !Number.isFinite(Number(job.headcount)) ||
    Number(job.headcount) <= 0 ||
    !String(job.workplaceType || "").trim() ||
    !String(job.location || "").trim() ||
    !deadline ||
    Number.isNaN(deadline.getTime()) ||
    deadline <= new Date()
  ) {
    throw new Error("Job is not ready to open");
  }
}

export async function createJob(scope: RecruitmentScope, actorId: string, input: JobInput) {
  if (input.status === "open") assertReadyToOpen(input);
  return RecruitmentJobModel.create({
    ...input,
    ...scope,
    code: String(input.code || "").trim().toUpperCase(),
    createdBy: actorId,
    updatedBy: actorId,
  });
}

export async function listJobs(scope: RecruitmentScope, filters: Record<string, any> = {}) {
  const query: Record<string, any> = { ...scope, isDeleted: Boolean(filters.deleted) };
  if (filters.status) query.status = filters.status;
  if (filters.search) {
    const search = new RegExp(String(filters.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ code: search }, { title: search }, { department: search }];
  }
  return RecruitmentJobModel.find(query).sort({ createdAt: -1 }).lean();
}

export async function getJob(scope: RecruitmentScope, id: string, includeDeleted = false) {
  const job = await RecruitmentJobModel.findOne({ _id: id, ...scope, isDeleted: includeDeleted }).lean();
  if (!job) throw new Error("Job not found");
  return job;
}

async function versionedUpdate(
  scope: RecruitmentScope,
  id: string,
  version: number,
  actorId: string,
  update: Record<string, any>,
  isDeleted: boolean,
) {
  const job = await RecruitmentJobModel.findOneAndUpdate(
    { _id: id, ...scope, isDeleted, version },
    { ...update, $set: { ...(update.$set || {}), updatedBy: actorId }, $inc: { version: 1 } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!job) throw new Error("Job version conflict");
  return job;
}

export async function updateJob(
  scope: RecruitmentScope,
  id: string,
  version: number,
  actorId: string,
  input: JobInput,
) {
  if (input.status === "open") assertReadyToOpen(input);
  const { companyCode: _companyCode, branchId: _branchId, version: _version, ...safeInput } = input;
  let previousPublicId = "";
  if ("jdFileUrl" in safeInput || "jdFilePublicId" in safeInput) {
    const current: any = await RecruitmentJobModel.findOne({ _id: id, ...scope, isDeleted: false }).lean();
    if (!current) throw new Error("Job not found");
    previousPublicId = current.jdFilePublicId || "";
    if (safeInput.jdFileUrl !== current.jdFileUrl && !safeInput.jdFilePublicId) safeInput.jdFilePublicId = "";
  }
  const updated: any = await versionedUpdate(scope, id, version, actorId, { $set: safeInput }, false);
  if (previousPublicId && previousPublicId !== updated.jdFilePublicId) await cloudinaryService.deletePublicRaw(previousPublicId).catch((error) => console.warn("[recruitment-job] Public JD cleanup failed:", (error as Error).message));
  return updated;
}

export async function changeJobStatus(
  scope: RecruitmentScope,
  id: string,
  version: number,
  actorId: string,
  status: JobStatus,
) {
  if (status === "open") {
    const current = await getJob(scope, id);
    assertReadyToOpen(current as JobInput);
  }
  return versionedUpdate(scope, id, version, actorId, { $set: { status } }, false);
}

export function softDeleteJob(scope: RecruitmentScope, id: string, version: number, actorId: string) {
  return versionedUpdate(
    scope,
    id,
    version,
    actorId,
    { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId } },
    false,
  );
}

export function restoreJob(scope: RecruitmentScope, id: string, version: number, actorId: string) {
  return versionedUpdate(
    scope,
    id,
    version,
    actorId,
    { $set: { isDeleted: false, deletedAt: null, deletedBy: null } },
    true,
  );
}
