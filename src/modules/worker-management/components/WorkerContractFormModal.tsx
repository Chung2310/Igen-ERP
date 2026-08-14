import React from "react";
import { Lock, Save, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { toDisplayDate, toIsoDate } from "../utils/contractDate";
import { workerContractStatusLabel } from "../types";
import type {
  Worker,
  WorkerLaborContract,
  WorkerLaborContractInput,
  WorkerLaborContractStatus,
} from "../types";

export type ContractFormMode = "create" | "edit" | "renew";

type Props = {
  mode: ContractFormMode;
  isOpen: boolean;
  workers: Worker[];
  /** Kỳ đang sửa (edit) hoặc kỳ nguồn để gia hạn (renew). */
  contract?: WorkerLaborContract | null;
  /** Khóa sẵn người lao động khi mở từ hồ sơ. */
  lockedWorkerId?: string;
  onClose: () => void;
  onSubmit: (input: WorkerLaborContractInput) => Promise<unknown>;
};

type FormState = {
  workerId: string;
  code: string;
  clientName: string;
  startDate: string;
  endDate: string;
  status: WorkerLaborContractStatus;
  note: string;
};

const emptyForm: FormState = {
  workerId: "",
  code: "",
  clientName: "",
  startDate: "",
  endDate: "",
  status: "active",
  note: "",
};

/** Ngày kế tiếp của kỳ cũ — gợi ý mặc định cho kỳ gia hạn. */
function dayAfter(isoDate: string) {
  const parts = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return "";
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]) + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function WorkerContractFormModal({
  mode,
  isOpen,
  workers,
  contract,
  lockedWorkerId,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && contract) {
      setForm({
        workerId: contract.workerId,
        code: contract.code,
        clientName: contract.clientName,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        note: contract.note || "",
      });
      return;
    }
    if (mode === "renew" && contract) {
      setForm({
        ...emptyForm,
        workerId: contract.workerId,
        clientName: contract.clientName,
        startDate: dayAfter(contract.endDate),
        status: "active",
      });
      return;
    }
    setForm({ ...emptyForm, workerId: lockedWorkerId || "" });
  }, [contract, isOpen, lockedWorkerId, mode]);

  if (!isOpen) return null;

  // Kỳ đã khóa: chỉ còn ghi chú và việc chấm dứt là sửa được.
  const locked = mode === "edit" && Boolean(contract?.lockedAt);

  const update = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.workerId) {
      toast.warning("Vui lòng chọn người lao động.");
      return;
    }
    if (!form.code.trim() || !form.clientName.trim()) {
      toast.warning("Vui lòng nhập mã hợp đồng và khách hàng sử dụng lao động.");
      return;
    }
    const startDate = toIsoDate(form.startDate);
    const endDate = toIsoDate(form.endDate);
    if (!startDate || !endDate) {
      toast.warning("Vui lòng nhập ngày bắt đầu và ngày kết thúc.");
      return;
    }
    if (endDate <= startDate) {
      toast.warning("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        workerId: form.workerId,
        code: form.code.trim().toUpperCase(),
        clientName: form.clientName.trim(),
        startDate,
        endDate,
        ...(mode === "create" ? { status: "active" as const } : {}),
        note: form.note.trim(),
      });
      onClose();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Không thể lưu hợp đồng.");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === "renew"
      ? "Gia hạn hợp đồng"
      : mode === "edit"
        ? "Chỉnh sửa hợp đồng"
        : "Thêm hợp đồng";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        aria-label="Đóng"
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
      />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {mode === "renew" && contract && (
          <div className="mx-6 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="flex items-center gap-1.5 font-bold text-slate-700">
              <Lock className="h-3.5 w-3.5" />
              Kỳ hiện tại sẽ được khóa, giữ nguyên ngày và điều khoản
            </p>
            <p className="mt-1 font-medium">
              {contract.code} · {contract.clientName} · {toDisplayDate(contract.startDate)} →{" "}
              {toDisplayDate(contract.endDate)}
            </p>
          </div>
        )}

        {locked && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            Kỳ hợp đồng này đã kết thúc. Chỉ sửa được ghi chú và chấm dứt hợp đồng — muốn đổi
            thời hạn hãy tạo kỳ gia hạn mới.
          </div>
        )}

        <form onSubmit={submit} className="grid gap-4 overflow-y-auto p-6 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="workerId" className={labelClass}>
              Người lao động
            </label>
            <select
              id="workerId"
              name="workerId"
              value={form.workerId}
              onChange={update}
              disabled={submitting || mode !== "create" || Boolean(lockedWorkerId)}
              className={inputClass}
            >
              <option value="">— Chọn người lao động —</option>
              {workers.map((worker) => (
                <option key={worker._id} value={worker._id}>
                  {worker.fullName}
                  {worker.phone ? ` · ${worker.phone}` : ""}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Mã hợp đồng"
            name="code"
            value={form.code}
            onChange={update}
            disabled={submitting || locked}
          />
          <Field
            label="Khách hàng / đơn vị sử dụng lao động"
            name="clientName"
            value={form.clientName}
            onChange={update}
            disabled={submitting || locked}
          />
          <Field
            label="Ngày bắt đầu"
            name="startDate"
            type="date"
            value={form.startDate}
            onChange={update}
            disabled={submitting || locked}
          />
          <Field
            label="Ngày kết thúc"
            name="endDate"
            type="date"
            value={form.endDate}
            onChange={update}
            disabled={submitting || locked}
          />

          <div className="hidden">
            <label htmlFor="status" className={labelClass}>
              Trạng thái
            </label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={update}
              disabled={submitting || mode === "renew"}
              className={inputClass}
            >
              {(["draft", "active", "terminated"] as WorkerLaborContractStatus[]).map((value) => (
                <option key={value} value={value}>
                  {workerContractStatusLabel[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="note" className={labelClass}>
              Ghi chú
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              value={form.note}
              onChange={update}
              disabled={submitting}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {submitting ? "Đang lưu..." : mode === "renew" ? "Tạo kỳ gia hạn" : "Lưu hợp đồng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelClass = "text-[10px] font-bold uppercase tracking-wider text-slate-800";
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none disabled:bg-slate-50 disabled:opacity-60";

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const isDate = props.name === "startDate" || props.name === "endDate";
  const inputProps = isDate
    ? { ...props, type: "text", value: toDisplayDate(String(props.value || "")), placeholder: "DD/MM/YYYY", inputMode: "numeric" as const, maxLength: 10 }
    : props;
  return (
    <div className="space-y-1">
      <label htmlFor={props.name} className={labelClass}>
        {label}
      </label>
      <input id={props.name} {...inputProps} className={inputClass} />
    </div>
  );
}

export default WorkerContractFormModal;
