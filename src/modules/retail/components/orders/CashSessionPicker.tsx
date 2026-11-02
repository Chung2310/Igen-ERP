import React from "react";
import { retailShiftsApi } from "../../api/retailShifts.api";
import type { RetailScope, RetailShift } from "../../types";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

export default function CashSessionPicker({ scope, value, onChange, disabled }: { scope: RetailScope | null; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const [items, setItems] = React.useState<RetailShift[]>([]);
  const [error, setError] = React.useState("");
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    if (!scope) return;
    void (async () => {
      try {
        const rows: RetailShift[] = [];
        for (let page = 1; ; page++) {
          const result = await retailShiftsApi.list(scope, { status: "open", page, limit: 100 });
          rows.push(...result.items);
          if (rows.length >= result.total || !result.items.length) break;
        }
        if (active) { setItems(rows); setError(""); }
        } catch (cause) { if (active) setError(getApiErrorMessage(cause, "Không tải được phiên đang mở.")); }
    })();
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId, attempt]);
  return <div className="my-3 space-y-2"><label className="block text-sm font-semibold">Phiên thu hoặc hoàn tiền<select aria-label="Phiên thu hoặc hoàn tiền" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Ngoài phiên (chỉ thanh toán không dùng tiền mặt)</option>{value && !items.some((item) => item._id === value) && <option value={value}>Phiên đã chọn</option>}{items.map((shift) => <option key={shift._id} value={shift._id}>{shift.cashierName} · {shift.businessDate}</option>)}</select></label><p className="text-xs text-slate-500">Tiền mặt phải gắn với một phiên đang mở. Phiên bán gốc của đơn được giữ nguyên.</p>{error && <p role="alert" className="text-xs text-rose-700">{error}</p>}<button type="button" disabled={disabled} onClick={() => setAttempt((value) => value + 1)} className="text-xs text-cyan-700">Tải lại phiên</button></div>;
}
