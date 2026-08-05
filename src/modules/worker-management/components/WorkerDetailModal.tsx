import React from "react";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import type {
  Worker,
  WorkerInput,
  WorkerProfileFieldConfig,
} from "../types";

const defaultProfileFields: WorkerProfileFieldConfig[] = [
  { key: "fullName", label: "Họ và tên", isRequired: true, isVisible: true },
];

const normalizeDigits = (value?: string) => value?.replace(/\D/g, "") || "";

function duplicateLabel(workers: Worker[], form: WorkerInput, currentId: string) {
  const fields = [
    {
      key: "email" as const,
      label: "Email",
      normalize: (value?: string) => value?.trim().toLowerCase() || "",
    },
    { key: "phone" as const, label: "Số điện thoại", normalize: normalizeDigits },
    { key: "idCard" as const, label: "CCCD/CMND", normalize: normalizeDigits },
  ];
  for (const field of fields) {
    const value = field.normalize(form[field.key]);
    if (
      value &&
      workers.some(
        (candidate) =>
          candidate._id !== currentId &&
          field.normalize(candidate[field.key]) === value,
      )
    ) {
      return field.label;
    }
  }
  return null;
}

type Props = { worker: Worker | null; workers?: Worker[]; profileFields?: WorkerProfileFieldConfig[]; onClose: () => void; onSubmit: (id: string, input: WorkerInput) => Promise<Worker>; onSuccess: (worker: Worker) => void; };
export function WorkerDetailModal({ worker, workers = [], profileFields = defaultProfileFields, onClose, onSubmit, onSuccess }: Props) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<WorkerInput | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => { setEditing(false); setForm(worker ? { fullName: worker.fullName, phone: worker.phone || "", email: worker.email || "", status: worker.status, note: worker.note || "", address: worker.address || "", birthday: worker.birthday || "", idCard: worker.idCard || "", registrationDate: worker.registrationDate || "", branchId: worker.branchId, customFields: worker.customFields } : null); }, [worker]);
  if (!worker || !form) return null;
  const update = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((current) => current ? { ...current, [event.target.name]: event.target.value } : current);
  const save = async (event: React.FormEvent) => { event.preventDefault(); const missing = profileFields.filter((field) => field.isVisible && field.isRequired).filter((field) => !String(form[field.key] || "").trim()).map((field) => field.label); if (missing.length) { toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missing.join(", ")}`); return; } const duplicate = duplicateLabel(workers, form, worker._id); if (duplicate) { toast.error(`${duplicate} đã tồn tại trong hệ thống, không được trùng.`); return; } setSubmitting(true); try { const updated = await onSubmit(worker._id, form); toast.success("Đã cập nhật hồ sơ Lao động thành công!"); setEditing(false); onSuccess(updated); } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Lỗi cập nhật hồ sơ Lao động."); } finally { setSubmitting(false); } };
  return <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4"><button aria-label="Đóng" type="button" onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" /><div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-auto sm:max-h-[95vh] sm:max-w-5xl sm:rounded-[2rem]"><div className="flex shrink-0 flex-col justify-between gap-4 border-b border-slate-100 bg-white px-4 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-6"><div className="flex items-center gap-4 sm:gap-6"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xl font-bold text-white shadow-lg shadow-cyan-100 sm:h-16 sm:w-16 sm:text-2xl">{worker.fullName.charAt(0)}</div><div><h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{worker.fullName}</h2><span className="text-[10px] font-medium text-slate-500 sm:text-xs">{worker.phone || "Chưa có số điện thoại"}</span></div></div><div className="flex items-center gap-2 self-end sm:self-center"><button type="button" onClick={() => setEditing((value) => !value)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />{editing ? "Hủy sửa" : "Chỉnh sửa"}</button><button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button></div></div>{editing ? <form className="grid gap-4 overflow-y-auto p-6 sm:grid-cols-2 sm:p-8" onSubmit={save}><Input label="Họ và tên" name="fullName" value={form.fullName} onChange={update} /><Input label="Số điện thoại" name="phone" value={form.phone || ""} onChange={update} /><Input label="Email" name="email" value={form.email || ""} onChange={update} /><Input label="CCCD / CMND" name="idCard" value={form.idCard || ""} onChange={update} /><Input label="Ngày sinh" name="birthday" type="date" value={form.birthday || ""} onChange={update} /><Input label="Ngày tiếp nhận" name="registrationDate" value={form.registrationDate || ""} onChange={update} /><Input label="Địa chỉ" name="address" value={form.address || ""} onChange={update} /><Input label="Ghi chú" name="note" value={form.note || ""} onChange={update} /><div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-wider text-slate-800">Trạng thái</label><select name="status" value={form.status} onChange={update} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"><option value="active">Đang tuyển</option><option value="placed">Đã trúng tuyển</option><option value="inactive">Ngừng xử lý</option></select></div><div className="col-span-full flex justify-end"><button disabled={submitting} className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />{submitting ? "Đang lưu..." : "Lưu thay đổi"}</button></div></form> : <div className="grid gap-4 overflow-y-auto p-6 text-sm sm:grid-cols-2 sm:p-8"><Info label="Email" value={worker.email} /><Info label="CCCD / CMND" value={worker.idCard} /><Info label="Ngày sinh" value={worker.birthday} /><Info label="Ngày tiếp nhận" value={worker.registrationDate} /><Info label="Địa chỉ" value={worker.address} /><Info label="Ghi chú" value={worker.note} /></div>}</div></div>;
}
function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-wider text-slate-800">{label}</label><input {...props} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-cyan-600 focus:outline-none" /></div>; }
function Info({ label, value }: { label: string; value?: string }) { return <div className="rounded-xl border border-slate-100 bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-700">{value || "Chưa cập nhật"}</p></div>; }