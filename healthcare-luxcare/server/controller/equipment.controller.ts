import type { Request, Response } from "express";
import { equipmentService } from "../service/equipment.service";
import XLSX from "xlsx";
import { managedUploadService, type ManagedUploadActor } from "../service/managed-upload.service";
import { resourceIndexingService } from "../service/resource-indexing.service";

const company = (req: Request) => String((req as any).user?.companyCode || "");

function uploadActor(req: Request): ManagedUploadActor {
  return {
    companyCode: company(req),
    branchId: String((req as any).user?.branchId || "") || undefined,
    actorId: String((req as any).user?.id || (req as any).user?.uid || ""),
    actorName: String((req as any).user?.name || (req as any).user?.email || "Hệ thống"),
  };
}

export const equipmentController = {
  list: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const query = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        category: req.query.category ? String(req.query.category) : undefined,
        departmentId: req.query.departmentId ? String(req.query.departmentId) : undefined,
        branchId: req.query.branchId
          ? String(req.query.branchId)
          : String((req as any).user?.branchId || "") || undefined,
        riskClassification: req.query.riskClassification ? String(req.query.riskClassification) : undefined,
        inspectionStatus: req.query.inspectionStatus ? String(req.query.inspectionStatus) : undefined,
      };

      const result = await equipmentService.list(companyCode, query);
      return res.json({ status: "success", ...result });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const item = await equipmentService.get(company(req), req.params.id);
      if (!item) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy thiết bị." });
      }
      return res.json({ status: "success", data: item });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const item = await equipmentService.create(company(req), {
        ...req.body,
        branchId: String((req as any).user?.branchId || req.body.branchId || ""),
      });
      return res.status(201).json({ status: "success", data: item });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const existing = await equipmentService.get(companyCode, req.params.id);
      if (!existing) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy thiết bị trong hệ thống." });
      }

      if (existing.status === "in-use") {
        return res.status(400).json({
          status: "error",
          message: "Thiết bị đang được sử dụng (đang có người mượn). Vui lòng hoàn tất quy trình trả thiết bị trước khi cập nhật thông tin.",
        });
      }

      if (existing.status === "requested") {
        return res.status(400).json({
          status: "error",
          message: "Thiết bị đang có yêu cầu mượn chờ duyệt. Vui lòng xử lý yêu cầu mượn trước khi cập nhật thông tin.",
        });
      }

      const item = await equipmentService.update(companyCode, req.params.id, req.body);
      if (!item) {
        return res.status(400).json({ status: "error", message: "Không thể cập nhật thông tin thiết bị do trạng thái không hợp lệ." });
      }
      return res.json({ status: "success", data: item });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const existing = await equipmentService.get(companyCode, req.params.id);
      if (!existing) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy thiết bị trong hệ thống." });
      }

      if (existing.status === "in-use") {
        return res.status(400).json({
          status: "error",
          message: "Thiết bị đang được sử dụng (đang có người mượn). Vui lòng hoàn tất quy trình trả thiết bị trước khi xóa.",
        });
      }

      if (existing.status === "requested") {
        return res.status(400).json({
          status: "error",
          message: "Thiết bị đang có yêu cầu mượn chờ duyệt. Không thể xóa thiết bị vào lúc này.",
        });
      }

      const result = await equipmentService.remove(companyCode, req.params.id);
      if (result.deletedCount === 0) {
        return res.status(400).json({ status: "error", message: "Không thể xóa thiết bị do trạng thái không hợp lệ." });
      }
      return res.json({ status: "success", message: "Xóa thiết bị thành công." });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  importExcel: async (req: Request, res: Response) => {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({ status: "error", message: "Vui lòng tải lên một tệp Excel." });
      }

      const workbook = XLSX.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<any>(sheet);

      if (rawRows.length === 0) {
        return res.status(400).json({ status: "error", message: "Tệp Excel không chứa dữ liệu thiết bị." });
      }

      const mappedItems = rawRows.map((row: any) => ({
        name: row["Tên thiết bị"] || row["Tên"] || row["name"],
        code: row["Mã thiết bị"] || row["Mã"] || row["code"],
        category: row["Danh mục"] || row["category"],
        status: row["Trạng thái"] || row["status"],
        location: row["Vị trí"] || row["location"],
        purchaseDate: row["Ngày mua"] || row["purchaseDate"],
        notes: row["Ghi chú"] || row["notes"],
        branchId: row["Mã chi nhánh"] || row["branchId"],
        quantity: row["Số lượng"] ?? row["quantity"],
      }));

      const defaultBranchId = String((req as any).user?.branchId || "");
      const result = await equipmentService.importMany(company(req), mappedItems, defaultBranchId);
      return res.status(201).json({
        status: "success",
        message: `Đã nhập thành công ${result.length} thiết bị.`,
        data: result,
      });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  exportExcel: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const isTemplate = req.query.template === "true";

      let rows: any[] = [];

      if (isTemplate) {
        rows = [
          {
            "Tên thiết bị": "Máy tính Dell XPS 13",
            "Mã thiết bị": "TB-001",
            "Danh mục": "Máy tính xách tay",
            "Trạng thái": "Sẵn sàng",
            "Vị trí": "Phòng họp A",
            "Ngày mua": "2026-08-01",
            "Ghi chú": "Thiết bị cấp cho nhân viên mới",
            "Mã chi nhánh": "",
          },
        ];
      } else {
        const query = {
          search: req.query.search ? String(req.query.search) : undefined,
          status: req.query.status ? String(req.query.status) : undefined,
          category: req.query.category ? String(req.query.category) : undefined,
          branchId: req.query.branchId
            ? String(req.query.branchId)
            : String((req as any).user?.branchId || "") || undefined,
        };
        const items = await equipmentService.listAllForExport(companyCode, query);

        rows = items.map((item: any) => {
          let statusText = "Sẵn sàng";
          if (item.status === "requested") statusText = "Đã có người tạo đơn";
          if (item.status === "in-use") statusText = "Đang sử dụng";
          if (item.status === "maintenance") statusText = "Bảo trì";
          if (item.status === "retired") statusText = "Thanh lý";

          return {
            "Tên thiết bị": item.name,
            "Mã thiết bị": item.code,
            "Danh mục": item.category,
            "Trạng thái": statusText,
            "Vị trí": item.location || "",
            "Ngày mua": item.purchaseDate ? new Date(item.purchaseDate).toISOString().split("T")[0] : "",
            "Ghi chú": item.notes || "",
            "Mã chi nhánh": item.branchId || "",
          };
        });
      }

      const workbook = XLSX.utils.book_new();
      const sheetName = isTemplate ? "Mẫu import thiết bị" : "Danh sách thiết bị";
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const filename = isTemplate ? "mau_import_thiet_bi.xlsx" : "danh_sach_thiet_bi.xlsx";
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      return res.send(buffer);
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  getComplianceSummary: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const branchId = req.query.branchId
        ? String(req.query.branchId)
        : String((req as any).user?.branchId || "") || undefined;
      const summary = await equipmentService.getComplianceSummary(companyCode, branchId);
      return res.json({ status: "success", data: summary });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  addLegalDocument: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const actorName = (req as any).user?.name || (req as any).user?.email || "Hệ thống";
      const updated = await equipmentService.addLegalDocument(companyCode, req.params.id, req.body, actorName);
      const documents = (updated as any).legalDocuments || [];
      const document = documents[documents.length - 1];
      if (req.body.uploadToken && document?._id) {
        await managedUploadService.finalizeManagedUpload(req.body.uploadToken, uploadActor(req), {
          expectedSourceType: "equipment.compliance",
          entityType: "equipment",
          entityId: String((updated as any)._id),
          entityLabel: String((updated as any).name || (updated as any).code || (updated as any)._id),
          sourceRecordId: String(document._id),
          sourceField: "legalDocument.file",
        });
      }
      return res.status(201).json({ status: "success", data: updated });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  removeLegalDocument: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const updated = await equipmentService.removeLegalDocument(companyCode, req.params.id, req.params.docId);
      await resourceIndexingService.trashSourceRecordResources(companyCode, "equipment.compliance", req.params.docId);
      return res.json({ status: "success", data: updated });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  recordInspection: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const userId = String((req as any).user?.id || (req as any).user?.uid || "");
      const result = await equipmentService.recordInspection(companyCode, req.params.id, req.body, userId);
      if (req.body.uploadToken && (result.record as any)?._id) {
        await managedUploadService.finalizeManagedUpload(req.body.uploadToken, uploadActor(req), {
          expectedSourceType: "equipment.compliance",
          entityType: "equipment",
          entityId: String((result.equipment as any)._id),
          entityLabel: String(
            (result.equipment as any).name || (result.equipment as any).code || (result.equipment as any)._id,
          ),
          sourceRecordId: String((result.record as any)._id),
          sourceField: "inspection.report",
        });
      }
      return res.status(201).json({ status: "success", data: result });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  listInspections: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const inspections = await equipmentService.listInspections(companyCode, req.params.id);
      return res.json({ status: "success", data: inspections });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },

  deleteInspectionRecord: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      await equipmentService.deleteInspectionRecord(companyCode, req.params.id, req.params.recordId);
      await resourceIndexingService.trashSourceRecordResources(
        companyCode,
        "equipment.compliance",
        req.params.recordId,
      );
      return res.json({ status: "success", message: "Xóa bản ghi kiểm định thành công." });
    } catch (err: any) {
      return res.status(400).json({ status: "error", message: err.message });
    }
  },
};
