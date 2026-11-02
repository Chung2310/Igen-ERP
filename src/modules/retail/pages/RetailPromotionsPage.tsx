import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "../../shared/lib/apiFetch";
import { useRetailScope } from "../hooks/useRetailScope";

type Coupon = { _id: string; code: string; name: string; discountType: "amount" | "percent"; value: number; minSubtotal: number; maxDiscount?: number; usageLimit?: number; usedCount: number; startsAt: string; endsAt: string; active: boolean; customerId?: string; customerTierCodes: string[]; source: string; version: number; deliveryStatus?: string; deliveryError?: string };
type Program = { _id: string; name: string; trigger: "birthday" | "purchase"; orderMinTotal?: number; enabled: boolean; discountType: "amount" | "percent"; value: number; minSubtotal: number; maxDiscount?: number; validityDays: number; sendEmail: boolean; version: number };
type Policy = { enabled: boolean; earnVndPerPoint: number; redeemVndPerPoint: number; maxRedeemPercent: number; version: number };
type PointCustomer = { _id: string; customerCode: string; name: string; phone: string; pointsBalance?: number };
type PointLedger = { _id: string; type: string; points: number; balanceAfter: number; reason: string; createdAt: string };
type CouponForm = { code: string; name: string; discountType: "amount" | "percent"; value: number; minSubtotal: number; maxDiscount: string; usageLimit: string; startsAt: string; endsAt: string; active: boolean; customerId: string; customerTierCodes: string };
type ProgramForm = { name: string; trigger: "birthday" | "purchase"; orderMinTotal: number; enabled: boolean; discountType: "amount" | "percent"; value: number; minSubtotal: number; maxDiscount: string; validityDays: number; sendEmail: boolean };
const field = "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";
const button = "min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const toLocal = (date: string) => { const value = new Date(date); return new Date(+value - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const initialCoupon = (): CouponForm => ({ code: "", name: "", discountType: "amount", value: 0, minSubtotal: 0, maxDiscount: "", usageLimit: "", startsAt: toLocal(new Date().toISOString()), endsAt: toLocal(new Date(Date.now() + 30 * 86400000).toISOString()), active: true, customerId: "", customerTierCodes: "" });
const initialProgram: ProgramForm = { name: "", trigger: "birthday", orderMinTotal: 0, enabled: false, discountType: "amount", value: 0, minSubtotal: 0, maxDiscount: "", validityDays: 30, sendEmail: false };

export default function RetailPromotionsPage() {
  const { scope } = useRetailScope();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>(initialCoupon);
  const [programForm, setProgramForm] = useState<ProgramForm>(initialProgram);
  const [couponId, setCouponId] = useState("");
  const [programId, setProgramId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [pointCustomers, setPointCustomers] = useState<PointCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<PointCustomer | null>(null);
  const [pointLedger, setPointLedger] = useState<PointLedger[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const adjustmentAttempt = useRef<{ fingerprint: string; key: string } | null>(null);

  async function load() {
    if (!scope) return;
    setLoading(true); setError("");
    try {
      const [couponResponse, programResponse, policyResponse] = await Promise.all([
        apiFetch<{ data: { items: Coupon[] } }>("/retail/coupons", { params: scope }),
        apiFetch<{ data: Program[] }>("/retail/coupons/automations", { params: scope }),
        apiFetch<{ data: Policy }>("/retail/points/policy", { params: scope }),
      ]);
      setCoupons(couponResponse.data.items); setPrograms(programResponse.data.map((program: any) => ({ ...program, trigger: program.trigger === "order_total" ? "purchase" : program.trigger, sendEmail: program.deliveryChannels?.includes("email") || false }))); setPolicy(policyResponse.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được chương trình ưu đãi."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [scope?.companyCode, scope?.branchId]);
  useEffect(() => {
    if (!scope || customerSearch.trim().length < 2) { setPointCustomers([]); return; }
    let active = true;
    void apiFetch<{ data: PointCustomer[] }>("/retail/points/customers/search", { params: { ...scope, q: customerSearch } })
      .then((response) => { if (active) setPointCustomers(response.data); })
      .catch(() => { if (active) setPointCustomers([]); });
    return () => { active = false; };
  }, [scope?.companyCode, scope?.branchId, customerSearch]);
  if (!scope) return <p className="text-sm text-on-surface-variant">Vui lòng chọn chi nhánh.</p>;
  const putCoupon = (key: keyof CouponForm, value: CouponForm[keyof CouponForm]) => setCouponForm((current) => ({ ...current, [key]: value }));
  const putProgram = (key: keyof ProgramForm, value: ProgramForm[keyof ProgramForm]) => setProgramForm((current) => ({ ...current, [key]: value }));
  async function saveCoupon(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const current = coupons.find((coupon) => coupon._id === couponId);
      const payload = { ...couponForm, code: couponForm.code.trim().toUpperCase(), startsAt: new Date(couponForm.startsAt).toISOString(), endsAt: new Date(couponForm.endsAt).toISOString(),
        maxDiscount: couponForm.maxDiscount === "" ? undefined : Number(couponForm.maxDiscount), usageLimit: couponForm.usageLimit === "" ? undefined : Number(couponForm.usageLimit),
        customerId: couponForm.customerId || undefined, customerTierCodes: couponForm.customerTierCodes.split(",").map((part) => part.trim()).filter(Boolean), version: current?.version };
      await apiFetch(`/retail/coupons${couponId ? `/${couponId}` : ""}`, { method: couponId ? "PUT" : "POST", params: scope, body: JSON.stringify(payload) });
      setCouponForm(initialCoupon()); setCouponId(""); setMessage("Đã lưu mã ưu đãi."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được mã ưu đãi."); }
    finally { setBusy(false); }
  }
  async function saveProgram(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const current = programs.find((program) => program._id === programId);
      const payload = { ...programForm, trigger: programForm.trigger === "purchase" ? "order_total" : "birthday", deliveryChannels: programForm.sendEmail ? ["email"] : [], maxDiscount: programForm.maxDiscount === "" ? undefined : Number(programForm.maxDiscount), version: current?.version };
      await apiFetch(`/retail/coupons/automations${programId ? `/${programId}` : ""}`, { method: programId ? "PUT" : "POST", params: scope, body: JSON.stringify(payload) });
      setProgramForm(initialProgram); setProgramId(""); setMessage("Đã lưu chương trình tặng mã."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được chương trình."); }
    finally { setBusy(false); }
  }
  async function savePolicy(event: FormEvent) {
    event.preventDefault(); if (!policy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiFetch<{ data: Policy }>("/retail/points/policy", { method: "PUT", params: scope, body: JSON.stringify(policy) });
      setPolicy(response.data); setMessage("Đã lưu chính sách điểm thưởng.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được chính sách điểm."); }
    finally { setBusy(false); }
  }
  function editCoupon(coupon: Coupon) {
    if (coupon.source !== "manual") return;
    setCouponId(coupon._id);
    setCouponForm({ code: coupon.code, name: coupon.name, discountType: coupon.discountType, value: coupon.value, minSubtotal: coupon.minSubtotal,
      maxDiscount: coupon.maxDiscount == null ? "" : String(coupon.maxDiscount), usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
      startsAt: toLocal(coupon.startsAt), endsAt: toLocal(coupon.endsAt), active: coupon.active, customerId: coupon.customerId || "", customerTierCodes: coupon.customerTierCodes.join(", ") });
  }
  function editProgram(program: Program) {
    setProgramId(program._id);
    setProgramForm({ name: program.name, trigger: program.trigger, orderMinTotal: program.orderMinTotal || 0, enabled: program.enabled,
      discountType: program.discountType, value: program.value, minSubtotal: program.minSubtotal,
      maxDiscount: program.maxDiscount == null ? "" : String(program.maxDiscount), validityDays: program.validityDays, sendEmail: program.sendEmail });
  }
  async function selectPointCustomer(customer: PointCustomer) {
    setSelectedCustomer(customer); setCustomerSearch(`${customer.name} · ${customer.phone}`); setPointCustomers([]); setError("");
    try {
      const response = await apiFetch<{ data: { balance: number; ledger: PointLedger[] } }>(`/retail/points/customers/${customer._id}`, { params: scope });
      setPointBalance(response.data.balance); setPointLedger(response.data.ledger);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được sổ điểm."); }
  }
  async function saveAdjustment(event: FormEvent) {
    event.preventDefault(); if (!selectedCustomer) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { points: adjustment, reason: adjustmentReason.trim() };
      const fingerprint = JSON.stringify({ companyCode: scope.companyCode, customerId: selectedCustomer._id, payload });
      const key = adjustmentAttempt.current?.fingerprint === fingerprint ? adjustmentAttempt.current.key : crypto.randomUUID();
      adjustmentAttempt.current = { fingerprint, key };
      await apiFetch(`/retail/points/customers/${selectedCustomer._id}/adjust`, { method: "POST", params: scope, body: JSON.stringify({ ...payload, idempotencyKey: key }) });
      adjustmentAttempt.current = null;
      setAdjustment(0); setAdjustmentReason(""); setMessage("Đã ghi điều chỉnh điểm."); await selectPointCustomer(selectedCustomer);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không điều chỉnh được điểm."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-6xl space-y-6 text-on-surface">
    <header><h1 className="text-balance text-xl font-semibold">Ưu đãi và điểm thưởng</h1><p className="mt-1 text-pretty text-sm text-on-surface-variant">Quản lý mã tại chi nhánh và chính sách điểm của công ty.</p></header>
    {error && <p role="alert" className="rounded-lg border border-error p-3 text-sm text-error">{error}</p>}
    {message && <p role="status" className="text-sm text-on-surface">{message}</p>}
    {loading && <p role="status" className="text-sm text-on-surface-variant">Đang tải ưu đãi...</p>}
    <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6" aria-labelledby="coupon-title">
      <h2 id="coupon-title" className="text-balance text-lg font-semibold">Mã ưu đãi</h2>
      <form onSubmit={(event) => void saveCoupon(event)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Mã<input required maxLength={32} value={couponForm.code} onChange={(event) => putCoupon("code", event.target.value)} className={field} /></label>
        <label className="text-sm">Tên<input required maxLength={120} value={couponForm.name} onChange={(event) => putCoupon("name", event.target.value)} className={field} /></label>
        <label className="text-sm">Loại giảm<select value={couponForm.discountType} onChange={(event) => putCoupon("discountType", event.target.value)} className={field}><option value="amount">Số tiền</option><option value="percent">Phần trăm</option></select></label>
        <label className="text-sm">Giá trị<input required type="number" min={0} step={couponForm.discountType === "percent" ? ".01" : "1"} value={couponForm.value} onChange={(event) => putCoupon("value", Number(event.target.value))} className={field} /></label>
        <label className="text-sm">Đơn tối thiểu<input type="number" min={0} step={1} value={couponForm.minSubtotal} onChange={(event) => putCoupon("minSubtotal", Number(event.target.value))} className={field} /></label>
        <label className="text-sm">Giảm tối đa<input type="number" min={1} step={1} value={couponForm.maxDiscount} onChange={(event) => putCoupon("maxDiscount", event.target.value)} className={field} /></label>
        <label className="text-sm">Giới hạn lượt<input type="number" min={1} step={1} value={couponForm.usageLimit} onChange={(event) => putCoupon("usageLimit", event.target.value)} className={field} /></label>
        <label className="text-sm">Khách hàng ID<input value={couponForm.customerId} onChange={(event) => putCoupon("customerId", event.target.value)} className={field} /></label>
        <label className="text-sm">Bắt đầu<input required type="datetime-local" value={couponForm.startsAt} onChange={(event) => putCoupon("startsAt", event.target.value)} className={field} /></label>
        <label className="text-sm">Kết thúc<input required type="datetime-local" value={couponForm.endsAt} onChange={(event) => putCoupon("endsAt", event.target.value)} className={field} /></label>
        <label className="text-sm">Mã hạng khách (cách nhau dấu phẩy)<input value={couponForm.customerTierCodes} onChange={(event) => putCoupon("customerTierCodes", event.target.value)} className={field} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={couponForm.active} onChange={(event) => putCoupon("active", event.target.checked)} />Đang áp dụng</label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button type="submit" disabled={busy} className={button}>{couponId ? "Cập nhật mã" : "Tạo mã"}</button>{couponId && <button type="button" onClick={() => { setCouponId(""); setCouponForm(initialCoupon()); }} className="min-h-11 rounded-lg border border-outline px-4 text-sm">Hủy sửa</button>}</div>
      </form>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-outline-variant"><th scope="col" className="p-2">Mã</th><th scope="col" className="p-2">Ưu đãi</th><th scope="col" className="p-2">Hạn dùng</th><th scope="col" className="p-2">Lượt dùng</th><th scope="col" className="p-2">Gửi mã</th><th scope="col" className="p-2">Thao tác</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon._id} className="border-b border-outline-variant"><td className="p-2 font-medium">{coupon.code}</td><td className="p-2">{coupon.name} · {coupon.value.toLocaleString("vi-VN")}{coupon.discountType === "percent" ? "%" : " ₫"}</td><td className="p-2">{new Date(coupon.endsAt).toLocaleDateString("vi-VN")}</td><td className="p-2 tabular-nums">{coupon.usedCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ""}</td><td className="p-2">{coupon.deliveryStatus || "—"}{coupon.deliveryError ? ` · ${coupon.deliveryError}` : ""}</td><td className="p-2">{coupon.source === "manual" && <button type="button" onClick={() => editCoupon(coupon)} className="rounded-lg border border-outline px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary">Sửa</button>}</td></tr>)}</tbody></table>{!loading && !coupons.length && <p className="p-4 text-sm text-on-surface-variant">Chưa có mã ưu đãi. Tạo mã đầu tiên bằng biểu mẫu trên.</p>}</div>
    </section>
    <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6" aria-labelledby="automation-title">
      <h2 id="automation-title" className="text-balance text-lg font-semibold">Tự động tặng mã</h2>
      <form onSubmit={(event) => void saveProgram(event)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">Tên chương trình<input required maxLength={120} value={programForm.name} onChange={(event) => putProgram("name", event.target.value)} className={field} /></label>
        <label className="text-sm">Sự kiện<select value={programForm.trigger} disabled={Boolean(programId)} onChange={(event) => putProgram("trigger", event.target.value)} className={field}><option value="birthday">Sinh nhật</option><option value="purchase">Sau mua</option></select></label>
        {programForm.trigger === "purchase" && <label className="text-sm">Đơn từ<input required type="number" min={1} step={1} value={programForm.orderMinTotal} onChange={(event) => putProgram("orderMinTotal", Number(event.target.value))} className={field} /></label>}
        <label className="text-sm">Loại giảm<select value={programForm.discountType} onChange={(event) => putProgram("discountType", event.target.value)} className={field}><option value="amount">Số tiền</option><option value="percent">Phần trăm</option></select></label>
        <label className="text-sm">Giá trị<input required type="number" min={0} step={programForm.discountType === "percent" ? ".01" : "1"} value={programForm.value} onChange={(event) => putProgram("value", Number(event.target.value))} className={field} /></label>
        <label className="text-sm">Đơn dùng mã tối thiểu<input type="number" min={0} step={1} value={programForm.minSubtotal} onChange={(event) => putProgram("minSubtotal", Number(event.target.value))} className={field} /></label>
        <label className="text-sm">Giảm tối đa<input type="number" min={1} step={1} value={programForm.maxDiscount} onChange={(event) => putProgram("maxDiscount", event.target.value)} className={field} /></label>
        <label className="text-sm">Hiệu lực (ngày)<input required type="number" min={1} max={365} step={1} value={programForm.validityDays} onChange={(event) => putProgram("validityDays", Number(event.target.value))} className={field} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={programForm.sendEmail} onChange={(event) => putProgram("sendEmail", event.target.checked)} />Gửi email khi phát mã</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={programForm.enabled} onChange={(event) => putProgram("enabled", event.target.checked)} />Đang bật</label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button type="submit" disabled={busy} className={button}>{programId ? "Cập nhật chương trình" : "Tạo chương trình"}</button>{programId && <button type="button" onClick={() => { setProgramId(""); setProgramForm(initialProgram); }} className="min-h-11 rounded-lg border border-outline px-4 text-sm">Hủy sửa</button>}</div>
      </form>
      <ul className="space-y-2">{programs.map((program) => <li key={program._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant p-3 text-sm"><span>{program.name} · {program.trigger === "birthday" ? "Sinh nhật" : "Sau mua"} · {program.enabled ? "Đang bật" : "Tạm dừng"}</span><button type="button" onClick={() => editProgram(program)} className="rounded-lg border border-outline px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary">Sửa</button></li>)}</ul>
      {!loading && !programs.length && <p className="text-sm text-on-surface-variant">Chưa có chương trình. Tạo chương trình đầu tiên bằng biểu mẫu trên.</p>}
    </section>
    {policy && <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6" aria-labelledby="points-title"><h2 id="points-title" className="text-balance text-lg font-semibold">Chính sách điểm thưởng</h2>
      <form onSubmit={(event) => void savePolicy(event)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">VNĐ để tích 1 điểm<input required type="number" min={1} step={1} value={policy.earnVndPerPoint} onChange={(event) => setPolicy({ ...policy, earnVndPerPoint: Number(event.target.value) })} className={field} /></label>
        <label className="text-sm">Giá trị 1 điểm (VNĐ)<input required type="number" min={1} step={1} value={policy.redeemVndPerPoint} onChange={(event) => setPolicy({ ...policy, redeemVndPerPoint: Number(event.target.value) })} className={field} /></label>
        <label className="text-sm">Tiêu tối đa (%)<input required type="number" min={0} max={100} step=".01" value={policy.maxRedeemPercent} onChange={(event) => setPolicy({ ...policy, maxRedeemPercent: Number(event.target.value) })} className={field} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })} />Bật tích/tiêu điểm</label>
        <div className="sm:col-span-2 lg:col-span-4"><button type="submit" disabled={busy} className={button}>Lưu chính sách</button></div>
      </form>
    </section>}
    <section className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6" aria-labelledby="ledger-title"><h2 id="ledger-title" className="text-balance text-lg font-semibold">Sổ điểm khách hàng</h2>
      <label className="block max-w-lg text-sm">Tìm khách hàng theo tên, số điện thoại hoặc mã<input value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setSelectedCustomer(null); }} className={field} autoComplete="off" /></label>
      {pointCustomers.length > 0 && <ul className="max-w-lg rounded-lg border border-outline-variant">{pointCustomers.map((customer) => <li key={customer._id}><button type="button" onClick={() => void selectPointCustomer(customer)} className="min-h-11 w-full px-3 text-left text-sm text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">{customer.name} · {customer.phone} · {customer.customerCode}</button></li>)}</ul>}
      {selectedCustomer && <><p className="text-sm">{selectedCustomer.name} · Số dư: <strong className="tabular-nums">{pointBalance.toLocaleString("vi-VN")}</strong> điểm</p>
        <form onSubmit={(event) => void saveAdjustment(event)} className="grid max-w-2xl gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <label className="text-sm">Điểm (+/-)<input required type="number" step={1} value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} className={field} /></label>
          <label className="text-sm">Lý do<input required maxLength={300} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} className={field} /></label>
          <button type="submit" disabled={busy || adjustment === 0} className={button}>Điều chỉnh</button>
        </form>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-outline-variant"><th scope="col" className="p-2">Thời gian</th><th scope="col" className="p-2">Loại</th><th scope="col" className="p-2">Phát sinh</th><th scope="col" className="p-2">Số dư</th><th scope="col" className="p-2">Lý do</th></tr></thead><tbody>{pointLedger.map((entry) => <tr key={entry._id} className="border-b border-outline-variant"><td className="p-2">{new Date(entry.createdAt).toLocaleString("vi-VN")}</td><td className="p-2">{entry.type}</td><td className="p-2 tabular-nums">{entry.points}</td><td className="p-2 tabular-nums">{entry.balanceAfter}</td><td className="p-2">{entry.reason}</td></tr>)}</tbody></table>{!pointLedger.length && <p className="p-3 text-sm text-on-surface-variant">Chưa có phát sinh điểm.</p>}</div>
      </>}
    </section>
  </main>;
}
