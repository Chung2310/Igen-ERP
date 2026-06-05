import React from "react";
import { Package } from "lucide-react";
import { ProductCategory } from "../../types";

type ProductModalProps = {
  categories: ProductCategory[];
  newProdCategory: string;
  newProdName: string;
  newProdPrice: string;
  newProdSKU: string;
  newProdStock: string;
  onClose: () => void;
  onCreateCategory: () => void;
  onSubmit: (event: React.FormEvent) => void;
  setNewProdCategory: (value: string) => void;
  setNewProdName: (value: string) => void;
  setNewProdPrice: (value: string) => void;
  setNewProdSKU: (value: string) => void;
  setNewProdStock: (value: string) => void;
};

export function ProductModal({
  categories,
  newProdCategory,
  newProdName,
  newProdPrice,
  newProdSKU,
  newProdStock,
  onClose,
  onCreateCategory,
  onSubmit,
  setNewProdCategory,
  setNewProdName,
  setNewProdPrice,
  setNewProdSKU,
  setNewProdStock,
}: ProductModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn" id="add_product_modal_backdrop">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-gray-200/50 bg-white font-sans shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-6">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-gray-800">
              <Package className="h-5 w-5 text-blue-500" />
              Khai báo sản phẩm mới lên ERP
            </h4>
            <p className="mt-1 text-xs text-gray-400">Lưu trữ sản phẩm đồng bộ lên dữ liệu iGen Core</p>
          </div>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm font-bold text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-650">×</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-6 text-left text-xs">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mã SKU *">
              <input type="text" required placeholder="Ví dụ: LAP-LENOVO-01" className="w-full rounded-lg border border-gray-200 p-2.5 font-mono text-xs font-bold focus:ring-2 focus:ring-blue-500" value={newProdSKU} onChange={(event) => setNewProdSKU(event.target.value)} />
            </Field>
            <Field label="Tên sản phẩm *">
              <input type="text" required placeholder="Ví dụ: Laptop Dell Precision" className="w-full rounded-lg border border-gray-200 p-2.5 text-xs focus:ring-2 focus:ring-blue-500" value={newProdName} onChange={(event) => setNewProdName(event.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phân loại sản phẩm">
              <select className="w-full rounded-lg border border-gray-200 p-2.5 text-xs" value={newProdCategory} onChange={(event) => setNewProdCategory(event.target.value)}>
                {categories.filter((category) => category.status === "Đang dùng").map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
              <button type="button" onClick={onCreateCategory} className="mt-2 text-[10px] font-bold text-blue-700 hover:text-blue-800">+ Tạo phân loại mới</button>
            </Field>
            <Field label="Tồn kho khởi tạo">
              <input type="number" placeholder="Số lượng ban đầu" className="w-full rounded-lg border border-gray-200 p-2.5 font-mono text-xs" value={newProdStock} onChange={(event) => setNewProdStock(event.target.value)} />
            </Field>
          </div>
          <Field label="Đơn giá bán định mức (VNĐ) *">
            <input type="number" required placeholder="Giá bán niêm yết" className="w-full rounded-lg border border-gray-200 p-2.5 font-mono text-xs" value={newProdPrice} onChange={(event) => setNewProdPrice(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border bg-gray-150 px-4 py-2 font-bold">Bỏ qua</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white transition-colors hover:bg-blue-700">Xác nhận thêm</button>
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
