import type { AuthenticatedRequest } from "../../middleware/auth";
import { ForbiddenError, ValidationError } from "../../errors/app-error";
import { BranchModel } from "../../model/branch.model";
import { gymAdmin } from "../../../shared/gym/types";

export interface GymActor {
  userId: string;
  companyCode: string;
  branchId: string;
  role: string;
}
export const tenantFilter = (actor: GymActor) => ({
  companyCode: actor.companyCode,
  branchId: actor.branchId,
});
export const customerFilter = (actor: GymActor) => ({
  ...tenantFilter(actor),
  ...(gymAdmin(actor.role) ? {} : { assignedPtId: actor.userId }),
});
export function assertGymRole(role: string) {
  if (role !== "pt" && !gymAdmin(role))
    throw new ForbiddenError(
      "FORBIDDEN",
      "Bạn không có quyền truy cập phân hệ Gym.",
    );
}
export function assertGymAdmin(actor: GymActor) {
  if (!gymAdmin(actor.role))
    throw new ForbiddenError(
      "FORBIDDEN",
      "Chỉ quản trị viên được thực hiện thao tác này.",
    );
}
export async function gymScope(req: AuthenticatedRequest): Promise<GymActor> {
  const user = req.user;
  if (!user?.companyCode)
    throw new ForbiddenError(
      "TENANT_REQUIRED",
      "Không xác định được doanh nghiệp.",
    );
  assertGymRole(user.role);
  const companyCode = user.companyCode.trim().toUpperCase();
  const branchId = (
    req.get("x-branch-id") ||
    user.branchId ||
    ""
  ).toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(branchId))
    throw new ValidationError("BRANCH_REQUIRED", "Vui lòng chọn chi nhánh.");
  if (!gymAdmin(user.role) && branchId !== user.branchId?.toLowerCase())
    throw new ForbiddenError(
      "FORBIDDEN",
      "Bạn không có quyền truy cập chi nhánh này.",
    );
  if (
    !(await BranchModel.exists({ _id: branchId, companyCode, isActive: true }))
  )
    throw new ForbiddenError(
      "FORBIDDEN",
      "Chi nhánh không hoạt động hoặc không thuộc doanh nghiệp.",
    );
  return { userId: user.id, role: user.role, companyCode, branchId };
}
