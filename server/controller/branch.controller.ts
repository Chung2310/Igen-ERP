import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { BranchModel } from "../model/branch.model";
import { getRequestPublicIp, normalizeAllowedNetwork } from "../utils/request-ip";

const company = (req: AuthenticatedRequest) => String(req.user?.companyCode || "").trim().toUpperCase();
const canManage = (req: AuthenticatedRequest) => ["admin", "superadmin", "branch_owner"].includes(String(req.user?.role || ""));
async function ensureDefaultBranch(companyCode: string) {
  const existing = await BranchModel.findOne({ companyCode }).lean();
  if (existing) return existing;
  try {
    return await BranchModel.create({ companyCode, code: "MAIN", name: "Trụ sở chính", isActive: true });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    return BranchModel.findOne({ companyCode, code: "MAIN" }).lean();
  }
}

export const branchController = {
  currentIp(req: AuthenticatedRequest, res: Response) {
    return res.json({ status: "success", data: { ip: getRequestPublicIp(req) } });
  },
  async list(req: AuthenticatedRequest, res: Response) {
    const code = req.user?.role === "superadmin" && req.query.companyCode ? String(req.query.companyCode).toUpperCase() : company(req);
    let data = await BranchModel.find({ companyCode: code }).sort({ isActive: -1, name: 1 }).lean();
    if (data.length === 0 && req.user?.role === "admin" && code) {
      const created = await ensureDefaultBranch(code);
      data = created ? [created] : [];
    }
    return res.json({ status: "success", data });
  },
  async create(req: AuthenticatedRequest, res: Response) {
    if (!canManage(req)) return res.status(403).json({ status: "error", message: "Không có quyền quản lý chi nhánh." });
    const companyCode = req.user?.role === "superadmin" && req.body.companyCode ? String(req.body.companyCode).toUpperCase() : company(req);
    const locationConfig = req.body.locationConfig ? { ...req.body.locationConfig, allowedPublicIps: req.body.locationConfig.allowedPublicIps.map(normalizeAllowedNetwork) } : undefined;
    const data = await BranchModel.create({ ...req.body, locationConfig, companyCode, code: String(req.body.code || "").toUpperCase() });
    return res.status(201).json({ status: "success", data });
  },
  async update(req: AuthenticatedRequest, res: Response) {
    if (!canManage(req)) return res.status(403).json({ status: "error", message: "Không có quyền quản lý chi nhánh." });
    const filter: Record<string, unknown> = { _id: req.params.id, companyCode: company(req) };
    if (req.user?.role === "branch_owner" && req.user.branchId) filter._id = req.user.branchId;
    const updates: Record<string, unknown> = {};
    for (const field of ["code", "name", "address", "phone", "managerId", "locationConfig", "isActive"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }
    if (typeof updates.code === "string") updates.code = updates.code.toUpperCase();
    if (updates.locationConfig) {
      const config = updates.locationConfig as any;
      updates.locationConfig = { ...config, allowedPublicIps: config.allowedPublicIps.map(normalizeAllowedNetwork) };
    }
    const data = await BranchModel.findOneAndUpdate(filter, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Không tìm thấy chi nhánh." });
    return res.json({ status: "success", data });
  },
};
