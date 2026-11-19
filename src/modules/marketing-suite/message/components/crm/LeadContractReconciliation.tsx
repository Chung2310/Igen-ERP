import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { LeadContractPhoto, LeadContractReport, LeadContractStatus, LeadReconciliationScope, TelecomCustomerInfo } from "../../../../../../shared/marketing-suite/telecom-invoice";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { TablePagination } from "../../../../../components/common/TablePagination";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { crmService, type ExtendedLeadCard } from "../../services/crmService";
import { LeadContractPhotos } from "./LeadContractPhotos";

const fieldClass = "min-h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary";
const linkClass = "rounded text-left text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const statuses: Record<LeadContractStatus, string> = {
  matched: "Đầy đủ, khớp thông tin",
  different: "Khác thông tin",
  incomplete: "Chưa đủ thông tin để so",
  excel_only: "Chỉ có trong Excel",
  lead_only: "Chỉ có trên ERP",
  needs_review: "Cần kiểm tra",
  out_of_scope: "Ngoài phạm vi ngày tạo Lead",
};

function vietnamToday() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(key => parts.find(part => part.type === key)!.value).join("-");
}
const displayDay = (value: string) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");

export function LeadContractReconciliation({
  onClose, onOpenLead, onOpenSource, onSaved,
}: {
  onClose: () => void;
  onOpenLead: (lead: ExtendedLeadCard) => void;
  onOpenSource: (photo: LeadContractPhoto) => void;
  onSaved: () => void;
}) {
  const [view, setView] = useState<"excel" | "review">("excel");
  return <ErpModal native maxWidth="max-w-3xl" title="Đối soát khách hàng nhà mạng" onClose={onClose}>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Nội dung đối soát">
      {([["excel", "Đối soát Excel"], ["review", "Ảnh chờ kiểm tra"]] as const).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}
          className="min-h-9 rounded-md border border-outline-variant px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary">
          {label}
        </button>)}
    </div>
    <div hidden={view !== "excel"}><ExcelComparison onOpenLead={onOpenLead} /></div>
    {view === "review" && <LeadContractPhotos onOpenSource={onOpenSource} onSaved={onSaved} />}
  </ErpModal>;
}

function ExcelComparison({ onOpenLead }: { onOpenLead: (lead: ExtendedLeadCard) => void }) {
  const today = vietnamToday();
  const [providers, setProviders] = useState<string[]>();
  const [provider, setProvider] = useState("");
  const [year, setYear] = useState(today.slice(0, 4));
  const [quarter, setQuarter] = useState(String(Math.ceil(Number(today.slice(5, 7)) / 3)));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [scopeResult, setScopeResult] = useState<{ key: string; data: LeadReconciliationScope }>();
  const [counting, setCounting] = useState(false);
  const [scopeError, setScopeError] = useState("");
  const [file, setFile] = useState<File>();
  const [report, setReport] = useState<LeadContractReport>();
  const [filter, setFilter] = useState<LeadContractStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [working, setWorking] = useState(false);
  const [opening, setOpening] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const errorId = useId();
  const fileHintId = useId();
  const rangeHintId = useId();
  const scopeErrorId = useId();
  const request = useRef<AbortController>(null);
  const scopeRequest = useRef<AbortController>(null);
  const scopeKey = `${provider}:${from}:${to}`;
  const scope = scopeResult?.key === scopeKey ? scopeResult.data : undefined;
  useEffect(() => {
    const controller = new AbortController();
    void crmService.getLeadContractProviders(controller.signal).then(items => {
      if (!controller.signal.aborted) { setProviders([...new Set(["FPT", "VNPT", ...items])]); setProvider("FPT"); }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được nhà cung cấp.");
    });
    return () => { controller.abort(); request.current?.abort(); scopeRequest.current?.abort(); };
  }, [attempt]);

  async function previewScope() {
    scopeRequest.current?.abort();
    setScopeResult(undefined); setScopeError(""); setReport(undefined);
    if (!from || !to || from > to) { setScopeError("Chọn khoảng ngày hợp lệ; Từ ngày không được sau Đến ngày."); return; }
    const controller = new AbortController();
    scopeRequest.current = controller;
    setCounting(true);
    try {
      const data = await crmService.getLeadReconciliationScope(provider, from, to, controller.signal);
      if (!controller.signal.aborted) setScopeResult({ key: scopeKey, data });
    } catch (cause) {
      if (!controller.signal.aborted) setScopeError(cause instanceof Error ? cause.message : "Không đếm được Lead. Thử lại bằng nút Xem số Lead.");
    } finally { if (!controller.signal.aborted) setCounting(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || working || !scope) return;
    const controller = new AbortController();
    request.current = controller;
    setWorking(true);
    setError("");
    setReport(undefined);
    try {
      const result = await crmService.reconcileLeadContracts(file, provider, Number(year), Number(quarter), { from, to }, controller.signal);
      if (!controller.signal.aborted) { setReport(result); setFilter("all"); setPage(1); }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không đối soát được file Excel.");
    } finally {
      if (!controller.signal.aborted) setWorking(false);
    }
  }

  async function openLead(id: string) {
    if (opening) return;
    setError("");
    setOpening(id);
    try {
      onOpenLead(await crmService.getLead(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không mở được Lead.");
    } finally {
      setOpening("");
    }
  }
  const comparisonRows = report ? report.excelRows
    ? [...report.excelRows, ...report.rows.filter(row => row.status === "lead_only" || (row.status === "needs_review" && !row.sourceRows?.length))] : report.rows : [];
  const visible = comparisonRows.filter(row => filter === "all" || row.status === filter);
  if (!providers && !error) return <p role="status" className="text-pretty text-sm text-on-surface-variant">Đang tải nhà cung cấp…</p>;
  if (!providers) return <div className="space-y-2">
    <p role="alert" className="text-pretty text-sm text-error">{error}</p>
    <button type="button" className={linkClass} onClick={() => { setError(""); setAttempt(n => n + 1); }}>Tải lại</button>
  </div>;

  return <div className="space-y-3">
    <form onSubmit={submit} className="space-y-3" aria-busy={working || counting}>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="min-w-0 space-y-1 text-sm">
          <span>Nhà mạng</span>
          <select className={fieldClass} value={provider} disabled={working || counting} onChange={event => { setProvider(event.target.value); setReport(undefined); }}>
            {providers.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">
          <span>Quý</span>
          <select className={fieldClass} value={quarter} disabled={working} onChange={event => { setQuarter(event.target.value); setReport(undefined); }}>
            {[1, 2, 3, 4].map(item => <option key={item} value={item}>Quý {item}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">
          <span>Năm</span>
          <input type="number" className={fieldClass} value={year} min={2000} max={2100} required disabled={working}
            onChange={event => { setYear(event.target.value); setReport(undefined); }} />
        </label>
      </div>
      <fieldset className="space-y-2 rounded-md border border-outline-variant p-3" disabled={working || counting}>
        <legend className="px-1 text-sm font-medium">Phạm vi Lead theo ngày tạo</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Từ ngày tạo Lead</span>
            <input type="date" required min="2000-01-01" max={to || "2100-12-31"} value={from} className={fieldClass}
              aria-invalid={Boolean(scopeError)} aria-describedby={`${rangeHintId}${scopeError ? ` ${scopeErrorId}` : ""}`}
              onChange={event => { setFrom(event.target.value); setScopeError(""); setReport(undefined); }} />
          </label>
          <label className="space-y-1 text-sm"><span>Đến ngày tạo Lead</span>
            <input type="date" required min={from || "2000-01-01"} max="2100-12-31" value={to} className={fieldClass}
              aria-invalid={Boolean(scopeError)} aria-describedby={`${rangeHintId}${scopeError ? ` ${scopeErrorId}` : ""}`}
              onChange={event => { setTo(event.target.value); setScopeError(""); setReport(undefined); }} />
          </label>
        </div>
        <p id={rangeHintId} className="text-pretty text-xs text-on-surface-variant">Tính đủ ngày đầu và ngày cuối theo giờ Việt Nam. Ngày hòa mạng và kỳ trong Excel không dùng để lọc ngày tạo Lead.</p>
        <button type="button" className={linkClass} onClick={() => void previewScope()}>{counting ? "Đang đếm Lead…" : "Xem số Lead"}</button>
      </fieldset>
      {scopeError && <p id={scopeErrorId} role="alert" className="text-pretty text-sm text-error">{scopeError}</p>}
      {scope && <div role="status" className="space-y-1 text-sm tabular-nums">
        <p className="text-pretty">{scope.leadCount} Lead trong phạm vi {displayDay(scope.from)} – {displayDay(scope.to)}.</p>
        {scope.invalidCodeCount > 0 && <p className="text-pretty text-error">{scope.invalidCodeCount} Lead thiếu hoặc sai mã, cần kiểm tra trước khi ghép.</p>}
        {scope.missingDateCount > 0 && <p className="text-pretty text-error">{scope.missingDateCount} Lead thiếu ngày tạo, chưa thể xác định phạm vi.</p>}
      </div>}
      <p className="text-pretty text-xs text-on-surface-variant">FPT ghép bằng Số hợp đồng, VNPT bằng Mã khách hàng/Account. So tên, địa chỉ, dịch vụ và mốc hòa mạng; giữ nguyên từng dòng và thứ tự trong Excel, kể cả các dòng lặp.</p>
      <label className="block space-y-1 text-sm">
        <span>File bảng kê (.xlsx)</span>
        <input type="file" className="block w-full rounded-md border border-outline-variant p-2 text-sm outline-none focus:border-primary"
          required accept=".xlsx" disabled={working || !scope} aria-invalid={Boolean(error)} aria-describedby={`${fileHintId}${error ? ` ${errorId}` : ""}`}
          onChange={event => {
            const candidate = event.target.files?.[0];
            setReport(undefined);
            if (candidate && candidate.size > 10 * 1024 * 1024) { setFile(undefined); setError("Chọn một file .xlsx tối đa 10 MB."); return; }
            setFile(candidate); setError("");
          }} />
      </label>
      <p id={fileHintId} className="text-pretty text-xs text-on-surface-variant">{!scope ? "Bấm Xem số Lead trước khi chọn file. " : ""}Tối đa 10 MB. Chọn quý/năm theo kỳ trong file Excel, độc lập với khoảng ngày tạo Lead.</p>
      <button type="submit" className={primaryCreateButtonClass} disabled={working || !scope || !file}>{working ? "Đang đối soát…" : "Đối soát thông tin khách hàng"}</button>
    </form>
    {error && <p id={errorId} role="alert" className="text-pretty text-sm text-error">{error}</p>}
    {report && <section aria-label="Kết quả đối soát" className="space-y-2">
      <p role="status" className="text-pretty text-sm tabular-nums">
        {report.excelCount} mã trong Excel · {report.sourceRowCount ?? report.excelCount} dòng · {report.duplicates} dòng có thông tin lặp (vẫn giữ đủ)
      </p>
      {report.scope && <p className="text-pretty text-sm tabular-nums">Đã xét {report.scope.leadCount} Lead tạo từ {displayDay(report.scope.from)} đến {displayDay(report.scope.to)}. Hồ sơ ngoài phạm vi chưa được so thông tin.</p>}
      {report.sheetName && <p className="text-pretty text-xs text-on-surface-variant">Bảng: {report.sheetName} · {report.period}. Mốc hòa mạng được so riêng, kể cả khách hòa mạng từ các năm trước.</p>}
      {report.invalidRows.length > 0 && <p className="text-pretty text-sm text-error">
        {report.invalidRows.length} dòng thiếu mã hoặc mã sai định dạng (dòng {report.invalidRows.slice(0, 12).join(", ")}{report.invalidRows.length > 12 ? "…" : ""}).
      </p>}
      <label className="block max-w-xs space-y-1 text-sm">
        <span>Lọc kết quả</span>
        <select className={fieldClass} value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(1); }}>
          <option value="all">Tất cả ({comparisonRows.length})</option>
          {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>
            {label} ({comparisonRows.filter(row => row.status === value).length})
          </option>)}
        </select>
      </label>
      {visible.length ? <div className="overflow-hidden rounded-md border border-outline-variant">
        <div className="overflow-x-auto">
          <table aria-label="Đối soát theo từng dòng Excel" className="min-w-5xl w-full text-left text-sm">
            <thead className="bg-surface-container">
              <tr>{["STT / dòng Excel", report.identityLabel || "Mã đối soát", "Tên khách hàng", "Địa chỉ", "Dịch vụ", "Thời gian", "Kết quả / Lead"].map(label =>
                <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>{visible.slice((page - 1) * pageSize, page * pageSize).map(row =>
              <tr key={`${row.sourceRows?.join("-") || row.leadId || "lead"}:${row.code}`} className="border-t border-outline-variant">
                <td className="px-3 py-2 align-top tabular-nums">
                  <p>{row.sourceSerial || "—"}</p>
                  <p className="text-pretty text-xs text-on-surface-variant">{row.sourceRows?.length ? `Dòng ${row.sourceRows.join(", ")}` : "Ngoài Excel"}</p>
                </td>
                <td className="wrap-anywhere px-3 py-2 align-top font-medium tabular-nums">{row.excelCode || row.code}</td>
                <td className="wrap-anywhere px-3 py-2 align-top">{customerValue(row.excel || row.lead, "customerName")}</td>
                <td className="wrap-anywhere px-3 py-2 align-top">{customerValue(row.excel || row.lead, "address")}</td>
                <td className="px-3 py-2 align-top">{customerValue(row.excel || row.lead, "services")}</td>
                <td className="px-3 py-2 align-top">
                  <p className="text-pretty">{customerValue(row.excel || row.lead, "periods")}</p>
                  {(row.excel || row.lead)?.activatedAt && <p className="mt-1 text-pretty text-xs text-on-surface-variant">Hòa mạng: {customerValue(row.excel || row.lead, "activatedAt")}</p>}
                </td>
                <td className="px-3 py-2 align-top">
                  <p className="text-pretty">{statuses[row.status]}</p>
                  {row.leadCreatedAt && <p className="mt-1 text-pretty text-xs text-on-surface-variant">Tạo Lead: {new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(row.leadCreatedAt))}</p>}
                  {row.issue && <p className="mt-1 text-pretty text-xs text-on-surface-variant">{row.issue}</p>}
                  {row.differences?.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-xs">{row.differences.map(item => <li key={item.field}>
                    {item.label}: {item.reason === "different" ? `Excel “${item.excel}” · Lead “${item.lead}”` : item.reason === "missing_both" ? "cả Excel và Lead đều thiếu dữ liệu" : item.reason === "missing_lead" ? "Lead chưa có dữ liệu" : "Excel chưa có dữ liệu"}.
                  </li>)}</ul> : null}
                  {row.leadId ? <button type="button" className={linkClass} disabled={Boolean(opening)}
                    onClick={() => void openLead(row.leadId!)}>{opening === row.leadId ? "Đang mở…" : row.customerName || "Mở Lead"}</button> : "—"}
                  {(row.excel || row.lead) && <details className="mt-2">
                    <summary className="cursor-pointer rounded text-primary focus-visible:outline-1 focus-visible:outline-primary">So sánh {row.sourceRows?.length ? `dòng ${row.sourceRows.join(", ")}` : "hồ sơ"} · {row.code}</summary>
                    <CustomerComparison excel={row.excel} lead={row.lead} />
                    {row.sourceRows?.length ? <p className="mt-2 text-pretty text-xs tabular-nums">Dòng Excel: {row.sourceRows.join(", ")}</p> : null}
                  </details>}
                </td>
              </tr>)}</tbody>
          </table>
        </div>
        <TablePagination appearance="erp" currentPage={page} totalPages={Math.ceil(visible.length / pageSize)}
          pageSize={pageSize} totalItems={visible.length} itemLabel="dòng" onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div> : <p className="text-pretty text-sm text-on-surface-variant">Chưa có dòng nào ở trạng thái này.</p>}
    </section>}
  </div>;
}

function customerValue(info: TelecomCustomerInfo | undefined, key: keyof TelecomCustomerInfo) {
    const raw = info?.[key];
    if (!raw) return "Chưa có";
    if (Array.isArray(raw)) return raw.length ? raw.join("; ") : "Chưa có";
    if (key === "activatedAt") return raw.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1").replace(/^(\d{4})-(\d{2})$/, "$2/$1");
    return raw;
}

function CustomerComparison({ excel, lead }: { excel?: TelecomCustomerInfo; lead?: TelecomCustomerInfo }) {
  const fields = [["customerName", "Tên khách hàng"], ["address", "Địa chỉ"], ["services", "Dịch vụ"], ["activatedAt", "Mốc hòa mạng / kích hoạt"], ["periods", "Kỳ đối soát"]] as const;
  return <table className="mt-2 w-full text-left text-xs">
    <thead><tr>{["Thông tin", "Excel", "Lead"].map(label => <th key={label} scope="col" className="border-b border-outline-variant px-2 py-1 font-medium">{label}</th>)}</tr></thead>
    <tbody>{fields.map(([key, label]) => <tr key={key} className="border-b border-outline-variant">
      <th scope="row" className="px-2 py-1 align-top font-medium">{label}</th>
      <td className="wrap-anywhere px-2 py-1 align-top">{customerValue(excel, key)}</td>
      <td className="wrap-anywhere px-2 py-1 align-top">{customerValue(lead, key)}</td>
    </tr>)}</tbody>
  </table>;
}
