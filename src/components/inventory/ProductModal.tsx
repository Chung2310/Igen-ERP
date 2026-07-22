import React from "react";
import { ImagePlus, Package, X } from "lucide-react";
import { ProductCategory } from "../../types";
import { SearchableSelect } from "./SearchableSelect";

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
  newProdBrand: string;
  newProdUnit: string;
  newProdDescription: string;
  newProdStatus: string;
  onClose: () => void;
  onCreateCategory: () => void;
  onImageChange: (file: File | null) => void;
  onSubmit: (event: React.FormEvent) => void;
  setNewProdCategory: (value: string) => void;
  setNewProdName: (value: string) => void;
  setNewProdPrice: (value: string) => void;
  setNewProdSKU: (value: string) => void;
  setNewProdStock: (value: string) => void;
  setNewProdBrand: (value: string) => void;
  setNewProdUnit: (value: string) => void;
  setNewProdDescription: (value: string) => void;
  setNewProdStatus: (value: string) => void;
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
  newProdBrand,
  newProdUnit,
  newProdDescription,
  newProdStatus,
  onClose,
  onCreateCategory,
  onImageChange,
  onSubmit,
  setNewProdCategory,
  setNewProdName,
  setNewProdPrice,
  setNewProdSKU,
  setNewProdStock,
  setNewProdBrand,
  setNewProdUnit,
  setNewProdDescription,
  setNewProdStatus,
}: ProductModalProps) {
  const activeCategories = categories.filter((category) => category.status === "Đang dùng");


  const inputClassName = "w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none placeholder:text-slate-400/70 placeholder:font-normal";

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" id="add_product_modal_backdrop">
      <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white font-sans shadow-2xl animate-scale-in">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Package className="h-5 w-5 text-blue-600" />
              {isEditing ? "Cập nhật sản phẩm" : "Khai báo sản phẩm mới"}
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {isEditing ? "Chỉnh sửa thông tin sản phẩm đang lưu trên hệ thống kho." : "Lưu sản phẩm mới lên dữ liệu kho của iGen ERP."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-650"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 overflow-y-auto p-6 text-left text-xs">
          <div className="grid gap-4 md:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Mã sản phẩm *">
                  <input
                    type="text"
                    required
                    placeholder="Nhập mã sản phẩm"
                    className={inputClassName}
                    value={newProdSKU}
                    onChange={(event) => setNewProdSKU(event.target.value)}
                  />
                </Field>
                <Field label="Tên sản phẩm *">
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên sản phẩm"
                    className={inputClassName}
                    value={newProdName}
                    onChange={(event) => setNewProdName(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Danh mục *">
                  <SearchableSelect
                    options={activeCategories.map((category) => ({ value: category.name, label: category.name }))}
                    value={newProdCategory}
                    onChange={setNewProdCategory}
                    placeholder={activeCategories.length === 0 ? "Chưa có phân loại" : "Chọn phân loại sản phẩm"}
                    searchPlaceholder="Tìm phân loại..."
                    disabled={activeCategories.length === 0}
                  />
                  <button type="button" onClick={onCreateCategory} className="mt-2 text-[10px] font-bold text-blue-700 hover:text-blue-800">
                    + Tạo phân loại mới
                  </button>
                </Field>
                <Field label="Thương hiệu">
                  <input
                    type="text"
                    placeholder="Nhập thương hiệu"
                    className={inputClassName}
                    value={newProdBrand}
                    onChange={(event) => setNewProdBrand(event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Đơn vị tính *">
                  <input
                    type="text"
                    required
                    placeholder="Nhập đơn vị tính (cái, hộp...)"
                    className={inputClassName}
                    value={newProdUnit}
                    onChange={(event) => setNewProdUnit(event.target.value)}
                  />
                </Field>
                <Field label="Trạng thái *">
                  <SearchableSelect
                    options={[
                      { value: "Active", label: "Hoạt động (Active)" },
                      { value: "Inactive", label: "Ngừng kinh doanh (Inactive)" },
                    ]}
                    value={newProdStatus}
                    onChange={setNewProdStatus}
                    placeholder="Chọn trạng thái"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Đơn giá bán định mức (VNĐ) *">
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="Nhập đơn giá bán"
                    className={inputClassName}
                    value={newProdPrice}
                    onChange={(event) => setNewProdPrice(event.target.value)}
                  />
                </Field>
                <Field label="Tồn kho hiện tại">
                  <input
                    type="number"
                    min={0}
                    placeholder="Nhập số lượng tồn kho"
                    className={inputClassName}
                    value={newProdStock}
                    onChange={(event) => setNewProdStock(event.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-col h-full">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Hình ảnh sản phẩm</label>
              <div className="flex-1 flex">
                <label className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer min-h-[290px] h-full">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Xem trước sản phẩm" className="h-44 w-full rounded-xl object-cover shadow-sm" />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <span className="rounded-2xl bg-white p-3 shadow-sm">
                        <ImagePlus className="h-6 w-6 text-blue-500" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-700">Chọn ảnh sản phẩm</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-400">PNG, JPG hoặc WEBP. Nên dùng ảnh vuông để card hiển thị đẹp hơn.</p>
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
              </div>
            </div>
          </div>

          <Field label="Mô tả sản phẩm">
            <textarea
              placeholder="Nhập mô tả chi tiết sản phẩm..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none resize-none placeholder:text-slate-400/70 placeholder:font-normal"
              value={newProdDescription}
              onChange={(event) => setNewProdDescription(event.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Bỏ qua
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
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
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}
