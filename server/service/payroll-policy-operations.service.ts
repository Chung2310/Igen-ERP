import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollPolicyModel } from "../model/payroll-policy.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollCalculationRevisionModel } from "../model/payroll-calculation-revision.model";
import { DEFAULT_VIETNAM_PAYROLL_POLICY } from "../config/payroll-default-policy";
import { CompanyModel } from "../model/company.model";
import { PayrollOperationError } from "./payroll-run-operations.service";
import { policyWindowsOverlap, replacementForPolicy, validatePolicyActivation, validatePolicyDefinition } from "./payroll-policy.service";

const raise = (failure: { code: string; message: string; status: number }) => {
  throw new PayrollOperationError(failure.code, failure.message, failure.status);
};

const auditPolicy = async (companyCode: string, actorId: string, metadata: Record<string, unknown>, session?: ClientSession) => {
  const value = { companyCode, periodKey: "policy", action: "adjustment" as const, actorId, metadata };
  if (!session) return PayrollAuditModel.create(value);
  const [created] = await PayrollAuditModel.create([value], { session });
  return created;
};

async function inTransaction<T>(operation: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (mongoose.connection.readyState !== 1) return operation();
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => { result = await operation(session); });
    return result;
  } finally { await session.endSession(); }
}

const withSession = (query: any, session?: ClientSession) => session ? query.session(session) : query;

export async function listPayrollPolicies(companyCode: string) {
  let policies: any[] = await PayrollPolicyModel.find({ companyCode }).sort({ effectiveFrom: -1 }).lean();
  if (policies.length) return policies;
  const company: any = await CompanyModel.findOne({ code: companyCode }).select("createdAt").lean();
  if (!company) return [];
  await ensureDefaultPayrollPolicy(companyCode, "system", company.createdAt);
  policies = await PayrollPolicyModel.find({ companyCode }).sort({ effectiveFrom: -1 }).lean();
  return policies;
}

export async function ensureDefaultPayrollPolicy(companyCode: string, actorId: string, effectiveFrom: Date | string) {
  const existing: any = await PayrollPolicyModel.findOne({ companyCode }).lean();
  if (existing) return existing;
  const start = new Date(effectiveFrom);
  const normalizedStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const { companyCode: _company, status: _status, createdBy: _creator, version: _version, ...definition } = DEFAULT_VIETNAM_PAYROLL_POLICY;
  try {
    return await PayrollPolicyModel.create({ ...definition, companyCode, status: "active", effectiveFrom: normalizedStart, createdBy: actorId, activatedBy: actorId, activatedAt: new Date() });
  } catch (error: any) {
    if (error?.code === 11000) {
      const raced: any = await PayrollPolicyModel.findOne({ companyCode }).lean();
      if (raced) return raced;
    }
    throw error;
  }
}

export async function createPayrollPolicy(companyCode: string, actorId: string, input: Record<string, any>) {
  const invalid = validatePolicyDefinition(input as any);
  if (invalid) raise(invalid);
  try {
    const policy: any = await PayrollPolicyModel.create({ ...input, companyCode, status: "draft", createdBy: actorId });
    await auditPolicy(companyCode, actorId, { operation: "create_policy", policyId: String(policy._id), code: policy.code });
    return policy;
  } catch (error: any) {
    if (error?.code === 11000) {
      raise({ code: "PAYROLL_POLICY_DUPLICATE", message: "A payroll policy with this code already exists", status: 409 });
    }
    throw error;
  }
}

export async function activatePayrollPolicy(companyCode: string, policyId: string, actorId: string, options: { replaceOverlaps?: boolean } = {}) {
  return inTransaction(async (session) => {
    const policy: any = await withSession(PayrollPolicyModel.findOne({ _id: policyId, companyCode }), session).lean();
    const active: any[] = await withSession(PayrollPolicyModel.find({ companyCode, status: "active", _id: { $ne: policyId } }).select("_id code name status effectiveFrom effectiveTo"), session).lean();
    const overlaps = policy ? active.filter((item) => policyWindowsOverlap(policy, item)) : [];
    const invalid = validatePolicyActivation(policy, options.replaceOverlaps ? [] : active);
    if (invalid) raise(invalid);

    const replacedPolicyIds: string[] = [];
    for (const existing of overlaps) {
      const replacement = replacementForPolicy(existing, policy.effectiveFrom);
      const update = replacement.action === "truncate"
        ? { $set: { effectiveTo: replacement.effectiveTo } }
        : { $set: { status: "retired", retiredBy: actorId } };
      const result = await PayrollPolicyModel.updateOne(
        { _id: existing._id, companyCode, status: "active", effectiveFrom: existing.effectiveFrom, ...(existing.effectiveTo ? { effectiveTo: existing.effectiveTo } : { effectiveTo: { $exists: false } }) }, update, { session },
      );
      if (result.matchedCount !== 1) raise({ code: "PAYROLL_POLICY_VERSION_CONFLICT", message: "An active payroll policy changed before replacement", status: 409 });
      replacedPolicyIds.push(String(existing._id));
      await auditPolicy(companyCode, actorId, {
        operation: replacement.action === "truncate" ? "truncate_policy" : "retire_overlapping_policy",
        policyId: String(existing._id), before: { status: "active", effectiveTo: existing.effectiveTo },
        after: replacement.action === "truncate" ? { status: "active", effectiveTo: replacement.effectiveTo } : { status: "retired" },
      }, session);
    }

    const previousStatus = policy.status;
    const activated: any = await withSession(PayrollPolicyModel.findOneAndUpdate(
      { _id: policyId, companyCode, status: previousStatus },
      { $set: { status: "active", activatedBy: actorId, activatedAt: new Date() }, $unset: { retiredBy: 1 } },
      { new: true, session },
    ), session).lean();
    if (!activated) raise({ code: "PAYROLL_POLICY_INVALID_STATE", message: "The policy changed before it could be activated", status: 409 });
    await auditPolicy(companyCode, actorId, {
      operation: "activate_policy", policyId, before: { status: previousStatus }, after: { status: "active" }, replacedPolicyIds,
    }, session);
    return activated;
  });
}

export async function retirePayrollPolicy(companyCode: string, policyId: string, actorId: string) {
  const retired: any = await PayrollPolicyModel.findOneAndUpdate(
    { _id: policyId, companyCode, status: "active" },
    { $set: { status: "retired", retiredBy: actorId } },
    { new: true },
  ).lean();
  if (!retired) {
    raise({ code: "PAYROLL_POLICY_INVALID_STATE", message: "Only an active payroll policy can be retired", status: 409 });
  }
  await auditPolicy(companyCode, actorId, {
    operation: "retire_policy", policyId, before: { status: "active" }, after: { status: "retired" },
  });
  return retired;
}

export async function updatePayrollPolicy(companyCode: string, policyId: string, actorId: string, expectedVersion: number, input: Record<string, any>) {
  const invalid = validatePolicyDefinition(input as any);
  if (invalid) raise(invalid);
  try {
    const updated: any = await PayrollPolicyModel.findOneAndUpdate(
      { _id: policyId, companyCode, status: { $in: ["draft", "active"] }, version: expectedVersion },
      { $set: input, $inc: { version: 1 } },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) raise({ code: "PAYROLL_POLICY_VERSION_CONFLICT", message: "Only the current draft or active policy version can be edited", status: 409 });
    await auditPolicy(companyCode, actorId, { operation: "update_policy", policyId, code: updated.code, expectedVersion });
    return updated;
  } catch (error: any) {
    if (error?.code === 11000) raise({ code: "PAYROLL_POLICY_DUPLICATE", message: "A payroll policy with this code already exists", status: 409 });
    throw error;
  }
}

export async function clonePayrollPolicy(companyCode: string, policyId: string, actorId: string, input: { code: string; name?: string; definition?: Record<string, any> }) {
  const source: any = await PayrollPolicyModel.findOne({ _id: policyId, companyCode }).lean();
  if (!source) raise({ code: "PAYROLL_POLICY_NOT_FOUND", message: "Payroll policy not found", status: 404 });
  const { _id, companyCode: _company, status, createdBy, activatedBy, activatedAt, retiredBy, createdAt, updatedAt, version, __v, ...definition } = source;
  const reviewedDefinition = input.definition ? { ...definition, ...input.definition, code: input.code, name: input.name?.trim() || input.definition.name } : definition;
  const invalid = validatePolicyDefinition(reviewedDefinition as any);
  if (invalid) raise(invalid);
  try {
    const cloned: any = await PayrollPolicyModel.create({
      ...reviewedDefinition,
      code: input.code,
      name: input.name?.trim() || `${source.name} Bản sao`,
      companyCode,
      status: "draft",
      createdBy: actorId,
    });
    await auditPolicy(companyCode, actorId, { operation: "clone_policy", policyId: String(cloned._id), sourcePolicyId: policyId, code: cloned.code });
    return cloned;
  } catch (error: any) {
    if (error?.code === 11000) raise({ code: "PAYROLL_POLICY_DUPLICATE", message: "A payroll policy with this code already exists", status: 409 });
    throw error;
  }
}

const periodIntersectsPolicy = (periodKey: string, policy: any) => {
  const start = new Date(`${periodKey}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return new Date(policy.effectiveFrom) <= end && (!policy.effectiveTo || new Date(policy.effectiveTo) >= start);
};

export async function deletePayrollPolicy(companyCode: string, policyId: string, actorId: string) {
  const policy: any = await PayrollPolicyModel.findOne({ _id: policyId, companyCode }).lean();
  if (!policy) raise({ code: "PAYROLL_POLICY_NOT_FOUND", message: "Payroll policy not found", status: 404 });
  if (!['draft', 'retired'].includes(policy.status)) raise({ code: "PAYROLL_POLICY_INVALID_STATE", message: "An active policy must be retired before deletion", status: 409 });

  const runs: any[] = await PayrollRunModel.find({ companyCode, status: { $in: ["closed", "paid"] } })
    .select("periodKey lines activeRevisionId").lean();
  const revisionIds = runs.map((run) => run.activeRevisionId).filter(Boolean);
  const revisions: any[] = await PayrollCalculationRevisionModel.find({ companyCode, _id: { $in: revisionIds } })
    .select("_id lines").lean();
  const revisionById = new Map(revisions.map((revision) => [String(revision._id), revision]));
  const affectedPeriods = runs.filter((run) => {
    const lines = [...(run.lines ?? []), ...(revisionById.get(String(run.activeRevisionId))?.lines ?? [])];
    if (lines.some((line: any) => String(line.policyId ?? "") === policyId)) return true;
    return lines.length > 0 && lines.every((line: any) => !line.policyId) && periodIntersectsPolicy(run.periodKey, policy);
  }).map((run) => run.periodKey);
  if (affectedPeriods.length) {
    raise({ code: "PAYROLL_POLICY_IN_USE", message: `Policy is used by finalized payroll periods: ${[...new Set(affectedPeriods)].join(", ")}`, status: 409 });
  }

  await auditPolicy(companyCode, actorId, { operation: "delete_policy", policyId, code: policy.code, before: { status: policy.status } });
  const deleted = await PayrollPolicyModel.deleteOne({ _id: policyId, companyCode, status: { $in: ["draft", "retired"] } });
  if (!deleted.deletedCount) raise({ code: "PAYROLL_POLICY_VERSION_CONFLICT", message: "Payroll policy changed before deletion", status: 409 });
  return { policyId };
}
import mongoose, { type ClientSession } from "mongoose";
