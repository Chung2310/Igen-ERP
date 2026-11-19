import React from 'react';
import { Search, UploadCloud, Sparkles } from 'lucide-react';

export const FOOD_CATEGORIES = [
  { val: 'ALL', label: 'Tất cả nhóm', icon: '🍽️' },
  { val: 'PROTEIN', label: 'Đạm (Protein)', icon: '🥩' },
  { val: 'CARB', label: 'Tinh bột (Carb)', icon: '🍚' },
  { val: 'FAT', label: 'Chất béo tốt', icon: '🥑' },
  { val: 'VEGGIE', label: 'Rau củ / Salad', icon: '🥗' },
  { val: 'MEAL', label: 'Bữa chính', icon: '🍱' },
  { val: 'SNACK', label: 'Bữa phụ', icon: '🥪' },
  { val: 'DRINK', label: 'Sinh tố / Nước', icon: '🥤' },
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
    <div className="bg-white rounded-xl p-3.5 sm:p-4.5 border border-slate-200 mb-5">
      <div className="flex justify-between items-center flex-wrap gap-3 mb-3">
        {/* Search & Source filter */}
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative w-full max-w-[360px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên món hoặc từ khóa (vd: ức gà, bò, cá)..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full py-2 pl-9 pr-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex gap-1">
            {FOOD_SOURCES.map((src) => (
              <button
                key={src.val}
                type="button"
                onClick={() => onSourceFilterChange(src.val)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold border-none cursor-pointer transition-colors ${
                  sourceFilter === src.val
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs cursor-pointer hover:bg-emerald-100 transition-colors"
          >
            <UploadCloud size={15} /> Tải Ảnh Lên Kho
          </button>

          <button
            type="button"
            onClick={onOpenAiModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 text-white border-none font-bold text-xs cursor-pointer shadow-xs hover:bg-sky-700 transition-colors"
          >
            <Sparkles size={15} /> Tạo Ảnh AI Lưu Kho
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
