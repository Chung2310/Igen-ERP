import React, { useState } from "react";
import { CheckCircle, Cpu, FolderTree, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { InventorySubTabType, ProductCategory, ProductItem, StockLog } from "../types";
import { toast } from "./Toast";
import { AiForecastPanel } from "../components/inventory/AiForecastPanel";
import { CategoryModal } from "../components/inventory/CategoryModal";
import { initialCategories, initialProducts, initialStockLogs, inventoryTabs } from "../components/inventory/data";
import { ProductCard } from "../components/inventory/ProductCard";
import { ProductModal } from "../components/inventory/ProductModal";
import { StockLogPanel } from "../components/inventory/StockLogPanel";
import { SummaryCard } from "../components/inventory/SummaryCard";

export default function InventoryTab() {
  const [subTab, setSubTab] = useState<InventorySubTabType>("DANH MỤC");
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [categories, setCategories] = useState<ProductCategory[]>(initialCategories);
  const [stockLogs, setStockLogs] = useState<StockLog[]>(initialStockLogs);

  const [searchProduct, setSearchProduct] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("Tất cả");
  const [searchCategory, setSearchCategory] = useState("");
  const [searchLog, setSearchLog] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Thiết bị đeo");
  const [newProdStock, setNewProdStock] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdSKU, setNewProdSKU] = useState("");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");

  const shortStockProducts = products.filter((product) => product.stock <= product.minStockAlert);
  const activeCategoryCount = categories.filter((category) => category.status === "Đang dùng").length;
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchCategory.toLowerCase()) ||
    category.code.toLowerCase().includes(searchCategory.toLowerCase())
  );
  const filteredProducts = products.filter((product) => {
    const query = searchProduct.toLowerCase();
    const matchesSearch = product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
    const matchesCategory = selectedCategoryFilter === "Tất cả" || product.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProdName.trim() || !newProdSKU.trim()) return;

    const newProduct: ProductItem = {
      id: "p_" + Date.now(),
      sku: newProdSKU.trim().toUpperCase(),
      name: newProdName.trim(),
      category: newProdCategory,
      stock: parseInt(newProdStock, 10) || 0,
      minStockAlert: 15,
      price: parseFloat(newProdPrice) || 100000,
      demandForecast: "Ổn định",
      imageUrl: "SP",
    };

    setProducts([newProduct, ...products]);
    setStockLogs([
      {
        id: "NK-" + Date.now(),
        type: "nhập",
        sku: newProduct.sku,
        productName: newProduct.name,
        quantity: newProduct.stock,
        operatorName: "iGen Admin System",
        createdAt: "Hôm nay, 10:20",
        notes: "Nhập mới sản phẩm khởi tạo",
        status: "Thành công",
      },
      ...stockLogs,
    ]);
    setShowAddModal(false);
    setNewProdName("");
    setNewProdSKU("");
    setNewProdStock("");
    setNewProdPrice("");
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setShowCategoryModal(false);
    setNewCategoryName("");
    setNewCategoryCode("");
    setNewCategoryDescription("");
  };

  const openCreateCategoryModal = () => {
    resetCategoryForm();
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (category: ProductCategory) => {
    setEditingCategoryId(category.id);
    setNewCategoryName(category.name);
    setNewCategoryCode(category.code);
    setNewCategoryDescription(category.description);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim() || !newCategoryCode.trim()) return;

    const cleanName = newCategoryName.trim();
    const currentCategory = editingCategoryId ? categories.find((category) => category.id === editingCategoryId) : null;
    const existed = categories.some((category) => category.id !== editingCategoryId && category.name.toLowerCase() === cleanName.toLowerCase());

    if (existed) {
      toast.error("Phân loại này đã có trong danh mục kho.");
      return;
    }

    if (editingCategoryId) {
      setCategories(categories.map((category) =>
        category.id === editingCategoryId
          ? {
              ...category,
              name: cleanName,
              code: newCategoryCode.trim().toUpperCase(),
              description: newCategoryDescription.trim() || "Chưa có mô tả. Có thể bổ sung sau.",
            }
          : category
      ));

      if (currentCategory && currentCategory.name !== cleanName) {
        setProducts(products.map((product) => product.category === currentCategory.name ? { ...product, category: cleanName } : product));
        if (selectedCategoryFilter === currentCategory.name) setSelectedCategoryFilter(cleanName);
      }

      resetCategoryForm();
      toast.success("Đã cập nhật phân loại sản phẩm.");
      return;
    }

    const newCategory: ProductCategory = {
      id: "cat_" + Date.now(),
      name: cleanName,
      code: newCategoryCode.trim().toUpperCase(),
      description: newCategoryDescription.trim() || "Chưa có mô tả. Có thể bổ sung sau.",
      colorClass: "bg-blue-50 text-blue-700 border-blue-100",
      status: "Đang dùng",
    };

    setCategories([newCategory, ...categories]);
    setNewProdCategory(newCategory.name);
    resetCategoryForm();
    toast.success("Đã tạo phân loại sản phẩm.");
  };

  const handleDeleteCategory = (category: ProductCategory) => {
    const linkedProductCount = products.filter((product) => product.category === category.name).length;
    const message = linkedProductCount > 0
      ? `Phân loại "${category.name}" đang được dùng bởi ${linkedProductCount} sản phẩm. Xóa và chuyển các sản phẩm đó về "Chưa phân loại"?`
      : `Xóa phân loại "${category.name}"?`;

    if (!window.confirm(message)) return;

    setCategories(categories.filter((item) => item.id !== category.id));
    if (linkedProductCount > 0) {
      setProducts(products.map((product) => product.category === category.name ? { ...product, category: "Chưa phân loại" } : product));
    }
    if (selectedCategoryFilter === category.name) setSelectedCategoryFilter("Tất cả");
    toast.success("Đã xóa phân loại sản phẩm.");
  };

  return (
    <div className="flex h-full max-h-[85vh] flex-col overflow-hidden bg-white" id="inventory_tab_wrapper">
      <div className="flex shrink-0 justify-between border-b border-gray-200 bg-gray-50/50 p-2 text-xs" id="inventory_tabs_switch">
        <div className="flex flex-wrap gap-2">
          {inventoryTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`rounded-lg border px-4 py-2 font-bold uppercase tracking-wide transition-all ${
                subTab === tab ? "border-slate-800 bg-slate-800 text-white shadow-xs" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-indigo-150 bg-indigo-50 px-3 py-1 font-mono text-[10px] font-bold text-indigo-700 md:flex">
          <Cpu className="h-3.5 w-3.5 text-indigo-500" />
          <span>Thuật toán dự đoán iGen-Forecast active</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6" id="inventory_tab_content">
        {subTab === "DANH MỤC" && (
          <div className="space-y-6" id="product_catalog_menu">
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
                  {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                </select>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700"
                id="open_add_product_modal"
              >
                <Plus className="h-4 w-4" />
                Khai báo sản phẩm mới
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" id="products_grid">
              {filteredProducts.map((product) => (
                <React.Fragment key={product.id}>
                  <ProductCard product={product} />
                </React.Fragment>
              ))}
            </div>

            {showAddModal && (
              <ProductModal
                categories={categories}
                newProdCategory={newProdCategory}
                newProdName={newProdName}
                newProdPrice={newProdPrice}
                newProdSKU={newProdSKU}
                newProdStock={newProdStock}
                onClose={() => setShowAddModal(false)}
                onCreateCategory={() => {
                  setShowAddModal(false);
                  openCreateCategoryModal();
                  setSubTab("PHÂN LOẠI SẢN PHẨM");
                }}
                onSubmit={handleAddProduct}
                setNewProdCategory={setNewProdCategory}
                setNewProdName={setNewProdName}
                setNewProdPrice={setNewProdPrice}
                setNewProdSKU={setNewProdSKU}
                setNewProdStock={setNewProdStock}
              />
            )}
          </div>
        )}

        {subTab === "PHÂN LOẠI SẢN PHẨM" && (
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
                <button onClick={openCreateCategoryModal} className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700">
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
                    <button type="button" onClick={() => openEditCategoryModal(category)} className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition-colors hover:bg-blue-100">
                      <Pencil className="h-3.5 w-3.5" />Sửa
                    </button>
                    <button type="button" onClick={() => handleDeleteCategory(category)} className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100">
                      <Trash2 className="h-3.5 w-3.5" />Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredCategories.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
                <p className="font-bold text-gray-700">Không tìm thấy phân loại phù hợp</p>
                <p className="mt-1 text-xs text-gray-500">Thử đổi từ khóa tìm kiếm hoặc thêm phân loại mới.</p>
              </div>
            )}

            {showCategoryModal && (
              <CategoryModal
                editingCategoryId={editingCategoryId}
                newCategoryCode={newCategoryCode}
                newCategoryDescription={newCategoryDescription}
                newCategoryName={newCategoryName}
                onClose={resetCategoryForm}
                onSubmit={handleSaveCategory}
                setNewCategoryCode={setNewCategoryCode}
                setNewCategoryDescription={setNewCategoryDescription}
                setNewCategoryName={setNewCategoryName}
              />
            )}
          </div>
        )}

        {subTab === "NHẬP / XUẤT KHO" && <StockLogPanel searchLog={searchLog} setSearchLog={setSearchLog} stockLogs={stockLogs} />}
        {subTab === "DỰ BÁO AI" && <AiForecastPanel products={shortStockProducts} />}
      </div>
    </div>
  );
}
