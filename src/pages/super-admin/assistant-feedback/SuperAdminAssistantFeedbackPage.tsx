import React from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, Star } from "lucide-react";
import { ErpCard, ErpInput, ErpPrimaryButton, ErpSelect } from "../../../modules/student-management/components/Erp/ErpUI";
import { cn } from "../../../modules/student-management/lib/utils";
import { superAdminTenantService, type Tenant } from "../../../services/superAdminTenantService";
import {
  superAdminAssistantFeedbackService,
  type SuperAdminAssistantFeedback,
  type SuperAdminAssistantFeedbackFilters,
  type SuperAdminAssistantFeedbackReport,
  type SuperAdminFeedbackBranch,
} from "../../../services/superAdminAssistantFeedbackService";

const PAGE_SIZE = 20;
const actionClass = "bg-primary text-on-primary hover:bg-primary/90 active:bg-primary/90 active:scale-100 transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const secondaryClass = cn(actionClass, "border border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high active:bg-surface-container-high");

function dateInputValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function initialFilters(): SuperAdminAssistantFeedbackFilters {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 6);
  return { from: dateInputValue(from), to: dateInputValue(today), page: 1, limit: PAGE_SIZE };
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

function FeedbackEntry({ item, companyName }: { item: SuperAdminAssistantFeedback; companyName: string }) {
  return <ErpCard className="space-y-3 rounded-md p-4 shadow-none">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-on-surface">{item.userName || item.userEmail || "Người dùng"}</p>
        {item.userName && item.userEmail && <p className="mt-0.5 truncate text-xs text-on-surface-variant">{item.userEmail}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span role="img" aria-label={`${item.rating} trên 5 sao`} className="inline-flex items-center gap-0.5 text-primary">
          {[1, 2, 3, 4, 5].map(value => <Star key={value} aria-hidden="true" className={cn("size-3.5", value <= item.rating ? "fill-primary" : "text-outline-variant")} />)}
        </span>
        <span className="text-sm font-semibold tabular-nums text-on-surface">{item.rating}/5</span>
      </div>
    </div>
    <dl className="grid gap-x-4 gap-y-2 border-y border-outline-variant py-3 sm:grid-cols-2">
      <div className="min-w-0"><dt className="text-xs text-on-surface-variant">Doanh nghiệp</dt><dd className="mt-0.5 truncate text-sm text-on-surface" title={item.companyCode}>{companyName} <span className="text-xs text-on-surface-variant">({item.companyCode})</span></dd></div>
      <div className="min-w-0"><dt className="text-xs text-on-surface-variant">Chi nhánh</dt><dd className="mt-0.5 truncate text-sm text-on-surface">{item.branchName}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-on-surface-variant">Thời gian đánh giá</dt><dd className="mt-0.5 text-sm tabular-nums text-on-surface"><time dateTime={item.submittedAt}>{dateLabel(item.submittedAt)}</time></dd></div>
    </dl>
    {item.comment && <p className="text-pretty whitespace-pre-wrap break-words text-sm text-on-surface" style={{ overflowWrap: "anywhere" }}><span className="font-medium">Góp ý:</span> {item.comment}</p>}
    <details className="text-sm">
      <summary className="w-fit cursor-pointer rounded-sm py-1 text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">Xem câu hỏi và câu trả lời</summary>
      <dl className="mt-2 space-y-3 rounded-md bg-surface-container-low p-3">
        <div><dt className="text-xs font-medium text-on-surface-variant">Câu hỏi</dt><dd className="mt-1 whitespace-pre-wrap break-words text-pretty text-on-surface" style={{ overflowWrap: "anywhere" }}>{item.question || "Không lưu được nội dung câu hỏi."}</dd></div>
        <div><dt className="text-xs font-medium text-on-surface-variant">Câu trả lời</dt><dd className="mt-1 whitespace-pre-wrap break-words text-pretty text-on-surface" style={{ overflowWrap: "anywhere" }}>{item.answer}</dd></div>
      </dl>
    </details>
  </ErpCard>;
}

export function SuperAdminAssistantFeedbackPage() {
  const [filters, setFilters] = React.useState<SuperAdminAssistantFeedbackFilters>(initialFilters);
  const [searchDraft, setSearchDraft] = React.useState("");
  const [appliedSearch, setAppliedSearch] = React.useState("");
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [branches, setBranches] = React.useState<SuperAdminFeedbackBranch[]>([]);
  const [report, setReport] = React.useState<SuperAdminAssistantFeedbackReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    superAdminTenantService.list().then(value => { if (active) setTenants(value); })
      .catch(() => { if (active) setError("Không thể tải danh sách doanh nghiệp."); });
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    if (!filters.companyCode) {
      setBranches([]);
      return () => controller.abort();
    }
    superAdminAssistantFeedbackService.branches(filters.companyCode, controller.signal)
      .then(value => { if (!controller.signal.aborted) setBranches(value); })
      .catch(() => { if (!controller.signal.aborted) setBranches([]); });
    return () => controller.abort();
  }, [filters.companyCode]);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    superAdminAssistantFeedbackService.report({ ...filters, search: appliedSearch }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setReport(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không thể tải báo cáo đánh giá."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, appliedSearch, refreshKey]);

  const changeFilter = (values: Partial<SuperAdminAssistantFeedbackFilters>) => setFilters(current => ({ ...current, ...values, page: 1 }));
  const reset = () => {
    setFilters(initialFilters());
    setSearchDraft("");
    setAppliedSearch("");
  };
  const pages = Math.max(1, Math.ceil((report?.total || 0) / PAGE_SIZE));
  const tenantsByCode = new Map(tenants.map(tenant => [tenant.code, tenant.name || tenant.code]));

  return <section aria-label="Báo cáo đánh giá trợ lý ERP" className="mx-auto w-full max-w-7xl space-y-5 rounded-2xl bg-surface p-4 text-on-surface sm:p-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <h2 data-typography="page-title" className="text-balance text-lg font-semibold">Đánh giá trợ lý ERP</h2>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-on-surface-variant">Tổng hợp mức độ hữu ích và góp ý trên các câu trả lời trong chế độ thao tác ERP.</p>
      </div>
      <ErpPrimaryButton type="button" icon={RefreshCw} onClick={() => setRefreshKey(value => value + 1)} disabled={loading} className={actionClass}>Tải lại</ErpPrimaryButton>
    </header>

    <form aria-label="Bộ lọc đánh giá" onSubmit={event => { event.preventDefault(); setAppliedSearch(searchDraft.trim()); changeFilter({ page: 1 }); }} className="grid gap-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4 sm:grid-cols-2 xl:grid-cols-6">
      <div className="space-y-1"><label htmlFor="assistant-feedback-from" className="text-xs font-medium text-on-surface">Từ ngày</label><ErpInput id="assistant-feedback-from" type="date" max={filters.to} value={filters.from || ""} onChange={event => changeFilter({ from: event.target.value })} /></div>
      <div className="space-y-1"><label htmlFor="assistant-feedback-to" className="text-xs font-medium text-on-surface">Đến ngày</label><ErpInput id="assistant-feedback-to" type="date" min={filters.from} value={filters.to || ""} onChange={event => changeFilter({ to: event.target.value })} /></div>
      <div className="space-y-1"><label htmlFor="assistant-feedback-company" className="text-xs font-medium text-on-surface">Doanh nghiệp</label><ErpSelect id="assistant-feedback-company" value={filters.companyCode || ""} onChange={event => changeFilter({ companyCode: event.target.value, branchId: "" })}><option value="">Tất cả doanh nghiệp</option>{tenants.map(tenant => <option key={tenant.code} value={tenant.code}>{tenant.name || tenant.code}</option>)}</ErpSelect></div>
      <div className="space-y-1"><label htmlFor="assistant-feedback-branch" className="text-xs font-medium text-on-surface">Chi nhánh</label><ErpSelect id="assistant-feedback-branch" value={filters.branchId || ""} onChange={event => changeFilter({ branchId: event.target.value })} disabled={!filters.companyCode}><option value="">{filters.companyCode ? "Tất cả chi nhánh" : "Chọn doanh nghiệp trước"}</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}</ErpSelect></div>
      <div className="space-y-1"><label htmlFor="assistant-feedback-rating" className="text-xs font-medium text-on-surface">Số sao</label><ErpSelect id="assistant-feedback-rating" value={filters.rating || ""} onChange={event => changeFilter({ rating: event.target.value ? Number(event.target.value) : undefined })}><option value="">Tất cả mức điểm</option>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} sao</option>)}</ErpSelect></div>
      <div className="space-y-1 sm:col-span-2 xl:col-span-1"><label htmlFor="assistant-feedback-search" className="text-xs font-medium text-on-surface">Tìm nội dung</label><div className="flex gap-2"><ErpInput id="assistant-feedback-search" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Câu hỏi, câu trả lời, góp ý" className="min-w-0" /><ErpPrimaryButton type="submit" icon={Search} aria-label="Tìm đánh giá" className={actionClass + " shrink-0 px-3"}>Tìm</ErpPrimaryButton></div></div>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 xl:col-span-6">
        <p role="status" className="text-xs text-on-surface-variant">{report ? `Có ${report.total.toLocaleString("vi-VN")} đánh giá phù hợp` : ""}</p>
        <button type="button" onClick={reset} className="rounded px-2 py-1 text-sm text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">Xóa bộ lọc</button>
      </div>
    </form>

    {error && <p role="alert" className="rounded-md border border-error/30 bg-error-container p-3 text-pretty text-sm text-error">{error}</p>}

    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        ["Số đánh giá", report?.summary.total],
        ["Điểm trung bình", report ? `${report.summary.averageRating.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}/5` : undefined],
        ["Đánh giá từ 1–2 sao", report?.summary.lowRatingCount],
      ].map(([label, value]) => <ErpCard key={String(label)} className="p-4 shadow-none">
        <dt className="text-xs text-on-surface-variant">{label}</dt>
        <dd className="mt-2 text-xl font-semibold tabular-nums text-on-surface">{value == null ? "—" : typeof value === "number" ? value.toLocaleString("vi-VN") : value}</dd>
      </ErpCard>)}
    </dl>

    <section aria-label="Danh sách đánh giá" aria-busy={loading} className="space-y-3">
      {loading ? <div role="status" className="space-y-3"><p className="text-sm text-on-surface-variant">Đang tải đánh giá…</p>{[0, 1, 2].map(item => <ErpCard key={item} className="h-24 shadow-none"><div aria-hidden="true" className="h-full rounded bg-surface-container-low" /></ErpCard>)}</div>
        : report?.items.length ? <>
          <div className="space-y-3">{report.items.map((item, index) => <FeedbackEntry key={`${item.companyCode}-${item.submittedAt}-${index}`} item={item} companyName={tenantsByCode.get(item.companyCode) || item.companyCode} />)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs tabular-nums text-on-surface-variant">Trang {filters.page || 1} / {pages}</p>
            <div className="flex gap-2">
              <ErpPrimaryButton type="button" icon={ChevronLeft} disabled={(filters.page || 1) <= 1} onClick={() => changeFilter({ page: Math.max(1, (filters.page || 1) - 1) })} className={secondaryClass}>Trước</ErpPrimaryButton>
              <ErpPrimaryButton type="button" icon={ChevronRight} disabled={(filters.page || 1) >= pages} onClick={() => changeFilter({ page: Math.min(pages, (filters.page || 1) + 1) })} className={secondaryClass}>Tiếp</ErpPrimaryButton>
            </div>
          </div>
        </> : <ErpCard className="space-y-2 p-5 text-center shadow-none">
          <p className="text-balance text-sm font-semibold">Không có đánh giá phù hợp</p>
          <button type="button" onClick={reset} className="rounded px-2 py-1 text-sm text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary">Xóa bộ lọc và xem lại</button>
        </ErpCard>}
    </section>
  </section>;
}
