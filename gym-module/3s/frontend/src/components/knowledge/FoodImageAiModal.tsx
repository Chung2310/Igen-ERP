import React, { useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import { errorMessage } from '../../types';

interface FoodImageAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FoodImageAiModal: React.FC<FoodImageAiModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên món ăn cần tạo ảnh.');
      return;
    }

    try {
      setGenerating(true);
      const res = await api.post<any>('/api/food-images/ai-generate', {
        name: name.trim(),
        prompt: prompt.trim() || undefined,
        aspectRatio: '4:3',
      });
      toast.success(res.message || `Đã tạo ảnh AI cho món "${name}" và lưu vào kho!`);
      onClose();
      setName('');
      setPrompt('');
      onSuccess();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-purple-600" />
            <h3 className="m-0 text-base font-extrabold text-slate-900">
              Tạo Ảnh Món Ăn Bằng AI (Lưu Kho)
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
              placeholder="Ví dụ: Bò xào cần tây, Canh cải cá rô, Tôm nướng tiêu..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 text-[13px] outline-none focus:border-purple-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Gợi ý phong cách hình ảnh (Tùy chọn):
            </label>
            <textarea
              rows={3}
              placeholder="Để trống để hệ thống tự động tạo ảnh ẩm thực dinh dưỡng chất lượng cao (4K, bài trí đẹp mắt, ánh sáng ấm áp)..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border border-slate-300 text-xs outline-none focus:border-purple-500"
            />
          </div>

          <div className="bg-purple-50/70 p-3 rounded-lg border border-purple-200 mb-5 text-xs text-purple-900 flex gap-2 items-start">
            <Sparkles size={16} className="shrink-0 mt-0.5 text-purple-600" />
            <div>
              <strong>Cơ chế tự động:</strong> Hệ thống AI sẽ tạo ảnh món ăn theo đúng tiêu chuẩn thực phẩm thể thao và tự động lưu vào Kho thư viện. Từ lần sau, bất kỳ thực đơn nào có món này sẽ được tự động lấy ảnh ngay từ kho.
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
              disabled={generating}
              className="flex items-center gap-1.5 px-4.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Đang tạo ảnh AI...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Bắt Đầu Tạo & Lưu Kho
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
