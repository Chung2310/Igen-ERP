import React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eye,
  Italic,
  Link,
  Loader2,
  List,
  ListOrdered,
  Save,
  Underline,
  X,
} from "lucide-react";
import { companyEmailApi } from "../../services/companyEmailService";
import { toast } from "../../pages/Toast";

const defaults = {
  birthdayEnabled: false,
  holidayEnabled: false,
  sendTime: "08:00",
  birthdayTemplate: {
    subject: "Chúc mừng sinh nhật {{employeeName}}",
    html: "<p>Chúc mừng sinh nhật <strong>{{employeeName}}</strong>!</p>",
  },
  holidayTemplate: {
    subject: "Chúc mừng {{holidayName}}",
    html: "<p>{{companyName}} kính chúc bạn một kỳ nghỉ vui vẻ.</p>",
  },
  holidayOverrides: [],
};

type TemplateValue = { subject: string; html: string };
type TemplateKey = "birthdayTemplate" | "holidayTemplate";

export default function CelebrationEmailTab() {
  const [config, setConfig] = React.useState<any>(defaults);
  const [history, setHistory] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState({ totalEmployees: 0, missingBirthDate: 0 });
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<any>(null);

  const load = React.useCallback(
    () =>
      Promise.all([companyEmailApi.getCelebration(), companyEmailApi.history(), companyEmailApi.celebrationStats()])
        .then(([c, h, employeeStats]) => {
          setConfig({ ...defaults, ...(c || {}) });
          setHistory(h);
          setStats(employeeStats);
        })
        .catch((e) => toast.error(e.message)),
    [],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateTemplate = (key: TemplateKey, field: keyof TemplateValue, value: string) =>
    setConfig((current: any) => ({ ...current, [key]: { ...current[key], [field]: value } }));

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

  const showPreview = async (value: TemplateValue, holidayName?: string) => {
    try {
      const result = await companyEmailApi.preview({ ...value, holidayName });
      setPreview(result);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Email chúc mừng</h2>
          <p className="text-xs text-slate-500">Tự động gửi theo giờ Việt Nam.</p>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-cyan-600 text-white rounded-lg px-3 py-2 text-xs font-bold"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu
        </button>
      </div>

      <div className="flex flex-wrap gap-5 border-y border-slate-200 py-4">
        <Toggle
          label="Tự động sinh nhật"
          checked={config.birthdayEnabled}
          onChange={(v: boolean) => setConfig({ ...config, birthdayEnabled: v })}
        />
        <Toggle
          label="Tự động lễ/Tết"
          checked={config.holidayEnabled}
          onChange={(v: boolean) => setConfig({ ...config, holidayEnabled: v })}
        />
        <label className="text-xs font-semibold text-slate-600">
          Giờ gửi{" "}
          <input
            type="time"
            value={config.sendTime}
            onChange={(e) => setConfig({ ...config, sendTime: e.target.value })}
            className="ml-2 border rounded-lg px-2 py-1.5"
          />
        </label>
      </div>

      {stats.missingBirthDate > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Có{" "}
          <strong>
            {stats.missingBirthDate}/{stats.totalEmployees}
          </strong>{" "}
          nhân viên chưa có ngày sinh và sẽ không nhận email chúc mừng sinh nhật.
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Template
          title="Mẫu sinh nhật"
          value={config.birthdayTemplate}
          onChange={(f: keyof TemplateValue, v: string) => updateTemplate("birthdayTemplate", f, v)}
          onPreview={() => showPreview(config.birthdayTemplate)}
        />
        <Template
          title="Mẫu lễ/Tết mặc định"
          value={config.holidayTemplate}
          onChange={(f: keyof TemplateValue, v: string) => updateTemplate("holidayTemplate", f, v)}
          onPreview={() => showPreview(config.holidayTemplate, "Ngày lễ")}
        />
      </div>

      <div>
        <h3 className="font-bold text-sm text-slate-800 mb-3">Lịch sử gửi</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-2">Người nhận</th>
                <th>Loại</th>
                <th>Ngày</th>
                <th>Trạng thái</th>
                <th>Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row._id} className="border-b">
                  <td className="py-2">{row.recipientEmail}</td>
                  <td>{row.eventType}</td>
                  <td>{row.eventDate}</td>
                  <td>{row.status}</td>
                  <td className="max-w-xs truncate text-rose-600" title={row.error || ""}>
                    {row.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {preview && <EmailPreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Template({
  title,
  value,
  onChange,
  onPreview,
}: {
  title: string;
  value: TemplateValue;
  onChange: (field: keyof TemplateValue, value: string) => void;
  onPreview: () => void;
}) {
  return (
    <section className="border border-slate-200 rounded-lg p-4 space-y-3">
      <h3 className="font-bold text-sm">{title}</h3>
      <input
        value={value.subject}
        onChange={(e) => onChange("subject", e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-xs"
        placeholder="Tiêu đề"
      />
      <RichTextEditor value={value.html} onChange={(html) => onChange("html", html)} />
      <button
        type="button"
        onClick={onPreview}
        className="inline-flex items-center gap-2 border rounded-lg px-3 py-2 text-xs"
      >
        <Eye className="h-4 w-4" />
        Xem trước
      </button>
    </section>
  );
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const nextHtml = value || "<p></p>";
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
  }, [value]);

  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  };

  const addLink = () => {
    const url = window.prompt("Nhập đường dẫn liên kết:", "https://");
    if (url) command("createLink", url);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 p-1.5">
        <EditorButton label="Đậm" icon={<Bold className="h-3.5 w-3.5" />} onClick={() => command("bold")} />
        <EditorButton label="Nghiêng" icon={<Italic className="h-3.5 w-3.5" />} onClick={() => command("italic")} />
        <EditorButton
          label="Gạch chân"
          icon={<Underline className="h-3.5 w-3.5" />}
          onClick={() => command("underline")}
        />
        <select
          aria-label="Kiểu chữ"
          defaultValue="p"
          onChange={(e) => command("formatBlock", e.target.value)}
          className="h-7 rounded border bg-white px-1 text-xs"
        >
          <option value="p">Đoạn văn</option>
          <option value="h2">Tiêu đề lớn</option>
          <option value="h3">Tiêu đề nhỏ</option>
        </select>
        <EditorButton
          label="Danh sách"
          icon={<List className="h-3.5 w-3.5" />}
          onClick={() => command("insertUnorderedList")}
        />
        <EditorButton
          label="Danh sách số"
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          onClick={() => command("insertOrderedList")}
        />
        <EditorButton
          label="Căn trái"
          icon={<AlignLeft className="h-3.5 w-3.5" />}
          onClick={() => command("justifyLeft")}
        />
        <EditorButton
          label="Căn giữa"
          icon={<AlignCenter className="h-3.5 w-3.5" />}
          onClick={() => command("justifyCenter")}
        />
        <EditorButton
          label="Căn phải"
          icon={<AlignRight className="h-3.5 w-3.5" />}
          onClick={() => command("justifyRight")}
        />
        <EditorButton
          label="Màu chữ"
          icon={<span className="text-xs font-bold text-cyan-700">A</span>}
          onClick={() => command("foreColor", "#0e7490")}
        />
        <EditorButton label="Chèn liên kết" icon={<Link className="h-3.5 w-3.5" />} onClick={addLink} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Nội dung email"
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        className="min-h-[180px] max-h-[360px] overflow-y-auto p-3 text-sm outline-none prose prose-sm"
      />
      <p className="border-t bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
        Có thể dùng các biến: {"{{employeeName}}"}, {"{{companyName}}"}, {"{{holidayName}}"}
      </p>
    </div>
  );
}

function EditorButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent text-slate-600 hover:border-slate-300 hover:bg-white"
    >
      {icon}
    </button>
  );
}

function EmailPreviewModal({ preview, onClose }: { preview: any; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Xem trước email"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h3 className="font-bold text-slate-800">Xem trước email</h3>
            <p className="text-xs text-slate-500">Mô phỏng email người nhận sẽ thấy</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng xem trước"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto bg-slate-100 p-4 sm:p-8">
          <article className="mx-auto max-w-xl overflow-hidden rounded-lg bg-white shadow-sm">
            <div className="border-b px-5 py-4 text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Từ:</span> Công ty
              </div>
              <div>
                <span className="font-semibold text-slate-800">Đến:</span> employee@example.com
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">{preview.subject}</div>
            </div>
            <div
              className="prose prose-sm max-w-none p-5 text-slate-700"
              dangerouslySetInnerHTML={{ __html: preview.html || "<p>Chưa có nội dung.</p>" }}
            />
          </article>
        </div>
      </div>
    </div>
  );
}
