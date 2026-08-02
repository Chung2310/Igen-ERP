import React from "react";
import { Plus, ShieldCheck, X } from "lucide-react";
import { superAdminAccountService, type SuperAdminAccount } from "../../../services/superAdminAccountService";

export function SuperAdminAccountsPage() {
  const [admins, setAdmins] = React.useState<SuperAdminAccount[]>([]);
  const [open, setOpen] = React.useState(false), [loading, setLoading] = React.useState(true), [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({ displayName: "", email: "", password: "" });
  React.useEffect(() => { superAdminAccountService.list().then(setAdmins).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { const admin = await superAdminAccountService.create(form); setAdmins((items) => [admin, ...items]); setOpen(false); setForm({ displayName: "", email: "", password: "" }); }
    catch (e: any) { setError(e.message || "Không thể tạo Super Admin."); } finally { setSaving(false); }
  };
  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-2xl font-black">Tài khoản Super Admin</h2><p className="mt-1 text-sm text-slate-400">Chỉ Super Admin đã xác thực mới có thể tạo thêm tài khoản.</p></div><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950"><Plus className="h-4 w-4"/>Tạo Super Admin</button></div>
    {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">{loading ? <p className="p-6 text-slate-400">Đang tải...</p> : admins.map((admin) => <div key={admin._id} className="flex items-center justify-between gap-4 border-b border-white/5 p-5 last:border-0"><div className="flex min-w-0 items-center gap-3"><ShieldCheck className="h-5 w-5 text-cyan-400"/><div><p className="font-bold">{admin.displayName}</p><p className="text-sm text-slate-400">{admin.email}</p></div></div><div className="text-right"><span className="text-xs text-emerald-300">Đăng nhập bằng mật khẩu</span><p className="mt-1 text-xs text-slate-500">{new Date(admin.createdAt).toLocaleDateString("vi-VN")}</p></div></div>)}</div>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6"><div className="flex justify-between"><h3 className="text-lg font-black">Tạo Super Admin</h3><button type="button" onClick={() => setOpen(false)}><X className="h-5 w-5"/></button></div>{(["displayName", "email", "password"] as const).map((field) => <input key={field} required type={field === "password" ? "password" : field === "email" ? "email" : "text"} minLength={field === "password" ? 12 : 2} value={form[field]} onChange={(e) => setForm({...form, [field]:e.target.value})} placeholder={field === "displayName" ? "Họ và tên" : field === "email" ? "Email" : "Mật khẩu (ít nhất 12 ký tự)"} className="w-full rounded-xl border border-white/10 bg-slate-800 p-3"/>)}<p className="text-xs text-slate-400">Tài khoản mới có thể đăng nhập ngay bằng email và mật khẩu.</p><button disabled={saving} className="w-full rounded-xl bg-cyan-500 p-3 font-bold text-slate-950 disabled:opacity-50">{saving ? "Đang tạo..." : "Tạo tài khoản"}</button></form></div>}
  </section>;
}
