import { getAccessToken } from "./authService";
import { ProductCategory } from "../types";

const COLLECTION_NAME = "inventoryProductCategories";

type CategoryInput = {
  name: string;
  code: string;
  description: string;
};

export const inventoryCategoryService = {
  subscribe(callback: (categories: ProductCategory[]) => void, onError?: (error: unknown) => void) {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/v1/crud/categories?sort=name", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
          },
        });
        if (!res.ok) {
          throw new Error("Không thể tải danh sách danh mục.");
        }
        const json = await res.json();
        const categories = (json.data || []).map((item: any) => ({
          ...item,
          id: item._id,
        }));
        callback(categories);
      } catch (err) {
        if (onError) {
          onError(err);
        } else {
          console.error("Lỗi khi tải danh sách danh mục:", err);
        }
      }
    };

    fetchCategories();
    const interval = setInterval(fetchCategories, 5000);
    return () => clearInterval(interval);
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
