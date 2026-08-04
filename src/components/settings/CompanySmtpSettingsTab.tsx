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
    <div>
      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
        <Mail className="h-5 w-5 text-cyan-600" />
        Thiết lập Email gửi đi (SMTP)
      </h2>
      <p className="text-xs text-slate-500 mt-1">
        Hệ thống sử dụng Gmail của bạn để gửi thông báo tự động (thay vì email cá nhân).
      </p>
      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
        <p className="font-semibold mb-1">Hướng dẫn kết nối với Gmail:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Tài khoản:</strong> Nhập địa chỉ Gmail của bạn (vd: congty@gmail.com).</li>
          <li>
            <strong>Mật khẩu:</strong> KHÔNG dùng mật khẩu đăng nhập bình thường. Bạn phải tạo <strong>Mật khẩu Ứng dụng (App Password)</strong> gồm 16 chữ cái.{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline font-semibold"
            >
              Bấm vào đây để tạo
            </a>
          </li>
        </ul>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Địa chỉ Gmail (Tài khoản)" value={form.user} onChange={(v: string) => update("user", v)} placeholder="Ví dụ: example@gmail.com" required />
      <Field label={form.hasPassword ? "Mật khẩu Ứng dụng (16 ký tự, để trống nếu không đổi)" : "Mật khẩu Ứng dụng (16 ký tự)"} type="password" value={form.password} onChange={(v: string) => update("password", v)} placeholder="xxxx xxxx xxxx xxxx" required={!form.hasPassword} />
      <Field label="Email người gửi (hiển thị cho người nhận)" type="email" value={form.fromEmail} onChange={(v: string) => update("fromEmail", v)} placeholder="Ví dụ: no-reply@example.com" required />
      <Field label="Tên người gửi" value={form.fromName} onChange={(v: string) => update("fromName", v)} placeholder="Ví dụ: Trung tâm Đào tạo XYZ" />
    </div>
    <div className="flex flex-wrap gap-2">
      <Action icon={Save} busy={busy === "save"} label="Lưu cấu hình" onClick={() => act("save", () => companyEmailApi.saveSmtp(form), "Đã lưu SMTP công ty.")} />
      <Action icon={CheckCircle2} busy={busy === "verify"} label="Kiểm tra kết nối" onClick={() => act("verify", companyEmailApi.verifySmtp, "Kết nối SMTP thành công.")} secondary />
      <Action icon={Send} busy={busy === "test"} label="Gửi email thử" onClick={() => act("test", companyEmailApi.testSmtp, "Đã gửi email thử.")} secondary />
    </div>
  </section>;
}
function Field({ label, value, onChange, type = "text", placeholder, required }: any) { return <label className="space-y-1 text-xs font-semibold text-slate-600"><span>{label}{required && <span className="text-red-500 ml-1">*</span>}</span><input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-cyan-500" /></label>; }
function Action({ icon: Icon, busy, label, onClick, secondary }: any) { return <button type="button" disabled={busy} onClick={onClick} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${secondary ? "border border-slate-200 text-slate-700" : "bg-cyan-600 text-white"}`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}</button>; }
