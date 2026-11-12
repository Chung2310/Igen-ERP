import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Bot, Brain, MessageSquare, Settings2, type LucideIcon } from "lucide-react";
import type { AssistantSettings } from "../../shared/assistant-workflow";
import { assistantService } from "../../services/assistantService";
import { cn } from "../../modules/student-management/lib/utils";
import AssistantSpeechVoicePicker from "./AssistantSpeechVoicePicker";

const control = "min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base text-on-surface focus-visible:border-primary focus-visible:outline-none";
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
  { key: "speakReplies", label: "Đọc câu trả lời thành tiếng", help: "Tạo giọng tiếng Việt qua OpenRouter và phát khi trợ lý trả lời. Mỗi lần tạo âm thanh có tính phí theo số ký tự; câu trả lời cũ không tự phát." },
];

const memorySettings: ToggleSetting[] = [
  { key: "autoMemoryEnabled", label: "Tự động lưu thông tin hữu ích", help: "Chỉ lưu sở thích và quy ước ổn định. Bạn có thể xem, sửa hoặc xóa trong mục Ghi nhớ. Không lưu hồ sơ nghiệp vụ, dữ liệu nhạy cảm hay thông tin xác thực." },
  { key: "memoryEnabled", label: "Cho phép trợ lý dùng ghi nhớ của tôi", help: "Khi bật, trợ lý có thể tham khảo ghi nhớ trong các cuộc trò chuyện. Tắt mục này không xóa ghi nhớ hiện có." },
];

function SettingsSection({ id, title, description, icon: Icon, children }: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return <section aria-labelledby={id} className="min-w-0 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
    <header className="mb-4 flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h4 id={id} className="text-balance text-base font-semibold">{title}</h4>
        <p className="mt-1 text-pretty text-sm leading-6 text-on-surface-variant">{description}</p>
      </div>
    </header>
    <div className="divide-y divide-outline-variant">{children}</div>
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
  return <label htmlFor={inputId} className="flex min-h-14 cursor-pointer items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
    <span className="min-w-0">
      <span id={labelId} className="block text-sm font-medium leading-6 text-on-surface">{item.label}</span>
      <span id={helpId} className="mt-1 block text-pretty text-sm leading-6 text-on-surface-variant">{item.help}</span>
    </span>
    <input id={inputId} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} aria-labelledby={labelId} aria-describedby={helpId} className={cn("mt-0.5 size-5 shrink-0 cursor-pointer accent-primary", focusClass)} />
  </label>;
}

export function AssistantSettingsEditor({ settings, onSave }: { settings: AssistantSettings; onSave: (value: AssistantSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "playing">("idle");
  const [previewError, setPreviewError] = useState("");
  const previewControllerRef = useRef<AbortController | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewRunRef = useRef(0);
  const dirty = JSON.stringify(settings) !== JSON.stringify(draft);
  const updateToggle = (key: ToggleKey, value: boolean) => setDraft(current => ({ ...current, [key]: value }));

  const stopPreview = useCallback(() => {
    previewRunRef.current += 1;
    previewControllerRef.current?.abort();
    previewControllerRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.onended = null;
      previewAudioRef.current.onerror = null;
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewState("idle");
  }, []);
  useEffect(() => () => { stopPreview(); }, [stopPreview]);

  const togglePreview = async () => {
    if (previewState !== "idle") { stopPreview(); return; }
    setPreviewError("");
    setPreviewState("loading");
    const runId = ++previewRunRef.current;
    const controller = new AbortController();
    previewControllerRef.current = controller;
    try {
      const blob = await assistantService.speech("Xin chào, mình là trợ lý Igen. Rất vui được hỗ trợ bạn.", controller.signal, draft.speechVoice);
      if (controller.signal.aborted || runId !== previewRunRef.current) return;
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => { if (runId === previewRunRef.current) stopPreview(); };
      audio.onerror = () => {
        if (runId !== previewRunRef.current) return;
        stopPreview();
        setPreviewError("Không thể phát đoạn nghe thử trên thiết bị này.");
      };
      await audio.play();
      if (runId === previewRunRef.current) setPreviewState("playing");
    } catch (cause) {
      if (controller.signal.aborted || runId !== previewRunRef.current) return;
      stopPreview();
      const reason = cause as Error;
      setPreviewError(reason.name === "NotAllowedError"
        ? "Trình duyệt đang chặn phát âm thanh. Hãy cho phép trang này phát âm thanh rồi thử lại."
        : reason.message || "Không thể nghe thử giọng đọc lúc này.");
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    stopPreview();
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
    stopPreview();
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
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain bg-surface p-4 sm:p-6">
      <header className="mx-auto max-w-3xl">
        <h3 className="text-balance text-lg font-semibold text-on-surface">Tùy chỉnh trải nghiệm</h3>
        <p className="mt-1 text-pretty text-sm leading-6 text-on-surface-variant">Các tùy chọn dưới đây áp dụng cho tài khoản của bạn trên mọi thiết bị.</p>
      </header>

      <fieldset disabled={busy} className="mx-auto max-w-3xl min-w-0 space-y-4 disabled:opacity-60">
        <legend className="sr-only">Tùy chọn trợ lý</legend>
        <div className="space-y-4">
          <SettingsSection id="assistant-conversation-title" title="Trò chuyện" description="Thiết lập cách nhập yêu cầu và bắt đầu phiên chat." icon={MessageSquare}>
            <div className="space-y-2 py-4 first:pt-0 last:pb-0">
              <label htmlFor="assistant-window-mode" className="block text-sm font-medium">Kích thước khi mở</label>
              <select id="assistant-window-mode" className={control} value={draft.windowMode} onChange={event => setDraft(current => ({ ...current, windowMode: event.target.value as AssistantSettings["windowMode"] }))} aria-describedby="assistant-window-mode-help">
                <option value="window">Cửa sổ lớn</option>
                <option value="fullscreen">Toàn màn hình</option>
              </select>
              <p id="assistant-window-mode-help" className="text-pretty text-sm leading-6 text-on-surface-variant">Trên điện thoại, trợ lý luôn mở toàn màn hình.</p>
            </div>
            {conversationSettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
          </SettingsSection>

          <SettingsSection id="assistant-response-title" title="Trả lời và xác nhận" description="Chọn cách trợ lý phản hồi và xử lý các thao tác cập nhật." icon={Settings2}>
            {responseSettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
            <div className="space-y-2 py-4 first:pt-0 last:pb-0">
              <AssistantSpeechVoicePicker
                value={draft.speechVoice}
                describedBy="assistant-speech-voice-help"
                onChange={voice => {
                  stopPreview();
                  setPreviewError("");
                  setDraft(current => ({ ...current, speechVoice: voice }));
                }}
              />
              <p id="assistant-speech-voice-help" className="text-pretty text-sm leading-6 text-on-surface-variant">Chọn giọng rồi lưu để dùng cho câu trả lời tiếp theo. Nghe thử cũng tạo âm thanh qua OpenRouter và có tính phí.</p>
              <button type="button" onClick={() => void togglePreview()} aria-pressed={previewState !== "idle"} className={cn("min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}>{previewState === "idle" ? "Nghe thử giọng" : "Dừng nghe thử"}</button>
              {previewState !== "idle" && <p role="status" className="text-pretty text-sm text-on-surface-variant">{previewState === "loading" ? "Đang tạo đoạn nghe thử…" : "Đang phát đoạn nghe thử."}</p>}
              {previewError && <p role="alert" className="text-pretty text-sm text-error">{previewError}</p>}
            </div>
          </SettingsSection>

          <SettingsSection id="assistant-memory-preferences-title" title="Ghi nhớ cá nhân" description="Kiểm soát việc lưu và sử dụng thông tin hữu ích cho riêng bạn." icon={Brain}>
            {memorySettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
          </SettingsSection>

          <SettingsSection id="assistant-personalization-title" title="Hướng dẫn và cách trả lời" description="Thêm quy ước riêng và điều chỉnh giọng điệu câu trả lời." icon={Bot}>
            <div className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="assistant-instructions" className="block text-sm font-medium">Hướng dẫn hiểu yêu cầu</label>
                <textarea id="assistant-instructions" rows={5} maxLength={2000} value={draft.instructions} onChange={event => setDraft(current => ({ ...current, instructions: event.target.value }))} aria-describedby="assistant-instructions-help" className={cn(control, "resize-y")} />
                <p id="assistant-instructions-help" className="text-pretty text-sm leading-6 text-on-surface-variant">Ví dụ: tên gọi nội bộ như “KT” nghĩa là “Kỹ thuật”. Quy tắc bắt buộc và giá trị mặc định được cài ở từng workflow.</p>
              </div>
              <div className="space-y-2 border-t border-outline-variant pt-5">
                <label htmlFor="assistant-response-rules" className="block text-sm font-medium">Quy tắc trả lời</label>
                <textarea id="assistant-response-rules" rows={5} maxLength={2000} value={draft.responseRules} onChange={event => setDraft(current => ({ ...current, responseRules: event.target.value }))} aria-describedby="assistant-response-rules-help assistant-response-rules-count" className={cn(control, "resize-y")} />
                <p id="assistant-response-rules-help" className="text-pretty text-sm leading-6 text-on-surface-variant">Điều chỉnh cách diễn đạt; trợ lý vẫn giữ nguyên dữ liệu, quyền truy cập và các xác nhận bắt buộc. Xóa hết nội dung rồi lưu để khôi phục mặc định.</p>
                <p id="assistant-response-rules-count" className="text-right text-xs tabular-nums text-on-surface-variant">{draft.responseRules.length}/2000</p>
              </div>
            </div>
          </SettingsSection>
        </div>
      </fieldset>
    </div>

    <footer className="shrink-0 space-y-2 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 sm:px-6">
      {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
      {notice && <p role="status" className="text-pretty text-sm text-on-surface">{notice}</p>}
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <button type="submit" disabled={busy || !dirty} className={cn("min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>{busy ? "Đang lưu…" : "Lưu cài đặt"}</button>
        <button type="button" disabled={busy || !dirty} onClick={() => { stopPreview(); setDraft(settings); setError(""); setNotice(""); }} className={cn("min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Bỏ thay đổi</button>
        {error && <button type="button" disabled={busy} onClick={() => void reload()} className={cn("min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-40", focusClass)}>Tải lại cài đặt</button>}
      </div>
    </footer>
  </form>;
}
