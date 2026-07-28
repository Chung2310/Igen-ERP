import type { AuthenticatedRequest } from "../middleware/auth";
import { BranchModel } from "../model/branch.model";

export interface RecruitmentScope {
  companyCode: string;
  branchId: string;
}

export async function resolveRecruitmentScope(
  req: AuthenticatedRequest,
): Promise<RecruitmentScope> {
  const companyCode = String(req.user?.companyCode || "").trim().toUpperCase();
  if (!companyCode) throw new Error("Company scope is required");

  const isAdmin = req.user?.role === "admin";
  const selectedBranchId = req.headers["x-branch-id"];
  const requestedBranchId = Array.isArray(selectedBranchId)
    ? selectedBranchId[0]
    : selectedBranchId;
  const profileBranchId = String(req.user?.branchId || "").trim();

  if (isAdmin && !requestedBranchId) {
    throw new Error("A branch must be selected");
  }
  if (!isAdmin && !profileBranchId) {
    throw new Error("A profile branch is required");
  }

  const branchId = String(isAdmin ? requestedBranchId : profileBranchId).trim();
  const branch = await BranchModel.findOne({
    _id: branchId,
    companyCode,
    isActive: true,
  })
    .select("_id")
    .lean();

  if (!branch) {
    throw new Error("Branch is outside company scope or inactive");
  }

  return { companyCode, branchId: String(branch._id) };
}
