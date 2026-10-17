import React from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { useAuth } from "../../../context/AuthContext";
import { EntityAddModal } from "../../shared/components/EntityAddModal";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { DateInput24 } from "../../../components/common/TimeInput24";
import { CustomFieldsSection } from "../../shared/custom-fields/CustomFieldsSection";
import type { CustomFieldValues } from "../../shared/custom-fields/types";
import { canManageWorkerArea } from "../workerPermissionPolicy";
import { workerLaborTypeLabel } from "../types";
import { todayWorkerDate } from "../utils/date";
import type { LaborPartner } from "../partners/types";
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
  onSubmit: (input: WorkerInput, partnerId?: string) => Promise<Worker>;
  onSuccess: (worker: Worker) => void;
  workers?: Worker[];
  partners?: LaborPartner[];
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
  {
    key: "laborType",
    label: "Loại lao động",
    isRequired: false,
    isVisible: true,
  },
  { key: "nationality", label: "Quốc tịch", isRequired: false, isVisible: true },
  {
    key: "workPermitNumber",
    label: "Số giấy phép lao động / visa",
    isRequired: false,
    isVisible: true,
  },
  {
    key: "workPermitExpiry",
    label: "Ngày hết hạn GPLĐ / visa",
    isRequired: false,
    isVisible: true,
  },
  { key: "address", label: "Địa chỉ", isRequired: false, isVisible: true },
  { key: "note", label: "Ghi chú", isRequired: false, isVisible: true },
];

function initialForm(): WorkerInput {
  return {
    fullName: "",
    phone: "",
    email: "",
    status: "active",
    laborType: "official",
    nationality: "Việt Nam",
    workPermitNumber: "",
    workPermitExpiry: "",
    note: "",
    address: "",
    birthday: "",
    idCard: "",
    registrationDate: todayWorkerDate(),
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

const toInputDate = (value?: string) => {
  if (!value) return "";
  const raw = String(value).trim();
  const displayMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (displayMatch) {
    return `${displayMatch[3]}-${displayMatch[2].padStart(2, "0")}-${displayMatch[1].padStart(2, "0")}`;
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T)/);
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

export function AddWorkerModal({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
  workers = [],
  partners,
  profileFields = defaultFields,
  projects = [],
  tenantId,
  onRestoreProfileField,
}: Props) {
  const { userProfile } = useAuth();
  const [form, setForm] = React.useState<WorkerInput>(initialForm);
  const [partnerId, setPartnerId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setForm(initialForm());
    setPartnerId("");
    setError(null);
  }, [isOpen]);

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
      const worker = await onSubmit(form, partnerId || undefined);
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
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visible("fullName") && (
          <Field
            label={label("fullName")}
            name="fullName"
            value={form.fullName}
            onChange={update}
            disabled={submitting}
            placeholder="Nhập họ và tên"
          />
        )}
        {visible("phone") && (
          <Field
            label={label("phone")}
            name="phone"
            value={form.phone || ""}
            onChange={update}
            disabled={submitting}
            placeholder="Nhập số điện thoại"
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
            placeholder="Nhập địa chỉ email"
          />
        )}
        {visible("idCard") && (
          <Field
            label={label("idCard")}
            name="idCard"
            value={form.idCard || ""}
            onChange={update}
            disabled={submitting}
            placeholder="Nhập số CCCD / CMND"
          />
        )}
        {visible("birthday") && (
          <DateField label={label("birthday")} value={toInputDate(form.birthday)} onChange={(value) => setForm((curr) => ({ ...curr, birthday: fromInputDate(value) }))} disabled={submitting} />
        )}
        {visible("registrationDate") && (
          <DateField label={label("registrationDate")} value={toInputDate(form.registrationDate)} onChange={(value) => setForm((curr) => ({ ...curr, registrationDate: fromInputDate(value) }))} disabled={submitting} />
        )}
        {visible("status") && (
          <div className="space-y-1.5">
            <span className="block text-xs text-slate-600">{label("status")}</span>
            <StyledSelect
              ariaLabel={label("status")}
              value={form.status}
              onChange={(status) => setForm((current) => ({ ...current, status: status as WorkerInput["status"] }))}
              disabled={submitting}
              options={[{ value: "active", label: "Đang tuyển" }, { value: "placed", label: "Đã trúng tuyển" }, { value: "inactive", label: "Ngừng xử lý" }]}
            />
          </div>
        )}
        {visible("laborType") && (
          <div className="space-y-1.5">
            <span className="block text-xs text-slate-600">{label("laborType")}</span>
            <StyledSelect
              ariaLabel={label("laborType")}
              value={form.laborType || "official"}
              onChange={(laborType) => setForm((current) => ({ ...current, laborType: laborType as WorkerInput["laborType"] }))}
              disabled={submitting}
              options={Object.entries(workerLaborTypeLabel).map(([value, text]) => ({ value, label: text }))}
            />
          </div>
        )}
        {partners && (
          <div className="space-y-1.5">
            <label
              htmlFor="referralPartnerId"
              className="text-xs text-slate-600"
            >
              Đối tác giới thiệu
            </label>
            <PartnerSearchSelect
              partners={partners}
              value={partnerId}
              onChange={setPartnerId}
              disabled={submitting}
            />
          </div>
        )}
        {visible("nationality") && (
          <Field
            label={label("nationality")}
            name="nationality"
            value={form.nationality || ""}
            onChange={update}
            disabled={submitting}
            placeholder="Nhập quốc tịch"
          />
        )}
        {form.laborType === "foreign" && visible("workPermitNumber") && (
          <Field
            label={label("workPermitNumber")}
            name="workPermitNumber"
            value={form.workPermitNumber || ""}
            onChange={update}
            disabled={submitting}
            placeholder="Nhập số giấy phép lao động / visa"
          />
        )}
        {form.laborType === "foreign" && visible("workPermitExpiry") && (
          <DateField label={label("workPermitExpiry")} value={toInputDate(form.workPermitExpiry)} onChange={(value) => setForm((curr) => ({ ...curr, workPermitExpiry: fromInputDate(value) }))} disabled={submitting} />
        )}
        {visible("address") && (
          <Field
            label={label("address")}
            name="address"
            value={form.address || ""}
            onChange={update}
            disabled={submitting}
            placeholder="Nhập địa chỉ"
          />
        )}
        {projects.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-xs text-slate-600">Dự án</span>
            <StyledSelect
              ariaLabel="Dự án"
              value={form.projectId || ""}
              onChange={(projectId) => setForm((current) => ({ ...current, projectId }))}
              disabled={submitting}
              options={[{ value: "", label: "Chưa gán dự án" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]}
            />
          </div>
        )}
      </div>

      {visible("note") && (
        <div className="space-y-1.5">
          <label
            htmlFor="note"
            className="text-xs text-slate-600"
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
            placeholder="Nhập ghi chú (nếu có)"
            className="w-full rounded-xl border border-[#DCE7F4] bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 disabled:opacity-50"
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

export function PartnerSearchSelect({
  partners,
  value,
  onChange,
  disabled,
}: {
  partners: LaborPartner[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const activePartners = partners.filter((partner) => partner.status === "active");
  const selected = activePartners.find((partner) => partner._id === value);
  const matches = activePartners.filter((partner) => {
    const term = query.trim().toLocaleLowerCase("vi");
    if (!term) return true;
    return `${partner.code} ${partner.name} ${partner.phone}`.toLocaleLowerCase("vi").includes(term);
  });

  React.useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (partnerId: string) => {
    onChange(partnerId);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id="referralPartnerId"
        name="referralPartnerId"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="referral-partner-options"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selected ? `${selected.code} · ${selected.name}` : ""}
        placeholder="Tìm mã hoặc tên đối tác..."
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
          if (event.key === "Enter" && open && matches.length === 1) {
            event.preventDefault();
            pick(matches[0]._id);
          }
        }}
        className="w-full rounded-xl border border-[#DCE7F4] bg-white px-4 py-2.5 pr-10 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 disabled:opacity-50"
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
      {open && (
        <div
          id="referral-partner-options"
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#DCE7F4] bg-white py-1 shadow-[0_12px_32px_rgba(11,65,99,0.16)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => pick("")}
            className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-[#E8F7FF]"
          >
            Không chọn đối tác
          </button>
          {matches.map((partner) => (
            <button
              key={partner._id}
              type="button"
              role="option"
              aria-selected={partner._id === value}
              onClick={() => pick(partner._id)}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#E8F7FF]"
            >
              {partner.code} · {partner.name}
            </button>
          ))}
          {!matches.length && (
            <p className="px-3 py-2 text-xs text-slate-400">Không tìm thấy đối tác phù hợp.</p>
          )}
          {!activePartners.length && (
            <p className="px-3 py-2 text-xs text-slate-400">Chưa có đối tác đang hoạt động.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DateField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs text-slate-600">{label}</span>
      <DateInput24 value={value} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </div>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const placeholder = props.placeholder || `Nhập ${label.replace(/\s*\*$/, "").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={props.name}
        className="text-xs text-slate-600"
      >
        {label}
      </label>
      <input
        id={props.name}
        {...props}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#DCE7F4] bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/15 disabled:opacity-50"
      />
    </div>
  );
}
