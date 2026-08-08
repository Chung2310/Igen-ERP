import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { getResourceSourceDefinition } from "../config/resource-source-registry";
import { importResourceService } from "../service/import-resource.service";

interface ResourceImportRecorder {
  recordSuccessfulImport(actor: any, input: any): Promise<any>;
}

export function createResourceImportController(recorder: ResourceImportRecorder) {
  return {
    async complete(req: AuthenticatedRequest, res: Response) {
      try {
        const { sourceType, uploadToken, fileName } = req.body || {};
        const importedCount = Number(req.body?.importedCount);
        const skippedCount = Number(req.body?.skippedCount || 0);
        const source = getResourceSourceDefinition(String(sourceType || ""));
        if (!["import.inventory-product", "import.inventory-stock"].includes(source.sourceType)) {
          throw new Error("Nguồn này không được hoàn tất qua endpoint import kho.");
        }
        if (!req.user?.id || !req.user.companyCode) throw new Error("Người dùng chưa xác thực.");
        if (!uploadToken || !fileName) throw new Error("Thiếu thông tin file import.");
        if (!Number.isFinite(importedCount) || importedCount < 0 || !Number.isFinite(skippedCount) || skippedCount < 0) {
          throw new Error("Số lượng dữ liệu import không hợp lệ.");
        }
        const companyCode = req.user.role === "superadmin" && req.body?.companyCode
          ? String(req.body.companyCode).trim().toUpperCase()
          : req.user.companyCode;
        const run = await recorder.recordSuccessfulImport({
          companyCode,
          branchId: req.user.branchId,
          actorId: req.user.id,
          actorName: req.user.email,
        }, {
          sourceType: source.sourceType,
          uploadToken: String(uploadToken),
          fileName: String(fileName),
          importedCount,
          skippedCount,
        });
        return res.status(201).json({ success: true, data: run });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : "Không thể ghi nhận file import.",
        });
      }
    },
  };
}

export const resourceImportController = createResourceImportController(importResourceService);
