import { useEffect, useState } from "react";
import { getAccessToken } from "../../../../../services/authService";

type Field = { key: string; label: string; question: string };
type Flow = { version: number; status: "draft" | "active" | "archived"; goal: string; fields: Field[]; completionMessage: string; sourceDocumentIds?: string[] };
async function requestFlow(pageId: string, suffix = "", body?: object) {
  const response = await fetch(`/api/v1/marketing-settings/chat-flows/${encodeURIComponent(pageId)}${suffix}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${getAccessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Không thể xử lý luồng tư vấn.");
  return result.data;
}
export function PageChatFlowEditor({ pageId }: { pageId: string }) {
  const [goal, setGoal] = useState("");
  const [draft, setDraft] = useState<Flow | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    setDraft(null); setActiveVersion(null); setError("");
    if (!pageId) return;
    void requestFlow(pageId).then((flows: Flow[]) => {
      if (cancelled) return;
      setActiveVersion(flows.find(flow => flow.status === "active")?.version || null);
      setDraft(flows.find(flow => flow.status === "draft") || null);
    }).catch((cause: Error) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, [pageId]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xử lý luồng tư vấn."); }
    finally { setBusy(false); }
  }
  const input = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary";
  return <section className="space-y-3 border-t border-outline-variant pt-4" aria-label="Luồng tư vấn theo Page">
    <h5 className="text-balance text-sm font-semibold text-on-surface">Luồng tư vấn theo Page</h5>
    {!pageId ? <p className="text-pretty text-xs text-on-surface-variant">Chọn một Page Facebook để cấu hình luồng.</p> : <>
      {activeVersion && <p className="text-xs text-on-surface-variant">Đang dùng phiên bản {activeVersion}</p>}
      <label className="block space-y-1 text-xs font-medium text-on-surface">Mục tiêu tư vấn
        <textarea className={input} rows={3} value={goal} onChange={event => setGoal(event.target.value)} placeholder="Ví dụ: hỏi ba thông tin về sơn, sau đó xin tên và số điện thoại" />
      </label>
      <button type="button" disabled={busy || !goal.trim()} onClick={() => void run(async () => {
        const suggestion = await requestFlow(pageId, "/suggest", { goal });
        setDraft({ ...suggestion, status: "draft", version: 0 });
        setNotice("Đã tạo đề xuất. Xem và sửa trước khi lưu.");
      })} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Đề xuất từ tri thức và rule</button>
      {draft && <div className="space-y-3 rounded-xl border border-outline-variant bg-surface p-3">
        <p className="text-xs text-on-surface-variant">Bản nháp {draft.version || "chưa lưu"} · Kiểm tra thứ tự câu hỏi trước khi kích hoạt.</p>
        {draft.fields.map((field, index) => <div key={index} className="space-y-2 border-b border-outline-variant pb-3">
          <label className="block space-y-1 text-xs text-on-surface">Mã thông tin (chữ thường, không dấu)
            <input className={input} value={field.key} onChange={event => setDraft({ ...draft, version: 0, fields: draft.fields.map((item, i) => i === index ? { ...item, key: event.target.value } : item) })} />
          </label>
          <label className="block space-y-1 text-xs text-on-surface">Tên thông tin
            <input className={input} value={field.label} onChange={event => setDraft({ ...draft, version: 0, fields: draft.fields.map((item, i) => i === index ? { ...item, label: event.target.value } : item) })} />
          </label>
          <label className="block space-y-1 text-xs text-on-surface">Câu hỏi
            <textarea className={input} rows={2} value={field.question} onChange={event => setDraft({ ...draft, version: 0, fields: draft.fields.map((item, i) => i === index ? { ...item, question: event.target.value } : item) })} />
          </label>
          <button type="button" disabled={busy || draft.fields.length <= 1} onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, i) => i !== index), version: 0 })} className="text-xs text-on-surface-variant underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Bỏ câu hỏi</button>
        </div>)}
        <button type="button" disabled={busy || draft.fields.length >= 12} onClick={() => setDraft({ ...draft, fields: [...draft.fields, { key: "", label: "", question: "" }], version: 0 })} className="rounded-lg border border-outline px-3 py-2 text-sm text-on-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Thêm câu hỏi</button>
        <label className="block space-y-1 text-xs text-on-surface">Lời nhắn khi hoàn tất
          <textarea className={input} rows={2} value={draft.completionMessage} onChange={event => setDraft({ ...draft, version: 0, completionMessage: event.target.value })} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void run(async () => {
            const saved = await requestFlow(pageId, "/draft", { goal: draft.goal, fields: draft.fields, completionMessage: draft.completionMessage, sourceDocumentIds: draft.sourceDocumentIds });
            setDraft(saved); setNotice("Đã lưu bản nháp.");
          })} className="rounded-lg border border-outline px-3 py-2 text-sm text-on-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Lưu bản nháp</button>
          {draft.version > 0 && <button type="button" disabled={busy} onClick={() => void run(async () => {
            await requestFlow(pageId, `/${draft.version}/activate`, {});
            setActiveVersion(draft.version); setDraft(null); setNotice("Đã kích hoạt luồng cho Page.");
          })} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">Kích hoạt</button>}
        </div>
      </div>}
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      {notice && <p role="status" className="text-xs text-on-surface-variant">{notice}</p>}
    </>}
  </section>;
}
