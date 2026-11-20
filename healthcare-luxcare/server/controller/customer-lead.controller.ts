import { Request, Response } from "express";
import * as service from "../service/customer-lead.service";
import { AuthenticatedRequest } from "../middleware/auth";

export async function getPublicCompanyInfo(req: Request, res: Response) {
  try {
    const companyCode = String(req.query.c || req.query.companyCode || "");
    const branchCode = String(req.query.b || req.query.branchCode || "");
    if (!companyCode) {
      return res.status(400).json({ status: "error", message: "Mã doanh nghiệp là bắt buộc" });
    }
    const info = await service.getPublicCompanyInfo(companyCode, branchCode);
    return res.status(200).json({ status: "success", data: info });
  } catch (error: any) {
    return res.status(404).json({ status: "error", message: error.message || "Không tìm thấy thông tin" });
  }
}

export async function submitPublicLead(req: Request, res: Response) {
  try {
    const result = await service.submitPublicLead(req.body);
    return res.status(201).json({ status: "success", ...result });
  } catch (error: any) {
    return res.status(400).json({ status: "error", message: error.message || "Lỗi khi gửi thông tin" });
  }
}

export async function ingestExternalLead(req: Request, res: Response) {
  try {
    const fallbackCompanyCode = String(
      req.headers["x-company-code"] ||
        req.query.companyCode ||
        req.query.c ||
        "",
    );
    const apiKey = String(
      req.headers["x-api-key"] ||
        req.query.apiKey ||
        "",
    );

    // Trường hợp 1: Body là mảng trực tiếp [ {...}, {...} ]
    if (Array.isArray(req.body)) {
      const result = await service.ingestExternalLeadsBatch(req.body, {
        companyCode: fallbackCompanyCode,
        apiKey,
      });
      return res.status(201).json({ status: "success", ...result });
    }

    // Trường hợp 2: Body là Object chứa danh sách leads / customers / items / data
    const listItems =
      req.body.leads ||
      req.body.customers ||
      req.body.items ||
      (Array.isArray(req.body.data) ? req.body.data : null);

    if (Array.isArray(listItems)) {
      const result = await service.ingestExternalLeadsBatch(listItems, {
        companyCode: req.body.companyCode || fallbackCompanyCode,
        source: req.body.source,
        branchCode: req.body.branchCode,
        branchId: req.body.branchId,
        campaign: req.body.campaign || req.body.qrCampaign,
        apiKey: req.body.apiKey || apiKey,
      });
      return res.status(201).json({ status: "success", ...result });
    }

    // Trường hợp 3: Khách hàng đơn lẻ
    const payload = {
      ...req.body,
      companyCode: req.body.companyCode || fallbackCompanyCode,
      apiKey: req.body.apiKey || apiKey,
    };
    const result = await service.ingestExternalLead(payload);
    return res.status(201).json({ status: "success", ...result });
  } catch (error: any) {
    return res.status(400).json({
      status: "error",
      message: error.message || "Lỗi khi tiếp nhận thông tin từ ứng dụng ngoài",
    });
  }
}

export async function listLeads(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode;
    if (!companyCode) {
      return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp" });
    }

    const { branchId, status, search, source, fromDate, toDate, page, limit } = req.query;

    const effectiveBranchId =
      req.user?.role === "branch_owner" && req.user?.branchId
        ? req.user.branchId
        : branchId ? String(branchId) : undefined;

    const result = await service.listLeads({
      companyCode,
      branchId: effectiveBranchId,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      source: source ? String(source) : undefined,
      fromDate: fromDate ? String(fromDate) : undefined,
      toDate: toDate ? String(toDate) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.status(200).json({ status: "success", ...result });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message || "Lỗi khi lấy danh sách khách hàng" });
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode;
    if (!companyCode) {
      return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp" });
    }

    const branchId =
      req.user?.role === "branch_owner" && req.user?.branchId
        ? req.user.branchId
        : req.query.branchId ? String(req.query.branchId) : undefined;

    const stats = await service.getLeadStats(companyCode, branchId);
    return res.status(200).json({ status: "success", data: stats });
  } catch (error: any) {
    return res.status(500).json({ status: "error", message: error.message || "Lỗi khi lấy thống kê" });
  }
}

export async function getLead(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode;
    if (!companyCode) {
      return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp" });
    }

    const lead = await service.getLeadById(req.params.id, companyCode);
    return res.status(200).json({ status: "success", data: lead });
  } catch (error: any) {
    return res.status(404).json({ status: "error", message: error.message || "Không tìm thấy khách hàng" });
  }
}

export async function createLead(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode;
    const uid = req.user?.id || (req.user as any)?.uid;
    if (!companyCode || !uid) {
      return res.status(403).json({ status: "error", message: "Không đủ quyền thực hiện" });
    }

    const lead = await service.createManualLead(req.body, {
      companyCode,
      uid,
      branchId: req.user?.branchId,
    });

    return res.status(201).json({ status: "success", data: lead });
  } catch (error: any) {
    return res.status(400).json({ status: "error", message: error.message || "Lỗi khi tạo khách hàng" });
  }
}

export async function updateLead(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode;
    const uid = req.user?.id || (req.user as any)?.uid;
    if (!companyCode || !uid) {
      return res.status(403).json({ status: "error", message: "Không đủ quyền thực hiện" });
    }

    const lead = await service.updateLead(req.params.id, req.body, {
      companyCode,
      uid,
    });

    return res.status(200).json({ status: "success", data: lead });
  } catch (error: any) {
    return res.status(400).json({ status: "error", message: error.message || "Lỗi khi cập nhật khách hàng" });
  }
}

export async function deleteLead(req: AuthenticatedRequest, res: Response) {
  try {
    const companyCode = req.user?.companyCode;
    const uid = req.user?.id || (req.user as any)?.uid;
    if (!companyCode || !uid) {
      return res.status(403).json({ status: "error", message: "Không đủ quyền thực hiện" });
    }

    const result = await service.deleteLead(req.params.id, {
      companyCode,
      uid,
    });

    return res.status(200).json({ status: "success", ...result });
  } catch (error: any) {
    return res.status(400).json({ status: "error", message: error.message || "Lỗi khi xóa khách hàng" });
  }
}
