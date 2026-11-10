import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Bot, Brain, MessageSquare, Volume2, type LucideIcon } from "lucide-react";
import type { AssistantSettings } from "../../shared/assistant-workflow";
import { assistantSpeechVoices, type AssistantSpeechVoice } from "../../shared/assistant-speech-voices";
import { assistantService } from "../../services/assistantService";
import { cn } from "../../modules/student-management/lib/utils";

const control = "min-h-11 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base text-on-surface focus-visible:border-primary focus-visible:outline-none";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

type ToggleKey = "showSuggestions" | "alwaysConfirm" | "speakReplies" | "wakeWordEnabled" | "autoMemoryEnabled" | "memoryEnabled";
type ToggleSetting = { key: ToggleKey; label: string; help?: string };

const conversationSettings: ToggleSetting[] = [
  { key: "showSuggestions", label: "Hiện gợi ý yêu cầu khi bắt đầu trò chuyện" },
  { key: "alwaysConfirm", label: "Luôn xác nhận trước khi thay đổi dữ liệu", help: "Vẫn giữ các xác nhận bắt buộc khi tắt." },
];

const voiceSettings: ToggleSetting[] = [
  { key: "speakReplies", label: "Đọc câu trả lời thành tiếng", help: "Tính phí theo số ký tự." },
  { key: "wakeWordEnabled", label: "Nghe lệnh bằng từ khóa “Hey Igen”", help: "Cần cấp quyền micro. Câu lệnh tự gửi sau khi nói." },
];

const memorySettings: ToggleSetting[] = [
  { key: "autoMemoryEnabled", label: "Tự động lưu thông tin hữu ích", help: "Lưu sở thích, quy ước; không lưu dữ liệu nhạy cảm." },
  { key: "memoryEnabled", label: "Cho phép trợ lý dùng ghi nhớ của tôi", help: "Tắt không xóa ghi nhớ đã lưu." },
];

function SettingsSection({ id, title, icon: Icon, children }: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return <section aria-labelledby={id} className="min-w-0 border-b border-outline-variant pb-6 last:border-0 last:pb-0">
    <header className="mb-2 flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
      <h4 id={id} className="text-balance text-sm font-semibold text-on-surface">{title}</h4>
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
  return <label htmlFor={inputId} className="flex min-h-14 cursor-pointer items-center justify-between gap-6 py-4 last:pb-0">
    <span className="min-w-0">
      <span id={labelId} className="block text-sm font-medium leading-6 text-on-surface">{item.label}</span>
      {item.help && <span id={helpId} className="mt-1 block text-pretty text-xs leading-5 text-on-surface-variant">{item.help}</span>}
    </span>
    <input id={inputId} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} aria-labelledby={labelId} aria-describedby={item.help ? helpId : undefined} className={cn("size-5 shrink-0 cursor-pointer accent-primary", focusClass)} />
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
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-surface-container-lowest p-4 sm:p-6">
      <header>
        <h3 className="text-balance text-lg font-semibold text-on-surface">Tùy chỉnh trải nghiệm</h3>
      </header>

      <fieldset disabled={busy} className="min-w-0 disabled:opacity-60">
        <legend className="sr-only">Tùy chọn trợ lý</legend>
        <div className="space-y-6">
          <SettingsSection id="assistant-conversation-title" title="Trò chuyện" icon={MessageSquare}>
            {conversationSettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
          </SettingsSection>

          <SettingsSection id="assistant-response-title" title="Giọng nói" icon={Volume2}>
            {voiceSettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
            <div className="space-y-3 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <label htmlFor="assistant-speech-voice" className="text-sm font-medium">Giọng đọc tiếng Việt</label>
                <div className="flex min-w-0 items-center gap-2 sm:shrink-0">
                  <select id="assistant-speech-voice" value={draft.speechVoice} onChange={event => {
                    stopPreview();
                    setPreviewError("");
                    setDraft(current => ({ ...current, speechVoice: event.target.value as AssistantSpeechVoice }));
                  }} aria-describedby="assistant-speech-voice-help" className={cn(control, "flex-1 sm:w-32")}>
                    {assistantSpeechVoices.map(voice => <option key={voice} value={voice}>{voice[0].toUpperCase() + voice.slice(1)}</option>)}
                  </select>
                  <button type="button" onClick={() => void togglePreview()} aria-pressed={previewState !== "idle"} aria-describedby="assistant-speech-voice-help" className={cn("min-h-11 shrink-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}>{previewState === "idle" ? "Nghe thử giọng" : "Dừng nghe thử"}</button>
                </div>
              </div>
              <p id="assistant-speech-voice-help" className="text-pretty text-xs leading-5 text-on-surface-variant">Nghe thử giọng có tính phí.</p>
              {previewState !== "idle" && <p role="status" className="text-pretty text-sm text-on-surface-variant">{previewState === "loading" ? "Đang tạo đoạn nghe thử…" : "Đang phát đoạn nghe thử."}</p>}
              {previewError && <p role="alert" className="text-pretty text-sm text-error">{previewError}</p>}
            </div>
          </SettingsSection>

          <SettingsSection id="assistant-personalization-title" title="Cá nhân hóa" icon={Bot}>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label htmlFor="assistant-instructions" className="block text-sm font-medium">Hướng dẫn hiểu yêu cầu</label>
                <textarea id="assistant-instructions" rows={4} maxLength={2000} value={draft.instructions} onChange={event => setDraft(current => ({ ...current, instructions: event.target.value }))} className={cn(control, "resize-y")} placeholder="Ví dụ: “KT” là tên gọi tắt của phòng Kỹ thuật." />
              </div>
              <div className="space-y-2">
                <label htmlFor="assistant-response-rules" className="block text-sm font-medium">Quy tắc trả lời</label>
                <textarea id="assistant-response-rules" rows={4} maxLength={2000} value={draft.responseRules} onChange={event => setDraft(current => ({ ...current, responseRules: event.target.value }))} aria-describedby="assistant-response-rules-help assistant-response-rules-count" className={cn(control, "resize-y")} placeholder="Ví dụ: Trả lời ngắn gọn bằng tiếng Việt, ưu tiên các bước rõ ràng." />
                <p id="assistant-response-rules-help" className="text-pretty text-xs leading-5 text-on-surface-variant">Để trống rồi lưu để dùng mặc định.</p>
                <p id="assistant-response-rules-count" className="text-right text-xs tabular-nums text-on-surface-variant">{draft.responseRules.length}/2000</p>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection id="assistant-memory-preferences-title" title="Ghi nhớ cá nhân" icon={Brain}>
            {memorySettings.map(item => <PreferenceToggle key={item.key} item={item} checked={draft[item.key]} onChange={value => updateToggle(item.key, value)} />)}
          </SettingsSection>
        </div>
      </fieldset>
    </div>

    <footer className="shrink-0 space-y-2 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 sm:px-6">
      {error && <p role="alert" className="text-pretty text-sm text-error">{error}</p>}
      {notice && <p role="status" className="text-pretty text-sm text-on-surface">{notice}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p id="assistant-settings-save-status" className="mr-auto w-full text-pretty text-xs text-on-surface-variant sm:w-auto" role="status">{busy ? "Đang lưu cài đặt…" : dirty ? "Có thay đổi chưa lưu" : "Chưa có thay đổi"}</p>
        <button type="button" disabled={busy || !dirty} onClick={() => { stopPreview(); setDraft(settings); setError(""); setNotice(""); }} className={cn("min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Bỏ thay đổi</button>
        {error && <button type="button" disabled={busy} onClick={() => void reload()} className={cn("min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>Tải lại cài đặt</button>}
        <button type="submit" disabled={busy || !dirty} aria-describedby="assistant-settings-save-status" className={cn("min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}>{busy ? "Đang lưu…" : "Lưu cài đặt"}</button>
      </div>
    </footer>
  </form>;
}
