import React from "react";
import { ImagePlus, Package } from "lucide-react";
import { ProductCategory } from "../../types";

type ProductModalProps = {
  categories: ProductCategory[];
  imagePreview: string;
  isEditing: boolean;
  isSubmitting: boolean;
  newProdCategory: string;
  newProdName: string;
  newProdPrice: string;
  newProdSKU: string;
  newProdStock: string;
  onClose: () => void;
  onCreateCategory: () => void;
  onImageChange: (file: File | null) => void;
  onSubmit: (event: React.FormEvent) => void;
  setNewProdCategory: (value: string) => void;
  setNewProdName: (value: string) => void;
  setNewProdPrice: (value: string) => void;
  setNewProdSKU: (value: string) => void;
  setNewProdStock: (value: string) => void;
};

export function ProductModal({
  categories,
  imagePreview,
  isEditing,
  isSubmitting,
  newProdCategory,
  newProdName,
  newProdPrice,
  newProdSKU,
  newProdStock,
  onClose,
  onCreateCategory,
  onImageChange,
  onSubmit,
  setNewProdCategory,
  setNewProdName,
  setNewProdPrice,
  setNewProdSKU,
  setNewProdStock,
}: ProductModalProps) {
  const activeCategories = categories.filter((category) => category.status === "Đang dùng");

  return (
    <div className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" id="add_product_modal_backdrop">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-200/50 bg-white font-sans shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-6">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-gray-800">
              <Package className="h-5 w-5 text-blue-500" />
              {isEditing ? "Cập nhật sản phẩm" : "Khai báo sản phẩm mới"}
            </h4>
            <p className="mt-1 text-xs text-gray-400">
              {isEditing ? "Chỉnh sửa thông tin sản phẩm đang lưu trên hệ thống kho." : "Lưu sản phẩm mới lên dữ liệu kho của iGen ERP."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-sm font-bold text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-650">
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-6 text-left text-xs">
          <div className="grid gap-4 md:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Mã SKU *">
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: LAP-LENOVO-01"
                    className="w-full rounded-lg border border-gray-200 p-2.5 font-mono text-xs font-bold focus:ring-2 focus:ring-blue-500"
                    value={newProdSKU}
                    onChange={(event) => setNewProdSKU(event.target.value)}
                  />
                </Field>
                <Field label="Tên sản phẩm *">
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Laptop Dell Precision"
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                    value={newProdName}
                    onChange={(event) => setNewProdName(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Phân loại sản phẩm">
                  <select
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-xs"
                    value={newProdCategory}
                    onChange={(event) => setNewProdCategory(event.target.value)}
                    disabled={activeCategories.length === 0}
                  >
                    {activeCategories.length === 0 ? (
                      <option value="">Chưa có phân loại</option>
                    ) : (
                      activeCategories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))
                    )}
                  </select>
                  <button type="button" onClick={onCreateCategory} className="mt-2 text-[10px] font-bold text-blue-700 hover:text-blue-800">
                    + Tạo phân loại mới
                  </button>
                </Field>
                <Field label="Tồn kho hiện tại">
                  <input
                    type="number"
                    min={0}
                    placeholder="Số lượng hiện có"
                    className="w-full rounded-lg border border-gray-200 p-2.5 font-mono text-xs"
                    value={newProdStock}
                    onChange={(event) => setNewProdStock(event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Đơn giá bán định mức (VNĐ) *">
                <input
                  type="number"
                  min={0}
                  required
                  placeholder="Giá bán niêm yết"
                  className="w-full rounded-lg border border-gray-200 p-2.5 font-mono text-xs"
                  value={newProdPrice}
                  onChange={(event) => setNewProdPrice(event.target.value)}
                />
              </Field>
            </div>

            <Field label="Hình ảnh sản phẩm">
              <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4 text-center transition-colors hover:border-blue-300 hover:bg-blue-50">
                {imagePreview ? (
                  <img src={imagePreview} alt="Xem trước sản phẩm" className="h-44 w-full rounded-xl object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <span className="rounded-2xl bg-white p-3 shadow-sm">
                      <ImagePlus className="h-6 w-6 text-blue-500" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-700">Chọn ảnh sản phẩm</p>
                      <p className="mt-1 text-[11px] leading-5 text-gray-400">PNG, JPG hoặc WEBP. Nên dùng ảnh vuông để card hiển thị đẹp hơn.</p>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => onImageChange(event.target.files?.[0] ?? null)}
                />
              </label>
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg border bg-gray-150 px-4 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-60">
              Bỏ qua
            </button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Đang lưu..." : isEditing ? "Lưu cập nhật" : "Tạo sản phẩm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
