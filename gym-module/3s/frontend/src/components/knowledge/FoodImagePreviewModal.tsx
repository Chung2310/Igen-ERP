import React from 'react';
import { X, Pencil } from 'lucide-react';
import type { FoodImageItem } from '../../types/knowledge';

interface FoodImagePreviewModalProps {
  item: FoodImageItem | null;
  onClose: () => void;
  onEdit: (item: FoodImageItem) => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  PROTEIN: '🥩 Đạm / Protein',
  CARB: '🍚 Tinh bột / Carb',
  FAT: '🥑 Chất béo tốt',
  VEGGIE: '🥗 Rau củ / Salad',
  MEAL: '🍱 Bữa chính hoàn chỉnh',
  SNACK: '🥪 Bữa phụ',
  DRINK: '🥤 Sinh tố / Nước',
  OTHER: '✨ Khác',
};

export const FoodImagePreviewModal: React.FC<FoodImagePreviewModalProps> = ({
  item,
  onClose,
  onEdit,
}) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="relative w-full max-h-[420px] bg-slate-900 flex items-center justify-center">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full max-h-[420px] object-contain"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 border-none text-white rounded-full p-1.5 cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h3 className="m-0 text-lg font-extrabold text-slate-900">{item.name}</h3>
              {item.category && (
                <div className="text-xs text-slate-500 mt-1">
                  {CATEGORY_NAMES[item.category] || item.category}
                </div>
              )}
            </div>
            <span
              className={`text-xs font-extrabold px-2.5 py-1 rounded-md text-white shrink-0 ${
                item.source === 'AI'
                  ? 'bg-purple-600'
                  : item.source === 'UPLOAD'
                  ? 'bg-emerald-600'
                  : 'bg-amber-600'
              }`}
            >
              {item.source === 'AI' ? 'AI Tạo' : item.source === 'UPLOAD' ? 'Tải Lên' : 'Đã Lưu'}
            </span>
          </div>

          {/* Calo & Macros nếu có */}
          {item.calories ? (
            <div className="mt-3.5 bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-extrabold text-amber-900">
                🔥 {item.calories} kcal
              </span>
              <div className="text-xs text-amber-800 font-semibold flex gap-3">
                <span>{item.protein || 0}g Đạm</span>
                <span>•</span>
                <span>{item.carbs || 0}g Carb</span>
                <span>•</span>
                <span>{item.fat || 0}g Béo</span>
              </div>
            </div>
          ) : null}

          {/* Mô tả / Gợi ý nếu có (chỉ hiển thị ghi chú thực tế, ẩn prompt kỹ thuật tiếng Anh) */}
          {item.prompt && !item.prompt.toLowerCase().includes('professional food photography') && (
            <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              💡 {item.prompt}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                const current = item;
                onClose();
                onEdit(current);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 text-white font-bold text-xs cursor-pointer hover:bg-sky-700 transition-colors"
            >
              <Pencil size={14} /> Sửa món
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 font-bold text-xs cursor-pointer transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
