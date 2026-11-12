import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronRight, FileText, Link2, LoaderCircle, Paperclip, Plus, Sparkles, Workflow, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { assistantService } from "../../services/assistantService";
import { getAssistantSpeechHistoryUserId } from "../../services/assistantSpeechHistory";
import { Assistant2DFileIcon } from "./Assistant2DFileIcon";
import { listAssistantStudioCreationHistory, saveAssistantStudioCreationHistory, type AssistantStudioCreationRecord } from "../../services/assistantStudioHistory";
import type { AssistantMindmapLocale, AssistantMindmapResult, AssistantMindmapSourceType, AssistantMindmapWriteMode } from "../../shared/assistant-mindmap";
import { AssistantStudioBreadcrumb } from "./AssistantStudioBreadcrumb";
import { AssistantStudioBrandMark } from "./AssistantStudioBrandMark";
import { AssistantStudioHistoryAction, AssistantStudioHistoryDrawer, AssistantStudioHistoryKindIcon } from "./AssistantStudioHistoryDrawer";
import { AssistantStudioMindmapResult as MindmapResult } from "./AssistantStudioMindmapResult";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const maxFileSize = 20 * 1024 * 1024;
const sourceOptions: Array<{ id: AssistantMindmapSourceType; label: string; icon: typeof FileText }> = [
  { id: "text", label: "Văn bản", icon: FileText },
  { id: "document", label: "Tài liệu", icon: FileText },
  { id: "link", label: "Đường dẫn", icon: Link2 },
];

function historyResult(item: AssistantStudioCreationRecord): AssistantMindmapResult | null {
  if (item.kind !== "mindmap" || !item.payload || typeof item.payload !== "object") return null;
  const payload = item.payload as AssistantMindmapResult;
  return payload.root && Array.isArray(payload.root.children) ? payload : null;
}

function TopAction({ children, icon: Icon, onClick, disabled, expanded }: { children: string; icon: typeof Plus; onClick: () => void; disabled?: boolean; expanded?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-expanded={expanded} aria-controls={expanded ? "studio-mindmap-history" : undefined} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Icon className="size-4" aria-hidden="true" />{children}</button>;
}

export function AssistantStudioMindmap({ onBack, historyItem }: { onBack: () => void; historyItem?: AssistantStudioCreationRecord | null }) {
  const initialResult = historyItem ? historyResult(historyItem) : null;
  const [screen, setScreen] = useState<"input" | "result">(() => initialResult ? "result" : "input");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourceType, setSourceType] = useState<AssistantMindmapSourceType>("text");
  const [prompt, setPrompt] = useState(() => initialResult?.prompt || "");
  const [locale, setLocale] = useState<AssistantMindmapLocale>("vi");
  const [writeMode, setWriteMode] = useState<AssistantMindmapWriteMode>("ai");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AssistantMindmapResult | null>(initialResult);
  const [history, setHistory] = useState<AssistantStudioCreationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const promptId = "studio-mindmap-prompt";
  const countId = "studio-mindmap-count";
  const errorId = "studio-mindmap-error";
  const fileHintId = "studio-mindmap-file-hint";

  function selectSource(next: AssistantMindmapSourceType) {
    setSourceType(next);
    setPrompt("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setError("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!selected) return;
    if (selected.size > maxFileSize) {
      setFile(null);
      setError("Tệp tài liệu không được vượt quá 20 MB.");
      return;
    }
    setFile(selected);
    setError("");
  }

  async function createMindmap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (sourceType === "document" && !file) { setError("Chọn tài liệu trước khi tạo mindmap."); return; }
    if (sourceType !== "document" && !prompt.trim()) { setError(sourceType === "link" ? "Dán đường dẫn web cần tạo mindmap." : "Nhập chủ đề hoặc nội dung cần tạo mindmap."); return; }
    setBusy(true);
    setError("");
    try {
      const generated = await assistantService.createStudioMindmap({ sourceType, prompt: prompt.trim(), locale, writeMode, ...(file ? { file } : {}) });
      setResult(generated);
      setScreen("result");
      try {
        await saveAssistantStudioCreationHistory({
          userId: getAssistantSpeechHistoryUserId(),
          kind: "mindmap",
          title: generated.title,
          summary: generated.sourceFileName ? `Từ tài liệu ${generated.sourceFileName}` : generated.subtitle || "Sơ đồ tư duy do AI tạo",
          prompt: prompt.trim(),
          payload: generated,
        });
      } catch { /* Giữ kết quả trên màn hình nếu bộ nhớ lịch sử của trình duyệt không còn chỗ. */ }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tạo mindmap lúc này.");
    } finally {
      setBusy(false);
    }
  }

  async function openHistory() {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    setHistoryLoading(true);
    setError("");
    try {
      const items = await listAssistantStudioCreationHistory(getAssistantSpeechHistoryUserId());
      setHistory(items.filter(item => item.kind === "mindmap"));
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Không tải được lịch sử mindmap.");
    } finally {
      setHistoryLoading(false);
    }
  }
  function createNew() {
    setScreen("input");
    setSourceType("text");
    setPrompt("");
    setFile(null);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function openHistoryItem(item: AssistantStudioCreationRecord) {
    const opened = historyResult(item);
    if (!opened) { setError("Không thể mở mindmap đã lưu này."); return; }
    setResult(opened);
    setPrompt(item.prompt);
    setHistoryOpen(false);
    setScreen("result");
    setError("");
  }

  const canSubmit = !busy && (sourceType === "document" ? Boolean(file) : prompt.trim().length >= 3);

  return <div className="flex min-h-full min-w-0 flex-col bg-surface-container-lowest text-on-surface">
    <header className="grid shrink-0 grid-cols-1 items-center gap-3 border-b border-outline-variant px-4 py-3 sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <AssistantStudioBreadcrumb title="Tạo mindmap" onBack={onBack} titleAsHeading={false} />
      {screen === "result" && <nav aria-label="Tiến trình tạo mindmap" className="order-3 flex justify-center xl:order-none"><ol className="flex items-center gap-2"><li aria-current="step" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-on-primary">1</span>Nhập yêu cầu</li><li aria-hidden="true" className="h-px w-6 bg-outline-variant" /><li className="inline-flex items-center gap-2 text-sm font-medium text-primary"><span className="grid size-7 place-items-center rounded-full border border-primary text-xs">2</span>Tạo mindmap</li></ol></nav>}
      <div className="order-2 flex items-center justify-end gap-2 xl:order-none xl:col-start-3"><TopAction icon={Plus} onClick={createNew} disabled={busy}>Tạo mới</TopAction><AssistantStudioHistoryAction open={historyOpen} onClick={() => void openHistory()} /></div>
    </header>

    {screen === "result" && result ? <MindmapResult map={result} /> : <form onSubmit={createMindmap} aria-label="Thiết lập tạo mindmap" aria-busy={busy} className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-8 sm:px-8 sm:pt-10">
        <div className="text-center"><div className="flex items-center justify-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Workflow className="size-5" aria-hidden="true" /></span><h1 data-typography="page-title" className="text-balance text-[37px] font-bold leading-[1.2]">Tạo mindmap</h1><AssistantStudioBrandMark className="size-7 shrink-0" /></div><p className="mt-2 text-pretty text-base text-on-surface-variant sm:text-lg">Biến ý tưởng thành sơ đồ tư duy rõ ràng, hấp dẫn trong vài giây</p></div>

        <fieldset className="mx-auto mt-7 flex w-fit flex-wrap justify-center gap-1 rounded-full border border-outline-variant bg-surface-container-low p-1" disabled={busy}>
          <legend className="sr-only">Nguồn nội dung tạo mindmap</legend>
          {sourceOptions.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={sourceType === id} onClick={() => selectSource(id)} className={cn("inline-flex min-h-8 items-center gap-2 rounded-full px-4 text-sm text-on-surface-variant transition-colors", sourceType === id ? "bg-surface-container-lowest font-semibold text-primary shadow-sm" : "hover:text-on-surface", focusClass)}><Icon className="size-3.5" aria-hidden="true" />{label}</button>)}
        </fieldset>

        <div className="assistant-slide-composer mt-6 sm:mt-7"><div className="rounded-[27px] bg-surface-container-lowest px-3 py-3 sm:px-4 sm:py-3.5">
          {sourceType === "text" && <><label htmlFor={promptId} className="sr-only">Chủ đề và nội dung tạo mindmap</label><textarea id={promptId} maxLength={10_000} rows={3} value={prompt} onChange={event => { setPrompt(event.currentTarget.value); setError(""); }} placeholder="Nhập chủ đề hoặc nội dung văn bản bạn muốn tạo thành sơ đồ" aria-describedby={`${countId} ${error ? errorId : ""}`} disabled={busy} className="min-h-24 w-full resize-y border-0 bg-transparent px-1 py-1 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none sm:min-h-28 sm:text-base" /></>}
          {sourceType === "document" && <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant p-5 text-center sm:min-h-28"><Assistant2DFileIcon fileName={file?.name ?? "file"} action={file ? undefined : "upload"} className="size-12 shrink-0" /><p className="text-sm font-medium">{file?.name || "Tải tài liệu lên để tạo mindmap"}</p><p id={fileHintId} className="text-xs text-on-surface-variant">PDF, Word, PowerPoint, TXT · tối đa 20 MB</p>{file ? <button type="button" disabled={busy} onClick={() => { setFile(null); setError(""); }} className={cn("inline-flex min-h-9 items-center gap-1 rounded-lg border border-outline-variant px-3 text-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50", focusClass)}><X className="size-4" aria-hidden="true" />Bỏ tài liệu</button> : <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-describedby={error ? errorId : fileHintId} className={cn("mt-1 inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50", focusClass)}><Paperclip className="size-4" aria-hidden="true" />Chọn tài liệu</button>}</div>}
          {sourceType === "link" && <div className="flex min-h-24 items-center px-1 sm:min-h-28"><label htmlFor={promptId} className="sr-only">Đường dẫn nguồn</label><input id={promptId} type="url" maxLength={2048} required value={prompt} onChange={event => { setPrompt(event.currentTarget.value); setError(""); }} placeholder="Dán đường dẫn web công khai bạn muốn chuyển thành mindmap" aria-describedby={`${countId} ${error ? errorId : ""}`} disabled={busy} className="h-12 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none" /></div>}

          <div className="mt-2 flex min-h-10 flex-wrap items-center justify-between gap-3 border-t border-outline-variant/60 pt-2.5 text-sm text-on-surface-variant">
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="studio-mindmap-locale">Ngôn ngữ mindmap</label><select id="studio-mindmap-locale" value={locale} onChange={event => setLocale(event.currentTarget.value as AssistantMindmapLocale)} disabled={busy} className={cn("min-h-9 rounded-full border border-outline-variant bg-surface-container-low px-3 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50", focusClass)}><option value="vi">🇻🇳 Việt Nam</option><option value="en">🇺🇸 English</option><option value="ja">🇯🇵 日本語</option></select>
              <label className="sr-only" htmlFor="studio-mindmap-write-mode">Cách xử lý nội dung</label><select id="studio-mindmap-write-mode" value={writeMode} onChange={event => setWriteMode(event.currentTarget.value as AssistantMindmapWriteMode)} disabled={busy} className={cn("min-h-9 rounded-full border border-outline-variant bg-surface-container-low px-3 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-50", focusClass)}><option value="ai">✦ Viết bằng AI</option><option value="preserve">Giữ nội dung gốc</option></select>
            </div>
            <span id={countId} className="tabular-nums text-xs">{prompt.length.toLocaleString("vi-VN")} / {sourceType === "link" ? "2.048" : "10.000"}</span>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.pptx,.txt" className="sr-only" aria-label="Chọn tệp PDF, Word, PowerPoint hoặc TXT" onChange={chooseFile} />
        </div></div>

        {error && screen === "input" && !historyOpen && <p id={errorId} role="alert" className="mt-3 rounded-lg border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">{error}</p>}
        {busy && <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm text-on-surface-variant"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang đọc nguồn và tạo sơ đồ tư duy…</p>}
      </main>
      <div className="sticky bottom-0 border-t border-outline-variant bg-surface-container-lowest px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-center"><button type="submit" disabled={!canSubmit} aria-describedby={sourceType === "document" && !file ? fileHintId : undefined} className={cn("inline-flex min-h-11 w-full max-w-72 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-on-primary shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang tạo mindmap…</> : <>Tạo mindmap <Sparkles className="size-4" aria-hidden="true" /></>}</button></div>
    </form>}
    <AssistantStudioHistoryDrawer open={historyOpen} title="Lịch sử mindmap" onClose={() => setHistoryOpen(false)}>
      <section aria-label="Danh sách mindmap đã tạo" aria-busy={historyLoading} className="py-3">
        {historyLoading && <p role="status" className="py-3 text-sm text-on-surface-variant">Đang tải lịch sử…</p>}
        {error && <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">{error}</p>}
        {!historyLoading && history.length > 0 && <ul className="divide-y divide-outline-variant">{history.map(item => <li key={item.id}><button type="button" onClick={() => openHistoryItem(item)} className={cn("flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-surface-container-low", focusClass)}><AssistantStudioHistoryKindIcon kind="mindmap" /><span className="min-w-0 flex-1"><span className="block line-clamp-2 text-sm font-semibold text-on-surface">{item.title}</span><span className="mt-1 block line-clamp-2 text-xs text-on-surface-variant">{item.summary}</span><time className="mt-1 block text-xs tabular-nums text-on-surface-variant" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></span><ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" /></button></li>)}</ul>}
        {!historyLoading && history.length === 0 && !error && <p className="py-3 text-pretty text-sm text-on-surface-variant">Mindmap bạn tạo sẽ xuất hiện ở đây.</p>}
      </section>
    </AssistantStudioHistoryDrawer>
  </div>;
}
