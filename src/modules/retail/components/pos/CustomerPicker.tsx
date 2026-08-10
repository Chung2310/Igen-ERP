import React from "react";
import { Search, X } from "lucide-react";
import { retailCustomersApi } from "../../api/retailCustomers.api";
import type { RetailCustomer, RetailScope } from "../../types";

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

  React.useEffect(() => {
    const q = query.trim();
    if (!q || value) { setItems([]); return; }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void retailCustomersApi.list(scope, { q, limit: 10 })
        .then((result) => setItems(result.items))
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Không tìm được khách hàng."))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, scope.companyCode, scope.branchId, value?._id]);

  if (value) return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
      <div><p className="font-semibold">{value.name}</p><p className="text-xs text-slate-500">{value.customerCode}{value.phone ? ` · ${value.phone}` : ""}</p></div>
      <button type="button" aria-label="Bỏ chọn khách hàng" onClick={() => { setQuery(""); onChange(null); }}><X className="h-4 w-4" /></button>
    </div>
  );

  return <div className="relative">
    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
    <input role="combobox" aria-label="Tìm khách hàng" aria-expanded={items.length > 0} className="w-full rounded-xl border py-2.5 pl-9 pr-3" placeholder="Tên, số điện thoại hoặc mã khách hàng" value={query} onChange={(event) => setQuery(event.target.value)} />
    {loading && <p className="mt-1 text-xs text-slate-500">Đang tìm khách hàng...</p>}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    {!loading && query.trim() && !error && items.length === 0 && <p className="mt-1 text-xs text-slate-500">Không có kết quả.</p>}
    {items.length > 0 && <div role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-white p-1 shadow-lg">{items.map((customer) => <button type="button" role="option" aria-selected="false" aria-label={`${customer.name} ${customer.customerCode} ${customer.phone || ""}`} key={customer._id} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-cyan-50" onClick={() => { onChange(customer); setItems([]); setQuery(""); }}><p className="font-medium">{customer.name}</p><p className="text-xs text-slate-500">{customer.customerCode}{customer.phone ? ` · ${customer.phone}` : ""}</p></button>)}</div>}
  </div>;
}
