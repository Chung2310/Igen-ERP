import React from "react";
import { Plus, Search, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { retailCustomersApi } from "../api/retailCustomers.api";
import type { RetailCustomer, RetailCustomerDetail } from "../types";
import RetailReceivableHistory from "../components/customers/RetailReceivableHistory";
import RetailReceivableReconciliation from "../components/customers/RetailReceivableReconciliation";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };

export default function RetailCustomersPage() {
  const { userProfile } = useAuth();
  const { activeBranchId } = useBranch();
  const scope = { companyCode: userProfile?.companyCode || "", branchId: activeBranchId };
  const [query, setQuery] = React.useState("");
  const [tier, setTier] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<{ items: RetailCustomer[]; total: number; page: number; limit: number }>({ items: [], total: 0, page: 1, limit: 20 });
  const [editing, setEditing] = React.useState<RetailCustomer | "new" | null>(null);
  const [detail, setDetail] = React.useState<RetailCustomerDetail | null>(null);
  const [error, setError] = React.useState("");
  const canManage = userProfile?.role === "admin" || userProfile?.role === "superadmin" || (userProfile?.permissions || []).some((permission) => permission === "*" || permission === "retail:manager");

  const load = React.useCallback(async () => {
    if (!scope.companyCode || !scope.branchId) return;
    try { setResult(await retailCustomersApi.list(scope, { q: debouncedQuery, tier: tier || undefined, page, limit: 20 })); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được khách hàng."); }
  }, [scope.companyCode, scope.branchId, debouncedQuery, tier, page]);
  React.useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">Khách hàng</h1><p className="text-sm text-slate-500">Hồ sơ dùng chung trong toàn doanh nghiệp.</p></div>
        <button type="button" onClick={() => setEditing("new")} className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />Thêm khách hàng</button>
      </div>
      <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="Tìm khách hàng" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm theo mã, tên hoặc số điện thoại" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm" /></label>
      <select aria-label="Lọc theo hạng" value={tier} onChange={(event) => { setTier(event.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">Tất cả hạng</option><option value="standard">Thành viên</option><option value="silver">Bạc</option><option value="gold">Vàng</option><option value="vip">VIP</option></select>
      {canManage && scope.companyCode && scope.branchId && <RetailReceivableReconciliation scope={scope} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Mã</th><th className="p-3">Tên khách hàng</th><th className="p-3">Điện thoại</th><th className="p-3">Email</th><th className="p-3 text-right">Thao tác</th></tr></thead><tbody>{result.items.map((customer) => <tr key={customer._id} className="border-t border-slate-100"><td className="p-3 font-semibold text-cyan-700">{customer.customerCode}</td><td className="p-3 font-semibold">{customer.name}</td><td className="p-3">{customer.phone || "—"}</td><td className="p-3">{customer.email || "—"}</td><td className="p-3 text-right"><button type="button" onClick={() => void retailCustomersApi.detail(customer._id, scope).then(setDetail)} className="mr-3 font-semibold text-cyan-700">Chi tiết</button><button type="button" onClick={() => setEditing(customer)} className="font-semibold text-slate-700">Sửa</button></td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between text-sm text-slate-600"><span>{result.total} khách hàng</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Trước</button><button type="button" disabled={page * result.limit >= result.total} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sau</button></div></div>
      {editing && <CustomerForm customer={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSave={async (input) => { if (editing === "new") await retailCustomersApi.create(input, scope); else await retailCustomersApi.update(editing._id, input, scope); setEditing(null); await load(); }} />}
      {detail && <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l bg-white p-6 shadow-2xl"><button aria-label="Đóng chi tiết" onClick={() => setDetail(null)} className="float-right"><X /></button><h2 className="text-xl font-bold">{detail.customer.name}</h2><div className="mt-1 flex items-center gap-2"><p className="text-sm text-slate-500">{detail.customer.customerCode}</p><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{detail.summary.tier.name}</span></div><div className="mt-6 grid grid-cols-3 gap-3">{[["Doanh số", detail.summary.totalSales], ["Đã thu", detail.summary.totalCollected], ["Công nợ", detail.summary.currentDebt]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="font-bold">{Number(value).toLocaleString("vi-VN")}đ</div></div>)}</div><RetailReceivableHistory scope={scope} customerId={detail.customer._id} canManage={canManage} /><p className="mt-6 text-sm text-slate-500">Hạng khách hàng được tính tự động từ giao dịch hợp lệ và phần hoàn tiền.</p></aside>}
    </section>
  );
}

function CustomerForm({ customer, onClose, onSave }: { customer?: RetailCustomer; onClose: () => void; onSave: (input: typeof emptyForm) => Promise<void> }) {
  const [form, setForm] = React.useState({ ...emptyForm, ...customer });
  const [saving, setSaving] = React.useState(false);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><form onSubmit={(event) => { event.preventDefault(); setSaving(true); void onSave(form).finally(() => setSaving(false)); }} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6"><div className="flex justify-between"><h2 className="text-lg font-bold">{customer ? "Sửa khách hàng" : "Thêm khách hàng"}</h2><button type="button" aria-label="Đóng" onClick={onClose}><X /></button></div>{(["name", "phone", "email", "address", "notes"] as const).map((key) => <label key={key} className="block text-sm font-semibold"><span>{({ name: "Tên khách hàng", phone: "Số điện thoại", email: "Email", address: "Địa chỉ", notes: "Ghi chú" })[key]}</span><input required={key === "name"} value={form[key] || ""} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" /></label>)}<button disabled={saving} className="w-full rounded-xl bg-cyan-600 py-2.5 font-bold text-white">{saving ? "Đang lưu..." : "Lưu khách hàng"}</button></form></div>;
}
