import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  HRContractExtensionModel,
  HRContractModel,
} from "../model/hr-contract.model";
import { UserModel } from "../model/user.model";
import { ResourceItemModel } from "../model/resource-item.model";
import { cloudinaryService } from "../service/cloudinary.service";
import { resourceService } from "../service/resource.service";

const tenant = (req: AuthenticatedRequest) =>
  req.user?.role === "superadmin" && req.query.companyCode
    ? String(req.query.companyCode)
    : req.user?.companyCode || "SYSTEM";
const canViewAll = (req: AuthenticatedRequest) =>
  ["superadmin", "admin", "manager"].includes(req.user?.role || "");

export const hrContractController = {
  async uploadResource(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const { file, name, mimeType, size, kind } = req.body;
      const isSigned = kind === "signed" || kind === "extensionSigned";
      const fileUrl = await cloudinaryService.uploadMedia(
        file,
        isSigned
          ? "igen_erp/hr-contracts/signed"
          : "igen_erp/hr-contracts/documents",
      );
      let folder = await ResourceItemModel.findOne({
        companyCode,
        section: "local",
        type: "folder",
        parentId: null,
        name: "HỢP ĐỒNG NHÂN SỰ",
        isDeleted: { $ne: true },
      });
      if (!folder)
        folder = await ResourceItemModel.create({
          companyCode,
          section: "local",
          type: "folder",
          name: "HỢP ĐỒNG NHÂN SỰ",
          parentId: null,
          creatorUid: req.user!.id,
          creatorName: req.user!.email,
        });
      const resource = await resourceService.createFile(
        companyCode,
        { name, fileUrl, parentId: String(folder._id), mimeType, size },
        { uid: req.user!.id, name: req.user!.email },
      );
      return res
        .status(201)
        .json({ status: "success", data: { url: fileUrl, resource } });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể tải và lưu tệp hợp đồng vào kho tài nguyên.",
        details: error.message,
      });
    }
  },
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const employeeFilter = canViewAll(req)
        ? String(req.query.employeeId || "")
        : req.user!.id;
      await HRContractModel.updateMany(
        { companyCode, status: "active", endDate: { $lt: new Date() } },
        { $set: { status: "expired" } },
      );
      const branchId = req.query.branchId ? String(req.query.branchId) : req.user?.branchId;
      const query: any = { companyCode };
      if (branchId) query.branchId = branchId;
      if (employeeFilter) query.employeeId = employeeFilter;
      const [contracts, employees] = await Promise.all([
        HRContractModel.find(query).sort({ endDate: -1 }).lean(),
        canViewAll(req)
          ? UserModel.find({ companyCode, isActive: { $ne: false }, ...(branchId ? { branchId } : {}) })
              .select("_id displayName email department")
              .sort({ displayName: 1 })
              .lean()
          : UserModel.find({ _id: req.user!.id, companyCode })
              .select("_id displayName email department")
              .lean(),
      ]);
      return res.json({ status: "success", data: { contracts, employees } });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể tải danh sách hợp đồng.",
        details: error.message,
      });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const employee = await UserModel.findOne({
        _id: req.body.employeeId,
        companyCode,
      })
        .select("displayName email branchId")
        .lean();
      if (!employee)
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy nhân viên trong công ty.",
        });
      const data = await HRContractModel.create({
        ...req.body,
        companyCode,
        branchId: employee.branchId || undefined,
        employeeName: employee.displayName || employee.email,
        createdBy: req.user!.id,
      });
      return res.status(201).json({ status: "success", data });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể tạo hợp đồng.",
        details: error.message,
      });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const existing = await HRContractModel.findOne({
        _id: req.params.id,
        companyCode,
      });
      if (!existing)
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy hợp đồng." });
      const patch: any = { ...req.body, updatedBy: req.user!.id };
      if (patch.employeeId) {
        const employee = await UserModel.findOne({
          _id: patch.employeeId,
          companyCode,
        })
          .select("displayName email branchId")
          .lean();
        if (!employee)
          return res.status(404).json({
            status: "error",
            message: "Không tìm thấy nhân viên trong công ty.",
          });
        patch.employeeName = employee.displayName || employee.email;
        patch.branchId = employee.branchId || null;
      }
      const startDate = patch.startDate
        ? new Date(patch.startDate)
        : existing.startDate;
      const endDate = patch.endDate
        ? new Date(patch.endDate)
        : existing.endDate;
      if (endDate < startDate)
        return res.status(400).json({
          status: "error",
          message: "Ngày hết hạn phải sau ngày bắt đầu.",
        });
      const data = await HRContractModel.findOneAndUpdate(
        { _id: existing._id, companyCode },
        { $set: patch },
        { new: true, runValidators: true },
      );
      return res.json({ status: "success", data });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể cập nhật hợp đồng.",
        details: error.message,
      });
    }
  },

  async listExtensions(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const branchId = req.query.branchId ? String(req.query.branchId) : req.user?.branchId;
      const query: any = { companyCode };
      if (branchId) query.branchId = branchId;
      if (!canViewAll(req)) query.employeeId = req.user!.id;
      if (req.query.contractId) query.contractId = String(req.query.contractId);
      const data = await HRContractExtensionModel.find(query)
        .sort({ extensionDate: -1 })
        .lean();
      return res.json({ status: "success", data });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể tải lịch sử gia hạn.",
        details: error.message,
      });
    }
  },

  async extend(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const contract = await HRContractModel.findOne({
        _id: req.params.id,
        companyCode,
      });
      if (!contract)
        return res
          .status(404)
          .json({ status: "error", message: "Không tìm thấy hợp đồng." });
      const newEndDate = new Date(req.body.newEndDate);
      if (newEndDate <= contract.endDate)
        return res.status(400).json({
          status: "error",
          message: "Ngày hết hạn mới phải sau ngày hết hạn hiện tại.",
        });
      const previousEndDate = contract.endDate;
      const extension = await HRContractExtensionModel.create({
        ...req.body,
        companyCode,
        branchId: contract.branchId || undefined,
        contractId: String(contract._id),
        employeeId: contract.employeeId,
        employeeName: contract.employeeName,
        previousEndDate,
        createdBy: req.user!.id,
      });
      contract.endDate = newEndDate;
      if (contract.status === "expired") contract.status = "active";
      contract.updatedBy = req.user!.id;
      await contract.save();
      return res
        .status(201)
        .json({ status: "success", data: { contract, extension } });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể gia hạn hợp đồng.",
        details: error.message,
      });
    }
  },
};
