import React from "react";
import { ModuleNavigation, ModuleNavigationButton } from "../../../components/common/ModuleNavigation";
import { tabToPath } from "../../../seo/seo-config";
import { primaryCreateButtonClass } from "../../../components/common/primaryCreateButton";
import { ArrowLeft, AtSign, CalendarDays, Coins, CreditCard, FileText, History, MapPin, Phone, ShoppingBag, UserRound } from "lucide-react";
import type { Customer, CustomerLeadNeeds, CustomerPurchaseHistory } from "../types";
import { customerApi } from "../customerApi";
import { customerInvoiceLabels, customerKindLabels } from "../customerLabels";
import { retailCustomerApi, type CustomerPointEntry, type CustomerPointPolicy, type CustomerReceivableEntry } from "../retailCustomerApi";
import BillingProfilesPanel from "./BillingProfilesPanel";
import CustomerPurchaseHistoryPanel from "./CustomerPurchaseHistoryPanel";
import CustomerModuleLinksPanel from "./CustomerModuleLinksPanel";
import CustomerRepairsPanel from './CustomerRepairsPanel';
import { Wrench } from 'lucide-react';
const CustomerTransactionsPanel = React.lazy(() => import('./CustomerTransactionsPanel'));

type Props = {
  customer: Customer;
  branchId?: string;
  canManage: boolean;
  canRetailRead: boolean;
  canRepairRead: boolean;
  canViewModuleLinks: boolean;
  canManagePoints?: boolean;
  canViewLeadNeeds?: boolean;
  initialSection?: string | null;
  actionError?: string;
  onBack: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onBillingProfileCreated: () => Promise<void>;
};

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const tabs = [
  { id: "overview", label: "Tổng quan", icon: UserRound },
  { id: "module-links", label: "Hồ sơ liên kết", icon: FileText },
  { id: "lead-needs", label: "Nhu cầu", icon: FileText },
  { id: 'transactions', label: 'Lịch sử giao dịch', icon: History },
  { id: "purchases", label: "Mua hàng & bảo hành", icon: ShoppingBag },
  { id: "repairs", label: "Dịch vụ & bảo hành", icon: Wrench },
  { id: "receivables", label: "Công nợ", icon: CreditCard },
  { id: "points", label: "Điểm thưởng", icon: Coins },
  { id: "billing", label: "Hồ sơ VAT", icon: FileText },
] as const;
type DetailTab = typeof tabs[number]["id"];

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof UserRound }) {
  return <div className="min-w-0 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
    <dt className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">{Icon && <Icon className="size-4" aria-hidden="true" />}{label}</dt>
    <dd className="mt-2 break-words text-sm font-semibold text-on-surface">{value || "—"}</dd>
  </div>;
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return <div className="min-w-0 rounded-md border border-outline-variant bg-surface-container-lowest p-3">
    <p className="text-xs font-medium text-on-surface-variant">{label}</p>
    <p className="mt-2 break-words text-lg font-semibold tabular-nums text-on-surface">{value}</p>
    <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>
  </div>;
}

function Overview({ customer, branchId, canRetailRead }: { customer: Customer; branchId?: string; canRetailRead: boolean }) {
  const [history, setHistory] = React.useState<CustomerPurchaseHistory | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!branchId || !canRetailRead) { setHistory(null); setError(""); return; }
    let active = true;
    void customerApi.purchaseHistory(customer._id, { companyCode: customer.companyCode, branchId })
      .then((value) => { if (active) { setHistory(value); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được tổng quan mua hàng."); });
    return () => { active = false; };
  }, [branchId, customer.companyCode, customer._id, canRetailRead]);
  const gender = customer.gender === "male" ? "Nam" : customer.gender === "female" ? "Nữ" : customer.gender === "other" ? "Khác" : "—";
  return <div className="space-y-5">
    {canRetailRead && <section aria-label="Tóm tắt hoạt động" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard label="Tổng đơn tại chi nhánh" value={history ? String(history.summary.orderCount) : "—"} hint="Đơn bán lẻ đã ghi nhận" />
      <SummaryCard label="Tổng giá trị mua" value={history ? currency.format(history.summary.totalPurchased) : "—"} hint="Theo dữ liệu chi nhánh đang chọn" />
      <SummaryCard label="Công nợ hiện tại" value={history ? currency.format(history.summary.currentDebt) : "—"} hint="Số dư sổ công nợ bán lẻ" />
      <SummaryCard label="Thiết bị đã mua" value={history ? String(history.devices.length) : "—"} hint="Thiết bị có IMEI / serial" />
    </section>}
    {canRetailRead && !branchId && <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Chọn chi nhánh để xem số liệu mua hàng và công nợ.</p>}
    {error && <p role="alert" className="rounded-xl border border-error bg-error-container p-4 text-sm text-on-error-container">{error}</p>}
    <section aria-labelledby="customer-profile-title" className="space-y-4">
      <div><h3 id="customer-profile-title" className="text-base font-semibold text-on-surface">Thông tin hồ sơ</h3><p className="mt-1 text-sm text-on-surface-variant">Thông tin khách hàng dùng chung trong công ty.</p></div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Info label="Mã khách hàng" value={customer.customerCode} icon={UserRound} />
        <Info label="Đối tượng khách hàng" value={customerKindLabels[customer.customerKind ?? "unclassified"] ?? customerKindLabels.unclassified} />
        {customer.customerKind === 'business' && <Info label="Người liên hệ" value={customer.contactName || ''} />}
        <Info label="Số điện thoại" value={customer.phone} icon={Phone} />
        <Info label="Email" value={customer.email || "—"} icon={AtSign} />
        <Info label="Ngày sinh" value={customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString("vi-VN") : "—"} icon={CalendarDays} />
        <Info label="Giới tính" value={gender} />
        <Info label="Chế độ hóa đơn" value={customerInvoiceLabels[customer.type]} />
        <Info label="Hạng thành viên" value={customer.tier ? `${customer.tier.name}${typeof customer.tierGrossProfit === "number" ? ` · lãi gộp ${currency.format(customer.tierGrossProfit)}` : ""}` : "Chưa xếp hạng"} icon={Coins} />
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

function PointsPanel({ customer, branchId, canManage }: { customer: Customer; branchId?: string; canManage?: boolean }) {
  const [account, setAccount] = React.useState<{ balance: number; totalEarned: number; totalRedeemed: number; ledger: CustomerPointEntry[] } | null>(null);
  const [policy, setPolicy] = React.useState<CustomerPointPolicy | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
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
  const pointType = (type: string) => ({ earn: "Tích từ đơn", redeem: "Đã sử dụng", refund_earn: "Đảo điểm tích", refund_redeem: "Hoàn điểm", adjust: "Điều chỉnh" }[type] || type);
  if (!branchId) return <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Chọn chi nhánh để xem điểm thưởng của khách.</p>;
  if (loading) return <p role="status" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 text-sm text-on-surface-variant">Đang tải sổ điểm...</p>;
  if (error && !account) return <p role="alert" className="rounded-xl border border-error bg-error-container p-4 text-sm text-on-error-container">{error}</p>;
  return <div className="space-y-4">
    {error && <p id="customer-points-error" role="alert" className="rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Số dư điểm" value={`${(account?.balance || 0).toLocaleString("vi-VN")} điểm`} hint={policy?.enabled ? "Chương trình đang hoạt động" : "Chương trình đang tạm dừng"} />
      <SummaryCard label="Tổng điểm đã tích" value={`${(account?.totalEarned || 0).toLocaleString("vi-VN")} điểm`} hint="Từ đơn bán lẻ đã thanh toán" />
      <SummaryCard label="Tổng điểm đã dùng" value={`${(account?.totalRedeemed || 0).toLocaleString("vi-VN")} điểm`} hint="Đã quy đổi trên đơn hàng" />
    </section>
    {policy && <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="text-sm font-semibold text-on-surface">Chính sách tích điểm và cấn trừ tiền</h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant text-pretty">{policy.enabled ? `Mua ${policy.earnVndPerPoint.toLocaleString("vi-VN")} ₫ được 1 điểm. Tại POS, 1 điểm cấn trừ ${policy.redeemVndPerPoint.toLocaleString("vi-VN")} ₫ trên đơn, tối đa ${policy.maxRedeemPercent}% giá trị hàng.` : "Chương trình tích điểm và cấn trừ bằng điểm đang tạm dừng."}</p>
    </section>}
    {canManage && <a href={`${tabToPath("BÁN LẺ")}?sub=ma-uu-dai&points=1&customerCode=${encodeURIComponent(customer.customerCode)}`}
      className="inline-flex min-h-10 items-center rounded-md border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container">
      Mở sổ điểm trong Bán lẻ
    </a>}
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

function LeadNeedsPanel({ customer }: { customer: Customer }) {
  const [rows, setRows] = React.useState<CustomerLeadNeeds[]>();
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    const controller = new AbortController();
    void customerApi.leadNeeds(customer._id, customer.companyCode, controller.signal)
      .then(data => { if (!controller.signal.aborted) setRows(data); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được nhu cầu."); });
    return () => controller.abort();
  }, [customer._id, customer.companyCode]);
  if (error) return <p role="alert" className="text-sm text-error">{error}</p>;
  if (!rows) return <p role="status" className="text-sm text-on-surface-variant">Đang tải nhu cầu…</p>;
  const entries = rows.flatMap(row => row.needs?.length ? row.needs.map(need => ({ ...need, fields: row.intakeFields })) :
    row.productOfChoice ? [{ id: row.id, title: row.productOfChoice, groupLabel: "Lead", answers: {}, fields: row.intakeFields }] : []);
  return entries.length ? <ul className="space-y-2">{entries.map(need => <li key={need.id} className="rounded-md border border-outline-variant p-3 text-sm">
    <p className="font-medium">{need.title} · {need.groupLabel}</p>
    {Object.entries(need.answers || {}).map(([key, answer]) => <p key={key} className="text-on-surface-variant">{need.fields?.find(field => field.key === key)?.label || key} · {String(answer)}</p>)}
  </li>)}</ul> : <p className="text-sm text-on-surface-variant">Chưa có nhu cầu từ Lead.</p>;
}

export default function CustomerDetailPage({ customer, branchId, canManage, canRetailRead, canRepairRead, canViewModuleLinks, canManagePoints, canViewLeadNeeds, initialSection, actionError, onBack, onEdit, onToggleStatus, onBillingProfileCreated }: Props) {
  const visibleTabs = tabs.filter(({ id }) => {
    if (id === "lead-needs") return canViewLeadNeeds;
    if (id === "module-links") return canViewModuleLinks;
    if (id === "repairs") return canRepairRead;
    if (id === "transactions") return canRetailRead || canRepairRead;
    if (id === "purchases" || id === "receivables" || id === "points") return canRetailRead;
    return true;
  });
  const [requestedTab, setRequestedTab] = React.useState(initialSection || "overview");
  const activeTab = visibleTabs.find(({ id }) => id === requestedTab)?.id || "overview";
  const [reloadKey, setReloadKey] = React.useState(0);
  const tabButtons = React.useRef<Partial<Record<DetailTab, HTMLButtonElement>>>({});
  const quickSections = visibleTabs.filter(({ id }) => id === "module-links" || id === "lead-needs" || id === "purchases" || id === "repairs");

  function openSection(id: DetailTab) {
    setRequestedTab(id);
    requestAnimationFrame(() => tabButtons.current[id]?.focus());
  }

  return <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface">
    <ModuleNavigation label="Các mục hồ sơ khách hàng" activeValue={activeTab}>
      {visibleTabs.map(({ id, label, icon: Icon }) => <ModuleNavigationButton key={id} ref={node => { tabButtons.current[id] = node ?? undefined; }} active={activeTab === id} icon={<Icon />} onClick={() => setRequestedTab(id)}>{label}</ModuleNavigationButton>)}
    </ModuleNavigation>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 shadow-xs sm:p-4">
    <header className="space-y-3 border-b border-outline-variant pb-4">
      {actionError && <p role="alert" className="rounded-xl border border-error bg-error-container p-3 text-sm text-on-error-container">{actionError}</p>}
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft className="size-4" aria-hidden="true" />Quay lại danh sách</button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-lg font-semibold text-on-surface text-balance">{customer.name}</h1><span className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">{customer.status === "active" ? "Đang hoạt động" : "Ngừng hoạt động"}</span><span className="rounded-md bg-primary-container px-2 py-0.5 text-xs font-medium text-on-primary-container">{customer.customerCode}</span></div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant"><span className="inline-flex items-center gap-1.5"><Phone className="size-4" aria-hidden="true" />{customer.phone}</span>{customer.email && <span className="inline-flex items-center gap-1.5"><AtSign className="size-4" aria-hidden="true" />{customer.email}</span>}{customer.tier && <span>{customer.tier.name}</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customer.phone && <a href={`tel:${customer.phone}`} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><Phone className="size-4" aria-hidden="true" />Gọi khách</a>}
          {canManage && <><button type="button" onClick={onToggleStatus} className="min-h-9 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{customer.status === "active" ? "Ngừng hoạt động" : "Kích hoạt lại"}</button><button type="button" onClick={onEdit} className={primaryCreateButtonClass}>Sửa hồ sơ</button></>}
        </div>
      </div>
    </header>
    <div key={`${activeTab}-${reloadKey}`}>
      {activeTab === "lead-needs" && canViewLeadNeeds && <LeadNeedsPanel key={customer._id} customer={customer} />}
      {activeTab === "overview" && <div className="space-y-4">
        {quickSections.length > 0 && <div role="group" aria-label="Mở nhanh thông tin khách hàng" className="flex flex-wrap gap-2">
          {quickSections.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => openSection(id)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-outline-variant px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
            <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />{id === "lead-needs" ? "Nhu cầu từ Lead" : id === "module-links" && canManage ? "Xem và liên kết hồ sơ" : label}
          </button>)}
        </div>}
        <Overview customer={customer} branchId={branchId} canRetailRead={canRetailRead} />
      </div>}
      {activeTab === "module-links" && (branchId
        ? <CustomerModuleLinksPanel key={`${customer._id}:${branchId}`} customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} canManage={canManage} />
        : <p className="text-sm text-on-surface-variant">Chọn chi nhánh để xem hồ sơ liên kết.</p>)}
      {activeTab === 'transactions' && <React.Suspense fallback={<p role="status">Đang mở lịch sử giao dịch…</p>}><CustomerTransactionsPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} /></React.Suspense>}
      {activeTab === "purchases" && canRetailRead && <CustomerPurchaseHistoryPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} />}
      {activeTab === 'repairs' && <CustomerRepairsPanel customerId={customer._id} companyCode={customer.companyCode} branchId={branchId} />}
      {activeTab === "receivables" && (canRetailRead ? <ReceivablesPanel key={reloadKey} customer={customer} branchId={branchId} /> : <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Tài khoản chưa có quyền xem dữ liệu bán lẻ.</p>)}
      {activeTab === "points" && (canRetailRead ? <PointsPanel key={reloadKey} customer={customer} branchId={branchId} canManage={canManagePoints} /> : <p className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">Tài khoản chưa có quyền xem dữ liệu bán lẻ.</p>)}
      {activeTab === "billing" && <BillingProfilesPanel customerId={customer._id} companyCode={customer.companyCode} canManage={canManage} onProfileCreated={onBillingProfileCreated} />}
    </div>
    {activeTab !== "overview" && <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><History className="size-4" aria-hidden="true" />Tải lại mục này</button>}
    </div>
  </main>;
}
