import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollPolicyModel } from "../model/payroll-policy.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollCalculationRevisionModel } from "../model/payroll-calculation-revision.model";
import { PayrollOperationError } from "./payroll-run-operations.service";
import { validatePolicyActivation, validatePolicyDefinition } from "./payroll-policy.service";

const raise = (failure: { code: string; message: string; status: number }) => {
  throw new PayrollOperationError(failure.code, failure.message, failure.status);
};

const auditPolicy = (companyCode: string, actorId: string, metadata: Record<string, unknown>) =>
  PayrollAuditModel.create({ companyCode, periodKey: "policy", action: "adjustment", actorId, metadata });

export async function listPayrollPolicies(companyCode: string) {
  return PayrollPolicyModel.find({ companyCode }).sort({ effectiveFrom: -1 }).lean();
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

export async function activatePayrollPolicy(companyCode: string, policyId: string, actorId: string) {
  const policy: any = await PayrollPolicyModel.findOne({ _id: policyId, companyCode }).lean();
  const active: any[] = await PayrollPolicyModel.find({ companyCode, status: "active", _id: { $ne: policyId } })
    .select("effectiveFrom effectiveTo").lean();
  const invalid = validatePolicyActivation(policy, active);
  if (invalid) raise(invalid);

  const activated: any = await PayrollPolicyModel.findOneAndUpdate(
    { _id: policyId, companyCode, status: "draft" },
    { $set: { status: "active", activatedBy: actorId, activatedAt: new Date() } },
    { new: true },
  ).lean();
  if (!activated) {
    raise({ code: "PAYROLL_POLICY_INVALID_STATE", message: "The policy changed before it could be activated", status: 409 });
  }
  await auditPolicy(companyCode, actorId, {
    operation: "activate_policy", policyId, before: { status: "draft" }, after: { status: "active" },
  });
  return activated;
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
      { _id: policyId, companyCode, status: "draft", version: expectedVersion },
      { $set: input, $inc: { version: 1 } },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) raise({ code: "PAYROLL_POLICY_VERSION_CONFLICT", message: "Only the current draft policy can be edited", status: 409 });
    await auditPolicy(companyCode, actorId, { operation: "update_policy", policyId, code: updated.code, expectedVersion });
    return updated;
  } catch (error: any) {
    if (error?.code === 11000) raise({ code: "PAYROLL_POLICY_DUPLICATE", message: "A payroll policy with this code already exists", status: 409 });
    throw error;
  }
}

export async function clonePayrollPolicy(companyCode: string, policyId: string, actorId: string, input: { code: string; name?: string }) {
  const source: any = await PayrollPolicyModel.findOne({ _id: policyId, companyCode }).lean();
  if (!source) raise({ code: "PAYROLL_POLICY_NOT_FOUND", message: "Payroll policy not found", status: 404 });
  const { _id, companyCode: _company, status, createdBy, activatedBy, activatedAt, retiredBy, createdAt, updatedAt, version, __v, ...definition } = source;
  try {
    const cloned: any = await PayrollPolicyModel.create({
      ...definition,
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
