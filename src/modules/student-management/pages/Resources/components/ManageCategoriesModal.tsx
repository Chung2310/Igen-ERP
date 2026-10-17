import React, { useState } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { toast } from '../../../../../pages/Toast';
import { ErpModal, ErpInput } from '../../../components/Erp/ErpUI';

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
      await apiFetch('/student-resources/categories', {
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
      await apiFetch(`/student-resources/categories/${deleteConfirm.id}`, {
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
      <ErpModal title="Quản lý phân loại tài nguyên" titleClassName="font-medium" maxWidth="max-w-lg" onClose={onClose}>
        <div className="space-y-4">
          {/* Add New Category Form */}
          <form onSubmit={handleAddCategory} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <ErpInput
                type="text"
                required
                aria-label="Tên phân loại mới"
                placeholder="Nhập tên phân loại mới (VD: Phòng học, Thiết bị)..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isCategorySubmitting}
              aria-label="Thêm phân loại"
              title="Thêm phân loại"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          {/* List of Categories */}
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-sm font-medium text-slate-800">Danh sách phân loại</h5>
              <span className="text-xs font-normal text-slate-500">{categories.length} phân loại</span>
            </div>
            {categoriesLoading ? (
              <p className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-4 text-center text-sm text-slate-500">Đang tải...</p>
            ) : categories.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center">
                <Tag className="mx-auto mb-2 h-5 w-5 text-brand-primary" aria-hidden="true" />
                <p className="text-sm font-normal text-slate-500">Chưa có phân loại nào.</p>
              </div>
            ) : (
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex min-h-11 items-center justify-between gap-2 px-3 py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Tag className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden="true" />
                      <span className="truncate text-sm font-normal text-slate-700" title={cat.name}>{cat.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ isOpen: true, id: cat.id, name: cat.name })}
                      aria-label={`Xóa phân loại ${cat.name}`}
                      title={`Xóa phân loại ${cat.name}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-500 transition-colors hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ErpModal>

      {deleteConfirm.isOpen && (
        <ErpModal
          title="Xóa phân loại tài nguyên"
          titleClassName="font-medium"
          maxWidth="max-w-md"
          zIndex="z-[60]"
          onClose={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
        >
          <p className="text-sm font-normal text-slate-600">
            Xóa phân loại “{deleteConfirm.name}”? Thao tác này không thể hoàn tác.
          </p>
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button type="button" onClick={handleDeleteCategory} className="inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Xóa phân loại
            </button>
          </div>
        </ErpModal>
      )}
    </>
  );
}
