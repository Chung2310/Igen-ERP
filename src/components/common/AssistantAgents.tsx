import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, ChevronDown, FileText, Lightbulb, Link2, MoreVertical, Paperclip, Plus, Search, Send, Settings2, Star, Trash2, Upload, X } from "lucide-react";
import { assistantAgentService, type AgentChatMessage } from "../../services/assistantAgentService";
import { cn } from "../../modules/student-management/lib/utils";
import { HrEmptyIllustration } from "../hr/HrEmptyIllustration";
import { primaryCreateButtonClass } from "./primaryCreateButton";
import { assistantPageCreateButtonClass } from "./assistantPageCreateButton";
import { ConfirmDialog } from "./ConfirmDialog";

type AgentTab = "all" | "mine" | "shared";
type EditorTab = "general" | "knowledge";
type KnowledgeKind = "link" | "text" | "file";
type AgentResource = { id: string; title: string; kind: KnowledgeKind; content: string; createdAt: string };
type AgentDraft = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  avoid: string;
  tone: string;
  avatar: number;
  favorite?: boolean;
  openingQuestions: string[];
  knowledge: AgentResource[];
};

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const inputClass = "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none";
const tones = ["Tự động", "Thân thiện", "Bình thường", "Chuyên nghiệp", "Ngắn gọn"];
const sampleAgents = [
  { name: "Trợ lý nội dung", description: "Gợi ý cấu trúc bài viết và thông điệp theo mục tiêu của bạn.", instructions: "Bạn là trợ lý nội dung. Hỏi rõ đối tượng, kênh đăng và mục tiêu trước khi đề xuất nội dung.", tone: "Thân thiện", avatar: 0 },
  { name: "Trợ lý phân tích", description: "Giúp diễn giải số liệu và trình bày các điểm đáng chú ý.", instructions: "Bạn là trợ lý phân tích. Chỉ dựa trên dữ liệu được cung cấp, nêu rõ giả định và trình bày kết luận dễ hiểu.", tone: "Chuyên nghiệp", avatar: 1 },
  { name: "Trợ lý học tập", description: "Giải thích khái niệm và gợi ý lộ trình học theo từng bước.", instructions: "Bạn là trợ lý học tập. Giải thích bằng ví dụ đơn giản, hỏi trình độ của người học và kiểm tra mức độ hiểu.", tone: "Thân thiện", avatar: 2 },
];

function emptyDraft(sample?: (typeof sampleAgents)[number]): AgentDraft {
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

function ResourceEditor({ draft, updateDraft }: { draft: AgentDraft; updateDraft: (patch: Partial<AgentDraft>) => void }) {
  const resourceErrorId = useId();
  const [addMode, setAddMode] = useState<KnowledgeKind | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [resourceError, setResourceError] = useState("");
  const [query, setQuery] = useState("");
  const items = draft.knowledge;
  const visible = items.filter(item => `${item.title} ${item.content}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addMode || items.length >= 20) { setResourceError("Mỗi trợ lý hỗ trợ tối đa 20 tài liệu tri thức."); return; }
    setBusy(true); setResourceError("");
    try {
      const extracted = addMode === "file" && selectedFile ? await assistantAgentService.extractFile(selectedFile) : null;
      if (addMode === "file" && !extracted) throw new Error("Hãy chọn một tệp tài liệu.");
      const resource: AgentResource = { id: crypto.randomUUID(), title: title.trim() || extracted?.fileName || "Nội dung mới", kind: addMode, content: extracted?.text || (addMode === "link" ? `Nguồn: ${linkUrl.trim()}\n${content.trim()}` : content.trim()), createdAt: new Date().toISOString() };
      updateDraft({ knowledge: [...items, resource] });
      setTitle(""); setContent(""); setLinkUrl(""); setSelectedFile(null); setAddMode(null);
    } catch (error) { setResourceError(error instanceof Error ? error.message : "Không thể nạp tri thức."); }
    finally { setBusy(false); }
  };

  return <section aria-label="Tri thức của trợ lý" className="space-y-4">
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-surface-container-low p-6 text-center">
      <Upload className="size-9 text-primary" aria-hidden="true" />
      <p className="mt-3 text-balance text-sm font-medium">Nạp tri thức bằng các cách dưới đây</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Cách thêm tri thức">
        <button type="button" aria-pressed={addMode === "file"} onClick={() => setAddMode("file")} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm hover:bg-primary/10", addMode === "file" && "border-primary text-primary", focusClass)}><Upload className="size-4" aria-hidden="true" />Tải tệp lên</button>
        <button type="button" aria-pressed={addMode === "link"} onClick={() => setAddMode("link")} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm hover:bg-primary/10", addMode === "link" && "border-primary text-primary", focusClass)}><Link2 className="size-4" aria-hidden="true" />Thêm liên kết</button>
        <button type="button" aria-pressed={addMode === "text"} onClick={() => setAddMode("text")} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm hover:bg-primary/10", addMode === "text" && "border-primary text-primary", focusClass)}><FileText className="size-4" aria-hidden="true" />Nhập nội dung</button>
      </div>
    </div>
    {addMode && <form onSubmit={add} aria-describedby={resourceError ? resourceErrorId : undefined} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <label className="block text-sm font-medium">{addMode === "link" ? "Tên liên kết" : addMode === "text" ? "Tên nội dung" : "Tên tệp"}<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} className={cn(inputClass, "mt-1.5")} placeholder="Đặt tên để dễ tìm" /></label>
      {addMode === "link" ? <><label className="block text-sm font-medium">Đường dẫn<input type="url" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} required maxLength={2000} className={cn(inputClass, "mt-1.5")} placeholder="https://..." /></label><label className="block text-sm font-medium">Nội dung tham khảo<textarea value={content} onChange={event => setContent(event.target.value)} required maxLength={7500} rows={5} className={cn(inputClass, "mt-1.5 resize-y")} placeholder="Dán nội dung từ trang này để trợ lý có thể dùng khi trả lời" /></label></>
        : addMode === "text" ? <label className="block text-sm font-medium">Nội dung<textarea value={content} onChange={event => setContent(event.target.value)} required maxLength={10000} rows={5} className={cn(inputClass, "mt-1.5 resize-y")} placeholder="Dán nội dung tham chiếu" /></label>
          : <label className="block text-sm font-medium">Chọn tệp<input type="file" accept=".pdf,.docx,.txt" onChange={event => { const file = event.currentTarget.files?.[0] || null; setSelectedFile(file); setTitle(file?.name || ""); }} required className={cn(inputClass, "mt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-primary")} /></label>}
      {resourceError && <p id={resourceErrorId} role="alert" className="text-sm text-error">{resourceError}</p>}
      <div className="flex gap-2"><button type="submit" disabled={busy} className={cn("rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary disabled:opacity-50", focusClass)}>{busy ? "Đang đọc tài liệu…" : "Thêm tri thức"}</button><button type="button" onClick={() => setAddMode(null)} className={cn("rounded-lg border border-outline-variant px-3 py-2 text-sm", focusClass)}>Hủy</button></div>
    </form>}
    {items.length > 0 && <>
      <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm tri thức</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tri thức" className={cn(inputClass, "pl-9")} /></label>
      {visible.length ? <ul className="divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant">{visible.map(item => <li key={item.id} className="flex items-center gap-3 px-3 py-3">
      {item.kind === "link" ? <Link2 className="size-4 shrink-0 text-primary" aria-hidden="true" /> : item.kind === "file" ? <Upload className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-on-surface-variant">{item.kind === "link" ? "Liên kết và nội dung tham khảo" : item.kind === "text" ? "Nội dung văn bản" : "Văn bản đã trích xuất từ tệp"}</p></div>
      <button type="button" aria-label={`Bỏ ${item.title} khỏi trợ lý`} onClick={() => updateDraft({ knowledge: items.filter(entry => entry.id !== item.id) })} className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><Trash2 className="size-4" aria-hidden="true" /></button>
      </li>)}</ul> : <p role="status" className="text-center text-sm text-on-surface-variant">Không tìm thấy tri thức phù hợp.</p>}
    </>}
  </section>;
}

export function AssistantAgents({ storageScope, creatorName }: { storageScope: string; creatorName?: string }) {
  const formErrorId = useId();
  const chatErrorId = useId();
  const storageKey = `igen_erp_agent_drafts:${storageScope}`;
  const [saved, setSaved] = useState<AgentDraft[]>(() => readDrafts(storageKey));
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [tab, setTab] = useState<AgentTab>("all");
  const [editorTab, setEditorTab] = useState<EditorTab>("general");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [chatAgent, setChatAgent] = useState<AgentDraft | null>(null);
  const [chatMessages, setChatMessages] = useState<AgentChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatAttachment, setChatAttachment] = useState<{ fileName: string; text: string } | null>(null);
  const [chatAttachmentBusy, setChatAttachmentBusy] = useState(false);
  const chatFileInputId = useId();
  const [deleteTarget, setDeleteTarget] = useState<AgentDraft | null>(null);

  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Keep the draft for this session. */ } }, [saved, storageKey]);
  const chatKey = (agentId: string) => `igen_erp_agent_chat:${storageScope}:${agentId}`;
  const openChat = (agent: AgentDraft) => {
    let history: AgentChatMessage[] = [];
    try { const stored: unknown = JSON.parse(localStorage.getItem(chatKey(agent.id)) || "[]"); if (Array.isArray(stored)) history = stored.filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map(item => ({ role: item.role, content: item.content, ...(typeof item.attachmentName === "string" ? { attachmentName: item.attachmentName } : {}) } as AgentChatMessage)).slice(-100); } catch { /* Start a new conversation. */ }
    setChatAgent(agent); setChatMessages(history); setChatInput(""); setChatError(""); setChatAttachment(null); setDraft(null);
  };
  const attachChatFile = async (file?: File) => {
    if (!file) return;
    setChatAttachmentBusy(true); setChatError("");
    try { setChatAttachment(await assistantAgentService.extractFile(file)); }
    catch (error) { setChatError(error instanceof Error ? error.message : "Không thể đọc tài liệu."); }
    finally { setChatAttachmentBusy(false); }
  };
  const sendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!chatAgent || !text || chatBusy) return;
    const outgoing: AgentChatMessage[] = [...chatMessages, { role: "user", content: text, ...(chatAttachment ? { attachmentName: chatAttachment.fileName, attachmentText: chatAttachment.text } : {}) }];
    setChatBusy(true); setChatError(""); setChatMessages(outgoing); setChatInput("");
    try {
      const result = await assistantAgentService.chat(chatAgent, outgoing);
      const complete: AgentChatMessage[] = [...outgoing, { role: "assistant", content: result.reply }];
      setChatMessages(complete);
      try { localStorage.setItem(chatKey(chatAgent.id), JSON.stringify(complete.slice(-100).map(({ attachmentText: _attachmentText, ...message }) => message))); } catch { /* Keep the conversation for this session. */ }
      setChatAttachment(null);
    } catch (error) {
      setChatMessages(chatMessages); setChatInput(text);
      setChatError(error instanceof Error ? error.message : "Không thể gửi tin nhắn.");
    } finally { setChatBusy(false); }
  };
  const updateDraft = (patch: Partial<AgentDraft>) => { setDraft(current => current ? { ...current, ...patch } : current); setError(""); };
  const start = (sample?: (typeof sampleAgents)[number]) => { setDraft(emptyDraft(sample)); setEditorTab("general"); setError(""); };
  const openSampleChat = (sample: (typeof sampleAgents)[number]) => {
    const existing = saved.find(item => item.name === sample.name);
    if (existing) { openChat(existing); return; }
    const agent = emptyDraft(sample);
    setSaved(current => [agent, ...current]);
    openChat(agent);
  };
  const continueToKnowledge = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.instructions.trim()) { setError("Nhập tên và chỉ dẫn trước khi tiếp tục."); return; }
    setEditorTab("knowledge");
    setError("");
  };
  const save = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.instructions.trim()) { setEditorTab("general"); setError("Nhập tên và chỉ dẫn trước khi tạo trợ lý."); return; }
    const cleaned = { ...draft, name: draft.name.trim(), description: draft.description.trim(), instructions: draft.instructions.trim() };
    setSaved(current => [cleaned, ...current.filter(item => item.id !== cleaned.id)]);
    setError(""); openChat(cleaned);
  };
  const toggleFavorite = (agentId: string) => {
    setSaved(current => current.map(item => item.id === agentId ? { ...item, favorite: !item.favorite } : item));
    setChatAgent(current => current?.id === agentId ? { ...current, favorite: !current.favorite } : current);
  };
  const deleteAgent = () => {
    if (!deleteTarget) return;
    setSaved(current => current.filter(item => item.id !== deleteTarget.id));
    try { localStorage.removeItem(chatKey(deleteTarget.id)); } catch { /* Keep the list usable. */ }
    if (chatAgent?.id === deleteTarget.id) { setChatAgent(null); setChatMessages([]); }
    setDeleteTarget(null);
  };
  const visibleSaved = saved.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const visibleSamples = sampleAgents.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));

  if (chatAgent) return <section aria-label={`Trò chuyện với ${chatAgent.name}`} className="flex min-h-0 flex-1 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
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
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" disabled={chatBusy} aria-label={chatAgent.favorite ? `Bỏ yêu thích ${chatAgent.name}` : `Yêu thích ${chatAgent.name}`} aria-pressed={Boolean(chatAgent.favorite)} onClick={() => toggleFavorite(chatAgent.id)} className={cn("grid size-10 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low disabled:opacity-45", chatAgent.favorite && "text-primary", focusClass)}><Star className={cn("size-5", chatAgent.favorite && "fill-current")} aria-hidden="true" /></button>
        <details className="group relative">
          <summary aria-label={`Tùy chọn ${chatAgent.name}`} aria-disabled={chatBusy} onClick={event => { if (chatBusy) event.preventDefault(); }} className={cn("grid size-10 cursor-pointer list-none place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", chatBusy && "pointer-events-none opacity-45", focusClass)}><MoreVertical className="size-5" aria-hidden="true" /></summary>
          <div className="absolute right-0 z-20 mt-1 min-w-40 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md">
            <button type="button" onClick={() => { setDraft(chatAgent); setEditorTab("general"); setChatAgent(null); }} className={cn("flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}><Settings2 className="size-4" aria-hidden="true" />Thiết lập trợ lý</button>
            <button type="button" onClick={() => setDeleteTarget(chatAgent)} className={cn("flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-error hover:bg-error/10", focusClass)}><Trash2 className="size-4" aria-hidden="true" />Xóa trợ lý</button>
          </div>
        </details>
      </div>
    </header>
    <div aria-live="polite" aria-busy={chatBusy || chatAttachmentBusy} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">
      {chatMessages.length === 0 ? <div className="flex min-h-full flex-col items-center justify-center pb-12 text-center">
        <AgentAvatar avatar={chatAgent.avatar} className="size-[4.5rem]" />
        <h2 className="mt-6 text-balance text-lg font-medium">{chatAgent.name}</h2>
        <p className="mt-6 text-pretty text-sm text-on-surface-variant">Tạo bởi {creatorName?.trim() || "bạn"}</p>
      </div> : <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-5 py-6">
        {chatMessages.map((message, index) => message.role === "user"
          ? <div key={index} className="max-w-[85%] self-end rounded-2xl bg-surface-container-low px-4 py-3 text-sm sm:max-w-[75%]">{message.attachmentName && <p className="mb-2 flex items-center gap-1.5 text-xs text-on-surface-variant"><FileText className="size-4" aria-hidden="true" />{message.attachmentName}</p>}<p className="whitespace-pre-wrap text-pretty">{message.content}</p></div>
          : <article key={index} className="max-w-full self-start text-sm"><p className="mb-1 text-xs text-on-surface-variant">{chatAgent.name}</p><p className="whitespace-pre-wrap text-pretty leading-6">{message.content}</p></article>)}
        {chatBusy && <p role="status" className="text-sm text-on-surface-variant">Trợ lý đang trả lời…</p>}
      </div>}
    </div>
    <form onSubmit={sendChat} className="shrink-0 px-4 pb-4 pt-2 sm:px-6 sm:pb-5">
      <div className="mx-auto max-w-5xl rounded-[1.5rem] border border-outline bg-surface-container-lowest p-3 transition-colors focus-within:border-primary sm:p-4">
        {chatAttachmentBusy && <p role="status" className="px-1 pb-2 text-xs text-on-surface-variant">Đang đọc tài liệu…</p>}
        {chatAttachment && <div className="mb-2 flex max-w-full items-center gap-2 rounded-lg bg-surface-container-low px-2 py-1.5 text-xs"><FileText className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{chatAttachment.fileName}</span><button type="button" disabled={chatBusy} aria-label={`Bỏ tệp ${chatAttachment.fileName}`} onClick={() => setChatAttachment(null)} className={cn("grid size-7 shrink-0 place-items-center rounded-md text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50", focusClass)}><X className="size-4" aria-hidden="true" /></button></div>}
        <label className="block"><span className="sr-only">Tin nhắn gửi {chatAgent.name}</span><textarea value={chatInput} onChange={event => setChatInput(event.target.value)} aria-describedby={chatError ? chatErrorId : undefined} maxLength={12000} rows={2} placeholder="Hỏi tôi bất cứ điều gì" className="max-h-48 min-h-12 w-full resize-y border-0 bg-transparent px-1 py-1 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-0" /></label>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <label htmlFor={chatFileInputId} aria-label="Đính kèm tài liệu" title="Đính kèm tài liệu" className={cn("grid size-9 cursor-pointer place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low focus-within:ring-2 focus-within:ring-primary", chatAttachmentBusy || chatBusy ? "pointer-events-none opacity-45" : "")}><Paperclip className="size-5" aria-hidden="true" /></label>
            <input id={chatFileInputId} type="file" accept=".pdf,.docx,.txt" disabled={chatBusy || chatAttachmentBusy} onChange={event => { void attachChatFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} className="sr-only" aria-label="Chọn tài liệu đính kèm" />
            <button type="button" disabled={chatBusy} aria-label="Thiết lập tri thức" title="Thiết lập tri thức" onClick={() => { setDraft(chatAgent); setEditorTab("knowledge"); setChatAgent(null); }} className={cn("grid size-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low disabled:opacity-45", focusClass)}><FileText className="size-5" aria-hidden="true" /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full px-2 text-sm text-on-surface-variant sm:inline-flex"><img src="/igenai.png" alt="" aria-hidden="true" className="size-5 object-contain" />Tự động</span>
            <button type="submit" disabled={!chatInput.trim() || chatBusy || chatAttachmentBusy} aria-label="Gửi tin nhắn" className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-primary text-on-primary disabled:opacity-45", focusClass)}><Send className="size-4" aria-hidden="true" /></button>
          </div>
        </div>
      </div>
      {chatError && <p id={chatErrorId} role="alert" className="mx-auto mt-2 max-w-5xl text-sm text-error">{chatError}</p>}
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
    <div className="flex justify-end"><button type="button" onClick={() => start()} className={cn(assistantPageCreateButtonClass, focusClass)}><Plus className="size-4" aria-hidden="true" />Tạo Trợ lý AI</button></div>
    <div className="mx-auto max-w-5xl">
      <header className="mx-auto max-w-2xl text-center"><h3 data-typography="page-title" className="assistant-large-page-title text-balance text-on-surface">Trợ lý AI</h3><p className="mt-1 text-pretty text-sm text-on-surface-variant">Tạo trợ lý trò chuyện riêng theo nhu cầu của bạn.</p></header>
      <label className="relative mx-auto mt-6 block max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm Trợ lý AI</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trợ lý…" className={cn(inputClass, "pl-10")} /></label>
      <nav aria-label="Lọc Trợ lý AI" className="mx-auto mt-5 flex max-w-xl gap-1 border-b border-outline-variant">{(["all", "mine", "shared"] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={cn("min-h-10 border-b-2 border-transparent px-3 text-sm text-on-surface-variant hover:text-on-surface", tab === value && "border-primary font-medium text-primary", focusClass)}>{value === "all" ? "Tất cả" : value === "mine" ? "Trợ lý của tôi" : "Được chia sẻ với tôi"}</button>)}</nav>
      <div className="mt-6 space-y-8">
        {tab !== "shared" && visibleSaved.length > 0 && <section aria-labelledby="my-agents-heading">
          <h4 id="my-agents-heading" className="mb-3 text-balance text-sm font-semibold">Trợ lý của tôi</h4>
          <div className="grid gap-3 xl:grid-cols-2">{visibleSaved.map(item => <AgentCard key={item.id} name={item.name} avatar={item.avatar} subtitle="Của tôi" description={item.description || "Chưa có mô tả."} headerActions={<>
            <button type="button" aria-label={item.favorite ? `Bỏ yêu thích ${item.name}` : `Yêu thích ${item.name}`} aria-pressed={Boolean(item.favorite)} onClick={() => toggleFavorite(item.id)} className={cn("grid size-9 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", item.favorite && "text-primary", focusClass)}><Star className={cn("size-4", item.favorite && "fill-current")} aria-hidden="true" /></button>
            <details className="group relative"><summary aria-label={`Tùy chọn ${item.name}`} className={cn("grid size-9 cursor-pointer list-none place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low [&::-webkit-details-marker]:hidden", focusClass)}><MoreVertical className="size-4" aria-hidden="true" /></summary><div className="absolute right-0 z-10 mt-1 min-w-32 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md"><button type="button" onClick={() => setDeleteTarget(item)} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-error hover:bg-error/10", focusClass)}><Trash2 className="size-4" aria-hidden="true" />Xóa trợ lý</button></div></details>
          </>}>
            <button type="button" onClick={() => { setDraft(item); setEditorTab("general"); setError(""); }} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-2.5 text-sm text-on-surface hover:bg-surface-container-low", focusClass)}><Settings2 className="size-4" aria-hidden="true" />Thiết lập trợ lý</button>
            <button type="button" onClick={() => openChat(item)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary px-2.5 text-sm text-primary hover:bg-primary/10", focusClass)}>Mở trò chuyện<ArrowUpRight className="size-4" aria-hidden="true" /></button>
          </AgentCard>)}</div>
        </section>}
        {tab === "all" && visibleSamples.length > 0 && <section aria-labelledby="sample-agents-heading">
          <h4 id="sample-agents-heading" className="mb-1 text-balance text-sm font-semibold">Gợi ý trợ lý</h4>
          <p className="mb-3 text-pretty text-xs text-on-surface-variant">Chọn một cấu hình gợi ý để bắt đầu tạo trợ lý của riêng bạn.</p>
          <div className="grid gap-3 xl:grid-cols-2">{visibleSamples.map(item => <AgentCard key={item.name} name={item.name} avatar={item.avatar} subtitle="Cấu hình gợi ý" description={item.description}>
            <button type="button" onClick={() => start(item)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-2.5 text-sm text-on-surface hover:bg-surface-container-low", focusClass)}><Settings2 className="size-4" aria-hidden="true" />Thiết lập trợ lý</button>
            <button type="button" onClick={() => openSampleChat(item)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary px-2.5 text-sm text-primary hover:bg-primary/10", focusClass)}>Mở trò chuyện<ArrowUpRight className="size-4" aria-hidden="true" /></button>
          </AgentCard>)}</div>
        </section>}
        {(tab === "shared" || (tab === "mine" && !visibleSaved.length) || (tab === "all" && !visibleSaved.length && !visibleSamples.length)) && <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center"><HrEmptyIllustration kind="search" /><p className="mt-1 text-pretty text-sm text-on-surface-variant">{tab === "shared" ? "Chưa có trợ lý nào được chia sẻ với bạn." : query ? "Không tìm thấy trợ lý phù hợp." : "Bạn chưa có Trợ lý AI nào."}</p>{tab !== "shared" && <button type="button" onClick={() => { setQuery(""); start(); }} className={cn("mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary", focusClass)}>Tạo Trợ lý AI</button>}</div>}
      </div>
    </div>
    <ConfirmDialog appearance="erp" native isOpen={Boolean(deleteTarget)} title="Xóa trợ lý?" description={`Trợ lý “${deleteTarget?.name || ""}” và lịch sử trò chuyện trên thiết bị sẽ bị xóa.`} confirmLabel="Xóa trợ lý" onClose={() => setDeleteTarget(null)} onConfirm={deleteAgent} />
  </section>;
}
