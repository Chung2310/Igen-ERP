import { useEffect, useId, useState, type FormEvent } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { maxHospitalReportRows, type ImportJob, type ImportKind } from "../../../shared/healthcare";
import type { HealthcareApi } from "./api";
import ImportJobDetails, { importNames, importPending, ImportStatus } from "./ImportJobDetails";
import { buttonClass, Cell, controlClass, Feedback, messageOf, primaryClass, RowLink, Table, timeLabel, useHealthcareQuery } from "./ui";

export default function ImportPanel({ api, canImport, initialKind, onClose, onCommitted, canOpenRecord, onOpenRecord }: {
  api: HealthcareApi; canImport: boolean; initialKind: ImportKind; onClose: () => void; onCommitted: (kind: ImportKind) => void;
  canOpenRecord: (kind: ImportKind) => boolean; onOpenRecord: (kind: ImportKind, id: string) => void;
}) {
  const id = useId();
  const [view, setView] = useState<"upload" | "history">(canImport ? "upload" : "history");
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [file, setFile] = useState<File>();
  const [selected, setSelected] = useState<ImportJob>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"download" | "upload">();
  const [detailBusy, setDetailBusy] = useState(false);
  const history = useHealthcareQuery<ImportJob[]>(api, view === "history" && !selected ? "/imports" : null);
  const pendingHistory = history.data?.some(importPending);
  const { refresh, refreshing } = history;

  useEffect(() => {
    if (!pendingHistory || refreshing) return;
    const timer = setTimeout(refresh, 2_000);
    return () => clearTimeout(timer);
  }, [pendingHistory, refreshing, refresh]);

  async function download() {
    if (kind === "hospital-report") return;
    setBusy("download");
    setError("");
    try {
      const blob = await api.blob("/imports/template/" + kind);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "patients" ? "mau-benh-nhan.xlsx" : "mau-luot-kham.xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(undefined);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    if (!/\.xlsx$/i.test(file.name) || file.size > 4 * 1024 * 1024) {
      setError("Chọn file .xlsx có dung lượng tối đa 4 MB.");
      return;
    }
    setBusy("upload");
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const job = await api.json<ImportJob>("/imports/preview/" + kind, { method: "POST", body });
      setSelected(job);
      setView("history");
      setFile(undefined);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(undefined);
    }
  }

  return <ErpModal native title="Nhập dữ liệu Excel" titleClassName="outline-none" onClose={onClose} closeDisabled={Boolean(busy) || detailBusy} maxWidth="max-w-5xl">
    <ModuleNavigation label="Các mục nhập Excel" activeValue={view} layout="horizontal" className="px-0 sm:px-0">
      <ModuleNavigationButton active={view === "upload"} disabled={Boolean(busy) || detailBusy} onClick={() => { setSelected(undefined); setView("upload"); }}>
        {canImport ? "Nhập file" : "Mẫu Excel"}
      </ModuleNavigationButton>
      <ModuleNavigationButton active={view === "history"} disabled={Boolean(busy) || detailBusy} onClick={() => { setSelected(undefined); setView("history"); }}>
        Lịch sử
      </ModuleNavigationButton>
    </ModuleNavigation>

    {selected ? <ImportJobDetails key={selected._id} api={api} initial={selected} canImport={canImport}
      onBack={() => setSelected(undefined)} onCompleted={onCommitted} canOpenRecord={canOpenRecord}
      onOpenRecord={onOpenRecord} onBusyChange={setDetailBusy} /> : view === "upload" ? (
      <form onSubmit={upload} aria-busy={Boolean(busy)} className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1 text-sm font-medium">
            <span>Loại dữ liệu</span>
            <select className={controlClass} value={kind} disabled={Boolean(busy)} onChange={event => {
              setKind(event.target.value as ImportKind); setFile(undefined); setError("");
            }}>
              {Object.entries(importNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          {kind !== "hospital-report" && <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => void download()}>
            <Download className="size-4" aria-hidden="true" /> {busy === "download" ? "Đang tải mẫu…" : "Tải file mẫu"}
          </button>}
        </div>

        {canImport && <div className="min-w-0 space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <label htmlFor={id + "-input"} className="block text-sm font-semibold">File Excel</label>
              <p id={id + "-hint"} className="mt-1 text-pretty text-xs text-on-surface-variant">
                {kind === "hospital-report"
                  ? "Dùng file báo cáo phiếu khám hiện có. ERP đọc các sheet và ghép bệnh nhân theo mã."
                  : "Dùng đúng mẫu đã chọn. Với lượt khám, mã bệnh nhân cần có sẵn trong ERP."}
                {" "}Tối đa {(kind === "hospital-report" ? maxHospitalReportRows : 1_000).toLocaleString("vi-VN")} dòng và 4 MB.
              </p>
            </div>
          </div>
          <input key={kind} id={id + "-input"} type="file" accept=".xlsx" required aria-describedby={id + "-hint"} disabled={Boolean(busy)}
            className={controlClass + " file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:font-semibold file:text-primary"}
            onChange={event => { setFile(event.target.files?.[0]); setError(""); }} />
        </div>}
        <Feedback error={error} />
        {canImport && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-3">
          <p className="text-pretty text-xs text-on-surface-variant">Bạn sẽ xem từng dòng trước khi xác nhận ghi dữ liệu.</p>
          <button type="submit" disabled={!file || Boolean(busy)} className={primaryClass}>
            <Upload className="size-4" aria-hidden="true" /> {busy === "upload" ? "Đang gửi file…" : "Tải lên và kiểm tra"}
          </button>
        </div>}
      </form>
    ) : (
      <section className="min-w-0 space-y-3" aria-label="Lịch sử nhập Excel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-balance text-sm font-semibold">Các lượt nhập gần đây</h4>
          <ErpRefreshButton loading={history.refreshing} onClick={refresh} />
        </div>
        <Feedback loading={history.loading} error={history.error} onRetry={refresh} />
        {history.data && <Table headers={["File", "Trạng thái", "Kết quả", "Thời điểm", "Thao tác"]}
          empty={history.data.length ? undefined : "Chưa có lượt nhập Excel."}>
          {history.data.map(job => <tr key={job._id}>
            <Cell><span className="block max-w-64 break-words font-medium">{job.filename}</span><span className="text-xs text-on-surface-variant">{importNames[job.kind]}</span></Cell>
            <Cell><ImportStatus job={job} /></Cell>
            <Cell>{job.status === "completed"
              ? <span className="tabular-nums">{job.inserted} đã nhập · {job.skipped} bỏ qua</span>
              : job.total ? <span className="tabular-nums">{job.total} dòng</span> : "—"}</Cell>
            <Cell>{timeLabel(job.completedAt || job.createdAt || "")}</Cell>
            <Cell><RowLink onClick={() => setSelected(job)}>Xem chi tiết</RowLink></Cell>
          </tr>)}
        </Table>}
      </section>
    )}
  </ErpModal>;
}
