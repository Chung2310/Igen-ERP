import { useRef, useState } from "react";
import { ChevronDown, Clock3, FileText, Lightbulb, Link2, Mic, Minus, Paperclip, Plus, Sparkles, Workflow } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { AssistantStudioBreadcrumb } from "./AssistantStudioBreadcrumb";
import { AssistantStudioBrandMark } from "./AssistantStudioBrandMark";
import { AssistantFileTypeIcon } from "./AssistantFileTypeIcon";

type ContentToolKind = "slide" | "mindmap";
type SlideStyle = "rewrite" | "preserve" | "shorten";
type MindmapSource = "text" | "document" | "link";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const slideStyles: Array<{ id: SlideStyle; title: string; description: string }> = [
  { id: "rewrite", title: "Viết lại bằng AI", description: "Biến ý tưởng sơ bộ thành nội dung hấp dẫn." },
  { id: "preserve", title: "Giữ nguyên nội dung", description: "Tạo nội dung chính xác theo văn bản của bạn." },
  { id: "shorten", title: "Rút gọn nội dung", description: "Cô đọng văn bản của bạn thành nội dung ngắn gọn." },
];

function StudioSteps({ kind }: { kind: ContentToolKind }) {
  const steps = kind === "slide" ? ["Nhập yêu cầu", "Tạo dàn ý", "Tạo slide"] : ["Nhập yêu cầu", "Tạo mindmap"];
  return <nav aria-label={`Tiến trình ${kind === "slide" ? "tạo slide" : "tạo mindmap"}`} className="order-3 flex min-w-0 justify-center xl:order-none">
    <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 sm:gap-x-3">
      {steps.map((step, index) => <li key={step} aria-current={index === 0 ? "step" : undefined} className="flex items-center gap-2">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium", index === 0 ? "border-primary bg-primary text-on-primary" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant")}>{index + 1}</span>
        <span className={cn("whitespace-nowrap text-sm", index === 0 ? "font-semibold text-primary" : "text-on-surface-variant")}>{step}</span>
        {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-outline-variant sm:w-7" />}
      </li>)}
    </ol>
  </nav>;
}

function TopAction({ children, icon: Icon }: { children: string; icon: typeof Plus }) {
  return <button type="button" className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low", focusClass)}><Icon className="size-4" aria-hidden="true" />{children}</button>;
}

function LocaleButton() {
  return <button type="button" aria-label="Ngôn ngữ: Việt Nam" className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface", focusClass)}><span aria-hidden="true">🇻🇳</span>Việt Nam<ChevronDown className="size-4 text-on-surface-variant" aria-hidden="true" /></button>;
}

export function AssistantStudioContentTool({ kind, onBack }: { kind: ContentToolKind; onBack: () => void }) {
  const isSlide = kind === "slide";
  const title = isSlide ? "Tạo slide" : "Tạo mindmap";
  const subtitle = isSlide ? "Chuyển ý tưởng của bạn thành slide ấn tượng chỉ trong vài giây" : "Biến ý tưởng thành sơ đồ tư duy rõ ràng, hấp dẫn trong vài giây";
  const [prompt, setPrompt] = useState("");
  const [slideStyle, setSlideStyle] = useState<SlideStyle>("rewrite");
  const [mindmapSource, setMindmapSource] = useState<MindmapSource>("text");
  const [pageCount, setPageCount] = useState(10);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaId = `studio-${kind}-prompt`;
  const countId = `studio-${kind}-count`;

  return <div className="flex min-h-full min-w-0 flex-col bg-surface-container-lowest text-on-surface">
    <header className="grid shrink-0 grid-cols-1 items-center gap-3 border-b border-outline-variant px-4 py-3 sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <AssistantStudioBreadcrumb title={title} onBack={onBack} titleAsHeading={false} />
      <StudioSteps kind={kind} />
      <div className="order-2 flex items-center justify-end gap-2 xl:order-none"><TopAction icon={Plus}>Tạo mới</TopAction><TopAction icon={Clock3}>Lịch sử</TopAction></div>
    </header>

    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          {!isSlide && <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Workflow className="size-5" aria-hidden="true" /></span>}
          <h1 className="text-balance text-2xl font-bold leading-tight text-on-surface sm:text-[37px] sm:leading-[1.2]">{title}</h1>
          <AssistantStudioBrandMark className="size-6 shrink-0" />
        </div>
        <p className="mt-2 text-pretty text-base text-on-surface-variant sm:text-lg">{subtitle}</p>
      </div>

      {!isSlide && <div role="group" aria-label="Nguồn tạo mindmap" className="mx-auto mt-7 inline-flex w-fit rounded-xl bg-surface-container-low p-1">
        {([{ id: "text", label: "Văn bản", icon: FileText }, { id: "document", label: "Tài liệu", icon: FileText }, { id: "link", label: "Đường dẫn", icon: Link2 }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={mindmapSource === id} onClick={() => setMindmapSource(id)} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm text-on-surface-variant", mindmapSource === id && "bg-surface-container-lowest font-medium text-primary shadow-xs", focusClass)}><Icon className="size-4" aria-hidden="true" />{label}</button>)}
      </div>}

      <div className="assistant-studio-chart-prompt mt-6 rounded-2xl p-px sm:mt-7">
        <div className="rounded-xl bg-surface-container-lowest p-3 sm:p-4">
          {isSlide || mindmapSource === "text" ? <>
            <label htmlFor={textareaId} className="sr-only">{isSlide ? "Chủ đề và yêu cầu tạo slide" : "Chủ đề và nội dung tạo mindmap"}</label>
            <textarea id={textareaId} maxLength={10000} rows={5} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={isSlide ? "Nhập chủ đề, nội dung hoặc các yêu cầu cần thiết khi tạo slide" : "Nhập chủ đề hoặc nội dung văn bản bạn muốn tạo thành sơ đồ"} aria-describedby={countId} className="min-h-36 w-full resize-y border-0 bg-transparent px-1 py-1 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none sm:min-h-40 sm:text-base" />
            {fileName && <p className="mt-2 truncate text-xs text-on-surface-variant">{fileName}</p>}
          </> : mindmapSource === "document" ? <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant p-5 text-center sm:min-h-40">
            <AssistantFileTypeIcon fileName={fileName} className="size-10 shrink-0" />
            <p className="text-sm font-medium">{fileName || "Tải tài liệu lên để tạo mindmap"}</p>
            <p className="text-xs text-on-surface-variant">PDF, Word, PowerPoint · tối đa 20 MB</p>
            <button type="button" onClick={() => fileRef.current?.click()} className={cn("mt-1 rounded-lg border border-outline-variant px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5", focusClass)}>Chọn tài liệu</button>
          </div> : <div className="flex min-h-36 items-center px-1 sm:min-h-40">
            <label htmlFor={textareaId} className="sr-only">Đường dẫn nguồn</label>
            <input id={textareaId} type="url" placeholder="Dán đường dẫn bạn muốn chuyển thành mindmap" aria-describedby={countId} value={prompt} onChange={event => setPrompt(event.target.value)} className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none" />
          </div>}

          <div className="mt-2 flex min-h-9 items-center justify-between gap-3 text-sm text-on-surface-variant">
            {isSlide ? <button type="button" aria-label="Đính kèm tệp" onClick={() => fileRef.current?.click()} className={cn("inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-container-low hover:text-primary", focusClass)}><Paperclip className="size-5" aria-hidden="true" /></button> : <div className="flex items-center gap-2"><LocaleButton /><button type="button" className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface", focusClass)}><span aria-hidden="true">☷</span>Viết bằng AI<ChevronDown className="size-4 text-on-surface-variant" aria-hidden="true" /></button></div>}
            <div className="flex items-center gap-3"><span id={countId} className="tabular-nums">{prompt.length.toLocaleString("vi-VN")} / 10.000</span><button type="button" aria-label="Nhập bằng giọng nói" className={cn("inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-container-low hover:text-primary", focusClass)}><Mic className="size-5" aria-hidden="true" /></button></div>
          </div>
          <input ref={fileRef} type="file" accept={isSlide ? ".pdf,.ppt,.pptx,.doc,.docx,.txt" : ".pdf,.doc,.docx,.ppt,.pptx,.txt"} className="sr-only" aria-label="Chọn tài liệu" onChange={event => setFileName(event.currentTarget.files?.[0]?.name ?? "")} />
        </div>
      </div>

      {isSlide ? <>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-on-surface-variant"><Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><p className="text-pretty"><span className="font-semibold text-on-surface">Mẹo:</span> Bạn có thể nhập <kbd className="rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 font-mono text-xs text-on-surface">---</kbd> để phân trang của slide.</p></div>
        <section aria-labelledby="slide-style-title" className="mt-8">
          <h2 id="slide-style-title" className="mb-4 text-balance text-center text-lg font-semibold text-on-surface sm:text-xl">Hãy chọn cách bạn muốn xử lý nội dung nhé!</h2>
          <div className="grid gap-3 sm:grid-cols-3">{slideStyles.map(style => <button key={style.id} type="button" aria-pressed={slideStyle === style.id} onClick={() => setSlideStyle(style.id)} className={cn("flex min-h-24 items-start gap-3 rounded-xl border p-4 text-left", slideStyle === style.id ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-low hover:border-primary/50", focusClass)}><span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border", slideStyle === style.id ? "border-primary" : "border-outline-variant")}><span className={cn("size-2.5 rounded-full", slideStyle === style.id ? "bg-primary" : "bg-transparent")} /></span><span><span className={cn("block text-sm font-semibold", slideStyle === style.id ? "text-primary" : "text-on-surface")}>{style.title}</span><span className="mt-1 block text-pretty text-xs leading-5 text-on-surface-variant">{style.description}</span></span></button>)}</div>
        </section>
      </> : null}
    </main>

    {isSlide ? <footer className="sticky bottom-0 z-10 border-t border-outline-variant bg-surface-container-lowest px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-2 sm:gap-4">
        <LocaleButton />
        <div className="inline-flex h-10 items-center rounded-lg border border-outline-variant bg-surface-container-lowest">
          <button type="button" aria-label="Giảm số trang" onClick={() => setPageCount(value => Math.max(1, value - 1))} className={cn("grid size-10 place-items-center rounded-l-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><Minus className="size-4" aria-hidden="true" /></button>
          <span className="min-w-28 border-x border-outline-variant px-3 text-center text-sm tabular-nums">{pageCount} trang</span>
          <button type="button" aria-label="Tăng số trang" onClick={() => setPageCount(value => Math.min(50, value + 1))} className={cn("grid size-10 place-items-center rounded-r-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}><Plus className="size-4" aria-hidden="true" /></button>
        </div>
        <button type="button" disabled={!prompt.trim()} className={cn("inline-flex min-h-11 min-w-52 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>Tạo dàn ý <Sparkles className="size-4" aria-hidden="true" /></button>
      </div>
    </footer> : <div className="pb-10 pt-2 text-center"><button type="button" disabled className="inline-flex min-h-11 min-w-72 cursor-default items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-on-primary disabled:opacity-100">Tạo mindmap <Sparkles className="size-4 text-on-primary" aria-hidden="true" /><span aria-hidden="true" className="ml-1 border-l border-on-primary/30 pl-2">3,3</span></button></div>}
  </div>;
}
