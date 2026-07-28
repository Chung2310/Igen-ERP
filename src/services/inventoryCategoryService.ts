import { getAccessToken } from "./authService";
import { ProductCategory } from "../types";

const COLLECTION_NAME = "inventoryProductCategories";

type CategoryInput = {
  name: string;
  code: string;
  description: string;
};

export const inventoryCategoryService = {
  subscribe(branchId: string, callback: (categories: ProductCategory[]) => void, onError?: (error: unknown) => void) {
    const controller = new AbortController();
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/v1/crud/categories?sort=-_id", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
            "x-branch-id": branchId,
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Không thể tải danh sách danh mục.");
        }
        const json = await res.json();
        const categories = (json.data || []).map((item: any) => ({
          ...item,
          id: item._id,
          code: typeof item.code === "string" ? item.code : "",
          description: typeof item.description === "string" ? item.description : "",
          colorClass: typeof item.colorClass === "string" ? item.colorClass : "bg-blue-50 text-blue-700 border-blue-100",
          status: typeof item.status === "string" ? item.status : "Đang dùng",
        }));
        if (controller.signal.aborted) return;
        callback(categories);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (onError) {
          onError(err);
        } else {
          console.error("Lỗi khi tải danh sách danh mục:", err);
        }
      }
    };

    fetchCategories();
    const interval = setInterval(fetchCategories, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  },

  async createCategory(input: CategoryInput) {
    try {
      const res = await fetch("/api/v1/crud/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: input.name,
          code: input.code,
          description: input.description,
          colorClass: "bg-blue-50 text-blue-700 border-blue-100",
          status: "Đang dùng",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Tạo danh mục thất bại.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updateCategory(id: string, input: CategoryInput) {
    try {
      const res = await fetch(`/api/v1/crud/categories/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          name: input.name,
          code: input.code,
          description: input.description,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Cập nhật danh mục thất bại.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async deleteCategory(id: string) {
    try {
      const res = await fetch(`/api/v1/crud/categories/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Xóa danh mục thất bại.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
