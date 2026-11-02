import { ValidationError } from "../../../errors/app-error";
import { resolveBranchScope } from "../../../utils/branch-scope";
import type { AuthRequest } from "../middlewares/auth.middleware";

export async function resolveCommissionBranchId(req: AuthRequest, required: boolean) {
  const requested = String(req.query.branchId || req.body?.branchId || "").trim();
  const assigned = String(req.user?.branchId || "").trim();
  if (assigned && requested && assigned !== requested) {
    throw new ValidationError("BRANCH_REQUIRED", "Tài khoản chỉ được thao tác trong chi nhánh đã gán.", { field: "branchId" });
  }

  let branchId = assigned || undefined;
  if (req.user?.role === "admin") {
    // A company admin may not have an assigned branch. Resolve their selected branch
    // inside their own company before applying a branch-scoped commission change.
    branchId = (await resolveBranchScope(req, requested || undefined)).branchId;
  }
  if (req.user?.role === "superadmin" && !branchId) branchId = requested || undefined;
  if (required && !branchId) {
    throw new ValidationError("BRANCH_REQUIRED", "Hãy chọn chi nhánh áp dụng cấu hình hoa hồng.", { field: "branchId" });
  }
  return branchId;
}
