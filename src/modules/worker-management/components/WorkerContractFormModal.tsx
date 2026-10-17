import React from "react";
import { Lock, Save, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { toDisplayDate, toIsoDate } from "../utils/contractDate";
import { workerContractStatusLabel } from "../types";
import { WorkerSearchSelect } from "./WorkerSearchSelect";
import { DateInput24 } from "../../../components/common/TimeInput24";
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
      const input: WorkerLaborContractInput = {
        workerId: form.workerId,
        code: form.code.trim().toUpperCase(),
        clientName: form.clientName.trim(),
        startDate,
        endDate,
        ...(mode === "create" ? { status: "active" as const } : {}),
        note: form.note.trim(),
      };
      if (mode === "edit") delete input.workerId;
      await onSubmit(input);
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5">
      <button
        aria-label="Đóng"
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
      />
      <div role="dialog" aria-modal="true" aria-label={title} className="worker-contract-form-dialog relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#DCE7F4] bg-white shadow-[0_24px_70px_rgba(11,65,99,0.18)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E7EFF7] px-5 py-4 sm:px-6">
          <h2 className="border-l-[3px] border-[#00ADFC] pl-3 text-xl font-medium text-slate-900">{title}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white hover:bg-rose-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "renew" && contract && (
          <div className="mx-6 mt-4 rounded-xl border border-[#DCE7F4] bg-[#F5FAFE] px-4 py-3 text-sm text-slate-600">
            <p className="flex items-center gap-1.5 font-medium text-slate-700">
              <Lock className="h-3.5 w-3.5" />
              Kỳ hiện tại sẽ được khóa, giữ nguyên ngày và điều khoản
            </p>
            <p className="mt-1">
              {contract.code} · {contract.clientName} · {toDisplayDate(contract.startDate)} →{" "}
              {toDisplayDate(contract.endDate)}
            </p>
          </div>
        )}

        {locked && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Kỳ hợp đồng này đã kết thúc. Chỉ sửa được ghi chú và chấm dứt hợp đồng — muốn đổi
            thời hạn hãy tạo kỳ gia hạn mới.
          </div>
        )}

        <form onSubmit={submit} className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="workerId" className={labelClass}>
              Người lao động
            </label>
            <WorkerSearchSelect
              workers={workers}
              value={form.workerId}
              disabled={submitting || mode !== "create" || Boolean(lockedWorkerId)}
              onChange={(workerId) => setForm((current) => ({ ...current, workerId }))}
            />
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
          <DateField label="Ngày bắt đầu" value={form.startDate} onChange={(startDate) => setForm((current) => ({ ...current, startDate }))} disabled={submitting || locked} />
          <DateField label="Ngày kết thúc" value={form.endDate} onChange={(endDate) => setForm((current) => ({ ...current, endDate }))} disabled={submitting || locked} />

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

          <div className="space-y-1.5 sm:col-span-2">
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
              className="flex items-center gap-2 rounded-xl bg-[#00ADFC] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0097dc] disabled:opacity-50"
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

const labelClass = "text-sm text-slate-700";
const inputClass =
  "w-full rounded-xl border border-[#DCE7F4] bg-white px-4 py-2.5 text-base transition-colors focus:border-[#00ADFC] focus:outline-none focus:ring-2 focus:ring-[#00ADFC]/15 disabled:bg-slate-50 disabled:opacity-60";

function DateField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <span className={labelClass}>{label}</span>
      <DateInput24 ariaLabel={label} value={value} onChange={onChange} disabled={disabled} className="[&_button]:text-base" />
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={props.name} className={labelClass}>
        {label}
      </label>
      <input id={props.name} {...props} className={inputClass} />
    </div>
  );
}

export default WorkerContractFormModal;
