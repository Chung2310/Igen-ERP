import React, { useState } from 'react';
import { Eye, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import type { FoodImageItem } from '../../types/knowledge';

interface FoodImageCardProps {
  item: FoodImageItem;
  onPreview: (item: FoodImageItem) => void;
  onEdit: (item: FoodImageItem) => void;
  onDelete: (id: string, name: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  PROTEIN: '🥩 Đạm',
  CARB: '🍚 Carb',
  FAT: '🥑 Béo',
  VEGGIE: '🥗 Rau',
  MEAL: '🍱 Món',
  SNACK: '🥪 Phụ',
  DRINK: '🥤 Nước',
};

export const FoodImageCard: React.FC<FoodImageCardProps> = ({
  item,
  onPreview,
  onEdit,
  onDelete,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all">
      {/* IMAGE CONTAINER WITH LAZY LOADING */}
      <div
        className="relative w-full pt-[70%] bg-slate-100 overflow-hidden cursor-pointer group"
        onClick={() => onPreview(item)}
        title="Bấm để xem ảnh chi tiết"
      >
        {/* Skeleton placeholder while image is lazy-loading */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-slate-200 animate-pulse" />
        )}

        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-1 p-2 text-center">
            <ImageIcon size={26} className="text-slate-300" />
            <span className="text-[11px] font-medium text-slate-400">Không có ảnh</span>
          </div>
        ) : (
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setIsLoaded(true);
              setHasError(true);
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* SOURCE BADGE */}
        <div className="absolute top-2 left-2 flex gap-1 z-10">
          <span
            className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-md text-white shadow-xs ${
              item.source === 'AI' ? 'bg-purple-600' : 'bg-emerald-600'
            }`}
          >
            {item.source === 'AI' ? '✨ AI Tạo' : '📤 Tải Lên'}
          </span>
        </div>

        {/* ACTION OVERLAY BUTTONS (VIEW / EDIT / DELETE) */}
        <div
          className="absolute top-2 right-2 flex gap-1 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(item);
            }}
            className="bg-white/90 hover:bg-white border-none rounded-md p-1.5 cursor-pointer text-slate-800 transition-colors shadow-xs"
            title="Xem ảnh"
          >
            <Eye size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="bg-white/90 hover:bg-white border-none rounded-md p-1.5 cursor-pointer text-sky-600 transition-colors shadow-xs"
            title="Chỉnh sửa món này"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item._id, item.name);
            }}
            className="bg-rose-600/90 hover:bg-rose-600 border-none rounded-md p-1.5 cursor-pointer text-white transition-colors shadow-xs"
            title="Xóa khỏi kho"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* INFO SECTION */}
      <div className="p-3 sm:p-3.5 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-1.5">
          <div className="font-extrabold text-[14px] text-slate-900 leading-snug line-clamp-1" title={item.name}>
            {item.name}
          </div>
          {item.category && item.category !== 'OTHER' && (
            <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-sm bg-sky-50 text-sky-600 whitespace-nowrap shrink-0">
              {CATEGORY_LABELS[item.category] || item.category}
            </span>
          )}
        </div>

        {/* Calo & Macro stats if available */}
        {item.calories ? (
          <div className="flex gap-1.5 items-center mt-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm">
              🔥 {item.calories} kcal
            </span>
            {(item.protein !== undefined || item.carbs !== undefined || item.fat !== undefined) && (
              <span className="text-[11px] text-slate-500 font-medium">
                {item.protein || 0}P / {item.carbs || 0}C / {item.fat || 0}F
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
