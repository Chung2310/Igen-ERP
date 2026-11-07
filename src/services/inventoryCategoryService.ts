import { getAccessToken } from "./authService";
import { ProductCategory } from "../types";

type CategoryInput = {
  name: string;
  code: string;
  description: string;
};

type CategoryApiRecord = Record<string, unknown>;

export const inventoryCategoryService = {
  // Giữ chữ ký cũ cho các caller chưa cập nhật; branchId không còn được gửi hoặc dùng để lọc.
  subscribe(
    callbackOrLegacyBranchId: string | ((categories: ProductCategory[]) => void),
    callbackOrError?: ((categories: ProductCategory[]) => void) | ((error: unknown) => void),
    legacyOnError?: (error: unknown) => void,
  ) {
    const callback: (categories: ProductCategory[]) => void = typeof callbackOrLegacyBranchId === "string"
      ? callbackOrError as (categories: ProductCategory[]) => void
      : callbackOrLegacyBranchId;
    const onError: ((error: unknown) => void) | undefined = typeof callbackOrLegacyBranchId === "string"
      ? legacyOnError
      : callbackOrError as ((error: unknown) => void) | undefined;

    const controller = new AbortController();
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/v1/crud/categories?sort=-_id", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Không thể tải danh sách danh mục.");
        }
        const json = await res.json();
        const categories = (json.data || []).map((item: CategoryApiRecord) => ({
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      const res = await fetch("/api/v1/crud/categories", {
        method: "POST",
        headers,
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
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      const res = await fetch(`/api/v1/crud/categories/${id}`, {
        method: "PATCH",
        headers,
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
      const headers: Record<string, string> = {
        "Authorization": `Bearer ${getAccessToken()}`,
      };
      const res = await fetch(`/api/v1/crud/categories/${id}`, {
        method: "DELETE",
        headers,
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
