import React, { useState } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { apiFetch } from '../../../lib/api';
import { toast } from '../../../../../pages/Toast';
import { ErpModal, ErpInput, ErpConfirmModal } from '../../../components/Erp/ErpUI';

interface Category {
  id: string;
  name: string;
}

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  categoriesLoading: boolean;
  onSuccess: () => void;
}

export function ManageCategoriesModal({
  isOpen,
  onClose,
  categories,
  categoriesLoading,
  onSuccess,
}: ManageCategoriesModalProps) {

  const darkMode = false;

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: '',
  });

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsCategorySubmitting(true);
    try {
      await apiFetch('/resources/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName }),
      });
      setNewCategoryName('');
      toast.success('Đã thêm phân loại mới thành công!');
      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Lỗi khi tạo phân loại.';
      toast.error(msg);
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteConfirm.id) return;
    try {
      await apiFetch(`/resources/categories/${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      toast.success('Đã xóa phân loại thành công.');
      onSuccess();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Có lỗi xảy ra khi xóa.';
      toast.error(msg);
    } finally {
      setDeleteConfirm({ isOpen: false, id: '', name: '' });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ErpModal title="Quản lý phân loại tài nguyên" onClose={onClose}>
        <div className="space-y-6">
          {/* Add New Category Form */}
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <div className="flex-1">
              <ErpInput
                type="text"
                required
                placeholder="Nhập tên phân loại mới (VD: Phòng học, Thiết bị)..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isCategorySubmitting}
              className="px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold transition-all hover:bg-brand-primary/95 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm
            </button>
          </form>

          {/* List of Categories */}
          <div className="space-y-2">
            <h5 className={cn("text-xs font-black uppercase tracking-wider", darkMode ? "text-slate-400" : "text-slate-500")}>
              Danh sách phân loại hiện tại
            </h5>
            {categoriesLoading ? (
              <p className="text-xs text-slate-400">Đang tải...</p>
            ) : categories.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có phân loại nào.</p>
            ) : (
              <div className={cn(
                "border rounded-2xl p-2 max-h-60 overflow-y-auto divide-y",
                darkMode ? "border-slate-800 divide-slate-800/40" : "border-slate-100 divide-slate-100/60"
              )}>
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      <span className={cn("text-xs font-bold", darkMode ? "text-slate-200" : "text-slate-700")}>
                        {cat.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ isOpen: true, id: cat.id, name: cat.name })}
                      title="Xóa phân loại"
                      className={cn(
                        "p-1.5 rounded-lg transition-all border cursor-pointer",
                        darkMode
                          ? "bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border-transparent"
                          : "bg-slate-50 hover:bg-rose-50 text-slate-450 hover:text-rose-600 border-slate-200/60"
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ErpModal>

      {/* Confirm Delete Category Modal */}
      <ErpConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Xóa phân loại tài nguyên"
        message={`Bạn có chắc chắn muốn xóa phân loại "${deleteConfirm.name}" không? Hành động này không thể hoàn tác.`}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
        confirmText="Xác nhận xóa"
        cancelText="Hủy bỏ"
      />
    </>
  );
}
