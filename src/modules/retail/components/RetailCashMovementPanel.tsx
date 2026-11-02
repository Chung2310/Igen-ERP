import { useRef, useState, type FormEvent } from "react";
import CurrencyInput from "./pos/CurrencyInput";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailScope, RetailShift } from "../types";

export function RetailCashMovementPanel({ scope, shift, onSaved }: { scope: RetailScope; shift: RetailShift; onSaved: (shift: RetailShift) => void }) {
  const [type, setType] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const requestKey = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    requestKey.current ||= crypto.randomUUID();
    try {
      const updated = await retailShiftsApi.movement(scope, shift._id, { type, amount, reason: reason.trim(), idempotencyKey: requestKey.current });
      onSaved(updated);
      setAmount(0);
      setReason("");
      requestKey.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không ghi được khoản thu/rút quỹ.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <h3 className="text-balance text-base font-semibold text-on-surface">Thu và rút quỹ trong ca</h3>
    <form onSubmit={(event) => void submit(event)} className="mt-3 space-y-3" aria-busy={saving}>
      <label className="block text-sm font-medium text-on-surface">Loại giao dịch<select value={type} onChange={(event) => setType(event.target.value as "in" | "out")} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-visible:outline-2 focus-visible:outline-primary"><option value="in">Thu thêm vào quỹ</option><option value="out">Rút khỏi quỹ</option></select></label>
      <CurrencyInput label="Số tiền" value={amount} onChange={setAmount} />
      <label className="block text-sm font-medium text-on-surface">Lý do<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby={error ? "retail-cash-movement-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-visible:outline-2 focus-visible:outline-primary" /></label>
      {error && <p id="retail-cash-movement-error" role="alert" className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={saving || !Number.isSafeInteger(amount) || amount <= 0 || !reason.trim()} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{saving ? "Đang ghi..." : "Ghi giao dịch quỹ"}</button>
    </form>
    {shift.cashMovements?.length ? <ul className="mt-4 divide-y divide-outline-variant border-t border-outline-variant text-sm text-on-surface">{shift.cashMovements.map((movement, index) => <li key={`${movement.at}-${index}`} className="flex flex-wrap justify-between gap-2 py-2"><span>{movement.type === "in" ? "Thu" : "Rút"} · {movement.reason}</span><strong className="tabular-nums">{movement.amount.toLocaleString("vi-VN")} ₫</strong></li>)}</ul> : null}
  </section>;
}
