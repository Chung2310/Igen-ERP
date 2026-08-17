import React from "react";
export function BarcodeInput({ onScan, disabled }: { onScan: (value: string) => void; disabled?: boolean }) {
  const [value, setValue] = React.useState("");
  const submit = () => { const next = value.trim(); if (next) onScan(next); setValue(""); };
  return <div className="flex gap-2"><input autoFocus disabled={disabled} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} placeholder="Quét hoặc nhập mã vạch rồi Enter" className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm" aria-label="Mã vạch kiểm kê" /><button type="button" disabled={disabled} onClick={submit} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Thêm</button></div>;
}
