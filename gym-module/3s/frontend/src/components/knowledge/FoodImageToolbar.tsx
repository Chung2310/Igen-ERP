import React from 'react';
import { Search, UploadCloud, Sparkles } from 'lucide-react';

export const FOOD_CATEGORIES = [
  { val:'ALL', label:'Tất cả nhóm', icon:'' },
  { val:'PROTEIN', label:'Đạm (Protein)', icon:'' },
  { val:'CARB', label:'Tinh bột (Carb)', icon:'' },
  { val:'FAT', label:'Chất béo tốt', icon:'' },
  { val:'VEGGIE', label:'Rau củ / Salad', icon:'' },
  { val:'MEAL', label:'Bữa chính', icon:'' },
  { val:'SNACK', label:'Bữa phụ', icon:'' },
  { val:'DRINK', label:'Sinh tố / Nước', icon:'' },
] as const;

export const FOOD_SOURCES = [
  { val: 'ALL', label: 'Tất cả nguồn' },
  { val: 'AI', label: 'AI tạo' },
  { val: 'UPLOAD', label: 'Tải lên' },
] as const;

interface FoodImageToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  sourceFilter: string;
  onSourceFilterChange: (val: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  onOpenUploadModal: () => void;
  onOpenAiModal: () => void;
}

export const FoodImageToolbar: React.FC<FoodImageToolbarProps> = ({
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onOpenUploadModal,
  onOpenAiModal,
}) => {
  return (
    <div className="bg-white rounded-md p-3 border border-[#d8e2f0] mb-3">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-2.5">
        {/* Search & Source filter */}
        <div className="flex items-center flex-wrap gap-2 flex-1 min-w-[260px]">
          <div className="relative w-full max-w-[340px]">
            <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Tìm ảnh món ăn"
              placeholder="Tìm theo tên món hoặc từ khóa (vd: ức gà, bò, cá)..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-md border border-[#d8e2f0] bg-white text-[13px] text-[#071629] outline-none focus:border-[#00adfc]"
            />
          </div>

          <div className="flex items-center gap-1 bg-[#f1f5fb] border border-[#d8e2f0] p-0.5 rounded-md h-9">
            {FOOD_SOURCES.map((src) => (
              <button
                key={src.val}
                type="button"
                onClick={() => onSourceFilterChange(src.val)}
                className={`px-2.5 h-7 rounded-sm text-xs cursor-pointer transition-colors ${
                  sourceFilter === src.val
                    ? 'bg-white text-[#0077b3] font-semibold border border-[#d8e2f0]'
                    : 'bg-transparent text-[#475569] font-medium border border-transparent hover:text-[#071629]'
                }`}
              >
                {src.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="button button-secondary"
          >
            <UploadCloud size={14} aria-hidden="true" /> Tải ảnh lên kho
          </button>

          <button
            type="button"
            onClick={onOpenAiModal}
            className="button button-primary"
          >
            <Sparkles size={14} aria-hidden="true" /> Tạo ảnh AI lưu kho
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
        {FOOD_CATEGORIES.map((c) => (
          <button
            key={c.val}
            type="button"
            onClick={() => onCategoryFilterChange(c.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer whitespace-nowrap transition-all ${
              categoryFilter === c.val
                ? 'border-sky-500 bg-sky-50 text-sky-600'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <span className="mr-1">{c.icon}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
