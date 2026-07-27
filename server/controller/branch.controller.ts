import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { BranchModel } from "../model/branch.model";

const company = (req: AuthenticatedRequest) => String(req.user?.companyCode || "").trim().toUpperCase();
const canManage = (req: AuthenticatedRequest) => ["admin", "superadmin"].includes(String(req.user?.role || ""));

export const branchController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const code = req.user?.role === "superadmin" && req.query.companyCode ? String(req.query.companyCode).toUpperCase() : company(req);
    const data = await BranchModel.find({ companyCode: code }).sort({ isActive: -1, name: 1 }).lean();
    return res.json({ status: "success", data });
  },
  async create(req: AuthenticatedRequest, res: Response) {
    if (!canManage(req)) return res.status(403).json({ status: "error", message: "Không có quyền quản lý chi nhánh." });
    const companyCode = req.user?.role === "superadmin" && req.body.companyCode ? String(req.body.companyCode).toUpperCase() : company(req);
    const data = await BranchModel.create({ ...req.body, companyCode, code: String(req.body.code || "").toUpperCase() });
    return res.status(201).json({ status: "success", data });
  },
  async update(req: AuthenticatedRequest, res: Response) {
    if (!canManage(req)) return res.status(403).json({ status: "error", message: "Không có quyền quản lý chi nhánh." });
    const filter = { _id: req.params.id, companyCode: company(req) };
    const data = await BranchModel.findOneAndUpdate(filter, { $set: req.body }, { new: true, runValidators: true }).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Không tìm thấy chi nhánh." });
    return res.json({ status: "success", data });
  },
};
