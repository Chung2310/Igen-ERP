import { getAccessToken } from "./authService";
import type { CategoryRecord, CategoryInput } from "../types/category";

function getHeaders(isJson = true): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
}

export const categoryService = {
  async list(query?: { search?: string; activeOnly?: boolean }): Promise<CategoryRecord[]> {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.activeOnly !== undefined) params.set("activeOnly", String(query.activeOnly));

    const res = await fetch(`/api/v1/categories?${params.toString()}`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách phân loại sản phẩm.");
    return json.data || [];
  },

  async get(id: string): Promise<CategoryRecord> {
    const res = await fetch(`/api/v1/categories/${id}`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thông tin phân loại sản phẩm.");
    return json.data;
  },

  async create(data: CategoryInput): Promise<CategoryRecord> {
    const res = await fetch("/api/v1/categories", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo phân loại sản phẩm.");
    return json.data;
  },

  async update(id: string, data: Partial<CategoryInput>): Promise<CategoryRecord> {
    const res = await fetch(`/api/v1/categories/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật phân loại sản phẩm.");
    return json.data;
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/v1/categories/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa phân loại sản phẩm.");
  },
};
