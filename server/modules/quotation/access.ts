import type { RequestHandler } from "express";
import { BranchModel } from "../../model/branch.model";
import { CompanyModel } from "../../model/company.model";
import { UserModel } from "../../model/user.model";
import { getEffectivePermissions } from "../../middleware/auth";
import { getModuleStateForCompany, isServiceSubscriptionBlocked, resolveModuleAccess } from "../../middleware/require-module";
import { assertAccountUsable } from "../../security/account-access";
import { quotationContexts, quotationScopeId, assertQuotationPermission, type QuotationContext } from "./context";
import { ensureQuotationIndexes, ensureQuotationSettings } from "./db";
import { quotationRoutePermissions } from "./permissions";

export async function resolveQuotationContext(actor: { id: string; role: string; companyCode?: string; branchId?: string; email?: string; displayName?: string }, requested: { companyCode?: string; branchId?: string } = {}): Promise<QuotationContext> {
  const companyCode = (actor.role === "superadmin" ? requested.companyCode || actor.companyCode : actor.companyCode)?.trim().toUpperCase();
  if (!companyCode || (actor.role !== "superadmin" && requested.companyCode && requested.companyCode.toUpperCase() !== companyCode)) throw Object.assign(new Error("Không xác định được doanh nghiệp Báo giá hợp lệ."), { statusCode: 403 });
  const branchId = requested.branchId || actor.branchId || "";
  if (!/^[a-f\d]{24}$/i.test(branchId)) throw Object.assign(new Error("Vui lòng chọn chi nhánh để sử dụng Báo giá."), { statusCode: 400 });
  if (!["admin", "superadmin"].includes(actor.role) && branchId !== actor.branchId) throw Object.assign(new Error("Bạn không có quyền sử dụng chi nhánh này."), { statusCode: 403 });
  const [company, branch, moduleState, permissions] = await Promise.all([
    CompanyModel.findOne({ code: companyCode }).select("code name ownerEmail lifecycleStatus").lean(),
    BranchModel.findOne({ _id: branchId, companyCode, isActive: true }).select("_id").lean(),
    getModuleStateForCompany(companyCode), getEffectivePermissions(actor.id, actor.role, companyCode),
  ]);
  if (!company || !branch || (company.lifecycleStatus && company.lifecycleStatus !== "active")) throw Object.assign(new Error("Doanh nghiệp hoặc chi nhánh đã ngừng hoạt động."), { statusCode: 403 });
  if (isServiceSubscriptionBlocked(moduleState) || !resolveModuleAccess({ companyCode, role: actor.role }, "quotation" as any, moduleState.modules, moduleState.exists, moduleState.businessType)) throw Object.assign(new Error("Phân hệ Báo giá chưa được kích hoạt cho doanh nghiệp."), { statusCode: 403 });
  const scopeId = quotationScopeId(companyCode, branchId);
  return { companyCode, branchId, scopeId, actorId: actor.id, actorName: actor.displayName || actor.email || actor.id, permissions,
    companyName: company.name, companyEmail: company.ownerEmail || "",
    user: { id: actor.id, email: actor.email || "", name: actor.displayName || actor.email || "", role: "user", companyId: scopeId } };
}

export async function resolveQuotationJobContext(job: { actorId: string; companyCode: string; branchId: string }): Promise<QuotationContext> {
  const user = await UserModel.findById(job.actorId).select("role companyCode branchId email displayName lockedAt disabledAt isActive").lean();
  if (!user || (user.role !== "superadmin" && user.companyCode !== job.companyCode)) throw Object.assign(new Error("Tài khoản tạo tác vụ không còn quyền truy cập doanh nghiệp."), { statusCode: 403 });
  await assertAccountUsable(user);
  return resolveQuotationContext({ ...user, id: String(user._id), branchId: user.branchId ? String(user.branchId) : undefined } as any, job);
}

export const quotationScopeMiddleware: RequestHandler = (request, response, next) => {
  const actor = (request as any).user;
  if (!actor) return response.status(401).json({ error: "Vui lòng đăng nhập ERP." });
  void resolveQuotationContext(actor, {
    companyCode: String(request.query.companyCode || request.headers["x-company-code"] || actor.companyCode || ""),
    branchId: String(request.headers["x-branch-id"] || request.query.branchId || actor.branchId || ""),
  }).then(context => {
    context.readVersions = new Map();
    context.expectedVersion = typeof request.headers["if-unmodified-since"] === "string" ? request.headers["if-unmodified-since"] : undefined;
    context.requestId = String(response.locals.requestId || "");
    context.command = { path: request.path, query: Object.fromEntries(Object.entries(request.query).filter(([key, value]) => !["companyCode", "branchId", "token"].includes(key) && typeof value === "string") as Array<[string, string]>) };
    return quotationContexts.run(context, async () => {
      for (const permission of quotationRoutePermissions(request.method, request.path)) assertQuotationPermission(permission);
      await ensureQuotationIndexes();
      await ensureQuotationSettings();
      next();
    });
  }).catch(next);
};
