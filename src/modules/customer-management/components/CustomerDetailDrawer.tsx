import React from "react";
import { X } from "lucide-react";
import type { Customer } from "../types";
import BillingProfilesPanel from "./BillingProfilesPanel";
import CustomerPurchaseHistoryPanel from "./CustomerPurchaseHistoryPanel";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function CustomerDetailDrawer({ customer, branchId, canManage, onClose, onEdit, onToggleStatus }: { customer: Customer; branchId?: string; canManage: boolean; onClose: () => void; onEdit: () => void; onToggleStatus: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const rows = [["Mã khách", customer.customerCode], ["Điện thoại", customer.phone], ["Email", customer.email || "—"], ["Ngày sinh", customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString("vi-VN") : "—"], ["Địa chỉ", customer.address || "—"], ["Hạng", customer.tier ? `${customer.tier.name}${typeof customer.tierGrossProfit === "number" ? ` · lãi gộp ${currency.format(customer.tierGrossProfit)}` : ""}` : "Chưa xếp hạng"], ["Loại khách", customer.type === "vat" ? "Xuất VAT" : "Khách thường"], ["Trạng thái", customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"]];

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeElement = document.activeElement;
    returnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      returnFocusRef.current?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="customer-detail-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-on-surface backdrop:bg-black/40"
    >
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-surface-container-lowest text-on-surface shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3"><span className="mt-1 h-8 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" /><div className="min-w-0"><h2 id="customer-detail-title" className="break-words text-xl font-semibold text-on-surface text-balance">{customer.name}</h2><p className="mt-1 text-sm text-on-surface-variant">Hồ sơ dùng chung toàn công ty</p></div></div>
          <button type="button" aria-label="Đóng chi tiết" onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <h3 className="mb-3 text-sm font-semibold text-on-surface text-balance">Thông tin khách hàng</h3>
          <dl className="grid gap-2.5 sm:grid-cols-2">
            {rows.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-low px-3.5 py-3"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-on-surface">{value}</dd></div>)}
          </dl>
          {customer.notes && <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm"><p className="font-semibold text-on-surface">Ghi chú</p><p className="mt-1 whitespace-pre-wrap text-on-surface-variant text-pretty">{customer.notes}</p></div>}
          <BillingProfilesPanel customerId={customer._id} companyCode={customer.companyCode} canManage={canManage} />
          <CustomerPurchaseHistoryPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} />
        </div>
        {canManage && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest px-5 pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:px-6"><button type="button" onClick={onToggleStatus} className="rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{customer.status === "active" ? "Ngừng hoạt động" : "Kích hoạt lại"}</button><button type="button" onClick={onEdit} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Sửa hồ sơ</button></div>}
      </aside>
    </dialog>
  );
}
