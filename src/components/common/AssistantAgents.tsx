import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, AudioLines, CheckCircle2, ChevronDown, Copy, FileText, Lightbulb, Link2, LoaderCircle, Mic, MicOff, MoreVertical, Paperclip, Plus, Search, Send, Settings2, Star, Trash2, Upload, X } from "lucide-react";
import { assistantAgentService, type AgentChatMessage, type UserAssistantAgent, type UserAssistantAgentInput } from "../../services/assistantAgentService";
import { cn } from "../../modules/student-management/lib/utils";
import { HrEmptyIllustration } from "../hr/HrEmptyIllustration";
import { primaryCreateButtonClass } from "./primaryCreateButton";
import { assistantPageCreateButtonClass } from "./assistantPageCreateButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { AssistantAgentTemplateDialog, assistantAgentTemplates, type AssistantAgentTemplate } from "./AssistantAgentTemplateDialog";
import { startTwoWayVoice, type SpeechRecognitionConstructor } from "./assistant-two-way-voice";
import { assistantService } from "../../services/assistantService";
import "./ChatbotWidget.css";

type AgentTab = "all" | "mine" | "shared";
type EditorTab = "general" | "knowledge";
type KnowledgeKind = "link" | "text" | "file";
type AgentResource = { id: string; title: string; kind: KnowledgeKind; content: string; createdAt: string };
type AgentDraft = UserAssistantAgent;
type AgentSpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
const legacyMockSampleInstructions = new Map([
  ["Trợ lý nội dung", "Bạn là trợ lý nội dung. Hỏi rõ đối tượng, kênh đăng và mục tiêu trước khi đề xuất nội dung."],
  ["Trợ lý phân tích", "Bạn là trợ lý phân tích. Chỉ dựa trên dữ liệu được cung cấp, nêu rõ giả định và trình bày kết luận dễ hiểu."],
  ["Trợ lý học tập", "Bạn là trợ lý học tập. Giải thích bằng ví dụ đơn giản, hỏi trình độ của người học và kiểm tra mức độ hiểu."],
]);

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const inputClass = "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none";
const tones = ["Tự động", "Thân thiện", "Bình thường", "Chuyên nghiệp", "Ngắn gọn"];
function emptyDraft(sample?: Pick<AssistantAgentTemplate, "name" | "description" | "instructions" | "tone" | "avatar">): AgentDraft {
  return {
    id: crypto.randomUUID(),
    name: sample?.name ?? "",
    description: sample?.description ?? "",
    instructions: sample?.instructions ?? "",
    avoid: "",
    tone: sample?.tone ?? "Tự động",
    avatar: sample?.avatar ?? 0,
    favorite: false,
    openingQuestions: ["", ""],
    knowledge: [],
  };
}

function agentFields(agent: AgentDraft): UserAssistantAgentInput {
  const { id: _id, ...fields } = agent;
  return fields;
}

function readDrafts(key: string): AgentDraft[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is AgentDraft & { templates?: unknown } => Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.knowledge)))
      .map(({ templates: _removedTemplates, ...item }) => ({
        id: item.id,
        name: item.name,
        description: typeof item.description === "string" ? item.description : "",
        instructions: typeof item.instructions === "string" ? item.instructions : "",
        avoid: typeof item.avoid === "string" ? item.avoid : "",
        tone: typeof item.tone === "string" ? item.tone : "Tự động",
        avatar: typeof item.avatar === "number" ? item.avatar : 0,
        favorite: item.favorite === true,
        openingQuestions: Array.isArray(item.openingQuestions) ? item.openingQuestions : ["", ""],
        knowledge: item.knowledge,
      }));
  } catch { return []; }
}

function AgentAvatar({ avatar = 0, className = "size-10" }: { avatar?: number; className?: string }) {
  return <img src={`/assistant-avatars/avatar-${avatar + 1}.webp`} alt="" aria-hidden="true" loading="lazy" className={cn("block shrink-0 rounded-full border border-outline-variant object-cover", className)} />;
}

function AgentCard({ name, avatar, subtitle, description, headerActions, children }: {
  name: string;
  avatar: number;
  subtitle: string;
  description: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return <article className="flex min-h-48 min-w-0 flex-col rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface">
    <div className="flex items-start gap-3 px-3 pt-3">
      <AgentAvatar avatar={avatar} className="size-9" />
      <div className="min-w-0 flex-1">
        <h5 className="truncate text-balance text-sm font-medium" title={name}>{name}</h5>
        <p className="truncate text-xs text-on-surface-variant">{subtitle}</p>
      </div>
      {headerActions && <div className="flex shrink-0 items-center gap-1">{headerActions}</div>}
    </div>
    <p title={description} className="mt-2 min-h-10 flex-1 px-3 text-pretty text-sm leading-5 text-on-surface line-clamp-2">{description}</p>
    <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-outline-variant px-3 py-3">{children}</div>
  </article>;
}

type PreparedResource = { title: string; content: string; kind: KnowledgeKind };

function KnowledgeIngestionDialog({ mode, resourceCount, onAdd, onClose }: {
  mode: KnowledgeKind;
  resourceCount: number;
  onAdd: (resources: AgentResource[]) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const errorId = useId();
  const fileInputId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [urls, setUrls] = useState([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [prepared, setPrepared] = useState<PreparedResource[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const maxResources = Math.max(0, 20 - resourceCount);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try { dialog.showModal(); }
    catch { dialog.setAttribute("open", ""); }
    const firstField = dialog.querySelector<HTMLElement>("[data-dialog-autofocus]");
    firstField?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([type="hidden"]):not([hidden]):not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    const nextFiles = Array.from(incoming);
    if (!nextFiles.length) return;
    if (nextFiles.length + files.length > maxResources) { setResourceError(`Trợ lý chỉ còn chỗ cho ${maxResources} tài liệu.`); return; }
    const allowed = /\.(pdf|docx|txt|csv|xls|xlsx)$/i;
    const invalidFile = nextFiles.find(file => !allowed.test(file.name));
    if (invalidFile) { setResourceError(`Tệp ${invalidFile.name} không thuộc định dạng được hỗ trợ.`); return; }
    const oversizedFile = nextFiles.find(file => file.size > 10 * 1024 * 1024);
    if (oversizedFile) { setResourceError(`Tệp ${oversizedFile.name} vượt quá giới hạn 10 MB.`); return; }
    setFiles(current => [...current, ...nextFiles]);
    setResourceError("");
  };

  const continueToPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResourceError("");
    if (maxResources < 1) { setResourceError("Mỗi trợ lý hỗ trợ tối đa 20 tài liệu tri thức."); return; }
    if (mode === "text") {
      if (!title.trim() || !content.trim()) { setResourceError("Hãy nhập tiêu đề và nội dung."); return; }
      setPrepared([{ title: title.trim(), content: content.trim(), kind: mode }]);
      setStep(2);
      return;
    }
    if (mode === "file" && !files.length) { setResourceError("Hãy chọn ít nhất một tệp tài liệu."); return; }
    const normalizedUrls = urls.map(url => url.trim()).filter(Boolean);
    if (mode === "link" && !normalizedUrls.length) { setResourceError("Hãy nhập ít nhất một liên kết."); return; }
    if (mode === "link" && normalizedUrls.length > maxResources) { setResourceError(`Trợ lý chỉ còn chỗ cho ${maxResources} tài liệu.`); return; }
    setBusy(true);
    try {
      if (mode === "file") {
        const extracted = await Promise.all(files.map(file => assistantAgentService.extractFile(file)));
        setPrepared(extracted.map(item => ({ title: item.fileName.slice(0, 120), content: item.text, kind: mode })));
      } else {
        const extracted = await Promise.all(normalizedUrls.map(url => assistantAgentService.extractLink(url)));
        setPrepared(extracted.map(item => ({ title: item.title, content: `Nguồn: ${item.url}\n\n${item.text}`, kind: mode })));
      }
      setStep(2);
    } catch (error) {
      setResourceError(error instanceof Error ? error.message : mode === "file" ? "Không thể đọc tệp tài liệu." : "Không thể đọc nội dung trang web.");
    } finally { setBusy(false); }
  };

  const addToKnowledge = () => {
    if (!prepared.length || prepared.length > maxResources) {
      setResourceError("Mỗi trợ lý hỗ trợ tối đa 20 tài liệu tri thức.");
      return;
    }
    const createdAt = new Date().toISOString();
    onAdd(prepared.map(resource => ({ ...resource, id: crypto.randomUUID(), createdAt })));
  };

  const dialogTitle = mode === "file" ? "Thêm tệp tài liệu" : mode === "link" ? "Thêm liên kết" : "Nội dung";
  const nextLabel = mode === "file" ? "Đọc tệp và tiếp tục" : mode === "link" ? "Đọc liên kết và tiếp tục" : "Tiếp tục";

  return createPortal(<dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={resourceError ? errorId : undefined}
    onCancel={event => { event.preventDefault(); if (!busyRef.current) closeRef.current(); }}
    onClick={event => { if (event.target === event.currentTarget && !busyRef.current) onClose(); }}
    className="fixed inset-0 m-0 flex size-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-3 backdrop:bg-black/40 sm:p-6">
    <section role="document" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-xl sm:max-h-[calc(100dvh-3rem)]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-outline-variant px-5 py-4 sm:px-6">
        <h2 id={titleId} className="text-balance text-lg font-semibold">{dialogTitle}</h2>
        <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose} className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50", focusClass)}><X className="size-5" aria-hidden="true" /></button>
      </header>
      <div className="shrink-0 px-4 pt-5 sm:px-6">
        <ol aria-label="Tiến trình nạp tri thức" className="mx-auto flex w-fit items-center gap-3 text-sm sm:gap-4">
          <li aria-current={step === 1 ? "step" : undefined} className={cn("flex items-center gap-2", step === 1 ? "font-medium text-primary" : "text-on-surface-variant")}><span className={cn("grid size-7 place-items-center rounded-full tabular-nums", step === 1 ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant")}>{step > 1 ? <CheckCircle2 className="size-4" aria-hidden="true" /> : "1"}</span><span>{mode === "file" ? "Tải tệp lên" : mode === "link" ? "Thêm liên kết" : "Thêm nội dung"}</span></li>
          <span className="h-px w-10 bg-outline-variant sm:w-16" aria-hidden="true" />
          <li aria-current={step === 2 ? "step" : undefined} className={cn("flex items-center gap-2", step === 2 ? "font-medium text-primary" : "text-on-surface-variant")}><span className={cn("grid size-7 place-items-center rounded-full tabular-nums", step === 2 ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant")}>2</span><span>Nạp tri thức</span></li>
        </ol>
      </div>
      <form onSubmit={continueToPreview} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {step === 1 && mode === "file" && <div className={cn("rounded-xl border border-dashed p-5 text-center sm:p-8", dragging ? "border-primary bg-primary/10" : "border-primary/50 bg-primary/5")} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
            <input ref={fileInputRef} id={fileInputId} type="file" multiple accept=".pdf,.docx,.txt,.csv,.xls,.xlsx" className="hidden" aria-label="Chọn tệp tài liệu từ máy tính" aria-describedby={`${fileInputId}-help${resourceError ? ` ${errorId}` : ""}`} onChange={event => { addFiles(event.currentTarget.files || []); event.currentTarget.value = ""; }} />
            <div className="mx-auto flex min-h-44 flex-col items-center justify-center rounded-lg px-4 py-5">
              <span className="grid size-12 place-items-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant"><Upload className="size-5" aria-hidden="true" /></span>
              <span className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-sm font-medium"><button type="button" data-dialog-autofocus onClick={() => fileInputRef.current?.click()} className={cn("rounded-sm text-primary underline-offset-2 hover:underline", focusClass)}>Chọn tệp</button><span>hoặc kéo thả tệp vào đây</span></span>
              <span id={`${fileInputId}-help`} className="mt-2 text-pretty text-xs text-on-surface-variant">PDF, DOCX, TXT, CSV, XLS, XLSX · tối đa 10 MB mỗi tệp</span>
            </div>
            {files.length > 0 && <ul aria-label="Tệp đã chọn" className="mx-auto mt-3 max-w-xl divide-y divide-outline-variant rounded-lg border border-outline-variant bg-surface-container-lowest text-left">{files.map((file, index) => <li key={`${file.name}:${file.lastModified}:${index}`} className="flex min-w-0 items-center gap-3 px-3 py-2"><FileText className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm">{file.name}</span><span className="shrink-0 text-xs tabular-nums text-on-surface-variant">{(file.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" aria-label={`Bỏ tệp ${file.name}`} onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} className={cn("grid size-8 shrink-0 place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-low", focusClass)}><X className="size-4" aria-hidden="true" /></button></li>)}</ul>}
          </div>}

          {step === 1 && mode === "link" && <div className="space-y-3">
            <p className="text-pretty text-sm text-on-surface-variant">Nhập liên kết trang web công khai. Nội dung trang sẽ được đọc tự động.</p>
            {urls.map((url, index) => <div key={index} className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`${fileInputId}-url-${index}`}>Liên kết {index + 1}</label>
              <div className="relative min-w-0 flex-1"><Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><input id={`${fileInputId}-url-${index}`} data-dialog-autofocus={index === 0 ? true : undefined} type="url" required maxLength={2000} value={url} onChange={event => setUrls(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className={cn(inputClass, "pl-9")} placeholder="Nhập liên kết, ví dụ https://example.com" /></div>
              {urls.length > 1 && <button type="button" aria-label={`Xóa liên kết ${index + 1}`} onClick={() => setUrls(current => current.filter((_, itemIndex) => itemIndex !== index))} className={cn("grid size-10 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><X className="size-4" aria-hidden="true" /></button>}
            </div>)}
            <button type="button" onClick={() => setUrls(current => [...current, ""])} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-primary hover:bg-primary/5", focusClass)}><Plus className="size-4" aria-hidden="true" />Thêm liên kết</button>
            <p className="text-xs text-on-surface-variant">Trang yêu cầu đăng nhập hoặc chỉ hiển thị nội dung bằng JavaScript có thể không đọc được.</p>
          </div>}

          {step === 1 && mode === "text" && <div className="space-y-4">
            <label className="block text-sm font-medium">Tiêu đề <span className="text-error">*</span><input data-dialog-autofocus type="text" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} className={cn(inputClass, "mt-1.5")} placeholder="Nhập tiêu đề" /></label>
            <label className="block text-sm font-medium">Nội dung <span className="text-error">*</span><textarea value={content} onChange={event => setContent(event.target.value)} required maxLength={10000} rows={11} className={cn(inputClass, "mt-1.5 min-h-56 resize-y")} placeholder="Dán hoặc nhập nội dung tham khảo cho trợ lý" /><span className="mt-1 block text-right text-xs tabular-nums text-on-surface-variant">{content.length.toLocaleString("vi-VN")} / 10.000</span></label>
          </div>}

          {step === 2 && <div className="space-y-4">
            <p role="status" className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4 text-primary" aria-hidden="true" />Đã sẵn sàng nạp {prepared.length} tài liệu vào trợ lý.</p>
            <ul aria-label="Nội dung sẽ được nạp" className="space-y-3">{prepared.map((resource, index) => <li key={`${resource.title}:${index}`} className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
              <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-low px-3 py-2"><FileText className="size-4 shrink-0 text-primary" aria-hidden="true" /><h3 className="min-w-0 flex-1 truncate text-sm font-medium">{resource.title}</h3><span className="shrink-0 text-xs text-on-surface-variant">{resource.kind === "link" ? "Liên kết" : resource.kind === "file" ? "Tệp tài liệu" : "Nội dung"}</span></div>
              {resource.kind === "link" && <p className="truncate border-b border-outline-variant px-3 py-2 text-xs text-on-surface-variant">{resource.content.split("\n")[0]?.replace(/^Nguồn:\s*/, "")}</p>}
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-sans text-sm leading-5 text-on-surface">{resource.kind === "link" ? resource.content.slice(resource.content.indexOf("\n\n") + 2) : resource.content}</pre>
            </li>)}</ul>
          </div>}

          {resourceError && <p id={errorId} role="alert" className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">{resourceError}</p>}
          {busy && <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 text-sm text-on-surface-variant"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />{mode === "file" ? "Đang đọc nội dung tệp…" : "Đang đọc nội dung trang…"}</p>}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline-variant px-4 py-4 sm:px-6">
          <div>{step === 2 && <button type="button" disabled={busy} onClick={() => { setResourceError(""); setStep(1); }} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-4 text-sm font-medium hover:bg-surface-container-low disabled:opacity-50", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />Quay lại</button>}</div>
          <div className="ml-auto flex items-center gap-2"><button type="button" disabled={busy} onClick={onClose} className={cn("inline-flex min-h-10 items-center justify-center rounded-lg border border-outline-variant px-4 text-sm font-medium hover:bg-surface-container-low disabled:opacity-50", focusClass)}>Hủy</button>
            {step === 1 ? <button type="submit" disabled={busy || maxResources < 1} className={cn(primaryCreateButtonClass, "inline-flex min-h-10 items-center gap-2 disabled:opacity-50", focusClass)}>{busy ? "Đang xử lý…" : nextLabel}{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}</button> : <button type="button" onClick={addToKnowledge} disabled={busy || !prepared.length || prepared.length > maxResources} className={cn(primaryCreateButtonClass, "inline-flex min-h-10 items-center gap-2 disabled:opacity-50", focusClass)}><Plus className="size-4" aria-hidden="true" />Nạp tri thức</button>}
          </div>
        </footer>
      </form>
    </section>
  </dialog>, document.body);
}

function ResourceEditor({ draft, updateDraft }: { draft: AgentDraft; updateDraft: (patch: Partial<AgentDraft>) => void }) {
  const [addMode, setAddMode] = useState<KnowledgeKind | null>(null);
  const [query, setQuery] = useState("");
  const items = draft.knowledge;
  const visible = items.filter(item => `${item.title} ${item.content}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const addResources = (resources: AgentResource[]) => {
    updateDraft({ knowledge: [...items, ...resources] });
    setAddMode(null);
  };

  return <section aria-label="Tri thức của trợ lý" className="space-y-4">
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-surface-container-low p-6 text-center">
      <img src="/assistant-knowledge-upload.svg" alt="" width="96" height="96" className="size-20 object-contain" />
      <p className="mt-3 text-balance text-sm font-medium">Nạp tri thức bằng các cách dưới đây</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Cách thêm tri thức">
        <button type="button" disabled={items.length >= 20} onClick={() => setAddMode("file")} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Upload className="size-4" aria-hidden="true" />Tải tệp lên</button>
        <button type="button" disabled={items.length >= 20} onClick={() => setAddMode("link")} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Link2 className="size-4" aria-hidden="true" />Thêm liên kết</button>
        <button type="button" disabled={items.length >= 20} onClick={() => setAddMode("text")} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><FileText className="size-4" aria-hidden="true" />Nhập nội dung</button>
      </div>
      {items.length >= 20 && <p className="mt-3 text-xs text-on-surface-variant">Trợ lý đã đạt giới hạn 20 tài liệu tri thức.</p>}
    </div>
    {items.length > 0 && <>
      <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm tri thức</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tri thức" className={cn(inputClass, "pl-9")} /></label>
      {visible.length ? <ul className="divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant">{visible.map(item => <li key={item.id} className="flex items-center gap-3 px-3 py-3">
      {item.kind === "link" ? <Link2 className="size-4 shrink-0 text-primary" aria-hidden="true" /> : item.kind === "file" ? <Upload className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-on-surface-variant">{item.kind === "link" ? "Liên kết và nội dung đã đọc" : item.kind === "text" ? "Nội dung văn bản" : "Văn bản đã trích xuất từ tệp"}</p></div>
      <button type="button" aria-label={`Bỏ ${item.title} khỏi trợ lý`} onClick={() => updateDraft({ knowledge: items.filter(entry => entry.id !== item.id) })} className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><Trash2 className="size-4" aria-hidden="true" /></button>
      </li>)}</ul> : <p role="status" className="text-center text-sm text-on-surface-variant">Không tìm thấy tri thức phù hợp.</p>}
    </>}
    {addMode && <KnowledgeIngestionDialog key={addMode} mode={addMode} resourceCount={items.length} onAdd={addResources} onClose={() => setAddMode(null)} />}
  </section>;
}

export function AssistantAgents({ storageScope, creatorName }: { storageScope: string; creatorName?: string }) {
  const formErrorId = useId();
  const chatErrorId = useId();
  const chatKeyboardHelpId = useId();
  const storageKey = `igen_erp_agent_drafts:${storageScope}`;
  const [saved, setSaved] = useState<AgentDraft[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [agentStorageError, setAgentStorageError] = useState("");
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [tab, setTab] = useState<AgentTab>("all");
  const [editorTab, setEditorTab] = useState<EditorTab>("general");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [chatAgent, setChatAgent] = useState<AgentDraft | null>(null);
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([]);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLElement>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatAttachment, setChatAttachment] = useState<{ fileName: string; text: string } | null>(null);
  const [chatAttachmentBusy, setChatAttachmentBusy] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"off" | "dictation" | "conversation">("off");
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceInputFocused, setVoiceInputFocused] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [spokenReplyText, setSpokenReplyText] = useState("");
  const [spokenWordCount, setSpokenWordCount] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const voiceModeRef = useRef(voiceMode);
  const voiceStopRef = useRef<(() => void) | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAudioUrlRef = useRef<string | null>(null);
  const voiceRequestRef = useRef<AbortController | null>(null);
  const dictationBaseRef = useRef("");
  const voiceSubmitRef = useRef<(text: string) => void>(() => undefined);
  const chatFileInputId = useId();
  const [deleteTarget, setDeleteTarget] = useState<AgentDraft | null>(null);
  const [agentNotice, setAgentNotice] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAgents = async () => {
      setSavedLoading(true);
      setAgentStorageError("");
      try {
        const remoteAgents = await assistantAgentService.listAgents();
        const knownIds = new Set(remoteAgents.map(agent => agent.id));
        const migrated: AgentDraft[] = [];
        for (const legacyAgent of readDrafts(storageKey)) {
          if (legacyMockSampleInstructions.get(legacyAgent.name) === legacyAgent.instructions) continue;
          if (knownIds.has(legacyAgent.id)) continue;
          const storedAgent = await assistantAgentService.createAgent(legacyAgent);
          migrated.push(storedAgent);
          knownIds.add(storedAgent.id);
        }
        if (!active) return;
        const byId = new Map([...migrated, ...remoteAgents].map(agent => [agent.id, agent]));
        setSaved([...byId.values()]);
        try { localStorage.removeItem(storageKey); } catch { /* The database copy remains available. */ }
      } catch (loadError) {
        if (active) setAgentStorageError(loadError instanceof Error ? loadError.message : "Không thể tải danh sách trợ lý từ máy chủ.");
      } finally {
        if (active) setSavedLoading(false);
      }
    };
    void loadAgents();
    return () => { active = false; };
  }, [storageKey]);
  const chatKey = (agentId: string) => `igen_erp_agent_chat:${storageScope}:${agentId}`;
  const openChat = (agent: AgentDraft) => {
    let history: AgentChatMessage[] = [];
    try { const stored: unknown = JSON.parse(localStorage.getItem(chatKey(agent.id)) || "[]"); if (Array.isArray(stored)) history = stored.filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map(item => ({ role: item.role, content: item.content, ...(typeof item.attachmentName === "string" ? { attachmentName: item.attachmentName } : {}) } as AgentChatMessage)).slice(-100); } catch { /* Start a new conversation. */ }
    stopVoice();
    setChatAgent(agent); setChatMessages(history); setChatInput(""); setChatError(""); setChatAttachment(null); setDraft(null);
  };
  const stopVoiceAudio = () => {
    voiceRequestRef.current?.abort();
    voiceRequestRef.current = null;
    if (voiceAudioRef.current) { voiceAudioRef.current.pause(); voiceAudioRef.current = null; }
    if (voiceAudioUrlRef.current) URL.revokeObjectURL(voiceAudioUrlRef.current);
    voiceAudioUrlRef.current = null;
    setVoiceSpeaking(false);
  };
  const stopVoice = () => {
    voiceModeRef.current = "off";
    setVoiceMode("off");
    voiceStopRef.current?.();
    voiceStopRef.current = null;
    setVoiceListening(false);
    setVoiceInputFocused(false);
    setVoiceTranscript("");
    stopVoiceAudio();
  };
  useEffect(() => { if (!chatAgent && voiceMode !== "off") stopVoice(); }, [chatAgent, voiceMode]);
  useEffect(() => {
    if (!chatAgent || voiceMode === "off") return;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) stopVoice();
    });
    if (chatSectionRef.current) observer?.observe(chatSectionRef.current);
    const stopWhenHidden = () => { if (document.hidden) stopVoice(); };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", stopWhenHidden); };
  }, [chatAgent?.id, voiceMode]);
  useEffect(() => () => {
    voiceStopRef.current?.();
    voiceRequestRef.current?.abort();
    voiceAudioRef.current?.pause();
    if (voiceAudioUrlRef.current) URL.revokeObjectURL(voiceAudioUrlRef.current);
  }, []);
  useEffect(() => {
    const log = chatLogRef.current;
    if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 120) log.scrollTop = log.scrollHeight;
  }, [chatMessages, voiceTranscript, spokenWordCount]);
  useEffect(() => {
    if (!chatAgent || voiceMode === "off" || chatBusy || voiceSpeaking || voiceInputFocused || (voiceMode === "conversation" && voiceMuted)) return;
    const Recognition = (window as AgentSpeechWindow).SpeechRecognition || (window as AgentSpeechWindow).webkitSpeechRecognition;
    if (!Recognition) return;
    const stop = startTwoWayVoice({
      Recognition,
      onRecognitionChange: next => setVoiceListening(Boolean(next)),
      onTranscript: text => {
        if (voiceMode === "dictation") setChatInput([dictationBaseRef.current, text].filter(Boolean).join(" "));
        else setVoiceTranscript(text);
      },
      onSubmit: text => voiceSubmitRef.current(text),
      onError: code => {
        setVoiceError(code === "not-allowed" || code === "service-not-allowed" ? "Hãy cho phép dùng micro rồi thử lại." : code === "audio-capture" ? "Không tìm thấy micro. Hãy kiểm tra thiết bị rồi thử lại." : "Không nhận được giọng nói. Hãy thử lại hoặc nhập bằng bàn phím.");
        voiceModeRef.current = "off";
        setVoiceMode("off");
      },
    });
    voiceStopRef.current = stop;
    return () => { stop(); if (voiceStopRef.current === stop) voiceStopRef.current = null; };
  }, [chatAgent?.id, voiceMode, voiceMuted, voiceInputFocused, chatBusy, voiceSpeaking]);
  const attachChatFile = async (file?: File) => {
    if (!file) return;
    setChatAttachmentBusy(true); setChatError("");
    try { setChatAttachment(await assistantAgentService.extractFile(file)); }
    catch (error) { setChatError(error instanceof Error ? error.message : "Không thể đọc tài liệu."); }
    finally { setChatAttachmentBusy(false); }
  };
  const sendAgentMessage = async (text: string) => {
    if (!chatAgent || !text || chatBusy) return;
    const outgoing: AgentChatMessage[] = [...chatMessages, { role: "user", content: text, ...(chatAttachment ? { attachmentName: chatAttachment.fileName, attachmentText: chatAttachment.text } : {}) }];
    setChatBusy(true); setChatError(""); setChatMessages(outgoing); setChatInput(""); setVoiceTranscript("");
    try {
      const result = await assistantAgentService.chat(chatAgent, outgoing);
      const complete: AgentChatMessage[] = [...outgoing, { role: "assistant", content: result.reply }];
      setChatMessages(complete);
      try { localStorage.setItem(chatKey(chatAgent.id), JSON.stringify(complete.slice(-100).map(({ attachmentText: _attachmentText, ...message }) => message))); } catch { /* Keep the conversation for this session. */ }
      setChatAttachment(null);
      if (voiceModeRef.current === "conversation") {
        stopVoiceAudio();
        const controller = new AbortController();
        voiceRequestRef.current = controller;
        setSpokenReplyText(result.reply);
        setSpokenWordCount(0);
        setVoiceSpeaking(true);
        try {
          const blob = await assistantService.speech(result.reply, controller.signal);
          if (controller.signal.aborted || voiceModeRef.current !== "conversation") return;
          const url = URL.createObjectURL(blob);
          voiceAudioUrlRef.current = url;
          const audio = new Audio(url);
          voiceAudioRef.current = audio;
          const words = result.reply.trim().split(/\s+/);
          audio.ontimeupdate = () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) setSpokenWordCount(Math.min(words.length, Math.floor(audio.currentTime / audio.duration * words.length)));
          };
          audio.onended = () => { setSpokenWordCount(words.length); stopVoiceAudio(); };
          audio.onerror = () => { setVoiceError("Không phát được câu trả lời. Bạn vẫn có thể đọc nội dung bên trên."); stopVoiceAudio(); };
          await audio.play();
        } catch (speechError) {
          if (!controller.signal.aborted) setVoiceError(speechError instanceof Error ? speechError.message : "Không đọc được câu trả lời lúc này.");
          stopVoiceAudio();
        }
      }
    } catch (error) {
      setChatMessages(chatMessages); setChatInput(text);
      setChatError(error instanceof Error ? error.message : "Không thể gửi tin nhắn.");
    } finally { setChatBusy(false); }
  };
  const sendChat = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void sendAgentMessage(chatInput.trim()); };
  voiceSubmitRef.current = text => {
    if (voiceModeRef.current === "dictation") {
      setChatInput([dictationBaseRef.current, text].filter(Boolean).join(" "));
      voiceModeRef.current = "off";
      setVoiceMode("off");
    } else if (voiceModeRef.current === "conversation") void sendAgentMessage(text);
  };
  const toggleDictation = () => {
    if (voiceMode === "dictation") { stopVoice(); return; }
    if (window.isSecureContext === false && !/^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname)) { setVoiceError("Micro chỉ hoạt động trên HTTPS hoặc localhost."); return; }
    const Recognition = (window as AgentSpeechWindow).SpeechRecognition || (window as AgentSpeechWindow).webkitSpeechRecognition;
    if (!Recognition) { setVoiceError("Trình duyệt này chưa hỗ trợ nhận giọng nói."); return; }
    stopVoice(); dictationBaseRef.current = chatInput.trim(); setVoiceError("");
    voiceModeRef.current = "dictation"; setVoiceMode("dictation");
  };
  const toggleConversationVoice = () => {
    if (voiceMode === "conversation") { stopVoice(); return; }
    if (window.isSecureContext === false && !/^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname)) { setVoiceError("Micro chỉ hoạt động trên HTTPS hoặc localhost."); return; }
    const Recognition = (window as AgentSpeechWindow).SpeechRecognition || (window as AgentSpeechWindow).webkitSpeechRecognition;
    if (!Recognition) { setVoiceError("Trình duyệt này chưa hỗ trợ trò chuyện giọng nói."); return; }
    stopVoice(); setVoiceMuted(false); setVoiceError("");
    voiceModeRef.current = "conversation"; setVoiceMode("conversation");
  };
  const updateDraft = (patch: Partial<AgentDraft>) => { setDraft(current => current ? { ...current, ...patch } : current); setError(""); };
  const start = (sample?: Pick<AssistantAgentTemplate, "name" | "description" | "instructions" | "tone" | "avatar">) => { setDraft(emptyDraft(sample)); setEditorTab("general"); setError(""); };
  const openSampleChat = (sample: AssistantAgentTemplate) => {
    const existing = saved.find(item => item.name === sample.name);
    if (existing) { openChat(existing); return; }
    openChat(emptyDraft(sample));
  };
  const continueToKnowledge = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.instructions.trim()) { setError("Nhập tên và chỉ dẫn trước khi tiếp tục."); return; }
    setEditorTab("knowledge");
    setError("");
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.instructions.trim()) { setEditorTab("general"); setError("Nhập tên và chỉ dẫn trước khi tạo trợ lý."); return; }
    const cleaned = { ...draft, name: draft.name.trim(), description: draft.description.trim(), instructions: draft.instructions.trim() };
    setError(""); setAgentStorageError("");
    try {
      const isSavedAgent = saved.some(item => item.id === cleaned.id);
      const storedAgent = isSavedAgent
        ? await assistantAgentService.updateAgent(cleaned.id, agentFields(cleaned))
        : await assistantAgentService.createAgent(cleaned);
      setSaved(current => [storedAgent, ...current.filter(item => item.id !== storedAgent.id)]);
      openChat(storedAgent);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu trợ lý. Hãy thử lại.");
    }
  };
  const toggleFavorite = async (agentId: string) => {
    const currentAgent = saved.find(item => item.id === agentId);
    if (!currentAgent) return;
    const nextFavorite = !currentAgent.favorite;
    const optimistic = { ...currentAgent, favorite: nextFavorite };
    setSaved(current => current.map(item => item.id === agentId ? optimistic : item));
    setChatAgent(current => current?.id === agentId ? optimistic : current);
    try {
      const storedAgent = await assistantAgentService.setAgentFavorite(agentId, nextFavorite);
      setSaved(current => current.map(item => item.id === agentId ? storedAgent : item));
      setChatAgent(current => current?.id === agentId ? storedAgent : current);
      setAgentStorageError(""); setChatError("");
    } catch (favoriteError) {
      setSaved(current => current.map(item => item.id === agentId ? currentAgent : item));
      setChatAgent(current => current?.id === agentId ? currentAgent : current);
      const message = favoriteError instanceof Error ? favoriteError.message : "Không thể cập nhật yêu thích.";
      setAgentStorageError(message); setChatError(message);
    }
  };
  const cloneAgent = async (agent: AgentDraft, trigger: HTMLButtonElement) => {
    const suffixText = " (bản sao)";
    const baseName = `${agent.name.slice(0, 50 - suffixText.length)}${suffixText}`;
    let name = baseName;
    let suffix = 2;
    while (saved.some(item => item.name === name)) {
      const ending = ` (bản sao ${suffix})`;
      name = `${agent.name.slice(0, Math.max(1, 50 - ending.length))}${ending}`;
      suffix += 1;
    }
    const now = new Date().toISOString();
    const cloned: AgentDraft = {
      ...agent,
      id: crypto.randomUUID(),
      name,
      favorite: false,
      openingQuestions: [...agent.openingQuestions],
      knowledge: agent.knowledge.map(resource => ({ ...resource, id: crypto.randomUUID(), createdAt: now })),
    };
    trigger.closest("details")?.removeAttribute("open");
    try {
      const storedAgent = await assistantAgentService.createAgent(cloned);
      setSaved(current => [storedAgent, ...current]);
      setAgentNotice(`Đã nhân bản “${agent.name}”.`);
      setAgentStorageError("");
    } catch (cloneError) {
      setAgentStorageError(cloneError instanceof Error ? cloneError.message : "Không thể nhân bản trợ lý.");
    }
  };
  const deleteAgent = async () => {
    if (!deleteTarget) return;
    try {
      await assistantAgentService.deleteAgent(deleteTarget.id);
      setSaved(current => current.filter(item => item.id !== deleteTarget.id));
      try { localStorage.removeItem(chatKey(deleteTarget.id)); } catch { /* Keep the list usable. */ }
      if (chatAgent?.id === deleteTarget.id) { setChatAgent(null); setChatMessages([]); }
      setDeleteTarget(null); setAgentStorageError("");
    } catch (deleteError) {
      setDeleteTarget(null);
      setAgentStorageError(deleteError instanceof Error ? deleteError.message : "Không thể xóa trợ lý.");
    }
  };
  const visibleSaved = saved.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const visibleSamples = assistantAgentTemplates.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const activeChatIsSaved = chatAgent ? saved.some(item => item.id === chatAgent.id) : false;

  if (chatAgent) return <section ref={chatSectionRef} aria-label={`Trò chuyện với ${chatAgent.name}`} className="flex min-h-0 flex-1 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" disabled={chatBusy} onClick={() => setChatAgent(null)} aria-label="Quay lại danh sách Trợ lý AI" title="Quay lại" className={cn("grid size-10 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low disabled:opacity-45", focusClass)}><ArrowLeft className="size-5" aria-hidden="true" /></button>
      <details className="group relative min-w-0">
        <summary aria-disabled={chatBusy} onClick={event => { if (chatBusy) event.preventDefault(); }} className={cn("flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-left hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", chatBusy && "pointer-events-none opacity-50", focusClass)}>
          <AgentAvatar avatar={chatAgent.avatar} className="size-9" />
          <span className="max-w-[min(55vw,28rem)] truncate text-base font-medium">{chatAgent.name}</span>
          <ChevronDown className="size-4 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-medium text-on-surface-variant">Trợ lý của tôi</p>
          {saved.map(agent => <button key={agent.id} type="button" disabled={chatBusy} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); openChat(agent); }} className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-surface-container-low disabled:opacity-45", focusClass)}><AgentAvatar avatar={agent.avatar} className="size-8" /><span className="min-w-0 flex-1 truncate">{agent.name}</span>{agent.id === chatAgent.id && <span className="text-xs text-primary">Đang mở</span>}</button>)}
          <button type="button" disabled={chatBusy} onClick={() => setChatAgent(null)} className={cn("mt-1 min-h-10 w-full rounded-lg border-t border-outline-variant px-2 pt-1 text-left text-sm text-primary disabled:opacity-45", focusClass)}>Tất cả trợ lý</button>
        </div>
      </details>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" disabled={chatBusy || !activeChatIsSaved} title={!activeChatIsSaved ? "Lưu trợ lý trước khi thêm yêu thích" : undefined} aria-label={!activeChatIsSaved ? "Lưu trợ lý trước khi thêm yêu thích" : chatAgent.favorite ? `Bỏ yêu thích ${chatAgent.name}` : `Yêu thích ${chatAgent.name}`} aria-pressed={Boolean(chatAgent.favorite)} onClick={() => { void toggleFavorite(chatAgent.id); }} className={cn("grid size-10 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low disabled:opacity-45", chatAgent.favorite && "text-favorite", focusClass)}><Star className={cn("size-5", chatAgent.favorite && "fill-current")} aria-hidden="true" /></button>
        <details className="group relative">
          <summary aria-label={`Tùy chọn ${chatAgent.name}`} aria-disabled={chatBusy} onClick={event => { if (chatBusy) event.preventDefault(); }} className={cn("grid size-10 cursor-pointer list-none place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", chatBusy && "pointer-events-none opacity-45", focusClass)}><MoreVertical className="size-5" aria-hidden="true" /></summary>
          <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md">
            <button type="button" onClick={() => { setDraft(chatAgent); setEditorTab("general"); setChatAgent(null); }} className={cn("flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}><Settings2 className="size-4" aria-hidden="true" />Thiết lập trợ lý</button>
            {activeChatIsSaved && <button type="button" onClick={() => setDeleteTarget(chatAgent)} className={cn("flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-error hover:bg-error/10", focusClass)}><Trash2 className="size-4" aria-hidden="true" />Xóa trợ lý</button>}
          </div>
        </details>
      </div>
    </header>
    <div ref={chatLogRef} aria-live="polite" aria-busy={chatBusy || chatAttachmentBusy} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
      {chatMessages.length === 0 && !voiceTranscript ? <div className="flex min-h-full flex-col items-center justify-center pb-12 text-center">
        <AgentAvatar avatar={chatAgent.avatar} className="size-[4.5rem]" />
        <h2 className="mt-6 text-balance text-lg font-medium">{chatAgent.name}</h2>
        <p className="mt-6 text-pretty text-sm text-on-surface-variant">Tạo bởi {creatorName?.trim() || "bạn"}</p>
      </div> : <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-5 py-6">
        {chatMessages.map((message, index) => message.role === "user"
          ? <div key={index} className="max-w-[85%] self-end rounded-2xl bg-surface-container-low px-4 py-3 text-sm sm:max-w-[75%]">{message.attachmentName && <p className="mb-2 flex items-center gap-1.5 text-xs text-on-surface-variant"><FileText className="size-4" aria-hidden="true" />{message.attachmentName}</p>}<p className="whitespace-pre-wrap text-pretty">{message.content}</p></div>
          : <article key={index} className="max-w-full self-start text-sm"><p className="mb-1 text-xs text-on-surface-variant">{chatAgent.name}</p><p className="whitespace-pre-wrap text-pretty leading-6">{voiceMode === "conversation" && voiceSpeaking && index === chatMessages.length - 1 && message.content === spokenReplyText ? spokenReplyText.trim().split(/\s+/).slice(0, spokenWordCount).join(" ") : message.content}</p></article>)}
        {voiceMode === "conversation" && voiceTranscript && !chatMessages.some(message => message.role === "user" && message.content.trim() === voiceTranscript.trim()) && <div className="max-w-[85%] self-end rounded-2xl bg-surface-container-low px-4 py-3 text-sm sm:max-w-[75%]"><span className="sr-only">Bạn: </span><p className="whitespace-pre-wrap text-pretty">{voiceTranscript}</p></div>}
        {chatBusy && <p role="status" className="text-sm text-on-surface-variant">Trợ lý đang trả lời…</p>}
      </div>}
    </div>
    <form onSubmit={sendChat} className="relative shrink-0 px-4 pb-4 pt-2 sm:px-6 sm:pb-5">
      {voiceMode === "conversation" && <div aria-hidden="true" data-phase={voiceMuted || voiceInputFocused ? "muted" : voiceSpeaking ? "speaking" : chatBusy ? "thinking" : "listening"} className="assistant-voice-orb pointer-events-none absolute bottom-full left-1/2 mb-4 -translate-x-1/2"><span className="assistant-voice-orb-core" /></div>}
      <div className="assistant-conversation-composer mx-auto flex w-full max-w-4xl flex-col items-stretch gap-1 rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-sm">
        {chatAttachmentBusy && <p role="status" className="px-1 pb-2 text-xs text-on-surface-variant">Đang đọc tài liệu…</p>}
        {chatAttachment && <div className="mb-2 flex max-w-full items-center gap-2 rounded-lg bg-surface-container-low px-2 py-1.5 text-xs"><FileText className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{chatAttachment.fileName}</span><button type="button" disabled={chatBusy} aria-label={`Bỏ tệp ${chatAttachment.fileName}`} onClick={() => setChatAttachment(null)} className={cn("grid size-7 shrink-0 place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50", focusClass)}><X className="size-4" aria-hidden="true" /></button></div>}
        <label className="block"><span className="sr-only">Tin nhắn gửi {chatAgent.name}</span><textarea value={chatInput} onChange={event => setChatInput(event.target.value)} onFocus={() => { if (voiceMode === "dictation") stopVoice(); setVoiceInputFocused(true); }} onBlur={() => setVoiceInputFocused(false)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} aria-describedby={[chatKeyboardHelpId, chatError && chatErrorId, voiceError && "assistant-agent-voice-error"].filter(Boolean).join(" ")} maxLength={12000} rows={1} spellCheck={false} placeholder="Hỏi tôi bất cứ điều gì" className="block h-10 min-h-10 max-h-10 w-full min-w-0 resize-none overflow-y-auto border-0 bg-transparent px-2.5 py-1.5 text-sm leading-6 text-on-surface placeholder:text-on-surface/60 focus-visible:outline-none focus-visible:ring-0" /></label>
        <p id={chatKeyboardHelpId} className="sr-only">Nhấn Enter để gửi, Shift + Enter để xuống dòng.</p>
        <div className="assistant-composer-toolbar order-3 flex w-full items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <label htmlFor={chatFileInputId} aria-label="Đính kèm tài liệu" title="Đính kèm tài liệu" className={cn("grid size-9 cursor-pointer place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low focus-within:ring-2 focus-within:ring-primary", chatAttachmentBusy || chatBusy ? "pointer-events-none opacity-45" : "")}><Paperclip className="size-5" aria-hidden="true" /></label>
            <input id={chatFileInputId} type="file" accept=".pdf,.docx,.txt" disabled={chatBusy || chatAttachmentBusy} onChange={event => { void attachChatFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" aria-label="Chọn tài liệu đính kèm" />
            <button type="button" disabled={chatBusy || chatAttachmentBusy} onClick={toggleDictation} aria-label={voiceMode === "dictation" ? "Dừng nhập bằng giọng nói" : "Nhập bằng giọng nói"} aria-pressed={voiceMode === "dictation"} title={voiceMode === "dictation" ? "Dừng nhập bằng giọng nói" : "Nhập bằng giọng nói"} className={cn("grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low disabled:opacity-45", focusClass)}><Mic className="size-5" aria-hidden="true" /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full px-2 text-sm text-on-surface-variant sm:inline-flex"><img src="/igenai.png" alt="" aria-hidden="true" className="size-5 object-contain" />Tự động</span>
            {voiceMode === "conversation" && <button type="button" onClick={() => setVoiceMuted(value => !value)} aria-label={voiceMuted ? "Bật micro" : "Tắt micro"} aria-pressed={voiceMuted} className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high", focusClass)}>{voiceMuted ? <MicOff className="size-4" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}</button>}
            <button type="button" disabled={(chatBusy || chatAttachmentBusy) && voiceMode !== "conversation"} onClick={toggleConversationVoice} aria-label={voiceMode === "conversation" ? "Kết thúc trò chuyện giọng nói" : "Bật trò chuyện giọng nói hai chiều"} aria-pressed={voiceMode === "conversation"} title={voiceMode === "conversation" ? "Kết thúc trò chuyện giọng nói" : "Trò chuyện giọng nói hai chiều"} className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-45", focusClass)}>{voiceMode === "conversation" ? <X className="size-4" aria-hidden="true" /> : <AudioLines className="size-5" aria-hidden="true" />}</button>
            <button type="submit" disabled={!chatInput.trim() || chatBusy || chatAttachmentBusy} aria-label="Gửi tin nhắn" className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}><Send className="size-4" aria-hidden="true" /></button>
          </div>
        </div>
      </div>
      {chatError && <p id={chatErrorId} role="alert" className="mx-auto mt-2 max-w-5xl text-sm text-error">{chatError}</p>}
      {voiceError && <p id="assistant-agent-voice-error" role="alert" className="mx-auto mt-2 max-w-4xl text-pretty text-sm text-error">{voiceError}</p>}
      {voiceMode !== "off" && <p role="status" className="sr-only">{voiceSpeaking ? "Trợ lý đang trả lời bằng giọng nói." : chatBusy ? "Trợ lý đang xử lý yêu cầu." : voiceListening ? "Micro đang nghe." : "Micro đang tạm dừng."}</p>}
    </form>
    <ConfirmDialog appearance="erp" native isOpen={Boolean(deleteTarget)} title="Xóa trợ lý?" description={`Trợ lý “${deleteTarget?.name || ""}” và lịch sử trò chuyện trên thiết bị sẽ bị xóa.`} confirmLabel="Xóa trợ lý" onClose={() => setDeleteTarget(null)} onConfirm={deleteAgent} />
  </section>;

  if (draft) {
    const editingSavedDraft = saved.some(item => item.id === draft.id);
    return <section aria-label="Tạo Trợ lý AI" className="flex min-h-0 flex-1 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => setDraft(null)} aria-label="Quay lại danh sách Trợ lý AI" className={cn("grid size-8 shrink-0 place-items-center rounded-lg hover:bg-surface-container-low", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" /></button><AgentAvatar avatar={draft.avatar} className="size-9" /><div className="min-w-0"><p className="truncate text-sm font-medium">{draft.name || (editingSavedDraft ? "Trợ lý AI" : "Tạo trợ lý mới")}</p><p className="text-xs text-on-surface-variant">Trợ lý trò chuyện độc lập</p></div></div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <header><h2 data-typography="page-title" className="text-balance text-lg font-semibold">{editorTab === "general" ? (editingSavedDraft ? "Thiết lập trợ lý" : "Tạo trợ lý mới") : "Nạp tri thức cho trợ lý"}</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">{editorTab === "general" ? "Nhập các thông tin cơ bản của trợ lý." : "Thêm tài liệu để trợ lý tham khảo khi trò chuyện."}</p></header>
        {error && <p id={formErrorId} role="alert" className="mt-5 text-pretty rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
        {editorTab === "general" && <div className="mt-5 space-y-5">
          <fieldset><legend className="text-sm font-medium">Ảnh đại diện</legend><div className="mt-2 flex flex-wrap gap-2">{[0, 1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`Chọn ảnh đại diện ${value + 1}`} aria-pressed={draft.avatar === value} onClick={() => updateDraft({ avatar: value })} className={cn("rounded-full border border-outline-variant p-1", draft.avatar === value && "border-primary", focusClass)}><AgentAvatar avatar={value} className="size-10" /></button>)}</div></fieldset>
          <label className="block text-sm font-medium">Tên trợ lý <span className="text-primary">*</span><input required aria-invalid={Boolean(error && !draft.name.trim())} aria-describedby={error && !draft.name.trim() ? formErrorId : undefined} maxLength={50} value={draft.name} onChange={event => updateDraft({ name: event.target.value })} placeholder="Ví dụ: Trợ lý phân tích báo cáo" className={cn(inputClass, "mt-1.5")} /><span className="mt-1 block text-xs font-normal tabular-nums text-on-surface-variant">{draft.name.length}/50</span></label>
          <label className="block text-sm font-medium">Chỉ dẫn <span className="text-primary">*</span><textarea required aria-invalid={Boolean(error && !draft.instructions.trim())} aria-describedby={error && !draft.instructions.trim() ? formErrorId : undefined} maxLength={10000} rows={10} value={draft.instructions} onChange={event => updateDraft({ instructions: event.target.value })} placeholder="Vai trò, cách trả lời, những điều trợ lý cần hỏi trước khi hỗ trợ…" className={cn(inputClass, "mt-1.5 resize-y")} /><span className="mt-1 block text-xs font-normal tabular-nums text-on-surface-variant">{draft.instructions.length}/10.000</span></label>
          <div className="flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"><Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><p className="text-pretty">Trợ lý dùng chung kết nối AI của tính năng Trò chuyện. Nên viết chỉ dẫn tập trung vào một nhiệm vụ cụ thể.</p></div>
          <details className="border-t border-outline-variant pt-4"><summary className="cursor-pointer text-sm font-medium">Thiết lập nâng cao</summary><div className="mt-4 space-y-4"><label className="block text-sm font-medium">Mô tả trợ lý<textarea maxLength={150} rows={3} value={draft.description} onChange={event => updateDraft({ description: event.target.value })} placeholder="Trợ lý này giúp bạn làm gì?" className={cn(inputClass, "mt-1.5 resize-y")} /><span className="mt-1 block text-xs font-normal tabular-nums text-on-surface-variant">{draft.description.length}/150</span></label><label className="block text-sm font-medium">Những điều không được làm<input maxLength={2000} value={draft.avoid} onChange={event => updateDraft({ avoid: event.target.value })} placeholder="Ví dụ: Không tự suy đoán dữ liệu chưa được cung cấp" className={cn(inputClass, "mt-1.5")} /></label><fieldset><legend className="text-sm font-medium">Phong cách</legend><div className="mt-2 flex flex-wrap gap-2">{tones.map(value => <label key={value} className={cn("cursor-pointer rounded-full border border-outline-variant px-3 py-1.5 text-xs focus-within:border-primary", draft.tone === value && "border-primary bg-primary/10 text-primary")}><input type="radio" name="agent-tone" checked={draft.tone === value} onChange={() => updateDraft({ tone: value })} className="sr-only" />{value}</label>)}</div></fieldset><fieldset><legend className="text-sm font-medium">Câu hỏi mở đầu</legend><div className="mt-2 space-y-2">{draft.openingQuestions.map((question, index) => <label key={index} className="block"><span className="sr-only">Câu hỏi mở đầu {index + 1}</span><input value={question} maxLength={160} onChange={event => updateDraft({ openingQuestions: draft.openingQuestions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} placeholder={`Câu hỏi gợi ý ${index + 1}`} className={inputClass} /></label>)}</div></fieldset></div></details>
        </div>}
        {editorTab === "knowledge" && <div className="mt-5"><ResourceEditor key={`${draft.id}:knowledge`} draft={draft} updateDraft={updateDraft} /></div>}
        <footer className="mt-auto grid grid-cols-3 items-center gap-3 border-t border-outline-variant pt-4">
          <div>{editorTab === "knowledge" && <button type="button" onClick={() => { setEditorTab("general"); setError(""); }} className={cn("inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-outline-variant px-3 text-sm", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />Trở lại</button>}</div>
          <div className="flex flex-col items-center"><div className="flex justify-center gap-1.5" aria-hidden="true"><span className={cn("size-2 rounded-full", editorTab === "general" ? "bg-primary" : "bg-outline-variant")} /><span className={cn("size-2 rounded-full", editorTab === "knowledge" ? "bg-primary" : "bg-outline-variant")} /></div><span role="status" className="sr-only">Bước {editorTab === "general" ? 1 : 2} trên 2</span></div>
          <div className="flex justify-end"><button type="button" onClick={editorTab === "general" ? continueToKnowledge : save} className={cn(primaryCreateButtonClass, "min-h-9 whitespace-nowrap")}>{editorTab === "general" ? "Tiếp tục" : editingSavedDraft ? "Lưu và trò chuyện" : "Tạo và trò chuyện"}</button></div>
        </footer>
      </div>
    </main>
  </section>;
  }

  return <section aria-label="Trợ lý AI" className="min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest px-4 pt-4 pb-6 text-on-surface sm:px-6 lg:px-8">
    <div className="flex justify-end gap-2"><button type="button" disabled={savedLoading} onClick={() => setTemplateDialogOpen(true)} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary px-3 text-sm font-medium text-primary hover:bg-primary/10 disabled:cursor-wait disabled:opacity-50", focusClass)}><Search className="size-4" aria-hidden="true" />Tìm trợ lý mẫu</button><button type="button" disabled={savedLoading} onClick={() => start()} className={cn(assistantPageCreateButtonClass, focusClass)}><Plus className="size-4" aria-hidden="true" />Tạo Trợ lý AI</button></div>
    {savedLoading && <p role="status" className="mt-3 text-right text-sm text-on-surface-variant">Đang tải trợ lý của bạn…</p>}
    {agentStorageError && <p role="alert" className="mt-3 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">{agentStorageError}</p>}
    <div className="mx-auto max-w-5xl">
      <header className="mx-auto max-w-2xl text-center"><h3 data-typography="page-title" className="assistant-large-page-title text-balance text-on-surface">Trợ lý AI</h3><p className="mt-1 text-pretty text-sm text-on-surface-variant">Tạo trợ lý trò chuyện riêng theo nhu cầu của bạn.</p></header>
      <label className="relative mx-auto mt-6 block max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm Trợ lý AI</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trợ lý…" className={cn(inputClass, "pl-10")} /></label>
      <nav aria-label="Lọc Trợ lý AI" className="mx-auto mt-5 flex max-w-xl gap-1 border-b border-outline-variant">{(["all", "mine", "shared"] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={cn("min-h-10 border-b-2 border-transparent px-3 text-sm text-on-surface-variant hover:text-on-surface", tab === value && "border-primary font-medium text-primary", focusClass)}>{value === "all" ? "Tất cả" : value === "mine" ? "Trợ lý của tôi" : "Được chia sẻ với tôi"}</button>)}</nav>
      {agentNotice && <p role="status" className="sr-only">{agentNotice}</p>}
      <div className="mt-6 space-y-8">
        {tab !== "shared" && visibleSaved.length > 0 && <section aria-labelledby="my-agents-heading">
          <h4 id="my-agents-heading" className="mb-3 text-balance text-sm font-semibold">Trợ lý của tôi</h4>
          <div className="grid gap-3 xl:grid-cols-2">{visibleSaved.map(item => <AgentCard key={item.id} name={item.name} avatar={item.avatar} subtitle="Của tôi" description={item.description || "Chưa có mô tả."} headerActions={<>
            <button type="button" aria-label={item.favorite ? `Bỏ yêu thích ${item.name}` : `Yêu thích ${item.name}`} aria-pressed={Boolean(item.favorite)} onClick={() => { void toggleFavorite(item.id); }} className={cn("grid size-9 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", item.favorite && "text-favorite", focusClass)}><Star className={cn("size-4", item.favorite && "fill-current")} aria-hidden="true" /></button>
            <details className="group relative"><summary aria-label={`Tùy chọn ${item.name}`} className={cn("grid size-9 cursor-pointer list-none place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}><MoreVertical className="size-4" aria-hidden="true" /></summary><div className="absolute right-0 z-10 mt-1 min-w-40 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md"><button type="button" onClick={event => { void cloneAgent(item, event.currentTarget); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}><Copy className="size-4" aria-hidden="true" />Nhân bản</button><button type="button" onClick={() => setDeleteTarget(item)} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-error hover:bg-error/10", focusClass)}><Trash2 className="size-4" aria-hidden="true" />Xóa</button></div></details>
          </>}>
            <button type="button" onClick={() => { setDraft(item); setEditorTab("general"); setError(""); }} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-2.5 text-sm text-on-surface hover:bg-surface-container-low", focusClass)}><Settings2 className="size-4" aria-hidden="true" />Thiết lập trợ lý</button>
            <button type="button" onClick={() => openChat(item)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary px-2.5 text-sm text-primary hover:bg-primary/10", focusClass)}>Mở trò chuyện<ArrowUpRight className="size-4" aria-hidden="true" /></button>
          </AgentCard>)}</div>
        </section>}
        {tab === "all" && visibleSamples.length > 0 && <section aria-labelledby="sample-agents-heading">
          <h4 id="sample-agents-heading" className="mb-1 text-balance text-sm font-semibold">Gợi ý trợ lý</h4>
          <p className="mb-3 text-pretty text-xs text-on-surface-variant">Chọn một cấu hình gợi ý để bắt đầu tạo trợ lý của riêng bạn.</p>
          <div className="grid gap-3 xl:grid-cols-2">{visibleSamples.map(item => <AgentCard key={item.name} name={item.name} avatar={item.avatar} subtitle="Cấu hình gợi ý" description={item.description}>
            <button type="button" disabled={savedLoading} onClick={() => start(item)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-2.5 text-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50", focusClass)}><Settings2 className="size-4" aria-hidden="true" />Thiết lập trợ lý</button>
            <button type="button" disabled={savedLoading} onClick={() => openSampleChat(item)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary px-2.5 text-sm text-primary hover:bg-primary/10 disabled:opacity-50", focusClass)}>Mở trò chuyện<ArrowUpRight className="size-4" aria-hidden="true" /></button>
          </AgentCard>)}</div>
        </section>}
        {!savedLoading && !agentStorageError && (tab === "shared" || (tab === "mine" && !visibleSaved.length) || (tab === "all" && !visibleSaved.length && !visibleSamples.length)) && <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center"><HrEmptyIllustration kind="search" /><p className="mt-1 text-pretty text-sm text-on-surface-variant">{tab === "shared" ? "Chưa có trợ lý nào được chia sẻ với bạn." : query ? "Không tìm thấy trợ lý phù hợp." : "Bạn chưa có Trợ lý AI nào."}</p>{tab !== "shared" && <button type="button" onClick={() => { setQuery(""); start(); }} className={cn("mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary", focusClass)}>Tạo Trợ lý AI</button>}</div>}
      </div>
    </div>
    <AssistantAgentTemplateDialog open={templateDialogOpen} savedNames={saved.map(item => item.name)} onClose={() => setTemplateDialogOpen(false)} onUse={template => { setTemplateDialogOpen(false); start(template); }} />
    <ConfirmDialog appearance="erp" native isOpen={Boolean(deleteTarget)} title="Xóa trợ lý?" description={`Trợ lý “${deleteTarget?.name || ""}” và lịch sử trò chuyện trên thiết bị sẽ bị xóa.`} confirmLabel="Xóa trợ lý" onClose={() => setDeleteTarget(null)} onConfirm={deleteAgent} />
  </section>;
}
