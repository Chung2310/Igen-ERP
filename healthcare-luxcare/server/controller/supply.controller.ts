import { supplyErrorResponse } from "../service/supply/errors";
import type { Request, Response } from "express";
import { supplyService } from "../service/supply.service";
import { completeVoucherDraft, createVoucherDraft, updateVoucherDraft } from "../service/supply/voucher.service";
import XLSX from "xlsx";

const branch = (req: Request) => (req as any).user?.branchId as string | undefined;
const operationKey = (req: Request) => req.get("Idempotency-Key");
const company = (req: Request) => String((req as any).user?.companyCode || "");

const resolveActor = (req: Request) => ({
  uid: String((req as any).user?.id || (req as any).user?.uid || ""),
  name: String((req as any).user?.displayName || (req as any).user?.email || "Nhân viên"),
});

export const supplyController = {
  list: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const query = {
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        category: req.query.category ? String(req.query.category) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        expiryStatus: req.query.expiryStatus ? String(req.query.expiryStatus) : undefined,
        archived: (req.query.archived as unknown) === true || req.query.archived === "true",
        supplier: req.query.supplier ? String(req.query.supplier) : undefined,
        supplierId: req.query.supplierId ? String(req.query.supplierId) : undefined,
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
        warehouse: req.query.warehouse ? String(req.query.warehouse) : undefined,
        branchId: req.query.branchId
          ? String(req.query.branchId)
          : String((req as any).user?.branchId || "") || undefined,
      };

      const result = await supplyService.list(companyCode, query);
      return res.json({ status: "success", ...result });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  stats: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const branchId = req.query.branchId
        ? String(req.query.branchId)
        : String((req as any).user?.branchId || "") || undefined;
      const stats = await supplyService.getStats(companyCode, branchId);
      return res.json({ status: "success", data: stats });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  get: async (req: Request, res: Response) => {
    try {
      const item = await supplyService.get(company(req), req.params.id, branch(req));
      if (!item) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy vật tư." });
      }
      return res.json({ status: "success", data: item });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      const branchId = req.body.branchId || String((req as any).user?.branchId || "");
      const item = await supplyService.create(
        company(req),
        {
          ...req.body,
          branchId: branchId || undefined,
        },
        resolveActor(req),
        operationKey(req),
      );
      return res.status(201).json({ status: "success", data: item });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const item = await supplyService.update(company(req), req.params.id, req.body, resolveActor(req), branch(req));
      if (!item) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy vật tư để cập nhật." });
      }
      return res.json({ status: "success", data: item });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      const result = await supplyService.remove(company(req), req.params.id, resolveActor(req), branch(req));
      if (result.matchedCount === 0) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy vật tư hoặc không thể xóa." });
      }
      return res.json({ status: "success", message: "Đã ngừng sử dụng vật tư. Lịch sử nhập/xuất được giữ nguyên." });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  stockIn: async (req: Request, res: Response) => {
    try {
      const actor = resolveActor(req);
      const result = await supplyService.stockIn(
        company(req),
        req.params.id,
        actor,
        req.body,
        branch(req),
        operationKey(req),
      );
      return res.json({ status: "success", message: "Nhập thêm hàng vào kho thành công.", ...result });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  stockOut: async (req: Request, res: Response) => {
    try {
      const actor = resolveActor(req);
      const result = await supplyService.stockOut(
        company(req),
        req.params.id,
        actor,
        req.body,
        branch(req),
        operationKey(req),
      );
      return res.json({ status: "success", message: "Xuất dùng vật tư thành công.", ...result });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  batchStock: async (req: Request, res: Response) => {
    try {
      const actor = resolveActor(req);
      const result = await supplyService.batchStockTransaction(
        company(req),
        actor,
        req.body,
        branch(req),
        operationKey(req),
      );
      return res.status(201).json({
        status: "success",
        message:
          req.body.type === "in"
            ? `Nhập kho theo lô (${result.batchCode}) thành công.`
            : `Xuất kho theo lô (${result.batchCode}) thành công.`,
        data: result,
      });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  createVoucherDraft: async (req: Request, res: Response) => {
    try {
      const data = await createVoucherDraft(company(req), resolveActor(req), req.body, branch(req));
      return res.status(201).json({ status: "success", message: "Đã lưu phiếu nháp.", data });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  updateVoucherDraft: async (req: Request, res: Response) => {
    try {
      const data = await updateVoucherDraft(company(req), req.params.id, req.body, branch(req));
      return res.json({ status: "success", message: "Đã cập nhật phiếu nháp.", data });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  completeVoucherDraft: async (req: Request, res: Response) => {
    try {
      const data = await completeVoucherDraft(company(req), req.params.id, resolveActor(req), branch(req));
      return res.json({ status: "success", message: "Phiếu đã hoàn tất và bị khóa chỉnh sửa.", data });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  transactions: async (req: Request, res: Response) => {
    try {
      const list = await supplyService.listTransactions(company(req), req.params.id, 50, branch(req));
      return res.json({ status: "success", data: list });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  restore: async (req: Request, res: Response) => {
    try {
      const result = await supplyService.restore(company(req), req.params.id, resolveActor(req), branch(req));
      if (!result.matchedCount) return res.status(404).json({ status: "error", message: "Không tìm thấy vật tư." });
      return res.json({ status: "success", message: "Đã khôi phục vật tư." });
    } catch (err) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },
  uploadFiles: async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
      if (!files || files.length === 0) {
        return res.status(400).json({ status: "error", message: "Không có tệp nào được tải lên." });
      }

      const uploadedList = files.map((f) => ({
        name: Buffer.from(f.originalname, "latin1").toString("utf8"), // Chuẩn hóa UTF-8 tên tiếng Việt
        fileUrl: `/uploads/supplies/${f.filename}`,
        fileType: f.mimetype,
        fileSize: f.size,
        uploadedAt: new Date(),
      }));

      return res.status(201).json({
        status: "success",
        message: `Đã tải lên ${uploadedList.length} tệp thành công.`,
        data: uploadedList,
      });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  exportExcel: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const query = {
        archived: req.query.archived === "true",
        search: req.query.search ? String(req.query.search) : undefined,
        category: req.query.category ? String(req.query.category) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        expiryStatus: req.query.expiryStatus ? String(req.query.expiryStatus) : undefined,
        supplier: req.query.supplier ? String(req.query.supplier) : undefined,
        supplierId: req.query.supplierId ? String(req.query.supplierId) : undefined,
        warehouseId: req.query.warehouseId ? String(req.query.warehouseId) : undefined,
        warehouse: req.query.warehouse ? String(req.query.warehouse) : undefined,
        branchId: req.query.branchId
          ? String(req.query.branchId)
          : String((req as any).user?.branchId || "") || undefined,
      };

      const items = await supplyService.listAllForExport(companyCode, query);

      const statusMap: Record<string, string> = {
        "in-stock": "Còn hàng",
        "low-stock": "Sắp hết hàng",
        "out-of-stock": "Hết hàng",
        expired: "Đã hết hạn",
        quarantined: "Chưa xác minh hạn dùng",
      };

      const rows = items.map((item: any) => ({
        "Tên vật tư": item.name,
        "Mã vật tư": item.code,
        "Danh mục": item.category,
        "Đơn vị tính": item.unit,
        "Số lượng tồn": item.quantity,
        "Tồn tối thiểu": item.minQuantity,
        "Hạn sử dụng": item.expiryDate ? new Date(item.expiryDate).toISOString().split("T")[0] : "",
        "Ngày sản xuất": item.manufactureDate ? new Date(item.manufactureDate).toISOString().split("T")[0] : "",
        "Số lô": item.batchNumber || "",
        "Vị trí kho": item.warehouseLocation || "",
        "Nhà cung cấp": item.supplier || "",
        "Ngày kiểm định": item.inspectionDate ? new Date(item.inspectionDate).toISOString().split("T")[0] : "",
        "Hạn kiểm định tiếp theo": item.nextInspectionDate
          ? new Date(item.nextInspectionDate).toISOString().split("T")[0]
          : "",
        "Số phiếu kiểm định": item.inspectionCertificateNumber || "",
        "Đơn giá": item.unitPrice || 0,
        "Trạng thái": statusMap[item.status] || item.status,
        "Số tài liệu đính kèm": (item.documents || []).length,
        "Ghi chú": item.notes || "",
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Danh sách vật tư");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=danh_sach_vat_tu_tieu_hao.xlsx");
      return res.send(buffer);
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  allTransactions: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const branchId = req.query.branchId
        ? String(req.query.branchId)
        : String((req as any).user?.branchId || "") || undefined;
      const query = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        type: req.query.type ? String(req.query.type) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        supplyId: req.query.supplyId ? String(req.query.supplyId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        branchId,
      };

      const result = await supplyService.listAllTransactions(companyCode, query);
      return res.json({ status: "success", ...result });
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },

  exportTransactionsExcel: async (req: Request, res: Response) => {
    try {
      const companyCode = company(req);
      const branchId = req.query.branchId
        ? String(req.query.branchId)
        : String((req as any).user?.branchId || "") || undefined;
      const query = {
        type: req.query.type ? String(req.query.type) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        supplyId: req.query.supplyId ? String(req.query.supplyId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        branchId,
      };

      const items = await supplyService.listAllTransactionsForExport(companyCode, query);

      const rows = items.map((t: any) => ({
        "Thời gian": t.createdAt ? new Date(t.createdAt).toLocaleString("vi-VN") : "",
        "Loại giao dịch": t.type === "in" ? "Nhập kho" : "Xuất dùng",
        "Tên vật tư": t.supplyName,
        "Mã vật tư": t.supplyCode,
        "Số lượng thay đổi": t.type === "in" ? `+${t.quantity}` : `-${t.quantity}`,
        "Tồn trước": t.balanceBefore,
        "Tồn sau": t.balanceAfter,
        "Số lô": t.batchNumber || "",
        "Hạn sử dụng": t.expiryDate ? new Date(t.expiryDate).toLocaleDateString("vi-VN") : "",
        "Người thực hiện": t.performerName || "",
        "Khoa / Phòng nhận": t.recipientDepartment || "",
        "Lý do / Ghi chú": t.reason || "",
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Lịch sử nhập xuất");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=lich_su_nhap_xuat_vat_tu.xlsx");
      return res.send(buffer);
    } catch (err: any) {
      const failure = supplyErrorResponse(err);
      return res.status(failure.statusCode).json({ status: "error", code: failure.code, message: failure.message });
    }
  },
};
