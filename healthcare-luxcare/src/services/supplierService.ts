import { getAccessToken } from "./authService";
import type { SupplierRecord, SupplierInput } from "../types/supplier";

function getHeaders(isJson = true): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
}

export const supplierService = {
  async list(query?: { search?: string; activeOnly?: boolean }): Promise<SupplierRecord[]> {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.activeOnly !== undefined) params.set("activeOnly", String(query.activeOnly));

    const res = await fetch(`/api/v1/suppliers?${params.toString()}`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách nhà cung cấp.");
    return json.data || [];
  },

  async get(id: string): Promise<SupplierRecord> {
    const res = await fetch(`/api/v1/suppliers/${id}`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thông tin nhà cung cấp.");
    return json.data;
  },

  async create(data: SupplierInput): Promise<SupplierRecord> {
    const res = await fetch("/api/v1/suppliers", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo nhà cung cấp.");
    return json.data;
  },

  async update(id: string, data: Partial<SupplierInput>): Promise<SupplierRecord> {
    const res = await fetch(`/api/v1/suppliers/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật nhà cung cấp.");
    return json.data;
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/v1/suppliers/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa nhà cung cấp.");
  },
};
