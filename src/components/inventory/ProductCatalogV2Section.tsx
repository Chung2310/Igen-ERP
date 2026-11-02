import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Eye,
  Folder,
  FolderTree,
  ImageIcon,
  PackagePlus,
  Pencil,
  RotateCcw,
  Search,
  Sliders,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import {
  type CatalogProduct,
  type CatalogProductDetail,
  type ProductResource,
  type ProductResourceKind,
  productCatalogService,
  subscribeResourceChanges,
} from "../../services/productCatalogService";
import {
  type Resources,
  type VariantTarget,
  buildCategoryTree3,
  getCategoryDisplayName,
  inputClassName,
  statusLabels,
} from "./catalog/catalogConstants";
import { ProductViewerModal } from "./catalog/ProductViewerModal";
import { productDescriptionToText } from "./catalog/productDescription";
import { ProductEditorModal } from "./catalog/ProductEditorModal";
import { CatalogSetupModal } from "./catalog/CatalogSetupModal";
import { Dropdown, type DropdownOption } from "../common/Dropdown";
import { TableFilterToolbar } from "../common/TableFilterToolbar";
import { ConfirmDialog } from "./InventoryConfirmDialog";
import { VariantModal } from "./catalog/VariantModal";
import { BulkVariantModal } from "./catalog/BulkVariantModal";
import { TrackingModeIcon } from "./TrackingModeIcon";

export function ProductCatalogV2Section() {
  const handledDeepLink = useRef("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [resources, setResources] = useState<Resources>({ categories: [], brands: [], attributes: [] });
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<CatalogProductDetail | "create" | null>(null);
  const [viewer, setViewer] = useState<CatalogProductDetail | null>(null);
  const [setupKind, setSetupKind] = useState<ProductResourceKind | "templates" | null>(null);
  const [variantTarget, setVariantTarget] = useState<VariantTarget | null>(null);
  const [productToDelete, setProductToDelete] = useState<CatalogProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  // 1. Chỉ tải danh sách sản phẩm khi đổi trang hoặc lọc
  const loadProducts = async (pageToLoad = page) => {
    setLoading(true);
    try {
      const productResult = await productCatalogService.listProducts({
        q: query,
        status,
        categoryCode: selectedCategory || undefined,
        brandCode: selectedBrand || undefined,
        page: pageToLoad,
        limit: 10,
      });
      setProducts(productResult.items);
      setTotal(productResult.total);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách sản phẩm."));
    } finally {
      setLoading(false);
    }
  };

  // 2. Tải Master Data (danh mục, thương hiệu, thuộc tính) có cơ chế Cache
  const loadMasterResources = async (force = false) => {
    try {
      const [categories, brands, attributes] = await Promise.all([
        productCatalogService.listResources("categories", { forceRefresh: force }),
        productCatalogService.listResources("brands", { forceRefresh: force }),
        productCatalogService.listResources("attributes", { forceRefresh: force }),
      ]);
      setResources({ categories, brands, attributes });
    } catch (error) {
      console.error("Không thể tải dữ liệu master data dùng chung:", error);
    }
  };

  // Tải Master Data đúng 1 lần khi trang mount
  useEffect(() => {
    void loadMasterResources();
  }, []);

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get("editProduct") || "";
    if (!productId || handledDeepLink.current === productId) return;
    handledDeepLink.current = productId;
    void productCatalogService.getProduct(productId).then((detail) => {
      setEditor(detail);
      const url = new URL(window.location.href);
      url.searchParams.delete("editProduct");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }).catch((error) => {
      toast.error(getApiErrorMessage(error, "Không thể mở sản phẩm cần sửa."));
    });
  }, []);

  // Lắng nghe sự kiện thêm/sửa/xóa resource để tự động cập nhật đúng loại mà không reload sản phẩm
  useEffect(() => {
    const unsubscribe = subscribeResourceChanges(async (event) => {
      try {
        const freshItems = await productCatalogService.listResources(event.kind, { forceRefresh: true });
        setResources((prev) => ({
          ...prev,
          [event.kind]: freshItems,
        }));
      } catch (err) {
        console.error("Lỗi cập nhật master data tự động:", err);
      }
    });
    return unsubscribe;
  }, []);

  // Tải sản phẩm khi chuyển trang
  useEffect(() => {
    void loadProducts(page);
  }, [page]);

  // Hàm load tổng hợp khi cần làm mới toàn bộ
  const load = async () => {
    await Promise.all([loadProducts(page), loadMasterResources(false)]);
  };

  const applyFilter = async () => {
    if (page === 1) await loadProducts(1);
    else setPage(1);
  };

  const resetFilter = async () => {
    setQuery("");
    setSelectedCategory("");
    setSelectedBrand("");
    setStatus("");
    if (page === 1) {
      setLoading(true);
      try {
        const productResult = await productCatalogService.listProducts({ page: 1, limit: 10 });
        setProducts(productResult.items);
        setTotal(productResult.total);
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không thể tải danh mục sản phẩm."));
      } finally {
        setLoading(false);
      }
    } else {
      setPage(1);
    }
  };

  const openEdit = async (product: CatalogProduct) => {
    try {
      const detail = await productCatalogService.getProduct(product._id);
      setEditor(detail);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải chi tiết sản phẩm."));
    }
  };

  const openView = async (product: CatalogProduct) => {
    try {
      const detail = await productCatalogService.getProduct(product._id);
      setViewer(detail);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải chi tiết sản phẩm."));
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeletingProduct(true);
    try {
      await productCatalogService.deleteProduct(productToDelete._id);
      toast.success(`Đã xóa sản phẩm "${productToDelete.name}".`);
      setProductToDelete(null);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi: Không thể xóa sản phẩm đã có lịch sử giao dịch."));
    } finally {
      setDeletingProduct(false);
    }
  };

  // 3-Level Category Tree for filter dropdown
  const { tree: categoryTree } = useMemo(() => buildCategoryTree3(resources.categories), [resources.categories]);

  const categoryFilterOptions = useMemo<DropdownOption<string>[]>(() => {
    const list: DropdownOption<string>[] = [
      {
        value: "",
        label: "Tất cả thể loại (thư mục)",
        icon: <Folder className="h-4 w-4 text-amber-500" />,
      },
    ];
    for (const root of categoryTree) {
      list.push({
        value: root.category.code,
        label: `[Cấp 1] ${root.category.name}`,
        icon: <Folder className="h-4 w-4 text-amber-500" />,
        className: "font-bold text-slate-900 bg-slate-50/80",
      });
      for (const l2 of root.children) {
        list.push({
          value: l2.category.code,
          label: `[Cấp 2] ${l2.category.name}`,
          icon: <FolderTree className="h-3.5 w-3.5 text-cyan-600 ml-3" />,
          className: "pl-5 font-semibold text-slate-800",
        });
        for (const l3 of l2.children) {
          list.push({
            value: l3.category.code,
            label: `[Cấp 3] ${l3.category.name}`,
            icon: <Tag className="h-3 w-3 text-slate-400 ml-6" />,
            className: "pl-9 text-slate-600 font-normal",
          });
        }
      }
    }
    return list;
  }, [categoryTree]);

  const brandFilterOptions = useMemo<DropdownOption<string>[]>(() => [
    { value: "", label: "Tất cả thương hiệu" },
    ...resources.brands.map((b) => ({
      value: b.code,
      label: b.name,
    })),
  ], [resources.brands]);

  const statusFilterOptions = useMemo<DropdownOption<string>[]>(() => [
    { value: "", label: "Tất cả trạng thái" },
    { value: "active", label: "Đang kinh doanh", icon: <span className="h-2 w-2 rounded-full bg-emerald-500" /> },
    { value: "draft", label: "Bản nháp", icon: <span className="h-2 w-2 rounded-full bg-amber-400" /> },
    { value: "inactive", label: "Tạm ngừng", icon: <span className="h-2 w-2 rounded-full bg-slate-400" /> },
    { value: "archived", label: "Lưu trữ", icon: <span className="h-2 w-2 rounded-full bg-rose-400" /> },
  ], []);

  // Quick statistics
  const { serialCount, qtyCount } = useMemo(() => {
    let serial = 0;
    let qty = 0;
    for (const p of products) {
      const cat = resources.categories.find((c) => c.code === p.categoryCode);
      if (cat?.defaultTrackingMode === "serial") {
        serial++;
      } else {
        qty++;
      }
    }
    return { serialCount: serial, qtyCount: qty };
  }, [products, resources.categories]);

  return (
    <section className="space-y-4" aria-label="Danh mục sản phẩm dùng chung">
      {/* Header bar */}
      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Danh mục sản phẩm</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Grouped setup tools */}
          <div className="inline-flex items-center rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setSetupKind("categories")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface hover:text-primary transition-colors cursor-pointer"
              title="Quản lý cây thư mục và thể loại (Ngành hàng > Hãng > Đời máy)"
            >
              <FolderTree className="h-3.5 w-3.5 text-primary" />
              Cây thể loại / Thư mục
            </button>
            <div className="h-4 w-px bg-outline-variant mx-0.5" />
            <button
              type="button"
              onClick={() => setSetupKind("brands")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface hover:text-primary transition-colors cursor-pointer"
              title="Khai báo thương hiệu dùng chung"
            >
              <Tag className="h-3.5 w-3.5 text-primary" />
              Thương hiệu
            </button>
            <div className="h-4 w-px bg-outline-variant mx-0.5" />
            <button
              type="button"
              onClick={() => setSetupKind("attributes")}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface hover:text-primary transition-colors cursor-pointer"
              title="Cấu hình thuộc tính biến thể: Màu sắc, Dung lượng, Tình trạng..."
            >
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Thuộc tính
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              void load();
              setEditor("create");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-xs hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <PackagePlus className="h-4 w-4" />
            Tạo sản phẩm
          </button>
        </div>
      </div>

      {/* Unified Filter toolbar */}
      <TableFilterToolbar
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "Tìm tên, mã sản phẩm hoặc SKU...",
          ariaLabel: "Tìm tên, mã sản phẩm hoặc SKU",
          onKeyDown: (event) => {
            if (event.key === "Enter") void applyFilter();
          },
        }}
        totalCount={total}
        countLabel="sản phẩm"
        hasActiveFilters={Boolean(query || selectedCategory || selectedBrand || status)}
        onResetFilters={() => void resetFilter()}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">
              <TrackingModeIcon mode="serial" />
              IMEI: <strong className="text-on-surface">{serialCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">
              <TrackingModeIcon mode="quantity" />
              Số lượng: <strong className="text-on-surface">{qtyCount}</strong>
            </span>
          </div>
        }
      >
        {/* Category 3-Level Tree filter */}
        <Dropdown<string>
          value={selectedCategory}
          onChange={(val) => {
            setSelectedCategory(val);
            setPage(1);
          }}
          options={categoryFilterOptions}
          searchable={true}
          searchPlaceholder="Tìm kiếm danh mục..."
          placeholder="Tất cả thể loại (thư mục)"
          variant="filter"
          size="sm"
          className="min-w-[210px] max-w-[280px]"
          triggerClassName="text-xs font-medium"
        />

        {/* Brand filter */}
        <Dropdown<string>
          value={selectedBrand}
          onChange={(val) => {
            setSelectedBrand(val);
            setPage(1);
          }}
          options={brandFilterOptions}
          searchable={resources.brands.length > 8}
          searchPlaceholder="Tìm thương hiệu..."
          placeholder="Tất cả thương hiệu"
          variant="filter"
          size="sm"
          className="min-w-[160px]"
          triggerClassName="text-xs font-medium"
        />

        {/* Status filter */}
        <Dropdown<string>
          value={status}
          onChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
          options={statusFilterOptions}
          placeholder="Tất cả trạng thái"
          variant="filter"
          size="sm"
          className="min-w-[165px]"
          triggerClassName="text-xs font-medium"
        />
      </TableFilterToolbar>

      {/* Data Table Area */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-xs">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-cyan-700 border-t-transparent mb-2" />
          <p className="text-sm text-slate-500">Đang tải danh mục sản phẩm...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Box className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">Chưa có sản phẩm nào phù hợp</p>
          <p className="mt-1 text-xs text-slate-500">
            {query || selectedCategory || selectedBrand || status
              ? "Thử thay đổi từ khóa hoặc bộ lọc để tìm kiếm."
              : "Bấm \"Tạo sản phẩm\" để bắt đầu tạo sản phẩm và ma trận biến thể."}
          </p>
          <div className="mt-4">
            {query || selectedCategory || selectedBrand || status ? (
              <button
                type="button"
                onClick={() => void resetFilter()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Xóa bộ lọc
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditor("create")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-800 shadow-xs"
              >
                <PackagePlus className="h-4 w-4" />
                Tạo sản phẩm mới
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5 w-16 text-center">Ảnh</th>
                  <th className="px-4 py-3.5 w-40">Mã SP</th>
                  <th className="px-4 py-3.5">Sản phẩm / Đời máy</th>
                  <th className="px-4 py-3.5 w-36">Thương hiệu</th>
                  <th className="px-4 py-3.5">Thể loại / Thư mục</th>
                  <th className="px-4 py-3.5 w-44">Theo dõi kho</th>
                  <th className="px-4 py-3.5 w-36">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right w-28">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => {
                  const brand = resources.brands.find((b) => b.code === product.brandCode);
                  const categoryPath = getCategoryDisplayName(product.categoryCode, resources.categories);
                  const catObj = resources.categories.find((c) => c.code === product.categoryCode);
                  const isSerial = catObj?.defaultTrackingMode === "serial";

                  return (
                    <tr key={product._id} className="hover:bg-cyan-50/20 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <div className="mx-auto h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center shadow-2xs">
                          {product.mediaIds?.[0] ? (
                            <img src={product.mediaIds[0]} alt={product.productCode} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100/90 px-2 py-1 rounded border border-slate-200/70">
                          {product.productCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p
                          onClick={() => void openView(product)}
                          className="font-semibold text-slate-900 hover:text-cyan-700 cursor-pointer transition-colors line-clamp-1"
                        >
                          {product.name}
                        </p>
                        <p className="mt-0.5 max-w-sm truncate text-xs text-slate-500">
                          {productDescriptionToText(product.shortDescription || product.description) || "Chưa có mô tả"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {brand ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            <Tag className="h-3 w-3 text-cyan-600" />
                            {brand.name}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa gắn hãng</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/60">
                          <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          {categoryPath}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isSerial ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 border border-cyan-200">
                            <TrackingModeIcon mode="serial" />
                            Theo IMEI / Serial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <TrackingModeIcon mode="quantity" />
                            Theo Số lượng
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {product.status === "active" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Đang hoạt động
                          </span>
                        ) : product.status === "draft" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Bản nháp
                          </span>
                        ) : product.status === "inactive" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Ngừng bán
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            Lưu trữ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void openView(product)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-cyan-700 transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void openEdit(product)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-cyan-700 transition-colors"
                            title="Sửa sản phẩm"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(product)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 10 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3">
              <div className="text-xs text-slate-500">
                Hiển thị {(page - 1) * 10 + 1}-{Math.min(page * 10, total)} trên <strong>{total}</strong> sản phẩm
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="text-xs font-medium text-slate-600 px-1">
                  Trang {page} / {Math.ceil(total / 10)}
                </span>
                <button
                  type="button"
                  disabled={page * 10 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {viewer && <ProductViewerModal product={viewer} resources={resources} onClose={() => setViewer(null)} />}
      {editor && (
        <ProductEditorModal
          key={typeof editor === "object" && editor ? editor._id : "create"}
          product={editor === "create" ? null : editor}
          resources={resources}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await loadProducts(page);
          }}
          onDataChanged={() => void loadProducts(page)}
          onVariantAction={(product, mode, ids, variant) => setVariantTarget({ product, mode, ids, variant })}
        />
      )}
      {setupKind && (
        <CatalogSetupModal
          kind={setupKind}
          items={
            setupKind === "categories"
              ? resources.categories
              : setupKind === "brands"
                ? resources.brands
                : setupKind === "attributes"
                  ? resources.attributes
                  : []
          }
          categories={resources.categories}
          onClose={() => {
            setSetupKind(null);
          }}
          onSaved={async () => {
            await loadMasterResources(true);
          }}
        />
      )}
      {variantTarget && (variantTarget.mode === "single" || variantTarget.mode === "edit") && (
        <VariantModal
          key={variantTarget.variant?._id || `${variantTarget.product._id}-${variantTarget.mode}`}
          product={variantTarget.product}
          variant={variantTarget.variant}
          onClose={() => setVariantTarget(null)}
          onSaved={async () => {
            const currentEditorId = typeof editor === "object" && editor ? editor._id : null;
            setVariantTarget(null);
            await loadProducts(page);
            if (currentEditorId) {
              try {
                const updated = await productCatalogService.getProduct(currentEditorId);
                setEditor(updated);
              } catch {
                // Ignore error if product details cannot be refreshed
              }
            }
          }}
        />
      )}
      {variantTarget && (variantTarget.mode === "bulk-create" || variantTarget.mode === "bulk-edit") && (
        <BulkVariantModal
          product={variantTarget.product}
          mode={variantTarget.mode}
          ids={variantTarget.ids || []}
          resources={resources}
          onClose={() => setVariantTarget(null)}
          onSaved={async () => {
            const currentEditorId = typeof editor === "object" && editor ? editor._id : null;
            setVariantTarget(null);
            await loadProducts(page);
            if (currentEditorId) {
              try {
                const updated = await productCatalogService.getProduct(currentEditorId);
                setEditor(updated);
              } catch {
                // Ignore error if product details cannot be refreshed
              }
            }
          }}
        />
      )}
      <ConfirmDialog
        isOpen={Boolean(productToDelete)}
        title="Xác nhận xóa sản phẩm"
        description={`Bạn có chắc chắn muốn xóa sản phẩm "${productToDelete?.name}"? Thao tác này chỉ xóa được khi sản phẩm và tất cả biến thể chưa phát sinh giao dịch tồn kho.`}
        confirmLabel="Xóa sản phẩm"
        cancelLabel="Hủy"
        tone="danger"
        isSubmitting={deletingProduct}
        onClose={() => !deletingProduct && setProductToDelete(null)}
        onConfirm={confirmDeleteProduct}
      />
    </section>
  );
}
