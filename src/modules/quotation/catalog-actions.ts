export type CatalogAction = "activate" | "deactivate" | "delete" | "restore" | "price";
export const catalogActionLabels: Record<CatalogAction, string> = { activate: "Bật áp dụng", deactivate: "Ngừng áp dụng", delete: "Xóa sản phẩm", restore: "Khôi phục", price: "Điều chỉnh giá" };
