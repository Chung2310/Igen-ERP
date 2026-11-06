import { useEffect, useState, type FormEvent } from "react";
import CurrencyInput from "./pos/CurrencyInput";
import { retailShiftsApi } from "../api/retailShifts.api";
import type { RetailScope } from "../types";
import { Dropdown } from "../../../components/common/Dropdown";

type Cashier = { _id: string; displayName: string; email: string };

export function RetailShiftAssignmentPanel({ scope, onOpened }: { scope: RetailScope; onOpened: () => void }) {
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [cashierId, setCashierId] = useState("");
  const [openingFloat, setOpeningFloat] = useState(0);
  const [terminalId, setTerminalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void retailShiftsApi.cashiers(scope)
      .then((items) => { if (active) setCashiers(items.map(item => ({ _id: item.id, displayName: item.name, email: "" }))); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được danh sách thu ngân."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !cashierId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const shift = await retailShiftsApi.openFor(scope, { cashierId, openingFloat, terminalId: terminalId.trim() || undefined });
      setSuccess(`Đã mở ca ${shift.shiftCode} cho ${shift.cashierName}.`);
      setCashierId("");
      setOpeningFloat(0);
      setTerminalId("");
      onOpened();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không mở được ca cho thu ngân.");
    } finally {
      setSaving(false);
    }
  }

  return <section aria-labelledby="retail-shift-assignment-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <h2 id="retail-shift-assignment-title" className="text-balance text-lg font-semibold text-on-surface">Mở ca cho thu ngân</h2>
    <p className="mt-1 text-pretty text-sm text-on-surface-variant">Chọn nhân viên cùng chi nhánh đã có quyền bán lẻ và lịch làm việc hợp lệ.</p>
    {loading ? <p role="status" className="mt-3 text-sm text-on-surface-variant">Đang tải thu ngân...</p> : <form onSubmit={(event) => void submit(event)} aria-busy={saving} className="mt-3 grid gap-3 sm:grid-cols-2">
      <Dropdown label="Thu ngân" aria-required aria-describedby={error ? "retail-shift-assignment-error" : undefined} value={cashierId} onChange={setCashierId} options={[{ value: "", label: "Chọn thu ngân" }, ...cashiers.map((cashier) => ({ value: cashier._id, label: cashier.displayName || cashier.email }))]} variant="form" size="md" className="w-full" searchable />
      <CurrencyInput label="Tiền đầu ca" value={openingFloat} onChange={setOpeningFloat} />
      <label className="text-sm font-medium text-on-surface sm:col-span-2">Mã quầy
        <input maxLength={60} value={terminalId} onChange={(event) => setTerminalId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-visible:outline-2 focus-visible:outline-primary" />
      </label>
      <button type="submit" disabled={saving || !cashierId || !Number.isSafeInteger(openingFloat) || openingFloat < 0} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:col-span-2 sm:justify-self-start">{saving ? "Đang mở ca..." : "Mở ca cho thu ngân"}</button>
    </form>}
    {error && <p id="retail-shift-assignment-error" role="alert" className="mt-2 text-sm text-error">{error}</p>}
    {success && <p role="status" className="mt-2 text-sm text-on-surface">{success}</p>}
  </section>;
}
