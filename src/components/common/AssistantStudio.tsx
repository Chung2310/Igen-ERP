import { useId, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, AudioLines, FileAudio, FileText, Image, Mic, Search, Sparkles, Video, WandSparkles, Youtube } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import "./AssistantStudio.css";
import "./AssistantRainbowBorder.css";
import { AssistantStudioImage } from "./AssistantStudioImage";
import { AssistantStudioChart } from "./AssistantStudioChart";
import { AssistantStudioInfographic } from "./AssistantStudioInfographic";
import { AssistantStudioEdit } from "./AssistantStudioEdit";
import AssistantStudioAudio, { type AudioTool } from "./AssistantStudioAudio";

type StudioCategory = "Hình ảnh" | "Video" | "Âm thanh" | "Nội dung";
type StudioTool = {
  id: string;
  title: string;
  description: string;
  category: StudioCategory;
  icon: typeof Image;
  artwork?: number;
  artworkSheet?: "content" | "audio";
  promptLabel: string;
  promptPlaceholder: string;
  comingSoon?: boolean;
};

const tools: StudioTool[] = [
  { id: "create-image", title: "Tạo hình ảnh", description: "Biến ý tưởng thành hình ảnh theo mô tả của bạn", category: "Hình ảnh", icon: Image, artwork: 0, promptLabel: "Mô tả hình ảnh", promptPlaceholder: "Mô tả chủ thể, bối cảnh và các chi tiết bạn muốn xuất hiện…" },
  { id: "edit-image", title: "Chỉnh sửa hình ảnh", description: "Mô tả phần bạn muốn thay đổi trên ảnh", category: "Hình ảnh", icon: WandSparkles, artwork: 1, promptLabel: "Yêu cầu chỉnh sửa", promptPlaceholder: "Ví dụ: Xóa nền và giữ nguyên sản phẩm ở giữa ảnh…" },
  { id: "infographic", title: "Tạo infographic", description: "Trình bày thông tin bằng hình ảnh dễ hiểu", category: "Hình ảnh", icon: FileText, artwork: 2, promptLabel: "Nội dung infographic", promptPlaceholder: "Nhập các ý chính, số liệu và đối tượng người xem…" },
  { id: "chart", title: "Tạo biểu đồ", description: "Biến dữ liệu thành biểu đồ trực quan", category: "Hình ảnh", icon: Image, artwork: 3, promptLabel: "Dữ liệu và mục tiêu", promptPlaceholder: "Mô tả dữ liệu, kiểu biểu đồ và điều bạn muốn làm nổi bật…" },
  { id: "create-video", title: "Tạo video", description: "Phác thảo cảnh quay từ một ý tưởng", category: "Video", icon: Video, artwork: 4, promptLabel: "Ý tưởng video", promptPlaceholder: "Mô tả nội dung, thời lượng và phong cách video…", comingSoon: true },
  { id: "youtube-summary", title: "Tóm tắt YouTube", description: "Lấy những ý chính từ một video", category: "Video", icon: Youtube, artwork: 0, artworkSheet: "content", promptLabel: "Đường dẫn YouTube", promptPlaceholder: "Dán đường dẫn video YouTube…", comingSoon: true },
  { id: "clone", title: "Tạo giọng cá nhân", description: "Nhân bản giọng nói từ mẫu ghi âm của bạn", category: "Âm thanh", icon: Mic, artwork: 0, artworkSheet: "audio", promptLabel: "Mẫu giọng nói", promptPlaceholder: "", comingSoon: true },
  { id: "speak", title: "Chuyển văn bản thành giọng nói", description: "Tạo audio từ nội dung văn bản", category: "Âm thanh", icon: AudioLines, artwork: 1, artworkSheet: "audio", promptLabel: "Nội dung", promptPlaceholder: "" },
  { id: "transcribe", title: "Chuyển giọng nói thành văn bản", description: "Chép lời từ tệp âm thanh", category: "Âm thanh", icon: FileAudio, artwork: 2, artworkSheet: "audio", promptLabel: "Tệp âm thanh", promptPlaceholder: "" },
  { id: "content", title: "Soạn nội dung", description: "Chuẩn bị bài viết, thông điệp và ý tưởng", category: "Nội dung", icon: Sparkles, artwork: 1, artworkSheet: "content", promptLabel: "Yêu cầu nội dung", promptPlaceholder: "Nêu chủ đề, đối tượng đọc, giọng văn và độ dài mong muốn…" },
];

const categories = ["Tất cả", "Hình ảnh", "Video", "Âm thanh", "Nội dung"] as const;
const sectionOrder: StudioCategory[] = ["Hình ảnh", "Video", "Âm thanh", "Nội dung"];
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function StudioStars() {
  const gradientId = useId().replace(/:/g, "");
  return <svg viewBox="0 0 28 28" className="ml-1 mt-0.5 size-6 shrink-0 sm:size-7" aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} x1="0" x2="1"><stop offset="0%" stopColor="#00adfc" /><stop offset="55%" stopColor="#199bff" /><stop offset="100%" stopColor="#7567ff" /></linearGradient></defs>
    <path fill={`url(#${gradientId})`} d="m12 1.5 2.2 6.7 6.7 2.2-6.7 2.2-2.2 6.7-2.2-6.7-6.7-2.2 6.7-2.2L12 1.5Zm10.5 13.3 1.1 3.1 3.1 1.1-3.1 1.1-1.1 3.1-1.1-3.1-3.1-1.1 3.1-1.1 1.1-3.1ZM5 19.3l.7 2 .7-2 2-.7-2-.7-.7-2-.7 2-2 .7 2 .7Z" />
  </svg>;
}

function ComingSoonBadge() {
  return <span className="assistant-studio-coming-soon-badge inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-semibold leading-none text-white">Sắp ra mắt</span>;
}

function ToolArtwork({ tool }: { tool: StudioTool }) {
  if (tool.artwork === undefined) {
    const Icon = tool.icon;
    return <span className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-low text-primary sm:size-24"><Icon className="size-9" aria-hidden="true" /></span>;
  }
  const isContentSheet = tool.artworkSheet === "content";
  const isAudioSheet = tool.artworkSheet === "audio";
  const column = tool.artwork % (isContentSheet ? 2 : 3);
  const row = isContentSheet || isAudioSheet ? 0 : Math.floor(tool.artwork / 3);
  return <span aria-hidden="true" className="block size-20 shrink-0 rounded-xl border border-outline-variant bg-surface-container-low sm:size-24" style={{ backgroundImage: `url("/${isAudioSheet ? "ai-studio-audio-tools.png" : isContentSheet ? "ai-studio-content-tools.webp" : "ai-studio-tools.webp"}")`, backgroundSize: isContentSheet ? "200% 100%" : isAudioSheet ? "300% 100%" : "300% 200%", backgroundPosition: `${column * (isContentSheet ? 100 : 50)}% ${row * 100}%` }} />;
}

export function AssistantStudio() {
  const [category, setCategory] = useState<(typeof categories)[number]>("Tất cả");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const selected = tools.find(tool => tool.id === selectedId);
  const filtered = useMemo(() => tools.filter(tool =>
    (category === "Tất cả" || tool.category === category)
    && `${tool.title} ${tool.description}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")),
  ), [category, query]);

  const openTool = (tool: StudioTool) => { setSelectedId(tool.id); setDraft(""); setFile(null); setNotice(""); };
  const prepareDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("Nội dung đã sẵn sàng trên màn hình. Tính năng xử lý sẽ hoạt động khi dịch vụ AI được kết nối.");
  };

  return <section aria-label="AI Studio" className={cn("min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest text-on-surface", selected?.id === "create-image" || selected?.id === "edit-image" || selected?.id === "chart" || selected?.id === "infographic" || selected?.category === "Âm thanh" ? "p-0" : "px-4 py-8 sm:px-8 lg:px-12")}>
    <div className={cn("w-full", selected?.id === "create-image" || selected?.id === "edit-image" || selected?.id === "chart" || selected?.id === "infographic" || selected?.category === "Âm thanh" ? "min-h-full" : "mx-auto max-w-6xl")}>
      {selected?.id === "create-image" ? <AssistantStudioImage onBack={() => setSelectedId(null)} /> : selected?.id === "edit-image" ? <AssistantStudioEdit onBack={() => setSelectedId(null)} /> : selected?.id === "chart" ? <AssistantStudioChart onBack={() => setSelectedId(null)} /> : selected?.id === "infographic" ? <AssistantStudioInfographic onBack={() => setSelectedId(null)} /> : selected?.category === "Âm thanh" ? <AssistantStudioAudio key={selected.id} tool={selected.id as AudioTool} onBack={() => setSelectedId(null)} /> : selected ? <>
        <button type="button" onClick={() => { setSelectedId(null); setNotice(""); }} className={cn("mb-7 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />Quay lại AI Studio</button>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
          <section aria-labelledby="studio-tool-title">
            <div className="mb-6 flex items-center gap-4"><ToolArtwork tool={selected} /><div><p className="mb-1 text-xs font-medium text-primary">{selected.category}</p><div className="flex flex-wrap items-center gap-2"><h1 id="studio-tool-title" className="text-balance text-2xl font-semibold">{selected.title}</h1>{selected.comingSoon && <ComingSoonBadge />}</div><p className="mt-1 text-pretty text-sm text-on-surface-variant">{selected.description}</p></div></div>
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
        <header className="mb-9"><h1 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl">Chào mừng đến với <span className="inline-flex items-start whitespace-nowrap align-baseline"><span className="bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)] bg-clip-text text-transparent">iGen AI Studio</span><StudioStars /></span></h1></header>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center"><label className="relative block min-w-0 sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" /><span className="sr-only">Tìm công cụ AI Studio</span><input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Tìm kiếm công cụ" className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none" /></label><div role="group" aria-label="Lọc công cụ theo loại" className="flex flex-wrap gap-1">{categories.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={cn("min-h-9 rounded-lg px-3 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface", category === item && "bg-primary/10 font-medium text-primary", focusClass)}>{item}</button>)}</div></div>
        {filtered.length === 0 ? <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center"><p className="text-sm font-medium">Không tìm thấy công cụ phù hợp.</p><button type="button" onClick={() => { setQuery(""); setCategory("Tất cả"); }} className={cn("mt-3 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}>Xem tất cả công cụ</button></div> : sectionOrder.map(section => {
          const sectionTools = filtered.filter(tool => tool.category === section);
          if (!sectionTools.length) return null;
          const sectionId = `studio-section-${sectionOrder.indexOf(section)}`;
          return <section key={section} aria-labelledby={sectionId} className="mb-10"><h2 id={sectionId} className="mb-4 text-balance text-lg font-semibold">{section}</h2><div className="grid gap-3 md:grid-cols-2">{sectionTools.map(tool => <button key={tool.id} type="button" onClick={() => openTool(tool)} className="assistant-studio-card flex min-w-0 items-center gap-4 rounded-xl p-2 text-left focus-visible:outline-none"><ToolArtwork tool={tool} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-on-surface"><span>{tool.title}</span>{tool.comingSoon && <ComingSoonBadge />}</span><span className="mt-1 block text-pretty text-xs leading-5 text-on-surface-variant">{tool.description}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">Khám phá <ArrowUpRight className="size-3.5" aria-hidden="true" /></span></span></button>)}</div></section>;
        })}
      </>}
    </div>
  </section>;
}
