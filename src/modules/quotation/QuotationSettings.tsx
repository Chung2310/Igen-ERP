import { useEffect, useState, type FormEvent } from "react";
import { api, downloadGeneratedFile, formatDate, hasQuotationCapability } from "./api";
import { HrPageTitle } from "../../components/hr/HrPageTitle";

const fields = [{ key: "name", label: "Tên bên bán" }, { key: "taxId", label: "Mã số thuế" }, { key: "address", label: "Địa chỉ" }, { key: "phone", label: "Số điện thoại" }, { key: "businessEmail", label: "Email" }, { key: "representativeName", label: "Người đại diện" }];
export default function QuotationSettings() {
  const [values, setValues] = useState<Record<string, string>>({}); const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { let active = true; Promise.all([api<{ settings: Record<string, string> }>("/api/settings"), api<{ files: any[] }>("/api/files")]).then(([data, list]) => { if (active) { setValues(data.settings || {}); setFiles(list.files); } }).catch(error => { if (active) setMessage(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const canManage = hasQuotationCapability("quotation-template:manage");
  const save = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setMessage(""); try { await api("/api/settings", { method: "PUT", body: JSON.stringify(Object.fromEntries(fields.map(field => [field.key, values[field.key] || ""]))) }); setMessage("Đã lưu thông tin bên bán cho chi nhánh."); } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được thông tin."); } finally { setBusy(false); } };
  if (loading) return <p role="status">Đang tải cài đặt Báo giá…</p>;
  return <div className="page-stack"><HrPageTitle>Thông tin bên bán và tài liệu</HrPageTitle>
    <section className="content-card p-5"><h2 className="text-balance">Thông tin lập báo giá và hợp đồng</h2><form onSubmit={save} className="grid gap-4 pt-4 sm:grid-cols-2" aria-busy={busy}>
      {fields.map(field => <label className="grid gap-2 text-sm" key={field.key}>{field.label}<input className="rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-on-surface focus:border-primary" type={field.key === "businessEmail" ? "email" : "text"} value={values[field.key] || ""} required={field.key === "name"} disabled={busy || !canManage} maxLength={field.key === "address" ? 500 : 250} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} /></label>)}
      {canManage && <button className="button button-primary justify-self-start" disabled={busy} type="submit">{busy ? "Đang lưu…" : "Lưu thông tin"}</button>}
      {message && <p role="status" className="text-pretty text-sm sm:col-span-2">{message}</p>}
    </form></section>
    <section className="content-card p-5"><h2 className="text-balance">Tài liệu đã lưu</h2>{!files.length ? <p className="mt-4 text-pretty text-sm text-on-surface-variant">File báo giá, hợp đồng và nghiệm thu sẽ xuất hiện khi tác vụ tạo file hoàn tất.</p> : <ul className="mt-4 divide-y divide-outline-variant">{files.map(file => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={file._id}><div className="min-w-0"><p className="truncate text-sm">{file.originalFilename}</p><p className="text-xs text-on-surface-variant tabular-nums">{formatDate(file.createdAt)} · {Math.ceil(file.bytes / 1024)} KB</p></div><button type="button" className="button button-soft" onClick={() => void downloadGeneratedFile(file._id).catch(error => setMessage(error.message))}>Tải tài liệu</button></li>)}</ul>}</section>
  </div>;
}
