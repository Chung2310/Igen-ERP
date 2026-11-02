import { AuthenticatedRequest } from "../middleware/auth";
import { BranchModel } from "../model/branch.model";
import { ValidationError } from "../errors/app-error";

export async function resolveBranchScope(req: AuthenticatedRequest, requestedBranchId?: string) {
  const companyCode = String(req.user?.companyCode || "").trim().toUpperCase();
  if (!companyCode) throw new ValidationError("TENANT_REQUIRED", "Không xác định được công ty của tài khoản.", { field: "companyCode" });
  if (req.user?.role === "admin" && requestedBranchId) {
    const branch = await BranchModel.findOne({ _id: requestedBranchId, companyCode, isActive: true }).select("_id").lean();
    if (!branch) throw new ValidationError("BRANCH_REQUIRED", "Chi nhánh không tồn tại, đã ngừng hoạt động hoặc không thuộc công ty này.", { field: "branchId" });
    return { companyCode, branchId: String(branch._id) };
  }
  return { companyCode, branchId: (req.user as typeof req.user & { branchId?: string })?.branchId || requestedBranchId || undefined };
}
