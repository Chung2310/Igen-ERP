import React from "react";
import { Download, Plus, Search, Upload } from "lucide-react";
import type { ProductCategory, ProductItem } from "../../types";
import { Pagination } from "../common/Pagination";
import { ProductCard } from "./ProductCard";
import { ProductModal } from "./ProductModal";

type ProductCatalogSectionProps = {
  productImportInputRef: React.RefObject<HTMLInputElement | null>;
  onImportProductsExcel: (event: React.ChangeEvent<HTMLInputElement>) => void;
  searchProduct: string;
  setSearchProduct: (value: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (value: string) => void;
  categories: ProductCategory[];
  onOpenProductImport: () => void;
  productExcelImporting: boolean;
  onExportProductsExcel: () => void;
  onOpenCreateProductModal: () => void;
  productLoading: boolean;
  filteredProducts: ProductItem[];
  paginatedProducts: ProductItem[];
  onDeleteProduct: (product: ProductItem) => void;
  onEditProduct: (product: ProductItem) => void;
  productPage: number;
  totalProductPages: number;
  setProductPage: (page: number) => void;
  showProductModal: boolean;
  imagePreview: string;
  editingProductId: string | null;
  productSubmitting: boolean;
  newProdCategory: string;
  newProdName: string;
  newProdPrice: string;
  newProdSKU: string;
  newProdStock: string;
  newProdBrand: string;
  newProdUnit: string;
  newProdDescription: string;
  newProdStatus: string;
  onCloseProductModal: () => void;
  onCreateCategory: () => void;
  onImageChange: (file: File | null) => void;
  onSubmitProduct: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setNewProdCategory: (value: string) => void;
  setNewProdName: (value: string) => void;
  setNewProdPrice: (value: string) => void;
  setNewProdSKU: (value: string) => void;
  setNewProdStock: (value: string) => void;
  setNewProdBrand: (value: string) => void;
  setNewProdUnit: (value: string) => void;
  setNewProdDescription: (value: string) => void;
  setNewProdStatus: (value: string) => void;
};

export function ProductCatalogSection({
  productImportInputRef,
  onImportProductsExcel,
  searchProduct,
  setSearchProduct,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
  categories,
  onOpenProductImport,
  productExcelImporting,
  onExportProductsExcel,
  onOpenCreateProductModal,
  productLoading,
  filteredProducts,
  paginatedProducts,
  onDeleteProduct,
  onEditProduct,
  productPage,
  totalProductPages,
  setProductPage,
  showProductModal,
  imagePreview,
  editingProductId,
  productSubmitting,
  newProdCategory,
  newProdName,
  newProdPrice,
  newProdSKU,
  newProdStock,
  newProdBrand,
  newProdUnit,
  newProdDescription,
  newProdStatus,
  onCloseProductModal,
  onCreateCategory,
  onImageChange,
  onSubmitProduct,
  setNewProdCategory,
  setNewProdName,
  setNewProdPrice,
  setNewProdSKU,
  setNewProdStock,
  setNewProdBrand,
  setNewProdUnit,
  setNewProdDescription,
  setNewProdStatus,
}: ProductCatalogSectionProps) {
  return (
    <div className="space-y-6" id="product_catalog_menu">
      <input
        ref={productImportInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={onImportProductsExcel}
      />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center" id="catalog_filters">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative w-full sm:w-72">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm, mã SKU..."
              className="w-full rounded-lg border border-gray-200 bg-slate-50/50 py-2 pl-9 pr-4 text-xs"
              value={searchProduct}
              onChange={(event) => setSearchProduct(event.target.value)}
              id="product_search_filter"
            />
          </div>
          <select
            className="w-full rounded-lg border border-gray-200 bg-slate-50/50 px-3 py-2 text-xs sm:w-52"
            value={selectedCategoryFilter}
            onChange={(event) => setSelectedCategoryFilter(event.target.value)}
          >
            <option value="Tất cả">Tất cả phân loại</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onOpenProductImport}
            disabled={productExcelImporting}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {productExcelImporting ? "Đang nhập Excel..." : "Nhập Excel"}
          </button>
          <button
            type="button"
            onClick={onExportProductsExcel}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </button>
          <button
            onClick={onOpenCreateProductModal}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700"
            id="open_add_product_modal"
          >
            <Plus className="h-4 w-4" />
            Khai báo sản phẩm mới
          </button>
        </div>
      </div>

      {productLoading ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="font-bold text-gray-700">Đang tải danh mục sản phẩm...</p>
          <p className="mt-1 text-xs text-gray-500">Dữ liệu đang được đồng bộ từ Firebase.</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="font-bold text-gray-700">Chưa có sản phẩm phù hợp</p>
          <p className="mt-1 text-xs text-gray-500">Thử đổi bộ lọc hoặc tạo sản phẩm mới để bắt đầu quản lý kho.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" id="products_grid">
            {paginatedProducts.map((product) => (
              <div key={product.id}>
                <ProductCard product={product} onDelete={onDeleteProduct} onEdit={onEditProduct} />
              </div>
            ))}
          </div>
          <Pagination currentPage={productPage} totalPages={totalProductPages} onPageChange={setProductPage} />
        </div>
      )}

      {showProductModal ? (
        <ProductModal
          categories={categories}
          imagePreview={imagePreview}
          isEditing={Boolean(editingProductId)}
          isSubmitting={productSubmitting}
          newProdCategory={newProdCategory}
          newProdName={newProdName}
          newProdPrice={newProdPrice}
          newProdSKU={newProdSKU}
          newProdStock={newProdStock}
          newProdBrand={newProdBrand}
          newProdUnit={newProdUnit}
          newProdDescription={newProdDescription}
          newProdStatus={newProdStatus}
          onClose={onCloseProductModal}
          onCreateCategory={onCreateCategory}
          onImageChange={onImageChange}
          onSubmit={onSubmitProduct}
          setNewProdCategory={setNewProdCategory}
          setNewProdName={setNewProdName}
          setNewProdPrice={setNewProdPrice}
          setNewProdSKU={setNewProdSKU}
          setNewProdStock={setNewProdStock}
          setNewProdBrand={setNewProdBrand}
          setNewProdUnit={setNewProdUnit}
          setNewProdDescription={setNewProdDescription}
          setNewProdStatus={setNewProdStatus}
        />
      ) : null}
    </div>
  );
}
