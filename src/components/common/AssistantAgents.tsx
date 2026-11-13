import { useEffect, useId, useState, type FormEvent } from "react";
import { ArrowLeft, FileText, Link2, Plus, Search, Trash2, Upload } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { HrEmptyIllustration } from "../hr/HrEmptyIllustration";
import { AssistantAgentIcon } from "./AssistantAgentIcon";
import { primaryCreateButtonClass } from "./primaryCreateButton";

type AgentTab = "all" | "mine" | "shared";
type EditorTab = "general" | "knowledge" | "templates";
type KnowledgeKind = "link" | "text" | "file";
type AgentResource = { id: string; title: string; kind: KnowledgeKind | "template"; content: string; createdAt: string };
type AgentDraft = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  avoid: string;
  tone: string;
  avatar: number;
  openingQuestions: string[];
  knowledge: AgentResource[];
  templates: AgentResource[];
};

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const inputClass = "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none";
const tones = ["Tự động", "Thân thiện", "Bình thường", "Chuyên nghiệp", "Ngắn gọn"];
const sampleAgents = [
  { name: "Trợ lý nội dung", description: "Gợi ý cấu trúc bài viết và thông điệp theo mục tiêu của bạn.", instructions: "Bạn là trợ lý nội dung iGenAI. Hỏi rõ đối tượng, kênh đăng và mục tiêu trước khi đề xuất nội dung.", tone: "Thân thiện", avatar: 0 },
  { name: "Trợ lý phân tích", description: "Giúp diễn giải số liệu và trình bày các điểm đáng chú ý.", instructions: "Bạn là trợ lý phân tích iGenAI. Chỉ dựa trên dữ liệu được cung cấp, nêu rõ giả định và trình bày kết luận dễ hiểu.", tone: "Chuyên nghiệp", avatar: 1 },
  { name: "Trợ lý học tập", description: "Giải thích khái niệm và gợi ý lộ trình học theo từng bước.", instructions: "Bạn là trợ lý học tập iGenAI. Giải thích bằng ví dụ đơn giản, hỏi trình độ của người học và kiểm tra mức độ hiểu.", tone: "Thân thiện", avatar: 2 },
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
    openingQuestions: ["", ""],
    knowledge: [],
    templates: [],
  };
}

function readDrafts(key: string): AgentDraft[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item): item is AgentDraft => Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.knowledge) && Array.isArray(item.templates))) : [];
  } catch { return []; }
}

function AgentAvatar({ avatar = 0, className = "size-10" }: { avatar?: number; className?: string }) {
  return <img src={`/assistant-avatars/avatar-${avatar + 1}.webp`} alt="" aria-hidden="true" loading="lazy" className={cn("block shrink-0 rounded-full border border-outline-variant object-cover", className)} />;
}

function ResourceEditor({ kind, draft, updateDraft }: { kind: "knowledge" | "templates"; draft: AgentDraft; updateDraft: (patch: Partial<AgentDraft>) => void }) {
  const [addMode, setAddMode] = useState<KnowledgeKind | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const items = draft[kind];
  const visible = items.filter(item => `${item.title} ${item.content}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const label = kind === "knowledge" ? "tri thức" : "biểu mẫu";

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const resourceTitle = title.trim() || (addMode === "text" ? "Nội dung mới" : "");
    if (!resourceTitle || !addMode) return;
    const resource: AgentResource = { id: crypto.randomUUID(), title: resourceTitle, kind: kind === "templates" ? "template" : addMode, content: content.trim(), createdAt: new Date().toISOString() };
    updateDraft({ [kind]: [...items, resource] });
    setTitle(""); setContent(""); setAddMode(null);
  };

  return <section aria-label={kind === "knowledge" ? "Tri thức của trợ lý" : "Biểu mẫu của trợ lý"} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h4 className="text-balance text-sm font-semibold">{kind === "knowledge" ? "Tri thức" : "Biểu mẫu"}</h4><p className="mt-1 text-pretty text-xs text-on-surface-variant">{kind === "knowledge" ? "Tài liệu tham chiếu cho trợ lý." : "Tệp mẫu để trợ lý tham khảo cách trình bày."}</p></div>
      <button type="button" onClick={() => setAddMode(kind === "knowledge" ? "link" : "file")} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant px-3 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}><Plus className="size-4" aria-hidden="true" />Thêm {label}</button>
    </div>
    {kind === "knowledge" && <div className="flex flex-wrap gap-2" role="group" aria-label="Loại tri thức">
      {(["link", "text", "file"] as const).map(mode => <button key={mode} type="button" aria-pressed={addMode === mode} onClick={() => setAddMode(mode)} className={cn("rounded-lg border border-outline-variant px-3 py-1.5 text-xs hover:bg-surface-container-low", addMode === mode && "border-primary bg-primary/10 text-primary", focusClass)}>{mode === "link" ? "Liên kết" : mode === "text" ? "Nội dung" : "Tệp"}</button>)}
    </div>}
    {addMode && <form onSubmit={add} className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <label className="block text-sm font-medium">{addMode === "link" ? "Tên liên kết" : addMode === "text" ? "Tên nội dung" : "Tên tệp"}<input value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} className={cn(inputClass, "mt-1.5")} placeholder={addMode === "file" ? "Ví dụ: Mẫu báo cáo tháng" : "Đặt tên để dễ tìm"} /></label>
      {addMode === "link" ? <label className="block text-sm font-medium">Đường dẫn<input type="url" value={content} onChange={event => setContent(event.target.value)} required className={cn(inputClass, "mt-1.5")} placeholder="https://..." /></label>
        : addMode === "text" ? <label className="block text-sm font-medium">Nội dung<textarea value={content} onChange={event => setContent(event.target.value)} required rows={5} className={cn(inputClass, "mt-1.5 resize-y")} placeholder="Dán nội dung tham chiếu" /></label>
          : <label className="block text-sm font-medium">Chọn tệp<input type="file" onChange={event => setContent(event.currentTarget.files?.[0]?.name ?? "")} required className={cn(inputClass, "mt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-primary")} /></label>}
      {addMode === "file" && <p className="text-pretty text-xs text-on-surface-variant">Bản nháp chỉ ghi tên tệp trên thiết bị. Nội dung tệp chưa được tải lên.</p>}
      <div className="flex gap-2"><button type="submit" className={cn("rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary", focusClass)}>Thêm vào bản nháp</button><button type="button" onClick={() => setAddMode(null)} className={cn("rounded-lg border border-outline-variant px-3 py-2 text-sm", focusClass)}>Hủy</button></div>
    </form>}
    <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm {label}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Tìm ${label}`} className={cn(inputClass, "pl-9")} /></label>
    {visible.length ? <ul className="divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant">{visible.map(item => <li key={item.id} className="flex items-center gap-3 px-3 py-3">
      {item.kind === "link" ? <Link2 className="size-4 shrink-0 text-primary" aria-hidden="true" /> : item.kind === "file" || item.kind === "template" ? <Upload className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-xs text-on-surface-variant">{item.kind === "link" ? item.content : item.kind === "text" ? "Nội dung văn bản" : "Tên tệp trong bản nháp"}</p></div>
      <button type="button" aria-label={`Bỏ ${item.title} khỏi bản nháp`} onClick={() => updateDraft({ [kind]: items.filter(entry => entry.id !== item.id) })} className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><Trash2 className="size-4" aria-hidden="true" /></button>
    </li>)}</ul> : <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center"><HrEmptyIllustration kind="search" className="h-20 w-32" /><p className="mt-1 text-pretty text-sm text-on-surface-variant">{query ? `Không tìm thấy ${label} phù hợp.` : `Chưa có ${label} nào.`}</p></div>}
  </section>;
}

export function AssistantAgents({ storageScope }: { storageScope: string }) {
  const formErrorId = useId();
  const storageKey = `igen_erp_agent_drafts:${storageScope}`;
  const [saved, setSaved] = useState<AgentDraft[]>(() => readDrafts(storageKey));
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [tab, setTab] = useState<AgentTab>("all");
  const [editorTab, setEditorTab] = useState<EditorTab>("general");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* Keep the draft for this session. */ } }, [saved, storageKey]);
  const updateDraft = (patch: Partial<AgentDraft>) => { setDraft(current => current ? { ...current, ...patch } : current); setSavedNotice(false); };
  const start = (sample?: (typeof sampleAgents)[number]) => { setDraft(emptyDraft(sample)); setEditorTab("general"); setError(""); setSavedNotice(false); };
  const save = () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.instructions.trim()) { setEditorTab("general"); setError("Nhập tên và chỉ dẫn trước khi lưu bản nháp."); return; }
    const cleaned = { ...draft, name: draft.name.trim(), description: draft.description.trim(), instructions: draft.instructions.trim() };
    setSaved(current => [cleaned, ...current.filter(item => item.id !== cleaned.id)]);
    setDraft(cleaned); setError(""); setSavedNotice(true);
  };
  const visibleSaved = saved.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const visibleSamples = sampleAgents.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));

  if (draft) return <section aria-label="Thiết lập Trợ lý AI" className="flex min-h-0 flex-1 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => setDraft(null)} aria-label="Quay lại danh sách Trợ lý AI" className={cn("grid size-8 shrink-0 place-items-center rounded-lg hover:bg-surface-container-low", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" /></button><AgentAvatar avatar={draft.avatar} className="size-9" /><div className="min-w-0"><h3 data-typography="page-title" className="truncate text-balance text-lg font-semibold">{draft.name || "Trợ lý mới"}</h3><p className="text-xs text-on-surface-variant">Bản nháp trên thiết bị</p></div></div>
      <button type="button" onClick={save} className={cn(primaryCreateButtonClass, "min-h-9")}>Lưu bản nháp</button>
    </header>
    <nav aria-label="Thiết lập Trợ lý AI" className="flex shrink-0 gap-1 overflow-x-auto border-b border-outline-variant px-4 sm:px-6">{(["general", "knowledge", "templates"] as const).map(value => <button key={value} type="button" aria-current={editorTab === value ? "page" : undefined} onClick={() => setEditorTab(value)} className={cn("min-h-10 shrink-0 border-b-2 border-transparent px-3 text-sm text-on-surface-variant hover:text-on-surface", editorTab === value && "border-primary font-medium text-primary", focusClass)}>{value === "general" ? "Thiết lập chung" : value === "knowledge" ? "Tri thức" : "Biểu mẫu"}</button>)}</nav>
    <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-3 lg:overflow-hidden">
      <div className="min-w-0 space-y-5 p-4 sm:p-6 lg:col-span-2 lg:overflow-y-auto">
        {error && <p id={formErrorId} role="alert" className="text-pretty rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
        {savedNotice && <p role="status" className="text-pretty rounded-lg bg-primary/10 p-3 text-sm text-primary">Đã lưu bản nháp trên thiết bị.</p>}
        {editorTab === "general" && <div className="space-y-5">
          <fieldset><legend className="text-sm font-medium">Ảnh đại diện</legend><div className="mt-2 flex flex-wrap gap-2">{[0, 1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-label={`Chọn ảnh đại diện ${value + 1}`} aria-pressed={draft.avatar === value} onClick={() => updateDraft({ avatar: value })} className={cn("rounded-full border border-outline-variant p-1", draft.avatar === value && "border-primary", focusClass)}><AgentAvatar avatar={value} className="size-10" /></button>)}</div></fieldset>
          <label className="block text-sm font-medium">Tên trợ lý <span className="text-primary">*</span><input required aria-invalid={Boolean(error && !draft.name.trim())} aria-describedby={error && !draft.name.trim() ? formErrorId : undefined} maxLength={50} value={draft.name} onChange={event => updateDraft({ name: event.target.value })} placeholder="Ví dụ: Trợ lý phân tích báo cáo" className={cn(inputClass, "mt-1.5")} /><span className="mt-1 block text-xs font-normal tabular-nums text-on-surface-variant">{draft.name.length}/50</span></label>
          <label className="block text-sm font-medium">Mô tả trợ lý<textarea maxLength={150} rows={3} value={draft.description} onChange={event => updateDraft({ description: event.target.value })} placeholder="Trợ lý này giúp bạn làm gì?" className={cn(inputClass, "mt-1.5 resize-y")} /><span className="mt-1 block text-xs font-normal tabular-nums text-on-surface-variant">{draft.description.length}/150</span></label>
          <label className="block text-sm font-medium">Chỉ dẫn <span className="text-primary">*</span><textarea required aria-invalid={Boolean(error && !draft.instructions.trim())} aria-describedby={error && !draft.instructions.trim() ? formErrorId : undefined} maxLength={10000} rows={8} value={draft.instructions} onChange={event => updateDraft({ instructions: event.target.value })} placeholder="Vai trò, cách trả lời, những điều trợ lý cần hỏi trước khi hỗ trợ…" className={cn(inputClass, "mt-1.5 resize-y")} /><span className="mt-1 block text-xs font-normal tabular-nums text-on-surface-variant">{draft.instructions.length}/10.000</span></label>
          <div><p className="text-sm font-medium">Mô hình mặc định</p><div className="mt-1.5 flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 text-sm"><AssistantAgentIcon className="size-5" />iGenAI</div></div>
          <details className="border-t border-outline-variant pt-4"><summary className="cursor-pointer text-sm font-medium">Thiết lập nâng cao</summary><div className="mt-4 space-y-4"><label className="block text-sm font-medium">Những điều không được làm<input value={draft.avoid} onChange={event => updateDraft({ avoid: event.target.value })} placeholder="Ví dụ: Không tự suy đoán dữ liệu chưa được cung cấp" className={cn(inputClass, "mt-1.5")} /></label><fieldset><legend className="text-sm font-medium">Phong cách</legend><div className="mt-2 flex flex-wrap gap-2">{tones.map(value => <label key={value} className={cn("cursor-pointer rounded-full border border-outline-variant px-3 py-1.5 text-xs focus-within:border-primary", draft.tone === value && "border-primary bg-primary/10 text-primary")}><input type="radio" name="agent-tone" checked={draft.tone === value} onChange={() => updateDraft({ tone: value })} className="sr-only" />{value}</label>)}</div></fieldset><fieldset><legend className="text-sm font-medium">Câu hỏi mở đầu</legend><div className="mt-2 space-y-2">{draft.openingQuestions.map((question, index) => <label key={index} className="block"><span className="sr-only">Câu hỏi mở đầu {index + 1}</span><input value={question} maxLength={160} onChange={event => updateDraft({ openingQuestions: draft.openingQuestions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} placeholder={`Câu hỏi gợi ý ${index + 1}`} className={inputClass} /></label>)}</div></fieldset></div></details>
        </div>}
        {editorTab === "knowledge" && <ResourceEditor key={`${draft.id}:knowledge`} kind="knowledge" draft={draft} updateDraft={updateDraft} />}
        {editorTab === "templates" && <ResourceEditor key={`${draft.id}:templates`} kind="templates" draft={draft} updateDraft={updateDraft} />}
      </div>
      <aside aria-label="Xem trước Trợ lý AI" className="flex min-h-64 flex-col border-t border-outline-variant p-4 sm:p-6 lg:border-l lg:border-t-0 lg:overflow-y-auto"><div className="flex items-center justify-between gap-2"><h4 className="text-balance text-sm font-semibold">Xem trước</h4><span className="text-xs text-on-surface-variant">iGenAI</span></div><div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center"><AgentAvatar avatar={draft.avatar} className="size-14" /><p className="text-balance text-sm font-semibold">{draft.name || "Trợ lý mới"}</p><p className="text-xs text-on-surface-variant">Tạo bởi bạn</p>{draft.description && <p className="max-w-xs text-pretty text-sm text-on-surface-variant">{draft.description}</p>}{draft.openingQuestions.filter(Boolean).map((question, index) => <p key={index} className="w-full max-w-xs rounded-xl border border-outline-variant p-3 text-left text-xs text-on-surface">{question}</p>)}<p className="mt-3 max-w-xs text-pretty text-xs text-on-surface-variant">Bản xem trước giao diện. Trò chuyện sẽ khả dụng khi Trợ lý AI được kết nối.</p></div></aside>
    </div>
  </section>;

  return <section aria-label="Trợ lý AI" className="min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest px-4 py-6 text-on-surface sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl"><div className="flex justify-end"><button type="button" onClick={() => start()} className={primaryCreateButtonClass}><Plus className="size-4" aria-hidden="true" />Tạo Trợ lý AI</button></div>
      <header className="mx-auto max-w-2xl text-center"><h3 data-typography="page-title" className="text-balance text-lg font-semibold">Trợ lý AI</h3><p className="mt-1 text-pretty text-sm text-on-surface-variant">Tạo và quản lý trợ lý iGenAI theo nhu cầu của bạn.</p></header>
      <label className="relative mx-auto mt-6 block max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm Trợ lý AI</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trợ lý…" className={cn(inputClass, "pl-10")} /></label>
      <nav aria-label="Lọc Trợ lý AI" className="mx-auto mt-5 flex max-w-xl gap-1 border-b border-outline-variant">{(["all", "mine", "shared"] as const).map(value => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)} className={cn("min-h-10 border-b-2 border-transparent px-3 text-sm text-on-surface-variant hover:text-on-surface", tab === value && "border-primary font-medium text-primary", focusClass)}>{value === "all" ? "Tất cả" : value === "mine" ? "Trợ lý của tôi" : "Được chia sẻ với tôi"}</button>)}</nav>
      <div className="mt-6 space-y-8">
        {tab !== "shared" && visibleSaved.length > 0 && <section aria-labelledby="my-agents-heading"><h4 id="my-agents-heading" className="mb-3 text-balance text-sm font-semibold">Trợ lý của tôi</h4><div className="grid gap-3 md:grid-cols-2">{visibleSaved.map(item => <article key={item.id} className="flex min-h-40 flex-col rounded-xl border border-outline-variant p-4"><div className="flex items-start gap-3"><AgentAvatar avatar={item.avatar} /><div className="min-w-0 flex-1"><h5 className="truncate text-sm font-semibold">{item.name}</h5><p className="text-xs text-on-surface-variant">Bản nháp trên thiết bị · iGenAI</p></div></div><p className="mt-3 line-clamp-2 flex-1 text-pretty text-sm text-on-surface-variant">{item.description || "Chưa có mô tả."}</p><button type="button" onClick={() => { setDraft(item); setEditorTab("general"); setError(""); setSavedNotice(false); }} className={cn("mt-4 self-start rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}>Chỉnh sửa bản nháp</button></article>)}</div></section>}
        {tab === "all" && visibleSamples.length > 0 && <section aria-labelledby="sample-agents-heading"><h4 id="sample-agents-heading" className="mb-1 text-balance text-sm font-semibold">Mẫu iGenAI</h4><p className="mb-3 text-pretty text-xs text-on-surface-variant">Chọn một mẫu để bắt đầu bản nháp của riêng bạn.</p><div className="grid gap-3 md:grid-cols-2">{visibleSamples.map((item, index) => <article key={item.name} className="flex min-h-40 flex-col rounded-xl border border-outline-variant p-4"><div className="flex items-start gap-3"><AgentAvatar avatar={index} /><div className="min-w-0 flex-1"><h5 className="truncate text-sm font-semibold">{item.name}</h5><p className="text-xs text-on-surface-variant">Mẫu giao diện · iGenAI</p></div></div><p className="mt-3 line-clamp-2 flex-1 text-pretty text-sm text-on-surface-variant">{item.description}</p><button type="button" onClick={() => start(item)} className={cn("mt-4 self-start rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}>Tạo từ mẫu</button></article>)}</div></section>}
        {(tab === "shared" || (tab === "mine" && !visibleSaved.length) || (tab === "all" && !visibleSaved.length && !visibleSamples.length)) && <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center"><HrEmptyIllustration kind="search" /><p className="mt-1 text-pretty text-sm text-on-surface-variant">{tab === "shared" ? "Chưa có trợ lý nào được chia sẻ với bạn." : query ? "Không tìm thấy trợ lý phù hợp." : "Bạn chưa có bản nháp Trợ lý AI nào."}</p>{tab !== "shared" && <button type="button" onClick={() => { setQuery(""); start(); }} className={cn("mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary", focusClass)}>Tạo Trợ lý AI</button>}</div>}
      </div>
    </div>
  </section>;
}
