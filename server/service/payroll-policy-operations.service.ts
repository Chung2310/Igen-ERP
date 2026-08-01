import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollPolicyModel } from "../model/payroll-policy.model";
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
