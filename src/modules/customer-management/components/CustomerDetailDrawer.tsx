import { X } from "lucide-react";
import type { Customer } from "../types";
import BillingProfilesPanel from "./BillingProfilesPanel";
import CustomerPurchaseHistoryPanel from "./CustomerPurchaseHistoryPanel";

const spend = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export default function CustomerDetailDrawer({ customer, branchId, canManage, onClose, onEdit, onToggleStatus }: { customer: Customer; branchId?: string; canManage: boolean; onClose: () => void; onEdit: () => void; onToggleStatus: () => void }) {
  const rows = [["Mã khách", customer.customerCode], ["Điện thoại", customer.phone], ["Email", customer.email || "—"], ["Ngày sinh", customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString("vi-VN") : "—"], ["Địa chỉ", customer.address || "—"], ["Hạng", customer.tier ? `${customer.tier.name}${typeof customer.tierTotalSales === "number" ? ` · đã chi tiêu ${spend.format(customer.tierTotalSales)}` : ""}` : "Chưa xếp hạng"], ["Loại khách", customer.type === "vat" ? "Xuất VAT" : "Khách thường"], ["Trạng thái", customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"]];
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40">
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.18)]" role="dialog" aria-modal="true" aria-label="Chi tiết khách hàng">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3"><span className="mt-1 h-8 w-1 rounded-full bg-[#00adfc]" aria-hidden="true" /><div><h2 className="text-xl font-semibold tracking-tight text-slate-900">{customer.name}</h2><p className="mt-1 text-sm text-slate-500">Hồ sơ dùng chung toàn công ty</p></div></div>
          <button type="button" aria-label="Đóng chi tiết" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Thông tin khách hàng</h3>
          <dl className="grid gap-2.5 sm:grid-cols-2">
            {rows.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>)}
          </dl>
          {customer.notes && <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm"><p className="font-semibold text-slate-800">Ghi chú</p><p className="mt-1 whitespace-pre-wrap text-slate-600">{customer.notes}</p></div>}
          <BillingProfilesPanel customerId={customer._id} companyCode={customer.companyCode} canManage={canManage} />
          <CustomerPurchaseHistoryPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} />
        </div>
        {canManage && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3.5 sm:px-6"><button type="button" onClick={onToggleStatus} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{customer.status === "active" ? "Ngừng hoạt động" : "Kích hoạt lại"}</button><button type="button" onClick={onEdit} className="rounded-lg bg-[#00ADFC] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0095d9]">Sửa hồ sơ</button></div>}
      </aside>
    </div>
  );
}
