import { useEffect, useId, useState } from "react";
import { api, canUseErpCustomers } from "./api";
import ThemedSelect from "./ThemedSelect";
type Customer = { _id: string; customerCode: string; name: string; phone: string; email?: string };
export default function ErpCustomerPicker({ disabled, onSelect }: { disabled?: boolean; onSelect: (customer: Customer) => void }) {
  const id = useId(), [query, setQuery] = useState(""), [customers, setCustomers] = useState<Customer[]>([]), [error, setError] = useState(""), [open, setOpen] = useState(false);
  const allowed = canUseErpCustomers();
  useEffect(() => {
    if (!open || !allowed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { void api<{ customers: Customer[] }>(`/api/erp/customers?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then(data => { setCustomers(data.customers); setError(""); }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, allowed, query]);
  if (!allowed) return null;
  return <div className="erp-source-picker">
    <button type="button" className="text-button" disabled={disabled} aria-expanded={open} onClick={() => setOpen(value => !value)}>Chọn khách hàng từ ERP</button>
    {open && <div className="grid gap-2 py-2"><label htmlFor={id}>Tìm tên, mã hoặc số điện thoại</label><input id={id} value={query} onChange={event => setQuery(event.target.value)} disabled={disabled} maxLength={100} />
      <ThemedSelect label="Khách hàng ERP" value="" disabled={disabled || !customers.length} options={[{ value: "", label: "Chọn khách hàng" }, ...customers.map(customer => ({ value: customer._id, label: `${customer.customerCode} · ${customer.name} · ${customer.phone}` }))]} onChange={value => { const selected = customers.find(customer => customer._id === value); if (selected) { onSelect(selected); setOpen(false); } }} />
      {error ? <p role="alert">{error}</p> : <p className="muted">Thông tin khách hàng được sao chép vào chứng từ. Bạn có thể điều chỉnh trước khi lưu.</p>}
    </div>}
  </div>;
}
