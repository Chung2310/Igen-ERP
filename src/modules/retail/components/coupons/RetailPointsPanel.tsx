import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "../../../shared/lib/apiFetch";
import { useRetailScope } from "../../hooks/useRetailScope";
import { RetailEmptyState } from "../RetailEmptyState";

type Policy = { enabled: boolean; earnVndPerPoint: number; redeemVndPerPoint: number; maxRedeemPercent: number; version: number };
type PointCustomer = { _id: string; customerCode: string; name: string; phone: string; pointsBalance?: number };
type PointLedger = { _id: string; type: string; points: number; balanceAfter: number; reason: string; createdAt: string };

const field = "mt-1 h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none";
const button = "h-9 rounded-md bg-primary px-3.5 text-sm font-medium text-on-primary disabled:opacity-50";

export default function RetailPointsPanel() {
  const { scope } = useRetailScope();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<PointCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<PointCustomer | null>(null);
  const [ledger, setLedger] = useState<PointLedger[]>([]);
  const [balance, setBalance] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const adjustmentAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (!scope) return;
    let active = true;
    setPolicy(null);
    apiFetch<{ data: Policy }>("/retail/points/policy", { params: scope })
      .then((response) => { if (active) setPolicy(response.data); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được chính sách điểm."); });
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId]);

  useEffect(() => {
    if (!scope || customerSearch.trim().length < 2 || selectedCustomer) return;
    let active = true;
    apiFetch<{ data: PointCustomer[] }>("/retail/points/customers/search", { params: { ...scope, q: customerSearch } })
      .then((response) => { if (active) setCustomers(response.data); })
      .catch(() => { if (active) setCustomers([]); });
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId, customerSearch, selectedCustomer]);

  async function loadCustomer(customer: PointCustomer) {
    if (!scope) return;
    setSelectedCustomer(customer);
    setCustomerSearch(`${customer.name} · ${customer.phone}`);
    setCustomers([]);
    setError("");
    try {
      const response = await apiFetch<{ data: { balance: number; ledger: PointLedger[] } }>(`/retail/points/customers/${customer._id}`, { params: scope });
      setBalance(response.data.balance);
      setLedger(response.data.ledger);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được sổ điểm."); }
  }

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    if (!policy || !scope) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiFetch<{ data: Policy }>("/retail/points/policy", { method: "PUT", params: scope, body: JSON.stringify(policy) });
      setPolicy(response.data);
      setMessage("Đã lưu chính sách điểm thưởng.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được chính sách điểm."); }
    finally { setBusy(false); }
  }

  async function saveAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!selectedCustomer || !scope) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { points: adjustment, reason: reason.trim() };
      const fingerprint = JSON.stringify({ companyCode: scope.companyCode, customerId: selectedCustomer._id, payload });
      const key = adjustmentAttempt.current?.fingerprint === fingerprint ? adjustmentAttempt.current.key : crypto.randomUUID();
      adjustmentAttempt.current = { fingerprint, key };
      await apiFetch(`/retail/points/customers/${selectedCustomer._id}/adjust`, { method: "POST", params: scope, body: JSON.stringify({ ...payload, idempotencyKey: key }) });
      adjustmentAttempt.current = null;
      setAdjustment(0); setReason(""); setMessage("Đã ghi điều chỉnh điểm.");
      await loadCustomer(selectedCustomer);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không điều chỉnh được điểm."); }
    finally { setBusy(false); }
  }

  if (!scope) return <p className="text-sm text-on-surface-variant">Vui lòng chọn chi nhánh.</p>;

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-md border border-error p-3 text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-sm text-on-surface">{message}</p>}
    {policy && <section className="space-y-3" aria-labelledby="points-policy-title">
      <h2 id="points-policy-title" className="text-balance text-base font-semibold">Chính sách điểm thưởng</h2>
      <form onSubmit={(event) => void savePolicy(event)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">VNĐ để tích 1 điểm<input required type="number" min={1} step={1} value={policy.earnVndPerPoint} onChange={(event) => setPolicy({ ...policy, earnVndPerPoint: Number(event.target.value) })} className={field} /></label>
        <label className="text-sm">Giá trị 1 điểm (VNĐ)<input required type="number" min={1} step={1} value={policy.redeemVndPerPoint} onChange={(event) => setPolicy({ ...policy, redeemVndPerPoint: Number(event.target.value) })} className={field} /></label>
        <label className="text-sm">Tiêu tối đa (%)<input required type="number" min={0} max={100} step=".01" value={policy.maxRedeemPercent} onChange={(event) => setPolicy({ ...policy, maxRedeemPercent: Number(event.target.value) })} className={field} /></label>
        <div className="flex flex-wrap items-end gap-2"><label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })} />Bật tích/tiêu điểm</label><button type="submit" disabled={busy} className={button}>Lưu chính sách</button></div>
      </form>
    </section>}
    <section className="space-y-3 border-t border-outline-variant pt-4" aria-labelledby="points-ledger-title">
      <h2 id="points-ledger-title" className="text-balance text-base font-semibold">Sổ điểm khách hàng</h2>
      <label className="block max-w-lg text-sm">Tìm khách hàng theo tên, số điện thoại hoặc mã<input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setSelectedCustomer(null); setCustomers([]); }} className={field} autoComplete="off" /></label>
      {customers.length > 0 && <ul className="max-w-lg rounded-md border border-outline-variant">{customers.map((customer) => <li key={customer._id}><button type="button" onClick={() => void loadCustomer(customer)} className="min-h-9 w-full px-3 text-left text-sm text-on-surface hover:bg-surface focus-visible:border-primary focus-visible:outline-none">{customer.name} · {customer.phone} · {customer.customerCode}</button></li>)}</ul>}
      {selectedCustomer && <><p className="text-sm">{selectedCustomer.name} · Số dư: <strong className="tabular-nums">{balance.toLocaleString("vi-VN")}</strong> điểm</p>
        <form onSubmit={(event) => void saveAdjustment(event)} className="grid max-w-2xl gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <label className="text-sm">Điểm (+/-)<input required type="number" step={1} value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} className={field} /></label>
          <label className="text-sm">Lý do<input required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={field} /></label>
          <button type="submit" disabled={busy || adjustment === 0} className={button}>Điều chỉnh</button>
        </form>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-outline-variant bg-surface"><th scope="col" className="p-2">Thời gian</th><th scope="col" className="p-2">Loại</th><th scope="col" className="p-2">Phát sinh</th><th scope="col" className="p-2">Số dư</th><th scope="col" className="p-2">Lý do</th></tr></thead><tbody>{ledger.map((entry) => <tr key={entry._id} className="border-b border-outline-variant"><td className="p-2">{new Date(entry.createdAt).toLocaleString("vi-VN")}</td><td className="p-2">{entry.type}</td><td className="p-2 tabular-nums">{entry.points}</td><td className="p-2 tabular-nums">{entry.balanceAfter}</td><td className="p-2">{entry.reason}</td></tr>)}</tbody></table>{!ledger.length && <RetailEmptyState kind="fee" compact>Chưa có phát sinh điểm.</RetailEmptyState>}</div>
      </>}
    </section>
  </div>;
}
