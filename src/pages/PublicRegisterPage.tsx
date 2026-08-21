import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Loader2, Send, Trash2, UploadCloud, UserPlus } from "lucide-react";
import { toast } from "./Toast";
import { getApiErrorMessage } from "../utils/errorMessage";
import { ENTITY_LABEL_PRESETS, type EntityPreset } from "../modules/student-management/config/entityLabels";

interface IUploadedFile {
  name: string;
  url: string;
  type: string;
  uploadToken?: string;
}

/** Đúng shape mà GET /students/public-register-config trả về. */
interface IPublicField {
  key: string;
  label: string;
  placeholder?: string;
  isRequired: boolean;
  isVisible: boolean;
}

type FileField = "idCardFrontFile" | "idCardBackFile" | "portraitFile";

const FILE_FIELDS: { key: FileField; label: string }[] = [
  { key: "idCardFrontFile", label: "Ảnh CCCD mặt trước" },
  { key: "idCardBackFile", label: "Ảnh CCCD mặt sau" },
  { key: "portraitFile", label: "Ảnh chân dung" },
];

/** Trường ngày dùng input type="date", còn lại là text/email/tel. */
const DATE_FIELDS = new Set(["birthday", "enrollmentDate"]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function inputTypeFor(key: string): string {
  if (DATE_FIELDS.has(key)) return "date";
  if (key === "email") return "email";
  if (key === "phone") return "tel";
  return "text";
}

/** yyyy-mm-dd (giá trị của input type="date") -> dd/mm/yyyy như server yêu cầu. */
function toServerDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

function todayInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const inputClass =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 transition placeholder-slate-300";
const labelClass = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

export default function PublicRegisterPage() {
  const requestedPreset = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("entityPreset");
    return value === "worker" ? "worker" as const : null;
  }, []);
  const teacherId = useMemo(
    () => new URLSearchParams(window.location.search).get("teacherId") || "",
    [],
  );

  const [loading, setLoading] = useState(Boolean(teacherId));
  const [configError, setConfigError] = useState("");
  const [fields, setFields] = useState<IPublicField[]>([]);
  const [preset, setPreset] = useState<EntityPreset>(requestedPreset || "student");

  const [values, setValues] = useState<Record<string, string>>({ enrollmentDate: todayInputValue() });
  const [files, setFiles] = useState<Partial<Record<FileField, IUploadedFile>>>({});
  const [uploadingField, setUploadingField] = useState<FileField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const inputRefs = useRef<Partial<Record<FileField, HTMLInputElement | null>>>({});

  const entityLabel = ENTITY_LABEL_PRESETS[preset];

  useEffect(() => {
    if (!teacherId) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/v1/students/public-register-config?teacherId=${encodeURIComponent(teacherId)}`,
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json.ok === false || json.success === false) {
          const errorMsg = typeof json.error === "string"
            ? json.error
            : json.error?.message || json.message || "Không tải được biểu mẫu.";
          throw new Error(errorMsg);
        }
        if (cancelled) return;
        setFields((json.data.fields as IPublicField[]).filter((field) => field.isVisible));
        setPreset(requestedPreset || json.data.entityPreset as EntityPreset);
      } catch (error) {
        if (!cancelled) setConfigError(getApiErrorMessage(error, "Không tải được biểu mẫu."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requestedPreset, teacherId]);

  const handleUpload = async (field: FileField, file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Tệp "${file.name}" vượt quá giới hạn 10MB.`);
      return;
    }
    setUploadingField(field);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        `/api/v1/students/public-register-upload?teacherId=${encodeURIComponent(teacherId)}`,
        { method: "POST", body },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.ok === false || json.success === false || !json.data?.url) {
        const errorMsg = typeof json.error === "string"
          ? json.error
          : json.error?.message || json.message || "Tải ảnh lên thất bại.";
        throw new Error(errorMsg);
      }
      setFiles((prev) => ({ ...prev, [field]: json.data as IUploadedFile }));
      toast.success("Đã tải ảnh lên.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tải ảnh lên thất bại.");
    } finally {
      setUploadingField(null);
      const input = inputRefs.current[field];
      if (input) input.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { teacherId };
      fields.forEach((field) => {
        const raw = (values[field.key] || "").trim();
        payload[field.key] = DATE_FIELDS.has(field.key) ? toServerDate(raw) : raw;
      });
      FILE_FIELDS.forEach(({ key }) => {
        if (files[key]) payload[key] = files[key];
      });

      const response = await fetch("/api/v1/students/public-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.ok === false || json.success === false) {
        const errorMsg = typeof json.error === "string"
          ? json.error
          : json.error?.message || json.message || "Đăng ký thất bại.";
        throw new Error(errorMsg);
      }
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đăng ký thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
        <p className="mt-4 text-xs font-semibold text-slate-400">Đang tải biểu mẫu...</p>
      </div>
    );
  }

  if (!teacherId || configError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-xl sm:p-8">
          <AlertTriangle className="mx-auto mb-4 h-14 w-14 text-rose-500" />
          <h2 className="text-base font-bold text-slate-800">Không mở được biểu mẫu</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {configError || "Liên kết đăng ký thiếu mã người phụ trách. Vui lòng liên hệ trung tâm để nhận lại liên kết chính xác."}
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-xl sm:p-8">
          <CheckCircle className="mx-auto mb-4 h-14 w-14 text-emerald-500" />
          <h2 className="text-base font-bold text-slate-800">Đăng ký thành công!</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Hồ sơ của bạn đã được ghi nhận. Chúng tôi sẽ liên hệ với bạn qua số điện thoại đã đăng ký trong thời gian sớm nhất.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <UserPlus className="h-4.5 w-4.5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Đăng ký {entityLabel.singular.toLowerCase()}</h1>
            <p className="text-[11px] font-medium text-slate-400">
              Điền đầy đủ thông tin bên dưới, hồ sơ sẽ được gửi thẳng tới trung tâm.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key} className={field.key === "address" ? "sm:col-span-2" : undefined}>
                <label className={labelClass}>
                  {field.label}
                  {field.isRequired && <span className="ml-0.5 text-rose-500">*</span>}
                </label>
                <input
                  type={inputTypeFor(field.key)}
                  required={field.isRequired}
                  value={values[field.key] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder || ""}
                  maxLength={field.key === "idCard" ? 12 : undefined}
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <div>
            <label className={labelClass}>Hồ sơ ảnh</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FILE_FIELDS.map(({ key, label }) => {
                const uploaded = files[key];
                const isUploading = uploadingField === key;
                return (
                  <div
                    key={key}
                    onClick={() => !isUploading && inputRefs.current[key]?.click()}
                    className={`flex cursor-pointer select-none flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
                      uploaded
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-slate-200 bg-white hover:border-cyan-400 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      ref={(el) => { inputRefs.current[key] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload(key, file);
                      }}
                    />
                    {isUploading ? (
                      <Loader2 className="mb-1.5 h-5 w-5 animate-spin text-cyan-600" />
                    ) : uploaded ? (
                      <CheckCircle className="mb-1.5 h-5 w-5 text-emerald-600" />
                    ) : (
                      <UploadCloud className="mb-1.5 h-5 w-5 text-cyan-600" />
                    )}
                    <span className="text-[11px] font-bold text-slate-700">{label}</span>
                    <span className="mt-0.5 max-w-full truncate text-[10px] text-slate-400">
                      {isUploading ? "Đang tải lên..." : uploaded ? uploaded.name : "JPG/PNG, tối đa 10MB"}
                    </span>
                    {uploaded && !isUploading && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles((prev) => ({ ...prev, [key]: undefined }));
                        }}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3 w-3" /> Xóa
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={submitting || uploadingField !== null}
              className="flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[11px] font-bold text-white shadow-md shadow-cyan-100 transition-all hover:bg-brand-primary/95 active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Gửi đăng ký
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
