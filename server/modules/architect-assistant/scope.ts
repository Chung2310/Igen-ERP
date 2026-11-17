import { BranchModel } from "../../model/branch.model";
import { ForbiddenError, ValidationError } from "../../errors/app-error";
import type { AuthenticatedRequest } from "../../middleware/auth";

export type ArchitectureActor = {
  actorId: string;
  companyCode: string;
  branchId: string;
};

export async function architectureScope(request: AuthenticatedRequest): Promise<ArchitectureActor> {
  const user = request.user;
  const companyCode = user?.companyCode?.trim().toUpperCase();
  if (!user || !companyCode) {
    throw new ForbiddenError("TENANT_REQUIRED", "Không xác định được doanh nghiệp để mở dự án kiến trúc.");
  }

  const branchId = (request.get("x-branch-id") || user.branchId || "").trim().toLowerCase();
  if (!/^[a-f\d]{24}$/i.test(branchId)) {
    throw new ValidationError("BRANCH_REQUIRED", "Vui lòng chọn chi nhánh để sử dụng Trợ lý kiến trúc.");
  }
  if (!["admin", "superadmin"].includes(user.role) && branchId !== user.branchId?.toLowerCase()) {
    throw new ForbiddenError("FORBIDDEN", "Bạn không có quyền truy cập chi nhánh này.");
  }
  if (!await BranchModel.exists({ _id: branchId, companyCode, isActive: true })) {
    throw new ForbiddenError("FORBIDDEN", "Chi nhánh không hoạt động hoặc không thuộc doanh nghiệp.");
  }

  return { actorId: user.id, companyCode, branchId };
}
