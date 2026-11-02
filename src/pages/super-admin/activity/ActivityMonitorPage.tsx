import React from "react";
import { Activity, RefreshCw, Pause, Play, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { ErpCard, ErpInput, ErpSelect, ErpPrimaryButton } from "../../../modules/student-management/components/Erp/ErpUI";
import { cn } from "../../../modules/student-management/lib/utils";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";
import { activityMonitorService, type ActivityMonitorFilters, type MonitorAccount, type MonitorEvent } from "../../../services/activityMonitorService";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useActivityMonitor } from "./useActivityMonitor";

const fieldClass = "bg-surface-container-lowest border-outline-variant text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:ring-primary/20";
const cardClass = "bg-surface-container-lowest border-outline-variant shadow-none transition-none";
const buttonClass = "bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/90 active:scale-100 transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const secondaryClass = cn(buttonClass, "border border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high active:bg-surface-container-high");
const categories = [
  ["authentication", "Đăng nhập / Đăng xuất"], ["data", "Thay đổi dữ liệu"], ["security", "Bảo mật và quyền"],
  ["business", "Nghiệp vụ"], ["configuration", "Cấu hình"], ["view", "Xem dữ liệu qua API"],
  ["search", "Tìm kiếm"], ["communication", "Trao đổi"],
] as const;
const dateLabel = (date: string) => new Date(date).toLocaleString("vi-VN");
const initialFrom = () => new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

function EventDetails({ event }: { event: MonitorEvent }) {
  const values = [
    ["Tài khoản", event.actorEmail || event.userId], ["Mã tài khoản", event.userId],
    ["Doanh nghiệp", event.companyCode], ["Chi nhánh", event.branchId],
    ["Thời gian", dateLabel(event.occurredAt)], ["Mã hành động", event.actionType],
    ["Đối tượng", event.entityId], ["Kết quả HTTP", event.statusCode],
    ["Thiết bị", event.deviceSummary], ["IP truy cập", event.sourceIp],
    ["Thời gian xử lý", event.durationMs != null ? `${event.durationMs} ms` : undefined],
    ["Mã đối soát", event.correlationId], ["Mã sự kiện", event.eventId],
  ];
  return <details className="mt-2 text-xs text-on-surface-variant">
    <summary className="w-fit cursor-pointer rounded py-1 text-primary focus-visible:outline-2 focus-visible:outline-primary">Chi tiết sự kiện</summary>
    <dl className="mt-2 grid gap-x-6 gap-y-2 rounded-xl bg-surface-container-low p-3 sm:grid-cols-2">
      {values.filter(([, value]) => value != null && value !== "").map(([label, value]) => <div key={label} className="min-w-0"><dt className="font-medium">{label}</dt><dd className="mt-0.5 break-words text-on-surface">{value}</dd></div>)}
    </dl>
  </details>;
}

export function ActivityMonitorPage() {
  const [filters, setFilters] = React.useState<ActivityMonitorFilters>(() => ({ from: initialFrom(), page: 1 }));
  const [search, setSearch] = React.useState("");
  const [accountSearch, setAccountSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search);
  const debouncedAccountSearch = useDebouncedValue(accountSearch);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [accounts, setAccounts] = React.useState<MonitorAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = React.useState<MonitorAccount | null>(null);
  const [optionsError, setOptionsError] = React.useState("");
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [optionsRevision, setOptionsRevision] = React.useState(0);
  const requestFilters = { ...filters, search: debouncedSearch };
  const { snapshot, error, loading, paused, togglePaused, pendingCount, refresh } = useActivityMonitor(requestFilters);
  const page = filters.page || 1;
  const pages = Math.max(1, Math.ceil((snapshot?.total || 0) / 30));
  const change = (next: Partial<ActivityMonitorFilters>) => setFilters((current) => ({ ...current, ...next, page: 1 }));

  React.useEffect(() => {
    let active = true;
    superAdminTenantService.list().then((value) => { if (active) setTenants(value); }).catch(() => { if (active) setOptionsError("Không thể tải danh sách doanh nghiệp."); });
    return () => { active = false; };
  }, [optionsRevision]);
  React.useEffect(() => {
    const controller = new AbortController();
    setAccountsLoading(true);
    activityMonitorService.accounts(filters.companyCode || "", debouncedAccountSearch, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setAccounts(value); })
      .catch(() => { if (!controller.signal.aborted) { setAccounts([]); setOptionsError("Không thể tải danh sách tài khoản."); } })
      .finally(() => { if (!controller.signal.aborted) setAccountsLoading(false); });
    return () => controller.abort();
  }, [filters.companyCode, debouncedAccountSearch, optionsRevision]);

  const reset = () => { setFilters({ from: initialFrom(), page: 1 }); setSearch(""); setAccountSearch(""); setSelectedAccount(null); };
  const shownAccounts = selectedAccount && !accounts.some((account) => account._id === selectedAccount._id) ? [selectedAccount, ...accounts] : accounts;
  return <section aria-label="Giám sát hoạt động" className="mx-auto w-full max-w-7xl space-y-5 rounded-2xl bg-surface p-4 text-on-surface sm:p-6">
    <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
      <div className="min-w-0"><h2 className="text-balance text-2xl font-semibold">Giám sát hoạt động</h2>
        <p className="mt-2 max-w-2xl text-pretty text-sm text-on-surface-variant">Theo dõi thao tác đã ghi nhận trên máy chủ theo doanh nghiệp và từng tài khoản. Lịch sử được lưu 90 ngày.</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <ErpPrimaryButton type="button" icon={paused ? Play : Pause} onClick={togglePaused} disabled={!snapshot || page !== 1} aria-pressed={paused} className={secondaryClass}>{paused ? "Tiếp tục theo dõi" : "Tạm dừng luồng"}</ErpPrimaryButton>
        <ErpPrimaryButton type="button" icon={RefreshCw} onClick={refresh} disabled={loading} className={buttonClass}>Tải lại</ErpPrimaryButton>
      </div>
    </header>

    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[["Thao tác trong khoảng chọn", snapshot?.total], ["Doanh nghiệp có hoạt động", snapshot?.summary.companies], ["Tài khoản hoạt động 5 phút qua", snapshot?.summary.activeUsers], ["Thao tác thất bại / bị từ chối", snapshot?.summary.failures]].map(([label, value]) => <ErpCard key={String(label)} className={cn(cardClass, "p-4")}><dt className="text-pretty text-xs text-on-surface-variant">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{value == null ? "—" : Number(value).toLocaleString("vi-VN")}</dd></ErpCard>)}
    </dl>

    <ErpCard className={cn(cardClass, "space-y-4 p-4")}>
      <h3 className="text-balance text-sm font-semibold">Phạm vi theo dõi</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1.5 text-xs font-medium">Doanh nghiệp
          <ErpSelect aria-label="Doanh nghiệp" className={fieldClass} value={filters.companyCode || ""} onChange={(event) => { change({ companyCode: event.target.value, userId: "" }); setSelectedAccount(null); setAccountSearch(""); setAccounts([]); }}>
            <option value="">Tất cả doanh nghiệp</option>{tenants.map((tenant) => <option key={tenant.code} value={tenant.code}>{tenant.name || tenant.code} ({tenant.code})</option>)}
          </ErpSelect>
        </label>
        <label className="space-y-1.5 text-xs font-medium">Tìm tài khoản theo tên / email
          <ErpInput aria-label="Tìm tài khoản" className={fieldClass} value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Nhập tên hoặc email" maxLength={100} />
        </label>
        <label className="space-y-1.5 text-xs font-medium">Tài khoản
          <ErpSelect aria-label="Tài khoản" aria-describedby="account-filter-help" className={fieldClass} value={filters.userId || ""} disabled={accountsLoading} onChange={(event) => { change({ userId: event.target.value }); setSelectedAccount(accounts.find((account) => account._id === event.target.value) || null); }}>
            <option value="">{accountsLoading ? "Đang tải tài khoản…" : "Tất cả tài khoản"}</option>{shownAccounts.map((account) => <option key={account._id} value={account._id}>{account.displayName || account.email} · {account.email} · {account.companyCode}</option>)}
          </ErpSelect>
        </label>
        <label className="space-y-1.5 text-xs font-medium">Loại hoạt động
          <ErpSelect aria-label="Loại hoạt động" className={fieldClass} value={filters.category || ""} onChange={(event) => change({ category: event.target.value as ActivityMonitorFilters["category"] })}><option value="">Tất cả loại hoạt động</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</ErpSelect>
        </label>
        <label className="space-y-1.5 text-xs font-medium">Kết quả
          <ErpSelect aria-label="Kết quả" className={fieldClass} value={filters.result || ""} onChange={(event) => change({ result: event.target.value as ActivityMonitorFilters["result"] })}><option value="">Tất cả kết quả</option><option value="success">Thành công</option><option value="failure">Thất bại / Bị từ chối</option></ErpSelect>
        </label>
        <label className="space-y-1.5 text-xs font-medium">Tìm nội dung hoạt động
          <ErpInput aria-label="Tìm nội dung hoạt động" className={fieldClass} value={search} onChange={(event) => { setSearch(event.target.value); change({}); }} placeholder="Ví dụ: chi nhánh, đơn hàng…" maxLength={100} />
        </label>
        <label className="space-y-1.5 text-xs font-medium">Từ ngày (UTC)<ErpInput type="date" aria-label="Từ ngày (UTC)" className={fieldClass} value={filters.from || ""} max={filters.to || undefined} onChange={(event) => change({ from: event.target.value })} /></label>
        <label className="space-y-1.5 text-xs font-medium">Đến ngày (UTC)<ErpInput type="date" aria-label="Đến ngày (UTC)" className={fieldClass} value={filters.to || ""} min={filters.from || undefined} onChange={(event) => change({ to: event.target.value })} /></label>
        <div className="flex items-end"><ErpPrimaryButton type="button" icon={Search} onClick={reset} className={secondaryClass}>Đặt lại bộ lọc</ErpPrimaryButton></div>
      </div>
      <p id="account-filter-help" className="text-pretty text-xs text-on-surface-variant">Danh sách hiển thị tối đa 100 tài khoản; dùng ô tìm kiếm để tìm thêm. Số liệu 5 phút qua áp dụng trong phạm vi bộ lọc, không phải số người đang online. Để trống ngày kết thúc để tiếp tục nhận thao tác mới.</p>
      {optionsError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-error"><span>{optionsError}</span><button type="button" className="rounded underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setOptionsError(""); setOptionsRevision((value) => value + 1); }}>Thử tải bộ lọc lại</button></div>}
    </ErpCard>

    <ErpCard className={cn(cardClass, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant p-4">
        <h3 className="flex items-center gap-2 text-balance text-sm font-semibold"><Activity aria-hidden="true" className="size-4 text-primary" />Luồng hoạt động</h3>
        <p role="status" className="text-xs text-on-surface-variant">{error ? "Mất kết nối cập nhật · Đang thử lại" : page !== 1 ? "Đang xem lịch sử · Dừng tự cập nhật" : paused ? "Đã tạm dừng hiển thị" : "Tự cập nhật mỗi 3 giây"}{snapshot && <> · Cập nhật {dateLabel(snapshot.generatedAt)}</>}</p>
      </div>
      {error && <div role="alert" className="border-b border-outline-variant bg-error-container p-4 text-sm text-on-error-container">{error} {snapshot ? "Dữ liệu bên dưới là lần tải thành công gần nhất." : "Chọn Tải lại để thử lại."}</div>}
      {paused && pendingCount > 0 && <div className="border-b border-outline-variant bg-primary-container p-3"><button type="button" onClick={togglePaused} className="rounded text-sm font-medium text-on-primary-container focus-visible:outline-2 focus-visible:outline-primary" aria-live="polite">Có {pendingCount.toLocaleString("vi-VN")} hoạt động mới — xem ngay</button></div>}
      <div aria-busy={loading}>
        {loading && !snapshot ? <p role="status" className="p-8 text-center text-sm text-on-surface-variant">Đang tải hoạt động…</p> : snapshot?.data.length ? <ol className="divide-y divide-outline-variant">{snapshot.data.map((event) => <li key={event.eventId} className="p-4 hover:bg-surface-container-low focus-within:bg-surface-container-low">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="min-w-0"><p className="break-words text-sm font-medium">{event.description}</p><p className="mt-1 break-words text-xs text-on-surface-variant">{event.actorName || event.actorEmail || "Tài khoản đã xóa / chưa có tên"}{event.actorName && event.actorEmail ? ` · ${event.actorEmail}` : ""}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><button type="button" onClick={() => { change({ companyCode: event.companyCode, userId: "" }); setSelectedAccount(null); }} className="rounded bg-surface-container px-2 py-1 font-medium focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Theo dõi doanh nghiệp ${event.companyCode}`}>{tenants.find((tenant) => tenant.code === event.companyCode)?.name || event.companyCode}</button>
                <button type="button" onClick={() => { change({ companyCode: event.companyCode, userId: event.userId }); setSelectedAccount({ _id: event.userId, companyCode: event.companyCode, displayName: event.actorName, email: event.actorEmail || event.userId, role: event.actorRole || "" }); }} className="rounded py-1 text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Theo dõi tài khoản ${event.actorEmail || event.userId}`}>Theo dõi tài khoản này</button>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs sm:flex-col sm:items-end"><time dateTime={event.occurredAt} className="tabular-nums text-on-surface-variant">{dateLabel(event.occurredAt)}</time><span className={cn("rounded-full px-2 py-1 font-medium", event.result === "failure" ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface")}>{event.result === "failure" ? "Thất bại / Bị từ chối" : "Thành công"}</span></div>
          </div>
          <EventDetails event={event} />
        </li>)}</ol> : !error && <div className="space-y-3 p-8 text-center"><p className="text-pretty text-sm text-on-surface-variant">Chưa có hoạt động phù hợp với bộ lọc.</p><button type="button" onClick={reset} className="rounded text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Đặt lại bộ lọc</button></div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant p-4 text-xs">
        <p className="tabular-nums text-on-surface-variant">Trang {page} / {pages} · {(snapshot?.total || 0).toLocaleString("vi-VN")} hoạt động</p>
        <div className="flex gap-2"><ErpPrimaryButton type="button" icon={ChevronLeft} disabled={page === 1 || loading} onClick={() => setFilters((value) => ({ ...value, page: page - 1 }))} className={secondaryClass}>Trang trước</ErpPrimaryButton><ErpPrimaryButton type="button" icon={ChevronRight} disabled={!snapshot || page >= pages || loading} onClick={() => setFilters((value) => ({ ...value, page: page + 1 }))} className={secondaryClass}>Trang sau</ErpPrimaryButton></div>
      </div>
    </ErpCard>
    <p className="text-pretty text-xs text-on-surface-variant">Nhật ký phản ánh yêu cầu API và kết quả xử lý; không phải ghi hình màn hình hoặc bằng chứng tài khoản đang xem một trang. Không lưu nội dung mật khẩu, token hoặc nội dung biểu mẫu.</p>
  </section>;
}
