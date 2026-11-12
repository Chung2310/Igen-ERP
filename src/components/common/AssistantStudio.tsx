import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, AudioLines, FileAudio, FileText, Image, Mic, Network, Presentation, Search, Video, WandSparkles, Youtube } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import "./AssistantStudio.css";
import "./AssistantRainbowBorder.css";
import { AssistantStudioImage } from "./AssistantStudioImage";
import { AssistantStudioChart } from "./AssistantStudioChart";
import { AssistantStudioInfographic } from "./AssistantStudioInfographic";
import { AssistantStudioEdit } from "./AssistantStudioEdit";
import AssistantStudioAudio, { type AudioTool } from "./AssistantStudioAudio";
import { AssistantStudioBrandMark } from "./AssistantStudioBrandMark";
import { AssistantStudioBreadcrumb } from "./AssistantStudioBreadcrumb";
import { AssistantStudioMindmap } from "./AssistantStudioMindmap";
import { AssistantStudioSlideTool } from "./AssistantStudioSlideTool";
import type { AssistantStudioCreationRecord, AssistantStudioHistoryEntry } from "../../services/assistantStudioHistory";
import type { AssistantChartHistoryItem } from "../../shared/assistant-chart";
import type { AssistantSlideHistoryItem } from "../../shared/assistant-slide";

type StudioCategory = "Hình ảnh" | "Video" | "Âm thanh" | "Nội dung";
type StudioTool = {
  id: string;
  title: string;
  description: string;
  category: StudioCategory;
  icon: typeof Image;
  artworkImage: string;
  promptLabel: string;
  promptPlaceholder: string;
  comingSoon?: boolean;
};

const tools: StudioTool[] = [
  { id: "create-image", title: "Tạo hình ảnh", description: "Biến ý tưởng thành hình ảnh theo mô tả của bạn", category: "Hình ảnh", icon: Image, artworkImage: "/ai-studio-image-create.webp", promptLabel: "Mô tả hình ảnh", promptPlaceholder: "Mô tả chủ thể, bối cảnh và các chi tiết bạn muốn xuất hiện…" },
  { id: "edit-image", title: "Chỉnh sửa hình ảnh", description: "Mô tả phần bạn muốn thay đổi trên ảnh", category: "Hình ảnh", icon: WandSparkles, artworkImage: "/ai-studio-image-edit.webp", promptLabel: "Yêu cầu chỉnh sửa", promptPlaceholder: "Ví dụ: Xóa nền và giữ nguyên sản phẩm ở giữa ảnh…" },
  { id: "infographic", title: "Tạo infographic", description: "Trình bày thông tin bằng hình ảnh dễ hiểu", category: "Hình ảnh", icon: FileText, artworkImage: "/ai-studio-infographic.webp", promptLabel: "Nội dung infographic", promptPlaceholder: "Nhập các ý chính, số liệu và đối tượng người xem…" },
  { id: "chart", title: "Tạo biểu đồ", description: "Biến dữ liệu thành biểu đồ trực quan", category: "Hình ảnh", icon: Image, artworkImage: "/ai-studio-chart.webp", promptLabel: "Dữ liệu và mục tiêu", promptPlaceholder: "Mô tả dữ liệu, kiểu biểu đồ và điều bạn muốn làm nổi bật…" },
  { id: "create-video", title: "Tạo video", description: "Phác thảo cảnh quay từ một ý tưởng", category: "Video", icon: Video, artworkImage: "/ai-studio-video.webp", promptLabel: "Ý tưởng video", promptPlaceholder: "Mô tả nội dung, thời lượng và phong cách video…", comingSoon: true },
  { id: "youtube-summary", title: "Tóm tắt YouTube", description: "Lấy những ý chính từ một video", category: "Video", icon: Youtube, artworkImage: "/ai-studio-youtube-summary.webp", promptLabel: "Đường dẫn YouTube", promptPlaceholder: "Dán đường dẫn video YouTube…", comingSoon: true },
  { id: "clone", title: "Tạo giọng cá nhân", description: "Nhân bản giọng nói từ mẫu ghi âm của bạn", category: "Âm thanh", icon: Mic, artworkImage: "/ai-studio-voice-clone.webp", promptLabel: "Mẫu giọng nói", promptPlaceholder: "", comingSoon: true },
  { id: "speak", title: "Chuyển văn bản thành giọng nói", description: "Tạo audio từ nội dung văn bản", category: "Âm thanh", icon: AudioLines, artworkImage: "/ai-studio-text-to-speech.webp", promptLabel: "Nội dung", promptPlaceholder: "" },
  { id: "transcribe", title: "Chuyển giọng nói thành văn bản", description: "Chép lời từ tệp âm thanh", category: "Âm thanh", icon: FileAudio, artworkImage: "/ai-studio-speech-to-text.webp", promptLabel: "Tệp âm thanh", promptPlaceholder: "" },
  { id: "slide", title: "Tạo slide", description: "Biến ý tưởng và tài liệu thành bộ slide thuyết trình", category: "Nội dung", icon: Presentation, artworkImage: "/ai-studio-slides.webp", promptLabel: "Chủ đề và nội dung slide", promptPlaceholder: "Nhập chủ đề, nội dung hoặc các yêu cầu cần thiết khi tạo slide…" },
  { id: "mindmap", title: "Tạo Mindmap", description: "Sắp xếp ý tưởng thành sơ đồ tư duy trực quan", category: "Nội dung", icon: Network, artworkImage: "/ai-studio-mindmap.webp", promptLabel: "Chủ đề và nội dung mindmap", promptPlaceholder: "Nhập chủ đề hoặc nội dung bạn muốn tạo thành sơ đồ tư duy…" },
];

const categories = ["Tất cả", "Hình ảnh", "Video", "Âm thanh", "Nội dung"] as const;
const sectionOrder: StudioCategory[] = ["Hình ảnh", "Video", "Âm thanh", "Nội dung"];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function ComingSoonBadge() {
  return <span className="assistant-studio-coming-soon-badge inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-semibold leading-none text-white">Sắp ra mắt</span>;
}

function ToolArtwork({ tool, className }: { tool: StudioTool; className?: string }) {
  return <span aria-hidden="true" className={cn("block min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low", className)}>
    <img src={tool.artworkImage} alt="" width={768} height={512} loading="lazy" decoding="async" className="size-full object-cover" />
  </span>;
}

export function AssistantStudio({ historyItem, onHistoryItemBack, initialToolRequest }: { historyItem?: AssistantStudioHistoryEntry | null; onHistoryItemBack?: () => void; initialToolRequest?: { toolId: string | null; requestId: number } | null }) {
  const [category, setCategory] = useState<(typeof categories)[number]>("Tất cả");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const selected = tools.find(tool => tool.id === selectedId);
  const creationHistoryItem = historyItem && (historyItem.kind === "create-image" || historyItem.kind === "infographic" || historyItem.kind === "edit-image" || historyItem.kind === "mindmap") ? historyItem.payload as AssistantStudioCreationRecord : null;
  const chartHistoryId = historyItem?.kind === "chart" ? (historyItem.payload as AssistantChartHistoryItem).id : null;
  const slideHistoryId = historyItem?.kind === "slide" ? (historyItem.payload as AssistantSlideHistoryItem).id : null;
  const audioHistoryItem = historyItem && (historyItem.kind === "speech" || historyItem.kind === "transcription") ? historyItem : null;

  useEffect(() => {
    if (!historyItem) return;
    const nextTool = historyItem.kind === "chart" ? "chart"
      : historyItem.kind === "create-image" ? "create-image"
        : historyItem.kind === "infographic" ? "infographic"
          : historyItem.kind === "edit-image" ? "edit-image"
            : historyItem.kind === "mindmap" ? "mindmap"
            : historyItem.kind === "slide" ? "slide"
              : historyItem.kind === "transcription" ? "transcribe"
              : "speak";
    setSelectedId(nextTool);
  }, [historyItem?.id]);
  useEffect(() => {
    if (!initialToolRequest) return;
    if (initialToolRequest.toolId === null) {
      setSelectedId(null);
      setDraft("");
      setFile(null);
      setNotice("");
      return;
    }
    const requestedTool = tools.find(tool => tool.id === initialToolRequest.toolId && !tool.comingSoon);
    if (!requestedTool) return;
    setSelectedId(requestedTool.id);
    setDraft("");
    setFile(null);
    setNotice("");
  }, [initialToolRequest?.requestId]);
  const filtered = useMemo(() => tools.filter(tool =>
    (category === "Tất cả" || tool.category === category)
    && `${tool.title} ${tool.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")),
  ), [category, query]);

  const backToStudioHome = () => { setSelectedId(null); onHistoryItemBack?.(); };
  const openTool = (tool: StudioTool) => { if (tool.comingSoon) return; setSelectedId(tool.id); setDraft(""); setFile(null); setNotice(""); };
  const prepareDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("Nội dung đã sẵn sàng trên màn hình. Tính năng xử lý sẽ hoạt động khi dịch vụ AI được kết nối.");
  };

  const isSplitTool = selected?.id === "create-image" || selected?.id === "edit-image" || selected?.id === "chart" || selected?.id === "infographic" || selected?.id === "slide" || selected?.id === "mindmap" || selected?.category === "Âm thanh";

  return <section aria-label="AI Studio" className={cn("min-h-0 flex-1 bg-surface-container-lowest text-on-surface", isSplitTool ? "p-0 h-full overflow-hidden flex flex-col" : "overflow-y-auto px-4 py-8 sm:px-8 lg:px-12")}>
    <div className={cn("w-full", isSplitTool ? "h-full min-h-0 flex-1 flex flex-col" : "mx-auto max-w-6xl")}>
      {selected?.id === "create-image" ? <AssistantStudioImage key={historyItem?.id ?? selected.id} historyItem={creationHistoryItem?.kind === "create-image" ? creationHistoryItem : null} onBack={backToStudioHome} /> : selected?.id === "edit-image" ? <AssistantStudioEdit key={historyItem?.id ?? selected.id} historyItem={creationHistoryItem?.kind === "edit-image" ? creationHistoryItem : null} onBack={backToStudioHome} /> : selected?.id === "chart" ? <AssistantStudioChart key={historyItem?.id ?? selected.id} historyId={chartHistoryId} onBack={backToStudioHome} /> : selected?.id === "infographic" ? <AssistantStudioInfographic key={historyItem?.id ?? selected.id} historyItem={creationHistoryItem?.kind === "infographic" ? creationHistoryItem : null} onBack={backToStudioHome} /> : selected?.id === "slide" ? <AssistantStudioSlideTool key={historyItem?.id ?? selected.id} initialDeckId={slideHistoryId} onBack={backToStudioHome} /> : selected?.id === "mindmap" ? <AssistantStudioMindmap key={historyItem?.id ?? selected.id} historyItem={creationHistoryItem?.kind === "mindmap" ? creationHistoryItem : null} onBack={backToStudioHome} /> : selected?.category === "Âm thanh" ? <AssistantStudioAudio key={historyItem?.id ?? selected.id} historyItem={audioHistoryItem} tool={selected.id as AudioTool} onBack={backToStudioHome} /> : selected ? <>
        <div className="mb-7"><AssistantStudioBreadcrumb title={selected.title} onBack={backToStudioHome} titleAsHeading={false} /></div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
          <section aria-labelledby="studio-tool-title">
            <div className="mb-6 flex items-center gap-4"><ToolArtwork tool={selected} className="w-28 aspect-[3/2] sm:w-40" /><div><p className="mb-1 text-xs font-medium text-primary">{selected.category}</p><div className="flex flex-wrap items-center gap-2"><h1 id="studio-tool-title" data-typography="page-title" className="text-balance text-lg font-semibold">{selected.title}</h1>{selected.comingSoon && <ComingSoonBadge />}</div><p className="mt-1 text-pretty text-sm text-on-surface-variant">{selected.description}</p></div></div>
            <form onSubmit={prepareDraft} className="space-y-5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 sm:p-6">
              <div><label htmlFor="studio-prompt" className="mb-2 block text-sm font-medium">{selected.promptLabel}</label><textarea id="studio-prompt" required rows={6} value={draft} onChange={event => { setDraft(event.target.value); setNotice(""); }} placeholder={selected.promptPlaceholder} className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none" /></div>
              {selected.id === "edit-image" && <div><label htmlFor="studio-file" className="mb-2 block text-sm font-medium">Ảnh cần chỉnh sửa</label><input id="studio-file" type="file" accept="image/*" onChange={event => setFile(event.currentTarget.files?.[0] ?? null)} className="block w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-container-low file:px-3 file:py-2 file:text-on-surface focus:border-primary focus:outline-none" />{file && <p className="mt-2 text-xs text-on-surface-variant">Đã chọn: {file.name}</p>}</div>}
              <div className="flex flex-wrap items-center gap-3"><button type="submit" className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}>Chuẩn bị yêu cầu<ArrowUpRight className="size-4" aria-hidden="true" /></button><span className="text-xs text-on-surface-variant">Chưa kết nối dịch vụ AI</span></div>
              {notice && <p role="status" className="text-pretty rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface">{notice}</p>}
            </form>
          </section>
          <aside className="h-fit rounded-xl border border-outline-variant bg-surface-container-low p-5"><h2 className="text-balance text-sm font-semibold">Sẵn sàng kết nối AI</h2><p className="mt-2 text-pretty text-sm leading-6 text-on-surface-variant">Giao diện đã có chỗ nhập yêu cầu và chọn ảnh tham chiếu. Khi tích hợp dịch vụ, kết quả sẽ được hiển thị tại đây.</p><div className="mt-5 flex min-h-44 items-center justify-center rounded-lg border border-dashed border-outline bg-surface-container-lowest text-center text-sm text-on-surface-variant">Kết quả sẽ xuất hiện ở đây</div></aside>
        </div>
      </> : <>
        <header className="mb-9 text-left"><h1 aria-label="Chào mừng đến với iGen AI Studio" className="mx-0 flex max-w-full items-center gap-2 text-balance whitespace-nowrap! text-[clamp(1rem,2.8vw,2.5rem)]! font-semibold leading-none!"><span>Chào mừng đến với</span><span className="bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)] bg-clip-text text-transparent">iGen AI Studio</span><AssistantStudioBrandMark className="size-8 shrink-0 sm:size-14" /></h1></header>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center"><label className="relative block min-w-0 sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm công cụ AI Studio</span><input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Tìm kiếm công cụ" className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none" /></label><div role="group" aria-label="Lọc công cụ theo loại" className="flex flex-wrap gap-1">{categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={cn("min-h-9 rounded-lg px-3 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface", category === item && "bg-primary/10 font-medium text-primary", focusClass)}>{item}</button>)}</div></div>
        {filtered.length === 0 ? <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center"><p className="text-sm font-medium">Không tìm thấy công cụ phù hợp.</p><button type="button" onClick={() => { setQuery(""); setCategory("Tất cả"); }} className={cn("mt-3 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}>Xem tất cả công cụ</button></div> : sectionOrder.map(section => {
          const sectionTools = filtered.filter(tool => tool.category === section);
          if (!sectionTools.length) return null;
          const sectionId = `studio-section-${sectionOrder.indexOf(section)}`;
          return <section key={section} aria-labelledby={sectionId} className="mb-10"><h2 id={sectionId} className="mb-4 text-balance text-lg font-semibold">{section}</h2><div className="grid gap-3 md:grid-cols-2">{sectionTools.map(tool => <button key={tool.id} type="button" disabled={tool.comingSoon} onClick={() => openTool(tool)} className="assistant-studio-card grid min-w-0 grid-cols-5 items-center gap-3 rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"><ToolArtwork tool={tool} className="col-span-2 w-full aspect-[3/2]" /><span className="col-span-3 min-w-0"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface"><span>{tool.title}</span>{tool.comingSoon && <ComingSoonBadge />}</span><span className="mt-1 block text-pretty text-xs leading-5 text-on-surface-variant">{tool.description}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">{tool.comingSoon ? "Sắp ra mắt" : <>Khám phá <ArrowUpRight className="size-3.5" aria-hidden="true" /></>}</span></span></button>)}</div></section>;
        })}
      </>}
    </div>
  </section>;
}
