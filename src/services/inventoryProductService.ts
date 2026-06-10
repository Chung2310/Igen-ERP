import { getAccessToken } from "./authService";
import { ProductItem } from "../types";

const COLLECTION_NAME = "inventoryProducts";

type ProductInput = {
  sku: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  imageFile?: File | null;
  imageUrl?: string;
};

type ProductMutationResult = {
  imageUploadFailed: boolean;
  imageUploadError?: string;
  productId?: string;
};

async function uploadProductImage(file: File, sku: string): Promise<{ url: string | null; error?: string }> {
  try {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

    const response = await fetch('/api/v1/media/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        file: base64Data,
        folder: 'igen_erp/products',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Lỗi tải lên Cloudinary: ${response.statusText}`);
    }

    const data = await response.json();
    return { url: data.url };
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const inventoryProductService = {
  subscribe(callback: (products: ProductItem[]) => void, onError?: (error: unknown) => void) {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/v1/crud/products?sort=name", {
          headers: {
            "Authorization": `Bearer ${getAccessToken()}`,
          },
        });
        if (!res.ok) {
          throw new Error("Không thể tải danh sách sản phẩm.");
        }
        const json = await res.json();
        const products = (json.data || []).map((item: any) => ({
          ...item,
          id: item._id,
        }));
        callback(products);
      } catch (err) {
        if (onError) {
          onError(err);
        } else {
          console.error("Lỗi khi tải danh sách sản phẩm:", err);
        }
      }
    };

    fetchProducts();
    const interval = setInterval(fetchProducts, 5000);
    return () => clearInterval(interval);
  },

  async ensureSkuAvailable(sku: string, ignoreId?: string) {
    try {
      const res = await fetch(`/api/v1/crud/products?filters[sku]=${encodeURIComponent(sku)}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể kiểm tra SKU.");
      }
      const json = await res.json();
      const items = json.data || [];
      return !items.some((item: any) => item._id !== ignoreId);
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  async createProduct(input: ProductInput): Promise<ProductMutationResult> {
    try {
      const uploadResult = input.imageFile ? await uploadProductImage(input.imageFile, input.sku) : { url: null };
      const uploadedImageUrl = uploadResult.url;
      const imageUploadFailed = Boolean(input.imageFile) && !uploadedImageUrl;

      const res = await fetch("/api/v1/crud/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          sku: input.sku,
          name: input.name,
          category: input.category,
          stock: input.stock,
          minStockAlert: 15,
          price: input.price,
          demandForecast: "Ổn định",
          imageUrl: uploadedImageUrl || input.imageUrl || "",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Tạo sản phẩm thất bại.");
      }

      const json = await res.json();
      return { imageUploadFailed, imageUploadError: uploadResult.error, productId: json.data._id };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updateProduct(id: string, input: ProductInput): Promise<ProductMutationResult> {
    try {
      const uploadResult = input.imageFile ? await uploadProductImage(input.imageFile, input.sku) : { url: input.imageUrl || null };
      const uploadedImageUrl = uploadResult.url;
      const imageUploadFailed = Boolean(input.imageFile) && !uploadedImageUrl;

      const res = await fetch(`/api/v1/crud/products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({
          sku: input.sku,
          name: input.name,
          category: input.category,
          stock: input.stock,
          price: input.price,
          imageUrl: uploadedImageUrl || input.imageUrl || "",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Cập nhật sản phẩm thất bại.");
      }

      return { imageUploadFailed, imageUploadError: uploadResult.error };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updateProductsCategoryName(previousCategoryName: string, nextCategoryName: string) {
    try {
      const res = await fetch(`/api/v1/crud/products?filters[category]=${encodeURIComponent(previousCategoryName)}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách sản phẩm để cập nhật danh mục.");
      }
      const json = await res.json();
      const items = json.data || [];

      await Promise.all(
        items.map((item: any) =>
          fetch(`/api/v1/crud/products/${item._id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${getAccessToken()}`,
            },
            body: JSON.stringify({ category: nextCategoryName }),
          })
        )
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async moveProductsToUncategorized(categoryName: string) {
    try {
      const res = await fetch(`/api/v1/crud/products?filters[category]=${encodeURIComponent(categoryName)}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể tải danh sách sản phẩm để chuyển danh mục.");
      }
      const json = await res.json();
      const items = json.data || [];

      await Promise.all(
        items.map((item: any) =>
          fetch(`/api/v1/crud/products/${item._id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${getAccessToken()}`,
            },
            body: JSON.stringify({ category: "Chưa phân loại" }),
          })
        )
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async updateProductStock(id: string, stock: number) {
    try {
      const res = await fetch(`/api/v1/crud/products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ stock }),
      });
      if (!res.ok) {
        throw new Error("Không thể cập nhật số lượng tồn kho sản phẩm.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  async deleteProduct(id: string) {
    try {
      const res = await fetch(`/api/v1/crud/products/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không thể xóa sản phẩm.");
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};

