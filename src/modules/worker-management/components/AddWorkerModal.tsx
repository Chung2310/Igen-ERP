import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Save, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import type {
  Worker,
  WorkerInput,
  WorkerProfileFieldConfig,
  WorkerProfileFieldKey,
} from "../types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: WorkerInput) => Promise<Worker>;
  onSuccess: (worker: Worker) => void;
  workers?: Worker[];
  profileFields?: WorkerProfileFieldConfig[];
};

const defaultFields: WorkerProfileFieldConfig[] = [
  { key: "fullName", label: "Họ và tên", isRequired: true, isVisible: true },
  { key: "phone", label: "Số điện thoại", isRequired: false, isVisible: true },
  { key: "email", label: "Email", isRequired: false, isVisible: true },
  { key: "idCard", label: "CCCD / CMND", isRequired: false, isVisible: true },
  { key: "birthday", label: "Ngày sinh", isRequired: false, isVisible: true },
  {
    key: "registrationDate",
    label: "Ngày tiếp nhận",
    isRequired: false,
    isVisible: true,
  },
  { key: "status", label: "Trạng thái", isRequired: false, isVisible: true },
  { key: "address", label: "Địa chỉ", isRequired: false, isVisible: true },
  { key: "note", label: "Ghi chú", isRequired: false, isVisible: true },
];

function initialForm(): WorkerInput {
  return {
    fullName: "",
    phone: "",
    email: "",
    status: "active",
    note: "",
    address: "",
    birthday: "",
    idCard: "",
    registrationDate: new Date().toLocaleDateString("vi-VN"),
  };
}

function normalizeDigits(value?: string) {
  return value?.replace(/\D/g, "") || "";
}

function duplicateLabel(workers: Worker[], form: WorkerInput) {
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
      workers.some((worker) => field.normalize(worker[field.key]) === value)
    ) {
      return field.label;
    }
  }
  return null;
}

export function AddWorkerModal({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
  workers = [],
  profileFields = defaultFields,
}: Props) {
  const [form, setForm] = React.useState<WorkerInput>(initialForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const fieldConfig = (key: WorkerProfileFieldKey) =>
    profileFields.find((field) => field.key === key) ||
    defaultFields.find((field) => field.key === key)!;
  const visible = (key: WorkerProfileFieldKey) => fieldConfig(key).isVisible;
  const required = (key: WorkerProfileFieldKey) =>
    fieldConfig(key).isRequired;
  const label = (key: WorkerProfileFieldKey) =>
    `${fieldConfig(key).label}${required(key) ? " *" : ""}`;

  const update = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing = profileFields
      .filter((field) => field.isVisible && field.isRequired)
      .filter((field) => !String(form[field.key] || "").trim())
      .map((field) => field.label);

    if (missing.length) {
      const message = `Vui lòng điền đầy đủ các trường bắt buộc: ${missing.join(", ")}`;
      setError(message);
      toast.error(message);
      return;
    }

    const duplicate = duplicateLabel(workers, form);
    if (duplicate) {
      const message = `${duplicate} đã tồn tại trong hệ thống, không được trùng.`;
      setError(message);
      toast.error(message);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const worker = await onSubmit(form);
      toast.success("Đã lưu hồ sơ Lao động thành công!");
      onClose();
      onSuccess(worker);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Lỗi lưu hồ sơ Lao động.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button
        aria-label="Đóng"
        type="button"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-800">
            Thêm lao động mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full p-1.5 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <form className="space-y-4 overflow-y-auto p-6" onSubmit={submit}>
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-bold text-rose-600">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {visible("fullName") && (
              <Field
                label={label("fullName")}
                name="fullName"
                value={form.fullName}
                onChange={update}
              />
            )}
            {visible("phone") && (
              <Field
                label={label("phone")}
                name="phone"
                value={form.phone || ""}
                onChange={update}
              />
            )}
            {visible("email") && (
              <Field
                label={label("email")}
                name="email"
                type="email"
                value={form.email || ""}
                onChange={update}
              />
            )}
            {visible("idCard") && (
              <Field
                label={label("idCard")}
                name="idCard"
                value={form.idCard || ""}
                onChange={update}
              />
            )}
            {visible("birthday") && (
              <Field
                label={label("birthday")}
                name="birthday"
                type="date"
                value={form.birthday || ""}
                onChange={update}
              />
            )}
            {visible("registrationDate") && (
              <Field
                label={label("registrationDate")}
                name="registrationDate"
                value={form.registrationDate || ""}
                onChange={update}
              />
            )}
            {visible("status") && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                  {label("status")}
                </label>
                <select
                  name="status"
                  value={form.status}
                  onChange={update}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
                >
                  <option value="active">Đang tuyển</option>
                  <option value="placed">Đã trúng tuyển</option>
                  <option value="inactive">Ngừng xử lý</option>
                </select>
              </div>
            )}
            {visible("address") && (
              <Field
                label={label("address")}
                name="address"
                value={form.address || ""}
                onChange={update}
              />
            )}
          </div>
          {visible("note") && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                {label("note")}
              </label>
              <textarea
                name="note"
                value={form.note || ""}
                onChange={update}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
              />
            </div>
          )}
          <div className="flex justify-end gap-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-xs font-bold text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-100 transition-all hover:-translate-y-0.5 hover:bg-cyan-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
    </AnimatePresence>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={props.name}
        className="text-[10px] font-bold uppercase tracking-wider text-slate-800"
      >
        {label}
      </label>
      <input
        id={props.name}
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none"
      />
    </div>
  );
}
