import type { CustomFieldValue, CustomFieldValues, FieldDefinition, FileMetadata, ModuleKey } from "./types";
import { useCustomFields } from "./useCustomFields";

export type CustomFieldDetailsProps = { moduleKey: ModuleKey; values: CustomFieldValues };

function safeUrl(value: string): string | null {
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isEmpty(value: CustomFieldValue | undefined): boolean {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function fileLink(file: FileMetadata, image = false) {
  const href = safeUrl(file.url);
  if (!href) return <span>{file.fileName}</span>;
  return image
    ? <a href={href} target="_blank" rel="noopener noreferrer"><img className="h-20 w-20 rounded-lg border border-slate-200 object-cover" src={href} alt={file.fileName} /></a>
    : <a className="text-blue-600 underline" href={href} target="_blank" rel="noopener noreferrer">{file.fileName}</a>;
}

function formatValue(field: FieldDefinition, value: CustomFieldValue | undefined) {
  if (isEmpty(value)) return "Chưa cập nhật";
  const fieldType = field.type as string;
  if (fieldType === "checkbox" || fieldType === "switch") return value === true ? "Có" : "Không";
  if (fieldType === "number" || fieldType === "percent" || fieldType === "currency") {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    if (fieldType === "currency") return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(number);
    return `${new Intl.NumberFormat("vi-VN").format(number)}${fieldType === "percent" ? "%" : ""}`;
  }
  if (fieldType === "date" || fieldType === "dateTime") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("vi-VN", fieldType === "dateTime" ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
  }
  if (fieldType === "singleSelect") return field.options?.find((option) => option.value === value)?.label ?? String(value);
  if (fieldType === "multiSelect" && Array.isArray(value)) {
    return value.map((selected) => field.options?.find((option) => option.value === selected)?.label ?? String(selected)).join(", ");
  }
  if (fieldType === "url" && typeof value === "string") {
    const href = safeUrl(value);
    return href ? <a className="text-blue-600 underline" href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value;
  }
  if ((fieldType === "file" || fieldType === "image") && value && !Array.isArray(value) && typeof value === "object" && "url" in value) {
    return fileLink(value as FileMetadata, fieldType === "image");
  }
  if (fieldType === "multiImage" && Array.isArray(value)) {
    return <div className="flex flex-wrap gap-2">{value.map((item, index) => typeof item === "object" && item !== null && "url" in item ? <span key={`${item.url}-${index}`}>{fileLink(item as FileMetadata, true)}</span> : null)}</div>;
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function CustomFieldDetails({ moduleKey, values }: CustomFieldDetailsProps) {
  const { fields, loading, error, refresh } = useCustomFields(moduleKey);
  const visible = [...fields].filter((field) => field.isVisible && !field.isArchived).sort((left, right) => left.order - right.order);
  return (
    <div className="space-y-3">
      {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" className="font-semibold underline" onClick={() => void refresh()}>Thử lại</button></div> : null}
      {loading && !fields.length ? <p aria-live="polite" className="text-sm text-slate-500">Đang tải thông tin bổ sung…</p> : null}
      {visible.length ? <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visible.map((field) => <div key={field.id} className="rounded-lg border border-slate-200 p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{formatValue(field, values[field.key])}</dd></div>)}
      </dl> : null}
    </div>
  );
}
