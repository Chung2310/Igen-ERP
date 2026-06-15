import React from "react";
import { CheckCircle, FolderTree, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import type { ProductCategory } from "../../types";
import { CategoryModal } from "./CategoryModal";
import { SummaryCard } from "./SummaryCard";

type CategoryManagementSectionProps = {
  categories: ProductCategory[];
  activeCategoryCount: number;
  searchCategory: string;
  setSearchCategory: (value: string) => void;
  onOpenCreateCategoryModal: () => void;
  filteredCategories: ProductCategory[];
  onEditCategory: (category: ProductCategory) => void;
  onDeleteCategory: (category: ProductCategory) => void;
  categoryLoading: boolean;
  showCategoryModal: boolean;
  editingCategoryId: string | null;
  newCategoryCode: string;
  newCategoryDescription: string;
  newCategoryName: string;
  onCloseCategoryModal: () => void;
  onSubmitCategory: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setNewCategoryCode: (value: string) => void;
  setNewCategoryDescription: (value: string) => void;
  setNewCategoryName: (value: string) => void;
};

export function CategoryManagementSection({
  categories,
  activeCategoryCount,
  searchCategory,
  setSearchCategory,
  onOpenCreateCategoryModal,
  filteredCategories,
  onEditCategory,
  onDeleteCategory,
  categoryLoading,
  showCategoryModal,
  editingCategoryId,
  newCategoryCode,
  newCategoryDescription,
  newCategoryName,
  onCloseCategoryModal,
  onSubmitCategory,
  setNewCategoryCode,
  setNewCategoryDescription,
  setNewCategoryName,
}: CategoryManagementSectionProps) {
  return (
    <div className="space-y-6" id="product_classification_tab">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SummaryCard icon={FolderTree} label="Tổng phân loại" value={categories.length} tone="blue" />
        <SummaryCard icon={CheckCircle} label="Đang sử dụng" value={activeCategoryCount} tone="green" />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-150 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-800">
            <Tags className="h-4.5 w-4.5 text-blue-500" />
            Phân loại sản phẩm trong kho
          </h4>
          <p className="mt-1 text-xs leading-snug text-gray-500">Mỗi phân loại sẽ xuất hiện trong form khai báo sản phẩm mới.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-72">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm loại hoặc mã phân loại..."
              className="w-full rounded-lg border border-gray-200 bg-slate-50 py-2 pl-9 pr-4 text-xs"
              value={searchCategory}
              onChange={(event) => setSearchCategory(event.target.value)}
            />
          </div>
          <button onClick={onOpenCreateCategoryModal} className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Thêm phân loại
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {filteredCategories.map((category) => (
          <div key={category.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h5 className="font-bold leading-snug text-slate-800">{category.name}</h5>
                <p className="mt-1 font-mono text-[10px] font-bold text-gray-400">Mã: {category.code}</p>
              </div>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700">{category.status}</span>
            </div>
            <p className="mt-4 min-h-10 text-xs leading-5 text-gray-500">{category.description}</p>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => onEditCategory(category)} className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100">
                <Pencil className="h-3.5 w-3.5" />
                Sửa
              </button>
              <button type="button" onClick={() => onDeleteCategory(category)} className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100">
                <Trash2 className="h-3.5 w-3.5" />
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>

      {!categoryLoading && filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="font-bold text-gray-700">Không tìm thấy phân loại phù hợp</p>
          <p className="mt-1 text-xs text-gray-500">Thử đổi từ khóa tìm kiếm hoặc thêm phân loại mới.</p>
        </div>
      ) : null}

      {categoryLoading ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="font-bold text-gray-700">Đang tải phân loại sản phẩm...</p>
          <p className="mt-1 text-xs text-gray-500">Dữ liệu đang được đồng bộ từ Firebase.</p>
        </div>
      ) : null}

      {showCategoryModal ? (
        <CategoryModal
          editingCategoryId={editingCategoryId}
          newCategoryCode={newCategoryCode}
          newCategoryDescription={newCategoryDescription}
          newCategoryName={newCategoryName}
          onClose={onCloseCategoryModal}
          onSubmit={onSubmitCategory}
          setNewCategoryCode={setNewCategoryCode}
          setNewCategoryDescription={setNewCategoryDescription}
          setNewCategoryName={setNewCategoryName}
        />
      ) : null}
    </div>
  );
}
