import React, { useEffect, useMemo, useState } from "react";
import { Box, Check, ChevronLeft, ChevronRight, PackagePlus, Pencil, Plus, Search, Square, Tag, Trash2, X, ImageIcon, Eye } from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import {
  type CatalogProduct,
  type CatalogProductDetail,
  type ProductCatalogStatus,
  type ProductCatalogType,
  type ProductResource,
  type ProductResourceKind,
  type ProductTemplate,
  type ProductTemplateField,
  type ProductTrackingMode,
  type ProductVariant,
  type VariantInput,
  productCatalogService,
} from "../../services/productCatalogService";
import { useVariantMatrix, Option, GeneratedVariant, generateEAN13 } from "../../hooks/useVariantMatrix";
import { buildMatrixVariantInput } from "./productVariantPayload";
import { shouldCreateInitialPrice } from "./productCatalogCreation";
import { ConfirmDialog } from "../common/ConfirmDialog";

type Resources = { categories: ProductResource[]; brands: ProductResource[] };
type VariantModalMode = "single" | "edit" | "bulk-create" | "bulk-edit";
type VariantTarget = { product: CatalogProductDetail; mode: VariantModalMode; ids?: string[]; variant?: ProductVariant };
const DEFAULT_UNIT_CODE = "UOM-CAI";
type ProductForm = {
  productCode: string;
  name: string;
  productType: ProductCatalogType;
  categoryCode: string;
  brandCode: string;
  baseUnitCode: string;
  shortDescription: string;
  description: string;
  manufacturer: string;
  countryOfOrigin: string;
  taxCategory: string;
  warrantyMonths: number;
  status: ProductCatalogStatus;
  mediaIds: string[];
};

const emptyProductForm = (): ProductForm => ({
  productCode: "",
  name: "",
  productType: "physical",
  categoryCode: "",
  brandCode: "",
  baseUnitCode: DEFAULT_UNIT_CODE,
  shortDescription: "",
  description: "",
  manufacturer: "",
  countryOfOrigin: "",
  taxCategory: "",
  warrantyMonths: 0,
  status: "draft",
  mediaIds: [],
});

const emptyVariant = (unitCode = DEFAULT_UNIT_CODE, productType: ProductCatalogType = "physical"): VariantInput => ({
  sku: "",
  barcode: generateEAN13(),
  displayName: "",
  unitCode,
  trackingMode: "none",
  status: "active",
  mediaIds: [],
  sellingPrice: 0,
  supplierWarrantyMonths: 0,
});

const typeLabels: Record<ProductCatalogType, string> = { physical: "Hàng hóa", service: "Dịch vụ", bundle: "Gói sản phẩm" };
const statusLabels: Record<ProductCatalogStatus, string> = { draft: "Nháp", active: "Đang hoạt động", inactive: "Ngừng hoạt động", archived: "Lưu trữ" };
const unitCategoryLabels: Record<string, string> = { count: "Đếm", weight: "Khối lượng", volume: "Thể tích", length: "Chiều dài", time: "Thời gian", other: "Khác" };
const trackingLabels: Record<ProductTrackingMode, string> = { quantity: "Số lượng", unit_barcode: "Theo mã vạch từng đơn vị", lot: "Theo lô", serial: "Theo số sê-ri/IMEI", none: "Không theo dõi" };

function inputClassName(extra = "") {
  return `w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100 ${extra}`;
}

function ImageUploadBox({ value, onChange, className = "" }: { value?: string, onChange: (url: string) => void, className?: string }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await productCatalogService.uploadMedia(file);
      onChange(url);
    } catch (err) {
      toast.error("Lỗi khi tải ảnh lên.");
    } finally {
      setUploading(false);
    }
  };
  
  // Check if it's a very small box based on className to hide text
  const isSmall = className.includes("w-10") || className.includes("w-12") || className.includes("h-10") || className.includes("h-12");

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:bg-slate-100 hover:border-cyan-400 group ${className}`}>
      {value ? (
        <img src={value} alt="Uploaded" className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-cyan-600 p-1">
          <ImageIcon className={`opacity-70 ${isSmall ? 'h-5 w-5' : 'h-6 w-6 mb-1'}`} />
          {!isSmall && <span className="text-[10px] font-medium text-center leading-tight">Thêm ảnh</span>}
        </div>
      )}
      {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" /></div>}
      <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 cursor-pointer opacity-0" />
    </div>
  );
}

function NumberInput({ value, onChange, className = "", placeholder = "" }: { value: number | string; onChange: (val: number) => void; className?: string; placeholder?: string }) {
  const [inputValue, setInputValue] = useState("");
  
  useEffect(() => {
    if (value === 0 || !value) {
      setInputValue("");
    } else {
      setInputValue(new Intl.NumberFormat("vi-VN").format(Number(value)));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setInputValue("");
      onChange(0);
      return;
    }
    const num = parseInt(rawValue, 10);
    setInputValue(new Intl.NumberFormat("vi-VN").format(num));
    onChange(num);
  };

  return <input type="text" value={inputValue} onChange={handleChange} className={className} placeholder={placeholder} />;
}

export function ProductCatalogV2Section() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [resources, setResources] = useState<Resources>({ categories: [], brands: [] });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<CatalogProductDetail | "create" | null>(null);
  const [viewer, setViewer] = useState<CatalogProductDetail | null>(null);
  const [setupKind, setSetupKind] = useState<"categories" | "brands" | null>(null);
  const [variantTarget, setVariantTarget] = useState<VariantTarget | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [productResult, categories, brands] = await Promise.all([
        productCatalogService.listProducts({ q: query, status, page, limit: 10 }),
        productCatalogService.listResources("categories"),
        productCatalogService.listResources("brands"),
      ]);
      setProducts(productResult.items);
      setTotal(productResult.total);
      setResources({ categories, brands });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh mục sản phẩm mới."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page]);

  const applyFilter = async () => { 
    if (page === 1) await load();
    else setPage(1); 
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

  const deleteProduct = async (product: CatalogProduct) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm ${product.name}?`)) return;
    try {
      await productCatalogService.deleteProduct(product._id);
      toast.success("Đã xóa sản phẩm.");
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Lỗi: Không thể xóa sản phẩm đã có lịch sử giao dịch."));
    }
  };

  const activeCount = useMemo(() => products.filter((product) => product.status === "active").length, [products]);

  return (
    <section className="space-y-5" aria-label="Danh mục sản phẩm dùng chung">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Danh mục sản phẩm dùng chung</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSetupKind("categories")} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" title="Khai báo danh mục dùng chung"><Tag className="h-4 w-4" />Danh mục</button>
          <button type="button" onClick={() => setSetupKind("brands")} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" title="Khai báo thương hiệu dùng chung"><Tag className="h-4 w-4" />Thương hiệu</button>
          <button type="button" onClick={() => setEditor("create")} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"><PackagePlus className="h-4 w-4" />Tạo sản phẩm</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void applyFilter(); }} className={`${inputClassName()} pl-9`} placeholder="Tìm tên, mã sản phẩm hoặc từ khóa" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClassName()}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={() => void applyFilter()} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Lọc</button>
      </div>

      <div className="flex gap-6 text-sm text-slate-600">
        <span><strong className="text-slate-900">{total}</strong> sản phẩm tổng cộng</span>
        <span><strong className="text-slate-900">{products.length}</strong> hiển thị trên trang này</span>
      </div>

      {loading ? <div className="py-12 text-center text-sm text-slate-500">Đang tải danh mục sản phẩm...</div> : products.length === 0 ? (
        <div className="border-y border-dashed border-slate-300 py-12 text-center">
          <Box className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">Chưa có sản phẩm trong danh mục mới</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr><th className="px-4 py-3.5 font-medium w-[60px]">Ảnh</th><th className="px-4 py-3.5 font-medium">Mã</th><th className="px-4 py-3.5 font-medium">Sản phẩm</th><th className="px-4 py-3.5 font-medium">Loại</th><th className="px-4 py-3.5 font-medium">Danh mục</th><th className="px-4 py-3.5 font-medium">Trạng thái</th><th className="px-4 py-3.5 text-right">Thao tác</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.map((product) => (
                <tr key={product._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3.5">
                    <div className="h-10 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center">
                      {product.mediaIds?.[0] ? <img src={product.mediaIds[0]} alt={product.productCode} className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-slate-300" />}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{product.productCode}</td>
                  <td className="px-4 py-3.5"><p className="font-semibold text-slate-900">{product.name}</p><p className="mt-1 max-w-sm truncate text-xs text-slate-500">{product.shortDescription || product.description || "Chưa có mô tả"}</p></td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium">{typeLabels[product.productType]}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">{product.categoryCode}</td>
                  <td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.status === "active" ? "bg-emerald-50 text-emerald-700" : product.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{statusLabels[product.status]}</span></td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => void openView(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-cyan-700" title="Xem chi tiết"><Eye className="h-4 w-4" /></button>
                      <button type="button" onClick={() => void openEdit(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-cyan-700" title="Sửa sản phẩm"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => void deleteProduct(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Xóa sản phẩm"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {total > 10 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-4">
          <div className="text-sm text-slate-500">
            Trang {page} / {Math.ceil(total / 10)}
          </div>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-50">Trước</button>
            <button disabled={page * 10 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-slate-300 rounded text-sm disabled:opacity-50">Sau</button>
          </div>
        </div>
      )}

      {viewer && <ProductViewerModal product={viewer} resources={resources} onClose={() => setViewer(null)} />}
      {editor && <ProductEditorModal product={editor === "create" ? null : editor} resources={resources} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await load(); }} onDataChanged={load} onVariantAction={(product, mode, ids, variant) => setVariantTarget({ product, mode, ids, variant })} />}
      {setupKind && <CatalogSetupModal kind={setupKind} items={resources[setupKind]} onClose={() => setSetupKind(null)} onSaved={async () => { await load(); }} />}
      {variantTarget && (variantTarget.mode === "single" || variantTarget.mode === "edit") && <VariantModal product={variantTarget.product} variant={variantTarget.variant} onClose={() => setVariantTarget(null)} onSaved={async () => { setVariantTarget(null); await load(); }} />}
      {variantTarget && (variantTarget.mode === "bulk-create" || variantTarget.mode === "bulk-edit") && <BulkVariantModal product={variantTarget.product} mode={variantTarget.mode} ids={variantTarget.ids || []} onClose={() => setVariantTarget(null)} onSaved={async () => { setVariantTarget(null); await load(); }} />}
    </section>
  );
}

function ProductViewerModal({ product, resources, onClose }: { product: CatalogProductDetail; resources: Resources; onClose: () => void }) {
  const categoryName = resources.categories.find(c => c.code === product.categoryCode)?.name || product.categoryCode;
  const brandName = resources.brands.find(b => b.code === product.brandCode)?.name || product.brandCode || "Không có";
  return (
    <Modal title={`Chi tiết: ${product.name}`} onClose={onClose} wide>
      <div className="bg-slate-50/50 -m-5 p-5 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-40 flex-shrink-0">
            <div className="aspect-square w-full rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
              {product.mediaIds?.[0] ? <img src={product.mediaIds[0]} alt={product.name} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-slate-300" />}
            </div>
            <div className="mt-4 text-center">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${product.status === "active" ? "bg-emerald-100 text-emerald-800" : product.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-800"}`}>
                {statusLabels[product.status]}
              </span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Mã sản phẩm</p><p className="text-sm font-semibold text-slate-900 font-mono">{product.productCode}</p></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Tên sản phẩm</p><p className="text-sm font-medium text-slate-900">{product.name}</p></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Loại</p><p className="text-sm font-medium text-slate-900">{typeLabels[product.productType]}</p></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Danh mục</p><p className="text-sm font-medium text-slate-900">{categoryName}</p></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Thương hiệu</p><p className="text-sm font-medium text-slate-900">{brandName}</p></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Nhà sản xuất</p><p className="text-sm font-medium text-slate-900">{product.manufacturer || "-"}</p></div>
            <div><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Xuất xứ</p><p className="text-sm font-medium text-slate-900">{product.countryOfOrigin || "-"}</p></div>
            <div className="sm:col-span-2"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Mô tả</p><p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100 min-h-[60px] whitespace-pre-wrap">{product.description || product.shortDescription || "Chưa có mô tả chi tiết."}</p></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Mã SKU / Biến thể ({product.variants.length})
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-[60px]">Ảnh</th>
                  <th className="px-4 py-3">Mã SKU</th>
                  <th className="px-4 py-3">Tên biến thể</th>
                  <th className="px-4 py-3">Theo dõi kho</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {product.variants.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Chưa có mã SKU nào.</td></tr> : product.variants.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="h-10 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center">
                        {item.mediaIds?.[0] ? <img src={item.mediaIds[0]} alt={item.sku} className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-slate-300" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-slate-700">{item.sku}</div>
                      {item.barcode && <div className="mt-1 text-[11px] text-slate-500">{item.barcode}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.displayName || <span className="text-slate-400 italic font-normal">Mặc định</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{trackingLabels[item.trackingMode]}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {item.status === "active" ? "Đang dùng" : "Ngừng dùng"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="rounded-md bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm transition-colors focus:outline-none">
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProductEditorModal({ product, resources, onClose, onSaved, onDataChanged, onVariantAction }: { product: CatalogProductDetail | null; resources: Resources; onClose: () => void; onSaved: () => Promise<void>; onDataChanged: () => Promise<void>; onVariantAction: (product: CatalogProductDetail, mode: VariantModalMode, ids?: string[], variant?: ProductVariant) => void }) {
  const [form, setForm] = useState<ProductForm>(() => product ? {
    productCode: product.productCode, name: product.name, productType: product.productType, categoryCode: product.categoryCode, brandCode: product.brandCode || "", baseUnitCode: product.baseUnitCode, shortDescription: product.shortDescription || "", description: product.description || "", manufacturer: product.manufacturer || "", countryOfOrigin: product.countryOfOrigin || "", taxCategory: product.taxCategory || "", warrantyMonths: product.warrantyMonths || 0, status: product.status, mediaIds: product.mediaIds || [],
  } : emptyProductForm());
  const [variant, setVariant] = useState<VariantInput>(() => product ? emptyVariant(product.baseUnitCode, product.productType) : emptyVariant());
  const [submitting, setSubmitting] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [deleteVariantIds, setDeleteVariantIds] = useState<string[] | null>(null);
  const [deletingVariants, setDeletingVariants] = useState(false);
  const [variantImages, setVariantImages] = useState<Record<string, string | undefined>>(() => Object.fromEntries((product?.variants || []).map((item) => [item._id, item.mediaIds?.[0]])));
  const [variantQuery, setVariantQuery] = useState("");
  const [pricesByVariant, setPricesByVariant] = useState<Record<string, number>>({});
  useEffect(() => { if (!product) return; void productCatalogService.listPrices().then((prices) => setPricesByVariant(Object.fromEntries(prices.map((price) => [price.variantId, price.sellingPrice])))).catch(() => {}); }, [product?._id]);
  const updateVariantImage = async (item: ProductVariant, url: string) => {
    const previousUrl = variantImages[item._id] ?? item.mediaIds?.[0];
    setVariantImages((current) => ({ ...current, [item._id]: url }));
    try {
      await productCatalogService.updateVariant(item._id, { mediaIds: [url] });
      toast.success("Đã cập nhật ảnh SKU.");
      await onDataChanged();
    } catch (error) {
      setVariantImages((current) => ({ ...current, [item._id]: previousUrl }));
      toast.error(getApiErrorMessage(error, "Không thể cập nhật ảnh SKU."));
    }
  };
  const isEditing = Boolean(product);

  // Bulk Variant Matrix State
  const [options, setOptions] = useState<Option[]>([]);
  const generatedVariants = useVariantMatrix(form.productCode, options);
  const [variantsMatrix, setVariantsMatrix] = useState<GeneratedVariant[]>([]);

  useEffect(() => {
    setVariantsMatrix(generatedVariants);
  }, [generatedVariants]);

  const handleOptionValueAdd = (index: number, value: string) => {
    if (!value.trim()) return;
    const newOptions = [...options];
    if (!newOptions[index].values.includes(value.trim())) {
      newOptions[index].values.push(value.trim());
      setOptions(newOptions);
    }
  };

  const handleOptionValueRemove = (optIndex: number, valIndex: number) => {
    const newOptions = [...options];
    newOptions[optIndex].values.splice(valIndex, 1);
    setOptions(newOptions);
  };

  const handleVariantMatrixChange = (index: number, field: keyof GeneratedVariant, value: any) => {
    const newVariants = [...variantsMatrix];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariantsMatrix(newVariants);
  };

  const visibleVariants = useMemo(() => {
    const keyword = variantQuery.trim().toLowerCase();
    if (!product || !keyword) return product?.variants || [];
    return product.variants.filter((item) => [item.sku, item.displayName, item.barcode].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword)));
  }, [product, variantQuery]);
  const allVisibleSelected = visibleVariants.length > 0 && visibleVariants.every((item) => selectedVariantIds.includes(item._id));
  const toggleVisibleVariants = () => setSelectedVariantIds((current) => allVisibleSelected ? current.filter((id) => !visibleVariants.some((item) => item._id === id)) : [...new Set([...current, ...visibleVariants.map((item) => item._id)])]);

  const setField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const confirmDeleteVariants = async () => {
    if (!deleteVariantIds?.length) return;
    setDeletingVariants(true);
    try {
      await productCatalogService.deleteVariants(deleteVariantIds);
      toast.success("Đã xóa các SKU chưa phát sinh giao dịch.");
      setDeleteVariantIds(null);
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa SKU đã chọn."));
    } finally {
      setDeletingVariants(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const payload = {
      productCode: form.productCode || undefined,
      name: form.name,
      productType: form.productType,
      categoryCode: form.categoryCode,
      brandCode: form.brandCode || undefined,
      baseUnitCode: form.baseUnitCode,
      shortDescription: form.shortDescription || undefined,
      description: form.description || undefined,
      manufacturer: form.manufacturer || undefined,
      countryOfOrigin: form.countryOfOrigin || undefined,
      taxCategory: form.taxCategory || undefined,
      warrantyMonths: form.warrantyMonths,
      status: form.status,
      mediaIds: form.mediaIds,
    };
    try {
      if (product) {
        const { productCode: _productCode, productType: _productType, ...update } = payload;
        await productCatalogService.updateProduct(product._id, { ...update, brandCode: form.brandCode || null });
        toast.success("Đã cập nhật thông tin sản phẩm.");
      } else {
        if (options.some(o => o.values.length > 0)) {
          // Bulk create flow
          await productCatalogService.bulkCreateWithVariants({
            ...payload,
            variants: variantsMatrix.map(v => {
              let sku = (v.sku || "").trim();
              if (!sku) {
                const skuSuffix = v.optionValues.map(opt => opt.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, "")).join("-");
                sku = payload.productCode ? `${payload.productCode}-${skuSuffix}` : `SKU-${skuSuffix}-${generateEAN13().slice(9)}`;
              }
              return buildMatrixVariantInput({
                row: { ...v, sku },
                shared: variant,
                productCode: payload.productCode || "",
                baseUnitCode: form.baseUnitCode,
                productType: form.productType,
                fallbackSku: sku,
              });
            }) as any
          });
          toast.success("Đã tạo sản phẩm và hàng loạt SKU.");
        } else {
          // Single create flow
          let sku = (variant.sku || "").trim();
          if (!sku) {
            sku = payload.productCode || `SKU-${generateEAN13().slice(6)}`;
          }
          const created = await productCatalogService.createProduct({ ...payload, variant: { ...variant, sku, unitCode: variant.unitCode || form.baseUnitCode, trackingMode: form.productType === "service" ? "none" : variant.trackingMode } });
          const createdVariant = created.variants?.[0];
          if (createdVariant && shouldCreateInitialPrice(form.status)) await productCatalogService.upsertPrice(String(createdVariant._id), Number(variant.sellingPrice || 0));
          toast.success("Đã tạo sản phẩm và SKU đầu tiên.");
        }
      }
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu sản phẩm."));
    } finally {
      setSubmitting(false);
    }
  };

  return <><Modal title={isEditing ? `Sản phẩm: ${product!.name}` : "Tạo sản phẩm mới"} onClose={onClose} wide>
    <form noValidate onSubmit={submit} className="bg-slate-50/50 -m-5 p-5 space-y-5">
      
      {/* Khối 1: Thông tin cơ bản */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">1</span>
          Thông tin cơ bản
        </h4>
        <div className="grid gap-6 md:grid-cols-[140px_1fr]">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-700">Ảnh đại diện</label>
            <ImageUploadBox value={form.mediaIds[0]} onChange={(url) => setField("mediaIds", [url])} className="w-full aspect-square" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 h-fit">
            {isEditing && <Field label="Mã sản phẩm"><input readOnly value={form.productCode} className={inputClassName("bg-slate-50 text-slate-500")} /></Field>}
            <Field label="Tên sản phẩm"><input required value={form.name} onChange={(event) => setField("name", event.target.value)} className={inputClassName()} placeholder="Ví dụ: Áo thun nam Cotton" /></Field>
            <Field label="Loại"><select disabled={isEditing} value={form.productType} onChange={(event) => { const productType = event.target.value as ProductCatalogType; setField("productType", productType); setVariant((current) => ({ ...current, trackingMode: productType === "service" ? "none" : current.trackingMode === "none" ? "quantity" : current.trackingMode })); }} className={inputClassName("disabled:bg-slate-50")}>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Danh mục"><select required value={form.categoryCode} onChange={(event) => setField("categoryCode", event.target.value)} className={inputClassName()}><option value="">Chọn danh mục</option>{resources.categories.map((item) => <option key={item._id} value={item.code}>{item.name} ({item.code})</option>)}</select></Field>
            <Field label="Thương hiệu"><select value={form.brandCode} onChange={(event) => setField("brandCode", event.target.value)} className={inputClassName()}><option value="">Không chọn</option>{resources.brands.map((item) => <option key={item._id} value={item.code}>{item.name}</option>)}</select></Field>
            <Field label="Trạng thái"><select value={form.status} onChange={(event) => setField("status", event.target.value as ProductCatalogStatus)} className={inputClassName()}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="Bảo hành khách hàng (tháng)"><NumberInput value={form.warrantyMonths} onChange={(value) => setField("warrantyMonths", value)} className={inputClassName()} placeholder="0" /></Field>
          </div>
        </div>
      </div>

      {/* Khối 2 (Tạo mới): Thuộc tính biến thể */}
      {!isEditing && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">2</span>
              Thuộc tính biến thể (Màu sắc, Size...)
            </h4>
            <button type="button" onClick={() => setOptions([...options, { code: `OPT${options.length + 1}`, name: `Thuộc tính ${options.length + 1}`, values: [] }])} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" />Thêm thuộc tính</button>
          </div>
          
          {options.length > 0 && (
            <div className="space-y-4 pt-2">
              {options.map((opt, optIndex) => (
                <div key={opt.code} className="relative rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300">
                  <div className="mb-3 flex items-center justify-between">
                    <input 
                      className="bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-b focus:border-cyan-500 w-1/2 pb-1" 
                      value={opt.name} 
                      onChange={(e) => { const newOpts = [...options]; newOpts[optIndex].name = e.target.value; setOptions(newOpts); }} 
                      placeholder="Tên thuộc tính (VD: Màu sắc)"
                    />
                    <button type="button" onClick={() => setOptions(options.filter((_, i) => i !== optIndex))} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {opt.values.map((val, valIndex) => (
                      <span key={valIndex} className="flex items-center gap-1.5 rounded-md bg-cyan-100 pl-2.5 pr-1.5 py-1 text-xs font-medium text-cyan-800 shadow-sm">
                        {val}
                        <button type="button" onClick={() => handleOptionValueRemove(optIndex, valIndex)} className="rounded-sm p-0.5 text-cyan-600 hover:bg-cyan-200 hover:text-cyan-900 focus:outline-none"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <input type="text" placeholder={`Nhập giá trị ${opt.name} và nhấn Enter...`} className={inputClassName("text-sm shadow-sm")} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleOptionValueAdd(optIndex, e.currentTarget.value); e.currentTarget.value = ''; } }} />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">↵ Enter</span>
                  </div>
                  <Field label="Bảo hành nhà cung cấp (tháng)"><NumberInput value={variant.supplierWarrantyMonths || 0} onChange={(value) => setVariant((current) => ({ ...current, supplierWarrantyMonths: value }))} className={inputClassName()} placeholder="0" /></Field>
                </div>
              ))}
            </div>
          )}

          {options.length > 0 ? (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Ma trận Biến thể ({variantsMatrix.length})</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Các biến thể được tạo tự động dựa trên tổ hợp thuộc tính ở trên.</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-sm relative">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-3 font-semibold w-[50px]">Ảnh</th>
                        <th className="p-3 font-semibold w-[20%]">Biến thể</th>
                        <th className="p-3 font-semibold w-[20%]">Mã SKU</th>
                        <th className="p-3 font-semibold w-[20%]">Mã vạch</th>
                        <th className="p-3 font-semibold text-right w-[15%]">Cân nặng (g)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {variantsMatrix.length > 0 ? variantsMatrix.map((variantItem, index) => (
                        <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-2">
                            <ImageUploadBox value={variantItem.mediaIds?.[0]} onChange={url => handleVariantMatrixChange(index, 'mediaIds', [url])} className="h-12 w-12 !rounded-md flex-shrink-0" />
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {variantItem.optionValues.map((v, i) => (
                                <span key={i} className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">{v.value}</span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3"><input className={inputClassName("py-2 text-xs")} placeholder="Nhập mã SKU" value={variantItem.sku} onChange={e => handleVariantMatrixChange(index, 'sku', e.target.value)} /></td>
                          <td className="p-3"><input className={inputClassName("py-2 text-xs")} placeholder="Nhập mã vạch..." value={variantItem.barcode || ''} onChange={e => handleVariantMatrixChange(index, 'barcode', e.target.value)} /></td>
                          <td className="p-3"><NumberInput className={inputClassName("py-2 text-xs text-right")} placeholder="0 g" value={variantItem.weightGrams || ''} onChange={num => handleVariantMatrixChange(index, 'weightGrams', num)} /></td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <Box className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                            <h4 className="text-sm font-semibold text-slate-700">Chưa có mã SKU nào được tạo</h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">Vui lòng gõ giá trị cho thuộc tính ở trên (Ví dụ: Xanh, Đỏ, S, M) và nhấn <strong className="font-semibold text-slate-700">Enter</strong> để hệ thống tự động sinh ra danh sách các biến thể.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Mã SKU Mặc định</h4>
              <div className="grid gap-6 md:grid-cols-[100px_1fr] rounded-lg bg-slate-50 p-4 border border-slate-100">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-700">Ảnh</label>
                  <ImageUploadBox value={variant.mediaIds?.[0]} onChange={(url) => setVariant((current) => ({ ...current, mediaIds: [url] }))} className="w-full aspect-square" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Mã SKU (Mặc định)"><input value={variant.sku} onChange={(event) => setVariant({ ...variant, sku: event.target.value })} className={inputClassName()} placeholder="Tự sinh nếu để trống" /></Field>
                  <Field label="Mã vạch"><input value={variant.barcode || ""} onChange={(event) => setVariant((current) => ({ ...current, barcode: event.target.value }))} className={inputClassName()} placeholder="Mã vạch sản phẩm" /></Field>
                  <Field label="Tên biến thể"><input value={variant.displayName || ""} onChange={(event) => setVariant((current) => ({ ...current, displayName: event.target.value }))} className={inputClassName()} placeholder="Tên hiển thị (Tùy chọn)" /></Field>
                  <Field label="Giá bán"><NumberInput value={variant.sellingPrice || 0} onChange={(value) => setVariant((current) => ({ ...current, sellingPrice: value }))} className={inputClassName()} placeholder="Nhập giá bán" /></Field>
                  <Field label="Theo dõi kho"><select disabled={form.productType === "service"} value={form.productType === "service" ? "none" : variant.trackingMode} onChange={(event) => setVariant((current) => ({ ...current, trackingMode: event.target.value as ProductTrackingMode }))} className={inputClassName("disabled:bg-slate-100")}><option value="quantity">Số lượng</option><option value="lot">Theo lô</option><option value="serial">Theo số sê-ri/IMEI</option><option value="none">Không theo dõi</option></select></Field>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Khối 2 (Chỉnh sửa): Quản lý SKU */}
      {isEditing && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 lg:flex-row lg:items-center lg:justify-between">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">2</span>
              Mã SKU / Biến thể ({product!.variants.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onVariantAction(product!, "bulk-create")} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-50 border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100"><PackagePlus className="h-3.5 w-3.5" />Tạo nhanh nhiều SKU</button>
              <button type="button" onClick={() => onVariantAction(product!, "single")} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" />Thêm một SKU</button>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={variantQuery} onChange={(event) => setVariantQuery(event.target.value)} className={`${inputClassName("py-2 text-xs")} pl-9 shadow-sm`} placeholder="Tìm mã SKU, tên biến thể..." />
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium bg-slate-100 px-2 py-1 rounded-md">{selectedVariantIds.length} đã chọn</span>
              {selectedVariantIds.length > 0 && (
                <>
                  <button type="button" onClick={() => onVariantAction(product!, "bulk-edit", selectedVariantIds)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-medium hover:bg-slate-50 shadow-sm text-slate-700"><Pencil className="h-3.5 w-3.5" />Sửa hàng loạt</button>
                  <button type="button" onClick={() => setDeleteVariantIds(selectedVariantIds)} className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 font-medium text-rose-700 hover:bg-rose-50 shadow-sm"><Trash2 className="h-3.5 w-3.5" />Xóa</button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm mt-3">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    <button type="button" onClick={toggleVisibleVariants} className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 transition-colors" title={allVisibleSelected ? "Bỏ chọn các dòng đang hiển thị" : "Chọn các dòng đang hiển thị"}>{allVisibleSelected ? <Check className="h-4 w-4 text-cyan-700" /> : <Square className="h-4 w-4 text-slate-400" />}</button>
                  </th>
                  <th className="px-3 py-2.5 w-[50px]">Ảnh</th>
                  <th className="px-3 py-2.5">Mã SKU</th>
                  <th className="px-3 py-2.5">Tên biến thể</th>
                  <th className="px-3 py-2.5">Giá bán</th>
                  <th className="px-3 py-2.5">Theo dõi kho</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                  <th className="px-3 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleVariants.length === 0 ? <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500 bg-slate-50/50">Không tìm thấy SKU nào phù hợp.</td></tr> : visibleVariants.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5 text-center"><input type="checkbox" className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" checked={selectedVariantIds.includes(item._id)} onChange={() => setSelectedVariantIds((current) => current.includes(item._id) ? current.filter((id) => id !== item._id) : [...current, item._id])} aria-label={`Chọn ${item.sku}`} /></td>
                    <td className="px-3 py-2.5"><ImageUploadBox value={variantImages[item._id] ?? item.mediaIds?.[0]} onChange={(url) => void updateVariantImage(item, url)} className="h-10 w-10 !rounded-md" /></td>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs font-semibold text-slate-700">{item.sku}</div>
                      <div className="mt-0.5 font-sans text-[11px] text-slate-400">{item.barcode || "Chưa có mã vạch"}</div>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{item.displayName || <span className="text-slate-400 font-normal italic">Mặc định</span>}</td>
                    <td className="px-3 py-2.5 font-semibold text-cyan-700">{pricesByVariant[item._id] ? `${pricesByVariant[item._id].toLocaleString("vi-VN")} ₫` : <span className="font-normal text-rose-500">Chưa có giá</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500"><span className="bg-slate-100 px-2 py-1 rounded text-slate-600">{trackingLabels[item.trackingMode]}</span></td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${item.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : item.status === "inactive" ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                        {item.status === "active" ? "Đang dùng" : item.status === "inactive" ? "Ngừng dùng" : "Ngừng bán"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button type="button" onClick={() => onVariantAction(product!, "edit", undefined, { ...item, sellingPrice: pricesByVariant[item._id] || 0 } as any)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-cyan-700 transition-colors" title="Sửa SKU"><Pencil className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Khối 3: Thông tin mở rộng */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">{isEditing ? "3" : "3"}</span>
          Thông tin mở rộng
        </h4>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mô tả ngắn"><input value={form.shortDescription} onChange={(event) => setField("shortDescription", event.target.value)} className={inputClassName()} placeholder="Tóm tắt tính năng chính" /></Field>
          <Field label="Nhà sản xuất"><input value={form.manufacturer} onChange={(event) => setField("manufacturer", event.target.value)} className={inputClassName()} /></Field>
          <Field label="Xuất xứ"><input value={form.countryOfOrigin} onChange={(event) => setField("countryOfOrigin", event.target.value)} className={inputClassName()} /></Field>
          <Field label="Nhóm thuế"><input value={form.taxCategory} onChange={(event) => setField("taxCategory", event.target.value)} className={inputClassName()} /></Field>
        </div>
        <Field label="Mô tả chi tiết">
          <textarea rows={3} value={form.description} onChange={(event) => setField("description", event.target.value)} className={inputClassName("resize-y font-sans")} placeholder="Chi tiết sản phẩm..." />
        </Field>
      </div>

      {/* Sticky Footer */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-8 flex justify-end gap-3 rounded-b-lg border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
        <button type="button" disabled={submitting} onClick={onClose} className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200">
          Hủy
        </button>
        <button type="submit" disabled={submitting} className="rounded-md bg-cyan-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed">
          {submitting ? "Đang lưu..." : (isEditing ? "Lưu thay đổi" : "Tạo sản phẩm")}
        </button>
      </div>
    </form>
  </Modal><ConfirmDialog isOpen={Boolean(deleteVariantIds)} title="Xóa SKU đã chọn?" description={`Chỉ xóa được ${deleteVariantIds?.length || 0} SKU chưa có tồn kho hoặc lịch sử giao dịch. Thao tác này không thể hoàn tác.`} confirmLabel="Xóa SKU" tone="danger" isSubmitting={deletingVariants} onClose={() => !deletingVariants && setDeleteVariantIds(null)} onConfirm={confirmDeleteVariants} /></>;
}

function VariantModal({ product, variant: initialVariant, onClose, onSaved }: { product: CatalogProductDetail; variant?: ProductVariant; onClose: () => void; onSaved: () => Promise<void> }) {
  const [variant, setVariant] = useState<VariantInput>(() => initialVariant ? { ...initialVariant, barcode: initialVariant.barcode || "", displayName: initialVariant.displayName || "", mediaIds: initialVariant.mediaIds || [] } : emptyVariant(product.baseUnitCode, product.productType));
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(initialVariant);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const generatedSku = variant.sku.trim() || `${product.productCode || "SKU"}-${generateEAN13().slice(6)}`;
      const payload = { ...variant, sku: generatedSku, trackingMode: product.productType === "service" ? "none" : variant.trackingMode };
      if (initialVariant) {
        const { sellingPrice: _sellingPrice, _id: _id, productId: _productId, companyCode: _companyCode, createdAt: _createdAt, updatedAt: _updatedAt, createdBy: _createdBy, updatedBy: _updatedBy, ...update } = payload as any;
        await productCatalogService.updateVariant(initialVariant._id, update);
        await productCatalogService.upsertPrice(initialVariant._id, Number(variant.sellingPrice || 0));
        toast.success("Đã cập nhật SKU.");
      } else {
        const created = await productCatalogService.createVariant(product._id, payload);
        await productCatalogService.upsertPrice(created._id, Number(variant.sellingPrice || 0));
        toast.success("Đã thêm mã SKU.");
      }
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, isEditing ? "Không thể cập nhật SKU." : "Không thể thêm mã SKU."));
    } finally {
      setSubmitting(false);
    }
  };
  return <Modal title={`${isEditing ? "Chỉnh sửa SKU" : "Thêm mã SKU"} cho ${product.name}`} onClose={onClose} stacked><form onSubmit={submit} className="space-y-4">
    <Field label="Giá bán"><NumberInput value={variant.sellingPrice || 0} onChange={(value) => setVariant((current) => ({ ...current, sellingPrice: value }))} className={inputClassName()} placeholder="Nhập giá bán" /></Field>
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-24">
         <label className="text-xs font-semibold text-slate-700 mb-1 block">Ảnh</label>
         <ImageUploadBox value={variant.mediaIds?.[0]} onChange={(url) => setVariant((current) => ({ ...current, mediaIds: [url] }))} className="w-full aspect-square" />
      </div>
      <div className="flex-grow space-y-4">
        <Field label="Mã SKU"><input value={variant.sku} onChange={(event) => setVariant((current) => ({ ...current, sku: event.target.value }))} className={inputClassName()} placeholder="Tự sinh nếu để trống" /></Field>
        <Field label="Mã vạch"><input value={variant.barcode || ""} onChange={(event) => setVariant((current) => ({ ...current, barcode: event.target.value }))} className={inputClassName()} /></Field>
      </div>
    </div>
    <Field label="Tên biến thể"><input value={variant.displayName || ""} onChange={(event) => setVariant((current) => ({ ...current, displayName: event.target.value }))} className={inputClassName()} /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Theo dõi kho"><select disabled={product.productType === "service"} value={product.productType === "service" ? "none" : variant.trackingMode} onChange={(event) => setVariant((current) => ({ ...current, trackingMode: event.target.value as ProductTrackingMode }))} className={inputClassName("disabled:bg-slate-100")}><option value="none">Không theo dõi</option><option value="quantity">Số lượng</option><option value="lot">Theo lô</option><option value="serial">Theo số sê-ri/IMEI</option></select></Field>
      <Field label="Trạng thái"><select value={variant.status} onChange={(event) => setVariant((current) => ({ ...current, status: event.target.value as VariantInput["status"] }))} className={inputClassName()}><option value="active">Đang dùng</option><option value="inactive">Ngừng dùng</option><option value="discontinued">Ngừng bán</option></select></Field>
      <Field label="Bảo hành nhà cung cấp (tháng)"><NumberInput value={variant.supplierWarrantyMonths || 0} onChange={(value) => setVariant((current) => ({ ...current, supplierWarrantyMonths: value }))} className={inputClassName()} placeholder="0" /></Field>
    </div>
    <ModalActions onClose={onClose} submitting={submitting} label={isEditing ? "Lưu thay đổi" : "Thêm mã SKU"} />
  </form></Modal>;
}

function BulkVariantModal({ product, mode, ids, onClose, onSaved }: { product: CatalogProductDetail; mode: "bulk-create" | "bulk-edit"; ids: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const isCreate = mode === "bulk-create";
  const [variants, setVariants] = useState<VariantInput[]>(() => isCreate ? [emptyVariant(product.baseUnitCode, product.productType)] : []);
  const [status, setStatus] = useState<VariantInput["status"] | "">("");
  const [trackingMode, setTrackingMode] = useState<ProductTrackingMode | "">("");
  const [submitting, setSubmitting] = useState(false);
  const updateVariant = (index: number, patch: Partial<VariantInput>) => setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant));
  const removeVariant = (index: number) => setVariants((current) => current.length > 1 ? current.filter((_, variantIndex) => variantIndex !== index) : current);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isCreate) {
        const payloads = variants.map((variant) => ({ ...variant, sku: variant.sku.trim() || `${product.productCode || "SKU"}-${generateEAN13().slice(6)}`, unitCode: product.baseUnitCode, trackingMode: product.productType === "service" ? "none" : variant.trackingMode }));
        const skuSet = new Set<string>();
        if (payloads.some((variant) => skuSet.has(variant.sku.toUpperCase()) || !skuSet.add(variant.sku.toUpperCase()))) throw new Error("SKU không được trùng trong danh sách.");
        const created = await productCatalogService.createVariants(product._id, payloads);
        await Promise.all(created.map((variant, index) => productCatalogService.upsertPrice(variant._id, Number(payloads[index].sellingPrice || 0))));
        toast.success(`Đã tạo ${payloads.length} SKU.`);
      } else {
        const changes: Partial<Pick<ProductVariant, "status" | "trackingMode">> = {};
        if (status) changes.status = status;
        if (product.productType !== "service" && trackingMode) changes.trackingMode = trackingMode;
        if (!Object.keys(changes).length) throw new Error("Chưa chọn nội dung cần cập nhật.");
        await productCatalogService.updateVariants(ids, changes);
        toast.success(`Đã cập nhật ${ids.length} SKU.`);
      }
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, isCreate ? "Không thể tạo nhanh SKU." : "Không thể sửa hàng loạt SKU."));
    } finally {
      setSubmitting(false);
    }
  };
  return <Modal title={isCreate ? `Tạo nhiều SKU cho ${product.name}` : `Sửa hàng loạt ${ids.length} SKU`} onClose={onClose} wide><form onSubmit={submit} className="space-y-5">{isCreate ? <><div className="flex items-center justify-between border-b border-slate-200 pb-3"><p className="text-sm text-slate-600">Mỗi SKU có thông tin riêng, giống form thêm một SKU.</p><button type="button" onClick={() => setVariants((current) => current.length < 500 ? [...current, emptyVariant(product.baseUnitCode, product.productType)] : current)} className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"><Plus className="h-4 w-4" />Thêm SKU</button></div><div className="space-y-4">{variants.map((variant, index) => <section key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-4 flex items-center justify-between"><h4 className="font-semibold text-slate-800">SKU {index + 1}</h4><button type="button" disabled={variants.length === 1} onClick={() => removeVariant(index)} className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40" title="Xóa SKU"><Trash2 className="h-4 w-4" /></button></div><div className="flex gap-4"><div className="w-24 shrink-0"><label className="mb-1 block text-xs font-semibold text-slate-700">Ảnh</label><ImageUploadBox value={variant.mediaIds?.[0]} onChange={(url) => updateVariant(index, { mediaIds: [url] })} className="aspect-square w-full" /></div><div className="grid flex-1 gap-4 sm:grid-cols-2"><Field label="Mã SKU"><input value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} className={inputClassName()} placeholder="Tự sinh nếu để trống" /></Field><Field label="Mã vạch"><input value={variant.barcode || ""} onChange={(event) => updateVariant(index, { barcode: event.target.value })} className={inputClassName()} /></Field><Field label="Tên biến thể"><input value={variant.displayName || ""} onChange={(event) => updateVariant(index, { displayName: event.target.value })} className={inputClassName()} /></Field><Field label="Giá bán"><NumberInput value={variant.sellingPrice || 0} onChange={(value) => updateVariant(index, { sellingPrice: value })} className={inputClassName()} placeholder="Nhập giá bán" /></Field><Field label="Theo dõi kho"><select disabled={product.productType === "service"} value={product.productType === "service" ? "none" : variant.trackingMode} onChange={(event) => updateVariant(index, { trackingMode: event.target.value as ProductTrackingMode })} className={inputClassName("disabled:bg-slate-100")}><option value="none">Không theo dõi</option><option value="quantity">Số lượng</option><option value="lot">Theo lô</option><option value="serial">Theo số sê-ri/IMEI</option></select></Field><Field label="Trạng thái"><select value={variant.status} onChange={(event) => updateVariant(index, { status: event.target.value as VariantInput["status"] })} className={inputClassName()}><option value="active">Đang dùng</option><option value="inactive">Ngừng dùng</option><option value="discontinued">Ngừng bán</option></select></Field><Field label="Bảo hành nhà cung cấp (tháng)"><NumberInput value={variant.supplierWarrantyMonths || 0} onChange={(value) => updateVariant(index, { supplierWarrantyMonths: value })} className={inputClassName()} placeholder="0" /></Field></div></div></section>)}</div></> : <><p className="text-sm text-slate-600">Các SKU đã chọn: <strong>{ids.length}</strong>. Chọn thông tin chung muốn áp dụng.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Trạng thái"><select value={status} onChange={(event) => setStatus(event.target.value as VariantInput["status"])} className={inputClassName()}><option value="">Giữ nguyên</option><option value="active">Đang dùng</option><option value="inactive">Ngừng dùng</option><option value="discontinued">Ngừng bán</option></select></Field><Field label="Theo dõi kho"><select disabled={product.productType === "service"} value={product.productType === "service" ? "none" : trackingMode || ""} onChange={(event) => setTrackingMode(event.target.value as ProductTrackingMode)} className={inputClassName("disabled:bg-slate-100")}><option value="">Giữ nguyên</option><option value="none">Không theo dõi</option><option value="quantity">Số lượng</option><option value="lot">Theo lô</option><option value="serial">Theo số sê-ri/IMEI</option></select></Field></div></>}<ModalActions onClose={onClose} submitting={submitting} label={isCreate ? "Tạo các SKU" : "Lưu thay đổi"} /></form></Modal>;
}

function CatalogSetupModal({ kind, items, onClose, onSaved }: { kind: ProductResourceKind | "templates"; items: Array<ProductResource | ProductTemplate>; onClose: () => void; onSaved: () => Promise<void> }) {
  const pageSize = 8;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [unitCategory, setUnitCategory] = useState("count");
  const [productType, setProductType] = useState<ProductCatalogType>("physical");
  const [fields, setFields] = useState<ProductTemplateField[]>([{ code: "SPEC", label: "Thông số", type: "text", required: false, options: [] }]);
  const [submitting, setSubmitting] = useState(false);
  const isTemplate = kind === "templates";
  const title = isTemplate ? "Quản lý mẫu sản phẩm" : `Quản lý ${kind === "categories" ? "danh mục" : kind === "brands" ? "thương hiệu" : kind === "units" ? "đơn vị tính" : "thuộc tính"}`;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setStatus("active");
    setUnitCategory("count");
    setProductType("physical");
    setFields([{ code: "SPEC", label: "Thông số", type: "text", required: false, options: [] }]);
  };

  const startEdit = (item: ProductResource | ProductTemplate) => {
    setEditingId(item._id);
    setName(item.name);
    setStatus(item.status);
    if (isTemplate) {
      const template = item as ProductTemplate;
      setProductType(template.productType);
      setFields(template.fields);
    } else if (kind === "units") {
      setUnitCategory((item as ProductResource).category || "count");
    }
  };

  const updateField = (index: number, patch: Partial<ProductTemplateField>) => setFields((current) => current.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field));
  const canDelete = kind === "categories" || kind === "brands";
  const deleteItem = async (item: ProductResource | ProductTemplate) => {
    if (!canDelete || !window.confirm(`Xóa ${kind === "categories" ? "danh mục" : "thương hiệu"} “${item.name}”?`)) return;
    setSubmitting(true);
    try {
      await productCatalogService.deleteResource(kind, item._id);
      if (editingId === item._id) resetForm();
      toast.success("Đã xóa dữ liệu dùng chung.");
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa dữ liệu dùng chung."));
    } finally {
      setSubmitting(false);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isTemplate) {
        const input = { name, fields, status };
        if (editingId) await productCatalogService.updateTemplate(editingId, input);
        else await productCatalogService.createTemplate({ name, productType, fields });
      } else {
        const input = kind === "units" ? { name, status, category: unitCategory, decimalPlaces: 0 } : { name, status };
        if (editingId) await productCatalogService.updateResource(kind, editingId, input);
        else await productCatalogService.createResource(kind, input);
      }
      toast.success(editingId ? "Đã cập nhật dữ liệu dùng chung." : "Đã tạo dữ liệu dùng chung. Mã được sinh tự động.");
      resetForm();
      setPage(1);
      await onSaved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu dữ liệu dùng chung."));
    } finally {
      setSubmitting(false);
    }
  };

  return <Modal title={title} onClose={onClose} wide>
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-slate-900">{editingId ? "Chỉnh sửa" : "Tạo mới"}</h4>{editingId && <span className="text-xs text-slate-500">Mã được giữ nguyên sau khi tạo.</span>}</div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Tên"><input required value={name} onChange={(event) => setName(event.target.value)} className={inputClassName()} autoFocus /></Field><Field label="Trạng thái"><select value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")} className={inputClassName()}><option value="active">Đang dùng</option><option value="inactive">Ngừng dùng</option></select></Field></div>
        {kind === "units" && <Field label="Nhóm đơn vị"><select value={unitCategory} onChange={(event) => setUnitCategory(event.target.value)} className={inputClassName()}>{Object.entries(unitCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>}
        {isTemplate && <><Field label="Loại sản phẩm"><select disabled={Boolean(editingId)} value={productType} onChange={(event) => setProductType(event.target.value as ProductCatalogType)} className={inputClassName("disabled:bg-slate-100")} >{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><div className="border-t border-slate-200 pt-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-slate-800">Trường thông tin</span><button type="button" onClick={() => setFields((current) => [...current, { code: "", label: "", type: "text", required: false, options: [] }])} className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700"><Plus className="h-3.5 w-3.5" />Thêm trường</button></div>{fields.map((field, index) => <div key={`${field.code}-${index}`} className="mb-3 border-b border-slate-100 pb-3"><div className="grid grid-cols-[1fr_1fr_110px_auto] gap-2"><input required placeholder="Mã trường" value={field.code} onChange={(event) => updateField(index, { code: event.target.value })} className={inputClassName()} /><input required placeholder="Nhãn" value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} className={inputClassName()} /><select value={field.type} onChange={(event) => updateField(index, { type: event.target.value as ProductTemplateField["type"] })} className={inputClassName()}><option value="text">Văn bản</option><option value="number">Số</option><option value="boolean">Đúng/sai</option><option value="select">Chọn một</option><option value="multi-select">Chọn nhiều</option></select><button type="button" disabled={fields.length === 1} onClick={() => setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index))} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40" title="Xóa trường"><X className="h-4 w-4" /></button></div><div className="mt-2 flex items-center gap-3"><input value={field.options.join(", ")} onChange={(event) => updateField(index, { options: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} className={inputClassName("text-xs")} placeholder="Lựa chọn, ngăn cách dấu phẩy (nếu có)" /><label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={field.required} onChange={(event) => updateField(index, { required: event.target.checked })} />Bắt buộc</label></div></div>)}</div></>}
        <ModalActions onClose={onClose} submitting={submitting} label={editingId ? "Lưu thay đổi" : "Tạo"} />
      </form>

      <div className="border-y border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2"><span className="text-sm font-semibold text-slate-800">Danh sách đã khai báo ({items.length})</span></div>
        {items.length === 0 ? <p className="px-3 py-5 text-sm text-slate-500">Chưa có dữ liệu.</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-white text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 font-medium">Mã tự động</th><th className="px-3 py-2 font-medium">Tên</th>{isTemplate && <th className="px-3 py-2 font-medium">Loại</th>}<th className="px-3 py-2 font-medium">Trạng thái</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-slate-100">{pageItems.map((item) => <tr key={item._id}><td className="px-3 py-2 font-mono text-xs text-slate-500">{item.code}</td><td className="px-3 py-2 text-slate-800">{item.name}</td>{isTemplate && <td className="px-3 py-2 text-slate-600">{typeLabels[(item as ProductTemplate).productType]}</td>}<td className="px-3 py-2 text-slate-600">{item.status === "active" ? "Đang dùng" : "Ngừng dùng"}</td><td className="px-3 py-2 text-right"><button type="button" onClick={() => startEdit(item)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Chỉnh sửa"><Pencil className="h-3.5 w-3.5" /></button>{canDelete && <button type="button" disabled={submitting} onClick={() => void deleteItem(item)} className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40" title={`Xóa ${kind === "categories" ? "danh mục" : "thương hiệu"}`}><Trash2 className="h-3.5 w-3.5" /></button>}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-200 px-3 py-2"><span className="text-xs text-slate-500">Hiển thị {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, items.length)} / {items.length}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" title="Trang trước" aria-label="Trang trước"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-16 text-center text-xs text-slate-600">Trang {currentPage}/{totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" title="Trang sau" aria-label="Trang sau"><ChevronRight className="h-4 w-4" /></button></div></div></>}
      </div>
    </div>
  </Modal>;
}

function TemplateField({ field, value, onChange }: { field: ProductTemplateField; value: string; onChange: (value: string) => void }) {
  if (field.type === "select") return <Field label={`${field.label}${field.required ? " *" : ""}`}><select required={field.required} value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()}><option value="">Chọn</option>{field.options.map((option) => <option key={option}>{option}</option>)}</select></Field>;
  if (field.type === "boolean") return <Field label={`${field.label}${field.required ? " *" : ""}`}><select required={field.required} value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()}><option value="">Chọn</option><option value="true">Có</option><option value="false">Không</option></select></Field>;
  return <Field label={`${field.label}${field.required ? " *" : ""}`}><input required={field.required} type={field.type === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()} placeholder={field.type === "multi-select" ? "Ngăn cách bằng dấu phẩy" : undefined} /></Field>;
}

function Modal({ title, onClose, children, wide = false, stacked = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; stacked?: boolean }) { return <div className={`fixed inset-0 ${stacked || title.includes("SKU") ? "z-[60]" : "z-50"} flex items-center justify-center bg-slate-950/35 p-4`}><div role="dialog" aria-modal="true" className={`max-h-[92vh] w-full overflow-y-auto rounded-lg bg-white shadow-xl ${wide ? "max-w-5xl" : "max-w-xl"}`}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><h3 className="text-base font-semibold text-slate-900">{title}</h3><button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="Đóng"><X className="h-4 w-4" /></button></div><div className="p-5">{children}</div></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5"><span className="text-xs font-medium text-slate-600">{label}</span>{children}</label>; }
function ModalActions({ onClose, submitting, label }: { onClose: () => void; submitting: boolean; label: string }) { return <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" disabled={submitting} onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Hủy</button><button type="submit" disabled={submitting} className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">{submitting ? "Đang lưu..." : label}</button></div>; }
