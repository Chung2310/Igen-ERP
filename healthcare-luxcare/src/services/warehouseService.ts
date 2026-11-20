import { getAccessToken } from "./authService";
import type { WarehouseRecord, WarehouseInput } from "../types/warehouse";

function getHeaders(branchId?: string, isJson = true): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (branchId) headers["X-Branch-Id"] = branchId;
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
}

export const warehouseService = {
  async list(query?: { branchId?: string; search?: string; activeOnly?: boolean }): Promise<WarehouseRecord[]> {
    const params = new URLSearchParams();
    if (query?.branchId) params.set("branchId", query.branchId);
    if (query?.search) params.set("search", query.search);
    if (query?.activeOnly !== undefined) params.set("activeOnly", String(query.activeOnly));

    const res = await fetch(`/api/v1/warehouses?${params.toString()}`, {
      headers: getHeaders(query?.branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách kho lưu trữ.");
    return json.data || [];
  },

  async get(id: string, branchId?: string): Promise<WarehouseRecord> {
    const res = await fetch(`/api/v1/warehouses/${id}`, {
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thông tin kho lưu trữ.");
    return json.data;
  },

  async create(data: WarehouseInput, branchId?: string): Promise<WarehouseRecord> {
    const res = await fetch("/api/v1/warehouses", {
      method: "POST",
      headers: getHeaders(branchId),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo kho lưu trữ.");
    return json.data;
  },

  async update(id: string, data: Partial<WarehouseInput>, branchId?: string): Promise<WarehouseRecord> {
    const res = await fetch(`/api/v1/warehouses/${id}`, {
      method: "PATCH",
      headers: getHeaders(branchId),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật kho lưu trữ.");
    return json.data;
  },

  async delete(id: string, branchId?: string): Promise<void> {
    const res = await fetch(`/api/v1/warehouses/${id}`, {
      method: "DELETE",
      headers: getHeaders(branchId),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa kho lưu trữ.");
  },
};
