import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { HRContractExtensionModel, HRContractModel } from "../model/hr-contract.model";
import { UserModel } from "../model/user.model";
import { hrContractService } from "../service/hr-contract.service";
import {
  managedUploadService,
  type FinalizeManagedUploadInput,
  type ManagedUploadActor,
} from "../service/managed-upload.service";
import type { ResourceIndexingRecord } from "../service/resource-indexing.service";
import { paginationMeta, parsePagination } from "../utils/pagination";

const tenant = (req: AuthenticatedRequest) =>
  req.user?.role === "superadmin" && req.query.companyCode
    ? String(req.query.companyCode)
    : req.user?.companyCode || "SYSTEM";
const canViewAll = (req: AuthenticatedRequest) => ["superadmin", "admin", "manager"].includes(req.user?.role || "");

type FinalizeUpload = (
  token: string,
  actor: ManagedUploadActor,
  source: FinalizeManagedUploadInput,
) => Promise<ResourceIndexingRecord>;

export async function finalizeContractPendingUploads(input: {
  contract: { _id: unknown; employeeId: string; employeeName: string };
  body: {
    contractFileUploadToken?: string;
    signedImageUploadToken?: string;
    contractFiles?: Array<{ url: string; name: string; mimeType?: string; size?: number; resourceId?: string; uploadToken?: string }>;
    signedImages?: Array<{ url: string; name: string; mimeType?: string; size?: number; resourceId?: string; uploadToken?: string }>;
  };
  actor: ManagedUploadActor;
  finalizeManagedUpload?: FinalizeUpload;
}) {
  const finalize = input.finalizeManagedUpload || managedUploadService.finalizeManagedUpload;
  const sourceBase = {
    expectedSourceType: "hr.contract",
    entityType: "employee",
    entityId: String(input.contract.employeeId),
    entityLabel: input.contract.employeeName,
    sourceRecordId: String(input.contract._id),
    sourceAudienceIds: [String(input.contract.employeeId)],
  };
  const patch: {
    contractResourceId?: string;
    signedImageResourceId?: string;
    contractFiles?: any[];
    signedImages?: any[];
  } = {};
  if (input.body.contractFileUploadToken) {
    const resource = await finalize(input.body.contractFileUploadToken, input.actor, {
      ...sourceBase,
      sourceField: "contractFile",
    });
    patch.contractResourceId = resource._id;
  }
  if (input.body.signedImageUploadToken) {
    const resource = await finalize(input.body.signedImageUploadToken, input.actor, {
      ...sourceBase,
      sourceField: "signedImage",
    });
    patch.signedImageResourceId = resource._id;
  }
  if (Array.isArray(input.body.contractFiles) && input.body.contractFiles.length > 0) {
    const updatedFiles = await Promise.all(
      input.body.contractFiles.map(async (file, idx) => {
        if (file.uploadToken && !file.resourceId) {
          try {
            const res = await finalize(file.uploadToken, input.actor, {
              ...sourceBase,
              sourceField: `contractFiles[${idx}]`,
            });
            return { ...file, resourceId: res._id };
          } catch {
            return file;
          }
        }
        return file;
      }),
    );
    patch.contractFiles = updatedFiles;
    if (!patch.contractResourceId && updatedFiles[0]?.resourceId) {
      patch.contractResourceId = updatedFiles[0].resourceId;
    }
  }
  if (Array.isArray(input.body.signedImages) && input.body.signedImages.length > 0) {
    const updatedImages = await Promise.all(
      input.body.signedImages.map(async (img, idx) => {
        if (img.uploadToken && !img.resourceId) {
          try {
            const res = await finalize(img.uploadToken, input.actor, {
              ...sourceBase,
              sourceField: `signedImages[${idx}]`,
            });
            return { ...img, resourceId: res._id };
          } catch {
            return img;
          }
        }
        return img;
      }),
    );
    patch.signedImages = updatedImages;
    if (!patch.signedImageResourceId && updatedImages[0]?.resourceId) {
      patch.signedImageResourceId = updatedImages[0].resourceId;
    }
  }
  return patch;
}

export async function finalizeExtensionPendingUploads(input: {
  extension: { _id: unknown; employeeId: string; employeeName: string };
  body: {
    extensionFileUploadToken?: string;
    extensionSignedImageUploadToken?: string;
    extensionFiles?: Array<{ url: string; name: string; mimeType?: string; size?: number; resourceId?: string; uploadToken?: string }>;
    signedImages?: Array<{ url: string; name: string; mimeType?: string; size?: number; resourceId?: string; uploadToken?: string }>;
  };
  actor: ManagedUploadActor;
  finalizeManagedUpload?: FinalizeUpload;
}) {
  const finalize = input.finalizeManagedUpload || managedUploadService.finalizeManagedUpload;
  const sourceBase = {
    expectedSourceType: "hr.contract",
    entityType: "employee",
    entityId: String(input.extension.employeeId),
    entityLabel: input.extension.employeeName,
    sourceRecordId: String(input.extension._id),
    sourceAudienceIds: [String(input.extension.employeeId)],
  };
  const patch: {
    extensionResourceId?: string;
    signedImageResourceId?: string;
    extensionFiles?: any[];
    signedImages?: any[];
  } = {};
  if (input.body.extensionFileUploadToken) {
    const resource = await finalize(input.body.extensionFileUploadToken, input.actor, {
      ...sourceBase,
      sourceField: "extensionFile",
    });
    patch.extensionResourceId = resource._id;
  }
  if (input.body.extensionSignedImageUploadToken) {
    const resource = await finalize(input.body.extensionSignedImageUploadToken, input.actor, {
      ...sourceBase,
      sourceField: "extensionSignedImage",
    });
    patch.signedImageResourceId = resource._id;
  }
  if (Array.isArray(input.body.extensionFiles) && input.body.extensionFiles.length > 0) {
    const updatedFiles = await Promise.all(
      input.body.extensionFiles.map(async (file, idx) => {
        if (file.uploadToken && !file.resourceId) {
          try {
            const res = await finalize(file.uploadToken, input.actor, {
              ...sourceBase,
              sourceField: `extensionFiles[${idx}]`,
            });
            return { ...file, resourceId: res._id };
          } catch {
            return file;
          }
        }
        return file;
      }),
    );
    patch.extensionFiles = updatedFiles;
    if (!patch.extensionResourceId && updatedFiles[0]?.resourceId) {
      patch.extensionResourceId = updatedFiles[0].resourceId;
    }
  }
  if (Array.isArray(input.body.signedImages) && input.body.signedImages.length > 0) {
    const updatedImages = await Promise.all(
      input.body.signedImages.map(async (img, idx) => {
        if (img.uploadToken && !img.resourceId) {
          try {
            const res = await finalize(img.uploadToken, input.actor, {
              ...sourceBase,
              sourceField: `signedImages[${idx}]`,
            });
            return { ...img, resourceId: res._id };
          } catch {
            return img;
          }
        }
        return img;
      }),
    );
    patch.signedImages = updatedImages;
    if (!patch.signedImageResourceId && updatedImages[0]?.resourceId) {
      patch.signedImageResourceId = updatedImages[0].resourceId;
    }
  }
  return patch;
}

function uploadActor(req: AuthenticatedRequest, companyCode: string): ManagedUploadActor {
  return {
    companyCode,
    branchId: req.user?.branchId,
    actorId: req.user!.id,
    actorName: req.user!.email,
  };
}

export const hrContractController = {
  async uploadResource(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = tenant(req);
      const { file, name, mimeType, size, kind } = req.body;
      void kind;
      const pending = await managedUploadService.createPendingUpload(
        {
          companyCode,
          branchId: req.user?.branchId,
          actorId: req.user!.id,
          actorName: req.user!.email,
        },
        { sourceType: "hr.contract", file, fileName: name, mimeType, size },
      );
      return res.status(201).json({ status: "success", data: { url: pending.fileUrl, uploadToken: pending.token } });
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
      const employeeFilter = canViewAll(req) ? String(req.query.employeeId || "") : req.user!.id;
      await hrContractService.updateExpiredStatus(companyCode);
      const branchId = req.query.branchId ? String(req.query.branchId) : req.user?.branchId;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const [paginationResult, employees, expiringContracts] = await Promise.all([
        hrContractService.list({
          companyCode,
          branchId,
          employeeId: employeeFilter || undefined,
          search: req.query.search ? String(req.query.search) : undefined,
          page,
          limit,
        }),
        canViewAll(req)
          ? UserModel.find({ companyCode, isActive: { $ne: false }, ...(branchId ? { branchId } : {}) })
              .select("_id displayName email department")
              .sort({ displayName: 1 })
              .lean()
          : UserModel.find({ _id: req.user!.id, companyCode }).select("_id displayName email department").lean(),
        hrContractService.getExpiringContracts({
          companyCode,
          branchId,
          employeeId: employeeFilter || undefined,
          days: 20,
        }),
      ]);
      return res.json({
        status: "success",
        data: {
          contracts: paginationResult.contracts,
          total: paginationResult.total,
          page: paginationResult.page,
          limit: paginationResult.limit,
          employees,
          expiringContracts,
        },
      });
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

      const payload: any = { ...req.body };
      if (Array.isArray(payload.contractFiles) && payload.contractFiles.length > 0) {
        if (!payload.contractFileUrl) payload.contractFileUrl = payload.contractFiles[0].url;
        if (!payload.contractFileName) payload.contractFileName = payload.contractFiles[0].name;
        if (!payload.contractFileMimeType) payload.contractFileMimeType = payload.contractFiles[0].mimeType;
        if (!payload.contractFileSize) payload.contractFileSize = payload.contractFiles[0].size;
        if (!payload.contractResourceId) payload.contractResourceId = payload.contractFiles[0].resourceId;
      } else if (payload.contractFileUrl) {
        payload.contractFiles = [
          {
            url: payload.contractFileUrl,
            name: payload.contractFileName || "Tệp hợp đồng",
            mimeType: payload.contractFileMimeType,
            size: payload.contractFileSize,
            resourceId: payload.contractResourceId,
          },
        ];
      }
      if (Array.isArray(payload.signedImages) && payload.signedImages.length > 0) {
        if (!payload.signedImageUrl) payload.signedImageUrl = payload.signedImages[0].url;
        if (!payload.signedImageName) payload.signedImageName = payload.signedImages[0].name;
        if (!payload.signedImageMimeType) payload.signedImageMimeType = payload.signedImages[0].mimeType;
        if (!payload.signedImageSize) payload.signedImageSize = payload.signedImages[0].size;
        if (!payload.signedImageResourceId) payload.signedImageResourceId = payload.signedImages[0].resourceId;
      } else if (payload.signedImageUrl) {
        payload.signedImages = [
          {
            url: payload.signedImageUrl,
            name: payload.signedImageName || "Ảnh hợp đồng đã ký",
            mimeType: payload.signedImageMimeType,
            size: payload.signedImageSize,
            resourceId: payload.signedImageResourceId,
          },
        ];
      }

      const data = await HRContractModel.create({
        ...payload,
        companyCode,
        branchId: employee.branchId || undefined,
        employeeName: employee.displayName || employee.email,
        createdBy: req.user!.id,
      });
      try {
        const resourcePatch = await finalizeContractPendingUploads({
          contract: data,
          body: req.body,
          actor: uploadActor(req, companyCode),
        });
        if (Object.keys(resourcePatch).length > 0) {
          data.set(resourcePatch);
          await data.save();
        }
      } catch (error) {
        await HRContractModel.deleteOne({ _id: data._id, companyCode }).catch(() => undefined);
        throw error;
      }
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
      if (!existing) return res.status(404).json({ status: "error", message: "Không tìm thấy hợp đồng." });
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
      const startDate = patch.startDate ? new Date(patch.startDate) : existing.startDate;
      const endDate = patch.endDate ? new Date(patch.endDate) : existing.endDate;
      if (endDate < startDate)
        return res.status(400).json({
          status: "error",
          message: "Ngày hết hạn phải sau ngày bắt đầu.",
        });

      if (Array.isArray(patch.contractFiles)) {
        if (patch.contractFiles.length > 0) {
          patch.contractFileUrl = patch.contractFiles[0].url;
          patch.contractFileName = patch.contractFiles[0].name;
          patch.contractFileMimeType = patch.contractFiles[0].mimeType;
          patch.contractFileSize = patch.contractFiles[0].size;
          patch.contractResourceId = patch.contractFiles[0].resourceId;
        } else {
          patch.contractFileUrl = "";
          patch.contractFileName = "";
          patch.contractFileMimeType = "";
          patch.contractFileSize = 0;
          patch.contractResourceId = "";
        }
      } else if (patch.contractFileUrl) {
        patch.contractFiles = [
          {
            url: patch.contractFileUrl,
            name: patch.contractFileName || "Tệp hợp đồng",
            mimeType: patch.contractFileMimeType,
            size: patch.contractFileSize,
            resourceId: patch.contractResourceId,
          },
        ];
      }
      if (Array.isArray(patch.signedImages)) {
        if (patch.signedImages.length > 0) {
          patch.signedImageUrl = patch.signedImages[0].url;
          patch.signedImageName = patch.signedImages[0].name;
          patch.signedImageMimeType = patch.signedImages[0].mimeType;
          patch.signedImageSize = patch.signedImages[0].size;
          patch.signedImageResourceId = patch.signedImages[0].resourceId;
        } else {
          patch.signedImageUrl = "";
          patch.signedImageName = "";
          patch.signedImageMimeType = "";
          patch.signedImageSize = 0;
          patch.signedImageResourceId = "";
        }
      } else if (patch.signedImageUrl) {
        patch.signedImages = [
          {
            url: patch.signedImageUrl,
            name: patch.signedImageName || "Ảnh hợp đồng đã ký",
            mimeType: patch.signedImageMimeType,
            size: patch.signedImageSize,
            resourceId: patch.signedImageResourceId,
          },
        ];
      }

      const data = await HRContractModel.findOneAndUpdate(
        { _id: existing._id, companyCode },
        { $set: patch },
        { returnDocument: "after", runValidators: true },
      );
      if (data) {
        const resourcePatch = await finalizeContractPendingUploads({
          contract: data,
          body: req.body,
          actor: uploadActor(req, companyCode),
        });
        if (Object.keys(resourcePatch).length > 0) {
          data.set(resourcePatch);
          await data.save();
        }
      }
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
      const { page, limit, skip } = parsePagination(req.query);
      const companyCode = tenant(req);
      const branchId = req.query.branchId ? String(req.query.branchId) : req.user?.branchId;
      const query: any = { companyCode };
      if (branchId) query.branchId = branchId;
      if (!canViewAll(req)) query.employeeId = req.user!.id;
      if (req.query.contractId) query.contractId = String(req.query.contractId);
      const [data, total] = await Promise.all([
        HRContractExtensionModel.find(query).sort({ extensionDate: -1, _id: -1 }).skip(skip).limit(limit).lean(),
        HRContractExtensionModel.countDocuments(query),
      ]);
      return res.json({ status: "success", data, pagination: paginationMeta(page, limit, total) });
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
      if (!contract) return res.status(404).json({ status: "error", message: "Không tìm thấy hợp đồng." });
      const newEndDate = new Date(req.body.newEndDate);
      if (newEndDate <= contract.endDate)
        return res.status(400).json({
          status: "error",
          message: "Ngày hết hạn mới phải sau ngày hết hạn hiện tại.",
        });
      const previousEndDate = contract.endDate;

      const payload: any = { ...req.body };
      if (Array.isArray(payload.extensionFiles) && payload.extensionFiles.length > 0) {
        if (!payload.extensionFileUrl) payload.extensionFileUrl = payload.extensionFiles[0].url;
        if (!payload.extensionFileName) payload.extensionFileName = payload.extensionFiles[0].name;
        if (!payload.extensionFileMimeType) payload.extensionFileMimeType = payload.extensionFiles[0].mimeType;
        if (!payload.extensionFileSize) payload.extensionFileSize = payload.extensionFiles[0].size;
        if (!payload.extensionResourceId) payload.extensionResourceId = payload.extensionFiles[0].resourceId;
      } else if (payload.extensionFileUrl) {
        payload.extensionFiles = [
          {
            url: payload.extensionFileUrl,
            name: payload.extensionFileName || "Tệp gia hạn",
            mimeType: payload.extensionFileMimeType,
            size: payload.extensionFileSize,
            resourceId: payload.extensionResourceId,
          },
        ];
      }
      if (Array.isArray(payload.signedImages) && payload.signedImages.length > 0) {
        if (!payload.signedImageUrl) payload.signedImageUrl = payload.signedImages[0].url;
        if (!payload.signedImageName) payload.signedImageName = payload.signedImages[0].name;
        if (!payload.signedImageMimeType) payload.signedImageMimeType = payload.signedImages[0].mimeType;
        if (!payload.signedImageSize) payload.signedImageSize = payload.signedImages[0].size;
        if (!payload.signedImageResourceId) payload.signedImageResourceId = payload.signedImages[0].resourceId;
      } else if (payload.signedImageUrl) {
        payload.signedImages = [
          {
            url: payload.signedImageUrl,
            name: payload.signedImageName || "Ảnh gia hạn đã ký",
            mimeType: payload.signedImageMimeType,
            size: payload.signedImageSize,
            resourceId: payload.signedImageResourceId,
          },
        ];
      }

      const extension = await HRContractExtensionModel.create({
        ...payload,
        companyCode,
        branchId: contract.branchId || undefined,
        contractId: String(contract._id),
        employeeId: contract.employeeId,
        employeeName: contract.employeeName,
        previousEndDate,
        createdBy: req.user!.id,
      });
      try {
        const resourcePatch = await finalizeExtensionPendingUploads({
          extension,
          body: req.body,
          actor: uploadActor(req, companyCode),
        });
        if (Object.keys(resourcePatch).length > 0) {
          extension.set(resourcePatch);
          await extension.save();
        }
      } catch (error) {
        await HRContractExtensionModel.deleteOne({ _id: extension._id, companyCode }).catch(() => undefined);
        throw error;
      }
      contract.endDate = newEndDate;
      if (contract.status === "expired") contract.status = "active";
      contract.updatedBy = req.user!.id;
      await contract.save();
      return res.status(201).json({ status: "success", data: { contract, extension } });
    } catch (error: any) {
      return res.status(500).json({
        status: "error",
        message: "Không thể gia hạn hợp đồng.",
        details: error.message,
      });
    }
  },
};
