import { useEffect, useState } from "react";
import { getAccessToken } from "../../../../../services/authService";
import type { LeadIntakeField, LeadIntakeFieldType } from "../../../../../../shared/marketing-suite/lead-intake";

type Platform = "facebook" | "zalo" | "tiktok";
type Field = LeadIntakeField & { type: LeadIntakeFieldType; required: boolean; options: string[] };
type Flow = { version: number; status: "draft" | "active" | "archived"; goal: string; fields: Field[]; completionMessage: string; sourceDocumentIds?: string[]; platform?: Platform; accountId?: string };
const fieldTypes: Array<{ value: LeadIntakeFieldType; label: string }> = [
  { value: "text", label: "Văn bản ngắn" }, { value: "long_text", label: "Văn bản dài" },
  { value: "number", label: "Số" }, { value: "currency", label: "Tiền tệ" },
  { value: "date", label: "Ngày" }, { value: "phone", label: "Số điện thoại" },
  { value: "email", label: "Email" }, { value: "single_select", label: "Chọn một" },
  { value: "multi_select", label: "Chọn nhiều" }, { value: "checkbox", label: "Có/Không" },
];
const input = "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-50";
const button = "inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

async function requestFlow(platform: Platform, accountId: string, suffix = "", body?: object) {
  const params = new URLSearchParams();
  params.set("platform", platform);
  if (accountId) params.set("pageId", accountId);
  const query = params.size ? `?${params.toString()}` : "";
  const url = `/api/v1/marketing-settings/lead-intake-profiles${suffix}${query}`;
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${getAccessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify({ ...body, platform, pageId: accountId }) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Không thể xử lý cấu hình Lead.");
  return result.data;
}

function normalizeFlow(flow: Flow): Flow {
  return { ...flow, fields: (flow.fields || []).map(field => ({
    ...field,
    type: field.type || "text",
    required: field.required !== false,
    options: Array.isArray(field.options) ? field.options : [],
  })) };
}

export function PageChatFlowEditor({ pageId, platform = "facebook" }: { pageId: string; platform?: Platform }) {
  const [goal, setGoal] = useState("");
  const [draft, setDraft] = useState<Flow | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDraft(null); setActiveVersion(null); setError(""); setNotice("");
    if (!pageId) return () => { cancelled = true; };
    void requestFlow(platform, pageId).then((data: { profiles?: Flow[]; fallbackProfiles?: Flow[] }) => {
      if (cancelled) return;
      const scoped = (data.profiles || []).map(normalizeFlow);
      const fallback = (data.fallbackProfiles || []).map(normalizeFlow);
      const active = scoped.find(flow => flow.status === "active");
      const existingDraft = scoped.find(flow => flow.status === "draft");
      const sharedTemplate = fallback.find(flow => flow.status === "active");
      const base = existingDraft || active || sharedTemplate;
      const nextDraft = base ? { ...base, version: existingDraft ? base.version : 0, status: "draft" as const,
        platform, accountId: pageId, fields: base.fields.map(field => ({ ...field, options: [...field.options] })) } : {
        version: 0, status: "draft" as const, goal: "", platform, accountId: pageId,
        fields: [{ key: "ho_ten", label: "Họ tên", question: "Anh/chị cho em xin họ tên để tiện tư vấn ạ?", type: "text" as const, required: true, options: [] }],
        completionMessage: "Cảm ơn anh/chị, bên em sẽ liên hệ tư vấn sớm ạ.",
      };
      setActiveVersion(active?.version || null);
      setDraft(nextDraft);
      setGoal(nextDraft.goal || "");
      if (!active && !existingDraft && sharedTemplate) setNotice("Đang dùng cấu hình chung làm mẫu. Lưu và kích hoạt để tạo bộ trường riêng cho tài khoản này.");
    }).catch((cause: Error) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, [pageId, platform]);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xử lý cấu hình Lead."); }
    finally { setBusy(false); }
  }

  function updateField(index: number, next: Partial<Field>) {
    setDraft(current => current ? { ...current, version: 0, fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...next } : field) } : current);
  }

  if (!pageId) return <section className="space-y-2 border-t border-outline-variant pt-4" aria-label="Cấu hình thu thập Lead">
    <h5 className="text-sm font-semibold text-on-surface">Cấu hình thu thập Lead</h5>
    <p className="text-xs text-on-surface-variant">Chọn một tài khoản Facebook, Zalo hoặc TikTok để cấu hình riêng các trường Lead của tài khoản đó.</p>
  </section>;

  return <section className="space-y-3 border-t border-outline-variant pt-4" aria-label="Cấu hình thu thập Lead">
    <div>
      <h5 className="text-sm font-semibold text-on-surface">Cấu hình thu thập Lead</h5>
      <p className="mt-1 text-xs text-on-surface-variant">Bộ trường chỉ áp dụng cho tài khoản đang chọn: <strong>{platform.toUpperCase()} · {pageId}</strong>. Cấu hình được tách riêng theo từng doanh nghiệp và tài khoản.</p>
    </div>
      {activeVersion && <p className="text-xs text-on-surface-variant">Bản đang chạy: {activeVersion}. Lưu thay đổi thành bản nháp rồi kích hoạt để áp dụng.</p>}
      <label className="block space-y-1 text-xs font-medium text-on-surface">Mục đích thu thập
        <textarea className={input} rows={2} value={goal} onChange={event => setGoal(event.target.value)} placeholder="Ví dụ: Thu thập thông tin người cần tư vấn khóa học" />
      </label>
      <button type="button" disabled={busy || !goal.trim()} onClick={() => void run(async () => {
        const suggestion = await requestFlow(platform, pageId, "/suggest", { goal });
        setDraft(normalizeFlow({ ...suggestion, status: "draft", version: 0 }));
        setNotice("Đã tạo đề xuất. Kiểm tra câu hỏi và kiểu dữ liệu trước khi lưu.");
      })} className={button}>Đề xuất trường bằng AI</button>
      <p className="text-xs text-on-surface-variant">Nếu chọn tài khoản, AI dùng thêm tài liệu và kịch bản tư vấn của tài khoản đó để gợi ý.</p>
      {draft && <div className="space-y-3 rounded-md border border-outline-variant bg-surface p-3">
        <p className="text-xs text-on-surface-variant">Bản nháp {draft.version || "mới"} · Các trường bắt buộc sẽ được bot hỏi. Trường tùy chọn được lưu khi khách tự cung cấp.</p>
        {draft.fields.map((field, index) => <fieldset key={field.key || index} className="space-y-2 border-b border-outline-variant pb-3">
          <legend className="px-1 text-xs font-semibold text-on-surface">Trường {index + 1}</legend>
          <label className="block space-y-1 text-xs text-on-surface">Mã trường
            <input className={input} value={field.key} onChange={event => updateField(index, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40) })} placeholder="vi_du: muc_dich" />
          </label>
          <label className="block space-y-1 text-xs text-on-surface">Tên hiển thị
            <input className={input} value={field.label} onChange={event => updateField(index, { label: event.target.value })} placeholder="Ví dụ: Mục đích tư vấn" />
          </label>
          <label className="block space-y-1 text-xs text-on-surface">Câu hỏi bot sẽ gửi
            <textarea className={input} rows={2} value={field.question} onChange={event => updateField(index, { question: event.target.value })} placeholder="Ví dụ: Anh/chị đang cần tư vấn nội dung nào ạ?" />
          </label>
          <label className="block space-y-1 text-xs text-on-surface">Kiểu dữ liệu
            <select className={input} value={field.type} onChange={event => {
              const type = event.target.value as LeadIntakeFieldType;
              updateField(index, { type, options: type === "single_select" || type === "multi_select" ? (field.options.length >= 2 ? field.options : ["Lựa chọn 1", "Lựa chọn 2"]) : [] });
            }}>
              {fieldTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          {(field.type === "single_select" || field.type === "multi_select") && <label className="block space-y-1 text-xs text-on-surface">Các lựa chọn (mỗi dòng một lựa chọn)
            <textarea className={input} rows={3} value={(field.options || []).join("\n")} onChange={event => updateField(index, { options: event.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean).slice(0, 30) })} placeholder={"Tư vấn khóa học\nTư vấn học phí"} />
          </label>}
          <label className="inline-flex items-center gap-2 text-xs text-on-surface">
            <input type="checkbox" checked={field.required !== false} onChange={event => updateField(index, { required: event.target.checked })} className="size-4 accent-primary focus-visible:outline-1 focus-visible:outline-primary" />
            Bắt buộc phải có câu trả lời
          </label>
          <button type="button" disabled={busy || draft.fields.length <= 1} onClick={() => setDraft({ ...draft, version: 0, fields: draft.fields.filter((_, fieldIndex) => fieldIndex !== index) })} className="ml-3 text-xs text-error underline disabled:opacity-50 focus-visible:outline-1 focus-visible:outline-primary">Xóa trường</button>
        </fieldset>)}
        <button type="button" disabled={busy || draft.fields.length >= 30} onClick={() => setDraft({ ...draft, version: 0, fields: [...draft.fields, { key: "", label: "", question: "", type: "text", required: true, options: [] }] })} className={button}>Thêm trường thông tin</button>
        <label className="block space-y-1 text-xs text-on-surface">Lời nhắn khi thu thập xong
          <textarea className={input} rows={2} value={draft.completionMessage} onChange={event => setDraft({ ...draft, version: 0, completionMessage: event.target.value })} placeholder="Cảm ơn anh/chị, bên em sẽ liên hệ tư vấn sớm ạ." />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void run(async () => {
            const saved = await requestFlow(platform, pageId, "/draft", { goal: goal.trim() || draft.goal, fields: draft.fields, completionMessage: draft.completionMessage, sourceDocumentIds: draft.sourceDocumentIds });
            setDraft(normalizeFlow(saved)); setNotice("Đã lưu bản nháp.");
          })} className={button}>{busy ? "Đang lưu…" : "Lưu bản nháp"}</button>
          <button
            type="button"
            disabled={busy || draft.fields.some(field => !field.key.trim() || !field.label.trim() || !field.question.trim())}
            onClick={() => void run(async () => {
              const saved = await requestFlow(platform, pageId, "/draft", { goal: goal.trim() || draft.goal, fields: draft.fields, completionMessage: draft.completionMessage, sourceDocumentIds: draft.sourceDocumentIds });
              const normalized = normalizeFlow(saved);
              if (normalized.version > 0) {
                await requestFlow(platform, pageId, `/${normalized.version}/activate`, {});
                setActiveVersion(normalized.version);
                setDraft({ ...normalized, version: 0, status: "draft" });
                setNotice(`Đã lưu và áp dụng riêng cho tài khoản ${platform.toUpperCase()} · ${pageId}.`);
              } else {
                setDraft(normalized);
                setNotice("Đã lưu bản nháp.");
              }
            })}
            className={`${button} border-primary bg-primary text-on-primary hover:opacity-90`}
          >
            {busy ? "Đang áp dụng…" : "Lưu & Áp dụng"}
          </button>
          {draft.version > 0 && <button type="button" disabled={busy || draft.fields.some(field => !field.key.trim() || !field.label.trim() || !field.question.trim())} onClick={() => void run(async () => {
            await requestFlow(platform, pageId, `/${draft.version}/activate`, {});
            setActiveVersion(draft.version); setDraft({ ...draft, version: 0, status: "draft" }); setNotice(`Đã áp dụng riêng cho tài khoản ${platform.toUpperCase()} · ${pageId}.`);
          })} className={button}>Kích hoạt bản nháp v{draft.version}</button>}
        </div>
      </div>}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      {notice && <p role="status" className="text-xs text-on-surface-variant">{notice}</p>}
  </section>;
}
