import { useId, useState, type ChangeEvent } from "react";
import type { CustomFieldValue, FieldDefinition, FileMetadata } from "./types";
import { uploadCustomFieldFile } from "./api";

export type CustomFieldRendererProps = {
  field: FieldDefinition;
  value: CustomFieldValue | undefined;
  onChange(value: CustomFieldValue): void;
  error?: string;
  disabled?: boolean;
};

const inputClass = "w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all text-slate-800 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-default";

function acceptsMime(file: File, allowed?: string[]): boolean {
  if (!allowed?.length) return true;
  return allowed.some((mime) => mime === file.type || (mime.endsWith("/*") && file.type.startsWith(mime.slice(0, -1))));
}

export function CustomFieldRenderer({ field, value, onChange, error, disabled = false }: CustomFieldRendererProps) {
  const fieldType = field.type as string;
  const generatedId = useId();
  const inputId = `custom-field-${field.key}-${generatedId.replace(/:/g, "")}`;
  const errorId = `${inputId}-error`;
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const validation = field.validation as Record<string, unknown> | undefined;
  const describedBy = error || uploadError ? errorId : undefined;
  const common = {
    id: inputId,
    name: field.key,
    disabled,
    required: field.isRequired,
    "aria-invalid": Boolean(error || uploadError),
    "aria-describedby": describedBy,
  };

  const upload = async (files: File[]) => {
    setUploadError(null);
    const allowedMimeTypes = validation?.allowedMimeTypes as string[] | undefined;
    const maxSizeMb = Number(validation?.maxSizeMb ?? 100);
    const maxFiles = Number(validation?.maxFiles ?? (fieldType === "multiImage" ? Number.POSITIVE_INFINITY : 1));
    const currentFiles = fieldType === "multiImage" && Array.isArray(value) ? value.length : 0;
    if (files.length + currentFiles > maxFiles) {
      setPendingFiles(files);
      setUploadError(`Chỉ được tải tối đa ${maxFiles} tệp.`);
      return;
    }
    const invalidMime = files.find((file) => !acceptsMime(file, allowedMimeTypes));
    if (invalidMime) {
      setPendingFiles(files);
      setUploadError(`Loại tệp ${invalidMime.type || invalidMime.name} không được cho phép.`);
      return;
    }
    const oversized = files.find((file) => file.size > maxSizeMb * 1024 * 1024);
    if (oversized) {
      setPendingFiles(files);
      setUploadError(`Tệp ${oversized.name} vượt quá ${maxSizeMb} MB.`);
      return;
    }

    setUploading(true);
    setPendingFiles(files);
    try {
      const metadata = await Promise.all(files.map(async (file): Promise<FileMetadata> => {
        return uploadCustomFieldFile(field, file);
      }));
      if (fieldType === "multiImage") {
        const current = Array.isArray(value) ? value.filter((item): item is FileMetadata => typeof item === "object" && item !== null && "url" in item) : [];
        onChange([...current, ...metadata]);
      } else {
        onChange(metadata[0] ?? null);
      }
      setPendingFiles(null);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : "Tải tệp thất bại.");
    } finally {
      setUploading(false);
    }
  };

  const stringValue = typeof value === "string" || typeof value === "number" ? String(value) : "";
  let control;

  switch (fieldType) {
    case "longText":
      control = <textarea {...common} className={inputClass} placeholder={field.placeholder} value={stringValue} minLength={validation?.minLength as number | undefined} maxLength={validation?.maxLength as number | undefined} onChange={(event) => onChange(event.target.value)} />;
      break;
    case "singleSelect":
      control = <select {...common} className={inputClass} value={stringValue} onChange={(event) => onChange(event.target.value)}><option value="">-- Chọn --</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
      break;
    case "multiSelect": {
      const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      control = <select {...common} multiple className={inputClass} value={selected} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(Array.from(event.currentTarget.selectedOptions as HTMLCollectionOf<HTMLOptionElement>).map((option) => option.value))}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
      break;
    }
    case "checkbox":
    case "switch":
      control = <input {...common} className="h-4 w-4 rounded border-slate-200 text-cyan-600 focus:ring-cyan-600 focus:ring-opacity-20 cursor-pointer" role={fieldType === "switch" ? "switch" : undefined} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />;
      break;
    case "file":
    case "image":
    case "multiImage":
      control = <input {...common} className={`${inputClass} file:mr-4 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer`} type="file" accept={(validation?.allowedMimeTypes as string[] | undefined)?.join(",") ?? (fieldType === "image" || fieldType === "multiImage" ? "image/*" : undefined)} multiple={fieldType === "multiImage"} onChange={(event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.currentTarget.files ?? []) as File[]; if (files.length) void upload(files); }} />;
      break;
    default: {
      const inputTypes: Record<string, string> = {
        email: "email", phone: "tel", url: "url", number: "number", percent: "number", currency: "number",
        date: "date", time: "time", dateTime: "datetime-local", text: "text",
        shortText: "text",
      };
      const isNumeric = fieldType === "number" || fieldType === "percent" || fieldType === "currency";
      const dateMin = fieldType === "date" ? validation?.minDate : fieldType === "time" ? validation?.minTime : fieldType === "dateTime" ? validation?.minDateTime : validation?.min;
      const dateMax = fieldType === "date" ? validation?.maxDate : fieldType === "time" ? validation?.maxTime : fieldType === "dateTime" ? validation?.maxDateTime : validation?.max;
      const decimals = Number(validation?.decimals ?? 0);
      control = <input {...common} className={inputClass} type={inputTypes[fieldType] ?? "text"} placeholder={field.placeholder} value={stringValue} min={dateMin as string | number | undefined} max={dateMax as string | number | undefined} step={isNumeric ? (decimals > 0 ? 10 ** -decimals : fieldType === "percent" ? "any" : 1) : undefined} minLength={validation?.minLength as number | undefined} maxLength={validation?.maxLength as number | undefined} pattern={validation?.pattern as string | undefined} onChange={(event) => onChange(isNumeric ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value)} />;
    }
  }

  const checkboxLike = fieldType === "checkbox" || fieldType === "switch";
  return (
    <div className="space-y-1" data-custom-field={field.key}>
      <label className={`text-[10px] font-bold text-slate-800 uppercase tracking-wider ${checkboxLike ? "flex items-center gap-2" : "block"}`} htmlFor={inputId}>
        {checkboxLike && control}
        <span>{field.label}{field.isRequired ? <span aria-hidden="true" className="ml-1 text-rose-500">*</span> : null}</span>
      </label>
      {!checkboxLike && control}
      {uploading ? <p aria-live="polite" className="text-xs text-slate-500">Đang tải lên…</p> : null}
      {error || uploadError ? <div id={errorId} role="alert" className="flex items-center gap-2 text-xs text-red-600"><span>{error ?? uploadError}</span>{uploadError && pendingFiles ? <button type="button" className="underline" onClick={() => void upload(pendingFiles)}>Thử lại</button> : null}</div> : null}
    </div>
  );
}
