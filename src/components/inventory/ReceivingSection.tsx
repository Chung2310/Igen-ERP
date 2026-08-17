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
  const [editorOpen, setEditorOpen] = useState(false);
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
    setEditorOpen(true);
  };

  const startEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setMode("edit");
    setForm(supplierToForm(supplier));
    setEditorOpen(true);
  };

  const startView = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setMode("view");
    setForm(supplierToForm(supplier));
    setEditorOpen(true);
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
      if (editingSupplier?._id === supplier._id) setEditorOpen(false);
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

        <div className="min-h-0 overflow-y-auto p-5">
          {editorOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
          <form onSubmit={saveSupplier} className="max-h-[92vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
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
                <input value={form.taxCode} onChange={(event) => updateForm("taxCode", event.target.value)} readOnly={isReadOnly} placeholder="Ví dụ: 0312345678" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
              </label>
              <label className="text-xs text-slate-600">
                Số điện thoại
                <input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} readOnly={isReadOnly} placeholder="Ví dụ: 0901 234 567" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
              </label>
            </div>
            <label className="block text-xs text-slate-600">
              Thư điện tử
              <input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} readOnly={isReadOnly} placeholder="Ví dụ: contact@abc.com" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            <label className="block text-xs text-slate-600">
              Địa chỉ
              <input value={form.address} onChange={(event) => updateForm("address", event.target.value)} readOnly={isReadOnly} placeholder="Ví dụ: 123 Nguyễn Huệ, Quận 1, TP.HCM" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            <label className="block text-xs text-slate-600">
              Điều khoản thanh toán
              <input value={form.paymentTerms} onChange={(event) => updateForm("paymentTerms", event.target.value)} readOnly={isReadOnly} placeholder="Ví dụ: Thanh toán trong 30 ngày" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
            </label>
            <label className="block text-xs text-slate-600">
              Ghi chú
              <textarea rows={2} value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} readOnly={isReadOnly} placeholder="Ghi chú thêm về nhà cung cấp" className="mt-1 w-full resize-y rounded-md border border-slate-200 px-3 py-2 text-sm read-only:bg-slate-50" />
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
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Đóng</button>
              {isReadOnly ? <button type="button" onClick={() => editingSupplier && startEdit(editingSupplier)} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"><Pencil className="h-4 w-4" />Sửa</button> : <button type="submit" disabled={saving} className="inline-flex items-center rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-50">{saving ? "Đang lưu..." : mode === "edit" ? "Lưu thay đổi" : "Tạo nhà cung cấp"}</button>}
            </div>
          </form></div>}

          <div className="min-w-0">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Danh sách nhà cung cấp ({filteredSuppliers.length})</h3>
                <p className="mt-1 text-xs text-slate-500">Dữ liệu dùng chung cho toàn công ty.</p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto"><button type="button" onClick={startCreate} className="shrink-0 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">Tạo nhà cung cấp</button><div className="relative min-w-0 flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm tên, mã, điện thoại" className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm" />
              </div></div>
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
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [supplierManagementOpen, setSupplierManagementOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierManagementMode, setSupplierManagementMode] = useState<SupplierEditorMode>("create");
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
          <p className="mt-1 text-sm text-slate-500">Khai báo sản phẩm mua từ nhà cung cấp để tăng tồn kho thực tế.</p>
        </div>
        <div className="flex gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openSupplierManagement()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" title="Quản lý nhà cung cấp">
            <ContactRound className="h-4 w-4" />
            Nhà cung cấp
          </button>
          <button type="button" onClick={() => setCreatorOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
            <PackagePlus className="h-4 w-4" />
            Tạo phiếu nhập mới
          </button>
          <button type="button" onClick={() => void load()} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" title="Làm mới" aria-label="Làm mới">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200"><tr><th className="px-4 py-3.5 font-medium">Mã phiếu</th><th className="px-4 py-3.5 font-medium">Nhà cung cấp</th><th className="px-4 py-3.5 font-medium">Ngày tạo</th><th className="px-4 py-3.5 text-right font-medium">Giá trị</th><th className="px-4 py-3.5 font-medium">Trạng thái</th><th className="px-4 py-3.5 text-right font-medium">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-200">{loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Đang tải dữ liệu...</td></tr> : receipts.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Chưa có phiếu nhập.</td></tr> : receipts.map((receipt) => <tr key={receipt._id} className="hover:bg-slate-50"><td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-600">{receipt.receiptCode}</td><td className="px-4 py-3.5 font-medium text-slate-800">{receipt.supplierName}</td><td className="px-4 py-3.5 text-slate-500">{new Date(receipt.createdAt).toLocaleDateString("vi-VN")}</td><td className="px-4 py-3.5 text-right tabular-nums font-semibold text-slate-900">{money(receipt.subtotal)}</td><td className="px-4 py-3.5"><ReceiptStatus status={receipt.status} /></td><td className="px-4 py-3.5 text-right"><span className="inline-flex gap-1"><button type="button" onClick={() => setViewingReceipt(receipt)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Xem chi tiết phiếu"><Eye className="h-4 w-4" /></button>{receipt.status === "draft" && <><button type="button" onClick={() => void submit(receipt)} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-amber-700 hover:bg-amber-50" title="Gửi chờ xác nhận">Gửi</button><button type="button" onClick={() => void cancel(receipt)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "pending" && <><button type="button" onClick={() => void startReceiving(receipt)} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-sky-700 hover:bg-sky-50" title="Bắt đầu nhập kho">Nhập kho</button><button type="button" onClick={() => void cancel(receipt)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "receiving" && <button type="button" onClick={() => void confirm(receipt)} className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700" title="Hoàn thành nhập kho"><Check className="h-3.5 w-3.5" />Hoàn thành</button>}</span></td></tr>)}</tbody></table></div>

      {supplierManagementOpen && <SupplierManagementModal initialSupplier={editingSupplier} initialMode={supplierManagementMode} onClose={() => setSupplierManagementOpen(false)} onSaved={() => void load()} onDeleted={() => void load()} />}
      {creatorOpen && <ReceiptCreatorModal onClose={() => setCreatorOpen(false)} onSaved={async () => { setCreatorOpen(false); await load(); }} />}
      {viewingReceipt && <ReceiptDetailModal receipt={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
    </section>
  );
}

function ReceiptStatus({ status }: { status: GoodsReceipt["status"] }) { const details = { draft: ["Nháp", "bg-slate-100 text-slate-600"], pending: ["Chờ xác nhận", "bg-amber-50 text-amber-700"], receiving: ["Đang nhập kho", "bg-sky-50 text-sky-700"], confirmed: ["Hoàn thành", "bg-emerald-50 text-emerald-700"], cancelled: ["Đã hủy", "bg-rose-50 text-rose-700"] } as const; const [label, className] = details[status]; return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{label}</span>; }
function ReceiptActions({ receipt, onView, onSubmit, onStart, onConfirm, onCancel }: { receipt: GoodsReceipt; onView: () => void; onSubmit: () => void; onStart: () => void; onConfirm: () => void; onCancel: () => void }) { return <span className="inline-flex gap-1"><button type="button" onClick={onView} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-cyan-700" title="Xem chi tiết phiếu"><Eye className="h-4 w-4" /></button>{receipt.status === "draft" && <><button type="button" onClick={onSubmit} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-amber-700 hover:bg-amber-50" title="Gửi chờ xác nhận">Gửi</button><button type="button" onClick={onCancel} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "pending" && <><button type="button" onClick={onStart} className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-sky-700 hover:bg-sky-50" title="Bắt đầu nhập kho">Nhập kho</button><button type="button" onClick={onCancel} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" title="Hủy phiếu"><X className="h-4 w-4" /></button></>}{receipt.status === "receiving" && <button type="button" onClick={onConfirm} className="inline-flex h-8 items-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-medium text-white hover:bg-emerald-700" title="Hoàn thành nhập kho"><Check className="h-3.5 w-3.5" />Hoàn thành</button>}</span>; }
function ReceiptDetailModal({ receipt, onClose }: { receipt: GoodsReceipt; onClose: () => void }) { return <Modal title={`Chi tiết phiếu nhập ${receipt.receiptCode}`} onClose={onClose} wide><div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{receipt.supplierName}</p><p className="mt-1 text-xs text-slate-500">Ngày tạo: {new Date(receipt.createdAt).toLocaleString("vi-VN")}</p></div><ReceiptStatus status={receipt.status} /></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Sản phẩm</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">Số lượng</th><th className="px-4 py-3 text-right">Đơn giá</th><th className="px-4 py-3 text-right">Thành tiền</th></tr></thead><tbody className="divide-y divide-slate-100">{receipt.items.map((item, index) => <tr key={`${item.variantId}-${index}`}><td className="px-4 py-3 font-medium text-slate-800">{item.productName}</td><td className="px-4 py-3 font-mono text-xs text-slate-600">{item.sku}</td><td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td><td className="px-4 py-3 text-right tabular-nums">{money(item.unitCost)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{money(item.lineTotal)}</td></tr>)}</tbody></table></div><div className="flex justify-end border-t border-slate-200 pt-4"><button type="button" onClick={onClose} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Đóng</button></div></div></Modal>; }

function SearchableSelect({ options, value, onChange, onQueryChange, placeholder, disabled }: { options: { value: string; label: string }[]; value: string; onChange: (val: string) => void; onQueryChange?: (query: string) => void; placeholder: string; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const inputValue = isOpen ? query : selected?.label || "";

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return options;
    return options.filter((o) => o.label.toLocaleLowerCase("vi").includes(term));
  }, [options, query]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={inputValue}
        onFocus={() => { setQuery(""); onQueryChange?.(""); setIsOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); onQueryChange?.(e.target.value); setIsOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setIsOpen(false);
          if (e.key === "Enter" && isOpen) {
            e.preventDefault();
            if (matches.length > 0) { onChange(matches[0].value); setIsOpen(false); }
          }
        }}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 disabled:bg-slate-50 disabled:text-slate-500"
      />
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">Không tìm thấy kết quả.</div>
          ) : (
            matches.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 outline-none truncate"
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ReceiptCreatorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productDetails, setProductDetails] = useState<Record<string, CatalogProductDetail>>({});
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [nextSuppliers, nextProducts] = await Promise.all([
        inventoryReceivingService.listSuppliers({ status: "active" }),
        productCatalogService.listProducts({ status: "active", limit: 20 }),
      ]);
      setSuppliers(nextSuppliers);
      setProducts(nextProducts.items);
      if (nextSuppliers.length > 0) setSupplierId(nextSuppliers[0]._id);
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
    setLines((current) => [...current, { key: `${variant._id}-${Date.now()}`, productId, variantId, sku: variant.sku, productName: product.name, displayName: variant.displayName || variant.sku, quantity: parsedQuantity, unitCost: parsedCost, trackingMode: variant.trackingMode }]);
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

  const updateSerials = (key: string, value: string) => {
    const serialNumbers = value.split(/[\n,;]+/).map((serial) => serial.trim()).filter(Boolean);
    setLines((current) => current.map((line) => line.key === key ? { ...line, serialNumbers } : line));
  };

  const updateUnitBarcodes = (key: string, value: string) => {
    const internalBarcodes = value.split(/[\n,;]+/).map((barcode) => barcode.trim()).filter(Boolean);
    setLines((current) => current.map((line) => line.key === key ? { ...line, unitDetails: internalBarcodes.map((internalBarcode) => ({ internalBarcode })) } : line));
  };

  const generateUnitBarcodes = (line: DraftLine) => {
    const token = line.sku.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const unitDetails = Array.from({ length: Math.ceil(line.quantity) }, (_, index) => ({ internalBarcode: `IG-${token}-${date}-${String(index + 1).padStart(6, "0")}` }));
    setLines((current) => current.map((item) => item.key === line.key ? { ...item, unitDetails } : item));
  };

  const saveReceipt = async () => {
    if (!supplierId || lines.length === 0) {
      toast.error("Chọn nhà cung cấp và ít nhất một sản phẩm.");
      return;
    }
      const invalidSerialLine = lines.filter((line) => line.trackingMode === "serial").find((line) => {
        const serials = line.serialNumbers || [];
        return !Number.isInteger(line.quantity) || serials.length !== line.quantity || new Set(serials.map((serial) => serial.trim().toUpperCase())).size !== serials.length;
      });
      if (invalidSerialLine) {
        toast.error(`SKU ${invalidSerialLine.sku} phải có đủ serial duy nhất theo số lượng.`);
        return;
      }
      const invalidUnitLine = lines.filter((line) => line.trackingMode === "unit_barcode").find((line) => {
        const details = line.unitDetails || [];
        return !Number.isInteger(line.quantity) || details.length !== line.quantity || new Set(details.map((detail) => detail.internalBarcode.trim().toUpperCase())).size !== details.length;
      });
      if (invalidUnitLine) {
        toast.error(`SKU ${invalidUnitLine.sku} phải có đủ mã vạch nội bộ duy nhất theo số lượng.`);
        return;
      }
      setSaving(true);
    try {
      await inventoryReceivingService.createReceipt({ supplierId, notes: notes.trim() || undefined, items: lines.map(({ key: _key, displayName: _displayName, ...line }) => line) });
      toast.success("Đã tạo phiếu nhập ở trạng thái Nháp. Hãy xác nhận để nhập kho.");
      await onSaved();
    } catch (error: any) {
      toast.error(error?.message || "Không thể tạo phiếu nhập.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Tạo phiếu nhập mới" onClose={onClose} wide>
      <div className="bg-slate-50/50 -m-5 p-5">
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nhà cung cấp</label>
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600">
              <option value="">Chọn nhà cung cấp</option>
              {suppliers.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}
            </select>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Thêm sản phẩm vào phiếu</h4>
            <div className="grid gap-4 sm:grid-cols-12 items-end">
              <div className="sm:col-span-5">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Sản phẩm</label>
                <SearchableSelect
                  placeholder="Tìm kiếm sản phẩm..."
                  value={productId}
                  onChange={(id) => { setProductId(id); setVariantId(""); }}
                  onQueryChange={setProductSearch}
                  options={products.map((p) => ({ value: p._id, label: `${p.name} (${p.productCode})` }))}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Mã SKU</label>
                <SearchableSelect
                  disabled={!productId || variants.length === 0}
                  placeholder="Chọn SKU..."
                  value={variantId}
                  onChange={setVariantId}
                  options={variants.map((v) => ({ value: v._id, label: `${v.sku}${v.displayName ? ` - ${v.displayName}` : ""}` }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Số lượng</label>
                <input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 bg-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Giá nhập</label>
                <input type="number" min="0" step="1" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 bg-white" />
              </div>
              <div className="sm:col-span-1">
                <button type="button" onClick={addLine} className="inline-flex h-[38px] w-full items-center justify-center rounded-md bg-cyan-700 text-white hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-1" title="Thêm dòng"><PackagePlus className="h-5 w-5" /></button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900">Danh sách nhập ({lines.length} dòng)</h4>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sản phẩm</th>
                    <th className="px-4 py-3 font-medium">SKU</th><th className="px-4 py-3 font-medium">Mã vạch</th>
                    <th className="px-4 py-3 text-right font-medium">Số lượng</th>
                    <th className="px-4 py-3 font-medium">IMEI / serial</th>
                    <th className="px-4 py-3 text-right font-medium">Đơn giá</th>
                    <th className="px-4 py-3 text-right font-medium">Thành tiền</th>
                    <th className="px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">Chưa có sản phẩm trong phiếu.</td></tr> : lines.map((line) => (
                    <tr key={line.key}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{line.productName}</p>
                        <p className="text-xs text-slate-500">{line.displayName}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{line.sku}</td><td className="px-4 py-3 text-xs text-slate-600">{line.barcode || "Chưa có mã vạch"}</td>
                      <td className="px-4 py-3 text-right"><input type="text" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} className="w-24 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-right tabular-nums text-sm text-slate-700 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600" aria-label={`Số lượng ${line.sku}`} /></td>
                      <td className="px-4 py-3"><textarea disabled={line.trackingMode !== "serial"} rows={2} value={(line.serialNumbers || []).join("\n")} onChange={(event) => updateSerials(line.key, event.target.value)} placeholder={line.trackingMode === "serial" ? "Mỗi mã một dòng" : "Không áp dụng"} className="w-44 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 disabled:bg-slate-100 disabled:text-slate-400" aria-label={`IMEI serial ${line.sku}`} />{line.trackingMode === "unit_barcode" && <div className="mt-2"><textarea rows={2} value={(line.unitDetails || []).map((detail) => detail.internalBarcode).join("\n")} onChange={(event) => updateUnitBarcodes(line.key, event.target.value)} placeholder="Mã vạch từng đơn vị" className="w-44 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1.5 text-xs outline-none focus:border-cyan-600" aria-label={`Mã vạch từng đơn vị ${line.sku}`} /><button type="button" onClick={() => generateUnitBarcodes(line)} className="mt-1 text-xs font-medium text-cyan-700 hover:text-cyan-900">Sinh tự động</button></div>}</td>
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ghi chú phiếu nhập</label>
            <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Nhập ghi chú hoặc thông tin tham chiếu..." className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600" />
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
                {saving ? "Đang xử lý..." : "Nhập kho"}
              </button>
            </div>
          </div>
        </div>
      </div>
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
