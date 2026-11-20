import { getEffectivePermissions } from "../../middleware/auth";
import { UserModel } from "../../model/user.model";
import { ResourceItemModel } from "../../model/resource-item.model";
import { canAccessResourceItem } from "../../service/resource.service";
import { buildAssistantAccessContext } from "../assistant-access";
import type { AssistantAccessContext, AssistantUserIdentity } from "../assistant.types";
import { LEGAL_COMPANY } from "./legal-policy";

export async function resolveKnowledgeContext(user: AssistantUserIdentity): Promise<AssistantAccessContext> {
  const permissions = await getEffectivePermissions(user.id, user.role, user.companyCode);
  const companyCode = String(user.companyCode || "")
    .trim()
    .toUpperCase();
  if (!companyCode || companyCode === LEGAL_COMPANY) throw new Error("Tài khoản chưa được gắn với doanh nghiệp.");
  const profile = await UserModel.findOne({ _id: user.id, companyCode }).select("departmentId branchId").lean();
  if (!profile) throw new Error("Không tìm thấy tài khoản trong doanh nghiệp.");
  return buildAssistantAccessContext(
    { ...user, companyCode, branchId: profile.branchId, departmentId: profile.departmentId },
    [...permissions],
  );
}
export function hasKnowledgePermission(context: AssistantAccessContext, action: "read" | "manage") {
  if (context.companyCode === LEGAL_COMPANY) return false;
  return (
    context.permissions.has("*") ||
    context.permissions.has(`knowledge:${action}`) ||
    (action === "read" && context.permissions.has("knowledge:manage"))
  );
}
export function knowledgeAccessFilter(context: AssistantAccessContext): Record<string, unknown> {
  if (!hasKnowledgePermission(context, "read")) return { companyCode: context.companyCode, _id: { $in: [] } };
  const scope: Record<string, unknown> = { companyCode: context.companyCode, status: { $ne: "disabled" } };
  if (context.allBranches) return scope;
  return {
    ...scope,
    $or: [
      { visibility: "company" },
      { visibility: { $exists: false } },
      {
        visibility: "restricted",
        $and: [
          { $or: [{ "branchIds.0": { $exists: true } }, { "departmentIds.0": { $exists: true } }] },
          {
            $or: [
              { branchIds: { $size: 0 } },
              { branchIds: { $exists: false } },
              { branchIds: { $in: [...context.branchIds] } },
            ],
          },
          {
            $or: [
              { departmentIds: { $size: 0 } },
              { departmentIds: { $exists: false } },
              { departmentIds: context.departmentId || "__no_department__" },
            ],
          },
        ],
      },
    ],
  };
}
export function canReadKnowledgeDocument(
  document: {
    companyCode: string;
    status?: string;
    visibility?: string;
    branchIds?: string[];
    departmentIds?: string[];
  },
  context: AssistantAccessContext,
): boolean {
  if (
    document.companyCode !== context.companyCode ||
    document.status === "disabled" ||
    !hasKnowledgePermission(context, "read")
  )
    return false;
  if (context.allBranches) return true;
  if (!document.visibility || document.visibility === "company") return true;
  if (document.visibility !== "restricted") return false;
  const branches = document.branchIds || [];
  const departments = document.departmentIds || [];
  return Boolean(
    (branches.length || departments.length) &&
    (!branches.length || branches.some((id) => context.branchIds.includes(id))) &&
    (!departments.length || departments.includes(context.departmentId || "")),
  );
}
export async function filterResourceDocuments<
  T extends {
    resourceId?: unknown;
    companyCode: string;
    status?: string;
    visibility?: string;
    branchIds?: string[];
    departmentIds?: string[];
  },
>(documents: T[], context: AssistantAccessContext): Promise<T[]> {
  const visible: T[] = [];
  for (const document of documents) {
    if (!canReadKnowledgeDocument(document, context)) continue;
    if (!document.resourceId) {
      visible.push(document);
      continue;
    }
    if (!context.permissions.has("*") && !context.permissions.has("resource:read")) continue;
    const resource = await ResourceItemModel.findOne({
      _id: document.resourceId,
      companyCode: context.companyCode,
      isDeleted: { $ne: true },
    }).lean();
    if (resource && (await canAccessResourceItem(context.companyCode, resource, context.userId, context.role)))
      visible.push(document);
  }
  return visible;
}
