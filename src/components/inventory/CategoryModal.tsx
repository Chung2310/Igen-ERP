import React from "react";
import { Tags, X } from "lucide-react";

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
  const inputClassName = "w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none placeholder:text-slate-400/70 placeholder:font-normal";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in" id="add_category_modal_backdrop">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-100 bg-white font-sans shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
          <div>
            <h4 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Tags className="h-5 w-5 text-blue-600" />
              {editingCategoryId ? "Sửa phân loại sản phẩm" : "Tạo phân loại sản phẩm"}
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {editingCategoryId ? "Cập nhật thông tin phân loại đang dùng trong danh mục kho." : "Phân loại mới sẽ dùng được ngay khi khai báo sản phẩm trong danh mục."}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-650"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-6 text-left text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Tên phân loại *</label>
              <input 
                type="text" 
                required 
                placeholder="Nhập tên phân loại" 
                className={inputClassName} 
                value={newCategoryName} 
                onChange={(event) => setNewCategoryName(event.target.value)} 
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Mã loại *</label>
              <input 
                type="text" 
                required 
                placeholder="Mã loại" 
                className={inputClassName} 
                value={newCategoryCode} 
                onChange={(event) => setNewCategoryCode(event.target.value)} 
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Mô tả ngắn</label>
            <textarea 
              rows={3} 
              placeholder="Nhập mô tả ngắn..." 
              className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm leading-5 transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none placeholder:text-slate-400/70 placeholder:font-normal" 
              value={newCategoryDescription} 
              onChange={(event) => setNewCategoryDescription(event.target.value)} 
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Bỏ qua
            </button>
            <button 
              type="submit" 
              className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/15"
            >
              {editingCategoryId ? "Cập nhật phân loại" : "Tạo phân loại"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
