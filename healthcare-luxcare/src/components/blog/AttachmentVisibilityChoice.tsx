import React from "react";
export function AttachmentVisibilityChoice({ value, onChange, disabled = false }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm dark:border-indigo-800 dark:bg-indigo-950/40">
    <span><span className="block font-semibold text-slate-800 dark:text-slate-100">Quyền tệp đính kèm</span>
      <span className="block text-xs text-slate-500 dark:text-slate-400">{value ? "Cho phép chia sẻ và tải về mọi tệp trong bài viết." : "Không cho phép chia sẻ hoặc tải về tệp."}</span></span>
    <select aria-label="Quyền tệp đính kèm" value={String(value)} onChange={event => onChange(event.target.value === "true")} disabled={disabled}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
      <option value="false">Không công khai</option><option value="true">Công khai</option>
    </select>
  </label>;
}
