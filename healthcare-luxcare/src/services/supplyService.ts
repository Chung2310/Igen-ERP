import { getAccessToken } from "./authService";
import type {
  SupplyItem,
  SupplyStats,
  SupplyTransaction,
  AllTransactionsResponse,
  BatchStockPayload,
  BatchStockResponse,
  SupplyTransactionDocument,
} from "../types/supply";

function getHeaders(branchId?: string, isJson = true): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (branchId) headers["X-Branch-Id"] = branchId;
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
}

export const supplyService = {
  async list(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      status?: string;
      expiryStatus?: string;
      supplier?: string;
      supplierId?: string;
      warehouseId?: string;
      warehouse?: string;
      archived?: boolean;
    },
    branchId?: string,
  ): Promise<{ data: SupplyItem[]; total: number; page: number; limit: number }> {
    const query = new URLSearchParams();
    if (params.archived) query.set("archived", "true");
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.status) query.set("status", params.status);
    if (params.expiryStatus) query.set("expiryStatus", params.expiryStatus);
    if (params.supplier) query.set("supplier", params.supplier);
    if (params.supplierId) query.set("supplierId", params.supplierId);
    if (params.warehouseId) query.set("warehouseId", params.warehouseId);
    if (params.warehouse) query.set("warehouse", params.warehouse);

    const res = await fetch(`/api/v1/supplies?${query.toString()}`, {
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách vật tư.");
    return json;
  },

  async getStats(branchId?: string): Promise<SupplyStats> {
    const res = await fetch("/api/v1/supplies/stats", {
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thống kê vật tư.");
    return json.data;
  },

  async get(id: string, branchId?: string): Promise<SupplyItem> {
    const res = await fetch(`/api/v1/supplies/${id}`, {
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thông tin vật tư.");
    return json.data;
  },

  async create(data: Partial<SupplyItem>, branchId?: string, operationKey?: string): Promise<SupplyItem> {
    const res = await fetch("/api/v1/supplies", {
      method: "POST",
      headers: { ...getHeaders(branchId), ...(operationKey ? { "Idempotency-Key": operationKey } : {}) },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo vật tư mới.");
    return json.data;
  },

  async update(id: string, data: Partial<SupplyItem>, branchId?: string): Promise<SupplyItem> {
    const res = await fetch(`/api/v1/supplies/${id}`, {
      method: "PATCH",
      headers: getHeaders(branchId),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật vật tư.");
    return json.data;
  },

  async restore(id: string, branchId?: string): Promise<void> {
    const res = await fetch(`/api/v1/supplies/${id}/restore`, { method: "POST", headers: getHeaders(branchId) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể khôi phục vật tư.");
  },
  async delete(id: string, branchId?: string): Promise<void> {
    const res = await fetch(`/api/v1/supplies/${id}`, {
      method: "DELETE",
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa vật tư.");
  },

  async stockIn(
    id: string,
    data: { quantity: number; batchNumber?: string; expiryDate?: string; reason?: string },
    branchId?: string,
  ): Promise<{ supply: SupplyItem; transaction: SupplyTransaction }> {
    const res = await fetch(`/api/v1/supplies/${id}/stock-in`, {
      method: "POST",
      headers: getHeaders(branchId),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể nhập kho.");
    return json;
  },

  async stockOut(
    id: string,
    data: { quantity: number; recipientDepartment: string; reason: string },
    branchId?: string,
  ): Promise<{ supply: SupplyItem; transaction: SupplyTransaction }> {
    const res = await fetch(`/api/v1/supplies/${id}/stock-out`, {
      method: "POST",
      headers: getHeaders(branchId),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xuất kho.");
    return json;
  },

  async batchStock(
    payload: BatchStockPayload,
    branchId?: string,
    operationKey?: string,
  ): Promise<BatchStockResponse["data"]> {
    const res = await fetch("/api/v1/supplies/transactions/batch", {
      method: "POST",
      headers: { ...getHeaders(branchId), ...(operationKey ? { "Idempotency-Key": operationKey } : {}) },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể thực hiện giao dịch theo lô.");
    return json.data;
  },

  async createVoucherDraft(payload: BatchStockPayload, branchId?: string): Promise<SupplyTransactionDocument> {
    const res = await fetch("/api/v1/supplies/transactions/drafts", {
      method: "POST",
      headers: getHeaders(branchId),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể lưu phiếu nháp.");
    return json.data;
  },

  async updateVoucherDraft(id: string, payload: BatchStockPayload, branchId?: string): Promise<SupplyTransactionDocument> {
    const res = await fetch(`/api/v1/supplies/transactions/drafts/${id}`, {
      method: "PATCH",
      headers: getHeaders(branchId),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật phiếu nháp.");
    return json.data;
  },

  async completeVoucherDraft(id: string, branchId?: string): Promise<BatchStockResponse["data"]> {
    const res = await fetch(`/api/v1/supplies/transactions/drafts/${id}/complete`, {
      method: "POST",
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể hoàn tất phiếu.");
    return json.data;
  },

  async getTransactions(id: string, branchId?: string): Promise<SupplyTransaction[]> {
    const res = await fetch(`/api/v1/supplies/${id}/transactions`, {
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải lịch sử giao dịch.");
    return json.data || [];
  },

  async uploadFiles(
    files: File[],
    branchId?: string,
  ): Promise<Array<{ name: string; fileUrl: string; fileType: string; fileSize: number }>> {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    const res = await fetch("/api/v1/supplies/upload-files", {
      method: "POST",
      headers: getHeaders(branchId, false), // multipart/form-data browser tự set boundary
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Tải lên tệp thất bại.");
    return json.data || [];
  },

  async exportExcel(
    params: {
      search?: string;
      category?: string;
      status?: string;
      expiryStatus?: string;
      supplier?: string;
      supplierId?: string;
      warehouseId?: string;
      warehouse?: string;
      archived?: boolean;
    },
    branchId?: string,
  ): Promise<void> {
    const query = new URLSearchParams();
    if (params.archived) query.set("archived", "true");
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.status) query.set("status", params.status);
    if (params.expiryStatus) query.set("expiryStatus", params.expiryStatus);
    if (params.supplier) query.set("supplier", params.supplier);
    if (params.supplierId) query.set("supplierId", params.supplierId);
    if (params.warehouseId) query.set("warehouseId", params.warehouseId);
    if (params.warehouse) query.set("warehouse", params.warehouse);

    const res = await fetch(`/api/v1/supplies/export?${query.toString()}`, {
      headers: getHeaders(branchId, false),
    });
    if (!res.ok) throw new Error("Xuất dữ liệu Excel thất bại.");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `danh-sach-vat-tu-tieu-hao-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async getAllTransactions(
    params: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      search?: string;
      supplyId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
    branchId?: string,
  ): Promise<AllTransactionsResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.type) query.set("type", params.type);
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    if (params.supplyId) query.set("supplyId", params.supplyId);
    if (params.startDate) query.set("startDate", params.startDate);
    if (params.endDate) query.set("endDate", params.endDate);

    const res = await fetch(`/api/v1/supplies/transactions/all?${query.toString()}`, {
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách giao dịch nhập xuất.");
    return json;
  },

  async exportTransactionsExcel(
    params: {
      type?: string;
      search?: string;
      supplyId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
    branchId?: string,
  ): Promise<void> {
    const query = new URLSearchParams();
    if (params.type) query.set("type", params.type);
    if (params.search) query.set("search", params.search);
    if (params.supplyId) query.set("supplyId", params.supplyId);
    if (params.startDate) query.set("startDate", params.startDate);
    if (params.endDate) query.set("endDate", params.endDate);

    const res = await fetch(`/api/v1/supplies/transactions/export?${query.toString()}`, {
      headers: getHeaders(branchId, false),
    });
    if (!res.ok) throw new Error("Xuất dữ liệu Excel lịch sử giao dịch thất bại.");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lich-su-nhap-xuat-kho-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
