import React from "react";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { DateInput24 } from "../../../components/common/TimeInput24";
import { workerLaborTypeLabel } from "../types";
import { WorkerContractPanel } from "./WorkerContractPanel";
import { PartnerSearchSelect } from "./AddWorkerModal";
import { formatWorkerDate } from "../utils/date";
import { laborPartnersApi } from "../partners/api/laborPartners.api";
import type { LaborPartner } from "../partners/types";
import type {
  Worker,
  WorkerInput,
  WorkerProfileFieldConfig,
  WorkerScope,
} from "../types";

const defaultProfileFields: WorkerProfileFieldConfig[] = [
  { key: "fullName", label: "Họ và tên", isRequired: true, isVisible: true },
];
const workerStatusLabel: Record<Worker["status"], string> = { active: "Đang tuyển", placed: "Đã trúng tuyển", inactive: "Ngừng xử lý" };

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

type Props = { worker: Worker | null; workers?: Worker[]; partners?: LaborPartner[]; profileFields?: WorkerProfileFieldConfig[]; scope?: WorkerScope; canManage?: boolean; initialEditing?: boolean; onClose: () => void; onSubmit: (id: string, input: WorkerInput, partnerId?: string) => Promise<Worker>; onSuccess: (worker: Worker) => void; };
export function WorkerDetailModal({ worker, workers = [], partners = [], profileFields = defaultProfileFields, scope, canManage = false, initialEditing = false, onClose, onSubmit, onSuccess }: Props) {
  const [editing, setEditing] = React.useState(false);
  const [section, setSection] = React.useState<"profile" | "contract">("profile");
  const [form, setForm] = React.useState<WorkerInput | null>(null);
  const [referralPartner, setReferralPartner] = React.useState("");
  const [selectedPartnerId, setSelectedPartnerId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  React.useEffect(() => { setEditing(initialEditing); setSection("profile"); setReferralPartner(""); setForm(worker ? { fullName: worker.fullName, phone: worker.phone || "", email: worker.email || "", status: worker.status, laborType: worker.laborType || "official", nationality: worker.nationality || "", workPermitNumber: worker.workPermitNumber || "", workPermitExpiry: worker.workPermitExpiry || "", note: worker.note || "", address: worker.address || "", birthday: worker.birthday || "", idCard: worker.idCard || "", registrationDate: worker.registrationDate || "", branchId: worker.branchId, customFields: worker.customFields } : null); }, [initialEditing, worker]);
  React.useEffect(() => {
    if (!worker || !scope || worker.partnerName) return;
    let active = true;
    void laborPartnersApi.listReferralsForWorker(scope, worker._id).then((referrals) => {
      if (!active) return;
      const referral = referrals.find((item) => item.status === "pending" || item.status === "active") || referrals[0];
      if (!referral) return;
      const partner = referral.partnerId;
      setSelectedPartnerId(typeof partner === "string" ? partner : partner._id);
      setReferralPartner(typeof partner === "string" ? partner : `${partner.code} · ${partner.name}`);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [scope, worker]);
  React.useEffect(() => { setSelectedPartnerId(""); }, [worker]);
  React.useEffect(() => {
    if (!worker) return;
    const partner = partners.find((item) => item.code === worker.partnerCode || item.name === worker.partnerName);
    if (partner) setSelectedPartnerId(partner._id);
  }, [partners, worker]);
  if (!worker || !form) return null;
  const referralValue = worker.partnerName ? `${worker.partnerCode || ""} · ${worker.partnerName}` : referralPartner || worker.partnerCode;
  const update = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((current) => current ? { ...current, [event.target.name]: event.target.value } : current);
  const save = async (event: React.FormEvent) => { event.preventDefault(); const missing = profileFields.filter((field) => field.isVisible && field.isRequired).filter((field) => !String(form[field.key] || "").trim()).map((field) => field.label); if (missing.length) { toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missing.join(", ")}`); return; } const duplicate = duplicateLabel(workers, form, worker._id); if (duplicate) { toast.error(`${duplicate} đã tồn tại trong hệ thống, không được trùng.`); return; } setSubmitting(true); try { const updated = await onSubmit(worker._id, form, selectedPartnerId || undefined); toast.success("Đã cập nhật hồ sơ Lao động thành công!"); setEditing(false); onSuccess(updated); } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Lỗi cập nhật hồ sơ Lao động."); } finally { setSubmitting(false); } };
  return <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4"><button aria-label="Đóng" type="button" onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" /><div className="relative flex h-full w-full flex-col overflow-hidden bg-white shadow-[0_24px_70px_rgba(11,65,99,0.18)] sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-5xl sm:rounded-2xl sm:border sm:border-[#DCE7F4]"><div className="flex shrink-0 flex-col justify-between gap-4 border-b border-[#E7EFF7] bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div className="flex items-center gap-4 sm:gap-6"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00ADFC] text-xl font-medium text-white sm:h-16 sm:w-16 sm:text-2xl">{worker.fullName.charAt(0)}</div><div><h2 className="border-l-[3px] border-[#00ADFC] pl-3 text-xl font-medium tracking-tight text-slate-900">{worker.fullName}</h2><span className="text-sm text-slate-600">{worker.phone || "Chưa có số điện thoại"}</span></div></div><div className="flex items-center gap-2 self-end sm:self-center"><div className="flex items-center gap-1 rounded-xl border border-[#DCE7F4] bg-[#F5FAFE] p-1">{([["profile", "Hồ sơ"], ["contract", "Hợp đồng"]] as const).map(([value, text]) => <button key={value} type="button" onClick={() => setSection(value)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${section === value ? "bg-[#00ADFC] text-white" : "text-slate-600 hover:bg-white"}`}>{text}</button>)}</div>{section === "profile" && <button type="button" onClick={() => setEditing((value) => !value)} className="flex items-center gap-1.5 rounded-xl border border-[#DCE7F4] px-3 py-2 text-xs text-slate-600 hover:bg-[#F5FAFE]"><Pencil className="h-3.5 w-3.5" />{editing ? "Hủy sửa" : "Chỉnh sửa"}</button>}<button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600"><X className="h-4 w-4" /></button></div></div>{section === "contract" ? <WorkerContractPanel worker={worker} scope={scope} canManage={canManage} /> : editing ? <form className="grid gap-3 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6" onSubmit={save}><Input label="Họ và tên" name="fullName" value={form.fullName} onChange={update} /><Input label="Số điện thoại" name="phone" value={form.phone || ""} onChange={update} /><Input label="Email" name="email" value={form.email || ""} onChange={update} />{partners.length > 0 && <div className="space-y-1"><label className="text-xs text-slate-600">Đối tác giới thiệu</label><PartnerSearchSelect partners={partners} value={selectedPartnerId} onChange={setSelectedPartnerId} disabled={submitting} /></div>}<Input label="CCCD / CMND" name="idCard" value={form.idCard || ""} onChange={update} /><Input label="Ngày sinh" name="birthday" type="date" value={form.birthday || ""} onChange={update} /><Input label="Ngày tiếp nhận" name="registrationDate" value={form.registrationDate || ""} onChange={update} /><Input label="Quốc tịch" name="nationality" value={form.nationality || ""} onChange={update} />{form.laborType === "foreign" && <><Input label="Số GPLĐ / visa" name="workPermitNumber" value={form.workPermitNumber || ""} onChange={update} /><Input label="Ngày hết hạn GPLĐ / visa" name="workPermitExpiry" placeholder="DD/MM/YYYY" value={form.workPermitExpiry || ""} onChange={update} /></>}<Input label="Địa chỉ" name="address" value={form.address || ""} onChange={update} /><Input label="Ghi chú" name="note" value={form.note || ""} onChange={update} /><div className="space-y-1"><label className="text-xs text-slate-600">Trạng thái</label><StyledSelect ariaLabel="Trạng thái" value={form.status} onChange={(status) => setForm((current) => current ? { ...current, status: status as Worker["status"] } : current)} options={[{ value: "active", label: "Đang tuyển" }, { value: "placed", label: "Đã trúng tuyển" }, { value: "inactive", label: "Ngừng xử lý" }]} /></div><div className="space-y-1"><label className="text-xs text-slate-600">Loại lao động</label><StyledSelect ariaLabel="Loại lao động" value={form.laborType || "official"} onChange={(laborType) => setForm((current) => current ? { ...current, laborType: laborType as WorkerInput["laborType"] } : current)} options={Object.entries(workerLaborTypeLabel).map(([value, text]) => ({ value, label: text }))} /></div><div className="col-span-full flex justify-end"><button disabled={submitting} className="flex items-center gap-1.5 rounded-xl bg-[#00ADFC] px-4 py-2 text-sm font-medium text-white hover:bg-[#0097dc] disabled:opacity-50"><Save className="h-3.5 w-3.5" />{submitting ? "Đang lưu..." : "Lưu thay đổi"}</button></div></form> : <div className="grid gap-3 overflow-y-auto p-5 text-sm sm:grid-cols-2 sm:p-6"><Info label="Email" value={worker.email} /><Info label="CCCD / CMND" value={worker.idCard} /><Info label="Đối tác giới thiệu" value={referralValue} /><Info label="Ngày sinh" value={worker.birthday} /><Info label="Ngày tiếp nhận" value={worker.registrationDate} /><Info label="Loại lao động" value={workerLaborTypeLabel[worker.laborType || "official"]} /><Info label="Trạng thái" value={workerStatusLabel[worker.status]} /><Info label="Quốc tịch" value={worker.nationality} />{worker.laborType === "foreign" && <><Info label="Số GPLĐ / visa" value={worker.workPermitNumber} /><Info label="Ngày hết hạn GPLĐ / visa" value={worker.workPermitExpiry} /></>}<Info label="Địa chỉ" value={worker.address} /><Info label="Ghi chú" value={worker.note} /></div>}</div></div>;
}
const toInputDate = (value?: string) => {
  if (!value) return "";
  const raw = String(value).trim();
  const displayMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[3]}-${displayMatch[2].padStart(2, "0")}-${displayMatch[1].padStart(2, "0")}`;
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }
  return "";
};

const fromInputDate = (value?: string) => {
  if (!value) return "";
  const raw = String(value).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, "0")}/${isoMatch[2].padStart(2, "0")}/${isoMatch[1]}`;
  }
  return raw;
};

function Input({ label, onChange, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const isDate = ["birthday", "registrationDate", "workPermitExpiry"].includes(props.name || "");
  const placeholder = props.placeholder || `Nhập ${label.replace(/\s*\*$/, "").toLowerCase()}`;
  if (isDate) {
    return (
      <div className="space-y-1.5">
        <span className="block text-xs text-slate-600">{label}</span>
        <DateInput24
          value={toInputDate(String(props.value || ""))}
          onChange={(value) => onChange?.({ target: { name: props.name || "", value: fromInputDate(value) } } as React.ChangeEvent<HTMLInputElement>)}
          ariaLabel={label}
          disabled={props.disabled}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor={`worker-detail-${props.name}`} className="text-xs text-slate-600">{label}</label>
      <input
        {...props}
        id={`worker-detail-${props.name}`}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#DCE7F4] bg-white px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-[#00ADFC] focus:outline-none focus:ring-2 focus:ring-[#00ADFC]/15"
      />
    </div>
  );
}
function Info({ label, value }: { label: string; value?: string }) {
  const displayValue = label.startsWith("Ngày") ? formatWorkerDate(value) : value;
  return <div className="rounded-xl border border-[#DCE7F4] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-700">{displayValue || "Chưa cập nhật"}</p></div>;
}
