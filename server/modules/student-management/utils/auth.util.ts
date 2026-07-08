import { User } from "../models/user.model";

type StudentModuleUser = {
  uid: string;
  role: string;
  centerId: string;
  companyCode?: string;
};

async function getCompanyUserIds(companyCode?: string) {
  if (!companyCode) return [];
  const users = await User.find({ companyCode }).select("_id");
  return users.map((user) => user._id.toString());
}

async function getCompanyPrimaryOwnerId(companyCode?: string) {
  if (!companyCode) return null;

  const adminUser = await User.findOne({ companyCode, role: "admin" }).sort({ createdAt: 1 }).select("_id");
  if (adminUser) {
    return adminUser._id.toString();
  }

  const managerUser = await User.findOne({ companyCode, role: "manager" }).sort({ createdAt: 1 }).select("_id");
  if (managerUser) {
    return managerUser._id.toString();
  }

  const anyUser = await User.findOne({ companyCode }).sort({ createdAt: 1 }).select("_id");
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

  const companyUserIds = await getCompanyUserIds(user.companyCode || user.centerId);
  if (user.role === "admin" || user.role === "manager") {
    return companyUserIds.length > 0 ? companyUserIds : user.uid;
  }

  return user.uid;
}

export async function getCenterOwnerIds(user: StudentModuleUser): Promise<string[] | string> {
  if (user.role === "superadmin") {
    return "ALL";
  }

  const companyUserIds = await getCompanyUserIds(user.companyCode || user.centerId);
  return companyUserIds.length > 0 ? companyUserIds : [user.uid];
}

export async function resolveCreateOwnerId(
  user: StudentModuleUser,
  requestedCompanyCode?: string
): Promise<string> {
  if (user.role === "superadmin") {
    const companyCode = requestedCompanyCode || user.companyCode || user.centerId;
    const companyOwnerId = await getCompanyPrimaryOwnerId(companyCode);
    if (companyOwnerId) {
      return companyOwnerId;
    }
    return companyCode || user.uid;
  }

  if (user.role === "admin" || user.role === "manager") {
    const companyOwnerId = await getCompanyPrimaryOwnerId(user.companyCode || user.centerId);
    if (companyOwnerId) {
      return companyOwnerId;
    }
  }

  return user.uid;
}
