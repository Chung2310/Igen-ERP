import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "../../components/common/Dropdown";
import { TableFilterToolbar } from "../../components/common/TableFilterToolbar";
import { TablePagination } from "../../components/common/TablePagination";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import { hospitalReportColumns, type HealthcareList, type HospitalReportFields, type ImportJob, type ImportKind, type ImportRowResult, type ImportRowStatus } from "../../../shared/healthcare";
import type { HealthcareApi } from "./api";
import { Cell, Feedback, messageOf, primaryClass, RowLink, Table, useHealthcareQuery } from "./ui";

export const importNames = { patients: "Hồ sơ bệnh nhân", visits: "Lượt khám", "hospital-report": "Toàn bộ workbook y tế" };
export const importPending = (job: ImportJob) => job.status === "queued" || job.status === "running";
const number = new Intl.NumberFormat("vi-VN");

export function ImportStatus({ job }: { job: ImportJob }) {
  switch (job.status) {
    case "queued": return <HrStatusBadge dot tone="warning">Đang chờ</HrStatusBadge>;
    case "running": return <HrStatusBadge dot tone="info">{job.phase === "check" ? "Đang kiểm tra file" : "Đang nhập dữ liệu"}</HrStatusBadge>;
    case "preview": return <HrStatusBadge dot tone={job.invalid ? "danger" : "info"}>{job.invalid ? "Có dòng lỗi" : "Chờ xác nhận"}</HrStatusBadge>;
    case "completed": return <HrStatusBadge dot tone="success">Hoàn tất</HrStatusBadge>;
    case "failed": return <HrStatusBadge dot tone="danger">Gián đoạn</HrStatusBadge>;
  }
}

const rowStatus = {
  ready: { label: "Sẵn sàng", tone: "info" },
  imported: { label: "Đã nhập", tone: "success" },
  skipped: { label: "Bỏ qua trùng", tone: "warning" },
  invalid: { label: "Có lỗi", tone: "danger" },
} as const;

function ImportRows({ api, job, canOpenRecord, onOpenRecord }: {
  api: HealthcareApi; job: ImportJob; canOpenRecord: (kind: ImportKind) => boolean;
  onOpenRecord: (kind: ImportKind, id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ImportRowStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 1_000);
    return () => clearTimeout(timer);
  }, [search]);
  const reportColumns = Object.keys(hospitalReportColumns) as (keyof HospitalReportFields)[];
  const isFullWorkbook = job.kind === "hospital-report";
  const { data, error, loading, refreshing, refresh } = useHealthcareQuery<HealthcareList<ImportRowResult>>(
    api, `/imports/${job._id}/rows/search`, JSON.stringify({ q, page, pageSize, ...(status ? { status } : {}) }),
    { keepPreviousData: true },
  );
  return <section aria-label="Các dòng trong file Excel" aria-busy={refreshing} className="min-w-0 space-y-3">
    <div>
      <h4 className="text-balance text-sm font-semibold">{isFullWorkbook ? "Xem trước toàn bộ thông tin y tế" : "Chi tiết từng dòng"}</h4>
      {isFullWorkbook && <p className="mt-1 text-xs text-on-surface-variant">Hiển thị đủ {reportColumns.length} cột trong từng sheet. Cuộn ngang để xem các cột phía sau.</p>}
    </div>
    <TableFilterToolbar
      search={{ value: search, onChange: value => { setSearch(value.slice(0, 100)); },
        ariaLabel: "Tìm dòng trong Excel", placeholder: "Tìm mã, tên hoặc sheet", className: "min-w-0" }}
      totalCount={search || status ? data?.total : undefined} countLabel="dòng" hasActiveFilters={Boolean(search || status)}
      onResetFilters={() => { setSearch(""); setQ(""); setStatus(""); setPage(1); }}>
      <Dropdown aria-label="Trạng thái dòng" variant="filter" value={status}
        onChange={value => { setStatus(value as ImportRowStatus | ""); setPage(1); }}
        options={[{ value: "", label: "Tất cả trạng thái" }, ...Object.entries(rowStatus).map(([value, item]) => ({ value, label: item.label }))]} />
    </TableFilterToolbar>
    <Feedback loading={loading} error={error} onRetry={refresh} />
    {data && <>
      {isFullWorkbook ? <Table headers={["Sheet / dòng", ...reportColumns.map(key => hospitalReportColumns[key]), "Kiểm tra"]} empty={!data.items.length ? "Không có dòng phù hợp." : undefined}>
        {data.items.map(({ recordId, ...row }) => <tr key={row.index}>
          <Cell>
            <p className="font-medium">{row.sheet || "—"}</p>
            <p className="text-xs text-on-surface-variant">Dòng {row.row || "—"}</p>
            {recordId && canOpenRecord(job.kind) && <RowLink onClick={() => onOpenRecord(job.kind, recordId)}>Mở phiếu khám</RowLink>}
          </Cell>
          {reportColumns.map(key => <Cell key={key}>{row.preview?.[key] || "—"}</Cell>)}
          <Cell align="center">
            <HrStatusBadge dot tone={rowStatus[row.status].tone}>{rowStatus[row.status].label}</HrStatusBadge>
            {row.message && <p className="mt-1 max-w-64 text-pretty text-xs text-error">{row.message}</p>}
          </Cell>
        </tr>)}
      </Table> : <Table headers={["Dòng Excel", "Kết quả", "Bản ghi"]} empty={!data.items.length ? "Không có dòng phù hợp." : undefined}>
        {data.items.map(({ recordId, ...row }) => <tr key={row.index}>
          <Cell>
            <div className="min-w-0 space-y-1">
              <p className="max-w-64 break-words font-medium">{row.code || "—"}</p>
              <p className="text-xs text-on-surface-variant">{row.sheet ? `${row.sheet} · ` : ""}Dòng {row.row || "—"}</p>
              {row.label && <p className="max-w-72 break-words text-xs text-on-surface-variant">{row.label}</p>}
            </div>
          </Cell>
          <Cell align="center">
            <HrStatusBadge dot tone={rowStatus[row.status].tone}>{rowStatus[row.status].label}</HrStatusBadge>
            {row.message && <p className="mt-1 max-w-64 text-pretty text-xs text-error">{row.message}</p>}
          </Cell>
          <Cell>{recordId && canOpenRecord(job.kind) &&
            <RowLink onClick={() => onOpenRecord(job.kind, recordId)}>{job.kind === "patients" ? "Mở hồ sơ" : "Mở phiếu khám"}</RowLink>}</Cell>
        </tr>)}
      </Table>}
      <TablePagination appearance="erp" className="rounded-lg border shadow-xs sm:sticky sm:bottom-0" currentPage={data.page}
        totalPages={Math.ceil(data.total / data.pageSize)} pageSize={data.pageSize}
        totalItems={data.total} itemLabel="dòng" pageSizeOptions={[10, 25, 50, 100]} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </>}
  </section>;
}

export default function ImportJobDetails({ api, initial, canImport, onBack, onCompleted, canOpenRecord, onOpenRecord, onBusyChange }: {
  api: HealthcareApi; initial: ImportJob; canImport: boolean; onBack: () => void;
  onCompleted: (kind: ImportKind) => void; canOpenRecord: (kind: ImportKind) => boolean;
  onOpenRecord: (kind: ImportKind, id: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  const jobQuery = useHealthcareQuery<ImportJob>(api, `/imports/${initial._id}`);
  const job = jobQuery.data || initial;
  const pending = importPending(job);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notified = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const { refresh, refreshing, error: queryError } = jobQuery;

  useLayoutEffect(() => { title.current?.focus(); }, []);
  useEffect(() => {
    if (!pending || refreshing || queryError) return;
    const timer = setTimeout(refresh, 1_500);
    return () => clearTimeout(timer);
  }, [pending, refreshing, queryError, refresh]);
  useEffect(() => {
    if (job.status !== "completed" || notified.current) return;
    notified.current = true;
    onCompleted(job.kind);
  }, [job.status, job.kind, onCompleted]);

  async function submit(action: "commit" | "retry") {
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await api.json<ImportJob>(`/imports/${job._id}/${action}`, { method: "POST" });
      refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
      setConfirm(false);
      onBusyChange(false);
    }
  }

  const canReview = job.status === "preview" || job.status === "completed" || (job.status === "failed" && job.phase === "write");
  return <div className="min-w-0 space-y-4">
    <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" onClick={onBack} disabled={busy}>
      <ChevronLeft className="size-4" aria-hidden="true" /> Về lịch sử
    </button>
    <section aria-label="Tiến độ nhập Excel" className="min-w-0 space-y-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 ref={title} tabIndex={-1} className="break-words text-balance text-sm font-semibold outline-none">{job.filename}</h4>
          <p className="mt-1 text-xs text-on-surface-variant">{importNames[job.kind]}</p>
        </div>
        <span role="status"><ImportStatus job={job} /></span>
      </div>
      <Feedback error={error || queryError || job.error} onRetry={queryError ? refresh : undefined} />
      {pending && <div className="space-y-2">
        <progress className="block h-2 w-full accent-primary" aria-label={job.phase === "check" ? "Kiểm tra file" : "Tiến độ nhập"}
          max={job.total || 1} value={job.phase === "write" ? job.processed : undefined} />
        <p role="status" className="text-pretty text-sm text-on-surface-variant">
          {job.phase === "write" ? `${number.format(job.processed)} / ${number.format(job.total)} dòng đã xử lý. ` : ""}
          Bạn có thể đóng popup và theo dõi lại trong Lịch sử nhập.
        </p>
      </div>}
      {job.total > 0 && <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Tổng số dòng", job.total],
          [job.status === "completed" ? "Đã nhập" : "Sẵn sàng", job.inserted ?? job.ready],
          ["Bỏ qua trùng", job.skipped ?? job.duplicates],
          [job.patientsInserted !== undefined ? "Hồ sơ mới" : "Có lỗi", job.patientsInserted ?? job.invalid],
        ].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5 sm:p-3">
          <dt className="text-pretty text-xs text-on-surface-variant">{label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{number.format(Number(value))}</dd>
        </div>)}
      </dl>}
      {job.kind === "hospital-report" && job.status === "completed" &&
        <p className="text-pretty text-sm text-on-surface-variant">
          Đã tạo {number.format(job.appointmentsInserted || 0)} lịch tái khám và {number.format(job.careInserted || 0)} hồ sơ chăm sóc từ workbook.
        </p>}
      {job.status === "preview" && job.invalid > 0 && <p role="alert" className="text-pretty text-sm text-error">Lọc các dòng có lỗi, sửa file và tải lên lại để tiếp tục.</p>}
      {job.status === "preview" && !job.invalid && job.patientsReady !== undefined &&
        <p className="text-pretty text-sm text-on-surface-variant">Dự kiến tạo {number.format(job.patientsReady)} hồ sơ bệnh nhân mới.</p>}
      {canImport && job.status === "preview" && !job.invalid && <button type="button" className={primaryClass} disabled={busy || refreshing || Boolean(queryError)}
        onClick={() => { setConfirm(true); onBusyChange(true); }}>Xác nhận nhập</button>}
      {canImport && job.retryable && <button type="button" className={primaryClass} disabled={busy || refreshing}
        onClick={() => void submit("retry")}>Thử lại lượt nhập</button>}
    </section>
    {canReview && <ImportRows key={job.status} api={api} job={job} canOpenRecord={canOpenRecord} onOpenRecord={onOpenRecord} />}
    <ConfirmDialog native appearance="erp" tone="warning" title="Xác nhận nhập Excel" isOpen={confirm} isSubmitting={busy}
      description={`Đưa ${number.format(job.ready)} dòng sẵn sàng vào hàng đợi nhập của chi nhánh hiện tại.`}
      onClose={() => { setConfirm(false); onBusyChange(false); }} onConfirm={() => submit("commit")} confirmLabel="Đưa vào hàng đợi" />
  </div>;
}
