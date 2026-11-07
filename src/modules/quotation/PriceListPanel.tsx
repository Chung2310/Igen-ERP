import { hasQuotationCapability } from "./api";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { api, apiUploadWithProgress, formatDate, formatMoney } from "./api";
import CatalogProductDialog from "./CatalogProductDialog";
import QuotationEmptyIllustration from "./QuotationEmptyIllustration";
import { loadCatalogProducts } from "./catalog-api";
import CatalogBulkDialog from "./CatalogBulkDialog";
import { catalogActionLabels, type CatalogAction } from "./catalog-actions";
import FilePreview, { type PreviewFile } from "./FilePreview";
import ThemedSelect from "./ThemedSelect";

import type { CatalogItem } from "./types";
import type { Notify } from "./Feedback";
import { TaskProgress, type TaskProgressState } from "./Feedback";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";

interface StoredPriceList { _id: string; originalFilename: string; bytes: number; updatedAt: string; productCount?: number; skippedRows?: number }
type ImportColumnRole = "sku" | "name" | "unit" | "price" | "currency" | "description" | "effectiveFrom" | "effectiveTo" | "attribute" | "ignore";
interface ImportHeaderRow { row: number; cells: string[]; roles: ImportColumnRole[] }
interface ImportPreviewSheet { sheet: string; headerRow: number; headerRows: ImportHeaderRow[]; rows: Array<{ sheet: string; row: number; cells: string[] }> }
interface PendingImportSheet extends ImportPreviewSheet { included: boolean; roles: ImportColumnRole[] }
interface PendingImport { file: File; sheets: PendingImportSheet[] }

const columnRoleLabels: Array<{ value: ImportColumnRole; label: string }> = [
  { value: "ignore", label: "Bỏ qua" }, { value: "sku", label: "Mã hàng" }, { value: "name", label: "Tên sản phẩm" },
  { value: "unit", label: "Đơn vị" }, { value: "price", label: "Đơn giá" }, { value: "currency", label: "Tiền tệ" },
  { value: "description", label: "Quy cách / mô tả" }, { value: "effectiveFrom", label: "Hiệu lực từ" },
  { value: "effectiveTo", label: "Hiệu lực đến" }, { value: "attribute", label: "Thuộc tính riêng" },
];

function ReviewSelect({ value, options, disabled, label, onChange }: { value: string; options: Array<{ value: string; label: string }>; disabled: boolean; label: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    (root.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]') ?? root.current?.querySelector<HTMLButtonElement>('[role="option"]'))?.focus();
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const toggle = () => {
    if (!open) {
      const bounds = root.current?.getBoundingClientRect();
      setOpenAbove(Boolean(bounds && window.innerHeight - bounds.bottom < 280 && bounds.top > 300));
    }
    setOpen((current) => !current);
  };

  return <div className={`price-list-review-select ${open ? "is-open" : ""} ${openAbove ? "opens-above" : ""}`} ref={root} onKeyDown={(event) => {
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const items = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="price-list-review-select-trigger" disabled={disabled || options.length === 0} aria-label={`${label}: ${selected?.label ?? ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={toggle} onKeyDown={(event) => { if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); toggle(); } }}><span>{selected?.label ?? ""}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>
    {open && <div className="price-list-review-select-menu" role="listbox" aria-label={label}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}>{option.label}</button>)}</div>}
  </div>;
}

function isSheetMappingValid(sheet: PendingImportSheet) {
  const required = sheet.roles.filter((role) => role === "name" || role === "price");
  const core = sheet.roles.filter((role) => role !== "attribute" && role !== "ignore");
  return sheet.included && required.filter((role) => role === "name").length === 1 && required.filter((role) => role === "price").length === 1 && new Set(core).size === core.length && sheet.roles.filter((role) => role === "attribute").length <= 50;
}

type ProductStatusKey = "all" | "active" | "upcoming" | "expired" | "inactive" | "deleted";
type SortOption = "default" | "name_asc" | "name_desc" | "price_asc" | "price_desc";

function productStatusKey(item: CatalogItem, today: string): ProductStatusKey {
  if (item.deletedAt) return "deleted";
  if (!item.active) return "inactive";
  if (item.effectiveFrom && item.effectiveFrom > today) return "upcoming";
  if (item.effectiveTo && item.effectiveTo < today) return "expired";
  return "active";
}

function productStatus(item: CatalogItem, today: string) {
  const key = productStatusKey(item, today);
  if (key === "deleted") return { label: "Đã xóa", className: "inactive" };
  if (key === "inactive") return { label: "Ngừng áp dụng", className: "inactive" };
  if (key === "upcoming") return { label: "Chưa hiệu lực", className: "upcoming" };
  if (key === "expired") return { label: "Hết hiệu lực", className: "expired" };
  return { label: "Đang áp dụng", className: "active" };
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function ClearIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SortIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="m21 8-4-4-4 4" />
      <path d="M17 4v16" />
    </svg>
  );
}

function FilterResetIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>;
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);
    if (parts.length === 1) return <>{text}</>;
    return (
      <>
        {parts.map((part, i) =>
          part.toLocaleLowerCase("vi") === trimmed.toLocaleLowerCase("vi") ? (
            <mark key={i} className="search-highlight">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

export default function PriceListPanel({ onToast }: { onToast: Notify }) {
  const [files, setFiles] = useState<StoredPriceList[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskProgress, setTaskProgress] = useState<TaskProgressState | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatusKey>("all");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogItem | null>(null);
  const [productMode, setProductMode] = useState<"create" | "edit" | "duplicate">("edit");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ action: CatalogAction; items: CatalogItem[] } | null>(null);
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const canManage = hasQuotationCapability("quotation-price-book:manage");
  const openCreate = () => { setProductMode("create"); setEditingProduct({ _id: "", sku: "", name: "", description: "", unit: "cái", price: 0, currency: "VND", active: true }); };
  const openDuplicate = (item: CatalogItem) => { setProductMode("duplicate"); setEditingProduct({ ...item, sku: "", active: false, effectiveFrom: undefined, effectiveTo: undefined }); };
  const toggleSelection = (id: string, checked: boolean) => setSelectedIds(current => {
    const next = new Set(current); if (checked && next.size < 200) next.add(id); else if (!checked) next.delete(id); return next;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<ProductStatusKey, number> = {
      all: products.filter(item => !item.deletedAt).length,
      deleted: 0,
      active: 0,
      upcoming: 0,
      expired: 0,
      inactive: 0,
    };
    for (const item of products) {
      const key = productStatusKey(item, today);
      counts[key]++;
    }
    return counts;
  }, [products, today]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(item => statusFilter === "deleted" ? Boolean(item.deletedAt) : !item.deletedAt);

    if (statusFilter !== "all") {
      result = result.filter((item) => productStatusKey(item, today) === statusFilter);
    }

    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    if (normalizedQuery) {
      result = result.filter((item) => {
        const fullContent = `${item.name} ${item.sku} ${item.description || ""} ${item.unit} ${Object.entries(item.attributes ?? {}).flat().join(" ")}`.toLocaleLowerCase("vi");
        return fullContent.includes(normalizedQuery);
      });
    }

    if (sortBy === "name_asc") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    } else if (sortBy === "name_desc") {
      result = [...result].sort((a, b) => b.name.localeCompare(a.name, "vi"));
    } else if (sortBy === "price_asc") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      result = [...result].sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, query, statusFilter, sortBy, today]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [query, statusFilter, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const firstVisibleProduct = filteredProducts.length ? (visiblePage - 1) * pageSize + 1 : 0;
  const lastVisibleProduct = Math.min(visiblePage * pageSize, filteredProducts.length);
  const visibleProducts = useMemo(
    () => filteredProducts.slice((visiblePage - 1) * pageSize, visiblePage * pageSize),
    [filteredProducts, pageSize, visiblePage],
  );
  const paginationItems = useMemo<Array<number | "ellipsis-left" | "ellipsis-right">>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const start = Math.max(2, Math.min(visiblePage - 1, totalPages - 3));
    const end = Math.min(totalPages - 1, Math.max(visiblePage + 1, start + 2));
    const pages: Array<number | "ellipsis-left" | "ellipsis-right"> = [1];
    if (start > 2) pages.push("ellipsis-left");
    for (let page = start; page <= end; page++) pages.push(page);
    if (end < totalPages - 1) pages.push("ellipsis-right");
    pages.push(totalPages);
    return pages;
  }, [totalPages, visiblePage]);

  const hasActiveFilters = Boolean(query.trim()) || statusFilter !== "all" || sortBy !== "default";

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setSortBy("default");
    searchInputRef.current?.focus();
  };

  const exportExcel = async (selectionOnly = false) => {
    const exportedProducts = selectionOnly ? filteredProducts.filter(item => selectedIds.has(item._id)) : filteredProducts;
    if (exporting || !exportedProducts.length) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const attributeKeys = [...new Set(exportedProducts.flatMap((item) => Object.keys(item.attributes ?? {})))];
      const attributeHeaders = attributeKeys.map((key) => `Thuộc tính: ${key}`);
      const headers = ["Mã hàng", "Tên sản phẩm", "Quy cách / mô tả", "Đơn vị", "Đơn giá", "Tiền tệ", "Trạng thái", "Hiệu lực từ", "Hiệu lực đến", ...attributeHeaders];
      const rows = exportedProducts.map((item) => ({
        "Mã hàng": item.sku,
        "Tên sản phẩm": item.name,
        "Quy cách / mô tả": item.description ?? "",
        "Đơn vị": item.unit,
        "Đơn giá": item.price,
        "Tiền tệ": item.currency,
        "Trạng thái": productStatus(item, today).label,
        "Hiệu lực từ": item.effectiveFrom ?? "",
        "Hiệu lực đến": item.effectiveTo ?? "",
        ...Object.fromEntries(attributeKeys.map((key) => [`Thuộc tính: ${key}`, item.attributes?.[key] ?? ""])),
      }));
      const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
      const columnSamples = rows.slice(0, 200);
      sheet["!cols"] = headers.map((header) => {
        let width = header.length;
        for (const row of columnSamples) width = Math.max(width, String(row[header as keyof typeof row] ?? "").length);
        return { wch: Math.min(width + 2, 50) };
      });
      if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Bảng giá");
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(workbook, `bang-gia-${date}.xlsx`);
      onToast(`Đã xuất ${exportedProducts.length} sản phẩm ra Excel.`, "success");
    } catch (cause) {
      onToast(cause instanceof Error ? cause.message : "Không thể xuất bảng giá ra Excel.", "error");
    } finally {
      setExporting(false);
    }
  };

  const statusTabs: Array<{ key: ProductStatusKey; label: string; count: number }> = [
    { key: "all", label: "Tất cả", count: statusCounts.all },
    { key: "active", label: "Đang áp dụng", count: statusCounts.active },
    { key: "upcoming", label: "Chưa hiệu lực", count: statusCounts.upcoming },
    { key: "expired", label: "Hết hiệu lực", count: statusCounts.expired },
    { key: "inactive", label: "Ngừng áp dụng", count: statusCounts.inactive },
    { key: "deleted", label: "Đã xóa", count: statusCounts.deleted },
  ];

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ files: StoredPriceList[] }>("/api/price-list"),
      loadCatalogProducts(true),
    ]).then(([priceLists, catalog]) => {
      if (!active) return;
      setFiles(priceLists.files);
      setProducts(catalog.items);
      setLoadError("");
    }).catch((cause) => { if (active) setLoadError(cause instanceof Error ? cause.message : "Không thể tải bảng giá."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;
    setBusy(true);
    const errors: string[] = [];
    const previews: PendingImport[] = [];
    try {
      for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex++) {
        const selected = selectedFiles[fileIndex]!;
        if (selected.size > 5 * 1024 * 1024) { errors.push(`${selected.name}: File không được vượt quá 5 MB.`); continue; }
        try {
          setTaskProgress({ label: `Đang tải file ${fileIndex + 1} / ${selectedFiles.length}`, detail: selected.name });
          const result = await apiUploadWithProgress<{ preview: { sheets: ImportPreviewSheet[] } }>(
            "/api/price-list/preview",
            selected,
            { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(selected.name) },
            (progress) => setTaskProgress(progress >= 100
              ? { label: `Đang đọc bảng giá ${fileIndex + 1} / ${selectedFiles.length}`, detail: selected.name }
              : { label: `Đang tải file ${fileIndex + 1} / ${selectedFiles.length}`, progress, detail: selected.name }),
          );
          previews.push({
            file: selected, sheets: result.preview.sheets.map((sheet) => {
              const header = sheet.headerRows.find((row) => row.row === sheet.headerRow);
              const roles = header?.roles ?? [];
              return { ...sheet, roles, included: roles.includes("name") && roles.includes("price") };
            })
          });
        } catch (cause) { errors.push(`${selected.name}: ${cause instanceof Error ? cause.message : "Không đọc được file để xem trước."}`); }
      }
      setPendingImports(previews);
      if (errors.length) onToast(errors.join(" "), "error");
    }
    finally { setBusy(false); setTaskProgress(null); if (input.current) input.current.value = ""; }
  };

  const updatePendingSheet = (fileIndex: number, sheetName: string, update: (sheet: PendingImportSheet) => PendingImportSheet) => {
    setPendingImports((current) => current.map((pending, index) => index !== fileIndex ? pending : {
      ...pending,
      sheets: pending.sheets.map((sheet) => sheet.sheet === sheetName ? update(sheet) : sheet),
    }));
  };

  const confirmImports = async () => {
    if (!pendingImports.length) return;
    setBusy(true);
    const errors: string[] = [];
    const failed: PendingImport[] = [];
    let savedCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    try {
      for (let importIndex = 0; importIndex < pendingImports.length; importIndex++) {
        const pending = pendingImports[importIndex]!;
        const selectedSheets = pending.sheets.filter((sheet) => sheet.included);
        if (!selectedSheets.length || selectedSheets.some((sheet) => !isSheetMappingValid(sheet))) {
          errors.push(`${pending.file.name}: Hãy chọn sheet và ghép đúng một cột tên sản phẩm cùng một cột đơn giá.`);
          failed.push(pending);
          continue;
        }
        const mappings = selectedSheets.map((sheet) => {
          return { sheet: sheet.sheet, headerRow: sheet.headerRow, roles: sheet.roles };
        });
        try {
          const headers = {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(pending.file.name),
            "X-Catalog-Import-Mapping": encodeURIComponent(JSON.stringify(mappings)),
          };
          setTaskProgress({ label: `Đang nhập bảng giá ${importIndex + 1} / ${pendingImports.length}`, detail: pending.file.name });
          const result = await apiUploadWithProgress<{ file: StoredPriceList; imported: { inserted: number; updated: number; skippedRows: number } }>(
            "/api/price-list",
            pending.file,
            headers,
            (progress) => setTaskProgress(progress >= 100
              ? { label: `Đang nhập bảng giá ${importIndex + 1} / ${pendingImports.length}`, detail: pending.file.name }
              : { label: `Đang tải bảng giá ${importIndex + 1} / ${pendingImports.length}`, progress, detail: pending.file.name }),
          );
          setFiles((current) => [result.file, ...current]);
          savedCount++;
          insertedCount += result.imported.inserted;
          updatedCount += result.imported.updated;
          skippedCount += result.imported.skippedRows;
        } catch (cause) {
          errors.push(`${pending.file.name}: ${cause instanceof Error ? cause.message : "Không thể nhập bảng giá."}`);
          failed.push(pending);
        }
      }
      setPendingImports(failed);
      const importedTotal = insertedCount + updatedCount;
      const summary = savedCount
        ? `Đã đọc ${savedCount} bảng giá, nhập ${importedTotal} sản phẩm (${insertedCount} mới, ${updatedCount} cập nhật)${skippedCount ? `; bỏ qua ${skippedCount} dòng` : ""}.`
        : "";
      if (savedCount) {
        try {
          const catalog = await loadCatalogProducts(true);
          setProducts(catalog.items);
          setSelectedIds(new Set());
        } catch (cause) {
          errors.push(`Đã nạp bảng giá nhưng không tải được danh sách sản phẩm: ${cause instanceof Error ? cause.message : "Vui lòng tải lại trang."}`);
        }
      }
      if (errors.length) onToast([summary, ...errors].filter(Boolean).join(" "), "error");
      else if (summary) onToast(summary, "success");
    } finally { setBusy(false); setTaskProgress(null); }
  };

  return <div className={`page-stack price-list-page ${!loading && products.length === 0 ? "is-empty" : ""}`}>
    <section className="page-heading-row price-list-heading">
      <div><div className="price-list-title-row"><h1>Bảng giá</h1>{!loading && <span className="price-list-total-badge">{statusCounts.all} sản phẩm</span>}</div></div>
      <div className="price-list-header-actions catalog-header-actions">
        <ErpRefreshButton className="price-list-refresh-button" loading={loading} onClick={() => { setLoading(true); setSelectedIds(new Set()); setReloadKey(key => key + 1); }} />
        {products.length > 0 && <button type="button" className="button price-list-export-button price-list-excel-button" disabled={loading || exporting || !filteredProducts.length} title={`Xuất ${filteredProducts.length} sản phẩm theo kết quả tìm kiếm và bộ lọc`} onClick={() => void exportExcel()}>{exporting ? "Đang xuất…" : "Xuất Excel"}</button>}
        <button type="button" className="button price-list-excel-button" disabled={!canManage || busy || loading || pendingImports.length > 0} onClick={() => input.current?.click()}>{busy ? "Đang đọc tài liệu…" : "Nhập Excel/CSV"}</button>
        <button type="button" className="button button-primary price-list-add-button" disabled={!canManage || busy || loading} title={canManage ? "Nhập sản phẩm trực tiếp" : "Cần quyền quản lý bảng giá"} onClick={openCreate}>Thêm sản phẩm</button>
      </div>
      <input ref={input} type="file" hidden multiple disabled={!hasQuotationCapability("quotation-price-book:manage") || (busy || pendingImports.length > 0)} accept=".csv,.xlsx,.xls" onChange={(event) => void upload(event)} />
    </section>
    {taskProgress && <TaskProgress {...taskProgress} />}
    {loadError && <p className="form-error" role="alert">{loadError} Hãy bấm Làm mới để tải lại.</p>}
    {pendingImports.length > 0 && <section className="content-card import-preview price-list-import-review">
      <div className="price-list-review-heading"><div><h2>Kiểm tra cột trước khi nhập</h2><p className="muted">Chọn tiêu đề và ghép các cột. Cột để thành “Thuộc tính riêng” sẽ được lưu theo đúng tên cột.</p></div><span className="pending-count">{pendingImports.length} file</span></div>
      <div className="price-list-review-files">{pendingImports.map((pending, fileIndex) => <article className="price-list-review-file" key={`${pending.file.name}-${fileIndex}`}>
        <h3>{pending.file.name}</h3>
        {pending.sheets.map((sheet) => {
          const selectedHeader = sheet.headerRows.find((row) => row.row === sheet.headerRow);
          const samples = sheet.rows.filter((row) => row.row > sheet.headerRow).slice(0, 2);
          return <section className="price-list-review-sheet" key={sheet.sheet}>
            <div className="price-list-sheet-heading">
              <label className="price-list-sheet-toggle"><input type="checkbox" checked={sheet.included} disabled={busy} onChange={(event) => updatePendingSheet(fileIndex, sheet.sheet, (current) => ({ ...current, included: event.target.checked }))} /><span>Nhập sheet <strong>{sheet.sheet}</strong></span></label>
              <div className="price-list-header-select"><span>Dòng tiêu đề</span><ReviewSelect value={String(sheet.headerRow)} disabled={busy || !sheet.headerRows.length} label="Dòng tiêu đề" onChange={(value) => updatePendingSheet(fileIndex, sheet.sheet, (current) => {
                const chosen = current.headerRows.find((row) => row.row === Number(value));
                if (!chosen) return current;
                return { ...current, headerRow: chosen.row, roles: chosen.roles, included: chosen.roles.includes("name") && chosen.roles.includes("price") };
              })} options={sheet.headerRows.map((row) => ({ value: String(row.row), label: `Dòng ${row.row}: ${row.cells.filter(Boolean).join(" · ").slice(0, 100)}` }))} /></div>
            </div>
            {selectedHeader && <div className="price-list-column-mapping">{selectedHeader.cells.map((header, columnIndex) => {
              const role = sheet.roles[columnIndex] ?? "ignore";
              if (!header.trim() && role === "ignore") return null;
              return <div className="price-list-column-row" key={`${columnIndex}-${header}`}><span title={header}>{header.trim() || `Cột ${columnIndex + 1}`}</span><ReviewSelect value={role} disabled={busy} label={header.trim() || `Cột ${columnIndex + 1}`} onChange={(selectedRole) => updatePendingSheet(fileIndex, sheet.sheet, (current) => ({ ...current, roles: current.roles.map((value, index) => index === columnIndex ? selectedRole as ImportColumnRole : value), included: current.included || selectedRole === "name" || selectedRole === "price" }))} options={columnRoleLabels} /></div>;
            })}</div>}
            {samples.length > 0 && selectedHeader && <div className="price-list-mapping-samples"><strong>Dữ liệu mẫu</strong>{samples.map((sample) => <p key={sample.row}>{sheet.roles.flatMap((role, index) => role === "ignore" ? [] : [`${selectedHeader.cells[index] || `Cột ${index + 1}`}: ${sample.cells[index] ?? ""}`]).filter((value) => !value.endsWith(": ")).join(" · ")}</p>)}</div>}
          </section>;
        })}
      </article>)}</div>
      <div className="preview-actions"><button type="button" className="button button-soft" disabled={busy} onClick={() => setPendingImports([])}>Hủy</button><button type="button" className="button button-primary" disabled={!hasQuotationCapability("quotation-price-book:manage") || (busy)} onClick={() => void confirmImports()}>{busy ? "Đang nhập…" : "Xác nhận và nhập"}</button></div>
    </section>}
    <section className="content-card list-card price-list-product-card">
      {(loading || products.length > 0) && <div className="price-list-toolbar-section">
        <div className="price-list-search-row">
          <div className="price-list-search-box">
            <span className="price-list-search-icon" aria-hidden="true"><SearchIcon size={16} /></span>
            <input
              ref={searchInputRef}
              type="text"
              className="price-list-search-input border-0 bg-transparent"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  searchInputRef.current?.blur();
                }
              }}
              placeholder="Tìm theo tên sản phẩm, mã SKU, quy cách, đơn vị..."
              aria-label="Tìm kiếm sản phẩm trong bảng giá"
            />
            {query ? (
              <button
                type="button"
                className="price-list-clear-btn"
                onClick={() => { setQuery(""); searchInputRef.current?.focus(); }}
                title="Xóa tìm kiếm (Esc)"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <ClearIcon size={14} />
              </button>
            ) : null}
          </div>

          <div className="price-list-sort-wrap">
            <label className="price-list-sort-label" htmlFor="price-list-sort-select">
              <SortIcon size={14} />
              <span className="sr-only">Sắp xếp:</span>
            </label>
            <ThemedSelect
              id="price-list-sort-select"
              label="Sắp xếp sản phẩm"
              value={sortBy}
              onChange={(next) => setSortBy(next as SortOption)}
              options={[
                { value: "default", label: "Sắp xếp: Mặc định" },
                { value: "name_asc", label: "Tên: A → Z" },
                { value: "name_desc", label: "Tên: Z → A" },
                { value: "price_asc", label: "Đơn giá: Thấp → Cao" },
                { value: "price_desc", label: "Đơn giá: Cao → Thấp" },
              ]}
            />
          </div>
        </div>

        <div className="price-list-filter-row">
          <div className="price-list-status-tabs" role="tablist" aria-label="Lọc theo trạng thái sản phẩm">
            {statusTabs.map((tab) => {
              const isSelected = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`price-list-status-tab ${isSelected ? "is-active" : ""}`}
                  onClick={() => setStatusFilter(tab.key)}
                >
                  <span className="tab-label">{tab.label}</span>
                  <span className="tab-count">{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="price-list-result-meta">
            <span className="row-count">
              {hasActiveFilters ? (
                <>Hiển thị <strong>{filteredProducts.length}</strong> / {products.length} sản phẩm</>
              ) : (
                <>Tổng số <strong>{products.length}</strong> sản phẩm</>
              )}
            </span>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="price-list-active-filters" aria-label="Bộ lọc đang áp dụng">
            <span className="active-filters-label">Đang lọc:</span>
            {query.trim() && (
              <span className="filter-chip">
                <span>Từ khóa: <em>"{query.trim()}"</em></span>
                <button type="button" onClick={() => setQuery("")} aria-label="Bỏ lọc từ khóa">×</button>
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="filter-chip">
                <span>Trạng thái: <strong>{statusTabs.find((t) => t.key === statusFilter)?.label}</strong></span>
                <button type="button" onClick={() => setStatusFilter("all")} aria-label="Bỏ lọc trạng thái">×</button>
              </span>
            )}
            {sortBy !== "default" && (
              <span className="filter-chip">
                <span>Sắp xếp: {sortBy === "name_asc" ? "A → Z" : sortBy === "name_desc" ? "Z → A" : sortBy === "price_asc" ? "Giá tăng dần" : "Giá giảm dần"}</span>
                <button type="button" onClick={() => setSortBy("default")} aria-label="Bỏ sắp xếp">×</button>
              </span>
            )}
            <button type="button" className="price-list-reset-btn" onClick={resetFilters}>
              <FilterResetIcon size={12} /> Đặt lại bộ lọc
            </button>
          </div>
        )}
      </div>}

      {loading ? (
        <div className="loading-state" role="status">Đang tải danh sách sản phẩm…</div>
      ) : products.length === 0 ? (
        <div className="empty-state price-list-empty-state setup-empty-state">
          <QuotationEmptyIllustration kind="product" />
          <h2>Chưa có sản phẩm báo giá</h2>
          <p>Thêm sản phẩm trực tiếp hoặc nhập danh mục từ file Excel/CSV.</p>
          <button type="button" className="button button-primary price-list-empty-cta" disabled={!canManage || busy} onClick={openCreate}>Thêm sản phẩm đầu tiên</button>
          <small>Hỗ trợ CSV, XLSX, XLS · Tối đa 5 MB mỗi file · Có thể chọn nhiều file</small>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state price-list-empty-search">
          <QuotationEmptyIllustration kind="search" />
          <h2>Không tìm thấy sản phẩm phù hợp</h2>
          <p>
            Không có kết quả nào khớp với {query.trim() ? <>từ khóa <strong>"{query.trim()}"</strong></> : "bộ lọc đã chọn"}.
          </p>
          <button type="button" className="button button-soft empty-reset-btn" onClick={resetFilters}>
            <FilterResetIcon size={14} /> Xóa bộ lọc tìm kiếm
          </button>
        </div>
      ) : (
        <>
        {canManage && selectedIds.size > 0 && <div className="catalog-selection-bar" role="region" aria-label="Thao tác sản phẩm đã chọn"><strong aria-live="polite">Đã chọn {selectedIds.size}/200 sản phẩm</strong>{(statusFilter === "deleted" ? ["restore"] : ["activate", "deactivate", "price", "delete"]).map(action => <button key={action} type="button" className="button button-soft button-compact" onClick={() => setBulk({ action: action as CatalogAction, items: products.filter(item => selectedIds.has(item._id)) })}>{catalogActionLabels[action as CatalogAction]}</button>)}<button type="button" className="button button-soft button-compact" disabled={exporting} onClick={() => void exportExcel(true)}>Xuất đã chọn</button><button type="button" className="text-button" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</button></div>}
        <div className="table-scroll" role="region" aria-label="Bảng giá sản phẩm, cuộn ngang để xem thêm cột" tabIndex={0}>
          <table className="data-table price-list-table">
            <colgroup>
              {canManage && <col className="price-list-col-select" />}
              <col className="price-list-col-product" />
              <col className="price-list-col-description" />
              <col className="price-list-col-unit" />
              <col className="price-list-col-price" />
              <col className="price-list-col-status" />
              <col className="price-list-col-actions" />
            </colgroup>
            <thead>
              <tr>
                {canManage && <th><input type="checkbox" aria-label="Chọn sản phẩm trang hiện tại" checked={visibleProducts.length > 0 && visibleProducts.every(item => selectedIds.has(item._id))} ref={node => { if (node) node.indeterminate = visibleProducts.some(item => selectedIds.has(item._id)) && !visibleProducts.every(item => selectedIds.has(item._id)); }} onChange={event => { const checked = event.target.checked; setSelectedIds(current => { const next = new Set(current); for (const item of visibleProducts) { if (checked && next.size < 200) next.add(item._id); else if (!checked) next.delete(item._id); } return next; }); }} /></th>}
                <th>Sản phẩm</th>
                <th>Quy cách / thông số</th>
                <th className="price-list-unit-heading">Đơn vị</th>
                <th className="price-list-price-heading">Đơn giá</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((item) => {
                const status = productStatus(item, today);
                return (
                  <tr key={item._id}>
                    {canManage && <td><input type="checkbox" aria-label={`Chọn ${item.sku}`} checked={selectedIds.has(item._id)} disabled={selectedIds.size >= 200 && !selectedIds.has(item._id)} onChange={event => toggleSelection(item._id, event.target.checked)} /></td>}
                    <td>
                      <strong title={item.name}>
                        <HighlightMatch text={item.name} query={query} />
                      </strong>
                      <span className="table-subtext" title={item.sku}>
                        <HighlightMatch text={item.sku} query={query} />
                      </span>
                    </td>
                    <td className="price-list-description">
                      <span className="price-list-description-text" title={item.description || undefined}>
                        {item.description ? <HighlightMatch text={item.description} query={query} /> : "—"}
                      </span>
                      {Boolean(Object.keys(item.attributes ?? {}).length) && (
                        <div className="price-list-attributes" title={Object.entries(item.attributes ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ")}>
                          {Object.entries(item.attributes ?? {}).map(([key, value], index) => (
                            <span key={key}>
                              {index > 0 ? " · " : null}<strong>{key}:</strong> <HighlightMatch text={value} query={query} />
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="price-list-unit">
                      <HighlightMatch text={item.unit} query={query} />
                    </td>
                    <td className="amount-cell">{formatMoney(item.price, item.currency)}</td>
                    <td>
                      <span className={`price-list-status ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="price-list-action">
                      {canManage ? <div className="catalog-row-actions">
                      {!item.deletedAt && <>
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => { setProductMode("edit"); setEditingProduct(item); }}
                      >
                        Sửa
                      </button>
                      </>}
                      <ThemedSelect label={`Thao tác ${item.sku}`} value="" options={[{ value: "", label: "Thao tác…" }, ...(item.deletedAt ? [{ value: "restore", label: "Khôi phục" }] : [{ value: "duplicate", label: "Nhân bản" }, { value: item.active ? "deactivate" : "activate", label: item.active ? "Ngừng áp dụng" : "Bật áp dụng" }, { value: "delete", label: "Xóa" }])]} onChange={action => { if (action === "duplicate") openDuplicate(item); else if (action) setBulk({ action: action as CatalogAction, items: [item] }); }} />
                      </div> : <span className="muted">Chỉ xem</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <nav className="price-list-pagination" aria-label="Phân trang danh sách sản phẩm">
          <div className="price-list-pagination-info">
            <span>Hiển thị <strong>{firstVisibleProduct}–{lastVisibleProduct}</strong> / {filteredProducts.length} sản phẩm</span>
            <label className="price-list-page-size">
              <span>Sản phẩm / trang</span>
              <select aria-label="Số sản phẩm mỗi trang" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
          <div className="price-list-pagination-controls" role="group" aria-label="Điều hướng trang">
            <button type="button" aria-label="Trang đầu" title="Trang đầu" disabled={visiblePage === 1} onClick={() => setCurrentPage(1)}>«</button>
            <button type="button" aria-label="Trang trước" title="Trang trước" disabled={visiblePage === 1} onClick={() => setCurrentPage(visiblePage - 1)}>‹</button>
            {paginationItems.map((item) => typeof item === "number" ? (
              <button key={item} type="button" aria-label={`Trang ${item}`} aria-current={item === visiblePage ? "page" : undefined} className={item === visiblePage ? "is-current" : ""} onClick={() => setCurrentPage(item)}>{item}</button>
            ) : <span key={item} className="price-list-pagination-ellipsis" aria-hidden="true">…</span>)}
            <button type="button" aria-label="Trang tiếp" title="Trang tiếp" disabled={visiblePage === totalPages} onClick={() => setCurrentPage(visiblePage + 1)}>›</button>
            <button type="button" aria-label="Trang cuối" title="Trang cuối" disabled={visiblePage === totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
          </div>
        </nav>
        </>
      )}
    </section>
    {files.length > 0 && <details className="content-card price-list-sources">
      <summary><span><strong>Tài liệu đã nạp</strong><small>File nguồn dùng để nhập danh mục</small></span><span className="row-count">{files.length} file</span></summary>
      <div className="price-list-source-list">{files.map((file) => <div className="price-list-source-row" key={file._id}>
        <div><strong>{file.originalFilename}</strong><span>{file.productCount === undefined ? "Đã lưu" : `${file.productCount} sản phẩm được đọc`} · {formatDate(file.updatedAt)}{file.skippedRows ? ` · bỏ qua ${file.skippedRows} dòng` : ""}</span></div>
        <button type="button" className="button button-soft" onClick={() => setPreview({ name: file.originalFilename, url: `/api/price-list/${file._id}/file` })}>Xem file</button>
      </div>)}</div>
    </details>}
    {products.length > 0 && <p className="catalog-note">CSV / XLSX / XLS · Tối đa 5 MB mỗi file · Có thể chọn nhiều file cùng lúc.</p>}
    <FilePreview file={preview} onClose={() => setPreview(null)} />
    {editingProduct && <CatalogProductDialog key={`${productMode}-${editingProduct._id}`} mode={productMode} item={editingProduct} onToast={onToast} onClose={() => setEditingProduct(null)} onSaved={(item) => {
      setProducts((current) => [item, ...current.filter(entry => entry._id !== item._id)]);
      setEditingProduct(null);
      setSelectedIds(new Set());
      if (productMode !== "edit") { setQuery(""); setStatusFilter("all"); setSortBy("default"); setCurrentPage(1); }
      onToast(productMode === "edit" ? "Đã cập nhật sản phẩm và đơn giá." : "Đã tạo sản phẩm báo giá.");
    }} />}
    {bulk && <CatalogBulkDialog action={bulk.action} items={bulk.items} onClose={() => setBulk(null)} onApplied={items => { setProducts(current => current.map(item => items.find(updated => updated._id === item._id) || item)); setSelectedIds(new Set()); setBulk(null); onToast(`Đã áp dụng cho ${items.length} sản phẩm.`, "success"); }} />}
  </div>;
}
