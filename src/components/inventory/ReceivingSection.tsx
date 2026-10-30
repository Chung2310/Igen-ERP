import React, { Fragment, useEffect, useMemo, useState } from "react";
import { StyledSelect } from "../common/StyledSelect";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  PackagePlus,
  Pencil,
  RefreshCw,
  Scan,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  BulkVariantReceiveModal,
  type SelectedReceiveVariant,
} from "./receiving/BulkVariantReceiveModal";
import { SerialManagerModal } from "./receiving/SerialManagerModal";
import { ReceiptDetailModal } from "./receiving/ReceiptDetailModal";
import {
  inventoryReceivingService,
  type GoodsReceipt,
  type GoodsReceiptItem,
} from "../../services/inventoryReceivingService";
import {
  productCatalogService,
  type CatalogProduct,
  type CatalogProductDetail,
} from "../../services/productCatalogService";
import { toast } from "../../pages/Toast";
import { listSupplierPartners, type SupplierPartnerOption } from "../../modules/partners/partnerApi";
import { Dropdown, type DropdownOption } from "../common/Dropdown";

type DraftLine = GoodsReceiptItem & { key: string; displayName: string };

/** SKU theo dõi tới từng đơn vị thì phiếu phải tách ra mỗi đơn vị một dòng để lưu định danh thiết bị. */
const unitTracked = (trackingMode?: GoodsReceiptItem["trackingMode"]) => trackingMode === "serial" || trackingMode === "unit_barcode";

const unitCount = (line: DraftLine) => Math.max(0, Math.ceil(line.quantity) || 0);

/** Đưa serialNumbers/unitDetails về đúng độ dài count, giữ nguyên dữ liệu đã nhập. */
function normalizeUnits(line: DraftLine, count: number): DraftLine {
  if (!unitTracked(line.trackingMode)) return line;
  return {
    ...line,
    quantity: count,
    serialNumbers: line.trackingMode === "serial"
      ? Array.from({ length: count }, (_, index) => line.serialNumbers?.[index] || "")
      : line.serialNumbers,
    unitDetails: Array.from({ length: count }, (_, index) => ({
      ...line.unitDetails?.[index],
    })),
  };
}
const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");

export function ReceivingSection() {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<GoodsReceipt | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<GoodsReceipt | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const nextReceipts = await inventoryReceivingService.listReceipts({ limit: 50 });
      setReceipts(nextReceipts.items);
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải danh sách phiếu nhập.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);



  const confirm = async (receipt: GoodsReceipt) => {
    try {
      await inventoryReceivingService.confirmReceipt(receipt._id);
      toast.success(`Đã xác nhận ${receipt.receiptCode}.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Không thể xác nhận phiếu nhập.");
    }
  };

  const submit = async (receipt: GoodsReceipt) => {
    try { await inventoryReceivingService.submitReceipt(receipt._id); toast.success(`Đã gửi ${receipt.receiptCode} chờ xác nhận.`); await load(); }
    catch (error: any) { toast.error(error?.message || "Không thể gửi phiếu xác nhận."); }
  };
  const startReceiving = async (receipt: GoodsReceipt) => {
    try { await inventoryReceivingService.startReceiving(receipt._id); toast.success(`Đã chuyển ${receipt.receiptCode} sang Đang nhập kho.`); await load(); }
    catch (error: any) { toast.error(error?.message || "Không thể bắt đầu nhập kho."); }
  };

  const cancel = async (receipt: GoodsReceipt) => {
    const reason = window.prompt("Lý do hủy phiếu nhập");
    if (!reason?.trim()) return;
    try {
      await inventoryReceivingService.cancelReceipt(receipt._id, reason);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Không thể hủy phiếu nhập.");
    }
  };


  return (
    <section className="space-y-6" aria-label="Nhập hàng">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Nhập hàng</h3>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setEditingReceipt(null); setCreatorOpen(true); }} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
              <PackagePlus className="h-4 w-4" />
              Tạo phiếu nhập mới
            </button>
            {viewingReceipt?.status === "draft" && <button type="button" onClick={() => { setEditingReceipt(viewingReceipt); setViewingReceipt(null); setCreatorOpen(true); }} className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200 px-3 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-50"><Pencil className="h-4 w-4" />Sửa phiếu đang xem</button>}
            <button type="button" onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" title="Làm mới" aria-label="Làm mới">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200"><tr><th className="px-4 py-3.5 font-medium">Mã phiếu</th><th className="px-4 py-3.5 font-medium">Nhà cung cấp / Khách hàng</th><th className="px-4 py-3.5 font-medium">Ngày tạo</th><th className="px-4 py-3.5 text-right font-medium">Giá trị</th><th className="px-4 py-3.5 font-medium">Trạng thái</th><th className="px-4 py-3.5 text-right font-medium">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-200">{loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Đang tải dữ liệu...</td></tr> : receipts.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Chưa có phiếu nhập.</td></tr> : receipts.map((receipt) => <tr key={receipt._id} className="hover:bg-slate-50"><td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{receipt.receiptCode}{receipt.receiptKind && receipt.receiptKind !== "purchase" && <span className="mt-1 block font-sans font-normal text-cyan-700">{receipt.receiptKind === "buyback" ? "Thu mua lại" : receipt.receiptKind === "sales_cancel" ? "Hủy đơn" : "Trả hàng"} · {receipt.orderCode}</span>}</td><td className="px-4 py-3.5 font-medium text-slate-800">{receipt.supplierName}</td><td className="px-4 py-3.5 text-slate-500">{new Date(receipt.createdAt).toLocaleDateString("vi-VN")}</td><td className="px-4 py-3.5 text-right tabular-nums font-semibold text-slate-900">{money(receipt.subtotal)}</td><td className="px-4 py-3.5"><ReceiptStatus status={receipt.status} /></td><td className="px-4 py-3.5 text-right"><span className="inline-flex gap-1"><button type="button" onClick={() => setViewingReceipt(receipt)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Xem chi tiết phiếu"><Eye className="h-4 w-4" /></button>{receipt.status === "draft" && <><button type="button" onClick={() => { setEditingReceipt(receipt); setViewingReceipt(null); setCreatorOpen(true); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-cyan-50 hover:text-cyan-700" title="Sửa phiếu nháp" aria-label={`Sửa phiếu ${receipt.receiptCode}`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void submit(receipt)} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-amber-700 hover:bg-amber-50" title="Gửi chờ xác nhận">Gửi xác nhận</button><button type="button" onClick={() => void cancel(receipt)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "pending" && <><button type="button" onClick={() => void startReceiving(receipt)} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-sky-700 hover:bg-sky-50" title="Bắt đầu nhập kho">Nhập kho</button><button type="button" onClick={() => void cancel(receipt)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "receiving" && <button type="button" onClick={() => void confirm(receipt)} className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700" title="Hoàn thành nhập kho"><Check className="h-3.5 w-3.5" />Hoàn thành</button>}</span></td></tr>)}</tbody></table></div>

      {creatorOpen && <ReceiptCreatorModal initialReceipt={editingReceipt} onClose={() => { setCreatorOpen(false); setEditingReceipt(null); }} onSaved={async () => { setCreatorOpen(false); setEditingReceipt(null); await load(); }} />}
      {viewingReceipt && <ReceiptDetailModal receipt={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
    </section>
  );
}

function ReceiptStatus({ status }: { status: GoodsReceipt["status"] }) { const details = { draft: ["Nháp", "bg-slate-100 text-slate-600"], pending: ["Chờ xác nhận", "bg-amber-50 text-amber-700"], receiving: ["Đang nhập kho", "bg-sky-50 text-sky-700"], confirmed: ["Hoàn thành", "bg-emerald-50 text-emerald-700"], cancelled: ["Đã hủy", "bg-rose-50 text-rose-700"] } as const; const [label, className] = details[status]; return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{label}</span>; }
function ReceiptActions({ receipt, onView, onSubmit, onStart, onConfirm, onCancel }: { receipt: GoodsReceipt; onView: () => void; onSubmit: () => void; onStart: () => void; onConfirm: () => void; onCancel: () => void }) { return <span className="inline-flex gap-1"><button type="button" onClick={onView} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Xem chi tiết phiếu"><Eye className="h-4 w-4" /></button>{receipt.status === "draft" && <><button type="button" onClick={onSubmit} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-amber-700 hover:bg-amber-50" title="Gửi chờ xác nhận">Gửi</button><button type="button" onClick={onCancel} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "pending" && <><button type="button" onClick={onStart} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-sky-700 hover:bg-sky-50" title="Bắt đầu nhập kho">Nhập kho</button><button type="button" onClick={onCancel} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "receiving" && <button type="button" onClick={onConfirm} className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700" title="Hoàn thành nhập kho"><Check className="h-3.5 w-3.5" />Hoàn thành</button>}</span>; }


function SearchableSelect({ options, value, onChange, onQueryChange, placeholder, disabled }: { options: { value: string; label: string; sublabel?: string }[]; value: string; onChange: (val: string) => void; onQueryChange?: (query: string) => void; placeholder: string; disabled?: boolean }) {
  return <Dropdown value={value} onChange={onChange} options={options} onSearchChange={onQueryChange} placeholder={placeholder} aria-label={placeholder} disabled={disabled} searchable searchPlaceholder={placeholder} variant="form" className="w-full" />;
}

function ReceiptCreatorModal({ initialReceipt, onClose, onSaved }: { initialReceipt?: GoodsReceipt | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [suppliers, setSuppliers] = useState<SupplierPartnerOption[]>([]);
  const supplierOptions: DropdownOption<string>[] = useMemo(
    () => suppliers.map((item) => ({ value: item.supplierId, label: `${item.name} (${item.code})` })),
    [suppliers],
  );
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productDetails, setProductDetails] = useState<Record<string, CatalogProductDetail>>({});
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [financeEnabled, setFinanceEnabled] = useState(!initialReceipt || Boolean(initialReceipt.financeTerms));
  const [financeTerms, setFinanceTerms] = useState(initialReceipt?.financeTerms || { dueOn: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), paidAmount: 0, paymentMethod: "cash" });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);

  // Advanced Bulk SKU & IMEI Manager states
  const [isBulkVariantModalOpen, setIsBulkVariantModalOpen] = useState(false);
  const [managingSerialLineKey, setManagingSerialLineKey] = useState<string | null>(null);
  const [expandedUnitLines, setExpandedUnitLines] = useState<Record<string, boolean>>({});
  const [bulkAllWarranty, setBulkAllWarranty] = useState<string>("12");

  const activeSerialLine = useMemo(() => {
    return lines.find((l) => l.key === managingSerialLineKey);
  }, [lines, managingSerialLineKey]);

  const otherLinesSerials = useMemo(() => {
    return lines
      .filter((l) => l.key !== managingSerialLineKey)
      .flatMap((l) => (l.serialNumbers || []).map((s) => s.trim()).filter(Boolean));
  }, [lines, managingSerialLineKey]);

  const handleBulkVariantsConfirm = (selectedList: SelectedReceiveVariant[]) => {
    const currentProduct =
      products.find((p) => p._id === productId) ||
      (productId && productDetails[productId] ? { _id: productId, name: productDetails[productId].name } : undefined) ||
      (selectedList[0]?.variant ? { _id: productId || selectedList[0].variant._id, name: selectedList[0].variant.displayName || "Sản phẩm" } : undefined);
    if (!currentProduct) {
      toast.error("Không tìm thấy thông tin sản phẩm để thêm vào phiếu.");
      return;
    }

    setLines((current) => {
      const next = [...current];
      for (const item of selectedList) {
        const existingIndex = next.findIndex((l) => l.variantId === item.variant._id);
        const warranty = item.supplierWarrantyMonths !== undefined ? item.supplierWarrantyMonths : item.variant.supplierWarrantyMonths;
        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          const newQty = existing.quantity + item.quantity;
          const updated: DraftLine = {
            ...existing,
            quantity: newQty,
            unitCost: item.unitCost > 0 ? item.unitCost : existing.unitCost,
            supplierWarrantyMonths: warranty !== undefined ? warranty : existing.supplierWarrantyMonths,
          };
          next[existingIndex] = unitTracked(updated.trackingMode)
            ? normalizeUnits(updated, Math.round(newQty))
            : updated;
        } else {
          const draft: DraftLine = {
            key: `${item.variant._id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            productId: currentProduct._id,
            variantId: item.variant._id,
            sku: item.variant.sku,
            productName: currentProduct.name,
            displayName: item.variant.displayName || item.variant.sku,
            quantity: item.quantity,
            unitCost: item.unitCost,
            trackingMode: item.variant.trackingMode,
            supplierWarrantyMonths: warranty,
          };
          next.push(unitTracked(draft.trackingMode) ? normalizeUnits(draft, Math.max(1, Math.round(item.quantity))) : draft);
        }
      }
      return next;
    });

    toast.success(`Đã thêm/cập nhật ${selectedList.length} SKU của "${currentProduct.name}" vào phiếu nhập!`);
  };

  const handleApplyBulkWarrantyToAllLines = () => {
    const digits = bulkAllWarranty.replace(/\D/g, "");
    if (digits === "") {
      toast.error("Vui lòng nhập số tháng bảo hành hợp lệ.");
      return;
    }
    const months = Math.min(1200, Number(digits));
    setLines((current) => current.map((l) => ({ ...l, supplierWarrantyMonths: months })));
    toast.success(`Đã áp dụng bảo hành ${months} tháng cho toàn bộ ${lines.length} dòng trong phiếu nhập!`);
  };

  const handleSaveSerialLine = (updatedLine: DraftLine) => {
    setLines((current) => current.map((l) => (l.key === updatedLine.key ? updatedLine : l)));
  };

  const load = async () => {
    try {
      const [nextSuppliers, nextProducts] = await Promise.all([
        listSupplierPartners(),
        productCatalogService.listProducts({ status: "active", limit: 20 }),
      ]);
      setSuppliers(nextSuppliers);
      setProducts(nextProducts.items);
      if (initialReceipt) {
        setSupplierId(initialReceipt.supplierId);
        setNotes(initialReceipt.notes || "");
        setLines(initialReceipt.items.map((item, index) => {
          const line: DraftLine = { ...item, key: `${item.variantId}-${index}`, displayName: item.productName || item.sku };
          return unitTracked(line.trackingMode) ? normalizeUnits(line, Math.max(1, Math.round(line.quantity))) : line;
        }));
      }
      if (!initialReceipt && nextSuppliers.length > 0) setSupplierId(nextSuppliers[0].supplierId);
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải dữ liệu tạo phiếu nhập.");
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      productCatalogService.listProducts({ status: "active", q: productSearch.trim() || undefined, limit: 20 })
        .then((result) => setProducts(result.items))
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const selectedDetail = productId ? productDetails[productId] : undefined;
  const variants = selectedDetail?.variants.filter((item) => item.status === "active") || [];
  const selectedVariant = variants.find((item) => item._id === variantId);
  const selectedProductName = selectedDetail?.name || products.find((item) => item._id === productId)?.name || "Sản phẩm";
  const variantOptions = variants.map((variant) => {
    const optionValues = (variant.optionValues || []).map((option) => option.value.trim()).filter(Boolean);
    const variantName = optionValues.length
      ? optionValues.join(" · ")
      : variant.displayName?.trim() && variant.displayName.trim() !== variant.sku
        ? variant.displayName.trim()
        : "Biến thể mặc định";
    return {
      value: variant._id,
      label: `${selectedProductName} — ${variantName}`,
      sublabel: `SKU: ${variant.sku}`,
    };
  });
  // Hàng theo dõi từng đơn vị chỉ nhận số nguyên; hàng cân/đong mới cần bước lẻ.
  const quantityStep = !selectedVariant || unitTracked(selectedVariant.trackingMode) ? 1 : 0.001;
  useEffect(() => {
    if (!productId || productDetails[productId]) return;
    void productCatalogService.getProduct(productId).then((detail) => setProductDetails((current) => ({ ...current, [productId]: detail }))).catch(() => undefined);
  }, [productId, productDetails]);
  useEffect(() => { setVariantId(variants[0]?._id || ""); }, [productId, variants.length]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0), [lines]);

  const addLine = () => {
    const variant = variants.find((item) => item._id === variantId);
    const product = products.find((item) => item._id === productId);
    const parsedQuantity = Number(quantity);
    const parsedCost = Number(unitCost);
    if (!product || !variant || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || !Number.isFinite(parsedCost) || parsedCost < 0) {
      toast.error("Chọn sản phẩm, SKU và nhập số lượng/giá hợp lệ.");
      return;
    }
    if (lines.some((line) => line.variantId === variantId)) {
      toast.error(`SKU ${variant.sku} đã có trong danh sách. Hãy chỉnh số lượng trực tiếp ở dòng hiện có.`);
      return;
    }
    const draft: DraftLine = { key: `${variant._id}-${Date.now()}`, productId, variantId, sku: variant.sku, productName: product.name, displayName: variant.displayName || variant.sku, quantity: parsedQuantity, unitCost: parsedCost, trackingMode: variant.trackingMode, supplierWarrantyMonths: variant.supplierWarrantyMonths };
    // Hàng theo dõi từng đơn vị chỉ nhận số nguyên vì mỗi đơn vị là một dòng riêng.
    const nextLine = unitTracked(draft.trackingMode) ? normalizeUnits(draft, Math.max(1, Math.round(parsedQuantity))) : draft;
    setLines((current) => [...current, nextLine]);
    setProductId("");
    setVariantId("");
    setQuantity("1");
    setUnitCost("0");
  };

  const updateLine = (key: string, field: "quantity" | "unitCost", value: string) => {
    const normalizedValue = field === "quantity"
      ? value.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
      : value.replace(/\D/g, "");
    const numberValue = Number(normalizedValue);
    if (!Number.isFinite(numberValue) || numberValue < 0 || (field === "quantity" && numberValue === 0)) return;
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: numberValue } : line));
  };

  const updateSerialAt = (key: string, index: number, value: string) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const normalized = normalizeUnits(line, unitCount(line));
      const serialNumbers = [...(normalized.serialNumbers || [])];
      serialNumbers[index] = value;
      return { ...normalized, serialNumbers };
    }));
  };

  const updateWarrantyMonths = (key: string, value: string) => {
    const digits = value.replace(/\D/g, "");
    setLines((current) => current.map((line) => line.key === key ? { ...line, supplierWarrantyMonths: digits === "" ? undefined : Math.min(1200, Number(digits)) } : line));
  };

  const addUnit = (key: string) => {
    setLines((current) => current.map((line) => line.key === key ? normalizeUnits(line, unitCount(line) + 1) : line));
  };

  const removeUnitAt = (key: string, index: number) => {
    setLines((current) => current.flatMap((line) => {
      if (line.key !== key) return [line];
      const normalized = normalizeUnits(line, unitCount(line));
      const nextCount = unitCount(normalized) - 1;
      if (nextCount <= 0) return [];
      return [{
        ...normalized,
        quantity: nextCount,
        serialNumbers: normalized.serialNumbers?.filter((_, serialIndex) => serialIndex !== index),
        unitDetails: normalized.unitDetails?.filter((_, unitIndex) => unitIndex !== index),
      }];
    }));
  };

  const updateUnitDetailAt = (key: string, index: number, field: "serialNumber" | "imei1" | "imei2", value: string) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const normalized = normalizeUnits(line, unitCount(line));
      const unitDetails = [...(normalized.unitDetails || [])];
      unitDetails[index] = { ...unitDetails[index], [field]: value };
      return { ...normalized, unitDetails };
    }));
  };

  const saveReceipt = async () => {
    if (!supplierId || lines.length === 0) {
      toast.error("Chọn nhà cung cấp và ít nhất một sản phẩm.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplierId,
        notes: notes.trim() || undefined,
        financeTerms: financeEnabled ? financeTerms : null,
        items: lines.map(({ key: _key, displayName: _displayName, ...line }) => ({
          ...line,
          unitDetails: line.unitDetails?.length ? line.unitDetails : undefined,
        })),
      };
      if (initialReceipt) await inventoryReceivingService.updateReceipt(initialReceipt._id, payload);
      else await inventoryReceivingService.createReceipt(payload);
      toast.success("Đã tạo phiếu nhập ở trạng thái Nháp. Hãy xác nhận để nhập kho.");
      await onSaved();
    } catch (error: any) {
      toast.error(error?.message || "Không thể tạo phiếu nhập.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initialReceipt ? `Sửa phiếu nhập ${initialReceipt.receiptCode}` : "Tạo phiếu nhập mới"} onClose={onClose} wide>
      <div className="bg-slate-50/50 -m-5 p-5">
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nhà cung cấp</label>
            <Dropdown<string>
              aria-label="Nhà cung cấp"
              name="supplierId"
              value={supplierId}
              onChange={setSupplierId}
              options={supplierOptions}
              placeholder="Chọn nhà cung cấp"
              variant="form"
              size="md"
              searchable
              searchPlaceholder="Tìm nhà cung cấp..."
              disabled={suppliers.length === 0}
              className="w-full"
              triggerClassName="w-full text-sm"
            />
            <p className="mt-1.5 text-xs text-slate-500">Thêm hoặc sửa nhà cung cấp tại Quản lý đối tác.</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Thêm sản phẩm vào phiếu</h4>
              {productId && variants.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkVariantModalOpen(true)}
                  className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors"
                >
                  Nhập nhiều SKU của sản phẩm này ({variants.length} SKU)
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,4fr)_minmax(0,4fr)_minmax(96px,2fr)_minmax(120px,2fr)_40px]">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Sản phẩm</label>
                <SearchableSelect
                  placeholder="Tìm kiếm sản phẩm..."
                  value={productId}
                  onChange={(id) => { setProductId(id); setVariantId(""); }}
                  onQueryChange={setProductSearch}
                  options={products.map((p) => ({ value: p._id, label: p.name, sublabel: `Mã SP: ${p.productCode}` }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Phiên bản sản phẩm</label>
                <SearchableSelect
                  disabled={!productId || variants.length === 0}
                  placeholder="Chọn phiên bản..."
                  value={variantId}
                  onChange={setVariantId}
                  options={variantOptions}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Số lượng</label>
                <input type="number" min={quantityStep} step={quantityStep} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 bg-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Giá nhập</label>
                <input type="number" min="0" step="1" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 bg-white" />
              </div>
              <div>
                <button type="button" onClick={addLine} className="inline-flex h-[38px] w-full items-center justify-center rounded-md bg-cyan-700 text-white hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-1" title="Thêm dòng"><PackagePlus className="h-5 w-5" /></button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
              <h4 className="text-sm font-semibold text-slate-900">Danh sách nhập ({lines.length} dòng)</h4>
              {lines.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="font-medium text-slate-700">Áp BH NCC cho cả phiếu:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="12"
                    value={bulkAllWarranty}
                    onChange={(e) => setBulkAllWarranty(e.target.value.replace(/\D/g, ""))}
                    className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right font-bold text-slate-900 outline-none focus:border-cyan-600 shadow-sm"
                    aria-label="Số tháng bảo hành áp dụng cho toàn bộ dòng"
                  />
                  <span>tháng</span>
                  <button
                    type="button"
                    onClick={handleApplyBulkWarrantyToAllLines}
                    className="rounded bg-cyan-700 hover:bg-cyan-800 text-white font-semibold px-2.5 py-1 text-xs shadow-sm transition-colors"
                  >
                    Áp dụng
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sản phẩm</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 text-right font-medium">Số lượng</th>
                    <th className="px-4 py-3 font-medium">Serial / IMEI thiết bị</th>
                    <th className="px-4 py-3 text-right font-medium">BH NCC (tháng)</th>
                    <th className="px-4 py-3 text-right font-medium">Đơn giá</th>
                    <th className="px-4 py-3 text-right font-medium">Thành tiền</th>
                    <th className="px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">Chưa có sản phẩm trong phiếu.</td></tr> : lines.map((line) => unitTracked(line.trackingMode) ? (
                    <Fragment key={line.key}>
                      <tr className="bg-slate-50/60 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{line.productName}</p>
                          <p className="text-xs text-slate-500">{line.displayName}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{line.sku}</td>

                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={line.quantity}
                            onChange={(event) => updateLine(line.key, "quantity", event.target.value)}
                            className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right tabular-nums text-sm font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                            aria-label={`Số lượng ${line.sku}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {line.trackingMode === "serial" ? (
                              (() => {
                                const filledCount = (line.serialNumbers || []).filter(Boolean).length;
                                const isEnough = filledCount === line.quantity;
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${isEnough
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : filledCount > 0
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : "bg-rose-50 text-rose-700 border border-rose-200"
                                      }`}
                                  >
                                    {isEnough && <Check className="h-3 w-3" />}
                                    {filledCount === 0
                                      ? `Chưa có IMEI (0/${line.quantity})`
                                      : `${filledCount}/${line.quantity} IMEI`}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 border border-cyan-200">
                                Theo mã vạch đơn vị
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => setManagingSerialLineKey(line.key)}
                              className="rounded bg-cyan-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800 transition-colors"
                            >
                              Quản lý / Quét IMEI
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedUnitLines((curr) => ({
                                  ...curr,
                                  [line.key]: !curr[line.key],
                                }))
                              }
                              className="text-[11px] text-slate-400 hover:text-slate-700 font-medium ml-1"
                            >
                              {expandedUnitLines[line.key] ? "▲ Thu gọn" : "▼ Xem từng ô"}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            value={line.supplierWarrantyMonths ?? ""}
                            onChange={(event) => updateWarrantyMonths(line.key, event.target.value)}
                            placeholder="0"
                            className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right tabular-nums text-sm text-slate-700 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                            aria-label={`Bảo hành nhà cung cấp ${line.sku} (tháng)`}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={money(line.unitCost)}
                            onChange={(event) => updateLine(line.key, "unitCost", event.target.value)}
                            className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right tabular-nums text-sm font-semibold text-cyan-800 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                            aria-label={`Đơn giá ${line.sku}`}
                          />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{money(line.quantity * line.unitCost)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Xóa cả dòng"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {expandedUnitLines[line.key] &&
                        Array.from({ length: unitCount(line) }, (_, index) => (
                          <tr key={`${line.key}-unit-${index}`} className="bg-slate-50/30">
                            <td colSpan={2} className="py-2 pl-8 pr-4 text-xs font-medium text-slate-500">
                              Đơn vị #{index + 1}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-400">1</td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-2">
                                {line.trackingMode === "serial" ? (
                                  <input
                                    value={line.serialNumbers?.[index] || ""}
                                    onChange={(event) => updateSerialAt(line.key, index, event.target.value)}
                                    placeholder={`Serial / IMEI chính ${index + 1}`}
                                    className="w-44 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
                                    aria-label={`Serial hoặc IMEI chính ${line.sku} đơn vị ${index + 1}`}
                                  />
                                ) : (
                                  <input
                                    value={line.unitDetails?.[index]?.serialNumber || ""}
                                    onChange={(event) => updateUnitDetailAt(line.key, index, "serialNumber", event.target.value)}
                                    placeholder={`Serial (nếu có) ${index + 1}`}
                                    className="w-44 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-cyan-600"
                                    aria-label={`Serial ${line.sku} đơn vị ${index + 1}`}
                                  />
                                )}
                                <input
                                  value={line.unitDetails?.[index]?.imei1 || ""}
                                  onChange={(event) => updateUnitDetailAt(line.key, index, "imei1", event.target.value)}
                                  placeholder={`IMEI 1 (nếu có) ${index + 1}`}
                                  className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-cyan-600"
                                  aria-label={`IMEI 1 ${line.sku} đơn vị ${index + 1}`}
                                />
                                <input
                                  value={line.unitDetails?.[index]?.imei2 || ""}
                                  onChange={(event) => updateUnitDetailAt(line.key, index, "imei2", event.target.value)}
                                  placeholder={`IMEI 2 (nếu có) ${index + 1}`}
                                  className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-cyan-600"
                                  aria-label={`IMEI 2 ${line.sku} đơn vị ${index + 1}`}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2" />
                            <td className="px-4 py-2" />
                            <td className="px-4 py-2" />
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeUnitAt(line.key, index)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                                title={`Xóa đơn vị #${index + 1}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {expandedUnitLines[line.key] && (
                        <tr>
                          <td colSpan={8} className="px-4 pb-3 pl-8">
                            <button
                              type="button"
                              onClick={() => addUnit(line.key)}
                              className="inline-flex items-center gap-1 rounded-md border border-dashed border-cyan-300 px-2.5 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
                            >
                              + Thêm đơn vị
                            </button>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ) : (
                    <tr key={line.key}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{line.productName}</p>
                        <p className="text-xs text-slate-500">{line.displayName}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{line.sku}</td>
                      <td className="px-4 py-3 text-right"><input type="text" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right tabular-nums text-sm text-slate-700 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600" aria-label={`Số lượng ${line.sku}`} /></td>
                      <td className="px-4 py-3"><span className="text-xs text-slate-400">{line.trackingMode === "lot" ? "Theo lô" : "Không áp dụng"}</span></td>
                      <td className="px-4 py-3 text-right"><input value={line.supplierWarrantyMonths ?? ""} onChange={(event) => updateWarrantyMonths(line.key, event.target.value)} placeholder="0" className="w-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right tabular-nums text-sm text-slate-700 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600" aria-label={`Bảo hành nhà cung cấp ${line.sku} (tháng)`} /></td>
                      <td className="px-4 py-3 text-right"><input type="text" inputMode="numeric" value={money(line.unitCost)} onChange={(event) => updateLine(line.key, "unitCost", event.target.value)} className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right tabular-nums text-sm text-slate-700 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600" aria-label={`Đơn giá ${line.sku}`} /></td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{money(line.quantity * line.unitCost)}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Xóa dòng"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cấu hình Thanh toán & Công nợ nhà cung cấp */}
          <div className="space-y-3 rounded-xl border border-cyan-200/80 bg-cyan-50/40 p-4 shadow-xs">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={financeEnabled}
                onChange={(e) => setFinanceEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600 cursor-pointer"
              />
              <span>Tự ghi nhận công nợ nhà cung cấp khi hoàn thành nhập kho</span>
            </label>

            {financeEnabled && (
              <div className="grid gap-3 sm:grid-cols-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hạn thanh toán</label>
                  <input
                    type="date"
                    required
                    value={financeTerms.dueOn}
                    onChange={(e) => setFinanceTerms({ ...financeTerms, dueOn: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đã thanh toán (VND)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={money(financeTerms.paidAmount)}
                    onChange={(e) => {
                      const num = Number(e.target.value.replace(/\D/g, ""));
                      setFinanceTerms({ ...financeTerms, paidAmount: isNaN(num) ? 0 : num });
                    }}
                    placeholder="0"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-xs tabular-nums text-right font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phương thức đã trả</label>
<StyledSelect appearance="erp" ariaLabel="Phương thức đã trả" value={financeTerms.paymentMethod} onChange={(value) => setFinanceTerms({ ...financeTerms, paymentMethod: value })} options={[{ value: "cash", label: "Tiền mặt" }, { value: "bank", label: "Ngân hàng / Chuyển khoản" }]} />
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500">
              * Nợ = Giá trị phiếu nhập trừ số đã thanh toán. Khoản đã trả cần gán quỹ tại Tài chính → Sổ quỹ. Không nhập lại công nợ này thủ công.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ghi chú phiếu nhập</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Nhập ghi chú hoặc thông tin tham chiếu..."
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-xs"
            />
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-5 mt-2">
            <div className="flex items-center gap-2 text-lg text-slate-900">
              <span className="font-medium text-slate-600 text-sm">Tổng cộng:</span>
              <strong className="font-bold">{money(total)}</strong>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Hủy bỏ
              </button>
              <button type="button" disabled={saving || lines.length === 0} onClick={() => void saveReceipt()} className="rounded-md bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 transition-colors disabled:opacity-50">
                {saving ? "Đang xử lý..." : initialReceipt ? "Lưu thay đổi" : "Tạo phiếu nháp"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nhập nhiều SKU của sản phẩm */}
      {isBulkVariantModalOpen && productId && products.find((p) => p._id === productId) && (
        <BulkVariantReceiveModal
          isOpen={isBulkVariantModalOpen}
          onClose={() => setIsBulkVariantModalOpen(false)}
          product={products.find((p) => p._id === productId)!}
          productDetail={productDetails[productId]}
          existingVariantIds={lines.map((l) => l.variantId)}
          onConfirm={handleBulkVariantsConfirm}
        />
      )}

      {/* Modal Quản lý & Quét IMEI chuyên dụng */}
      {activeSerialLine && (
        <SerialManagerModal
          isOpen={Boolean(activeSerialLine)}
          onClose={() => setManagingSerialLineKey(null)}
          line={activeSerialLine}
          onSave={handleSaveSerialLine}
          otherLinesSerials={otherLinesSerials}
        />
      )}
    </Modal>
  );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4">
      <div role="dialog" aria-modal="true" className={`max-h-[92vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
