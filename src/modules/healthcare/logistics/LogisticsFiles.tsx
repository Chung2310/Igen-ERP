import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, Upload } from "lucide-react";
import { DateInput24 } from "../../../components/common/TimeInput24";
import type { HealthcareApi } from "../api";
import type {
  Attachment,
  LogisticsKind,
} from "../../../../shared/healthcare-logistics";
import { buttonClass, Feedback, Field, messageOf } from "../ui";

const compactToolButtonClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export function LogisticsFiles({
  api,
  kind,
  canManage,
  onSaved,
}: {
  api: HealthcareApi;
  kind: LogisticsKind | "documents";
  canManage: boolean;
  onSaved: () => void;
}) {
  const menuId = useId();
  const input = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function exportFile(template = false) {
    setOpen(false);
    setBusy(true);
    setError("");
    try {
      const blob = await api.blob(
        `/logistics/files/${kind}/export${template ? "?template=true" : ""}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    setOpen(false);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await api.json<{ imported: number }>(
        `/logistics/files/${kind}/import`,
        { method: "POST", body },
      );
      setNotice(`Đã nhập ${result.imported} bản ghi.`);
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (kind === "documents") {
    return (
      <div className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          className={compactToolButtonClass}
          disabled={busy}
          onClick={() => void exportFile()}
        >
          <Download className="size-3.5 text-on-surface-variant" aria-hidden="true" />
          Xuất Excel
        </button>
        {error && <Feedback error={error} />}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative inline-flex flex-col items-end gap-1">
      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv"
        aria-label="File nhập danh mục"
        className="hidden"
        onChange={(event) => void importFile(event.target.files?.[0])}
      />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={compactToolButtonClass}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        <FileSpreadsheet className="size-3.5 text-primary" aria-hidden="true" />
        <span>{busy ? "Đang xử lý…" : "Excel"}</span>
        <ChevronDown className="size-3.5 text-on-surface-variant" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:bg-surface-container focus-visible:outline-none"
            onClick={() => void exportFile()}
          >
            <Download className="size-3.5 text-on-surface-variant" aria-hidden="true" />
            Xuất Excel
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:bg-surface-container focus-visible:outline-none"
            onClick={() => void exportFile(true)}
          >
            <FileSpreadsheet className="size-3.5 text-on-surface-variant" aria-hidden="true" />
            Tải mẫu Excel
          </button>
          {canManage && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:bg-surface-container focus-visible:outline-none"
              onClick={() => {
                setOpen(false);
                input.current?.click();
              }}
            >
              <Upload className="size-3.5 text-on-surface-variant" aria-hidden="true" />
              Nhập Excel
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="text-xs font-medium text-primary">
          {notice}
        </p>
      )}
      {error && <Feedback error={error} />}
    </div>
  );
}
export function AttachmentFields({
  documents,
  onChange,
  equipment = false,
}: {
  documents: Attachment[];
  onChange: (rows: Attachment[]) => void;
  equipment?: boolean;
}) {
  return (
    <fieldset className="space-y-3 border-t border-outline-variant pt-3">
      <legend className="text-sm font-medium">Hồ sơ đính kèm</legend>
      {documents.map((row, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-2">
          <Field
            label={`Tên tài liệu ${index + 1}`}
            name={`attachment-name-${index}`}
            value={row.name}
            required
            onChange={(e) =>
              onChange(
                documents.map((item, i) =>
                  i === index ? { ...item, name: e.target.value } : item,
                ),
              )
            }
          />
          <Field
            label={`Liên kết HTTPS ${index + 1}`}
            type="url"
            name={`attachment-url-${index}`}
            value={row.url}
            required
            onChange={(e) =>
              onChange(
                documents.map((item, i) =>
                  i === index ? { ...item, url: e.target.value } : item,
                ),
              )
            }
          />
          {(
            [
              ["type", "Loại hồ sơ"],
              ["number", "Số văn bản"],
              ["authority", "Cơ quan cấp"],
              ["issuedDay", "Ngày cấp"],
              ["expiryDay", "Ngày hết hạn"],
              ...(equipment ? ([["notes", "Ghi chú hồ sơ"]] as const) : []),
            ] as const
          ).map(([key, label]) =>
            key.endsWith("Day") ? (
              <div key={key} className="space-y-1">
                <span className="text-sm font-medium">
                  {label} {index + 1}
                </span>
                <DateInput24
                  ariaLabel={`${label} ${index + 1}`}
                  value={row[key] || ""}
                  onChange={(value) =>
                    onChange(
                      documents.map((item, i) =>
                        i === index ? { ...item, [key]: value } : item,
                      ),
                    )
                  }
                />
              </div>
            ) : (
              <Field
                key={key}
                name={`attachment-${key}-${index}`}
                label={`${label} ${index + 1}`}
                type={key.endsWith("Day") ? "date" : "text"}
                value={row[key] || ""}
                options={
                  key === "type" && equipment
                    ? [
                        { value: "", label: "Chọn loại hồ sơ" },
                        { value: "co_cq", label: "Giấy chứng nhận CO/CQ" },
                        { value: "invoice", label: "Hóa đơn mua sắm" },
                        {
                          value: "import_license",
                          label: "Giấy phép nhập khẩu",
                        },
                        {
                          value: "circulation_license",
                          label: "Giấy phép lưu hành",
                        },
                        {
                          value: "calibration_cert",
                          label: "Giấy chứng nhận kiểm định",
                        },
                        { value: "manual", label: "Tài liệu kỹ thuật" },
                        { value: "other", label: "Tài liệu khác" },
                      ]
                    : undefined
                }
                onSelectChange={
                  key === "type" && equipment
                    ? (value) =>
                        onChange(
                          documents.map((item, i) =>
                            i === index ? { ...item, type: value } : item,
                          ),
                        )
                    : undefined
                }
                onChange={(e) =>
                  onChange(
                    documents.map((item, i) =>
                      i === index ? { ...item, [key]: e.target.value } : item,
                    ),
                  )
                }
              />
            ),
          )}
          <button
            type="button"
            className={buttonClass}
            onClick={() => onChange(documents.filter((_, i) => i !== index))}
          >
            Bỏ tài liệu {index + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className={buttonClass}
        disabled={documents.length >= 30}
        onClick={() => onChange([...documents, { name: "", url: "" }])}
      >
        Thêm liên kết tài liệu
      </button>
    </fieldset>
  );
}
export function AttachmentUpload({
  api,
  kind,
  id,
  onSaved,
  image = false,
}: {
  api: HealthcareApi;
  kind: LogisticsKind;
  id: string;
  image?: boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        {image
          ? "Chọn / chụp ảnh đại diện (PNG, JPEG, tối đa 3 MB)"
          : "Tải hồ sơ PDF, PNG, JPEG (tối đa 3 MB)"}
        <input
          type="file"
          accept={image ? "image/png,image/jpeg" : ".pdf,.png,.jpg,.jpeg"}
          capture={image ? "environment" : undefined}
          disabled={busy}
          className="mt-2 block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const element = event.target;
            const body = new FormData();
            body.set("file", file);
            if (image) body.set("image", "true");
            setBusy(true);
            setError("");
            void api
              .json(`/logistics/files/${kind}/${id}/attachment`, {
                method: "POST",
                body,
              })
              .then(onSaved)
              .catch((err) => setError(messageOf(err)))
              .finally(() => {
                setBusy(false);
                element.value = "";
              });
          }}
        />
      </label>
      <Feedback loading={busy} error={error} />
    </div>
  );
}
