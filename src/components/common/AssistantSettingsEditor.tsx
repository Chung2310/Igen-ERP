import { useState, type FormEvent, type ReactNode } from "react";
import { Bot, Brain, MessageSquare, Settings2, type LucideIcon } from "lucide-react";
import type { AssistantSettings } from "../../shared/assistant-workflow";
import { assistantService } from "../../services/assistantService";
import { cn } from "../../modules/student-management/lib/utils";

const control = "w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-base text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

type ToggleKey = "enterToSend" | "showSuggestions" | "alwaysConfirm" | "speakReplies" | "wakeWordEnabled" | "autoMemoryEnabled" | "memoryEnabled";
type ToggleSetting = { key: ToggleKey; label: string; help: string };

const conversationSettings: ToggleSetting[] = [
  { key: "enterToSend", label: "Nhấn Enter để gửi tin nhắn", help: "Nhấn Shift + Enter để xuống dòng." },
  { key: "showSuggestions", label: "Hiện gợi ý yêu cầu khi bắt đầu trò chuyện", help: "Gợi ý giúp bạn bắt đầu một yêu cầu mới nhanh hơn." },
  { key: "wakeWordEnabled", label: "Nghe lệnh bằng từ khóa “Hey Igen”", help: "Khi bật, trình duyệt sẽ chờ từ khóa qua micro. Sau khi nghe câu lệnh, trợ lý tự dừng ghi âm, gửi yêu cầu rồi tiếp tục chờ từ khóa. Cần cấp quyền dùng micro cho trình duyệt." },
];

const responseSettings: ToggleSetting[] = [
  { key: "alwaysConfirm", label: "Luôn xác nhận trước khi thay đổi dữ liệu", help: "Các xác nhận bắt buộc của từng workflow vẫn được giữ nguyên khi tắt tùy chọn này." },
  { key: "speakReplies", label: "Đọc câu trả lời thành tiếng", help: "Dùng giọng tiếng Việt có sẵn trên trình duyệt hoặc thiết bị, không cần khóa API. Nếu chưa có giọng tiếng Việt, hãy thêm giọng trong cài đặt hệ điều hành; câu trả lời cũ không tự phát." },
];

const memorySettings: ToggleSetting[] = [
  { key: "autoMemoryEnabled", label: "Tự động lưu thông tin hữu ích", help: "Chỉ lưu sở thích và quy ước ổn định. Bạn có thể xem, sửa hoặc xóa trong mục Ghi nhớ. Không lưu hồ sơ nghiệp vụ, dữ liệu nhạy cảm hay thông tin xác thực." },
  { key: "memoryEnabled", label: "Cho phép trợ lý dùng ghi nhớ của tôi", help: "Khi bật, trợ lý có thể tham khảo ghi nhớ trong các cuộc trò chuyện. Tắt mục này không xóa ghi nhớ hiện có." },
];

function SettingsSection({ id, title, description, icon: Icon, children, className }: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return <section aria-labelledby={id} className={cn("min-w-0 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5", className)}>
    <header className="mb-4 flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h4 id={id} className="text-balance text-sm font-semibold">{title}</h4>
        <p className="mt-1 text-pretty text-xs leading-5 text-on-surface/70">{description}</p>
      </div>
    </header>
    <div className="space-y-3">{children}</div>
  </section>;
}

function PreferenceToggle({ item, checked, onChange }: {
  item: ToggleSetting;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const inputId = `assistant-${item.key}`;
  const labelId = `${inputId}-label`;
  const helpId = `assistant-${item.key}-help`;
  return <div className="rounded-xl border border-outline-variant bg-surface p-3.5 hover:bg-surface-container-low">
    <div className="flex items-start justify-between gap-4">
      <label id={labelId} htmlFor={inputId} className="cursor-pointer text-sm font-medium">{item.label}</label>
      <input id={inputId} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} aria-labelledby={labelId} aria-describedby={helpId} className={cn("mt-0.5 size-5 shrink-0 cursor-pointer accent-primary", focusClass)} />
    </div>
    <p id={helpId} className="mt-1 text-pretty text-xs leading-5 text-on-surface/70">{item.help}</p>
  </div>;
}

export function AssistantSettingsEditor({ settings, onSave }: { settings: AssistantSettings; onSave: (value: AssistantSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);
  const updateToggle = (key: ToggleKey, value: boolean) => setDraft(current => ({ ...current, [key]: value }));

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await assistantService.saveSettings(draft);
      onSave(saved); setDraft(saved); setNotice("Đã lưu và áp dụng cài đặt trợ lý.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const value = await assistantService.settings();
      onSave(value); setDraft(value);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return <form aria-label="Cài đặt trợ lý" aria-busy={busy} className="flex min-h-0 flex-1 flex-col" onSubmit={event => void save(event)}>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
      <header className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary"><Bot className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h3 className="text-balance font-semibold">Cài đặt trợ lý của tôi</h3>
            <p className="mt-1 text-pretty text-sm text-on-surface/70">Tùy chỉnh trải nghiệm chat cho tài khoản của bạn trên mọi thiết bị.</p>
          </div>
        </div>
        <span className="hidden shrink-0 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-medium text-on-surface/70 sm:inline-flex">Cài đặt cá nhân</span>
      </header>

      <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-60">
        <legend className="sr-only">Tùy chọn trợ lý</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsSection id="assistant-conversation-title" title="Trò chuyện" description="Thiết lập cách nhập yêu cầu và bắt đầu phiên chat." icon={MessageSquare} className="lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-outline-variant bg-surface p-3.5">
                <label htmlFor="assistant-window-mode" className="text-sm font-medium">Kích thước khi mở</label>
                <select id="assistant-window-mode" className={control} value={draft.windowMode} onChange={event => setDraft(current => ({ ...current, windowMode: event.target.value as AssistantSettings["windowMode"] }))}>
                  <option value="window">Cửa sổ lớn</option>
                  <option value="fullscreen">Toàn màn hình</option>
                </select>
                <p className="text-pretty text-xs leading-5 text-on-surface/70">Trên điện thoại, trợ lý luôn mở toàn màn hình.</p>
              </div>
              {conversationSettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
            </div>
          </SettingsSection>

          <SettingsSection id="assistant-response-title" title="Trả lời và xác nhận" description="Chọn cách trợ lý phản hồi và xử lý các thao tác cập nhật." icon={Settings2}>
            {responseSettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
          </SettingsSection>

          <SettingsSection id="assistant-memory-preferences-title" title="Ghi nhớ cá nhân" description="Kiểm soát việc lưu và sử dụng thông tin hữu ích cho riêng bạn." icon={Brain}>
            {memorySettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
          </SettingsSection>

          <SettingsSection id="assistant-personalization-title" title="Hướng dẫn và cách trả lời" description="Thêm quy ước riêng và điều chỉnh giọng điệu câu trả lời." icon={Bot} className="lg:col-span-2">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-outline-variant bg-surface p-3.5">
                <label htmlFor="assistant-instructions" className="text-sm font-medium">Hướng dẫn hiểu yêu cầu</label>
                <textarea id="assistant-instructions" rows={5} maxLength={2000} value={draft.instructions} onChange={event => setDraft(current => ({ ...current, instructions: event.target.value }))} aria-describedby="assistant-instructions-help" className={cn(control, "resize-y")} />
                <p id="assistant-instructions-help" className="text-pretty text-xs leading-5 text-on-surface/70">Ví dụ: tên gọi nội bộ như “KT” nghĩa là “Kỹ thuật”. Quy tắc bắt buộc và giá trị mặc định được cài ở từng workflow.</p>
              </div>
              <div className="space-y-2 rounded-xl border border-outline-variant bg-surface p-3.5">
                <label htmlFor="assistant-response-rules" className="text-sm font-medium">Quy tắc trả lời</label>
                <textarea id="assistant-response-rules" rows={5} maxLength={2000} value={draft.responseRules} onChange={event => setDraft(current => ({ ...current, responseRules: event.target.value }))} aria-describedby="assistant-response-rules-help assistant-response-rules-count" className={cn(control, "resize-y")} />
                <p id="assistant-response-rules-help" className="text-pretty text-xs leading-5 text-on-surface/70">Điều chỉnh cách diễn đạt; trợ lý vẫn giữ nguyên dữ liệu, quyền truy cập và các xác nhận bắt buộc. Xóa hết nội dung rồi lưu để khôi phục mặc định.</p>
                <p id="assistant-response-rules-count" className="text-right text-xs tabular-nums text-on-surface/70">{draft.responseRules.length}/2000</p>
              </div>
            </div>
          </SettingsSection>
        </div>
      </fieldset>
    </div>

    <footer className="shrink-0 space-y-2 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 sm:px-6">
      {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
      {notice && <p role="status" className="text-pretty text-sm text-on-surface">{notice}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !dirty} className={cn("min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>{busy ? "Đang lưu…" : "Lưu cài đặt"}</button>
        <button type="button" disabled={busy || !dirty} onClick={() => { setDraft(settings); setError(""); setNotice(""); }} className={cn("min-h-10 rounded-xl border border-outline-variant bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Bỏ thay đổi</button>
        {error && <button type="button" disabled={busy} onClick={() => void reload()} className={cn("min-h-10 rounded-xl border border-outline-variant bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-container-low disabled:opacity-40", focusClass)}>Tải lại cài đặt</button>}
      </div>
    </footer>
  </form>;
}
