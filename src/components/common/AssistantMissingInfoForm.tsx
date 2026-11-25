import { useId, useState, type FormEvent } from "react";
import type { AssistantInputForm, AssistantInputField, AssistantReferenceSelection, AssistantValue, AssistantWorkflowSelection } from "../../shared/assistant-workflow";
import { cn } from "../../modules/student-management/lib/utils";
import { StyledSelect } from "./StyledSelect";

const inputClass = "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const buttonClass = "min-h-10 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi");
function initialValue(field: AssistantInputField) {
  if (field.value === undefined) return "";
  if (field.type === "datetime") {
    const date = new Date(String(field.value));
    if (Number.isFinite(date.valueOf())) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map(part => [part.type, part.value]));
      return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    }
  }
  return String(field.value);
}

export function AssistantWorkflowSelectionForm({ selection, disabled, onSubmit }: {
  selection: AssistantWorkflowSelection; disabled: boolean; onSubmit: (value: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const moduleChoice = selection.kind === "module";
  return <form aria-labelledby={`${id}-title`} className="max-w-4xl space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface sm:p-4" onSubmit={event => { event.preventDefault(); if (!disabled && value) onSubmit(value); }}>
    <h3 id={`${id}-title`} className="text-balance font-semibold">{moduleChoice ? "Chọn phân hệ" : "Chọn thao tác"}</h3>
    <StyledSelect value={value} options={selection.options} onChange={setValue} ariaLabel={moduleChoice ? "Phân hệ cần xử lý" : "Thao tác muốn thực hiện"} placeholder={moduleChoice ? "Chọn phân hệ cần xử lý" : "Chọn thao tác muốn thực hiện"} required disabled={disabled} describedBy={`${id}-help`} />
    <p id={`${id}-help`} className="text-pretty text-xs text-on-surface-variant">{moduleChoice ? "Chọn nơi bạn muốn xử lý yêu cầu. Bạn sẽ kiểm tra lại trước khi thực hiện." : "Chọn để mở các thông tin cần bổ sung. Bạn sẽ kiểm tra lại trước khi thực hiện."}</p>
    <button type="submit" disabled={disabled || !value} aria-describedby={`${id}-help`} className={buttonClass}>Tiếp tục</button>
  </form>;
}

interface Props {
  form?: AssistantInputForm;
  groups: AssistantReferenceSelection[];
  selected: Record<string, string[]>;
  searches: Record<string, string>;
  onSelect: (key: string, value: string, checked: boolean, multiple: boolean) => void;
  onSearch: (key: string, value: string) => void;
  disabled: boolean;
  submitting: boolean;
  error?: string;
  onSubmit: (values: Record<string, AssistantValue>) => void;
}
export function AssistantMissingInfoForm({ form, groups, selected, searches, onSelect, onSearch, disabled, submitting, error, onSubmit }: Props) {
  const id = useId();
  const fields = form?.fields || [];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(field => [field.key, initialValue(field)])));
  const missing = fields.some(field => field.required && !values[field.key]?.trim()) || groups.some(group => group.required && !selected[group.key]?.length);
  const unchangedError = fields.some(field => field.error && values[field.key] === initialValue(field));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || missing || unchangedError || !event.currentTarget.reportValidity()) return;
    const result = Object.fromEntries(fields.flatMap(field => {
      const raw = values[field.key] || "";
      if (!raw.trim()) return [];
      const value = field.type === "number" ? Number(raw) : field.type === "boolean" ? raw === "true" : field.type === "datetime" ? `${raw}${raw.length === 16 ? ":00" : ""}+07:00` : raw;
      return [[field.key, value]];
    }));
    onSubmit(result);
  };
  return <form aria-labelledby={`${id}-title`} aria-busy={submitting} className="max-w-4xl space-y-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface sm:p-4" onSubmit={submit}>
    <header>
      <h3 id={`${id}-title`} className="text-balance font-semibold">Bổ sung thông tin</h3>
      <p className="mt-1 text-pretty text-xs text-on-surface-variant">Nhập hoặc chọn ngay bên dưới. Mục tùy chọn có thể bỏ qua.</p>
    </header>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((field, index) => {
        const fieldId = `${id}-field-${index}`;
        const fieldError = field.error && values[field.key] === initialValue(field) ? field.error : "";
        return <div key={field.key} className="min-w-0 space-y-1.5">
          <label htmlFor={field.type === "boolean" ? undefined : fieldId} className="block text-pretty font-medium">{field.label}<span aria-hidden="true" className="ml-2 text-xs font-normal text-on-surface-variant">{field.required ? "Bắt buộc" : "Tùy chọn"}</span></label>
          {field.type === "boolean" ? <StyledSelect value={values[field.key] || ""} onChange={value => setValues(current => ({ ...current, [field.key]: value }))} ariaLabel={field.label} options={[{ value: "true", label: "Có" }, { value: "false", label: "Không" }]} placeholder="Chọn một mục" required={field.required} disabled={disabled} describedBy={fieldError ? `${fieldId}-error` : undefined} />
            : <input id={fieldId} name={field.key} type={field.type === "phone" ? "tel" : field.type === "datetime" ? "datetime-local" : field.type} value={values[field.key] || ""} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} required={field.required} disabled={disabled}
              min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined} step={field.type === "number" ? field.integer ? 1 : "any" : undefined} maxLength={field.type === "number" ? undefined : field.max} pattern={field.pattern}
              aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${fieldId}-error` : undefined} className={cn(inputClass, field.type === "number" && "tabular-nums")} />}
          {fieldError && <p id={`${fieldId}-error`} role="alert" className="rounded-md bg-error-container px-2 py-1 text-pretty text-xs text-on-error-container">{fieldError}</p>}
        </div>;
      })}
    </div>
    {groups.map((group, index) => {
      const search = searches[group.key] || "";
      const visible = search.trim() ? group.options.filter(option => normalize(option.label).includes(normalize(search.trim()))) : group.options;
      const labels = (selected[group.key] || []).map(value => group.options.find(option => option.value === value)?.label).filter(Boolean);
      return <fieldset key={group.key} className="min-w-0 space-y-2" disabled={disabled}>
        <legend className="mb-1.5 text-pretty font-medium">{group.label}<span className="ml-2 text-xs font-normal text-on-surface-variant">{group.required ? "Bắt buộc" : "Tùy chọn"}{group.multiple ? " · Có thể chọn nhiều" : ""}</span></legend>
        {group.options.length > 8 && <label className="block space-y-1 text-xs text-on-surface-variant"><span>Tìm trong danh sách {group.label.toLocaleLowerCase("vi")}</span><input type="search" value={search} onChange={event => onSearch(group.key, event.target.value)} className={inputClass} placeholder="Nhập tên hoặc mã để lọc" /></label>}
        {!group.multiple ? <StyledSelect value={selected[group.key]?.[0] || ""} options={[...(!group.required ? [{ value: "", label: "Bỏ qua" }] : []), ...visible]} onChange={value => onSelect(group.key, value, Boolean(value), false)} ariaLabel={group.label} placeholder={`Chọn ${group.label.toLocaleLowerCase("vi")}`} required={group.required} disabled={disabled} describedBy={missing ? `${id}-help` : undefined} />
          : <ul className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">
            {visible.map((option, optionIndex) => <li key={option.value}>
              <label htmlFor={`${id}-reference-${index}-${optionIndex}`} className={cn("flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 hover:bg-surface-container-low focus-within:border-primary", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                <input id={`${id}-reference-${index}-${optionIndex}`} type="checkbox" checked={Boolean(selected[group.key]?.includes(option.value))} onChange={event => onSelect(group.key, option.value, event.target.checked, true)} className="size-4 shrink-0 accent-primary" aria-describedby={missing ? `${id}-help` : undefined} />
                <span className="min-w-0 break-words text-pretty">{option.label}</span>
              </label>
            </li>)}
          </ul>}
        {search.trim() && <p role="status" className="text-pretty text-xs text-on-surface-variant">{visible.length ? `${visible.length} lựa chọn phù hợp.` : "Không tìm thấy lựa chọn. Thử tên hoặc mã khác nhé."}</p>}
        {labels.length > 0 && <p role="status" className="break-words text-pretty text-xs text-on-surface-variant">Đang chọn: {labels.join(", ")}</p>}
      </fieldset>;
    })}
    {error && <p role="alert" className="rounded-md bg-error-container px-2 py-1 text-pretty text-sm text-on-error-container">{error}</p>}
    <p id={`${id}-help`} role="status" className="text-pretty text-xs text-on-surface-variant">{submitting ? "Đang kiểm tra thông tin…" : disabled ? "Biểu mẫu hiện chỉ để xem hoặc đang chờ kết nối." : unchangedError ? "Sửa thông tin đang báo lỗi để tiếp tục." : missing ? "Bổ sung các mục bắt buộc để tiếp tục." : "Thông tin sẽ được kiểm tra trước khi thực hiện."}</p>
    <button type="submit" disabled={disabled || missing || unchangedError} aria-describedby={`${id}-help`} className={buttonClass}>Tiếp tục</button>
  </form>;
}
