import React from "react";
import { Tags } from "lucide-react";

type CategoryModalProps = {
  editingCategoryId: string | null;
  newCategoryCode: string;
  newCategoryDescription: string;
  newCategoryName: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  setNewCategoryCode: (value: string) => void;
  setNewCategoryDescription: (value: string) => void;
  setNewCategoryName: (value: string) => void;
};

export function CategoryModal({
  editingCategoryId,
  newCategoryCode,
  newCategoryDescription,
  newCategoryName,
  onClose,
  onSubmit,
  setNewCategoryCode,
  setNewCategoryDescription,
  setNewCategoryName,
}: CategoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fadeIn" id="add_category_modal_backdrop">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-gray-200/50 bg-white font-sans shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-6">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-gray-800">
              <Tags className="h-5 w-5 text-blue-500" />
              {editingCategoryId ? "Sửa phân loại sản phẩm" : "Tạo phân loại sản phẩm"}
            </h4>
            <p className="mt-1 text-xs text-gray-400">
              {editingCategoryId ? "Cập nhật thông tin phân loại đang dùng trong danh mục kho." : "Phân loại mới sẽ dùng được ngay khi khai báo sản phẩm trong danh mục."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md px-3 py-1 text-sm font-bold text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-650">×</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-6 text-left text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Tên phân loại *</label>
              <input type="text" required placeholder="Ví dụ: Thiết bị mạng" className="w-full rounded-lg border border-gray-200 p-2.5 text-xs focus:ring-2 focus:ring-blue-500" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Mã loại *</label>
              <input type="text" required placeholder="NET" className="w-full rounded-lg border border-gray-200 p-2.5 font-mono text-xs font-bold uppercase focus:ring-2 focus:ring-blue-500" value={newCategoryCode} onChange={(event) => setNewCategoryCode(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Mô tả ngắn</label>
            <textarea rows={3} placeholder="Ghi chú ngắn để nhân sự kho dễ chọn đúng loại sản phẩm." className="w-full resize-none rounded-lg border border-gray-200 p-2.5 text-xs leading-5 focus:ring-2 focus:ring-blue-500" value={newCategoryDescription} onChange={(event) => setNewCategoryDescription(event.target.value)} />
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border bg-gray-150 px-4 py-2 font-bold">Bỏ qua</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white transition-colors hover:bg-blue-700">{editingCategoryId ? "Cập nhật phân loại" : "Tạo phân loại"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
