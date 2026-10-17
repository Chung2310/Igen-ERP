import React from "react";
import { Eye, Loader2, Save, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Image as ImageIcon, X, Cake, Gift, Clock3, Mail, History } from "lucide-react";
import { companyEmailApi } from "../../services/companyEmailService";
import { toast } from "../../pages/Toast";
import { authService } from "../../services/authService";
import type { TemplateVariableConfig } from "../template-editor/templateEditorTypes";
import { toFriendlyTokens } from "../template-editor/templateTokenCodec";
import { HR_BIRTHDAY_TEMPLATE_VARIABLES, HR_HOLIDAY_TEMPLATE_VARIABLES } from "./hrCelebrationVariableRegistry";

function RichTextEditor({
  value,
  onChange,
  onUpload,
  variables,
}: {
  value: string;
  onChange: (val: string) => void;
  onUpload?: (token: string) => void;
  variables: TemplateVariableConfig[];
}) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCmd = (command: string, arg: string = "") => {
    document.execCommand(command, false, arg);
    handleInput();
  };

  const insertVariable = (variable: string) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(variable);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
    handleInput();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await authService.uploadManagedFile(file, "hr.celebration");
      editorRef.current?.focus();
      execCmd("insertHTML", `<img src="${uploaded.url}" class="max-w-full my-2 rounded-lg" style="max-height: 250px; object-fit: contain;" />`);
      onUpload?.(uploaded.uploadToken);
      toast.success("Đã chèn hình ảnh.");
    } catch (err: any) {
      toast.error(err.message || "Tải hình ảnh thất bại");
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#DCE7F4] bg-white transition-colors focus-within:border-[#8BDCF9] focus-within:ring-2 focus-within:ring-[#00ADFC]/10">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#E7F0F8] bg-[#F5FAFE] p-2 text-[#536B8F] select-none">
        <button
          type="button"
          onClick={() => execCmd("bold")}
          className="rounded-lg p-1.5 text-[#536B8F] transition-colors hover:bg-[#E1F2FD] hover:text-[#087BDF]"
          title="In đậm"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("italic")}
          className="rounded-lg p-1.5 text-[#536B8F] transition-colors hover:bg-[#E1F2FD] hover:text-[#087BDF]"
          title="In nghiêng"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("underline")}
          className="rounded-lg p-1.5 text-[#536B8F] transition-colors hover:bg-[#E1F2FD] hover:text-[#087BDF]"
          title="Gạch chân"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => execCmd("justifyLeft")}
          className="rounded-lg p-1.5 text-[#536B8F] transition-colors hover:bg-[#E1F2FD] hover:text-[#087BDF]"
          title="Căn lề trái"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("justifyCenter")}
          className="rounded-lg p-1.5 text-[#536B8F] transition-colors hover:bg-[#E1F2FD] hover:text-[#087BDF]"
          title="Căn giữa"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("justifyRight")}
          className="rounded-lg p-1.5 text-[#536B8F] transition-colors hover:bg-[#E1F2FD] hover:text-[#087BDF]"
          title="Căn lề phải"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-0.5 rounded-lg p-1.5 text-[#536B8F] transition-colors hover:bg-[#E1F2FD] hover:text-[#087BDF]"
          title="Chèn ảnh"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
        <div className="h-4 w-px bg-slate-200 mx-1" />
        {variables.map((variable) => (
          <button
            key={variable.key}
            type="button"
            onClick={() => insertVariable(`{{${variable.key}}}`)}
            className="cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#087BDF] shadow-[0_0_0_1px_#DCE7F4] transition-colors hover:bg-[#E5F4FD]"
            title={`Chèn ${variable.label}`}
            aria-label={variable.label}
          >
            {variable.label}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[180px] max-h-[300px] overflow-y-auto bg-white p-3.5 text-sm leading-relaxed text-[#172B4D] outline-none prose prose-sm max-w-none"
        {...({ placeholder: "Nhập nội dung thư chúc mừng..." } as any)}
      />
    </div>
  );
}

const defaults = {
  birthdayEnabled: false,
  holidayEnabled: false,
  sendTime: "08:00",
  birthdayTemplate: {
    subject: "Chúc mừng sinh nhật {{employeeName}}",
    html: "<p>Chúc mừng sinh nhật {{employeeName}}!</p>",
  },
  holidayTemplate: {
    subject: "Chúc mừng {{holidayName}}",
    html: "<p>{{companyName}} kính chúc bạn một kỳ nghỉ vui vẻ.</p>",
  },
  holidayOverrides: [],
};

export default function CelebrationEmailTab() {
  const [config, setConfig] = React.useState<any>(defaults);
  const [history, setHistory] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);
  const [uploadTokens, setUploadTokens] = React.useState<string[]>([]);

  const load = React.useCallback(
    () =>
      Promise.all([companyEmailApi.getCelebration(), companyEmailApi.history()])
        .then(([c, h]) => {
          setConfig({ ...defaults, ...(c || {}) });
          setHistory(h);
        })
        .catch((e) => toast.error(e.message)),
    [],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const template = (key: "birthdayTemplate" | "holidayTemplate", field: "subject" | "html", value: string) =>
    setConfig((c: any) => ({ ...c, [key]: { ...c[key], [field]: value } }));

  const save = async () => {
    setBusy(true);
    try {
      await companyEmailApi.saveCelebration({ ...config, uploadTokens });
      setUploadTokens([]);
      toast.success("Đã lưu cấu hình email chúc mừng.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const showPreview = async (value: any) => {
    try {
      setPreview(await companyEmailApi.preview(value));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gradient-to-br from-[#F7FAFF] via-[#F2F8FF] to-[#F7FBFD] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#142547]">Email chúc mừng</h2>
          <p className="mt-0.5 text-sm text-[#536B8F]">Thiết lập lời chúc gửi đến nhân sự.</p>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#087BDF] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#006CC6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Lưu cấu hình
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
        <Toggle label="Tự động sinh nhật" checked={config.birthdayEnabled} onChange={(v: boolean) => setConfig({ ...config, birthdayEnabled: v })} />
        <Toggle label="Tự động lễ/Tết" checked={config.holidayEnabled} onChange={(v: boolean) => setConfig({ ...config, holidayEnabled: v })} />
        <label className="ml-auto flex items-center gap-2 rounded-xl bg-[#F5FAFE] px-3 py-1.5 text-sm font-medium text-[#15396C]">
          <Clock3 className="h-4 w-4 text-[#087BDF]" aria-hidden="true" />
          Giờ gửi
          <input
            type="time"
            value={config.sendTime}
            onChange={(e) => setConfig({ ...config, sendTime: e.target.value })}
            lang="vi-VN"
            className="h-8 cursor-pointer rounded-lg border border-[#DCE7F4] bg-white px-2 text-sm font-medium text-[#15396C] outline-none focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
        <Template
          title="Mẫu thư chúc mừng sinh nhật"
          kind="birthday"
          value={config.birthdayTemplate}
          variables={HR_BIRTHDAY_TEMPLATE_VARIABLES}
          onChange={(f: any, v: string) => template("birthdayTemplate", f, v)}
          onPreview={() => showPreview(config.birthdayTemplate)}
          onUpload={(token: string) => setUploadTokens((current) => [...current, token])}
        />
        <Template
          title="Mẫu thư chúc mừng lễ/Tết"
          kind="holiday"
          value={config.holidayTemplate}
          variables={HR_HOLIDAY_TEMPLATE_VARIABLES}
          onChange={(f: any, v: string) => template("holidayTemplate", f, v)}
          onPreview={() => showPreview({ ...config.holidayTemplate, holidayName: "Ngày lễ" })}
          onUpload={(token: string) => setUploadTokens((current) => [...current, token])}
        />
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-label="Bản xem trước email" className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(13,48,78,0.2)]">
            <div className="flex items-center justify-between border-b border-[#E7F0F8] bg-[#F5FAFE] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E0F2FF] text-[#087BDF]"><Mail className="h-4 w-4" /></span>
                <span className="text-base font-medium text-[#15396C]">Bản xem trước email</span>
              </div>
              <button
                type="button"
                aria-label="Đóng bản xem trước"
                onClick={() => setPreview(null)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 border-b border-[#E7F0F8] bg-[#FAFCFF] px-5 py-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[#7C90AB]">Từ</span>
                <span className="min-w-0 break-all text-[#15396C]">Hệ thống gửi tự động &lt;no-reply@igen.vn&gt;</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[#7C90AB]">Đến</span>
                <span className="min-w-0 break-all text-[#15396C]">nhanvien@company.com</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-[#7C90AB]">Tiêu đề</span>
                <span className="min-w-0 break-words font-medium text-[#15396C]">{preview.subject}</span>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-[#F5F9FD] p-4 sm:p-5">
              <div className="prose prose-sm min-h-[230px] w-full max-w-none rounded-xl bg-white p-5 text-[#172B4D] shadow-[0_2px_16px_rgba(33,84,123,0.07)]" dangerouslySetInnerHTML={{ __html: preview.html }} />
            </div>

            <div className="flex justify-end border-t border-[#E7F0F8] bg-white px-5 py-3.5">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="cursor-pointer rounded-lg bg-[#087BDF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#006CC6]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
        <h3 className="flex items-center gap-2 text-sm font-medium text-[#15396C]"><History className="h-4 w-4 text-[#087BDF]" /> Lịch sử gửi gần đây</h3>
        <div className="overflow-x-auto rounded-xl border border-[#E7F0F8]">
          <table className="w-full text-xs">
            <thead className="bg-[#F5FAFE] text-[#536B8F]">
              <tr className="text-left font-medium">
                <th className="px-3 py-2.5">Nhân sự nhận</th>
                <th className="px-3 py-2.5">Phân loại</th>
                <th className="px-3 py-2.5">Ngày gửi</th>
                <th className="px-3 py-2.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF3F9]">
              {history.map((row) => (
                <tr key={row._id} className="text-[#15396C] hover:bg-[#FAFCFF]">
                  <td className="px-3 py-2.5 font-medium">{row.recipientEmail}</td>
                  <td className="px-3 py-2.5">{row.eventType === "birthday" ? "Sinh nhật" : "Ngày lễ"}</td>
                  <td className="px-3 py-2.5">{row.eventDate}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        row.status === "sent"
                          ? "bg-[#DCF7E8] text-[#078252]"
                          : "bg-[#FFF0D8] text-[#A66300]"
                      }`}
                    >
                      {row.status === "sent" ? "Đã gửi" : row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: any) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-xl bg-[#F5FAFE] px-3 py-2 text-sm font-medium text-[#15396C]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-[#CEDBE8] transition-colors peer-checked:bg-[#00A4E8] peer-focus-visible:ring-2 peer-focus-visible:ring-[#00ADFC]/30 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
      {label}
    </label>
  );
}

function Template({
  title,
  kind,
  value,
  variables,
  onChange,
  onPreview,
  onUpload,
}: {
  title: string;
  kind: "birthday" | "holiday";
  value: { subject: string; html: string };
  variables: TemplateVariableConfig[];
  onChange: (field: "subject" | "html", value: string) => void;
  onPreview: () => void;
  onUpload: (token: string) => void;
}) {
  const isBirthday = kind === "birthday";
  const Icon = isBirthday ? Cake : Gift;
  return (
    <section className="flex h-full min-w-0 flex-col space-y-4 rounded-2xl bg-white p-4 shadow-[0_2px_16px_rgba(33,84,123,0.07)]">
      <h3 className="flex items-center gap-2.5 text-sm font-medium text-[#15396C]"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isBirthday ? "bg-[#E0F2FF] text-[#087BDF]" : "bg-[#DFF5F1] text-[#087F72]"}`}><Icon className="h-4 w-4" /></span>{title}</h3>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#536B8F]">Tiêu đề email</label>
        <input
          value={value.subject}
          onChange={(e) => onChange("subject", e.target.value)}
          className="h-10 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 text-sm text-[#15396C] outline-none focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15"
          placeholder="Nhập tiêu đề email..."
        />
        <p className="text-xs text-[#7C90AB]">Hiển thị: {toFriendlyTokens(value.subject, variables)}</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#536B8F]">Nội dung thư</label>
        <RichTextEditor
          value={value.html}
          onChange={(val: string) => onChange("html", val)}
          onUpload={onUpload}
          variables={variables}
        />
      </div>
      <div className="mt-auto flex justify-end pt-1">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[#E8F4FF] px-3.5 text-sm font-medium text-[#087BDF] transition-colors hover:bg-[#D9EDFF]"
        >
          <Eye className="h-4 w-4" />
          Xem trước
        </button>
      </div>
    </section>
  );
}
