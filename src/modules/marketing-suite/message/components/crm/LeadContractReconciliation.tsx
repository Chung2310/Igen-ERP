import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { LeadContractPhoto, LeadContractReport, LeadContractStatus, TelecomCustomerInfo } from "../../../../../../shared/marketing-suite/telecom-invoice";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { TablePagination } from "../../../../../components/common/TablePagination";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { crmService, type ExtendedLeadCard } from "../../services/crmService";
import { LeadContractPhotos } from "./LeadContractPhotos";

const fieldClass = "min-h-9 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-primary";
const linkClass = "rounded text-left text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const statuses: Record<LeadContractStatus, string> = {
  matched: "Khớp thông tin",
  different: "Khác thông tin",
  incomplete: "Chưa đủ thông tin để so",
  excel_only: "Chỉ có trong Excel",
  lead_only: "Chỉ có trên ERP",
  needs_review: "Cần kiểm tra mã",
};

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
  const now = new Date();
  const [providers, setProviders] = useState<string[]>();
  const [provider, setProvider] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [quarter, setQuarter] = useState(String(Math.floor(now.getMonth() / 3) + 1));
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
  const request = useRef<AbortController>(null);
  useEffect(() => {
    const controller = new AbortController();
    void crmService.getLeadContractProviders(controller.signal).then(items => {
      if (!controller.signal.aborted) { setProviders([...new Set(["FPT", "VNPT", ...items])]); setProvider("FPT"); }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Không tải được nhà cung cấp.");
    });
    return () => { controller.abort(); request.current?.abort(); };
  }, [attempt]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || working) return;
    const controller = new AbortController();
    request.current = controller;
    setWorking(true);
    setError("");
    setReport(undefined);
    try {
      const result = await crmService.reconcileLeadContracts(file, provider, Number(year), Number(quarter), controller.signal);
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
  const visible = report?.rows.filter(row => filter === "all" || row.status === filter) ?? [];
  if (!providers && !error) return <p role="status" className="text-pretty text-sm text-on-surface-variant">Đang tải nhà cung cấp…</p>;
  if (!providers) return <div className="space-y-2">
    <p role="alert" className="text-pretty text-sm text-error">{error}</p>
    <button type="button" className={linkClass} onClick={() => { setError(""); setAttempt(n => n + 1); }}>Tải lại</button>
  </div>;

  return <div className="space-y-3">
    <form onSubmit={submit} className="space-y-3" aria-busy={working}>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="min-w-0 space-y-1 text-sm">
          <span>Nhà mạng</span>
          <select className={fieldClass} value={provider} disabled={working} onChange={event => { setProvider(event.target.value); setReport(undefined); }}>
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
      <p className="text-pretty text-xs text-on-surface-variant">FPT ghép bằng Số hợp đồng, VNPT bằng Mã khách hàng/Account. So tên, địa chỉ, dịch vụ và mốc hòa mạng; giữ các dịch vụ và kỳ của cùng mã.</p>
      <label className="block space-y-1 text-sm">
        <span>File bảng kê (.xlsx)</span>
        <input type="file" className="block w-full rounded-md border border-outline-variant p-2 text-sm outline-none focus:border-primary"
          required accept=".xlsx" disabled={working} aria-describedby={`${fileHintId}${error ? ` ${errorId}` : ""}`}
          onChange={event => {
            const candidate = event.target.files?.[0];
            setReport(undefined);
            if (candidate && candidate.size > 10 * 1024 * 1024) { setFile(undefined); setError("Chọn một file .xlsx tối đa 10 MB."); return; }
            setFile(candidate); setError("");
          }} />
      </label>
      <p id={fileHintId} className="text-pretty text-xs text-on-surface-variant">Tối đa 10 MB. File có nhiều sheet sẽ chọn Bảng kê của FPT hoặc sheet đúng quý/năm của VNPT.</p>
      <button type="submit" className={primaryCreateButtonClass} disabled={working}>{working ? "Đang đối soát…" : "Đối soát thông tin khách hàng"}</button>
    </form>
    {error && <p id={errorId} role="alert" className="text-pretty text-sm text-error">{error}</p>}
    {report && <section aria-label="Kết quả đối soát" className="space-y-2">
      <p role="status" className="text-pretty text-sm tabular-nums">
        {report.excelCount} mã trong Excel · {report.sourceRowCount ?? report.excelCount} dòng · {report.duplicates} dòng có thông tin lặp
      </p>
      {report.sheetName && <p className="text-pretty text-xs text-on-surface-variant">Bảng: {report.sheetName} · {report.period}. Bao gồm hồ sơ hòa mạng từ các kỳ trước; không dùng ngày gửi ảnh làm kỳ đối soát.</p>}
      {report.invalidRows.length > 0 && <p className="text-pretty text-sm text-error">
        {report.invalidRows.length} dòng thiếu mã hoặc mã sai định dạng (dòng {report.invalidRows.slice(0, 12).join(", ")}{report.invalidRows.length > 12 ? "…" : ""}).
      </p>}
      <label className="block max-w-xs space-y-1 text-sm">
        <span>Lọc kết quả</span>
        <select className={fieldClass} value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(1); }}>
          <option value="all">Tất cả ({report.rows.length})</option>
          {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>
            {label} ({report.rows.filter(row => row.status === value).length})
          </option>)}
        </select>
      </label>
      {visible.length ? <div className="overflow-hidden rounded-md border border-outline-variant">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container">
              <tr>{[report.identityLabel || "Mã đối soát", "Kết quả", "Khách hàng và thông tin đối chiếu"].map(label =>
                <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>{visible.slice((page - 1) * pageSize, page * pageSize).map(row =>
              <tr key={row.code} className="border-t border-outline-variant">
                <td className="wrap-anywhere px-3 py-2 font-medium tabular-nums">{row.code}</td>
                <td className="px-3 py-2">{statuses[row.status]}{row.issue && <p className="mt-1 text-pretty text-xs text-on-surface-variant">{row.issue}</p>}</td>
                <td className="px-3 py-2">
                  {row.excel?.customerName && <p className="text-pretty">Excel: {row.excel.customerName}</p>}
                  {row.leadId ? <button type="button" className={linkClass} disabled={Boolean(opening)}
                    onClick={() => void openLead(row.leadId!)}>{opening === row.leadId ? "Đang mở…" : row.customerName || "Mở Lead"}</button> : "—"}
                  {(row.excel || row.lead) && <details className="mt-2">
                    <summary className="cursor-pointer rounded text-primary focus-visible:outline-1 focus-visible:outline-primary">So sánh thông tin mã {row.code}</summary>
                    <CustomerComparison excel={row.excel} lead={row.lead} />
                    {row.differences?.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-xs">{row.differences.map(item => <li key={item.field}>{item.label}: {item.reason === "different" ? "khác nhau" : item.reason === "missing_lead" ? "Lead chưa có dữ liệu" : "Excel chưa có dữ liệu"}.</li>)}</ul> : null}
                    {row.sourceRows?.length ? <p className="mt-2 text-pretty text-xs tabular-nums">Dòng Excel: {row.sourceRows.join(", ")}</p> : null}
                  </details>}
                </td>
              </tr>)}</tbody>
          </table>
        </div>
        <TablePagination appearance="erp" currentPage={page} totalPages={Math.ceil(visible.length / pageSize)}
          pageSize={pageSize} totalItems={visible.length} itemLabel="mã" onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div> : <p className="text-pretty text-sm text-on-surface-variant">Chưa có mã nào ở trạng thái này.</p>}
    </section>}
  </div>;
}

function CustomerComparison({ excel, lead }: { excel?: TelecomCustomerInfo; lead?: TelecomCustomerInfo }) {
  const fields = [["customerName", "Tên khách hàng"], ["address", "Địa chỉ"], ["services", "Dịch vụ"], ["activatedAt", "Mốc hòa mạng / kích hoạt"], ["periods", "Kỳ đối soát"]] as const;
  const value = (info: TelecomCustomerInfo | undefined, key: keyof TelecomCustomerInfo) => {
    const raw = info?.[key];
    if (!raw) return "Chưa có";
    if (Array.isArray(raw)) return raw.length ? raw.join("; ") : "Chưa có";
    if (key === "activatedAt") return raw.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1").replace(/^(\d{4})-(\d{2})$/, "$2/$1");
    return raw;
  };
  return <table className="mt-2 w-full text-left text-xs">
    <thead><tr>{["Thông tin", "Excel", "Lead"].map(label => <th key={label} scope="col" className="border-b border-outline-variant px-2 py-1 font-medium">{label}</th>)}</tr></thead>
    <tbody>{fields.map(([key, label]) => <tr key={key} className="border-b border-outline-variant">
      <th scope="row" className="px-2 py-1 align-top font-medium">{label}</th>
      <td className="wrap-anywhere px-2 py-1 align-top">{value(excel, key)}</td>
      <td className="wrap-anywhere px-2 py-1 align-top">{value(lead, key)}</td>
    </tr>)}</tbody>
  </table>;
}
