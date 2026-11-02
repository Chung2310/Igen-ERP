import { ChevronLeft, ChevronRight, Search, UsersRound } from "lucide-react";
import type { Customer, CustomerStatus, CustomerType } from "../types";

type Props = {
  items: Customer[]; total: number; page: number; limit: number;
  query: string; status: CustomerStatus; type: "" | CustomerType;
  onQueryChange: (value: string) => void; onStatusChange: (value: CustomerStatus) => void;
  onTypeChange: (value: "" | CustomerType) => void; onPageChange: (value: number) => void;
  onOpen: (customer: Customer) => void;
};

export default function CustomerList(props: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
        <label className="relative block">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input aria-label="Tìm khách hàng" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Mã, tên, số điện thoại hoặc email" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100" />
        </label>
        <select aria-label="Trạng thái" value={props.status} onChange={(event) => props.onStatusChange(event.target.value as CustomerStatus)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100"><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select>
        <select aria-label="Loại khách" value={props.type} onChange={(event) => props.onTypeChange(event.target.value as "" | CustomerType)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#00adfc] focus:ring-2 focus:ring-sky-100"><option value="">Tất cả loại khách</option><option value="regular">Khách thường</option><option value="vat">Khách xuất VAT</option></select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-600">
            <tr><th className="px-4 py-3.5">Mã khách</th><th className="px-4 py-3.5">Khách hàng</th><th className="px-4 py-3.5">Điện thoại</th><th className="px-4 py-3.5">Hạng</th><th className="px-4 py-3.5">Loại</th><th className="px-4 py-3.5">Trạng thái</th><th className="px-4 py-3.5 text-right">Thao tác</th></tr>
          </thead>
          <tbody>
            {props.items.map((customer) => (
              <tr key={customer._id} className="border-t border-slate-100 text-slate-700 transition hover:bg-sky-50/40">
                <td className="px-4 py-4 font-semibold text-[#007eb8]">{customer.customerCode}</td>
                <td className="px-4 py-4"><p className="font-semibold text-slate-900">{customer.name}</p><p className="mt-0.5 text-xs text-slate-500">{customer.email || "—"}</p></td>
                <td className="px-4 py-4 tabular-nums">{customer.phone}</td>
                <td className="px-4 py-4">{customer.tier ? <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{customer.tier.name}</span> : <span className="text-xs text-slate-400">Chưa xếp hạng</span>}</td>
                <td className="px-4 py-4"><p>{customer.customerKind === 'business' ? 'Doanh nghiệp / tổ chức' : customer.customerKind === 'individual' ? 'Cá nhân' : 'Chưa phân loại'}</p><p className="mt-1 text-xs text-slate-500">{customer.type === "vat" ? "Xuất VAT" : "Thông thường"}</p></td>
                <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${customer.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td>
                <td className="px-4 py-4 text-right"><button type="button" aria-label={`Chi tiết ${customer.name}`} onClick={() => props.onOpen(customer)} className="rounded-lg px-3 py-1.5 font-semibold text-[#007eb8] transition hover:bg-sky-50">Chi tiết</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.items.length && <div className="flex flex-col items-center px-4 py-12 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-[#0098dc]"><UsersRound className="h-6 w-6" /></span><p className="mt-3 text-sm font-medium text-slate-600">Chưa có khách hàng phù hợp.</p></div>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>{props.total} khách hàng</span>
        <div className="flex gap-2">
          <button type="button" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Trước</button>
          <button type="button" disabled={props.page * props.limit >= props.total} onClick={() => props.onPageChange(props.page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Sau<ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
