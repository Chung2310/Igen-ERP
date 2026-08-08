import React from "react";
import { toast } from "../../../pages/Toast";
import { useAuth } from "../../../context/AuthContext";
import { EntityAddModal } from "../../shared/components/EntityAddModal";
import { CustomFieldsSection } from "../../shared/custom-fields/CustomFieldsSection";
import type { CustomFieldValues } from "../../shared/custom-fields/types";
import { canManageWorkerArea } from "../workerPermissionPolicy";
import type {
  Worker,
  WorkerInput,
  WorkerProfileFieldConfig,
  WorkerProfileFieldKey,
  WorkerProjectSummary,
} from "../types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: WorkerInput) => Promise<Worker>;
  onSuccess: (worker: Worker) => void;
  workers?: Worker[];
  profileFields?: WorkerProfileFieldConfig[];
  projects?: WorkerProjectSummary[];
  /** Scope passed to the shared custom-field storage. */
  tenantId?: string;
  /** Provided by the host when archived standard fields can be restored. */
  onRestoreProfileField?: (key: WorkerProfileFieldKey) => void;
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
    projectId: "",
    customFields: {},
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
  projects = [],
  tenantId,
  onRestoreProfileField,
}: Props) {
  const { userProfile } = useAuth();
  const [form, setForm] = React.useState<WorkerInput>(initialForm);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const manageable = canManageWorkerArea(userProfile?.permissions || [], "custom-field");
  const archivedFields = profileFields.filter((field) => field.isArchived);

  const fieldConfig = (key: WorkerProfileFieldKey) =>
    profileFields.find((field) => field.key === key) ||
    defaultFields.find((field) => field.key === key)!;
  const visible = (key: WorkerProfileFieldKey) => {
    const config = fieldConfig(key);
    return config.isVisible && !config.isArchived;
  };
  const required = (key: WorkerProfileFieldKey) => fieldConfig(key).isRequired;
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
      .filter((field) => field.isVisible && !field.isArchived && field.isRequired)
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
    <EntityAddModal
      isOpen={isOpen}
      title="Thêm lao động mới"
      onClose={onClose}
      onSubmit={submit}
      error={error}
      submitting={submitting}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visible("fullName") && (
          <Field
            label={label("fullName")}
            name="fullName"
            value={form.fullName}
            onChange={update}
            disabled={submitting}
          />
        )}
        {visible("phone") && (
          <Field
            label={label("phone")}
            name="phone"
            value={form.phone || ""}
            onChange={update}
            disabled={submitting}
          />
        )}
        {visible("email") && (
          <Field
            label={label("email")}
            name="email"
            type="email"
            value={form.email || ""}
            onChange={update}
            disabled={submitting}
          />
        )}
        {visible("idCard") && (
          <Field
            label={label("idCard")}
            name="idCard"
            value={form.idCard || ""}
            onChange={update}
            disabled={submitting}
          />
        )}
        {visible("birthday") && (
          <Field
            label={label("birthday")}
            name="birthday"
            type="date"
            value={form.birthday || ""}
            onChange={update}
            disabled={submitting}
          />
        )}
        {visible("registrationDate") && (
          <Field
            label={label("registrationDate")}
            name="registrationDate"
            value={form.registrationDate || ""}
            onChange={update}
            disabled={submitting}
          />
        )}
        {visible("status") && (
          <div className="space-y-1">
            <label
              htmlFor="status"
              className="text-[10px] font-bold uppercase tracking-wider text-slate-800"
            >
              {label("status")}
            </label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={update}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none disabled:opacity-50"
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
            disabled={submitting}
          />
        )}
        {projects.length > 0 && (
          <div className="space-y-1">
            <label
              htmlFor="projectId"
              className="text-[10px] font-bold uppercase tracking-wider text-slate-800"
            >
              Dự án
            </label>
            <select
              id="projectId"
              name="projectId"
              value={form.projectId || ""}
              onChange={update}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none disabled:opacity-50"
            >
              <option value="">Chưa gán dự án</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {visible("note") && (
        <div className="space-y-1">
          <label
            htmlFor="note"
            className="text-[10px] font-bold uppercase tracking-wider text-slate-800"
          >
            {label("note")}
          </label>
          <textarea
            id="note"
            name="note"
            value={form.note || ""}
            onChange={update}
            rows={3}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none disabled:opacity-50"
          />
        </div>
      )}

      <CustomFieldsSection
        moduleKey="students"
        mode="create"
        tenantId={tenantId}
        disabled={submitting}
        values={(form.customFields || {}) as CustomFieldValues}
        onChange={(customFields) =>
          setForm((current) => ({ ...current, customFields }))
        }
      />

      {manageable && onRestoreProfileField && archivedFields.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Trường mặc định đã lưu trữ
          </h4>
          <ul className="mt-2 divide-y divide-slate-100">
            {archivedFields.map((field) => (
              <li
                key={field.key}
                className="flex items-center justify-between py-2 text-xs text-slate-600"
              >
                <span>{field.label}</span>
                <button
                  type="button"
                  disabled={submitting}
                  aria-label={`Khôi phục ${field.label}`}
                  onClick={() => onRestoreProfileField(field.key)}
                  className="font-bold text-cyan-600 transition-colors hover:text-cyan-700 disabled:opacity-50"
                >
                  Khôi phục
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </EntityAddModal>
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
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-cyan-600 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
