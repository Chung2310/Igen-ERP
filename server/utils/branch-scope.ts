import { AuthenticatedRequest } from "../middleware/auth";
import { BranchModel } from "../model/branch.model";

export async function resolveBranchScope(req: AuthenticatedRequest, requestedBranchId?: string) {
  const companyCode = String(req.user?.companyCode || "").trim().toUpperCase();
  if (!companyCode) throw new Error("Company scope is required");
  if (req.user?.role === "admin" && requestedBranchId) {
    const branch = await BranchModel.findOne({ _id: requestedBranchId, companyCode, isActive: true }).select("_id").lean();
    if (!branch) throw new Error("Branch is outside company scope");
    return { companyCode, branchId: String(branch._id) };
  }
  return { companyCode, branchId: (req.user as typeof req.user & { branchId?: string })?.branchId || requestedBranchId || undefined };
}
