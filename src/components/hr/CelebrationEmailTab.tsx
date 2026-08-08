import React from "react";
import { Eye, Loader2, Save, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Image as ImageIcon, X } from "lucide-react";
import { companyEmailApi } from "../../services/companyEmailService";
import { toast } from "../../pages/Toast";
import { authService } from "../../services/authService";

function RichTextEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
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
      const url = await authService.uploadFile(file);
      editorRef.current?.focus();
      execCmd("insertHTML", `<img src="${url}" class="max-w-full my-2 rounded-lg" style="max-height: 250px; object-fit: contain;" />`);
      toast.success("Đã chèn hình ảnh.");
    } catch (err: any) {
      toast.error(err.message || "Tải hình ảnh thất bại");
    }
  };

  return (
    <div className="border border-slate-200 bg-white rounded-lg overflow-hidden flex flex-col">
      <div className="flex flex-wrap items-center gap-1 bg-slate-50 border-b border-slate-200 p-1.5 text-slate-600 select-none">
        <button
          type="button"
          onClick={() => execCmd("bold")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="In đậm"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("italic")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="In nghiêng"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("underline")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Gạch chân"
        >
          <Underline className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => execCmd("justifyLeft")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Căn lề trái"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("justifyCenter")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Căn giữa"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => execCmd("justifyRight")}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700"
          title="Căn lề phải"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </button>
        <div className="h-4 w-px bg-slate-200 mx-1" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-700 flex items-center gap-0.5"
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
        <button
          type="button"
          onClick={() => insertVariable("{{employeeName}}")}
          className="px-1.5 py-0.5 text-[9px] font-bold border border-slate-200 bg-white hover:bg-slate-100 rounded transition-all text-cyan-600 cursor-pointer"
          title="Chèn Tên nhân sự"
        >
          + Tên NV
        </button>
        <button
          type="button"
          onClick={() => insertVariable("{{companyName}}")}
          className="px-1.5 py-0.5 text-[9px] font-bold border border-slate-200 bg-white hover:bg-slate-100 rounded transition-all text-cyan-600 cursor-pointer"
          title="Chèn Tên công ty"
        >
          + Tên Cty
        </button>
        <button
          type="button"
          onClick={() => insertVariable("{{holidayName}}")}
          className="px-1.5 py-0.5 text-[9px] font-bold border border-slate-200 bg-white hover:bg-slate-100 rounded transition-all text-cyan-600 cursor-pointer"
          title="Chèn Tên ngày lễ"
        >
          + Ngày Lễ
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[180px] max-h-[300px] overflow-y-auto p-3 text-xs outline-none leading-relaxed prose prose-sm max-w-none bg-white"
        {...({ placeholder: "Nhập nội dung thư chúc mừng..." } as any)}
      />
    </div>
  );
}

const defaults = { birthdayEnabled: false, holidayEnabled: false, sendTime: "08:00", birthdayTemplate: { subject: "Chúc mừng sinh nhật {{employeeName}}", html: "<p>Chúc mừng sinh nhật {{employeeName}}!</p>" }, holidayTemplate: { subject: "Chúc mừng {{holidayName}}", html: "<p>{{companyName}} kính chúc bạn một kỳ nghỉ vui vẻ.</p>" }, holidayOverrides: [] };

export default function CelebrationEmailTab() {
  const [config, setConfig] = React.useState<any>(defaults);
  const [history, setHistory] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);

  const load = React.useCallback(() => Promise.all([
    companyEmailApi.getCelebration(),
    companyEmailApi.history()
  ]).then(([c, h]) => {
    setConfig({ ...defaults, ...(c || {}) });
    setHistory(h);
  }).catch((e) => toast.error(e.message)), []);

  React.useEffect(() => { void load(); }, [load]);

  const template = (key: "birthdayTemplate" | "holidayTemplate", field: "subject" | "html", value: string) =>
    setConfig((c: any) => ({ ...c, [key]: { ...c[key], [field]: value } }));

  const save = async () => {
    setBusy(true);
    try {
      await companyEmailApi.saveCelebration(config);
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
    <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Email chúc mừng</h2>
          <p className="text-xs text-slate-500">Tự động gửi thư chúc mừng nhân sự theo cấu hình.</p>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-4.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Lưu cấu hình
        </button>
      </div>

      <div className="flex flex-wrap gap-5 border-y border-slate-200/80 py-4 items-center">
        <Toggle label="Tự động sinh nhật" checked={config.birthdayEnabled} onChange={(v: boolean) => setConfig({ ...config, birthdayEnabled: v })} />
        <Toggle label="Tự động lễ/Tết" checked={config.holidayEnabled} onChange={(v: boolean) => setConfig({ ...config, holidayEnabled: v })} />
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
          Giờ gửi tự động
          <input
            type="time"
            value={config.sendTime}
            onChange={(e) => setConfig({ ...config, sendTime: e.target.value })}
            className="border bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-cyan-500 text-xs font-medium cursor-pointer"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Template
          title="Mẫu thư chúc mừng sinh nhật"
          value={config.birthdayTemplate}
          onChange={(f: any, v: string) => template("birthdayTemplate", f, v)}
          onPreview={() => showPreview(config.birthdayTemplate)}
        />
        <Template
          title="Mẫu thư chúc mừng lễ/Tết"
          value={config.holidayTemplate}
          onChange={(f: any, v: string) => template("holidayTemplate", f, v)}
          onPreview={() => showPreview({ ...config.holidayTemplate, holidayName: "Ngày lễ" })}
        />
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[calc(100vh-4rem)] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
                </div>
                <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 ml-2">XEM TRƯỚC EMAIL GỬI ĐI</span>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Email Client Header Details */}
            <div className="bg-slate-50 border-b border-slate-200/80 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right">Từ (From):</span>
                <span className="text-slate-800 font-medium">Hệ thống gửi tự động &lt;no-reply@igen.vn&gt;</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right">Đến (To):</span>
                <span className="text-slate-800 font-medium">nhanvien@company.com</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-400 w-16 text-right">Tiêu đề:</span>
                <span className="text-slate-900 font-bold">{preview.subject}</span>
              </div>
            </div>

            {/* Email Content Frame */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 flex justify-center">
              <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-6 shadow-sm min-h-[250px] prose prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: preview.html }} />
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200/80 p-3 flex justify-end">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="bg-slate-800 hover:bg-slate-950 text-white rounded-lg px-4 py-1.5 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                Đóng bản xem trước
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
        <h3 className="font-bold text-sm text-slate-800">Lịch sử gửi email gần đây</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500 font-bold">
                <th className="py-2.5">Nhân sự nhận</th>
                <th>Phân loại</th>
                <th>Ngày thực hiện</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map((row) => (
                <tr key={row._id} className="text-slate-650 hover:bg-slate-50/50">
                  <td className="py-2.5 font-medium">{row.recipientEmail}</td>
                  <td className="capitalize">{row.eventType === "birthday" ? "Sinh nhật" : "Ngày lễ"}</td>
                  <td>{row.eventDate}</td>
                  <td>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.status === "sent"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                          : "bg-amber-50 text-amber-700 border border-amber-250"
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
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-650 select-none cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
      />
      {label}
    </label>
  );
}

function Template({ title, value, onChange, onPreview }: any) {
  return (
    <section className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white shadow-2xs">
      <h3 className="font-bold text-sm text-slate-800">{title}</h3>
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tiêu đề email</label>
        <input
          value={value.subject}
          onChange={(e) => onChange("subject", e.target.value)}
          className="w-full border bg-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
          placeholder="Nhập tiêu đề email..."
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nội dung thư</label>
        <RichTextEditor
          value={value.html}
          onChange={(val: string) => onChange("html", val)}
        />
      </div>
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-2 bg-white border border-slate-250 hover:bg-slate-50 hover:border-slate-300 rounded-lg px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
        >
          <Eye className="h-4 w-4 text-slate-500" />
          Bản xem trước
        </button>
      </div>
    </section>
  );
}
