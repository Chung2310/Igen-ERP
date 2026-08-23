import { Search } from "lucide-react";
import type { Customer, CustomerStatus, CustomerType } from "../types";

type Props = {
  items: Customer[]; total: number; page: number; limit: number;
  query: string; status: CustomerStatus; type: "" | CustomerType;
  onQueryChange: (value: string) => void; onStatusChange: (value: CustomerStatus) => void;
  onTypeChange: (value: "" | CustomerType) => void; onPageChange: (value: number) => void;
  onOpen: (customer: Customer) => void;
};

export default function CustomerList(props: Props) {
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
      <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Tìm khách hàng" value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Mã, tên, số điện thoại hoặc email" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm" /></label>
      <select aria-label="Trạng thái" value={props.status} onChange={(event) => props.onStatusChange(event.target.value as CustomerStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option></select>
      <select aria-label="Loại khách" value={props.type} onChange={(event) => props.onTypeChange(event.target.value as "" | CustomerType)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Tất cả loại khách</option><option value="regular">Khách thường</option><option value="vat">Khách xuất VAT</option></select>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Mã khách</th><th className="p-3">Khách hàng</th><th className="p-3">Điện thoại</th><th className="p-3">Hạng</th><th className="p-3">Loại</th><th className="p-3">Trạng thái</th><th className="p-3 text-right">Thao tác</th></tr></thead>
      <tbody>{props.items.map((customer) => <tr key={customer._id} className="border-t border-slate-100"><td className="p-3 font-semibold text-cyan-700">{customer.customerCode}</td><td className="p-3"><p className="font-semibold">{customer.name}</p><p className="text-xs text-slate-500">{customer.email || "—"}</p></td><td className="p-3">{customer.phone}</td><td className="p-3">{customer.tier ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{customer.tier.name}</span> : <span className="text-xs text-slate-400">Chưa xếp hạng</span>}</td><td className="p-3">{customer.type === "vat" ? "Xuất VAT" : "Khách thường"}</td><td className="p-3">{customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</td><td className="p-3 text-right"><button type="button" aria-label={`Chi tiết ${customer.name}`} onClick={() => props.onOpen(customer)} className="font-semibold text-cyan-700">Chi tiết</button></td></tr>)}</tbody></table>
      {!props.items.length && <p className="p-10 text-center text-sm text-slate-500">Chưa có khách hàng phù hợp.</p>}
    </div>
    <div className="flex items-center justify-between text-sm text-slate-600"><span>{props.total} khách hàng</span><div className="flex gap-2"><button type="button" disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={props.page * props.limit >= props.total} onClick={() => props.onPageChange(props.page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div>
  </div>;
}
