import React, { useState, useEffect, useRef } from 'react';
import { Pencil, X, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { FoodImageItem } from '../../types/knowledge';

interface FoodImageEditModalProps {
  item: FoodImageItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export const FoodImageEditModal: React.FC<FoodImageEditModalProps> = ({
  item,
  onClose,
  onSaved,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [prompt, setPrompt] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Image mode
  const [imageMode, setImageMode] = useState<'KEEP' | 'UPLOAD'>('KEEP');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasImgError, setHasImgError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [regeneratingAi, setRegeneratingAi] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category || 'OTHER');
      setPrompt(item.prompt || '');
      setCalories(item.calories !== undefined && item.calories !== null ? String(item.calories) : '');
      setProtein(item.protein !== undefined && item.protein !== null ? String(item.protein) : '');
      setCarbs(item.carbs !== undefined && item.carbs !== null ? String(item.carbs) : '');
      setFat(item.fat !== undefined && item.fat !== null ? String(item.fat) : '');
      setImageMode('KEEP');
      setFile(null);
      setPreviewUrl(null);
      setHasImgError(false);
    }
  }, [item]);

  if (!item) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setHasImgError(false);
    setImageMode('UPLOAD');
  };

  const handleRegenerateAi = async () => {
    try {
      setRegeneratingAi(true);
      const res = await api.post<any>(`/api/food-images/${item._id}/regenerate-ai`, {
        prompt: prompt.trim() || undefined,
        aspectRatio: '4:3',
      });
      const updated = res.data;
      if (updated?.imageUrl) {
        setPreviewUrl(updated.imageUrl);
        setHasImgError(false);
      }
      toast.success(res.message || 'AI đã tái tạo ảnh mới cho món ăn thành công!');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRegeneratingAi(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên món ăn.');
      return;
    }

    try {
      setSaving(true);
      if (imageMode === 'UPLOAD' && file) {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('category', category);
        if (prompt.trim()) formData.append('prompt', prompt.trim());
        if (calories.trim()) formData.append('calories', calories.trim());
        if (protein.trim()) formData.append('protein', protein.trim());
        if (carbs.trim()) formData.append('carbs', carbs.trim());
        if (fat.trim()) formData.append('fat', fat.trim());
        formData.append('source', 'UPLOAD');
        formData.append('image', file);

        const res = await api.uploadPatch<any>(`/api/food-images/${item._id}`, formData);
        toast.success(res.message || `Đã cập nhật thông tin món "${name}" thành công!`);
      } else {
        const payload: Record<string, any> = {
          name: name.trim(),
          category,
          prompt: prompt.trim(),
          calories: calories.trim() ? Number(calories) : null,
          protein: protein.trim() ? Number(protein) : null,
          carbs: carbs.trim() ? Number(carbs) : null,
          fat: fat.trim() ? Number(fat) : null,
          source: item.source || 'AI',
        };

        const res = await api.patch<any>(`/api/food-images/${item._id}`, payload);
        toast.success(res.message || `Đã cập nhật toàn bộ thông tin món "${name}" thành công!`);
      }
      onClose();
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-sky-50 text-sky-600 p-1.5 rounded-lg">
              <Pencil size={18} />
            </div>
            <div>
              <h3 className="m-0 text-base font-extrabold text-slate-900">
                Chỉnh Sửa Thông Tin Món Ăn
              </h3>
              <div className="text-xs text-slate-500">
                Tùy chỉnh tên món, từ khóa đối soát, phân loại, macro và hình ảnh
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* KHU VỰC QUẢN LÝ ẢNH MÓN ĂN */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4">
            <div className="flex gap-3.5 items-start flex-wrap">
              <div className="relative w-32 h-24 rounded-lg overflow-hidden shrink-0 bg-slate-900 border border-slate-300">
                {hasImgError && !previewUrl ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 text-xs text-center p-1">
                    <span>Không có ảnh</span>
                  </div>
                ) : (
                  <img
                    src={previewUrl || item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={() => setHasImgError(true)}
                  />
                )}
                <span className="absolute bottom-1 left-1 text-[10px] font-extrabold bg-slate-900/80 text-white px-1.5 py-0.5 rounded">
                  {item.source === 'AI' ? 'AI' : 'Tải lên'}
                </span>
              </div>

              <div className="flex-1 min-w-[200px]">
                <div className="text-xs font-bold text-slate-700 mb-1.5">
                  Hình thức điều chỉnh ảnh:
                </div>

                {/* 2 tabs chọn chế độ ảnh */}
                <div className="flex gap-1 mb-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setImageMode('KEEP');
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold border cursor-pointer ${
                      imageMode === 'KEEP'
                        ? 'border-sky-600 bg-sky-50 text-sky-600'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Giữ nguyên ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageMode('UPLOAD');
                      fileInputRef.current?.click();
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold border cursor-pointer ${
                      imageMode === 'UPLOAD'
                        ? 'border-sky-600 bg-sky-50 text-sky-600'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    📤 Tải ảnh mới từ máy
                  </button>
                </div>

                {/* Nút bấm Tạo lại bằng AI */}
                <button
                  type="button"
                  disabled={regeneratingAi}
                  onClick={handleRegenerateAi}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-50 text-purple-700 border border-purple-300 text-xs font-bold cursor-pointer hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Hệ thống sẽ dùng tên món để vẽ lại ảnh mới và cập nhật vào kho"
                >
                  {regeneratingAi ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" /> Đang dùng AI vẽ lại ảnh...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} /> Tạo lại ảnh bằng AI cho món này
                    </>
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {imageMode === 'UPLOAD' && file && (
                  <div className="text-xs text-emerald-600 font-bold mt-1.5">
                    ✓ Đã chọn file: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TÊN MÓN VÀ DANH MỤC (2 CỘT) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên món ăn (Bắt buộc):
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Ức gà áp chảo tiêu xanh..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhóm thực phẩm / Danh mục:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-sky-500 bg-white"
              >
                <option value="PROTEIN">🥩 Đạm / Protein</option>
                <option value="CARB">🍚 Tinh bột / Carb</option>
                <option value="FAT">🥑 Chất béo tốt</option>
                <option value="VEGGIE">🥗 Rau củ / Salad</option>
                <option value="MEAL">🍱 Bữa chính hoàn chỉnh</option>
                <option value="SNACK">🥪 Bữa phụ / Snack</option>
                <option value="DRINK">🥤 Sinh tố / Nước uống</option>
                <option value="OTHER">✨ Khác</option>
              </select>
            </div>
          </div>

          {/* CALO VÀ MACROS (4 CỘT) */}
          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 mb-3.5">
            <div className="text-xs font-bold text-amber-900 mb-2">
              Thông tin Dinh dưỡng ước tính (Macros - Tùy chọn):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                  🔥 Calo (kcal):
                </label>
                <input
                  type="number"
                  placeholder="vd: 250"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-md border border-amber-300 text-xs bg-white outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                  🥩 Protein (g):
                </label>
                <input
                  type="number"
                  placeholder="vd: 30"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-md border border-amber-300 text-xs bg-white outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                  🍚 Carbs (g):
                </label>
                <input
                  type="number"
                  placeholder="vd: 15"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-md border border-amber-300 text-xs bg-white outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">
                  🥑 Fat (g):
                </label>
                <input
                  type="number"
                  placeholder="vd: 5"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="w-full py-1.5 px-2 rounded-md border border-amber-300 text-xs bg-white outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* MÔ TẢ MÓN ĂN */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Gợi ý mô tả món ăn (Tùy chọn):
            </label>
            <textarea
              rows={2}
              placeholder="Mô tả món ăn hoặc gợi ý cách chế biến..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-sky-500"
            />
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-xs cursor-pointer hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || regeneratingAi}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Đang lưu thay đổi...' : 'Lưu Mọi Thay Đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
