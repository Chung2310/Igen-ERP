import React from "react";
import { ArrowLeft, AtSign, CalendarDays, Coins, CreditCard, FileText, History, MapPin, Phone, ShoppingBag, UserRound } from "lucide-react";
import { cn } from "../../student-management/lib/utils";
import type { Customer, CustomerPurchaseHistory } from "../types";
import { customerApi } from "../customerApi";
import { retailCustomerApi, type CustomerPointEntry, type CustomerPointPolicy, type CustomerReceivableEntry } from "../retailCustomerApi";
import BillingProfilesPanel from "./BillingProfilesPanel";
import CustomerPurchaseHistoryPanel from "./CustomerPurchaseHistoryPanel";
import CustomerRepairsPanel from './CustomerRepairsPanel';
import { Wrench } from 'lucide-react';
const CustomerTransactionsPanel = React.lazy(() => import('./CustomerTransactionsPanel'));

type Props = {
  customer: Customer;
  branchId?: string;
  canManage: boolean;
  canRetailRead: boolean;
  canManagePoints: boolean;
  actionError?: string;
  onBack: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onBillingProfileCreated: () => Promise<void>;
};

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const tabs = [
  { id: "overview", label: "Tổng quan", icon: UserRound },
  { id: 'transactions', label: 'Lịch sử giao dịch', icon: History },
  { id: "purchases", label: "Mua hàng & bảo hành", icon: ShoppingBag },
  { id: "repairs", label: "Dịch vụ & bảo hành", icon: Wrench },
  { id: "receivables", label: "Công nợ", icon: CreditCard },
  { id: "points", label: "Điểm thưởng", icon: Coins },
  { id: "billing", label: "Hồ sơ VAT", icon: FileText },
] as const;
type DetailTab = typeof tabs[number]["id"];

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof UserRound }) {
  return <div className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <dt className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">{Icon && <Icon className="size-4" aria-hidden="true" />}{label}</dt>
    <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value || "—"}</dd>
  </div>;
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
    <p className="text-xs font-medium text-on-surface-variant">{label}</p>
    <p className="mt-2 break-words text-lg font-semibold tabular-nums text-on-surface">{value}</p>
    <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>
  </div>;
}

function Overview({ customer, branchId }: { customer: Customer; branchId?: string }) {
  const [history, setHistory] = React.useState<CustomerPurchaseHistory | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!branchId) { setHistory(null); return; }
    let active = true;
    void customerApi.purchaseHistory(customer._id, { companyCode: customer.companyCode, branchId })
      .then((value) => { if (active) { setHistory(value); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được tổng quan mua hàng."); });
    return () => { active = false; };
  }, [branchId, customer.companyCode, customer._id]);
  const typeLabel = customer.type === "vat" ? "Xuất VAT" : "Thông thường";
  const gender = customer.gender === "male" ? "Nam" : customer.gender === "female" ? "Nữ" : customer.gender === "other" ? "Khác" : "—";
  return <div className="space-y-5">
    <section aria-label="Tóm tắt hoạt động" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Tổng đơn tại chi nhánh" value={history ? String(history.summary.orderCount) : "—"} hint="Đơn bán lẻ đã ghi nhận" />
      <SummaryCard label="Tổng giá trị mua" value={history ? currency.format(history.summary.totalPurchased) : "—"} hint="Theo dữ liệu chi nhánh đang chọn" />
      <SummaryCard label="Công nợ hiện tại" value={history ? currency.format(history.summary.currentDebt) : "—"} hint="Số dư sổ công nợ bán lẻ" />
      <SummaryCard label="Thiết bị đã mua" value={history ? String(history.devices.length) : "—"} hint="Thiết bị có IMEI / serial" />
    </section>
    {!branchId && <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Chọn chi nhánh để xem số liệu mua hàng và công nợ.</p>}
    {error && <p role="alert" className="rounded-xl border border-error bg-error-container p-4 text-sm text-on-error-container">{error}</p>}
    <section aria-labelledby="customer-profile-title" className="space-y-4">
      <div><h3 id="customer-profile-title" className="text-base font-semibold text-on-surface">Thông tin hồ sơ</h3><p className="mt-1 text-sm text-on-surface-variant">Thông tin khách hàng dùng chung trong công ty.</p></div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Info label="Mã khách hàng" value={customer.customerCode} icon={UserRound} />
        <Info label="Đối tượng khách hàng" value={customer.customerKind === 'business' ? 'Doanh nghiệp / tổ chức' : customer.customerKind === 'individual' ? 'Cá nhân' : 'Chưa phân loại'} />
        {customer.customerKind === 'business' && <Info label="Người liên hệ" value={customer.contactName || ''} />}
        <Info label="Số điện thoại" value={customer.phone} icon={Phone} />
        <Info label="Email" value={customer.email || "—"} icon={AtSign} />
        <Info label="Ngày sinh" value={customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString("vi-VN") : "—"} icon={CalendarDays} />
        <Info label="Giới tính" value={gender} />
        <Info label="Chế độ hóa đơn" value={typeLabel} />
        <Info label="Hạng thành viên" value={customer.tier ? `${customer.tier.name}${typeof customer.tierTotalSales === "number" ? ` · ${currency.format(customer.tierTotalSales)}` : ""}` : "Chưa xếp hạng"} icon={Coins} />
        <Info label="Địa chỉ" value={customer.address || "—"} icon={MapPin} />
        <Info label="Nguồn hồ sơ" value={customer.source === "pos" ? "Tạo từ bán hàng" : customer.source === "import" ? "Nhập dữ liệu" : "Tạo thủ công"} />
      </dl>
      {customer.notes && <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><h4 className="text-sm font-semibold text-on-surface">Ghi chú</h4><p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">{customer.notes}</p></div>}
    </section>
    <section className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2">
      <div><p className="text-xs text-on-surface-variant">Ngày tạo hồ sơ</p><p className="mt-1 text-sm font-medium text-on-surface">{customer.createdAt ? new Date(customer.createdAt).toLocaleString("vi-VN") : "—"}</p></div>
      <div><p className="text-xs text-on-surface-variant">Người tạo</p><p className="mt-1 text-sm font-medium text-on-surface">{customer.createdByName || "—"}</p></div>
    </section>
  </div>;
}

function PointsPanel({ customer, branchId, canManage }: { customer: Customer; branchId?: string; canManage: boolean }) {
  const [account, setAccount] = React.useState<{ balance: number; totalEarned: number; totalRedeemed: number; ledger: CustomerPointEntry[] } | null>(null);
  const [policy, setPolicy] = React.useState<CustomerPointPolicy | null>(null);
  const [amount, setAmount] = React.useState(0);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const scope = branchId ? { companyCode: customer.companyCode, branchId } : null;
  const load = React.useCallback(async () => {
    if (!scope) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [nextPolicy, nextAccount] = await Promise.all([retailCustomerApi.pointPolicy(scope), retailCustomerApi.points(scope, customer._id)]);
      setPolicy(nextPolicy); setAccount(nextAccount);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được thông tin điểm thưởng."); }
    finally { setLoading(false); }
  }, [customer._id, scope?.branchId, scope?.companyCode]);
  React.useEffect(() => { void load(); }, [load]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!scope || !Number.isSafeInteger(amount) || amount === 0 || !reason.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await retailCustomerApi.adjustPoints(scope, customer._id, amount, reason.trim(), crypto.randomUUID());
      setAmount(0); setReason(""); setMessage("Đã ghi điều chỉnh điểm vào sổ khách hàng."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không điều chỉnh được điểm."); }
    finally { setBusy(false); }
  }
  const pointType = (type: string) => ({ earn: "Tích từ đơn", redeem: "Đã sử dụng", refund_earn: "Đảo điểm tích", refund_redeem: "Hoàn điểm", adjust: "Điều chỉnh" }[type] || type);
  if (!branchId) return <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Chọn chi nhánh để xem điểm thưởng của khách.</p>;
  if (loading) return <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">Đang tải sổ điểm...</p>;
  if (error && !account) return <p role="alert" className="rounded-xl border border-error bg-error-container p-4 text-sm text-on-error-container">{error}</p>;
  return <div className="space-y-4">
    {error && <p id="customer-points-error" role="alert" className="rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface">{message}</p>}
    <section className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Số dư điểm" value={`${(account?.balance || 0).toLocaleString("vi-VN")} điểm`} hint={policy?.enabled ? "Chương trình đang hoạt động" : "Chương trình đang tạm dừng"} />
      <SummaryCard label="Tổng điểm đã tích" value={`${(account?.totalEarned || 0).toLocaleString("vi-VN")} điểm`} hint="Từ đơn bán lẻ đã thanh toán" />
      <SummaryCard label="Tổng điểm đã dùng" value={`${(account?.totalRedeemed || 0).toLocaleString("vi-VN")} điểm`} hint="Đã quy đổi trên đơn hàng" />
    </section>
    {policy && <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-sm font-semibold text-on-surface">Chính sách tích điểm và cấn trừ tiền</h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant text-pretty">{policy.enabled ? `Mua ${policy.earnVndPerPoint.toLocaleString("vi-VN")} ₫ được 1 điểm. Tại POS, 1 điểm cấn trừ ${policy.redeemVndPerPoint.toLocaleString("vi-VN")} ₫ trên đơn, tối đa ${policy.maxRedeemPercent}% giá trị hàng.` : "Chương trình tích điểm và cấn trừ bằng điểm đang tạm dừng."}</p>
    </section>}
    {canManage && <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-3 sm:items-end">
      <label className="text-sm font-medium text-on-surface">Điều chỉnh điểm (+/-)<input required type="number" step="1" value={amount} aria-invalid={Boolean(error)} aria-describedby={error ? "customer-points-error" : undefined} onChange={(event) => setAmount(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary" /></label>
      <label className="text-sm font-medium text-on-surface">Lý do<input required maxLength={300} value={reason} aria-invalid={Boolean(error)} aria-describedby={error ? "customer-points-error" : undefined} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary" /></label>
      <button type="submit" disabled={busy || amount === 0} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang ghi..." : "Điều chỉnh"}</button>
    </form>}
    <LedgerTable title="Lịch sử điểm" columns={["Thời gian", "Nghiệp vụ", "Phát sinh", "Số dư", "Lý do"]} empty="Khách chưa có phát sinh điểm." rows={(account?.ledger || []).map((entry) => [new Date(entry.createdAt).toLocaleString("vi-VN"), pointType(entry.type), `${entry.points > 0 ? "+" : ""}${entry.points.toLocaleString("vi-VN")}`, entry.balanceAfter.toLocaleString("vi-VN"), entry.reason])} />
  </div>;
}

function ReceivablesPanel({ customer, branchId }: { customer: Customer; branchId?: string }) {
  const [account, setAccount] = React.useState<{ currentBalance: number; items: CustomerReceivableEntry[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const scope = branchId ? { companyCode: customer.companyCode, branchId } : null;
  const load = React.useCallback(async () => {
    if (!scope) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      setAccount(await retailCustomerApi.receivables(scope, customer._id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được sổ công nợ."); }
    finally { setLoading(false); }
  }, [customer._id, scope?.branchId, scope?.companyCode]);
  React.useEffect(() => { void load(); }, [load]);
  const label = (entry: CustomerReceivableEntry) => ({ charge: "Ghi nợ", payment: "Thu tiền", adjustment: "Điều chỉnh", reversal: "Đảo bút toán", refund: "Hoàn tiền", write_off: "Xóa nợ", due_date_extension: "Gia hạn" }[entry.type] || entry.type);
  if (!branchId) return <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Chọn chi nhánh để xem sổ công nợ.</p>;
  if (loading) return <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">Đang tải sổ công nợ...</p>;
  if (error && !account) return <p role="alert" className="rounded-xl border border-error bg-error-container p-4 text-sm text-on-error-container">{error}</p>;
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      <p className="text-sm font-medium text-on-surface-variant">Công nợ hiện tại</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-on-surface">{currency.format(account?.currentBalance || 0)}</p>
      <p className="mt-2 text-sm text-on-surface-variant text-pretty">Số dư theo sổ công nợ bán lẻ của chi nhánh đang chọn.</p>
    </section>
    <LedgerTable title="Sổ công nợ" columns={["Thời gian", "Nghiệp vụ", "Phát sinh", "Số dư sau giao dịch", "Lý do"]} empty="Khách chưa có phát sinh công nợ tại chi nhánh này." rows={(account?.items || []).map((entry) => [new Date(entry.createdAt).toLocaleString("vi-VN"), label(entry) || entry.type, `${entry.signedAmount > 0 ? "+" : "−"}${currency.format(Math.abs(entry.signedAmount))}`, currency.format(entry.runningBalance), entry.reason || "—"]) } />
  </div>;
}

function LedgerTable({ title, columns, rows, empty }: { title: string; columns: string[]; rows: string[][]; empty: string }) {
  return <section className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
    <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
    <div className="overflow-x-auto"><table className="w-full min-w-max text-left text-sm"><thead><tr className="border-b border-outline-variant text-xs text-on-surface-variant">{columns.map((column) => <th scope="col" key={column} className="px-3 py-2 font-semibold">{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-b border-outline-variant last:border-0">{row.map((value, cell) => <td key={cell} className="max-w-96 break-words px-3 py-3 text-on-surface">{value}</td>)}</tr>)}</tbody>
    </table></div>
    {!rows.length && <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">{empty}</p>}
  </section>;
}

export default function CustomerDetailPage({ customer, branchId, canManage, canRetailRead, canManagePoints, actionError, onBack, onEdit, onToggleStatus, onBillingProfileCreated }: Props) {
  const [activeTab, setActiveTab] = React.useState<DetailTab>("overview");
  const [reloadKey, setReloadKey] = React.useState(0);
  return <main className="mx-auto w-full max-w-screen-2xl space-y-5 px-4 py-5 text-on-surface sm:px-6 sm:py-6 [--color-on-surface-variant:var(--color-slate-600)]">
    <header className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
      {actionError && <p role="alert" className="rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">{actionError}</p>}
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft className="size-4" aria-hidden="true" />Quay lại danh sách</button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-2xl font-semibold text-on-surface text-balance">{customer.name}</h1><span className="rounded-full bg-surface-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant">{customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span><span className="rounded-full bg-primary-container px-2.5 py-1 text-xs font-semibold text-on-primary-container">{customer.customerCode}</span></div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant"><span className="inline-flex items-center gap-1.5"><Phone className="size-4" aria-hidden="true" />{customer.phone}</span>{customer.email && <span className="inline-flex items-center gap-1.5"><AtSign className="size-4" aria-hidden="true" />{customer.email}</span>}{customer.tier && <span>{customer.tier.name}</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customer.phone && <a href={`tel:${customer.phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant px-3.5 text-sm font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><Phone className="size-4" aria-hidden="true" />Gọi khách</a>}
          {canManage && <><button type="button" onClick={onToggleStatus} className="min-h-11 rounded-lg border border-outline-variant px-3.5 text-sm font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary">{customer.status === "active" ? "Ngừng hoạt động" : "Kích hoạt lại"}</button><button type="button" onClick={onEdit} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary">Sửa hồ sơ</button></>}
        </div>
      </div>
    </header>
    <nav aria-label="Các mục hồ sơ khách hàng" className="flex gap-1 overflow-x-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-1">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={activeTab === id ? "page" : undefined} onClick={() => setActiveTab(id)} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary sm:px-4", activeTab === id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container")}><Icon className="size-4" aria-hidden="true" />{label}</button>)}
    </nav>
    <div key={`${activeTab}-${reloadKey}`}>
      {activeTab === "overview" && <Overview customer={customer} branchId={branchId} />}
      {activeTab === 'transactions' && <React.Suspense fallback={<p role="status">Đang mở lịch sử giao dịch…</p>}><CustomerTransactionsPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} /></React.Suspense>}
      {activeTab === "purchases" && <CustomerPurchaseHistoryPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} />}
      {activeTab === 'repairs' && <CustomerRepairsPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} />}
      {activeTab === "receivables" && (canRetailRead ? <ReceivablesPanel key={reloadKey} customer={customer} branchId={branchId} /> : <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Tài khoản chưa có quyền xem dữ liệu bán lẻ.</p>)}
      {activeTab === "points" && (canRetailRead ? <PointsPanel key={reloadKey} customer={customer} branchId={branchId} canManage={canManagePoints} /> : <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Tài khoản chưa có quyền xem dữ liệu bán lẻ.</p>)}
      {activeTab === "billing" && <BillingProfilesPanel customerId={customer._id} companyCode={customer.companyCode} canManage={canManage} onProfileCreated={onBillingProfileCreated} />}
    </div>
    {activeTab !== "overview" && <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-3.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><History className="size-4" aria-hidden="true" />Tải lại mục này</button>}
  </main>;
}
