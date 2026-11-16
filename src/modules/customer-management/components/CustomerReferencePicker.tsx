import { useEffect, useState } from "react";
import { customerApi } from "../customerApi";

export type CustomerOption = Awaited<ReturnType<typeof customerApi.searchActive>>[number];

export default function CustomerReferencePicker({ companyCode, value, onChange }: {
  companyCode: string;
  value: CustomerOption | null;
  onChange: (customer: CustomerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; items: CustomerOption[]; error?: string }>();
  const q = query.trim();
  useEffect(() => {
    if (q.length < 2 || value) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void customerApi.searchActive({ companyCode, q, limit: 20 }, controller.signal)
        .then(items => { if (!controller.signal.aborted) setResults({ q, items }); })
        .catch(error => { if (!controller.signal.aborted) setResults({ q, items: [], error: error instanceof Error ? error.message : "Không tìm được khách hàng." }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [companyCode, q, value]);

  return <div className="space-y-2 sm:col-span-2">
    {value ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline-variant p-3 text-sm">
      <span>{value.name} · {value.customerCode}</span>
      <button type="button" className="min-h-9 rounded-md px-3 text-primary hover:bg-surface-container" onClick={() => { setQuery(""); setResults(undefined); onChange(null); }}>Đổi khách hàng</button>
    </div> : <>
      <label className="block text-sm font-medium">Tìm khách hàng có sẵn
        <input className="mt-1 block min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 outline-none focus-visible:border-primary"
          value={query} onChange={event => { setQuery(event.target.value); setResults(undefined); }} placeholder="Tên, số điện thoại hoặc mã khách" />
      </label>
      {q.length >= 2 && (results?.q !== q ? <p role="status" className="text-sm text-on-surface-variant">Đang tìm khách hàng…</p>
        : results.error ? <p role="alert" className="text-sm text-error">{results.error}</p>
        : results.items.length ? <ul className="max-h-48 space-y-1 overflow-y-auto">
          {results.items.map(item => <li key={item.customerId}>
            <button type="button" className="min-h-10 w-full rounded-md border border-outline-variant px-3 text-left text-sm hover:bg-surface-container focus-visible:outline-1 focus-visible:outline-primary"
              onClick={() => onChange(item)}>{item.name} · {item.customerCode} · {item.phone}</button>
          </li>)}
        </ul> : <p role="status" className="text-sm text-on-surface-variant">Chưa tìm thấy khách hàng phù hợp.</p>)}
    </>}
  </div>;
}
