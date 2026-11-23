import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Dropdown } from "./GymDropdown";
import { HrStatusBadge } from "../../components/hr/HrStatusBadge";
import type { GymList, GymRecord } from "../../../shared/gym/types";
import type { GymApi } from "./api";
import { dateLabel, Feedback, Field, FormDialog, GymEmptyState, messageOf, primary, secondary, useGymQuery } from "./ui";

const statuses: [string, string][] = [["ACTIVE", "Đang hoạt động"], ["EXPIRED", "Hết hạn"], ["COMPLETED", "Hoàn thành"], ["CANCELLED", "Đã hủy"]];
const today = () => new Date().toISOString().slice(0, 10);
const dateInput = (value?: string) => value ? new Date(value).toISOString().slice(0, 10) : "";
const addDays = (start: string, days: number) => {
  if (!start || !Number.isFinite(days) || days <= 0) return "";
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const estimatedDays = (sessions: number) => Math.max(30, Math.ceil(sessions / 12) * 30);

function PackageEditor({ api, customerId, record, onClose, onSaved }: { api: GymApi; customerId: string; record?: GymRecord; onClose: () => void; onSaved: () => void }) {
  const initial = { name: record?.name || "", totalSessions: record?.totalSessions || "", startDate: dateInput(record?.startDate) || today(), endDate: dateInput(record?.endDate), status: record?.status || "ACTIVE" };
  const [form, setForm] = useState(initial);
  const templates = useGymQuery<GymList>(api, "/package-templates?status=ACTIVE&limit=50");
  const change = (key: keyof typeof form, value: string | number) => setForm(current => {
    const next = { ...current, [key]: value };
    if (key === "totalSessions" || key === "startDate") next.endDate = addDays(next.startDate, estimatedDays(Number(next.totalSessions)));
    return next;
  });
  return <FormDialog title={record ? "Sửa gói PT" : "Thêm gói PT"} submitLabel={record ? "Lưu thay đổi" : "Thêm gói PT"} dirty={JSON.stringify(form) !== JSON.stringify(initial)} onClose={onClose} onSubmit={async () => {
    if (!form.name.trim() || !Number(form.totalSessions) || !form.startDate || !form.endDate) throw new Error("Vui lòng nhập đủ thông tin gói PT.");
    await api.save("packages", { ...form, name: form.name.trim(), totalSessions: Number(form.totalSessions), customerId }, record);
    onSaved();
  }}>
    {!record && Boolean(templates.data?.data.length) && <section className="rounded-md border border-primary/25 bg-primary/5 p-3">
      <h3 className="mb-2 text-sm font-semibold text-primary">Chọn nhanh từ gói mẫu phòng gym</h3>
      <div className="flex flex-wrap gap-2">{templates.data?.data.map(template => <button key={template._id} type="button" aria-pressed={form.name === template.name} className={form.name === template.name ? primary : secondary} onClick={() => setForm(current => ({ ...current, name: template.name, totalSessions: template.totalSessions, endDate: addDays(current.startDate, Number(template.durationDays || 30)), status: "ACTIVE" }))}>{template.name} ({template.totalSessions} buổi · {template.durationDays} ngày)</button>)}</div>
    </section>}
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label="Tên gói" required value={form.name} onChange={value => change("name", value)} placeholder="Ví dụ: Gói 24 buổi Tăng cơ" /></div>
      <Field label="Tổng số buổi" required type="number" min={1} value={form.totalSessions} onChange={value => change("totalSessions", value)} />
      <Field label="Ngày bắt đầu" required type="date" value={form.startDate} onChange={value => change("startDate", value)} />
      <Field label="Ngày kết thúc" required type="date" value={form.endDate} onChange={value => change("endDate", value)} />
      <Field label="Trạng thái" value={form.status} options={statuses} onChange={value => change("status", value)} />
    </div>
  </FormDialog>;
}

export default function CustomerPackages({ api, customerId, canWrite, onChanged }: { api: GymApi; customerId: string; canWrite: boolean; onChanged?: () => void }) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<GymRecord | "new">();
  const [deleting, setDeleting] = useState<GymRecord>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = () => { setRevision(value => value + 1); onChanged?.(); };
  const query = useGymQuery<GymList>(api, `/packages?customerId=${customerId}&page=${page}&limit=20&status=${status}`, revision);
  return <section className="space-y-3 rounded-md border border-outline-variant bg-surface-container-lowest p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold text-on-surface">Gói PT của khách hàng</h2>{canWrite && <button type="button" className={primary} onClick={() => setEditing("new")}><Plus className="size-4" />Thêm gói PT</button>}</div>
    <Dropdown aria-label="Lọc trạng thái gói PT" value={status} onChange={value => { setStatus(value); setPage(1); }} options={[["", "Tất cả trạng thái"], ...statuses].map(([value, label]) => ({ value, label }))} />
    <Feedback loading={query.loading} error={query.error || error} />
    {!query.loading && !query.error && !query.data?.data.length && <div className="rounded-md border border-dashed border-outline-variant"><GymEmptyState kind="contract" filtered={Boolean(status)} title={status ? "Không có gói PT phù hợp." : "Khách hàng chưa có gói PT."} /></div>}
    <div className="grid gap-2">{query.data?.data.map(item => <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline-variant p-3">
      <div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-on-surface">{item.name}</strong><HrStatusBadge tone={item.status === "ACTIVE" ? "success" : "neutral"}>{statuses.find(([value]) => value === item.status)?.[1] || item.status}</HrStatusBadge></div><p className="mt-1 text-xs text-on-surface-variant">{Math.max(0, Number(item.totalSessions || 0) - Number(item.usedSessions || 0))}/{item.totalSessions} buổi còn lại · {dateLabel(item.startDate)} – {dateLabel(item.endDate)}</p></div>
      {canWrite && <div className="flex gap-2"><button type="button" className={secondary} onClick={() => setEditing(item)}><Pencil className="size-3.5" />Sửa gói</button><button type="button" className={secondary} onClick={() => setDeleting(item)}><Trash2 className="size-3.5" />Xóa gói</button></div>}
    </article>)}</div>
    {(query.data?.meta.totalPages || 0) > 1 && <nav aria-label="Phân trang gói PT" className="flex justify-end gap-2"><button type="button" className={secondary} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><span className="self-center text-sm">{page}/{query.data?.meta.totalPages}</span><button type="button" className={secondary} disabled={page >= (query.data?.meta.totalPages || 0)} onClick={() => setPage(value => value + 1)}>Sau</button></nav>}
    {editing && <PackageEditor api={api} customerId={customerId} record={editing === "new" ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} />}
    <ConfirmDialog native appearance="erp" isOpen={Boolean(deleting)} title="Xóa gói PT vĩnh viễn?" description="Gói PT đã xóa không thể khôi phục." confirmLabel="Xóa gói" isSubmitting={busy} error={error} onClose={() => setDeleting(undefined)} onConfirm={async () => { if (!deleting) return; setBusy(true); setError(""); try { await api.remove("packages", deleting); setDeleting(undefined); refresh(); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } }} />
  </section>;
}
