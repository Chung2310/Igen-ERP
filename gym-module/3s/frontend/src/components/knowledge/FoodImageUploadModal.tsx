import React, { useState, useRef } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';
import type { FoodImageItem } from '../../types/knowledge';

interface FoodImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FoodImageUploadModal: React.FC<FoodImageUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    if (!name) {
      const base = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setName(base);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Vui lòng chọn file ảnh để tải lên.');
      return;
    }
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên món ăn.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', name.trim());
      formData.append('category', category);
      if (calories.trim()) formData.append('calories', calories.trim());
      if (protein.trim()) formData.append('protein', protein.trim());
      if (carbs.trim()) formData.append('carbs', carbs.trim());
      if (fat.trim()) formData.append('fat', fat.trim());

      const res = await api.upload<FoodImageItem>('/api/food-images/upload', formData);
      toast.success(res.message || 'Đã tải ảnh lên kho thành công!');
      onClose();
      setFile(null);
      setPreviewUrl(null);
      setName('');
      setCategory('OTHER');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <UploadCloud size={20} className="text-sky-600" />
            <h3 className="m-0 text-base font-extrabold text-slate-900">
              Tải Ảnh Lên Kho Món Ăn
            </h3>
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
          <div className="mb-3.5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên món ăn (Bắt buộc):
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Ức gà nướng mật ong, Cá hồi áp chảo..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-sky-500"
              required
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Hệ thống sẽ dùng tên này để tự động đối soát khi PT bấm sinh thực đơn
            </div>
          </div>

          <div className="mb-3.5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nhóm món:
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

          {/* Calo & Dinh Dưỡng (Macros) */}
          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 mb-4">
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
                  🥩 Đạm (g):
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
                  🍚 Tinh bột (g):
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
                  🥑 Chất béo (g):
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

          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Chọn file ảnh từ máy tính (JPG, PNG, WebP):
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-sky-300 rounded-xl p-5 text-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              {previewUrl ? (
                <div className="flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-40 h-28 object-cover rounded-lg mb-2"
                  />
                  <span className="text-xs text-sky-600 font-bold">
                    Bấm để chọn ảnh khác
                  </span>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} className="text-sky-600 mx-auto mb-2" />
                  <div className="text-[13px] font-bold text-slate-800">
                    Chọn file ảnh từ thiết bị
                  </div>
                  <div className="text-xs text-slate-500">Hỗ trợ JPG, PNG, tối đa 10MB</div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-xs cursor-pointer hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Đang lưu vào kho...' : 'Lưu Vào Kho Ảnh'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
