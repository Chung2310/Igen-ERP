import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { BranchModel } from "../model/branch.model";
import { UserModel } from "../model/user.model";
import { authService } from "../service/auth.service";
import { getRequestPublicIp, normalizeAllowedNetwork } from "../utils/request-ip";

const company = (req: AuthenticatedRequest) => String(req.user?.companyCode || "").trim().toUpperCase();
const canManage = (req: AuthenticatedRequest) => ["admin", "superadmin", "branch_owner"].includes(String(req.user?.role || ""));
async function ensureDefaultBranch(companyCode: string) {
  let existing = (await BranchModel.findOne({ companyCode, code: "MAIN" }).lean()) ||
    (await BranchModel.findOne({ companyCode }).lean());

  let adminUser: any = null;
  try {
    if (typeof (UserModel as any).findOne === "function") {
      adminUser = await UserModel.findOne({ companyCode, role: { $in: ["admin", "superadmin"] } })
        .sort({ level: 1, createdAt: 1 })
        .select("_id branchId")
        .lean();
    }
  } catch {
    adminUser = null;
  }

  if (existing) {
    if (!existing.managerId && adminUser?._id) {
      await BranchModel.updateOne({ _id: existing._id }, { $set: { managerId: String(adminUser._id) } }).catch(() => undefined);
      existing.managerId = String(adminUser._id);
    }
    if (adminUser?._id && !adminUser.branchId) {
      await UserModel.updateOne({ _id: adminUser._id }, { $set: { branchId: String(existing._id) } }).catch(() => undefined);
    }
    return existing;
  }

  try {
    const payload: any = { companyCode, code: "MAIN", name: "Trụ sở chính", isActive: true };
    if (adminUser?._id) payload.managerId = String(adminUser._id);
    const created = await BranchModel.create(payload);
    const createdObj = (created as any)?.toObject ? (created as any).toObject() : created;
    if (adminUser?._id && !adminUser.branchId && createdObj?._id) {
      await UserModel.updateOne({ _id: adminUser._id }, { $set: { branchId: String(createdObj._id) } }).catch(() => undefined);
    }
    return createdObj;
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    return BranchModel.findOne({ companyCode, code: "MAIN" }).lean();
  }
}

function normalizeAttendanceLocations(locations: any[] | undefined) {
  if (!locations) return undefined;
  return locations.map((location) => ({
    ...location,
    name: String(location.name || "").trim(),
    allowedPublicIps: location.type === "office"
      ? (location.allowedPublicIps || []).map(normalizeAllowedNetwork)
      : [],
  }));
}

export const branchController = {
  currentIp(req: AuthenticatedRequest, res: Response) {
    return res.json({ status: "success", data: { ip: getRequestPublicIp(req) } });
  },
  async list(req: AuthenticatedRequest, res: Response) {
    const code = req.user?.role === "superadmin" && req.query.companyCode ? String(req.query.companyCode).toUpperCase() : company(req);
    if (code && typeof (BranchModel as any).deleteMany === "function") {
      await BranchModel.deleteMany({ companyCode: code, pendingOwnerSetup: true, managerId: { $in: ["", null] } }).catch(() => undefined);
    }
    let data = await BranchModel.find({ companyCode: code, pendingOwnerSetup: { $ne: true } }).sort({ isActive: -1, name: 1 }).lean();
    if (data.length === 0 && req.user?.role === "admin" && code) {
      const created = await ensureDefaultBranch(code);
      data = created ? [created] : [];
    }

    // Auto-heal: Ensure MAIN branch (or sole branch) has managerId set to the company admin
    const mainBranch = data.find((b: any) => b.code === "MAIN") || (data.length === 1 ? data[0] : null);
    if (mainBranch && !mainBranch.managerId && code) {
      try {
        if (typeof (UserModel as any).findOne === "function") {
          const adminUser = await UserModel.findOne({ companyCode: code, role: { $in: ["admin", "superadmin"] } })
            .sort({ level: 1, createdAt: 1 })
            .select("_id branchId")
            .lean();
          if (adminUser?._id) {
            await BranchModel.updateOne({ _id: mainBranch._id }, { $set: { managerId: String(adminUser._id) } }).catch(() => undefined);
            mainBranch.managerId = String(adminUser._id);
            if (!adminUser.branchId) {
              await UserModel.updateOne({ _id: adminUser._id }, { $set: { branchId: String(mainBranch._id) } }).catch(() => undefined);
            }
          }
        }
      } catch {
        // ignore in test / offline environments
      }
    }

    return res.json({ status: "success", data });
  },
  async create(req: AuthenticatedRequest, res: Response) {
    if (!canManage(req)) return res.status(403).json({ status: "error", message: "Không có quyền quản lý chi nhánh." });
    const companyCode = req.user?.role === "superadmin" && req.body.companyCode ? String(req.body.companyCode).toUpperCase() : company(req);
    const locationConfig = req.body.locationConfig ? { ...req.body.locationConfig, allowedPublicIps: req.body.locationConfig.allowedPublicIps.map(normalizeAllowedNetwork) } : undefined;
    const attendanceLocations = normalizeAttendanceLocations(req.body.attendanceLocations);
    const data = await BranchModel.create({ ...req.body, locationConfig, attendanceLocations, companyCode, code: String(req.body.code || "").toUpperCase(), pendingOwnerSetup: true });
    return res.status(201).json({ status: "success", data });
  },
  async createOwner(req: AuthenticatedRequest, res: Response) {
    if (req.user?.role !== "admin") return res.status(403).json({ status: "error", message: "Chỉ Admin được tạo Chủ chi nhánh." });
    const companyCode = company(req);
    const branch = await BranchModel.findOne({ _id: req.params.id, companyCode, pendingOwnerSetup: true, managerId: { $in: ["", null] } }).lean();
    if (!branch) return res.status(404).json({ status: "error", message: "Không tìm thấy chi nhánh chưa có Chủ chi nhánh." });
    let owner: any;
    try {
      const { displayName, email, password, phone, birthDate, qualification } = req.body;
      owner = await authService.registerUserForCompany({
        displayName, email, password, phone, birthDate, qualification,
        role: "branch_owner", companyCode, branchId: String(branch._id), parentId: req.user.id,
      }, companyCode, req.user.role);
      const linkedBranch = await BranchModel.findOneAndUpdate(
        { _id: branch._id, companyCode, pendingOwnerSetup: true, managerId: { $in: ["", null] } },
        { $set: { managerId: String(owner._id), pendingOwnerSetup: false } },
        { returnDocument: 'after', runValidators: true },
      ).lean();
      if (!linkedBranch) {
        await UserModel.deleteOne({ _id: owner._id, companyCode, branchId: String(branch._id), role: "branch_owner" });
        return res.status(409).json({ status: "error", message: "Chi nhánh đã được gán Chủ chi nhánh." });
      }
      const ownerData = owner.toObject();
      delete ownerData.password;
      return res.status(201).json({ status: "success", data: { branch: linkedBranch, owner: ownerData } });
    } catch (error: any) {
      if (owner?._id) await UserModel.deleteOne({ _id: owner._id }).catch(() => undefined);
      return res.status(400).json({ status: "error", message: error.message || "Không thể tạo Chủ chi nhánh." });
    }
  },
  async removePending(req: AuthenticatedRequest, res: Response) {
    if (req.user?.role !== "admin") return res.status(403).json({ status: "error", message: "Chỉ Admin được hủy chi nhánh mới." });
    const data = await BranchModel.findOneAndDelete({ _id: req.params.id, companyCode: company(req), pendingOwnerSetup: true, managerId: { $in: ["", null] } }).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Không tìm thấy chi nhánh chưa có Chủ chi nhánh." });
    return res.json({ status: "success", data });
  },
  async update(req: AuthenticatedRequest, res: Response) {
    if (!canManage(req)) return res.status(403).json({ status: "error", message: "Không có quyền quản lý chi nhánh." });
    const filter: Record<string, unknown> = { _id: req.params.id, companyCode: company(req) };
    if (req.user?.role === "branch_owner" && req.user.branchId) filter._id = req.user.branchId;
    const updates: Record<string, unknown> = {};
    for (const field of ["code", "name", "address", "phone", "managerId", "locationConfig", "attendanceLocations", "isActive"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }
    if (typeof updates.code === "string") updates.code = updates.code.toUpperCase();
    if (updates.locationConfig) {
      const config = updates.locationConfig as any;
      updates.locationConfig = { ...config, allowedPublicIps: config.allowedPublicIps.map(normalizeAllowedNetwork) };
    }
    if (updates.attendanceLocations) updates.attendanceLocations = normalizeAttendanceLocations(updates.attendanceLocations as any[]);
    const data = await BranchModel.findOneAndUpdate(filter, { $set: updates }, { returnDocument: 'after', runValidators: true }).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Không tìm thấy chi nhánh." });
    return res.json({ status: "success", data });
  },
};
