import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Send,
  Trash2,
  UploadCloud,
  UserPlus,
} from "lucide-react";
import { toast } from "./Toast";

interface IUploadedFile {
  name: string;
  url: string;
  type: string;
}

type FileField = "idCardFrontFile" | "idCardBackFile" | "portraitFile";

const FILE_FIELDS: { key: FileField; label: string }[] = [
  { key: "idCardFrontFile", label: "Ảnh CCCD mặt trước" },
  { key: "idCardBackFile", label: "Ảnh CCCD mặt sau" },
  { key: "portraitFile", label: "Ảnh chân dung" },
];

const RANK_OPTIONS = ["A1", "A2", "B1", "B2", "C", "D", "E", "FC"];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
  "w-full rounded-2xl border border-slate-200 bg-white py-3 px-4 text-xs leading-relaxed outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition placeholder-slate-400 disabled:bg-slate-50";
const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2";

export default function PublicRegisterPage() {
  const teacherId = useMemo(
    () => new URLSearchParams(window.location.search).get("teacherId") || "",
    [],
  );

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    birthday: "",
    idCard: "",
    address: "",
    rank: "",
    referral: "",
    enrollmentDate: todayInputValue(),
  });
  const [files, setFiles] = useState<Partial<Record<FileField, IUploadedFile>>>({});
  const [uploadingField, setUploadingField] = useState<FileField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const inputRefs = useRef<Partial<Record<FileField, HTMLInputElement | null>>>({});

  const setField = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

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
        `/api/students/public-register-upload?teacherId=${encodeURIComponent(teacherId)}`,
        { method: "POST", body },
      );
      const json = await response.json();
      if (!response.ok || !json.success || !json.data?.url) {
        throw new Error(json.error || "Tải ảnh lên thất bại.");
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

    const missingFile = FILE_FIELDS.find((item) => !files[item.key]);
    if (missingFile) {
      toast.error(`Vui lòng tải lên ${missingFile.label.toLowerCase()}.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/students/public-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          idCard: form.idCard.trim(),
          address: form.address.trim(),
          rank: form.rank,
          referral: form.referral.trim(),
          birthday: toServerDate(form.birthday),
          enrollmentDate: toServerDate(form.enrollmentDate),
          idCardFrontFile: files.idCardFrontFile,
          idCardBackFile: files.idCardBackFile,
          portraitFile: files.portraitFile,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || "Đăng ký thất bại.");
      }
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đăng ký thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!teacherId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl">
          <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-rose-500" />
          <h2 className="text-xl font-extrabold text-slate-800">Đường dẫn không hợp lệ</h2>
          <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
            Liên kết đăng ký thiếu mã giáo viên. Vui lòng liên hệ trung tâm để nhận lại liên kết đăng ký chính xác.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
          <h2 className="text-xl font-extrabold text-slate-800">Đăng ký thành công!</h2>
          <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
            Hồ sơ của bạn đã được ghi nhận. Trung tâm sẽ liên hệ với bạn qua số điện thoại đã đăng ký trong thời gian sớm nhất.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 px-4 py-12 font-sans sm:px-6 lg:px-8">
      <div className="relative w-full max-w-3xl space-y-8 overflow-hidden rounded-3xl border border-slate-200/60 bg-white/70 p-6 shadow-2xl backdrop-blur-md md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
            <UserPlus className="h-3.5 w-3.5" />
            Đăng ký học viên
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight text-slate-800">
            Phiếu đăng ký học trực tuyến
          </h1>
          <p className="mt-1.5 text-xs text-slate-500">
            Điền đầy đủ thông tin bên dưới, hồ sơ của bạn sẽ được gửi thẳng tới trung tâm.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="relative space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Họ và tên *</label>
              <input required value={form.fullName} onChange={setField("fullName")} className={inputClass} placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className={labelClass}>Số điện thoại *</label>
              <input required inputMode="numeric" value={form.phone} onChange={setField("phone")} className={inputClass} placeholder="0901234567" />
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input required type="email" value={form.email} onChange={setField("email")} className={inputClass} placeholder="email@example.com" />
            </div>
            <div>
              <label className={labelClass}>Số CCCD/CMND *</label>
              <input required inputMode="numeric" maxLength={12} value={form.idCard} onChange={setField("idCard")} className={inputClass} placeholder="12 chữ số" />
            </div>
            <div>
              <label className={labelClass}>Ngày sinh *</label>
              <input required type="date" value={form.birthday} onChange={setField("birthday")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ngày nhập học *</label>
              <input required type="date" value={form.enrollmentDate} onChange={setField("enrollmentDate")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Hạng đăng ký</label>
              <select value={form.rank} onChange={setField("rank")} className={inputClass}>
                <option value="">-- Chọn hạng --</option>
                {RANK_OPTIONS.map((rank) => (
                  <option key={rank} value={rank}>{rank}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Người giới thiệu</label>
              <input value={form.referral} onChange={setField("referral")} className={inputClass} placeholder="Không bắt buộc" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Địa chỉ thường trú *</label>
              <input required value={form.address} onChange={setField("address")} className={inputClass} placeholder="Số nhà, đường, phường/xã, tỉnh/thành phố" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Hồ sơ ảnh *</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FILE_FIELDS.map(({ key, label }) => {
                const uploaded = files[key];
                const isUploading = uploadingField === key;
                return (
                  <div
                    key={key}
                    onClick={() => !isUploading && inputRefs.current[key]?.click()}
                    className={`flex cursor-pointer select-none flex-col items-center justify-center rounded-3xl border-2 border-dashed p-5 text-center transition ${
                      uploaded
                        ? "border-emerald-300 bg-emerald-50/40"
                        : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-slate-50/50"
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
                      <Loader2 className="mb-2 h-6 w-6 animate-spin text-indigo-600" />
                    ) : uploaded ? (
                      <CheckCircle className="mb-2 h-6 w-6 text-emerald-600" />
                    ) : (
                      <UploadCloud className="mb-2 h-6 w-6 text-indigo-600" />
                    )}
                    <span className="text-xs font-bold text-slate-700">{label}</span>
                    <span className="mt-1 max-w-full truncate text-[10px] text-slate-400">
                      {isUploading ? "Đang tải lên..." : uploaded ? uploaded.name : "Ảnh JPG/PNG, tối đa 10MB"}
                    </span>
                    {uploaded && !isUploading && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles((prev) => ({ ...prev, [key]: undefined }));
                        }}
                        className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
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
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-xs font-extrabold text-white shadow-md transition hover:shadow-lg hover:shadow-indigo-200/60 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi đăng ký
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
