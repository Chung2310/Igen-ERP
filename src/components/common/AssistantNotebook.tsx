import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, ArrowLeftRight, BarChart3, Check, ChevronDown, FilePlus2, FileText, Filter, Link2, Mic, MoreVertical, Network, Plus, Search, Send, Star, Table2, Trash2 } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { assistantAgentService, type AgentChatMessage, type AgentKnowledge } from "../../services/assistantAgentService";
import { AssistantFileTypeIcon } from "./AssistantFileTypeIcon";
import { ErpModal } from "./ErpModal";
import "./AssistantNotebook.css";
import { formatAssistantTemporalValue } from "../../shared/assistant-date";
import type { SpeechRecognitionConstructor, SpeechRecognitionInstance } from "./assistant-two-way-voice";

type Kind = "analysis" | "research";
type Source = { id: string; addedAt: number; name: string; kind: AgentKnowledge["kind"]; content: string; selected: boolean; status: "loading" | "ready" | "error"; error?: string };
type OutputKind = "mindmap" | "infographic" | "report" | "chart";
type Visual = { id: string; kind: OutputKind; title: string; points: Array<{ heading: string; detail: string; value?: number }> };
type NotebookRecord = { id: string; kind: Kind; name: string; sources: Source[]; messages: AgentChatMessage[]; outputs: Visual[]; favorite: boolean; createdAt: number };
const kinds = [
  { id: "analysis", title: "Phân tích dữ liệu", description: "Phù hợp với các tác vụ tính toán, thống kê và phân tích xu hướng từ các tệp dữ liệu.", artwork: "/notebook-analysis.webp" },
  { id: "research", title: "Nghiên cứu tài liệu", description: "Phù hợp với các tác vụ đọc hiểu, trích xuất và nghiên cứu chuyên sâu từ các tệp tài liệu.", artwork: "/notebook-research.webp" },
] as const;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const field = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none";
const button = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 text-sm hover:border-primary " + focus;
const prompts = [
  { label: "Lọc trùng", prompt: "Kiểm tra dữ liệu trong các nguồn đã chọn và liệt kê nội dung trùng lặp.", Icon: Filter, accent: "mindmap" },
  { label: "Trích xuất", prompt: "Từ các nguồn đã chọn, hãy trích xuất những thông tin quan trọng.", Icon: Search, accent: "infographic" },
  { label: "Đối chiếu", prompt: "Đối chiếu các nguồn đã chọn và liệt kê điểm khác biệt hoặc bất thường.", Icon: ArrowLeftRight, accent: "chart" },
  { label: "Phân tích & tạo báo cáo", prompt: "Phân tích dữ liệu đã chọn và tạo báo cáo về các điểm đáng chú ý.", Icon: BarChart3, accent: "report" },
  { label: "Tạo công thức Excel", prompt: "Hãy đề xuất công thức Excel phù hợp với dữ liệu đã chọn.", Icon: Table2, accent: "spreadsheet" },
] as const;
const outputTypes = [
  { id: "mindmap", label: "Mindmap", Icon: Network },
  { id: "infographic", label: "Infographic", Icon: FileText },
  { id: "report", label: "Báo cáo", Icon: FileText },
  { id: "chart", label: "Biểu đồ", Icon: BarChart3 },
] as const;
function parseVisual(reply: string) {
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI chưa tạo được sản phẩm đầu ra.");
  const value: unknown = JSON.parse(match[0]);
  if (!value || typeof value !== "object" || !("title" in value) || !("points" in value)) throw new Error("Định dạng sản phẩm chưa hợp lệ.");
  const data = value as { title: unknown; points: unknown };
  if (typeof data.title !== "string" || !Array.isArray(data.points)) throw new Error("Định dạng sản phẩm chưa hợp lệ.");
  const points = data.points.filter((point): point is { heading: string; detail: string; value?: number } => point && typeof point.heading === "string" && typeof point.detail === "string").slice(0, 8);
  if (!points.length) throw new Error("AI chưa tạo được sản phẩm đầu ra.");
  return { title: data.title.slice(0, 120), points: points.map(point => ({ heading: point.heading.slice(0, 100), detail: point.detail.slice(0, 350), value: typeof point.value === "number" && Number.isFinite(point.value) ? point.value : undefined })) };
}
export function AssistantNotebook({ active = true, greetingName }: { active?: boolean; greetingName?: string }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<Kind | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [listMenu, setListMenu] = useState<string | null>(null);
  const [listRenameId, setListRenameId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [name, setName] = useState("Sổ dữ liệu mới");
  const [editingName, setEditingName] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [dialog, setDialog] = useState(false);
  const [sourceType, setSourceType] = useState<"file" | "link" | "text">("file");
  const [url, setUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [requested, setRequested] = useState<OutputKind[]>([]);
  const [outputs, setOutputs] = useState<Visual[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const selected = kinds.find(item => item.id === kind);
  const ready = sources.filter(source => source.selected && source.status === "ready");
  const loading = sources.some(source => source.status === "loading");
  const visibleNotebooks = notebooks.filter(item => (listFilter === "all" || item.kind === listFilter) && item.name.toLocaleLowerCase("vi").includes(searchText.toLocaleLowerCase("vi")));
  const createNotebook = (nextKind: Kind) => {
    const record: NotebookRecord = { id: crypto.randomUUID(), kind: nextKind, name: "Sổ dữ liệu mới", sources: [], messages: [], outputs: [], favorite: false, createdAt: Date.now() };
    setNotebooks(current => [record, ...current]); setActiveId(record.id); setKind(nextKind); setName(record.name);
    setSources([]); setMessages([]); setOutputs([]); setQuestion(""); setRequested([]);
  };
  const openNotebook = (record: NotebookRecord) => {
    setActiveId(record.id); setKind(record.kind); setName(record.name); setSources(record.sources);
    setMessages(record.messages); setOutputs(record.outputs); setQuestion(""); setRequested([]);
  };
  const leaveNotebook = () => {
    recognitionRef.current?.abort(); recognitionRef.current = null; setListening(false);
    if (activeId) setNotebooks(current => current.map(item => item.id === activeId ? { ...item, name: name.trim() || "Sổ dữ liệu mới", sources, messages, outputs } : item));
    setKind(null); setActiveId(null); setError("");
  };
  const toggleMic = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); return; }
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setError("Trình duyệt chưa hỗ trợ nhập bằng giọng nói."); return; }
    const recognition = new Recognition();
    recognition.lang = "vi-VN"; recognition.continuous = false; recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => { setListening(true); setError(""); };
    recognition.onresult = event => {
      const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
      if (transcript) setQuestion(current => [current.trim(), transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = event => { if (event.error !== "aborted") setError("Không nhận diện được giọng nói. Hãy thử lại."); };
    recognition.onend = () => { if (recognitionRef.current === recognition) recognitionRef.current = null; setListening(false); };
    try { recognition.start(); } catch { recognitionRef.current = null; setError("Không thể mở micro."); }
  };
  useEffect(() => { if (!active) { recognitionRef.current?.abort(); recognitionRef.current = null; setListening(false); } }, [active]);
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;
    setDialog(false); setError("");
    for (const file of files) {
      const sourceId = crypto.randomUUID();
      setSources(current => [...current, { id: sourceId, addedAt: Date.now(), name: file.name, kind: "file", content: "", selected: true, status: "loading" }]);
      try {
        const result = await assistantAgentService.extractFile(file);
        if (!result.text.trim()) throw new Error("Tệp không có nội dung để phân tích.");
        setSources(current => current.map(item => item.id === sourceId ? { ...item, content: result.text.slice(0, 10000), status: "ready" } : item));
      } catch (cause) {
        setSources(current => current.map(item => item.id === sourceId ? { ...item, status: "error", error: cause instanceof Error ? cause.message : "Không thể đọc tệp." } : item));
      }
    }
  };
  const addSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = sourceText.trim();
    if (sourceType === "text" && !content) return;
    if (sourceType === "link" && !url.trim()) return;
    const sourceId = crypto.randomUUID();
    if (sourceType === "link" && !content) {
      setSources(current => [...current, { id: sourceId, addedAt: Date.now(), name: url.trim(), kind: "link", content: "", selected: true, status: "loading" }]);
      const targetUrl = url.trim();
      setUrl(""); setDialog(false);
      try {
        const result = await assistantAgentService.extractLink(targetUrl);
        setSources(current => current.map(item => item.id === sourceId ? { ...item, name: result.title || targetUrl, content: result.text.slice(0, 10000), status: "ready" } : item));
      } catch (cause) {
        setSources(current => current.map(item => item.id === sourceId ? { ...item, status: "error", error: cause instanceof Error ? cause.message : "Không thể đọc đường dẫn." } : item));
      }
      return;
    }
    setSources(current => [...current, { id: sourceId, addedAt: Date.now(), name: sourceType === "link" ? url.trim() : content.split("\n")[0].slice(0, 60), kind: sourceType, content: content.slice(0, 10000), selected: true, status: "ready" }]);
    setUrl(""); setSourceText(""); setDialog(false);
  };
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || sending || loading || !ready.length) return;
    const history: AgentChatMessage[] = [...messages, { role: "user", content: prompt }];
    setMessages(history); setQuestion(""); setSending(true); setError("");
    const agent = {
      instructions: "Bạn là trợ lý Notebook. Phân tích tài liệu người dùng cung cấp, trả lời trực tiếp bằng tiếng Việt, nêu tên nguồn khi trích dẫn. Nếu thiếu dữ liệu, nói rõ giới hạn.",
      avoid: "Không bịa nội dung tài liệu.", tone: "Rõ ràng",
      knowledge: ready.slice(0, 20).map(source => ({ title: source.name.slice(0, 120), kind: source.kind, content: source.content })),
    };
    try {
      const result = await assistantAgentService.chat(agent, history);
      setMessages(current => [...current, { role: "assistant", content: result.reply }]);
      for (const outputKind of requested) {
        try {
          const visual = await assistantAgentService.chat({
            ...agent,
            instructions: "Từ nội dung phân tích, tạo " + (outputKind === "mindmap" ? "sơ đồ tư duy" : outputKind === "infographic" ? "infographic" : outputKind === "report" ? "báo cáo" : "biểu đồ") + " bằng tiếng Việt. Chỉ trả về JSON hợp lệ theo mẫu {\"title\":\"...\",\"points\":[{\"heading\":\"...\",\"detail\":\"...\"}]}. Có 3 đến 8 points. Với biểu đồ, mỗi point cần thêm value là số. Không thêm markdown hoặc bịa dữ liệu.",
          }, [{ role: "user", content: "Yêu cầu: " + prompt + "\nNội dung phân tích:\n" + result.reply.slice(0, 8000) }]);
          setOutputs(current => [{ id: crypto.randomUUID(), kind: outputKind, ...parseVisual(visual.reply) }, ...current]);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo sản phẩm đầu ra."); }
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể phân tích tài liệu."); }
    finally { setSending(false); }
  };
  const toggleOutput = (value: OutputKind) => setRequested(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  return <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-container-lowest p-3 text-on-surface sm:p-4">
    {!selected ? notebooks.length === 0 ? <div className="flex min-h-full flex-col items-center justify-center px-2 py-10 text-center">
      <h1 className="max-w-3xl text-balance text-2xl! font-semibold leading-tight! sm:text-3xl!">Nghiên cứu và hệ thống hóa thông tin từ <span className="text-primary">đa nguồn tài liệu</span></h1>
      <div className="mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {kinds.map(item => <button key={item.id} type="button" onClick={() => createNotebook(item.id)} className={cn("notebook-kind-card flex min-h-72 flex-col items-center justify-center rounded-2xl border p-6 text-center", "notebook-kind--" + item.id, focus)}>
          <img src={item.artwork} alt="" width="88" height="88" className="size-20 object-contain" />
          <span className="mt-5 text-lg font-semibold text-on-surface">{item.title}</span>
          <span className="mt-5 max-w-xs text-pretty text-sm leading-6 text-on-surface-variant">{item.description}</span>
        </button>)}
      </div>
    </div> : <div className="flex min-h-full flex-col px-1 py-1 sm:px-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Lọc Notebook" className="flex flex-wrap items-center gap-1">
          {([["all", "Tất cả"], ["research", "Nghiên cứu tài liệu"], ["analysis", "Phân tích dữ liệu"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={listFilter === value} onClick={() => setListFilter(value)} className={cn("min-h-10 rounded-full px-4 text-sm text-on-surface-variant hover:bg-primary/5", listFilter === value && "border border-primary bg-primary/10 text-primary", focus)}>{label}</button>)}
        </nav>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <label className="flex min-h-10 min-w-44 max-w-64 flex-1 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 focus-within:border-primary"><Search className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm kiếm sổ</span><input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Tìm kiếm" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <div className="flex min-h-10 overflow-visible rounded-lg bg-primary text-on-primary"><button type="button" onClick={() => createNotebook("analysis")} className={cn("inline-flex items-center gap-2 px-3 text-sm", focus)}><Plus className="size-4" aria-hidden="true" />Tạo sổ mới</button><details className="relative border-l border-on-primary/30"><summary aria-label="Chọn loại sổ mới" className={cn("flex h-10 w-9 cursor-pointer list-none items-center justify-center", focus)}><ChevronDown className="size-4" aria-hidden="true" /></summary><div className="absolute right-0 top-full z-20 mt-1 w-[min(34rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface shadow-md">{kinds.map(item => <button key={item.id} type="button" onClick={() => createNotebook(item.id)} className={cn("flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-surface-container-low", focus)}><img src={item.artwork} alt="" width="40" height="40" className="size-10 shrink-0 object-contain" /><span className="min-w-0"><span className="block text-sm font-medium">{item.title}</span><span className="mt-1 block text-pretty text-xs leading-5 text-on-surface-variant">{item.description}</span></span></button>)}</div></details></div>
        </div>
      </div>
      <h1 className="mt-9 text-balance text-base font-medium text-on-surface-variant">Danh sách sổ</h1>
      {visibleNotebooks.length ? <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
        {visibleNotebooks.map(record => <article key={record.id} className={cn("notebook-kind-card relative max-w-72 rounded-xl border p-4", "notebook-kind--" + record.kind)}>
          <div className="flex items-start justify-between gap-2"><span className="flex min-w-0 items-center gap-2 truncate text-xs text-on-surface-variant"><img src={record.kind === "analysis" ? "/notebook-analysis.webp" : "/notebook-research.webp"} alt="" width="20" height="20" className="size-5 shrink-0 object-contain" />{record.kind === "analysis" ? "Phân tích dữ liệu" : "Nghiên cứu tài liệu"}</span><div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={record.favorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"} aria-pressed={record.favorite} onClick={() => setNotebooks(current => current.map(item => item.id === record.id ? { ...item, favorite: !item.favorite } : item))} className={cn("rounded p-1 text-on-surface-variant hover:text-primary", record.favorite && "text-amber-600 hover:text-amber-600", focus)}><Star className="size-4" fill={record.favorite ? "currentColor" : "none"} aria-hidden="true" /></button><button type="button" aria-label={"Tùy chọn sổ " + record.name} aria-haspopup="menu" aria-expanded={listMenu === record.id} onClick={() => setListMenu(current => current === record.id ? null : record.id)} className={cn("rounded p-1 text-on-surface-variant hover:text-primary", focus)}><MoreVertical className="size-4" aria-hidden="true" /></button></div></div>
          {listRenameId === record.id ? <input autoFocus aria-label="Đổi tên sổ" value={record.name} maxLength={80} onChange={event => setNotebooks(current => current.map(item => item.id === record.id ? { ...item, name: event.target.value } : item))} onBlur={() => setListRenameId(null)} onKeyDown={event => { if (event.key === "Enter") setListRenameId(null); }} className={cn(field, "mt-3")} /> : <button type="button" aria-label={"Mở sổ " + record.name} onClick={() => openNotebook(record)} className={cn("mt-3 block min-h-14 w-full text-left text-base font-medium", focus)}>{record.name}</button>}
          <p className="mt-2 text-xs tabular-nums text-on-surface-variant">{formatAssistantTemporalValue(new Date(record.createdAt).toISOString())?.split(", ")[1]} · {record.sources.filter(source => source.status === "ready").length} nguồn</p>
          {listMenu === record.id && <div role="menu" aria-label={"Tùy chọn " + record.name} onKeyDown={event => { if (event.key === "Escape") setListMenu(null); }} className="absolute right-3 top-11 z-10 min-w-32 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-md"><button type="button" role="menuitem" onClick={() => { setListRenameId(record.id); setListMenu(null); }} className={cn("block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-primary/5", focus)}>Đổi tên</button><button type="button" role="menuitem" onClick={() => { setDeleteId(record.id); setListMenu(null); }} className={cn("block w-full rounded-md px-3 py-2 text-left text-sm text-error hover:bg-error-container", focus)}>Xóa sổ</button></div>}
        </article>)}
      </div> : <div className="mt-16 flex flex-col items-center text-center"><FileText className="size-10 text-primary" aria-hidden="true" /><p className="mt-3 text-pretty text-sm text-on-surface-variant">{searchText ? "Không tìm thấy sổ phù hợp." : "Chưa có sổ nào. Tạo sổ mới để bắt đầu."}</p></div>}
    </div> : <div className="flex min-h-full flex-col">
      <header className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm"><h1 className="sr-only">{name}</h1><button type="button" onClick={leaveNotebook} aria-label="Quay lại danh sách Notebook" className={cn("rounded-lg p-2 hover:bg-surface-container-low", focus)}><ArrowLeft className="size-4" /></button><button type="button" onClick={leaveNotebook} aria-label="Về danh sách Notebook" title="Về danh sách Notebook" className={cn("rounded-md px-1 text-on-surface-variant hover:text-primary", focus)}>Notebook / {selected.title} /</button>{editingName ? <input autoFocus aria-label="Tên Notebook" value={name} maxLength={80} onChange={event => setName(event.target.value)} onBlur={() => setEditingName(false)} onKeyDown={event => { if (event.key === "Enter") setEditingName(false); }} className={cn(field, "max-w-56")} /> : <button type="button" onClick={() => setEditingName(true)} title="Đổi tên Notebook" className={cn("max-w-56 truncate rounded-md px-1 font-medium hover:text-primary", focus)}>{name}</button>}</header>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(210px,1fr)_minmax(340px,1.85fr)_minmax(210px,1fr)]">
        <section aria-labelledby={id + "-sources"} className="flex min-h-52 min-w-0 flex-col rounded-xl border border-outline-variant p-3"><h2 id={id + "-sources"} className="text-base font-semibold">Nguồn tài liệu</h2>
          {sources.length ? <><div className="mt-4 flex items-center justify-between gap-2 text-xs text-on-surface-variant"><span>{sources.length} nguồn</span><label className="inline-flex items-center gap-2">Chọn tất cả<input type="checkbox" checked={sources.some(source => source.status === "ready") && sources.filter(source => source.status === "ready").every(source => source.selected)} disabled={!sources.some(source => source.status === "ready")} onChange={event => setSources(current => current.map(source => source.status === "ready" ? { ...source, selected: event.target.checked } : source))} className="accent-primary" /></label></div><div className="mt-2 space-y-2">{sources.map(source => <div key={source.id} className="flex items-start gap-2 rounded-lg border border-outline-variant p-2"><input type="checkbox" aria-label={"Sử dụng " + source.name} checked={source.selected} disabled={source.status !== "ready"} onChange={event => setSources(current => current.map(item => item.id === source.id ? { ...item, selected: event.target.checked } : item))} className="mt-2 accent-primary" /><span className="shrink-0">{source.kind === "link" ? <Link2 className="mt-1 size-5 text-primary" aria-hidden="true" /> : <AssistantFileTypeIcon fileName={source.name} className="size-7" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm" title={source.name}>{source.name}</p><p className={cn("text-xs text-on-surface-variant", source.status === "error" && "text-error")}>{source.status === "loading" ? "Đang đọc tệp..." : source.status === "error" ? source.error : formatAssistantTemporalValue(new Date(source.addedAt).toISOString())}</p></div><button type="button" aria-label={"Xóa " + source.name} onClick={() => setSources(current => current.filter(item => item.id !== source.id))} className={cn("rounded p-1 text-on-surface-variant hover:text-error", focus)}><Trash2 className="size-4" /></button></div>)}</div></> : <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-on-surface-variant"><AssistantFileTypeIcon fileName="tai-lieu.pdf" className="size-12" /><p>Nguồn tài liệu sẽ hiển thị tại đây</p></div>}
          <button type="button" onClick={() => setDialog(true)} className={cn(button, "mt-auto w-full border-primary text-primary")}><Plus className="size-4" />Thêm tài liệu</button>
        </section>
        <section aria-label="Hỏi đáp Notebook" aria-busy={sending} className="flex min-h-[510px] min-w-0 flex-col lg:min-h-[430px] rounded-xl border border-outline-variant p-3 sm:p-4">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-5" role="log" aria-live="polite">
            {messages.length ? messages.map((message, index) => <div key={index} className={cn("max-w-[90%] rounded-xl px-3 py-2 text-sm leading-6 whitespace-pre-wrap", message.role === "user" ? "ml-auto bg-primary/10" : "border border-outline-variant bg-surface-container-low")}>{message.content}</div>) : <div className="mx-auto flex max-w-lg flex-col items-start pt-8 sm:pt-20">
              <span className="text-3xl" aria-hidden="true">👋</span>
              <h2 className="mt-2 text-balance text-2xl font-semibold">Chào {greetingName?.trim().split(/\s+/).at(-1) || "bạn"}</h2>
              <div className="mt-8 flex flex-wrap gap-2">{prompts.map(({ label, prompt, Icon, accent }) => <button key={label} type="button" onClick={() => setQuestion(prompt)} className={cn(button, "min-h-9 bg-surface-container-lowest")}><Icon className={cn("notebook-prompt-icon size-4", "notebook-accent--" + accent)} aria-hidden="true" />{label}</button>)}</div>
            </div>}
            {sending && <p className="text-sm text-on-surface-variant" role="status">Đang phân tích...</p>}
          </div>
          {error && <p role="alert" className="mb-2 text-sm text-error">{error}</p>}
          <form onSubmit={send} className="mx-auto w-full max-w-2xl rounded-3xl border border-outline-variant bg-surface-container-lowest px-4 py-3 focus-within:border-primary">
            <label htmlFor={id + "-question"} className="sr-only">Câu hỏi cho Notebook</label>
            <textarea id={id + "-question"} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Hỏi tôi bất cứ điều gì" rows={2} className="min-h-14 w-full resize-none bg-transparent text-base text-on-surface outline-none placeholder:text-on-surface-variant/60" />
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-sm text-on-surface-variant", !ready.length && "opacity-60")}>{ready.length ? "Đang dùng " + ready.length + " nguồn" : "Thêm tài liệu để gửi câu hỏi"}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={toggleMic} aria-label={listening ? "Dừng micro" : "Nhập bằng giọng nói"} aria-pressed={listening} className={cn("flex size-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-primary/5 hover:text-primary", listening && "bg-primary/10 text-primary", focus)}><Mic className="size-4" aria-hidden="true" /></button>
                <button type="submit" disabled={!question.trim() || sending || loading || !ready.length} aria-label="Gửi câu hỏi" className={cn("flex size-10 items-center justify-center rounded-full bg-primary text-on-primary disabled:cursor-not-allowed disabled:opacity-50", focus)}><Send className="size-4" aria-hidden="true" /></button>
              </div>
            </div>
          </form>
        </section>
        <section aria-labelledby={id + "-outputs"} className="flex min-h-52 min-w-0 flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
          <h2 id={id + "-outputs"} className="text-base font-semibold">Sản phẩm đầu ra</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">{outputTypes.map(({ id: type, label, Icon }) => <button key={type} type="button" aria-pressed={requested.includes(type)} onClick={() => toggleOutput(type)} className={cn("notebook-accent flex min-h-16 flex-col justify-between rounded-lg border p-2 text-left text-sm", "notebook-accent--" + type, focus)}><Icon className="size-4" aria-hidden="true" /><span className="flex items-center gap-1">{label}{requested.includes(type) && <Check className="size-3" aria-hidden="true" />}</span></button>)}</div>
          <div className="mt-4 flex flex-1 flex-col border-t border-outline-variant pt-4">
            {outputs.length ? <div className="space-y-4">{outputs.map(output => <article key={output.id} className="rounded-xl border border-outline-variant p-3"><span className={cn("notebook-prompt-icon text-xs", "notebook-accent--" + output.kind)}>{outputTypes.find(type => type.id === output.kind)?.label}</span><h3 className="mt-2 text-balance text-sm font-semibold">{output.title}</h3><div className={cn("mt-3 gap-2", output.kind === "infographic" ? "grid grid-cols-2" : "flex flex-col")}>{output.points.map((point, index) => <div key={index} className={cn("notebook-output-point rounded-lg border p-2", "notebook-accent--" + output.kind, output.kind === "mindmap" && "ml-3 border-l-2")}><p className="notebook-prompt-icon text-xs font-semibold">{point.heading}</p>{output.kind === "chart" && typeof point.value === "number" && <div className="mt-2 h-2 rounded-full bg-surface-container-high"><div className="h-full rounded-full" style={{ backgroundColor: "var(--notebook-accent)", width: Math.max(3, Math.min(100, 100 * Math.abs(point.value) / Math.max(1, ...output.points.map(item => Math.abs(item.value ?? 0))))) + "%" }} /></div>}<p className="mt-1 text-pretty text-xs text-on-surface-variant">{point.detail}</p></div>)}</div></article>)}</div> : <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center text-sm text-on-surface-variant"><AssistantFileTypeIcon fileName="ket-qua.txt" className="size-12" tone="primary" /><p className="max-w-44 text-pretty">Sản phẩm đầu ra sẽ được tạo tại đây</p></div>}
          </div>
        </section>
      </div>
    </div>}
    <ErpModal isOpen={dialog} native title="Thêm tài liệu" maxWidth="max-w-2xl" onClose={() => setDialog(false)}><div className="rounded-xl border border-dashed border-primary/60 bg-primary/5 p-6 text-center"><FilePlus2 className="mx-auto size-10 text-primary" aria-hidden="true" /><p className="mt-3 text-sm">Nạp tài liệu bằng các cách dưới đây</p><p className="mt-1 text-xs text-on-surface-variant">PDF, DOCX, TXT, CSV, XLS, XLSX · tối đa 10 MB/tệp</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => { setSourceType("file"); fileRef.current?.click(); }} className={button}><Plus className="size-4" />Tải tệp lên</button><button type="button" onClick={() => setSourceType("link")} className={button}><Link2 className="size-4" />Nhập đường dẫn</button><button type="button" onClick={() => setSourceType("text")} className={button}><FileText className="size-4" />Nhập văn bản</button></div></div>{sourceType !== "file" && <form onSubmit={addSource} className="space-y-3">{sourceType === "link" && <><label htmlFor={id + "-url"} className="block text-sm">Đường dẫn tham khảo</label><input id={id + "-url"} type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." className={field} /><p className="text-xs text-on-surface-variant">Notebook sẽ tự đọc trang web. Bạn có thể dán nội dung bên dưới nếu muốn dùng bản riêng.</p></>}<label htmlFor={id + "-content"} className="block text-sm">Nội dung tài liệu</label><textarea id={id + "-content"} required={sourceType === "text"} rows={5} value={sourceText} onChange={event => setSourceText(event.target.value)} className={field} placeholder="Dán hoặc nhập nội dung tại đây" /><button type="submit" className={cn(button, "border-primary bg-primary text-on-primary hover:bg-primary/90")}><Check className="size-4" />Thêm nguồn</button></form>}<input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.csv,.xls,.xlsx" onChange={addFiles} aria-label="Chọn tệp nguồn cho Notebook" className="sr-only" /></ErpModal>
    <ErpModal isOpen={Boolean(deleteId)} native title="Xóa sổ" onClose={() => setDeleteId(null)}>
      <p className="text-pretty text-sm text-on-surface-variant">Sổ và nội dung trong phiên này sẽ bị xóa.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setDeleteId(null)} className={button}>Hủy</button><button type="button" onClick={() => { setNotebooks(current => current.filter(item => item.id !== deleteId)); setDeleteId(null); }} className={cn(button, "border-error bg-error text-white")}>Xóa sổ</button></div>
    </ErpModal>  </main>;
}
