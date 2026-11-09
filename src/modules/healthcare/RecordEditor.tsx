import { useId, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { ErpModal } from "../../components/common/ErpModal";
import type { Appointment, CareTask, CatalogItem, CatalogKind, HealthcareList, HealthcareStaff, Patient, PatientReference, Visit } from "../../../shared/healthcare";
import type { HealthcareApi } from "./api";
import { appointmentLabels, buttonClass, careLabels, catalogLabels, controlClass, dateTimeControl, Feedback, Field, formError, primaryClass, useHealthcareQuery, visitLabels, type FormError } from "./ui";

export type Editor =
  | { kind: "patients"; record?: Patient }
  | { kind: "visits"; record?: Visit; patient?: PatientReference }
  | { kind: "appointments"; record?: Appointment; patient?: PatientReference; visit?: Visit }
  | { kind: "care"; record?: CareTask; patient?: PatientReference; appointment?: Appointment }
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

function PatientPicker({ api, selected, error }: { api: HealthcareApi; selected?: PatientReference; error?: FormError }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const patients = useHealthcareQuery<HealthcareList<PatientReference>>(api, "/patients/search", JSON.stringify({ q: query, pageSize: 25 }));
  const items = patients.data?.items || [];
  const entries = selected && !items.some(item => item._id === selected._id) ? [selected, ...items] : items;
  return <div className="space-y-2 sm:col-span-2">
    <label htmlFor={searchId} className="block text-sm font-medium">Tìm bệnh nhân theo tên hoặc mã</label>
    <div className="flex gap-2">
      <input id={searchId} className={controlClass} value={search} onChange={event => setSearch(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); setQuery(search.trim()); } }} />
      <button type="button" className={buttonClass} onClick={() => setQuery(search.trim())}>Tìm</button>
    </div>
    <Feedback loading={patients.loading} error={patients.error} onRetry={patients.refresh} />
    <Field name="patientId" label="Bệnh nhân" required value={selected?._id} error={error}
      options={[emptyChoice("Chọn bệnh nhân"), ...entries.map(item => ({ value: item._id, label: `${item.code} · ${item.name}` }))]} />
    {Boolean(patients.data?.total && patients.data.total > entries.length) && <p className="text-xs text-on-surface-variant">Thu hẹp từ khóa để tìm thêm hồ sơ.</p>}
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
    if (kind === "catalog") body.active = data.has("active");
    if (kind === "appointments") {
      body.startsAt = `${body.startsAt}+07:00`;
      body.endsAt = `${body.endsAt}+07:00`;
    }
    if (body.status === "cancelled" && record && "status" in record && record.status !== "cancelled") {
      setPending(body);
      return;
    }
    void save(body);
  }

  const catalogOptions = (type: CatalogKind, selected?: string) => [
    emptyChoice("Chưa chọn"),
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
          <Field name="code" label="Mã bệnh nhân" value={editor.record?.code} error={error} readOnly={Boolean(editor.record)} required maxLength={50} />
          <Field name="name" label="Họ và tên" value={editor.record?.name} error={error} required maxLength={180} />
          <Field name="phone" label="Số điện thoại" type="tel" value={editor.record?.phone} error={error} maxLength={40} />
          <Field name="dateOfBirth" label="Ngày sinh" type="date" value={editor.record?.dateOfBirth} error={error} />
          <Field name="address" label="Địa chỉ" value={editor.record?.address} error={error} maxLength={350} />
          <Field name="note" label="Ghi chú hành chính" value={editor.record?.note} error={error} maxLength={1000} />
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
          <Field name="doctorId" label="Bác sĩ" value={editor.record?.doctorId} options={catalogOptions("doctor", editor.record?.doctorId)} error={error} />
          <Field name="roomId" label="Phòng khám" value={editor.record?.roomId} options={catalogOptions("room", editor.record?.roomId)} error={error} />
          <Field name="serviceId" label="Dịch vụ" value={editor.record?.serviceId} options={catalogOptions("service", editor.record?.serviceId)} error={error} />
          <Field name="paymentNote" label="Ghi nhận thanh toán tham khảo" value={editor.record?.paymentNote} error={error} maxLength={160} />
          <Field name="note" label="Ghi chú hành chính" value={editor.record?.note} error={error} maxLength={1000} />
        </>}
        {kind === "appointments" && <>
          <input type="hidden" name="visitId" value={editor.record?.visitId || editor.visit?._id || ""} />
          <Field name="startsAt" label="Bắt đầu (giờ Việt Nam)" type="datetime-local" step={900} value={dateTimeControl(editor.record?.startsAt)} error={error} required />
          <Field name="endsAt" label="Kết thúc (giờ Việt Nam)" type="datetime-local" step={900} value={dateTimeControl(editor.record?.endsAt)} error={error} required />
          <Field name="doctorId" label="Bác sĩ" value={editor.record?.doctorId ?? editor.visit?.doctorId} options={catalogOptions("doctor", editor.record?.doctorId)} error={error} />
          <Field name="roomId" label="Phòng khám" value={editor.record?.roomId ?? editor.visit?.roomId} options={catalogOptions("room", editor.record?.roomId)} error={error} />
          <Field name="note" label="Ghi chú lịch hẹn" value={editor.record?.note} error={error} maxLength={1000} />
        </>}
        {kind === "care" && <>
          <input type="hidden" name="appointmentId" value={editor.record?.appointmentId || editor.appointment?._id || ""} />
          <Field name="title" label="Việc cần thực hiện" value={editor.record?.title || (editor.appointment ? "Liên hệ về lịch hẹn" : "")} error={error} required maxLength={200} />
          <Field name="dueOn" label="Hạn xử lý" type="date" value={editor.record?.dueOn} error={error} required />
          <Field name="assigneeId" label="Nhân viên phụ trách" required value={editor.record?.assigneeId} error={error} options={[
            emptyChoice("Chọn nhân viên"),
            ...(editor.record?.assigneeId && !staff.some(item => item._id === editor.record?.assigneeId)
              ? [{ value: editor.record.assigneeId, label: "Người phụ trách hiện tại (ngừng hoạt động)" }] : []),
            ...staff.map(item => ({ value: item._id, label: item.name })),
          ]} />
          <Field name="result" label="Kết quả chăm sóc" required={careStatus === "completed"} value={editor.record?.result} error={error} maxLength={1000} />
        </>}
        {kind === "catalog" && <>
          {editor.record ? <div><p className="text-sm font-medium">Loại danh mục</p><p className="text-sm">{catalogLabels[editor.record.kind]}</p>
            <input type="hidden" name="kind" value={editor.record.kind} /></div>
            : <Field name="kind" label="Loại danh mục" options={choices(catalogLabels)} error={error} required />}
          <Field name="code" label="Mã danh mục" value={editor.record?.code} error={error} required maxLength={50} />
          <Field name="name" label="Tên hiển thị" value={editor.record?.name} error={error} required maxLength={180} />
          <label className="flex items-center gap-2 self-end py-2 text-sm"><input type="checkbox" name="active" defaultChecked={editor.record?.active ?? true} /> Đang sử dụng</label>
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
