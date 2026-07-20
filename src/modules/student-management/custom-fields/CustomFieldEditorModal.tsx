import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
const inputClass = "w-full px-4 py-2 mt-1 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all";

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

function parsedOptions(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [label, ...rest] = line.split("|");
    return { label: label.trim(), value: rest.join("|").trim() };
  });
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
    if (["text", "email", "phone", "url"].includes(form.type)) validation = { minLength: numberOrUndefined(form.minLength), maxLength: numberOrUndefined(form.maxLength) };
    if (["percent", "currency"].includes(form.type)) validation = { min: numberOrUndefined(form.min), max: numberOrUndefined(form.max), decimals: numberOrUndefined(form.decimals) };
    if (form.type === "dateTime") validation = { minDateTime: form.minDateTime || undefined, maxDateTime: form.maxDateTime || undefined };
    if (["file", "image"].includes(form.type)) validation = { maxSizeMb: createMaxSizeMb(Number(form.maxSizeMb)), maxFiles: Number(form.maxFiles), allowedMimeTypes: form.allowedMimeTypes.split(",").map((item) => item.trim()).filter(Boolean) };
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

  const textType = ["text", "email", "phone", "url"].includes(form.type);
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
    if (event.key === "Enter" && !event.shiftKey && (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
      void submit();
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <div ref={dialogRef} onKeyDown={handleKeyDown} role="dialog" aria-modal="true" aria-labelledby="custom-field-editor-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" data-module-key={moduleKey}>
        <div className="flex items-center justify-between"><h2 id="custom-field-editor-title" className="text-sm font-bold text-slate-900 uppercase tracking-wider">{initialField ? "Chỉnh sửa trường" : "Thêm trường"}</h2><button type="button" aria-label="Đóng" className="text-slate-400 hover:text-slate-600 transition-colors text-lg" onClick={onClose}>×</button></div>
        <div className="mt-5 space-y-4">
          {errors.length ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
          <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Nhãn trường<input ref={labelInputRef} className={inputClass} value={form.label} onChange={(event) => set("label", event.target.value)} /></label>
          <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Loại trường<select className={inputClass} value={form.type} disabled={isStandard} onChange={(event) => { const type = event.target.value as DynamicFieldType; setForm((current) => ({ ...current, type, defaultValue: defaultForType(type), maxFiles: "1" })); }}>{DYNAMIC_FIELD_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Gợi ý<input className={inputClass} value={form.placeholder} onChange={(event) => set("placeholder", event.target.value)} /></label>
            {fileType ? <p className="self-end text-xs text-slate-500 py-2">Tệp không hỗ trợ giá trị mặc định.</p>
              : form.type === "checkbox" ? <label className="flex items-center gap-2 self-end py-2 text-[10px] font-bold text-slate-800 uppercase tracking-wider cursor-pointer"><input type="checkbox" className="h-4 w-4 rounded border-slate-200 text-cyan-600 focus:ring-cyan-600 focus:ring-opacity-20" checked={form.defaultValue === true} onChange={(event) => set("defaultValue", event.target.checked)} />Giá trị mặc định</label>
                : <label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Giá trị mặc định<input type={["percent", "currency"].includes(form.type) ? "number" : form.type === "dateTime" ? "datetime-local" : "text"} className={inputClass} value={typeof form.defaultValue === "string" ? form.defaultValue : ""} onChange={(event) => set("defaultValue", event.target.value)} /></label>}
          </div>
          <div className="flex gap-6"><label className="flex items-center gap-2 text-[10px] font-bold text-slate-800 uppercase tracking-wider cursor-pointer"><input type="checkbox" className="h-4 w-4 rounded border-slate-200 text-cyan-600 focus:ring-cyan-600 focus:ring-opacity-20" checked={form.isVisible} onChange={(event) => setForm((current) => ({ ...current, isVisible: event.target.checked, isRequired: event.target.checked ? current.isRequired : false }))} />Hiển thị</label><label className="flex items-center gap-2 text-[10px] font-bold text-slate-800 uppercase tracking-wider cursor-pointer"><input type="checkbox" className="h-4 w-4 rounded border-slate-200 text-cyan-600 focus:ring-cyan-600 focus:ring-opacity-20" checked={form.isRequired} disabled={!form.isVisible} onChange={(event) => set("isRequired", event.target.checked)} />Bắt buộc</label></div>
          {textType ? <div className="grid gap-4 sm:grid-cols-2"><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Dài tối thiểu<input type="number" className={inputClass} value={form.minLength} onChange={(e) => set("minLength", e.target.value)} /></label><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Dài tối đa<input type="number" className={inputClass} value={form.maxLength} onChange={(e) => set("maxLength", e.target.value)} /></label></div> : null}
          {numericType ? <div className="grid gap-4 sm:grid-cols-3"><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Giá trị nhỏ nhất<input type="number" className={inputClass} value={form.min} onChange={(e) => set("min", e.target.value)} /></label><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Giá trị lớn nhất<input type="number" className={inputClass} value={form.max} onChange={(e) => set("max", e.target.value)} /></label><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Số thập phân<input type="number" className={inputClass} value={form.decimals} onChange={(e) => set("decimals", e.target.value)} /></label></div> : null}
          {form.type === "dateTime" ? <div className="grid grid-cols-2 gap-4"><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Ngày giờ nhỏ nhất<input type="datetime-local" className={inputClass} value={form.minDateTime} onChange={(e) => set("minDateTime", e.target.value)} /></label><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Ngày giờ lớn nhất<input type="datetime-local" className={inputClass} value={form.maxDateTime} onChange={(e) => set("maxDateTime", e.target.value)} /></label></div> : null}
          {fileType ? <div className="grid gap-4 sm:grid-cols-3"><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Kích thước tối đa (MB)<input type="number" min="1" max="100" className={inputClass} value={form.maxSizeMb} onChange={(e) => set("maxSizeMb", e.target.value)} /></label><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Số tệp tối đa<input type="number" min="1" className={inputClass} value={form.maxFiles} onChange={(e) => set("maxFiles", e.target.value)} /></label><label className="block text-[10px] font-bold text-slate-800 uppercase tracking-wider">Loại File cho phép<input className={inputClass} placeholder="image/png, image/jpeg" value={form.allowedMimeTypes} onChange={(e) => set("allowedMimeTypes", e.target.value)} /></label></div> : null}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-50 flex-shrink-0">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-cyan-600 text-xs font-bold text-white hover:bg-cyan-700 transition-colors disabled:opacity-50"
              onClick={() => void submit()}
            >
              {submitting ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
