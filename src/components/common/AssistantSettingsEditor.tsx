import { useState } from "react";
import type { AssistantSettings } from "../../shared/assistant-workflow";
import { assistantService } from "../../services/assistantService";
const control = "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-base text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
export function AssistantSettingsEditor({ settings, onSave }: { settings: AssistantSettings; onSave: (value: AssistantSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);
  return <form aria-label="Cài đặt trợ lý" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { const saved = await assistantService.saveSettings(draft); onSave(saved); setDraft(saved); setNotice("Đã lưu và áp dụng cài đặt trợ lý."); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }}>
    <div><h3 className="text-balance font-semibold">Cài đặt trợ lý của tôi</h3><p className="mt-1 text-pretty text-sm text-on-surface/70">Áp dụng cho tài khoản của bạn trong công ty này, trên mọi thiết bị.</p></div>
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-50">
      <div className="space-y-2"><label htmlFor="assistant-window-mode" className="text-sm font-medium">Kích thước khi mở</label><select id="assistant-window-mode" className={control} value={draft.windowMode} onChange={event => setDraft({ ...draft, windowMode: event.target.value as AssistantSettings["windowMode"] })}><option value="window">Cửa sổ lớn</option><option value="fullscreen">Toàn màn hình</option></select><p className="text-sm text-on-surface/70">Trên điện thoại, trợ lý luôn mở toàn màn hình.</p></div>
      {([{ key: "enterToSend", label: "Nhấn Enter để gửi tin nhắn", help: "Shift + Enter luôn xuống dòng." }, { key: "showSuggestions", label: "Hiện gợi ý yêu cầu khi bắt đầu trò chuyện", help: "Gợi ý giúp bạn bắt đầu một thao tác mới." }, { key: "alwaysConfirm", label: "Luôn xác nhận trước khi thay đổi dữ liệu", help: "Tắt tùy chọn này vẫn giữ các bước xác nhận bắt buộc của từng workflow." }, { key: "speakReplies", label: "Đọc câu trả lời thành tiếng", help: "Dùng giọng đọc tiếng Việt của trình duyệt cho câu trả lời mới. Có thể dừng đọc ngay trong khung chat; lịch sử cũ không tự phát." }] as const).map(item => <div key={item.key}><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={draft[item.key]} onChange={event => setDraft({ ...draft, [item.key]: event.target.checked })} aria-describedby={`assistant-${item.key}-help`} className="mt-1 size-4 accent-primary focus-visible:ring-2 focus-visible:ring-primary" /><span>{item.label}</span></label><p id={`assistant-${item.key}-help`} className="mt-1 text-pretty text-sm text-on-surface/70">{item.help}</p></div>)}
      <div className="space-y-2"><label htmlFor="assistant-instructions" className="text-sm font-medium">Hướng dẫn riêng cho trợ lý</label><textarea id="assistant-instructions" rows={5} maxLength={2000} value={draft.instructions} onChange={event => setDraft({ ...draft, instructions: event.target.value })} aria-describedby="assistant-instructions-help" className={control} /><p id="assistant-instructions-help" className="text-pretty text-sm text-on-surface/70">Ví dụ: cách hiểu tên gọi nội bộ khi phân tích yêu cầu. Quy tắc trường bắt buộc và giá trị mặc định được cài ở từng workflow. Không nhập mật khẩu hoặc thông tin bí mật.</p></div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {notice && <p role="status" className="text-sm text-on-surface">{notice}</p>}
    <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || !dirty} className="rounded-xl bg-primary px-4 py-2 text-sm text-on-primary focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40">{busy ? "Đang lưu…" : "Lưu cài đặt"}</button><button type="button" disabled={busy || !dirty} onClick={() => { setDraft(settings); setError(""); setNotice(""); }} className="rounded-xl border border-outline-variant px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40">Bỏ thay đổi</button>{error && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { const value = await assistantService.settings(); onSave(value); setDraft(value); setError(""); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }} className="rounded-xl border border-outline-variant px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary">Tải lại cài đặt</button>}</div>
  </form>;
}
