import React from "react";
import { Search, UserPlus, X } from "lucide-react";
import { customerApi } from "../../../customer-management/customerApi";
import type { RetailCustomer, RetailScope } from "../../types";
import CreateCustomerDialog from "./CreateCustomerDialog";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

type Props = {
  scope: RetailScope;
  value: RetailCustomer | null;
  onChange: (customer: RetailCustomer | null) => void;
};

export default function CustomerPicker({ scope, value, onChange }: Props) {
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<RetailCustomer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [searchCompleted, setSearchCompleted] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (!q || value) { setItems([]); setSearchCompleted(false); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      setSearchCompleted(false);
      void customerApi.list({ companyCode: scope.companyCode, q, limit: 10, status: "active" })
        .then((result) => { if (active) { setItems(result.items.map((customer) => ({ _id: customer._id, customerCode: customer.customerCode, companyCode: customer.companyCode, type: customer.type, name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, notes: customer.notes }))); setSearchCompleted(true); } })
        .catch((cause) => { if (active) { setItems([]); setSearchCompleted(false); setError(getApiErrorMessage(cause, "Không tìm được khách hàng.")); } })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, scope.companyCode, value?._id]);

  if (value) return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
      <div><div className="flex items-center gap-2"><p className="font-semibold">{value.name}</p>{value.tier && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{value.tier.name}</span>}</div><p className="text-xs text-slate-500">{value.customerCode}{value.phone ? ` · ${value.phone}` : ""}</p></div>
      <button type="button" aria-label="Bỏ chọn khách hàng" onClick={() => { setQuery(""); onChange(null); }}><X className="h-4 w-4" /></button>
    </div>
  );

  return <div className="relative">
    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
    <input role="combobox" aria-label="Tìm khách hàng" aria-expanded={items.length > 0} className="w-full rounded-xl border py-2.5 pl-9 pr-3" placeholder="Tên, số điện thoại hoặc mã khách hàng" value={query} onChange={(event) => { setQuery(event.target.value); setSearchCompleted(false); }} />
    {loading && <p className="mt-1 text-xs text-slate-500">Đang tìm khách hàng...</p>}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    {!loading && query.trim() && !error && searchCompleted && items.length === 0 && <div className="mt-2 rounded-xl border border-dashed border-cyan-300 bg-cyan-50 p-3"><p className="text-xs text-slate-600">Không có kết quả.</p><button type="button" className="mt-2 flex items-center gap-2 text-sm font-bold text-cyan-700" onClick={() => setCreating(true)}><UserPlus className="h-4 w-4" />Tạo khách hàng mới</button></div>}
    {items.length > 0 && <div role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-white p-1 shadow-lg">{items.map((customer) => <button type="button" role="option" aria-selected="false" aria-label={`${customer.name} ${customer.customerCode} ${customer.phone || ""}`} key={customer._id} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-cyan-50" onClick={() => { onChange(customer); setItems([]); setQuery(""); }}><div className="flex items-center gap-2"><p className="font-medium">{customer.name}</p>{customer.tier && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{customer.tier.name}</span>}</div><p className="text-xs text-slate-500">{customer.customerCode}{customer.phone ? ` · ${customer.phone}` : ""}</p></button>)}</div>}
    {creating && <CreateCustomerDialog scope={scope} initialPhone={query.trim()} onClose={() => setCreating(false)} onCreated={(customer) => { setQuery(""); setItems([]); setSearchCompleted(false); setCreating(false); onChange(customer); }} />}
  </div>;
}
