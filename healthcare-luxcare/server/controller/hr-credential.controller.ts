import { logger } from "../config/logger";
import type { Response } from "express";
import { getCredentialStatus } from "../../shared/hr-credential";
import type { AuthenticatedRequest } from "../middleware/auth";
import { getEffectivePermissions } from "../middleware/auth";
import { HRCredentialModel } from "../model/hr-credential.model";
import { UserModel } from "../model/user.model";
import { hrCredentialService } from "../service/hr-credential.service";
import { managedUploadService, type ManagedUploadActor } from "../service/managed-upload.service";
import { resourceIndexingService } from "../service/resource-indexing.service";

function tenant(req: AuthenticatedRequest): string {
  return (
    req.user?.role === "superadmin" && req.query.companyCode
      ? String(req.query.companyCode)
      : req.user?.companyCode || "SYSTEM"
  ).toUpperCase();
}

async function canViewAllCredentials(req: AuthenticatedRequest): Promise<boolean> {
  if (["superadmin", "admin", "branch_owner", "manager"].includes(req.user!.role)) return true;
  const permissions = await getEffectivePermissions(req.user!.id, req.user!.role, req.user?.companyCode);
  return permissions.has("*") || permissions.has("credentials:manage") || permissions.has("hr:manage");
}

function actor(req: AuthenticatedRequest, companyCode: string): ManagedUploadActor {
  return {
    companyCode,
    branchId: req.user?.branchId,
    actorId: req.user!.id,
    actorName: req.user!.email,
  };
}

function validateDates(issueDate: Date, expiryDate?: Date | null): string | null {
  if (expiryDate && expiryDate < issueDate) return "Ngày hết hạn phải bằng hoặc sau ngày cấp.";
  return null;
}

function managedRecordScope(companyCode: string) {
  return { companyCode };
}

async function finalizeScan(
  req: AuthenticatedRequest,
  companyCode: string,
  credential: { _id: unknown; employeeId: string; employeeName: string },
  uploadToken?: string,
) {
  if (!uploadToken) return undefined;
  return managedUploadService.finalizeManagedUpload(uploadToken, actor(req, companyCode), {
    expectedSourceType: "hr.credential",
    entityType: "employee",
    entityId: credential.employeeId,
    entityLabel: credential.employeeName,
    sourceRecordId: String(credential._id),
    sourceField: "scan",
    sourceAudienceIds: [credential.employeeId],
  });
}

export const hrCredentialController = {
  async upload(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const pending = await managedUploadService.createPendingUpload(actor(req, companyCode), {
        sourceType: "hr.credential",
        file: req.body.file,
        fileName: req.body.name,
        mimeType: req.body.mimeType,
        size: req.body.size,
      });
      return res.status(201).json({
        status: "success",
        data: { url: pending.fileUrl, uploadToken: pending.token },
      });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể tải file văn bằng/chứng chỉ lên kho tài nguyên.",
        details: error.message,
      });
    }
  },

  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const canViewAll = await canViewAllCredentials(req);
      const employeeId = canViewAll ? String(req.query.employeeId || "") : req.user!.id;
      const branchId = canViewAll && req.query.branchId ? String(req.query.branchId) : undefined;
      const result = await hrCredentialService.list({
        companyCode,
        branchId,
        employeeId: employeeId || undefined,
        status: req.query.status as any,
        type: req.query.type as any,
        search: req.query.search ? String(req.query.search) : undefined,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        all: req.query.all === "true",
      });
      const employees = canViewAll
        ? await UserModel.find({
            companyCode,
            isActive: { $ne: false },
          })
            .select("_id displayName email department branchId")
            .sort({ displayName: 1 })
            .lean()
        : await UserModel.find({ _id: req.user!.id, companyCode })
            .select("_id displayName email department branchId")
            .lean();
      return res.json({ status: "success", data: { ...result, employees } });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể tải danh sách văn bằng/chứng chỉ.",
        details: error.message,
      });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const employee: any = await UserModel.findOne({
        _id: req.body.employeeId,
        ...managedRecordScope(companyCode),
      })
        .select("_id displayName email branchId")
        .lean();
      if (!employee) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy nhân viên trong công ty." });
      }
      const issueDate = new Date(req.body.issueDate);
      const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
      const dateError = validateDates(issueDate, expiryDate);
      if (dateError) return res.status(400).json({ status: "error", message: dateError });
      const reminderDays = Number(req.body.reminderDays) || 30;
      const { uploadToken, resourceId: _ignoredResourceId, ...payload } = req.body;
      const credential = await HRCredentialModel.create({
        ...payload,
        expiryDate,
        companyCode,
        branchId: employee.branchId || undefined,
        employeeName: employee.displayName || employee.email,
        reminderDays,
        status: getCredentialStatus(expiryDate, reminderDays),
        createdBy: req.user!.id,
      });
      try {
        const resource = await finalizeScan(req, companyCode, credential, uploadToken);
        if (resource) {
          credential.resourceId = resource._id;
          await credential.save();
        }
      } catch (error) {
        await HRCredentialModel.deleteOne({ _id: credential._id, companyCode }).catch(() => undefined);
        throw error;
      }
      return res.status(201).json({ status: "success", data: credential });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể thêm văn bằng/chứng chỉ.",
        details: error.message,
      });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const credential = await HRCredentialModel.findOne({
        _id: req.params.id,
        ...managedRecordScope(companyCode),
      });
      if (!credential) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy văn bằng/chứng chỉ." });
      }
      const patch: any = { ...req.body, updatedBy: req.user!.id };
      if (patch.employeeId && patch.employeeId !== credential.employeeId) {
        const employee: any = await UserModel.findOne({
          _id: patch.employeeId,
          ...managedRecordScope(companyCode),
        })
          .select("displayName email branchId")
          .lean();
        if (!employee) {
          return res.status(404).json({ status: "error", message: "Không tìm thấy nhân viên trong công ty." });
        }
        patch.employeeName = employee.displayName || employee.email;
        patch.branchId = employee.branchId || null;
      }
      const issueDate = patch.issueDate ? new Date(patch.issueDate) : credential.issueDate;
      const expiryDate = Object.prototype.hasOwnProperty.call(patch, "expiryDate")
        ? patch.expiryDate
          ? new Date(patch.expiryDate)
          : null
        : credential.expiryDate;
      const dateError = validateDates(issueDate, expiryDate);
      if (dateError) return res.status(400).json({ status: "error", message: dateError });
      patch.expiryDate = expiryDate;
      patch.status = getCredentialStatus(expiryDate, patch.reminderDays || credential.reminderDays);
      const uploadToken = patch.uploadToken;
      delete patch.resourceId;
      if (!uploadToken && Object.prototype.hasOwnProperty.call(patch, "fileUrl") && !patch.fileUrl) {
        Object.assign(patch, { fileUrl: "", fileName: "", fileMimeType: "", fileSize: 0, resourceId: null });
      }
      const resource = await finalizeScan(
        req,
        companyCode,
        {
          _id: credential._id,
          employeeId: patch.employeeId || credential.employeeId,
          employeeName: patch.employeeName || credential.employeeName,
        },
        uploadToken,
      );
      if (resource) patch.resourceId = resource._id;
      delete patch.uploadToken;
      const data = await HRCredentialModel.findOneAndUpdate(
        { _id: credential._id, companyCode },
        { $set: patch },
        { returnDocument: "after", runValidators: true },
      );
      return res.json({ status: "success", data });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể cập nhật văn bằng/chứng chỉ.",
        details: error.message,
      });
    }
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const credential = await HRCredentialModel.findOneAndDelete({
        _id: req.params.id,
        ...managedRecordScope(companyCode),
      });
      if (!credential) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy văn bằng/chứng chỉ." });
      }
      if (credential.resourceId) {
        await resourceIndexingService
          .trashResourceById(companyCode, credential.resourceId)
          .catch((error) => logger.error("[hrCredentialController.remove] Không thể xóa mềm tài nguyên:", error));
      }
      return res.json({ status: "success", message: "Đã xóa văn bằng/chứng chỉ." });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể xóa văn bằng/chứng chỉ.",
        details: error.message,
      });
    }
  },
};
