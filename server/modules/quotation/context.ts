import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { SessionUser } from "./types";

export interface QuotationContext {
  companyCode: string;
  branchId: string;
  scopeId: string;
  actorId: string;
  actorName: string;
  permissions: ReadonlySet<string>;
  user: SessionUser;
  companyName: string;
  companyEmail: string;
  requestId?: string;
  command?: { path: string; query: Record<string, string> };
  aiKind?: string;
  aiMaintenance?: boolean;
  jobId?: string;
  artifactId?: string;
  exportKind?: string;
  exportSourceId?: string;
  readVersions?: Map<string, Date | null>;
  readVersionFields?: Map<string, "updatedAt" | "createdAt">;
  checkedVersions?: Set<string>;
  expectedVersion?: string;
}

export const quotationContexts = new AsyncLocalStorage<QuotationContext>();
export function quotationScopeId(companyCode: string, branchId: string) {
  return createHash("sha256").update(`quotation\0${companyCode.trim().toUpperCase()}\0${branchId}`).digest("hex").slice(0, 24);
}
export function quotationContext(): QuotationContext {
  const context = quotationContexts.getStore();
  if (!context) throw Object.assign(new Error("Thiếu phạm vi doanh nghiệp và chi nhánh Báo giá."), { statusCode: 403 });
  return context;
}
export function canQuotation(permission: string, context = quotationContext()) {
  return context.permissions.has("*") || context.permissions.has(permission)
    || (permission.endsWith(":read") && context.permissions.has(permission.replace(/:read$/, ":manage")));
}
export function assertQuotationPermission(permission: string) {
  if (!canQuotation(permission)) throw Object.assign(new Error("Bạn chưa được cấp quyền thực hiện thao tác báo giá này."), { statusCode: 403, code: "QUOTATION_PERMISSION_DENIED" });
}
