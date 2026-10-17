import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, Save, X } from "lucide-react";
import { NoticeDialog } from "../../../components/common/NoticeDialog";
import { DateTimeInput24 } from "../../../components/common/TimeInput24";
import { StyledSelect } from "../../../components/common/StyledSelect";
import { DYNAMIC_FIELD_TYPES, createMaxSizeMb, type CreateFieldInput, type DynamicFieldType, type FieldDefinition } from "./types";

export type CustomFieldEditorModalProps = {
  open: boolean;
  moduleKey: FieldDefinition["moduleKey"];
  initialField?: FieldDefinition | null;
  onClose(): void;
  onSubmit(input: CreateFieldInput): Promise<unknown> | unknown;
  isStandard?: boolean;
};

type FormState = {
  label: string; type: DynamicFieldType; placeholder: string; defaultValue: string | boolean | string[];
  isVisible: boolean; isRequired: boolean; optionsText: string;
  min: string; max: string; decimals: string; minLength: string; maxLength: string;
  minDateTime: string; maxDateTime: string;
  maxSizeMb: string; maxFiles: string; allowedMimeTypes: string;
};

const typeLabels: Record<DynamicFieldType, string> = {
  text: "Văn bản", email: "Email", phone: "Số điện thoại", url: "Liên kết",
  percent: "Phần trăm", currency: "Tiền tệ", dateTime: "Ngày giờ",
  checkbox: "Checkbox", file: "Tệp", image: "Hình ảnh",
};
const DEFAULT_ALLOWED_FILE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const inputClass = "mt-1 h-10 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm font-normal text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#70D5FF] focus:ring-2 focus:ring-[#00ADFC]/15";

function initialState(field?: FieldDefinition | null): FormState {
  const validation = field?.validation as Record<string, unknown> | undefined;
  const type = field?.type ?? "text";
  const initialDefault = type === "checkbox"
    ? field?.defaultValue === true
    : typeof field?.defaultValue === "string" || typeof field?.defaultValue === "number" ? String(field.defaultValue) : "";
  return {
    label: field?.label ?? "", type, placeholder: field?.placeholder ?? "", defaultValue: initialDefault,
    isVisible: field?.isVisible ?? true, isRequired: field?.isRequired ?? false,
    optionsText: field?.options?.map((option) => `${option.label} | ${option.value}`).join("\n") ?? "",
    min: String(validation?.min ?? ""), max: String(validation?.max ?? ""), decimals: String(validation?.decimals ?? ""),
    minLength: String(validation?.minLength ?? ""), maxLength: String(validation?.maxLength ?? ""),
    minDateTime: String(validation?.minDateTime ?? ""), maxDateTime: String(validation?.maxDateTime ?? ""),
    maxSizeMb: String(validation?.maxSizeMb ?? "10"), maxFiles: String(validation?.maxFiles ?? "1"),
    allowedMimeTypes: Array.isArray(validation?.allowedMimeTypes) ? validation.allowedMimeTypes.join(", ") : "",
  };
}

function numberOrUndefined(value: string): number | undefined { return value.trim() === "" ? undefined : Number(value); }

function defaultForType(type: DynamicFieldType): FormState["defaultValue"] {
  if (type === "checkbox") return false;
  return "";
}

export function CustomFieldEditorModal({ open, moduleKey, initialField, onClose, onSubmit, isStandard = false }: CustomFieldEditorModalProps) {
  const [form, setForm] = useState<FormState>(() => initialState(initialField));
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setForm(initialState(initialField)); setErrors([]); setSubmitting(false); } }, [open, initialField]);
  useEffect(() => {
    if (!open) return;
    labelInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const validate = () => {
    const next: string[] = [];
    if (!form.label.trim()) next.push("Vui lòng nhập nhãn trường.");
    const min = numberOrUndefined(form.min); const max = numberOrUndefined(form.max);
    const minLength = numberOrUndefined(form.minLength); const maxLength = numberOrUndefined(form.maxLength);
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max)) || (min !== undefined && max !== undefined && min > max)) next.push("Khoảng số không hợp lệ.");
    if ((minLength !== undefined && (!Number.isInteger(minLength) || minLength < 0)) || (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 0)) || (minLength !== undefined && maxLength !== undefined && minLength > maxLength)) next.push("Khoảng độ dài không hợp lệ.");
    if (form.minDateTime && form.maxDateTime && form.minDateTime > form.maxDateTime) next.push("Khoảng ngày giờ không hợp lệ.");
    if (["file", "image"].includes(form.type)) {
      try { createMaxSizeMb(Number(form.maxSizeMb)); } catch { next.push("Kích thước tối đa phải từ 1 đến 100 MB."); }
      const maxFiles = Number(form.maxFiles);
      if (!Number.isInteger(maxFiles) || maxFiles < 1) next.push("Số tệp tối đa phải là số nguyên từ 1.");
    }
    return next;
  };

  const submit = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    const nextErrors = validate();
    if (nextErrors.length) { setErrors(nextErrors); return; }
    let validation: Record<string, unknown> | undefined;
    if (form.type === "text") {
      validation = { minLength: numberOrUndefined(form.minLength), maxLength: numberOrUndefined(form.maxLength) };
    }
    if (["percent", "currency"].includes(form.type)) validation = { min: numberOrUndefined(form.min), max: numberOrUndefined(form.max), decimals: numberOrUndefined(form.decimals) };
    if (form.type === "dateTime") validation = { minDateTime: form.minDateTime || undefined, maxDateTime: form.maxDateTime || undefined };
    if (["file", "image"].includes(form.type)) {
      const allowedMimeTypes = form.type === "image"
        ? ["image/*"]
        : DEFAULT_ALLOWED_FILE_MIME_TYPES;
      validation = { maxSizeMb: createMaxSizeMb(Number(form.maxSizeMb)), maxFiles: Number(form.maxFiles), allowedMimeTypes };
    }
    let defaultValue: CreateFieldInput["defaultValue"];
    if (["file", "image"].includes(form.type)) defaultValue = undefined;
    else if (form.type === "checkbox") defaultValue = form.defaultValue === true;
    else if (["percent", "currency"].includes(form.type)) defaultValue = form.defaultValue === "" ? undefined : Number(form.defaultValue);
    else defaultValue = typeof form.defaultValue === "string" && form.defaultValue !== "" ? form.defaultValue : undefined;
    setSubmitting(true); setErrors([]);
    try {
      await onSubmit({ label: form.label.trim(), type: form.type, placeholder: form.placeholder.trim() || undefined, defaultValue, options: undefined, validation, isVisible: form.isVisible, isRequired: form.isVisible && form.isRequired });
      onClose();
    } catch (caught) {
      setErrors([caught instanceof Error ? caught.message : "Không thể lưu trường. Vui lòng thử lại."]);
    } finally { setSubmitting(false); }
  };

  const textType = form.type === "text";
  const numericType = ["percent", "currency"].includes(form.type);
  const fileType = ["file", "image"].includes(form.type);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab" && dialogRef.current) {
      const focusable = Array.from(dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')) as HTMLElement[];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
      <div ref={dialogRef} onKeyDown={handleKeyDown} role="dialog" aria-modal="true" aria-labelledby="custom-field-editor-title" className="flex max-h-[min(90vh,52rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-slate-800 shadow-2xl" data-module-key={moduleKey}>
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-[#00ADFC]" aria-hidden="true" />
            <h2 id="custom-field-editor-title" className="text-base font-medium text-slate-900 normal-case">{initialField ? "Chỉnh sửa trường" : "Thêm trường"}</h2>
          </div>
          <button type="button" aria-label="Đóng" title="Đóng" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF1755] text-white transition-colors hover:bg-[#e9104b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1755] focus-visible:ring-offset-2" onClick={onClose}><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        <form onSubmit={(event) => void submit(event)} className="min-h-0 space-y-3 overflow-y-auto p-5">
          <label className="block space-y-1 text-xs font-normal text-slate-600 normal-case">Nhãn trường<input ref={labelInputRef} className={inputClass} value={form.label} onChange={(event) => set("label", event.target.value)} /></label>
          <label className="block space-y-1 text-xs font-normal text-slate-600 normal-case">Loại trường
            <StyledSelect
              value={form.type}
              ariaLabel="Loại trường"
              disabled={isStandard}
              options={DYNAMIC_FIELD_TYPES.map((type) => ({ value: type, label: typeLabels[type] }))}
              onChange={(value) => { const type = value as DynamicFieldType; setForm((current) => ({ ...current, type, defaultValue: defaultForType(type), maxFiles: "1" })); }}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1 text-xs font-normal text-slate-600 normal-case">Gợi ý<input className={inputClass} value={form.placeholder} onChange={(event) => set("placeholder", event.target.value)} /></label>
            {fileType ? <p className="self-end text-xs text-slate-500 py-2">Tệp không hỗ trợ giá trị mặc định.</p>
              : form.type === "checkbox" ? <label className="flex cursor-pointer items-center gap-2 self-end py-2 text-xs font-normal text-slate-600 normal-case"><input type="checkbox" className="h-4 w-4 rounded border-slate-200 text-cyan-600 focus:ring-cyan-600 focus:ring-opacity-20" checked={form.defaultValue === true} onChange={(event) => set("defaultValue", event.target.checked)} />Giá trị mặc định</label>
                : <label className="block space-y-1 text-xs font-normal text-slate-600 normal-case">Giá trị mặc định{form.type === "dateTime" ? <DateTimeInput24 value={typeof form.defaultValue === "string" ? form.defaultValue : ""} onChange={(value) => set("defaultValue", value)} className="mt-0 w-full" /> : <input type={["percent", "currency"].includes(form.type) ? "number" : "text"} className={inputClass} value={typeof form.defaultValue === "string" ? form.defaultValue : ""} onChange={(event) => set("defaultValue", event.target.value)} />}</label>}
          </div>
          <div className="flex gap-6"><label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-slate-600 normal-case"><input type="checkbox" className="h-4 w-4 rounded border-slate-200 text-cyan-600 focus:ring-cyan-600 focus:ring-opacity-20" checked={form.isVisible} onChange={(event) => setForm((current) => ({ ...current, isVisible: event.target.checked, isRequired: event.target.checked ? current.isRequired : false }))} />Hiển thị</label><label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-slate-600 normal-case"><input type="checkbox" className="h-4 w-4 rounded border-slate-200 text-cyan-600 focus:ring-cyan-600 focus:ring-opacity-20" checked={form.isRequired} disabled={!form.isVisible} onChange={(event) => set("isRequired", event.target.checked)} />Bắt buộc</label></div>
          {textType ? <div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-normal text-slate-700 normal-case">Dài tối thiểu<input type="number" className={inputClass} value={form.minLength} onChange={(e) => set("minLength", e.target.value)} /></label><label className="block text-xs font-normal text-slate-700 normal-case">Dài tối đa<input type="number" className={inputClass} value={form.maxLength} onChange={(e) => set("maxLength", e.target.value)} /></label></div> : null}
          {numericType ? <div className="grid gap-4 sm:grid-cols-3"><label className="block text-xs font-normal text-slate-700 normal-case">Giá trị nhỏ nhất<input type="number" className={inputClass} value={form.min} onChange={(e) => set("min", e.target.value)} /></label><label className="block text-xs font-normal text-slate-700 normal-case">Giá trị lớn nhất<input type="number" className={inputClass} value={form.max} onChange={(e) => set("max", e.target.value)} /></label><label className="block text-xs font-normal text-slate-700 normal-case">Số thập phân<input type="number" className={inputClass} value={form.decimals} onChange={(e) => set("decimals", e.target.value)} /></label></div> : null}
          {form.type === "dateTime" ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block space-y-1 text-xs font-normal text-slate-600 normal-case">Ngày giờ nhỏ nhất<DateTimeInput24 value={form.minDateTime} onChange={(value) => set("minDateTime", value)} className="mt-0 w-full" /></label><label className="block space-y-1 text-xs font-normal text-slate-600 normal-case">Ngày giờ lớn nhất<DateTimeInput24 value={form.maxDateTime} onChange={(value) => set("maxDateTime", value)} className="mt-0 w-full" /></label></div> : null}
          {fileType ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-normal text-slate-700 normal-case">Kích thước tối đa (MB)<input type="number" min="1" max="100" className={inputClass} value={form.maxSizeMb} onChange={(e) => set("maxSizeMb", e.target.value)} /></label>
              <label className="block text-xs font-normal text-slate-700 normal-case">Số tệp tối đa<input type="number" min="1" className={inputClass} value={form.maxFiles} onChange={(e) => set("maxFiles", e.target.value)} /></label>
            </div>
          ) : null}
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button
              type="submit"
              disabled={submitting}
              aria-label={submitting ? "Đang lưu trường" : "Lưu trường"}
              title={submitting ? "Đang lưu trường" : "Lưu trường"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#00ADFC] text-white transition-colors hover:bg-[#0095D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </form>
      </div>
      <NoticeDialog message={errors.length ? errors.join("\n") : null} onClose={() => setErrors([])} />
    </div>
  );
}
