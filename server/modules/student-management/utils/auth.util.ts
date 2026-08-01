import { User } from "../models/user.model";

export type StudentModuleUser = {
  uid: string;
  role: string;
  centerId: string;
  companyCode?: string;
  branchId?: string;
};

export function requireStudentBranch(user: StudentModuleUser): string {
  const branchId = String(user.branchId || "").trim();
  if (!branchId) {
    const error: Error & { status?: number } = new Error("Vui lòng chọn chi nhánh trước khi thao tác.");
    error.status = 400;
    throw error;
  }
  return branchId;
}

export function buildStudentBranchQuery(branchId: string) {
  return { branchId };
}

export function buildCompanyUserFilter(companyCode: string, branchId?: string) {
  return {
    companyCode,
    ...(branchId ? { branchId } : {}),
  };
}

async function getCompanyUserIds(companyCode?: string, branchId?: string) {
  if (!companyCode) return [];
  const users = await User.find(buildCompanyUserFilter(companyCode, branchId)).select("_id");
  return users.map((user) => user._id.toString());
}

async function getCompanyPrimaryOwnerId(companyCode?: string, branchId?: string) {
  if (!companyCode) return null;

  const companyFilter = buildCompanyUserFilter(companyCode, branchId);
  const adminUser = await User.findOne({ ...companyFilter, role: "admin" }).sort({ createdAt: 1 }).select("_id");
  if (adminUser) {
    return adminUser._id.toString();
  }

  const managerUser = await User.findOne({ ...companyFilter, role: "manager" }).sort({ createdAt: 1 }).select("_id");
  if (managerUser) {
    return managerUser._id.toString();
  }

  const anyUser = await User.findOne(companyFilter).sort({ createdAt: 1 }).select("_id");
  return anyUser ? anyUser._id.toString() : null;
}

export async function resolveOwnerFilter(ownerId: string | string[], ownerFilter?: string) {
  if (ownerId !== "ALL" || !ownerFilter) {
    return ownerId;
  }

  const companyUsers = await getCompanyUserIds(ownerFilter);
  const ids = [...companyUsers];
  const companyAdmin = await User.findOne({ companyCode: ownerFilter, role: "admin" }).select("_id");
  if (companyAdmin) {
    ids.push(companyAdmin._id.toString());
  }
  if (ids.length === 0) {
    ids.push(ownerFilter);
  }

  return [...new Set(ids)];
}

export async function getAllowedOwnerIds(user: StudentModuleUser): Promise<string[] | string> {
  if (user.role === "superadmin") {
    return "ALL";
  }

  const companyUserIds = await getCompanyUserIds(user.companyCode || user.centerId, user.branchId);
  const branchOwnerIds = user.branchId ? [...companyUserIds, user.branchId] : companyUserIds;
  if (user.role === "admin") {
    return [...new Set([...branchOwnerIds, user.uid])];
  }
  if (user.role === "manager") {
    return branchOwnerIds.length > 0 ? [...new Set(branchOwnerIds)] : user.uid;
  }

  return user.uid;
}

export async function getCenterOwnerIds(user: StudentModuleUser): Promise<string[] | string> {
  if (user.role === "superadmin") {
    return "ALL";
  }

  const companyUserIds = await getCompanyUserIds(user.companyCode || user.centerId, user.branchId);
  const branchOwnerIds = user.branchId ? [...companyUserIds, user.branchId] : companyUserIds;
  return branchOwnerIds.length > 0 ? [...new Set(branchOwnerIds)] : [user.uid];
}

export async function resolveCreateOwnerId(
  user: StudentModuleUser,
  requestedCompanyCode?: string
): Promise<string> {
  if (user.role === "superadmin") {
    const companyCode = requestedCompanyCode || user.companyCode || user.centerId;
    const companyOwnerId = await getCompanyPrimaryOwnerId(companyCode, user.branchId);
    if (companyOwnerId) {
      return companyOwnerId;
    }
    return companyCode || user.uid;
  }

  if (user.role === "admin" || user.role === "manager") {
    const companyOwnerId = await getCompanyPrimaryOwnerId(user.companyCode || user.centerId, user.branchId);
    if (companyOwnerId) {
      return companyOwnerId;
    }
    if (user.branchId) {
      return user.branchId;
    }
  }

  return user.uid;
}
