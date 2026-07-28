import React from "react";
import { CheckCircle2, Loader2, Mail, Save, Send } from "lucide-react";
import { companyEmailApi } from "../../services/companyEmailService";
import { toast } from "../../pages/Toast";

const empty = { host: "smtp.gmail.com", port: 587, secure: false, user: "", password: "", fromEmail: "", fromName: "" };
export default function CompanySmtpSettingsTab() {
  const [form, setForm] = React.useState<any>(empty);
  const [busy, setBusy] = React.useState("");
  React.useEffect(() => { companyEmailApi.getSmtp().then((data) => data && setForm({ ...empty, ...data, password: "" })).catch((e) => toast.error(e.message)); }, []);
  const update = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const act = async (name: string, fn: () => Promise<any>, message: string) => { setBusy(name); try { await fn(); toast.success(message); } catch (e: any) { toast.error(e.message); } finally { setBusy(""); } };
  return <section className="space-y-5 bg-white border border-slate-200 p-5 rounded-xl">
    <div><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Mail className="h-5 w-5 text-cyan-600" />SMTP công ty</h2><p className="text-xs text-slate-500 mt-1">Tài khoản gửi email dùng chung cho toàn công ty.</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Máy chủ SMTP" value={form.host} onChange={(v) => update("host", v)} />
      <Field label="Cổng" type="number" value={String(form.port)} onChange={(v) => update("port", Number(v))} />
      <Field label="Tài khoản" value={form.user} onChange={(v) => update("user", v)} />
      <Field label={form.hasPassword ? "Mật khẩu (để trống để giữ nguyên)" : "Mật khẩu"} type="password" value={form.password} onChange={(v) => update("password", v)} />
      <Field label="Email người gửi" type="email" value={form.fromEmail} onChange={(v) => update("fromEmail", v)} />
      <Field label="Tên người gửi" value={form.fromName} onChange={(v) => update("fromName", v)} />
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.secure} onChange={(e) => update("secure", e.target.checked)} /> Dùng kết nối SSL/TLS</label>
    </div>
    <div className="flex flex-wrap gap-2">
      <Action icon={Save} busy={busy === "save"} label="Lưu cấu hình" onClick={() => act("save", () => companyEmailApi.saveSmtp(form), "Đã lưu SMTP công ty.")} />
      <Action icon={CheckCircle2} busy={busy === "verify"} label="Kiểm tra kết nối" onClick={() => act("verify", companyEmailApi.verifySmtp, "Kết nối SMTP thành công.")} secondary />
      <Action icon={Send} busy={busy === "test"} label="Gửi email thử" onClick={() => act("test", companyEmailApi.testSmtp, "Đã gửi email thử.")} secondary />
    </div>
  </section>;
}
function Field({ label, value, onChange, type = "text" }: any) { return <label className="space-y-1 text-xs font-semibold text-slate-600"><span>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500" /></label>; }
function Action({ icon: Icon, busy, label, onClick, secondary }: any) { return <button type="button" disabled={busy} onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${secondary ? "border border-slate-200 text-slate-700" : "bg-cyan-600 text-white"}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}</button>; }
