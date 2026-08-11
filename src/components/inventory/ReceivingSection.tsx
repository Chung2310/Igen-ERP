import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Eye,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  inventoryReceivingService,
  type GoodsReceipt,
  type GoodsReceiptItem,
  type Supplier,
} from "../../services/inventoryReceivingService";
import {
  productCatalogService,
  type CatalogProduct,
  type CatalogProductDetail,
} from "../../services/productCatalogService";
import { toast } from "../../pages/Toast";

type DraftLine = GoodsReceiptItem & { key: string; displayName: string };
type SupplierForm = {
  name: string;
  taxCode: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
  notes: string;
  status: Supplier["status"];
};
type SupplierEditorMode = "view" | "edit" | "create";

const money = (value: number) => Number(value || 0).toLocaleString("vi-VN");
const emptySupplierForm: SupplierForm = {
  name: "",
  taxCode: "",
  phone: "",
  email: "",
  address: "",
  paymentTerms: "",
  notes: "",
  status: "active",
};

const supplierToForm = (supplier?: Supplier | null): SupplierForm =>
  supplier
    ? {
        name: supplier.name,
        taxCode: supplier.taxCode || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        paymentTerms: supplier.paymentTerms || "",
        notes: supplier.notes || "",
        status: supplier.status,
      }
    : { ...emptySupplierForm };

type SupplierManagementModalProps = {
  initialSupplier: Supplier | null;
  initialMode: SupplierEditorMode;
  onClose: () => void;
  onSaved: (supplier: Supplier) => void;
  onDeleted: (supplierId: string) => void;
};

function SupplierManagementModal({
  initialSupplier,
  initialMode,
  onClose,
  onSaved,
  onDeleted,
}: SupplierManagementModalProps) {
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(initialSupplier);
  const [mode, setMode] = useState<SupplierEditorMode>(initialMode);
  const [form, setForm] = useState<SupplierForm>(() => supplierToForm(initialSupplier));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pageSize = 8;

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      setSuppliers(await inventoryReceivingService.listSuppliers());
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải danh sách nhà cung cấp.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, []);

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.code, supplier.name, supplier.phone, supplier.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [search, suppliers]);
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const visibleSuppliers = filteredSuppliers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startCreate = () => {
    setEditingSupplier(null);
    setMode("create");
    setForm({ ...emptySupplierForm });
  };

  const startEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setMode("edit");
    setForm(supplierToForm(supplier));
  };

  const startView = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setMode("view");
    setForm(supplierToForm(supplier));
  };

  const updateForm = (field: keyof SupplierForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "view") return;
    if (!form.name.trim()) {
      toast.error("Tên nhà cung cấp là bắt buộc.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        taxCode: form.taxCode.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        paymentTerms: form.paymentTerms.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: form.status,
      };
      const supplier = editingSupplier
        ? await inventoryReceivingService.updateSupplier(editingSupplier._id, input)
        : await inventoryReceivingService.createSupplier(input);
      toast.success(editingSupplier ? "Đã cập nhật nhà cung cấp." : "Đã tạo nhà cung cấp.");
      setEditingSupplier(supplier);
      setMode("edit");
      setForm(supplierToForm(supplier));
      await loadSuppliers();
      onSaved(supplier);
    } catch (error: any) {
      toast.error(error?.message || "Không thể lưu nhà cung cấp.");
    } finally {
      setSaving(false);
    }
  };

  const removeSupplier = async (supplier: Supplier) => {
    if (!window.confirm(`Xóa nhà cung cấp “${supplier.name}”?`)) return;
    try {
      await inventoryReceivingService.deleteSupplier(supplier._id);
      toast.success("Đã xóa nhà cung cấp.");
      if (editingSupplier?._id === supplier._id) startCreate();
      await loadSuppliers();
      onDeleted(supplier._id);
    } catch (error: any) {
      toast.error(error?.message || "Không thể xóa nhà cung cấp.");
    }
  };

  const isReadOnly = mode === "view";
  const editorTitle = mode === "view" ? "Chi tiết nhà cung cấp" : mode === "edit" ? "Chỉnh sửa nhà cung cấp" : "Tạo nhà cung cấp";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-management-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="supplier-management-title" className="text-lg font-semibold text-slate-900">
              Quản lý nhà cung cấp
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Khai báo một lần để dùng lại trong các phiếu nhập hàng.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            title="Đóng"
            aria-label="Đóng quản lý nhà cung cấp"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 gap-6 overflow-y-auto p-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <form onSubmit={saveSupplier} className="space-y-3 lg:border-r lg:border-slate-200 lg:pr-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {editorTitle}
              </h3>
              {mode !== "create" && (
                <button type="button" onClick={startCreate} className="text-xs font-medium text-cyan-700 hover:underline">
                  Tạo mới
                </button>
              )}
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {editingSupplier ? (
                <span>Mã tự động: <strong className="font-mono text-slate-800">{editingSupplier.code}</strong></span>
              ) : (
                "Mã nhà cung cấp sẽ được tự động tạo sau khi lưu."
              )}
            </div>
            <label className="block text-xs text-slate-600">
              Tên nhà cung cấp <span className="text-rose-600">*</span>
              <input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                readOnly={isReadOnly}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Ví dụ: Công ty cổ phần ABC"
                autoFocus
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="text-xs text-slate-600">
                Mã số thuế
                <input value={form.taxCode} onChange={(event) => updateForm("taxCode", event.target.value)} readOnly={isReadOnly} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
              </label>
              <label className="text-xs text-slate-600">
                Số điện thoại
                <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} readOnly={isReadOnly} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
              </label>
            </div>
            <label className="block text-xs text-slate-600">
              Thư điện tử
              <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} readOnly={isReadOnly} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            <label className="block text-xs text-slate-600">
              Địa chỉ
              <input value={form.address} onChange={(event) => updateForm("address", event.target.value)} readOnly={isReadOnly} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            <label className="block text-xs text-slate-600">
              Điều khoản thanh toán
              <input value={form.paymentTerms} onChange={(event) => updateForm("paymentTerms", event.target.value)} readOnly={isReadOnly} placeholder="Ví dụ: Thanh toán trong 30 ngày" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            <label className="block text-xs text-slate-600">
              Ghi chú
              <textarea rows={2} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} readOnly={isReadOnly} className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            {editingSupplier && (
              <label className="block text-xs text-slate-600">
                Trạng thái
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} disabled={isReadOnly} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500">
                  <option value="active">Đang dùng</option>
                  <option value="inactive">Ngừng dùng</option>
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Đóng</button>
              {isReadOnly ? <button type="button" onClick={() => editingSupplier && startEdit(editingSupplier)} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"><Pencil className="h-4 w-4" />Sửa</button> : <button type="submit" disabled={saving} className="inline-flex items-center rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">{saving ? "Đang lưu..." : mode === "edit" ? "Lưu thay đổi" : "Tạo nhà cung cấp"}</button>}
            </div>
          </form>

          <div className="min-w-0">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Danh sách nhà cung cấp ({filteredSuppliers.length})</h3>
                <p className="mt-1 text-xs text-slate-500">Dữ liệu dùng chung cho toàn công ty.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm tên, mã, điện thoại" className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm" />
              </div>
            </div>
            <div className="mt-3 overflow-x-auto border-y border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr><th className="px-3 py-3 font-medium">Mã tự động</th><th className="px-3 py-3 font-medium">Tên</th><th className="px-3 py-3 font-medium">Liên hệ</th><th className="px-3 py-3 font-medium">Trạng thái</th><th className="px-3 py-3 text-right font-medium">Thao tác</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Đang tải...</td></tr> : visibleSuppliers.length === 0 ? <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-500">Chưa có nhà cung cấp phù hợp.</td></tr> : visibleSuppliers.map((supplier) => <tr key={supplier._id}>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">{supplier.code}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{supplier.name}</td>
                    <td className="px-3 py-3 text-slate-500">{supplier.phone || supplier.email || "—"}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${supplier.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{supplier.status === "active" ? "Đang dùng" : "Ngừng dùng"}</span></td>
                    <td className="px-3 py-3 text-right"><span className="inline-flex items-center gap-1"><button type="button" onClick={() => startView(supplier)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Xem chi tiết" aria-label={`Xem ${supplier.name}`}><Eye className="h-4 w-4" /></button><button type="button" onClick={() => startEdit(supplier)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Sửa nhà cung cấp" aria-label={`Sửa ${supplier.name}`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void removeSupplier(supplier)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Xóa nhà cung cấp" aria-label={`Xóa ${supplier.name}`}><Trash2 className="h-4 w-4" /></button></span></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-3 text-xs text-slate-500">
              <span>Trang {page}/{totalPages}</span>
              <div className="flex gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40" title="Trang trước"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40" title="Trang sau"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReceivingSection() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productDetails, setProductDetails] = useState<Record<string, CatalogProductDetail>>({});
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [supplierManagementOpen, setSupplierManagementOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierManagementMode, setSupplierManagementMode] = useState<SupplierEditorMode>("create");

  const load = async (preferredSupplierId?: string) => {
    try {
      const [nextSuppliers, nextReceipts, nextProducts] = await Promise.all([
        inventoryReceivingService.listSuppliers({ status: "active" }),
        inventoryReceivingService.listReceipts({ limit: 50 }),
        productCatalogService.listProducts({ status: "active", limit: 100 }),
      ]);
      setSuppliers(nextSuppliers);
      setReceipts(nextReceipts.items);
      setProducts(nextProducts.items);
      const nextSupplierId = preferredSupplierId || supplierId;
      if (!nextSupplierId || !nextSuppliers.some((supplier) => supplier._id === nextSupplierId)) setSupplierId(nextSuppliers[0]?._id || "");
      else if (preferredSupplierId) setSupplierId(preferredSupplierId);
    } catch (error: any) {
      toast.error(error?.message || "Không thể tải dữ liệu nhập hàng.");
    }
  };

  useEffect(() => { void load(); }, []);
  const selectedDetail = productId ? productDetails[productId] : undefined;
  const variants = selectedDetail?.variants.filter((item) => item.status === "active") || [];
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
    setLines((current) => [...current, { key: `${variant._id}-${Date.now()}`, productId, variantId, sku: variant.sku, productName: product.name, displayName: variant.displayName || variant.sku, quantity: parsedQuantity, unitCost: parsedCost }]);
    setProductId("");
    setVariantId("");
    setQuantity("1");
    setUnitCost("0");
  };

  const saveReceipt = async () => {
    if (!supplierId || lines.length === 0) {
      toast.error("Chọn nhà cung cấp và ít nhất một sản phẩm.");
      return;
    }
    setSaving(true);
    try {
      await inventoryReceivingService.createReceipt({ supplierId, notes: notes.trim() || undefined, items: lines.map(({ key: _key, displayName: _displayName, ...line }) => line) });
      setLines([]);
      setNotes("");
      toast.success("Đã tạo phiếu nhập nháp.");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Không thể tạo phiếu nhập.");
    } finally {
      setSaving(false);
    }
  };

  const confirm = async (receipt: GoodsReceipt) => {
    try {
      await inventoryReceivingService.confirmReceipt(receipt._id);
      toast.success(`Đã xác nhận ${receipt.receiptCode}.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Không thể xác nhận phiếu nhập.");
    }
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

  const openSupplierManagement = (supplier?: Supplier, mode: SupplierEditorMode = "create") => {
    setEditingSupplier(supplier || null);
    setSupplierManagementMode(mode);
    setSupplierManagementOpen(true);
  };

  return (
    <section className="space-y-6" aria-label="Nhập hàng và nhà cung cấp">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Nhập hàng</h3>
          <p className="mt-1 text-sm text-slate-500">Tạo phiếu nháp, kiểm tra lại rồi xác nhận để tăng tồn kho.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => openSupplierManagement()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" title="Quản lý nhà cung cấp">
            <ContactRound className="h-4 w-4" />
            Nhà cung cấp
          </button>
          <button type="button" onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" title="Làm mới" aria-label="Làm mới">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4 border border-slate-200 p-4">
          <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-slate-900">Phiếu nhập mới</h4><span className="text-xs text-slate-500">{lines.length} dòng</span></div>
          <label className="block text-xs text-slate-600">Nhà cung cấp<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">Chọn nhà cung cấp</option>{suppliers.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}</select></label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_120px_auto]">
            <label className="text-xs text-slate-600">Sản phẩm<select value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">Chọn sản phẩm</option>{products.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
            <label className="text-xs text-slate-600">Mã SKU<select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"><option value="">Chọn SKU</option>{variants.map((item) => <option key={item._id} value={item._id}>{item.sku}</option>)}</select></label>
            <label className="text-xs text-slate-600">Số lượng<input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-600">Giá nhập<input type="number" min="0" step="1" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" /></label>
            <button type="button" onClick={addLine} className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800" title="Thêm dòng"><PackagePlus className="mr-1.5 h-4 w-4" />Thêm</button>
          </div>
          <div className="divide-y divide-slate-100 border-y border-slate-200">{lines.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Chưa có sản phẩm trong phiếu.</p> : lines.map((line) => <div key={line.key} className="flex items-center justify-between gap-3 px-3 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium text-slate-800">{line.productName}</p><p className="text-xs text-slate-500">{line.sku} · {line.quantity} × {money(line.unitCost)}</p></div><button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Xóa dòng"><X className="h-4 w-4" /></button></div>)}</div>
          <label className="block text-xs text-slate-600">Ghi chú<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm" /></label>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3"><strong className="text-sm text-slate-900">Tạm tính: {money(total)}</strong><button type="button" disabled={saving || lines.length === 0} onClick={() => void saveReceipt()} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu phiếu nháp"}</button></div>
        </div>
        <div className="border border-slate-200 p-4">
          <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-slate-900">Nhà cung cấp đang dùng</h4><span className="text-xs text-slate-500">{suppliers.length}</span></div>
          <div className="mt-3 divide-y divide-slate-100 border-y border-slate-200">{suppliers.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Chưa có nhà cung cấp.</p> : suppliers.map((item) => <div key={item._id} className="flex items-center justify-between gap-3 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{item.name}</p><p className="font-mono text-xs text-slate-500">{item.code}</p></div><button type="button" onClick={() => openSupplierManagement(item, "edit")} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Sửa nhà cung cấp" aria-label={`Sửa ${item.name}`}><Pencil className="h-4 w-4" /></button></div>)}</div>
        </div>
      </div>

      <div className="overflow-x-auto border-y border-slate-200"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3 font-medium">Mã phiếu</th><th className="px-3 py-3 font-medium">Nhà cung cấp</th><th className="px-3 py-3 font-medium">Ngày tạo</th><th className="px-3 py-3 text-right font-medium">Giá trị</th><th className="px-3 py-3 font-medium">Trạng thái</th><th className="px-3 py-3 text-right font-medium">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{receipts.length === 0 ? <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-500">Chưa có phiếu nhập.</td></tr> : receipts.map((receipt) => <tr key={receipt._id}><td className="px-3 py-3 font-mono text-xs text-slate-700">{receipt.receiptCode}</td><td className="px-3 py-3 text-slate-700">{receipt.supplierName}</td><td className="px-3 py-3 text-slate-500">{new Date(receipt.createdAt).toLocaleDateString("vi-VN")}</td><td className="px-3 py-3 text-right tabular-nums text-slate-700">{money(receipt.subtotal)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${receipt.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : receipt.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{receipt.status === "confirmed" ? "Đã xác nhận" : receipt.status === "draft" ? "Nháp" : "Đã hủy"}</span></td><td className="px-3 py-3 text-right">{receipt.status === "draft" && <span className="inline-flex gap-1"><button type="button" onClick={() => void confirm(receipt)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50" title="Xác nhận"><Check className="h-4 w-4" /></button><button type="button" onClick={() => void cancel(receipt)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></span>}</td></tr>)}</tbody></table></div>

      {supplierManagementOpen && <SupplierManagementModal initialSupplier={editingSupplier} initialMode={supplierManagementMode} onClose={() => setSupplierManagementOpen(false)} onSaved={(supplier) => { void load(supplier.status === "active" ? supplier._id : undefined); }} onDeleted={() => { void load(); }} />}
    </section>
  );
}
