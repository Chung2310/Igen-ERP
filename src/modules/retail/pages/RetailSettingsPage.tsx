import React from "react";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { retailSettingsApi } from "../api/retailSettings.api";
import type { RetailSettings } from "../types";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import RetailReceiptPrinter from "../components/pos/RetailReceiptPrinter";
import type { RetailInvoice } from "../types";

export default function RetailSettingsPage() {
  const { userProfile } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [settings, setSettings] = React.useState<RetailSettings | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const previewRef = React.useRef<HTMLDialogElement>(null);
  const companyCode = userProfile?.companyCode || "";

  React.useEffect(() => {
    const dialog = previewRef.current;
    if (previewOpen && dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }, [previewOpen]);

  React.useEffect(() => {
    if (!companyCode || !activeBranchId) return;
    setError(""); setMessage(""); setSettings(null); setPreviewOpen(false);
    void retailSettingsApi.get({ companyCode, branchId: activeBranchId })
      .then((value) => setSettings(value))
      .catch((cause) => setError(getApiErrorMessage(cause, "Không tải được cài đặt.")));
  }, [companyCode, activeBranchId]);

  if (!activeBranchId) return <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface">Vui lòng chọn chi nhánh.</div>;
  if (!settings) return <div role={error ? "alert" : "status"} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-on-surface">{error || "Đang tải cài đặt bán lẻ..."}</div>;

  const update = <K extends keyof RetailSettings>(key: K, value: RetailSettings[K]) => { setMessage(""); setSettings((current) => current ? { ...current, [key]: value } : current); };
  const save = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      const { companyCode: _companyCode, branchId: _branchId, ...input } = settings;
      setSettings(await retailSettingsApi.update(input, { companyCode, branchId: activeBranchId }));
      setMessage("Đã lưu cài đặt máy in và bán lẻ cho chi nhánh này.");
    } catch (cause) { setError(getApiErrorMessage(cause, "Không lưu được cài đặt.")); }
    finally { setSaving(false); }
  };

  const closePreview = () => { previewRef.current?.close?.(); setPreviewOpen(false); };
  const storeName = userProfile?.companyName || companyCode;
  const testInvoice: RetailInvoice = {
    _id: "printer-test", orderId: "printer-test", orderCode: `${settings.orderPrefix}-IN-THU`,
    invoiceNo: `${settings.invoicePrefix}-IN-THU`, issuedAt: new Date().toISOString(), status: "issued",
    snapshot: {
      store: { legalName: storeName, storeName, branchCode: activeBranch?.code || "", branchName: activeBranch?.name || "", branchAddress: activeBranch?.address, branchPhone: activeBranch?.phone },
      customerName: "Khách hàng in thử", cashierName: userProfile?.displayName || "Nhân viên bán hàng",
      businessDate: new Date().toISOString().slice(0, 10),
      items: [{ productId: "printer-test-item", sku: "SP-IN-THU", productName: "Sản phẩm mẫu", unit: "cái", quantity: 1, unitPrice: 100_000, discountAmount: 0, lineTotal: 100_000 }],
      subtotal: 100_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0,
      grandTotal: 100_000, paidAmount: 100_000, dueAmount: 0, paymentStatus: "paid",
      payments: [{ method: "cash", amount: 100_000 }], amountInWords: "Một trăm nghìn đồng",
    },
  };

  return (
    <section className="space-y-5 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface sm:p-6">
      <div><h1 className="text-balance text-xl font-bold">Cài đặt bán lẻ</h1><p className="text-pretty text-sm text-on-surface-variant">Áp dụng riêng cho chi nhánh đang chọn.</p></div>
      <label className="flex items-center gap-3 text-sm font-semibold"><input aria-label="Cho phép bán âm kho" type="checkbox" checked={settings.allowNegativeStock} onChange={(event) => update("allowNegativeStock", event.target.checked)} />Cho phép bán âm kho</label>
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField label="Giảm giá tối đa (%)" value={settings.maxDiscountPercent} step="0.01" onChange={(value) => update("maxDiscountPercent", value)} />
        <NumberField label="Thuế suất mặc định (%)" value={settings.defaultTaxRate} step="0.01" onChange={(value) => update("defaultTaxRate", value)} />
        <NumberField label="Ngưỡng chênh lệch cần giải trình (VNĐ)" value={settings.varianceReasonThreshold} step="1" onChange={(value) => update("varianceReasonThreshold", value)} />
        <TextField label="Prefix mã đơn" value={settings.orderPrefix} onChange={(value) => update("orderPrefix", value.toUpperCase())} />
        <TextField label="Prefix hóa đơn" value={settings.invoicePrefix} onChange={(value) => update("invoicePrefix", value.toUpperCase())} />
      </div>
      <section aria-labelledby="retail-printer-title" className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
        <div><h2 id="retail-printer-title" className="text-balance text-base font-semibold">Cài đặt máy in hóa đơn</h2><p className="text-pretty text-sm text-on-surface-variant">Khổ giấy được lưu theo chi nhánh và dùng khi in tại POS hoặc in lại hóa đơn. Chọn máy in vật lý trong hộp thoại in của trình duyệt.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Khổ giấy hóa đơn" value={settings.invoicePaperSize} options={[{ value: "58mm", label: "58 mm · máy in bill nhỏ" }, { value: "80mm", label: "80 mm · máy in bill" }, { value: "A5", label: "A5" }, { value: "A4", label: "A4" }]} onChange={(value) => update("invoicePaperSize", value as RetailSettings["invoicePaperSize"])} />
          <SelectField label="Mẫu hóa đơn" value={settings.invoiceTemplate} options={[{ value: "standard", label: "Tiêu chuẩn" }]} onChange={(value) => update("invoiceTemplate", value as RetailSettings["invoiceTemplate"])} />
        </div>
        <button type="button" onClick={() => setPreviewOpen(true)} className="min-h-11 rounded-xl border border-outline px-4 text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary">Xem trước và in thử</button>
      </section>
      {error && <p role="alert" className="text-sm font-medium text-error">{error}</p>}
      {message && <p role="status" className="text-sm font-medium text-on-surface">{message}</p>}
      <button type="button" disabled={saving} onClick={() => void save()} className="min-h-11 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">{saving ? "Đang lưu..." : "Lưu cài đặt"}</button>
      {previewOpen && <dialog ref={previewRef} aria-labelledby="printer-preview-title" onClose={() => setPreviewOpen(false)} open={typeof HTMLDialogElement.prototype.showModal !== "function"} className="max-h-dvh w-full max-w-3xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface backdrop:bg-on-surface/60">
        <div className="retail-no-print flex items-center justify-between gap-3 border-b border-outline-variant p-4"><div><h2 id="printer-preview-title" className="text-balance text-lg font-semibold">In thử hóa đơn</h2><p className="text-sm text-on-surface-variant">Dữ liệu mẫu · khổ giấy {settings.invoicePaperSize}. Không tạo đơn bán thật.</p></div><button type="button" onClick={closePreview} className="min-h-11 rounded-lg border border-outline px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary">Đóng</button></div>
        <div className="overflow-x-auto bg-surface-container-low p-4"><RetailReceiptPrinter invoice={testInvoice} paperSize={settings.invoicePaperSize} /></div>
        <div className="retail-no-print flex justify-end gap-2 border-t border-outline-variant p-4"><button type="button" onClick={closePreview} className="min-h-11 rounded-lg border border-outline px-4 text-sm focus-visible:outline-2 focus-visible:outline-primary">Đóng</button><button type="button" onClick={() => window.print()} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary">In thử</button></div>
      </dialog>}
    </section>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: string; onChange: (value: number) => void }) {
  return <label className="space-y-1 text-sm font-semibold text-on-surface"><span>{label}</span><input className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" type="number" min="0" max={label.includes("%") ? "100" : undefined} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-sm font-semibold text-on-surface"><span>{label}</span><input className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 uppercase text-on-surface focus-visible:outline-2 focus-visible:outline-primary" maxLength={8} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="space-y-1 text-sm font-semibold text-on-surface"><span>{label}</span><select className="min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-on-surface focus-visible:outline-2 focus-visible:outline-primary" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
