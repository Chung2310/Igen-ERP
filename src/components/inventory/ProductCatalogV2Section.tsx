import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  PackagePlus,
  Pencil,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "../../pages/Toast";
import { primaryCreateButtonClass } from "../common/primaryCreateButton";
import { getApiErrorMessage } from "../../utils/errorMessage";
import {
  type CatalogProduct,
  type CatalogProductDetail,
  type ProductResourceKind,
  productCatalogService,
  subscribeResourceChanges,
} from "../../services/productCatalogService";
import {
  type Resources,
  type VariantTarget,
  buildCategoryTree3,
  getCategoryDisplayName,
  statusLabels,
  typeLabels,
} from "./catalog/catalogConstants";
import { ProductViewerModal } from "./catalog/ProductViewerModal";
import { ProductEditorModal } from "./catalog/ProductEditorModal";
import { CatalogSetupModal } from "./catalog/CatalogSetupModal";
import { Dropdown, type DropdownOption } from "../common/Dropdown";
import { TableFilterToolbar } from "../common/TableFilterToolbar";
import { ConfirmDialog } from "./InventoryConfirmDialog";
import { VariantModal } from "./catalog/VariantModal";
import { BulkVariantModal } from "./catalog/BulkVariantModal";
import { InventoryEmptyIllustration } from "./InventoryEmptyIllustration";
import { ErpTableHead } from "../common/ErpTableHead";
import { ErpModal } from "../common/ErpModal";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import type { CatalogKind, CatalogWorkspaceSettings, InventoryWorkspaceMode } from "../../../shared/inventory/catalog-workspace";
import type { BranchRecord } from "../../services/branchService";

type Props = {
  workspace?: CatalogWorkspaceSettings;
  branchId?: string;
  branchName?: string;
  branches?: BranchRecord[];
  canManage?: boolean;
  canConfigureWorkspace?: boolean;
  onWorkspaceSaved?: (workspace: CatalogWorkspaceSettings) => void;
  onCatalogChanged?: () => Promise<void>;
};

const workspaceOptions: { value: InventoryWorkspaceMode; label: string }[] = [
  { value: "goods", label: "Chỉ bán hàng hóa" },
  { value: "services", label: "Chỉ cung cấp dịch vụ" },
  { value: "mixed", label: "Hàng hóa và dịch vụ" },
];
const rowActionClass = "inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary";
const amount = new Intl.NumberFormat("vi-VN");

export function ProductCatalogV2Section({ workspace, branchId, branchName, branches = [], canManage = true, canConfigureWorkspace, onWorkspaceSaved, onCatalogChanged }: Props = {}) {
  const handledDeepLink = useRef("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [resources, setResources] = useState<Resources>({ categories: [], brands: [], attributes: [] });
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [kind, setKind] = useState<CatalogKind | "">("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [editor, setEditor] = useState<CatalogProductDetail | "create" | null>(null);
  const [viewer, setViewer] = useState<CatalogProductDetail | null>(null);
  const [setupKind, setSetupKind] = useState<ProductResourceKind | "templates" | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState<InventoryWorkspaceMode>("goods");
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const savingWorkspaceRef = useRef(false);
  const [workspaceSaveError, setWorkspaceSaveError] = useState("");
  const [variantTarget, setVariantTarget] = useState<VariantTarget | null>(null);
  const [productToDelete, setProductToDelete] = useState<CatalogProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const mode = workspace?.mode ?? "goods";
  const catalogKind = mode === "mixed" ? kind || undefined : mode;
  const serviceView = catalogKind === "services";
  const mixedView = mode === "mixed" && !kind;
  const createLabel = mixedView ? "Thêm" : serviceView ? "Thêm dịch vụ" : "Thêm hàng hóa";
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const loadProducts = useCallback(async (pageToLoad: number, signal: AbortSignal) => {
    setLoading(true);
    setLoadError("");
    try {
      const productResult = await productCatalogService.listProducts({
        q: debouncedQuery,
        status,
        catalogKind,
        branchId: branchId || undefined,
        categoryCode: selectedCategory || undefined,
        brandCode: serviceView ? undefined : selectedBrand || undefined,
        page: pageToLoad,
        limit: 10,
      }, signal);
      if (signal.aborted) return;
      const lastPage = Math.max(1, Math.ceil(productResult.total / 10));
      if (!productResult.items.length && lastPage < pageToLoad) {
        setPage(lastPage);
        return;
      }
      setProducts(productResult.items);
      setTotal(productResult.total);
    } catch (error) {
      if (!signal.aborted) setLoadError(getApiErrorMessage(error, "Không thể tải danh mục."));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [debouncedQuery, status, catalogKind, branchId, selectedCategory, selectedBrand, serviceView]);

  // 2. Tải Master Data (danh mục, thương hiệu, thuộc tính) có cơ chế Cache
  const loadMasterResources = async (force = false) => {
    try {
      const [categories, brands, attributes, units] = await Promise.all([
        productCatalogService.listResources("categories", { forceRefresh: force }),
        productCatalogService.listResources("brands", { forceRefresh: force }),
        productCatalogService.listResources("attributes", { forceRefresh: force }),
        productCatalogService.listResources("units", { forceRefresh: force }),
      ]);
      setResources({ categories, brands, attributes, units });
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

  useEffect(() => {
    const controller = new AbortController();
    void loadProducts(page, controller.signal);
    return () => controller.abort();
  }, [page, loadProducts, reloadCount]);

  const resetFilter = () => {
    setQuery("");
    setSelectedCategory("");
    setSelectedBrand("");
    setStatus("");
    setKind("");
    setPage(1);
  };

  const refreshCatalog = async () => {
    setReloadCount(count => count + 1);
    await onCatalogChanged?.().catch(() => {});
  };

  const saveWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingWorkspaceRef.current || !canConfigureWorkspace) return;
    savingWorkspaceRef.current = true;
    setSavingWorkspace(true);
    setWorkspaceSaveError("");
    try {
      const result = await productCatalogService.updateWorkspace(workspaceDraft);
      onWorkspaceSaved?.(result);
      resetFilter();
      setSetupOpen(false);
      toast.success("Đã lưu chế độ danh mục.");
    } catch (error) {
      setWorkspaceSaveError(getApiErrorMessage(error, "Không thể lưu chế độ danh mục."));
    } finally {
      savingWorkspaceRef.current = false;
      setSavingWorkspace(false);
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
      setViewer({ ...detail, branchSummary: product.branchSummary });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải chi tiết sản phẩm."));
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeletingProduct(true);
    try {
      await productCatalogService.deleteProduct(productToDelete._id);
      toast.success(`Đã xóa ${productToDelete.productType === "service" ? "dịch vụ" : "sản phẩm"} "${productToDelete.name}".`);
      setProductToDelete(null);
      await refreshCatalog();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi: Không thể xóa sản phẩm đã có lịch sử giao dịch."));
    } finally {
      setDeletingProduct(false);
    }
  };

  const { tree: categoryTree } = useMemo(() => buildCategoryTree3(resources.categories), [resources.categories]);
  const categoryFilterOptions: DropdownOption<string>[] = [
    { value: "", label: "Tất cả nhóm" },
    ...categoryTree.flatMap(root => [
      { value: root.category.code, label: root.category.name },
      ...root.children.flatMap(child => [
        { value: child.category.code, label: child.category.name, className: "pl-5" },
        ...child.children.map(leaf => ({ value: leaf.category.code, label: leaf.category.name, className: "pl-9" })),
      ]),
    ]),
  ];
  const statusFilterOptions: DropdownOption<string>[] = [
    { value: "", label: "Tất cả trạng thái" },
    ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
  ];
  const hasFilters = Boolean(query || selectedCategory || status || (!serviceView && selectedBrand) || (mode === "mixed" && kind));
  const deletingService = productToDelete?.productType === "service";
  const columns = [
    serviceView ? "Dịch vụ" : mixedView ? "Sản phẩm / Dịch vụ" : "Hàng hóa",
    ...(mixedView ? ["Loại"] : []),
    "Nhóm",
    ...(serviceView ? ["Đơn vị tính", "Cơ sở cung cấp"] : []),
    "Giá bán",
    ...(!serviceView ? ["Tồn khả dụng"] : []),
    "Trạng thái",
    "Thao tác",
  ];

  return (
    <section className="min-w-0 space-y-3" aria-label="Danh mục sản phẩm và dịch vụ">
      <TableFilterToolbar
        search={{
          value: query,
          onChange: value => { setQuery(value); setPage(1); },
          placeholder: serviceView ? "Tìm tên hoặc mã dịch vụ..." : "Tìm tên, mã hoặc SKU...",
          ariaLabel: "Tìm trong danh mục",
        }}
        totalCount={loading || loadError ? undefined : total}
        countLabel={serviceView ? "dịch vụ" : mixedView ? "mục" : "hàng hóa"}
        hasActiveFilters={hasFilters}
        onResetFilters={resetFilter}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(canManage || canConfigureWorkspace) && <button type="button" onClick={() => {
              setWorkspaceDraft(mode);
              setWorkspaceSaveError("");
              setSetupOpen(true);
            }} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
              <Settings2 className="size-4" aria-hidden="true" /> Thiết lập danh mục
            </button>}
            {canManage && <button type="button" onClick={() => setEditor("create")} className={primaryCreateButtonClass + " min-h-9"}>
              <PackagePlus className="size-4" aria-hidden="true" /> {createLabel}
            </button>}
          </div>
        }
      >
        <Dropdown<string>
          aria-label="Nhóm danh mục"
          value={selectedCategory}
          onChange={value => { setSelectedCategory(value); setPage(1); }}
          options={categoryFilterOptions}
          searchable
          searchPlaceholder="Tìm nhóm..."
          variant="filter"
          size="sm"
          className="min-w-36"
        />
        <Dropdown<string>
          aria-label="Trạng thái"
          value={status}
          onChange={value => { setStatus(value); setPage(1); }}
          options={statusFilterOptions}
          variant="filter"
          size="sm"
          className="min-w-36"
        />
        {!serviceView && resources.brands.length > 0 && <Dropdown<string>
          aria-label="Thương hiệu"
          value={selectedBrand}
          onChange={value => { setSelectedBrand(value); setPage(1); }}
          options={[{ value: "", label: "Tất cả thương hiệu" }, ...resources.brands.map(brand => ({ value: brand.code, label: brand.name }))]}
          searchable={resources.brands.length > 8}
          variant="filter"
          size="sm"
          className="min-w-36"
        />}
        {mode === "mixed" && <div role="group" aria-label="Loại danh mục" className="flex flex-wrap gap-1 rounded-xl border border-outline-variant bg-surface-container-low p-1">
          {([{ value: "", label: "Tất cả" }, { value: "goods", label: "Hàng hóa" }, { value: "services", label: "Dịch vụ" }] as const).map(option =>
            <button key={option.value} type="button" aria-pressed={kind === option.value}
              onClick={() => { setKind(option.value); setSelectedCategory(""); setSelectedBrand(""); setPage(1); }}
              className={"rounded-lg px-2.5 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary " + (kind === option.value ? "bg-surface-container-lowest text-primary shadow-xs" : "text-on-surface hover:bg-surface-container-lowest")}>
              {option.label}
            </button>
          )}
        </div>}
      </TableFilterToolbar>

      {loading ? (
        <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-lowest py-12 text-center text-sm text-on-surface-variant">Đang tải danh mục…</p>
      ) : loadError ? (
        <div role="alert" className="space-y-2 rounded-xl border border-outline-variant p-6 text-center text-sm">
          <p>{loadError}</p>
          <button type="button" className="font-medium text-primary underline" onClick={() => setReloadCount(count => count + 1)}>Thử lại</button>
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest py-7 text-center shadow-xs">
          <InventoryEmptyIllustration kind={hasFilters ? "search" : "product"} className="mx-auto" />
          <p className="mt-1 text-sm font-medium text-on-surface">{hasFilters ? "Không tìm thấy mục phù hợp" : serviceView ? "Chưa có dịch vụ" : mixedView ? "Danh mục chưa có dữ liệu" : "Chưa có hàng hóa"}</p>
          {hasFilters && <button type="button" onClick={resetFilter} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface">
            <RotateCcw className="size-3.5" aria-hidden="true" /> Xóa bộ lọc
          </button>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm [&_th]:whitespace-nowrap">
              <ErpTableHead columns={columns} appearance="healthcare" />
              <tbody className="divide-y divide-outline-variant/60">
                {products.map(product => {
                  const unit = resources.units?.find(item => item.code === product.baseUnitCode);
                  const offeredIds = product.serviceBranchIds || [];
                  const branchLabels = branches.filter(item => offeredIds.includes(item._id)).map(item => item.name);
                  const offeredHere = !offeredIds.length || (branchId && offeredIds.includes(branchId));
                  const summary = product.branchSummary;
                  const price = summary?.sellingPriceMin;
                  const upperPrice = summary?.sellingPriceMax;
                  const stock = summary?.availableStock;
                  const noun = product.productType === "service" ? "dịch vụ" : "sản phẩm";
                  return (
                    <tr key={product._id} className="hover:bg-surface">
                      <td className="min-w-44 px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-surface text-on-surface-variant">
                            {product.mediaIds?.[0] ? <img src={product.mediaIds[0]} alt="" className="size-full object-cover" /> : <ImageIcon className="size-4" aria-hidden="true" />}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium text-on-surface">{product.name}</div>
                            <div className="text-xs text-on-surface-variant">{product.productCode}</div>
                          </div>
                        </div>
                      </td>
                      {mixedView && <td className="whitespace-nowrap px-3 py-2.5 text-on-surface-variant">{typeLabels[product.productType]}</td>}
                      <td className="min-w-24 px-3 py-2.5 text-on-surface-variant">{getCategoryDisplayName(product.categoryCode, resources.categories) || "—"}</td>
                      {serviceView && <>
                        <td className="px-3 py-2.5">{unit?.name || product.baseUnitCode || "—"}</td>
                        <td className="min-w-28 px-3 py-2.5 text-on-surface-variant">
                          {!offeredIds.length ? "Tất cả cơ sở" : branchLabels.length ? branchLabels.join(", ") : offeredHere ? branchName || "Chi nhánh hiện tại" : "Cơ sở khác"}
                        </td>
                      </>}
                      <td className="min-w-28 px-3 py-2.5 tabular-nums">
                        {price == null ? <span className="text-on-surface-variant">{branchId && offeredHere ? "Chưa có giá" : "—"}</span> :
                          upperPrice != null && upperPrice !== price ? <>
                            <span className="whitespace-nowrap">{amount.format(price)}</span>{" – "}
                            <span className="whitespace-nowrap">{amount.format(upperPrice)} ₫</span>
                          </> : <span className="whitespace-nowrap">{amount.format(price)} ₫</span>}
                      </td>
                      {!serviceView && <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                        {stock == null ? <span title={product.productType === "service" ? "Dịch vụ không theo dõi tồn" : "Chưa có dữ liệu tồn áp dụng"} className="text-on-surface-variant">—</span> : amount.format(stock)}
                      </td>}
                      <td className="whitespace-nowrap px-3 py-2.5 text-center">
                        <span className={"inline-flex rounded-md px-2 py-1 text-xs font-medium " + (product.status === "active" ? "bg-primary/10 text-on-surface" : "bg-surface-container-low text-on-surface-variant")}>
                          {statusLabels[product.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" onClick={() => void openView(product)} className={rowActionClass} title="Xem chi tiết" aria-label={"Xem " + product.name}>
                            <Eye className="size-4" aria-hidden="true" />
                          </button>
                          {canManage && <>
                            <button type="button" onClick={() => void openEdit(product)} className={rowActionClass} title={"Sửa " + noun} aria-label={"Sửa " + product.name}>
                              <Pencil className="size-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setProductToDelete(product)} className={rowActionClass + " hover:text-error"} title="Xóa" aria-label={"Xóa " + product.name}>
                              <Trash2 className="size-4" aria-hidden="true" />
                            </button>
                          </>}
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant bg-surface px-4 py-3">
              <div className="text-xs text-on-surface-variant">
                Hiển thị {(page - 1) * 10 + 1}–{Math.min(page * 10, total)} trên <strong>{total}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="text-xs font-medium text-on-surface-variant px-1">
                  Trang {page} / {Math.ceil(total / 10)}
                </span>
                <button
                  type="button"
                  disabled={page * 10 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed"
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
      {setupOpen && <ErpModal title="Thiết lập danh mục" native onClose={() => setSetupOpen(false)} closeDisabled={savingWorkspace}>
        {canManage && <div className="flex flex-wrap gap-2">
          {([{ kind: "categories", label: "Nhóm danh mục" }, { kind: "brands", label: "Thương hiệu" }, { kind: "attributes", label: "Thuộc tính" }] as const)
            .filter(option => mode !== "services" || option.kind !== "brands").map(option => (
            <button key={option.kind} type="button" disabled={savingWorkspace}
              onClick={() => { setSetupOpen(false); setSetupKind(option.kind); }}
              className="flex min-h-9 flex-auto items-center justify-between gap-2 rounded-lg border border-outline-variant px-2.5 text-left text-xs hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
              {option.label}
              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>}
        {canConfigureWorkspace && <form onSubmit={saveWorkspace} className={"space-y-3 " + (canManage ? "border-t border-outline-variant pt-3" : "")}>
          <fieldset disabled={savingWorkspace} className="min-w-0 space-y-1.5 disabled:opacity-60">
            <legend className="mb-2 text-sm font-medium">Chế độ hiển thị của doanh nghiệp</legend>
            {workspaceOptions.map(option => (
              <label key={option.value} className={"flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm " +
                (workspaceDraft === option.value ? "border-primary bg-primary/5 font-medium" : "border-outline-variant hover:bg-surface")}>
                <input type="radio" name="catalog-workspace-mode" value={option.value} checked={workspaceDraft === option.value}
                  onChange={() => { setWorkspaceDraft(option.value); setWorkspaceSaveError(""); }}
                  className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
                {option.label}
              </label>
            ))}
          </fieldset>
          {!workspace?.configured && <p className="text-xs text-on-surface-variant">ERP gợi ý chế độ dựa trên danh mục hiện có.</p>}
          {workspaceSaveError && <p role="alert" className="text-sm text-error">{workspaceSaveError}</p>}
          <div className="flex justify-end">
            <button type="submit" className={primaryCreateButtonClass} disabled={savingWorkspace}>
              {savingWorkspace ? "Đang lưu…" : "Lưu chế độ"}
            </button>
          </div>
        </form>}
      </ErpModal>}
      {viewer && <ProductViewerModal product={viewer} resources={resources} branches={branches} branchId={branchId} branchName={branchName} onClose={() => setViewer(null)} />}
      {editor && (
        <ProductEditorModal
          key={typeof editor === "object" && editor ? editor._id : "create"}
          product={editor === "create" ? null : editor}
          resources={resources}
          initialType={serviceView ? "service" : "physical"}
          allowTypeSelection={mode === "mixed"}
          branches={branches}
          branchId={branchId}
          branchName={branchName}
          onCreateCategory={() => setSetupKind("categories")}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await refreshCatalog();
          }}
          onDataChanged={refreshCatalog}
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
          servicesOnly={mode === "services"}
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
            await refreshCatalog();
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
            await refreshCatalog();
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
        title={deletingService ? "Xác nhận xóa dịch vụ" : "Xác nhận xóa sản phẩm"}
        description={deletingService ? `Bạn có chắc chắn muốn xóa dịch vụ "${productToDelete?.name}"?` :
          `Bạn có chắc chắn muốn xóa sản phẩm "${productToDelete?.name}"? Thao tác này chỉ xóa được khi sản phẩm và tất cả biến thể chưa phát sinh giao dịch tồn kho.`}
        confirmLabel={deletingService ? "Xóa dịch vụ" : "Xóa sản phẩm"}
        cancelLabel="Hủy"
        tone="danger"
        isSubmitting={deletingProduct}
        onClose={() => !deletingProduct && setProductToDelete(null)}
        onConfirm={confirmDeleteProduct}
      />
    </section>
  );
}
