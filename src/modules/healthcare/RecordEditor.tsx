import { useEffect, useId, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpModal } from "../../components/common/ErpModal";
import type { Appointment, CareTask, CatalogItem, CatalogKind, HealthcareList, HealthcareStaff, Patient, PatientReference, Visit } from "../../../shared/healthcare";
import type { HealthcareApi } from "./api";
import { appointmentLabels, buttonClass, careLabels, catalogLabels, controlClass, dateTimeControl, dayLabel, Feedback, Field, formError, primaryClass, useHealthcareQuery, visitLabels, type FormError } from "./ui";

export type Editor =
  | { kind: "patients"; record?: Patient }
  | { kind: "visits"; record?: Visit; patient?: PatientReference }
  | { kind: "appointments"; record?: Appointment; patient?: PatientReference; visit?: Visit }
  | { kind: "care"; record?: CareTask; patient?: PatientReference; appointment?: Appointment; visit?: Visit }
  | { kind: "catalog"; record?: CatalogItem };

const nouns = { patients: "bệnh nhân", visits: "lượt khám", appointments: "lịch hẹn", care: "việc chăm sóc", catalog: "danh mục" };
const statuses: Record<"visits" | "appointments" | "care", Record<string, string[] | undefined>> = {
  visits: { registered: ["in_progress", "completed", "cancelled"], in_progress: ["completed", "cancelled"] },
  appointments: { scheduled: ["confirmed", "arrived", "cancelled", "no_show"], confirmed: ["arrived", "cancelled", "no_show"], arrived: ["completed"] },
  care: { open: ["in_progress", "completed", "cancelled"], in_progress: ["completed", "cancelled"] },
};
export function canCancelRecord(kind: keyof typeof statuses, status: string) {
  return statuses[kind][status]?.includes("cancelled") ?? false;
}
const choices = (labels: Record<string, string>, keys: string[] = Object.keys(labels)) => keys.map(value => ({ value, label: labels[value] }));
const emptyChoice = (label: string) => ({ value: "", label });
type PatientOption = PatientReference & { phone?: string };

function PatientPicker({ api, selected, error }: { api: HealthcareApi; selected?: PatientReference; error?: FormError }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<PatientOption | undefined>(selected);
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const listId = useId();
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 1_000);
    return () => clearTimeout(timer);
  }, [search]);
  const patients = useHealthcareQuery<HealthcareList<PatientOption>>(api, query ? "/patients/search" : null,
    JSON.stringify({ q: query, pageSize: 25, mode: "selection" }));
  const items = patients.data?.items || [];
  const patientError = error?.fields.includes("patientId") ? error.message : "";
  return <div className="space-y-2 sm:col-span-2">
    <label htmlFor={searchId} className="block text-sm font-medium">Bệnh nhân <span aria-hidden="true">*</span></label>
    {chosen ? <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{chosen.name}</p>
        <p className="mt-0.5 text-xs text-on-surface-variant">{chosen.phone || "Chưa có số điện thoại"}{chosen.code ? ` · ${chosen.code}` : ""}</p>
      </div>
      <button type="button" className={buttonClass} onClick={() => { setChosen(undefined); setSearch(""); setQuery(""); setOpen(true); }}>Đổi</button>
      <input type="hidden" name="patientId" value={chosen._id} />
    </div> : <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
        <input id={searchId} role="combobox" aria-autocomplete="list" aria-expanded={open && Boolean(query)} aria-controls={listId}
          aria-invalid={Boolean(patientError)} aria-describedby={patientError ? `${searchId}-error` : undefined}
          className={`${controlClass} pl-9`} value={search} placeholder="Tìm theo tên hoặc số điện thoại"
          onFocus={() => setOpen(true)} onChange={event => { setChosen(undefined); setSearch(event.target.value); setQuery(""); setOpen(true); }}
          onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} autoComplete="off" />
      </div>
      <input type="hidden" name="patientId" value="" />
      {open && Boolean(query) && <div id={listId} role="listbox" aria-label="Kết quả tìm bệnh nhân"
        className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg">
        {patients.loading ? <p role="status" className="p-3 text-sm text-on-surface-variant">Đang tìm bệnh nhân…</p>
          : items.length ? items.map(item => <button key={item._id} type="button" role="option" aria-selected="false"
            className="block w-full border-b border-outline-variant px-3 py-2.5 text-left last:border-0 hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-none"
            onClick={() => { setChosen(item); setSearch(""); setQuery(""); setOpen(false); }}>
            <span className="block truncate text-sm font-medium">{item.name}</span>
            <span className="mt-0.5 block text-xs text-on-surface-variant">{item.phone || "Chưa có số điện thoại"}</span>
          </button>)
            : <p role="status" className="p-3 text-sm text-on-surface-variant">Không tìm thấy bệnh nhân theo tên hoặc số điện thoại.</p>}
      </div>}
      {patientError && <p id={`${searchId}-error`} className="text-xs text-error">{patientError}</p>}
      <Feedback error={patients.error} onRetry={patients.refresh} />
    </div>}
  </div>;
}

export default function RecordEditor({ editor, api, catalog, staff, directory, onClose, onSaved }: {
  editor: Editor; api: HealthcareApi; catalog: CatalogItem[]; staff: HealthcareStaff[]; onClose: () => void; onSaved: () => void;
  directory?: { loading: boolean; error?: string; refresh: () => void };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError>();
  const [pending, setPending] = useState<Record<string, unknown>>();
  const [careStatus, setCareStatus] = useState(editor.kind === "care" ? editor.record?.status || "open" : "");
  const { kind, record } = editor;
  const title = `${record ? "Chỉnh sửa" : "Thêm"} ${nouns[kind]}`;

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await api.json(`/${kind}${record ? `/${record._id}` : ""}`, {
        method: record ? "PATCH" : "POST",
        body: JSON.stringify({ ...body, ...(record ? { revision: record.revision } : {}) }),
      });
      onSaved();
    } catch (cause) {
      setError(formError(cause));
    } finally {
      setBusy(false);
      setPending(undefined);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(data);
    if ((kind === "visits" || kind === "appointments" || kind === "care") && !body.patientId) {
      setError({ message: "Chọn bệnh nhân theo tên hoặc số điện thoại.", fields: ["patientId"] });
      return;
    }
    const requiredDateFields = kind === "visits" ? ["visitedOn"] : kind === "appointments" ? ["scheduledOn"] : kind === "care" ? ["dueOn"] : [];
    const requiredOptionFields = kind === "catalog" && !record ? ["kind"] : [];
    const missingFields = [...requiredDateFields, ...requiredOptionFields].filter(name => !body[name]);
    if (missingFields.length) {
      setError({ message: "Điền đầy đủ các trường bắt buộc.", fields: missingFields });
      return;
    }
    if (kind === "catalog") body.active = data.has("active");
    if ((kind === "visits" || kind === "appointments") && body.doctorId) body.doctorName = "";
    if (kind === "appointments") {
      if (Boolean(body.startsAt) !== Boolean(body.endsAt)) {
        setError({ message: "Điền cả giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai.", fields: ["startsAt", "endsAt"] });
        return;
      }
      if (body.startsAt && body.endsAt) {
        body.startsAt = `${body.scheduledOn}T${body.startsAt}:00+07:00`;
        body.endsAt = `${body.scheduledOn}T${body.endsAt}:00+07:00`;
      } else {
        body.startsAt = "";
        body.endsAt = "";
      }
    }
    if (kind === "care" && body.status === "completed" && !String(body.result || "").trim() && !String(body.details || "").trim()) {
      setError({ message: "Ghi kết quả hoặc nội dung chăm sóc trước khi hoàn tất.", fields: ["result"] });
      return;
    }
    if (body.status === "cancelled" && record && "status" in record && record.status !== "cancelled") {
      setPending(body);
      return;
    }
    void save(body);
  }

  const catalogOptions = (type: CatalogKind, selected?: string) => [
    emptyChoice(`Chọn ${catalogLabels[type].toLocaleLowerCase("vi")}`),
    ...catalog.filter(item => item.kind === type && (item.active || item._id === selected))
      .map(item => ({ value: item._id, label: item.active ? item.name : `${item.name} (ngừng sử dụng)` })),
  ];
  const recordStatus = kind === "visits" || kind === "appointments" || kind === "care"
    ? editor.record?.status || (kind === "visits" ? "registered" : kind === "appointments" ? "scheduled" : "open")
    : "";
  const statusOptions = kind === "visits" || kind === "appointments" || kind === "care"
    ? choices(kind === "visits" ? visitLabels : kind === "appointments" ? appointmentLabels : careLabels,
        [recordStatus, ...(record ? statuses[kind][recordStatus] || [] : [])])
    : [];
  const linkedPatient = "patient" in editor ? editor.patient : undefined;
  const patientId = record && "patientId" in record ? record.patientId : linkedPatient?._id;

  return <ErpModal native title={title} onClose={onClose} closeDisabled={busy || Boolean(pending)} maxWidth="max-w-2xl">
    {directory?.loading || directory?.error ? <>
      <Feedback loading={directory.loading} error={directory.error} onRetry={directory.refresh} />
      <button type="button" className={buttonClass} onClick={onClose}>Đóng biểu mẫu</button>
    </> : <form onSubmit={submit} aria-busy={busy} className="space-y-4">
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {kind === "patients" && <>
          {editor.record ? <Field name="code" label="Mã bệnh nhân" value={editor.record.code} readOnly required maxLength={50} />
            : <Field name="code" label="Mã bệnh nhân" disabled placeholder="Tự tạo khi lưu hồ sơ" />}
          <Field name="name" label="Họ và tên" value={editor.record?.name} error={error} required maxLength={180} placeholder="Nhập họ và tên bệnh nhân" />
          <Field name="phone" label="Số điện thoại" type="tel" value={editor.record?.phone} error={error} maxLength={40} placeholder="Ví dụ: 0901234567" />
          <Field name="dateOfBirth" label="Ngày sinh" type="date" value={editor.record?.dateOfBirth} error={error} />
          <Field name="address" label="Địa chỉ" value={editor.record?.address} error={error} maxLength={350} placeholder="Nhập địa chỉ bệnh nhân" />
          <Field name="note" label="Ghi chú hành chính" value={editor.record?.note} error={error} maxLength={1000} placeholder="Nhập ghi chú (nếu có)" />
        </>}
        {(kind === "visits" || kind === "appointments" || kind === "care") && <>
          {patientId ? <div className="sm:col-span-2">
            <p className="text-sm font-medium">Bệnh nhân</p>
            <p className="text-sm text-on-surface-variant">{linkedPatient ? `${linkedPatient.code} · ${linkedPatient.name}` : "Hồ sơ đã gắn với bản ghi"}</p>
            <input type="hidden" name="patientId" value={patientId} />
          </div> : <PatientPicker api={api} error={error} />}
          <Field name="status" label="Trạng thái" value={recordStatus} options={statusOptions} error={error}
            onSelectChange={value => { if (kind === "care") setCareStatus(value as CareTask["status"]); }} />
        </>}
        {kind === "visits" && <>
          <Field name="code" label="Mã lượt khám" value={editor.record?.code} error={error} readOnly={Boolean(editor.record)} required maxLength={50} />
          <Field name="visitedOn" label="Ngày khám" type="date" value={editor.record?.visitedOn} error={error} required />
          <Field name="doctorName" label="Tên bác sĩ" value={editor.record?.doctorName || editor.record?.report?.doctor} error={error} maxLength={180} placeholder="Nhập tên bác sĩ bên ngoài ERP" />
          <Field name="doctorId" label="Chọn bác sĩ trong ERP (nếu có)" value={editor.record?.doctorId} options={catalogOptions("doctor", editor.record?.doctorId)} error={error} />
          <Field name="roomId" label="Phòng khám" value={editor.record?.roomId} options={catalogOptions("room", editor.record?.roomId)} error={error} />
          <Field name="serviceId" label="Dịch vụ" value={editor.record?.serviceId} options={catalogOptions("service", editor.record?.serviceId)} error={error} />
          <Field name="paymentNote" label="Ghi nhận thanh toán tham khảo" value={editor.record?.paymentNote} error={error} maxLength={160} placeholder="Ví dụ: Đã thanh toán tiền mặt" />
          <Field name="note" label="Ghi chú hành chính" value={editor.record?.note} error={error} maxLength={1000} placeholder="Nhập ghi chú (nếu có)" />
        </>}
        {kind === "appointments" && <>
          <input type="hidden" name="visitId" value={editor.record?.visitId || editor.visit?._id || ""} />
          {editor.visit?.report?.followUpOn && <p className="text-sm text-on-surface-variant sm:col-span-2">Ngày tái khám trong Excel: {dayLabel(editor.visit.report.followUpOn)}.</p>}
          <Field name="scheduledOn" label="Ngày hẹn" type="date" value={editor.record?.scheduledOn || dateTimeControl(editor.record?.startsAt).slice(0, 10) || editor.visit?.report?.followUpOn} error={error} required />
          <Field name="startsAt" label="Giờ bắt đầu (không bắt buộc)" type="time" step={900} value={dateTimeControl(editor.record?.startsAt).slice(11, 16)} error={error} />
          <Field name="endsAt" label="Giờ kết thúc (không bắt buộc)" type="time" step={900} value={dateTimeControl(editor.record?.endsAt).slice(11, 16)} error={error} />
          <p className="text-xs text-on-surface-variant sm:col-span-2">Có thể lưu ngày tái khám trước rồi bổ sung giờ sau. Khi chưa có giờ, lịch không giữ chỗ bác sĩ hoặc phòng khám.</p>
          <Field name="doctorName" label="Tên bác sĩ" value={editor.record?.doctorName || editor.visit?.doctorName || editor.visit?.report?.doctor} error={error} maxLength={180} placeholder="Nhập tên bác sĩ bên ngoài ERP" />
          <Field name="doctorId" label="Chọn bác sĩ trong ERP (nếu có)" value={editor.record?.doctorId ?? editor.visit?.doctorId} options={catalogOptions("doctor", editor.record?.doctorId)} error={error} />
          <Field name="roomId" label="Phòng khám" value={editor.record?.roomId ?? editor.visit?.roomId} options={catalogOptions("room", editor.record?.roomId)} error={error} />
          <Field name="note" label="Ghi chú lịch hẹn" value={editor.record?.note} error={error} maxLength={1000} placeholder="Ví dụ: Khách cần đổi giờ nếu bận" />
        </>}
        {kind === "care" && <>
          <input type="hidden" name="appointmentId" value={editor.record?.appointmentId || editor.appointment?._id || ""} />
          <input type="hidden" name="visitId" value={editor.record?.visitId || editor.visit?._id || ""} />
          <Field name="title" label="Việc cần thực hiện" value={editor.record?.title || (editor.appointment ? "Liên hệ về lịch hẹn" : editor.visit?.report?.followUpOn ? "Nhắc tái khám" : "")} error={error} required maxLength={200} placeholder="Ví dụ: Gọi xác nhận lịch hẹn" />
          <Field name="dueOn" label="Hạn xử lý" type="date" value={editor.record?.dueOn || editor.visit?.report?.followUpOn} error={error} required />
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="healthcare-care-details" className="block text-sm font-medium">Nội dung chăm sóc</label>
            <textarea id="healthcare-care-details" name="details" maxLength={4000} rows={5} defaultValue={editor.record?.details || ""}
              className={`${controlClass} h-auto min-h-28 resize-y py-3`} placeholder="Ghi nhận triệu chứng, chẩn đoán, phương pháp điều trị, kê đơn…" />
          </div>
          <Field name="assigneeId" label="Nhân viên phụ trách" value={editor.record?.assigneeId} error={error} options={[
            emptyChoice("Chọn nhân viên phụ trách"),
            ...(editor.record?.assigneeId && !staff.some(item => item._id === editor.record?.assigneeId)
              ? [{ value: editor.record.assigneeId, label: "Người phụ trách hiện tại (ngừng hoạt động)" }] : []),
            ...staff.map(item => ({ value: item._id, label: item.name })),
          ]} />
          <Field name="result" label="Kết quả chăm sóc" value={editor.record?.result} error={error} maxLength={1000} placeholder="Ghi lại kết quả xử lý" />
        </>}
        {kind === "catalog" && <>
          {editor.record ? <div>
            <Field name="kindLabel" label="Loại danh mục" value={catalogLabels[editor.record.kind]} disabled />
            <input type="hidden" name="kind" value={editor.record.kind} />
          </div>
            : <Field name="kind" label="Loại danh mục" options={[emptyChoice("Chọn loại danh mục"), ...choices(catalogLabels)]} error={error} required />}
          <Field name="code" label="Mã danh mục" value={editor.record?.code} error={error} required maxLength={50} placeholder="Ví dụ: BS001" />
          <Field name="name" label="Tên hiển thị" value={editor.record?.name} error={error} required maxLength={180} placeholder="Nhập tên hiển thị" />
          <label className="flex items-center gap-2 self-end py-2 text-sm"><input type="checkbox" name="active" defaultChecked={editor.record?.active ?? true} className="size-4 accent-primary" /> Đang sử dụng</label>
        </>}
      </fieldset>
      <Feedback error={error?.message} />
      <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-3">
        <button type="button" disabled={busy} className={buttonClass} onClick={onClose}>Đóng biểu mẫu</button>
        <button type="submit" disabled={busy} className={primaryClass}>{busy ? "Đang lưu…" : "Lưu"}</button>
      </div>
    </form>}
    <ConfirmDialog native appearance="erp" title="Xác nhận hủy bản ghi" description="Sau khi hủy, bản ghi sẽ được giữ trong lịch sử với trạng thái Đã hủy."
      isOpen={Boolean(pending)} isSubmitting={busy} onClose={() => setPending(undefined)}
      confirmLabel="Xác nhận hủy" onConfirm={() => pending ? save(pending) : undefined} />
  </ErpModal>;
}
