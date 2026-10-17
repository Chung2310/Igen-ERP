import React, { useEffect, useId } from "react";
import { BriefcaseBusiness, CircleAlert, Upload, X } from "lucide-react";

export function RecruitmentDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={title}>
    <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-[0_20px_60px_rgba(13,48,78,0.2)]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E7F0F8] bg-[#F7FBFF] px-5 py-3.5">
        <h3 className="flex items-center gap-2.5 text-base font-medium text-[#15396C]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E0F2FF] text-[#087BDF]"><BriefcaseBusiness className="h-4 w-4" /></span>{title}</h3>
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600" title="Đóng"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>;
}

export const fieldClass = "recruitment-field w-full min-w-0 rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-sm font-normal text-[#15396C] outline-none transition-colors placeholder:text-[#94A6BF] focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15 disabled:bg-[#F5F8FC] disabled:text-[#7C90AB]";
export const labelClass = "grid min-w-0 gap-1.5 text-sm font-medium text-[#536B8F]";
export const primaryButton = "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#087BDF] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#006CC6] disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButton = "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#E8F4FF] px-3 text-sm font-medium text-[#087BDF] transition-colors hover:bg-[#D9EDFF] disabled:cursor-not-allowed disabled:opacity-50";

export function RecruitmentErrorDialog({ title, message, details = [], onClose }: { title: string; message: string; details?: string[]; onClose: () => void }) {
  const id = useId();
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]" role="presentation">
    <div role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(13,48,78,0.2)]">
      <div className="flex items-center justify-between gap-3 bg-[#F7FBFF] px-5 py-4">
        <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0EC] text-[#D85B3F]"><CircleAlert className="h-5 w-5" /></span><h3 id={`${id}-title`} className="text-base font-medium text-[#15396C]">{title}</h3></div>
        <button type="button" aria-label="Đóng" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E8F4FF] text-[#087BDF] hover:bg-[#D9EDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-5 py-5 text-sm leading-6 text-[#536B8F]"><p id={`${id}-message`}>{message}</p>{details.length > 0 && <ul className="mt-3 space-y-1 rounded-xl bg-[#F3FAFF] px-4 py-3 text-[#15396C]">{details.map((detail) => <li key={detail} className="flex gap-2"><span className="text-[#087BDF]">•</span><span>{detail}</span></li>)}</ul>}</div>
      <div className="flex justify-end border-t border-[#E7F0F8] bg-[#FAFCFE] px-5 py-4"><button type="button" onClick={onClose} className={`${primaryButton} h-10 min-w-24`}>Đã hiểu</button></div>
    </div>
  </div>;
}

export function RecruitmentFileInput({ ariaLabel, accept, fileName, uploading, onChange }: { ariaLabel: string; accept: string; fileName?: string; uploading?: boolean; onChange: (file?: File) => void }) {
  return <div className="relative flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-[#15396C] transition-colors hover:border-[#8BDCF9] focus-within:ring-2 focus-within:ring-[#00ADFC]/15">
    <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#E8F4FF] px-3 py-1.5 font-medium text-[#087BDF]"><Upload className="h-4 w-4" />Chọn tệp</span>
    <span className="min-w-0 truncate text-[#7C90AB]">{uploading ? "Đang tải lên..." : fileName || "Chưa chọn tệp"}</span>
    <input aria-label={ariaLabel} type="file" accept={accept} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(event) => onChange(event.target.files?.[0])} />
  </div>;
}

export function ViewState({ loading, error, empty }: { loading?: boolean; error?: string; empty?: string }) {
  if (loading) return <div className="grid min-h-44 place-items-center rounded-2xl bg-white text-sm text-[#7C90AB]">Đang tải...</div>;
  if (error) return <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  if (empty) return <div className="grid min-h-44 place-items-center rounded-2xl bg-white px-4 text-center text-sm text-[#7C90AB] shadow-[0_2px_16px_rgba(33,84,123,0.05)]">{empty}</div>;
  return null;
}
