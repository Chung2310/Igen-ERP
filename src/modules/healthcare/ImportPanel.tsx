import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { inspectHospitalWorkbook } from "./excelImport";
import { ErpModal } from "../../components/common/ErpModal";
import { ErpRefreshButton } from "../../components/common/ErpRefreshButton";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { hospitalReportColumns, maxHospitalReportRows, type ImportJob, type ImportKind } from "../../../shared/healthcare";
import type { HealthcareApi } from "./api";
import ImportJobDetails, { importNames, importPending, ImportStatus } from "./ImportJobDetails";
import { buttonClass, Cell, Feedback, messageOf, primaryClass, RowLink, Table, timeLabel, useHealthcareQuery } from "./ui";

export default function ImportPanel({ api, canImport, initialKind, onClose, onCommitted, canOpenRecord, onOpenRecord }: {
  api: HealthcareApi; canImport: boolean; initialKind: ImportKind; onClose: () => void; onCommitted: (kind: ImportKind) => void;
  canOpenRecord: (kind: ImportKind) => boolean; onOpenRecord: (kind: ImportKind, id: string) => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"upload" | "history">(canImport ? "upload" : "history");
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [file, setFile] = useState<File>();
  const [isDragging, setIsDragging] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [reportSheets, setReportSheets] = useState<string[]>([]);
  const [otherDataSheets, setOtherDataSheets] = useState<string[]>([]);
  const [selected, setSelected] = useState<ImportJob>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"download" | "upload">();
  const [detailBusy, setDetailBusy] = useState(false);
  const history = useHealthcareQuery<ImportJob[]>(api, view === "history" && !selected ? "/imports" : null);
  const pendingHistory = history.data?.some(importPending);
  const { refresh, refreshing } = history;

  async function selectFile(nextFile?: File) {
    setIsDragging(false);
    setFile(undefined);
    setReportSheets([]);
    setOtherDataSheets([]);
    setError("");
    if (!nextFile) {
      setKind(initialKind);
      return;
    }
    if (!/\.xlsx$/i.test(nextFile.name)) {
      setError("Chọn file Excel .xlsx.");
      return;
    }
    if (nextFile.size > 4 * 1024 * 1024) {
      setError("File Excel tối đa 4 MB.");
      return;
    }

    setFile(nextFile);
    setIsInspecting(true);
    try {
      const inspection = inspectHospitalWorkbook(await nextFile.arrayBuffer());
      setReportSheets(inspection.reportSheets);
      setOtherDataSheets(inspection.otherDataSheets);
      if (inspection.reportSheets.length > 0) setKind("hospital-report");
      else if (kind === "hospital-report") {
        setError("Không nhận diện được tiêu đề báo cáo nhiều sheet. Cần có các cột Ngày giờ khám, Mã phiếu, Tên bệnh nhân và Mã bệnh nhân.");
      }
    } catch {
      if (kind === "hospital-report") setError("Không đọc được workbook. Vui lòng chọn lại file .xlsx hợp lệ.");
    } finally {
      setIsInspecting(false);
    }
  }

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
    if (!file || busy || isInspecting) return;
    if (reportSheets.length > 0 && otherDataSheets.length > 0) {
      setError(`Các sheet này không có cấu trúc báo cáo phiếu khám: ${otherDataSheets.join(", ")}. Hãy giữ các sheet báo cáo cần nhập trong workbook.`);
      return;
    }
    if (kind === "hospital-report" && reportSheets.length === 0) {
      setError("Không tìm thấy sheet báo cáo phiếu khám hợp lệ trong file.");
      return;
    }
    setBusy("upload");
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const uploadKind = reportSheets.length > 0 ? "hospital-report" : kind;
      const job = await api.json<ImportJob>("/imports/preview/" + uploadKind, { method: "POST", body });
      setSelected(job);
      setView("history");
      setFile(undefined);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(undefined);
    }
  }

  return <ErpModal native title="Nhập dữ liệu Excel" titleClassName="outline-none" onClose={onClose} closeDisabled={Boolean(busy) || isInspecting || detailBusy} maxWidth="max-w-5xl">
    <ModuleNavigation label="Các mục nhập Excel" activeValue={view} layout="horizontal" className="px-0 sm:px-0">
      <ModuleNavigationButton active={view === "upload"} disabled={Boolean(busy) || isInspecting || detailBusy} onClick={() => { setSelected(undefined); setView("upload"); }}>
        {canImport ? "Nhập file" : "Mẫu Excel"}
      </ModuleNavigationButton>
      <ModuleNavigationButton active={view === "history"} disabled={Boolean(busy) || isInspecting || detailBusy} onClick={() => { setSelected(undefined); setView("history"); }}>
        Lịch sử
      </ModuleNavigationButton>
    </ModuleNavigation>

    {selected ? <ImportJobDetails key={selected._id} api={api} initial={selected} canImport={canImport}
      onBack={() => setSelected(undefined)} onCompleted={onCommitted} canOpenRecord={canOpenRecord}
      onOpenRecord={onOpenRecord} onBusyChange={setDetailBusy} /> : view === "upload" ? (
      <form onSubmit={upload} aria-busy={Boolean(busy)} className="min-w-0 space-y-4">
        <fieldset disabled={Boolean(busy) || isInspecting} className="min-w-0 space-y-2 disabled:opacity-80">
          <legend className="text-sm font-medium">Chọn cách nhập dữ liệu y tế</legend>
          <div className="grid gap-2 md:grid-cols-3" role="group" aria-label="Cách nhập dữ liệu y tế">
            {([
              { value: "patients", title: "Hồ sơ bệnh nhân", description: "Một sheet theo mẫu hồ sơ của ERP." },
              { value: "visits", title: "Lượt khám", description: "Một sheet lượt khám, liên kết mã bệnh nhân đã có." },
              { value: "hospital-report", title: "Toàn bộ workbook y tế", description: `Đọc mọi sheet tháng và giữ đủ ${Object.keys(hospitalReportColumns).length} cột thông tin.` },
            ] as const).map(option => <button key={option.value} type="button" aria-pressed={kind === option.value}
              onClick={() => { setKind(option.value); setFile(undefined); setReportSheets([]); setOtherDataSheets([]); setError(""); if (fileInput.current) fileInput.current.value = ""; }}
              className={`min-w-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${kind === option.value ? "border-primary bg-primary-container/30 ring-1 ring-primary" : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"}`}>
              <span className="block text-sm font-semibold text-on-surface">{option.title}</span>
              <span className="mt-1 block text-pretty text-xs text-on-surface-variant">{option.description}</span>
            </button>)}
          </div>
        </fieldset>
        <div className="flex justify-end">
          {kind !== "hospital-report" && <button type="button" className={buttonClass} disabled={Boolean(busy) || isInspecting} onClick={() => void download()}>
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
                  ? `Chọn workbook báo cáo hiện có. ERP đọc toàn bộ sheet, liên kết hồ sơ bệnh nhân, lưu đủ ${Object.keys(hospitalReportColumns).length} cột vào phiếu khám, tạo lịch tái khám theo ngày (chưa có giờ) và hồ sơ chăm sóc từ nội dung điều trị (chưa phân công nhân viên).`
                  : "Dùng đúng mẫu đã chọn. Với lượt khám, mã bệnh nhân cần có sẵn trong ERP."}
                {" "}Tối đa {(kind === "hospital-report" ? maxHospitalReportRows : 1_000).toLocaleString("vi-VN")} dòng và 4 MB.
              </p>
            </div>
          </div>
          <input ref={fileInput} key={kind} id={id + "-input"} type="file" accept=".xlsx" aria-describedby={id + "-hint"} disabled={Boolean(busy) || isInspecting}
            className="sr-only" onChange={event => { void selectFile(event.target.files?.[0]); }} />
          {file ? <div className="flex min-w-0 items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-semibold text-on-surface">{file.name}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            <button type="button" aria-label="Bỏ file đã chọn" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container" disabled={Boolean(busy) || isInspecting}
              onClick={() => { void selectFile(undefined); if (fileInput.current) fileInput.current.value = ""; }}>
              <X className="size-4" aria-hidden="true" />
            </button>
          </div> : <button type="button" disabled={Boolean(busy) || isInspecting}
            onClick={() => fileInput.current?.click()}
            onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={event => { event.preventDefault(); setIsDragging(false); void selectFile(event.dataTransfer.files[0]); }}
            className={`flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait ${isDragging ? "border-primary bg-primary-container/30" : "border-outline-variant bg-surface-container-lowest hover:border-primary/60 hover:bg-surface-container-low"}`}>
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-container text-primary">
              {isInspecting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Upload className="size-5" aria-hidden="true" />}
            </span>
            <span className="mt-3 text-sm font-semibold">{isInspecting ? "Đang đọc cấu trúc workbook…" : "Kéo thả file Excel vào đây"}</span>
            <span className="mt-1 text-xs text-on-surface-variant">hoặc chọn file .xlsx từ máy tính · tối đa 4 MB</span>
          </button>}
          {reportSheets.length > 0 && otherDataSheets.length === 0 && <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-pretty"><strong>Đã nhận diện workbook y tế.</strong> Sẽ nhập đủ {reportSheets.length} sheet, giữ nguyên {Object.keys(hospitalReportColumns).length} cột dữ liệu: {reportSheets.join(", ")}.</p>
          </div>}
          {reportSheets.length > 0 && otherDataSheets.length > 0 && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/30 p-3 text-sm text-error">
            Workbook có sheet không theo cấu trúc báo cáo: {otherDataSheets.join(", ")}.
          </p>}
        </div>}
        <Feedback error={error} />
        {canImport && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-3">
          <p className="text-pretty text-xs text-on-surface-variant">File sẽ vào hàng đợi. Bạn xem từng dòng và xác nhận trước khi ghi dữ liệu.</p>
          <button type="submit" disabled={!file || Boolean(busy) || isInspecting || (reportSheets.length > 0 && otherDataSheets.length > 0)} className={primaryClass}>
            {busy === "upload" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />} {busy === "upload" ? "Đang gửi file…" : "Tải lên và kiểm tra"}
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
            <Cell align="center">{timeLabel(job.completedAt || job.createdAt || "")}</Cell>
            <Cell align="right"><RowLink onClick={() => setSelected(job)}>Xem chi tiết</RowLink></Cell>
          </tr>)}
        </Table>}
      </section>
    )}
  </ErpModal>;
}
