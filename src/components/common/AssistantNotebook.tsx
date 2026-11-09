import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, BarChart3, FilePlus2, FileText, Link2, Plus, Send, Trash2 } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { HrEmptyIllustration } from "../hr/HrEmptyIllustration";

type NotebookKind = "analysis" | "research";
type NotebookSource =
  | { id: string; type: "file"; name: string; file: File }
  | { id: string; type: "link"; name: string; url: string }
  | { id: string; type: "text"; name: string; content: string };

const notebookTypes = [
  { id: "analysis", title: "Phân tích dữ liệu", description: "Tập hợp các tệp dữ liệu để chuẩn bị tính toán, thống kê và phân tích xu hướng.", Icon: BarChart3, artwork: "/notebook-analysis.webp" },
  { id: "research", title: "Nghiên cứu tài liệu", description: "Tập hợp tài liệu và đường dẫn để chuẩn bị đọc hiểu, trích xuất và nghiên cứu.", Icon: FileText, artwork: "/notebook-research.webp" },
] as const;

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";
const inputClass = "min-h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none";

export function AssistantNotebook() {
  const [kind, setKind] = useState<NotebookKind | null>(null);
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [sourceType, setSourceType] = useState<"file" | "link" | "text">("file");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = notebookTypes.find(item => item.id === kind);

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length) {
      setSources(current => [...current, ...files.map(file => ({ id: crypto.randomUUID(), type: "file" as const, name: file.name, file }))]);
      setNotice("");
    }
    event.currentTarget.value = "";
  };

  const addSource = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sourceType === "link") {
      const value = url.trim();
      if (!value) return;
      setSources(current => [...current, { id: crypto.randomUUID(), type: "link", name: value, url: value }]);
      setUrl("");
    }
    if (sourceType === "text") {
      const value = text.trim();
      if (!value) return;
      setSources(current => [...current, { id: crypto.randomUUID(), type: "text", name: value.split("\n")[0].slice(0, 80) || "Ghi chú", content: value }]);
      setText("");
    }
    setNotice("");
  };

  const prepareQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) return;
    setNotice("Câu hỏi đã được giữ trong bản nháp. Tính năng trả lời sẽ hoạt động khi Notebook được kết nối dịch vụ AI.");
  };

  return <main className="min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest px-4 py-6 text-on-surface sm:px-8 lg:px-12">
    {selected ? <div className="mx-auto w-full max-w-6xl">
      <button type="button" onClick={() => { setKind(null); setNotice(""); }} className={cn("mb-6 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />Chọn loại Notebook khác</button>
      <header className="mb-7 flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><selected.Icon className="size-6" aria-hidden="true" /></span>
        <div><p className="text-sm font-medium text-primary">Notebook · Bản nháp</p><h1 className="mt-1 text-balance text-2xl font-semibold">{selected.title}</h1><p className="mt-2 max-w-2xl text-pretty text-sm text-on-surface-variant">{selected.description}</p></div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <section aria-labelledby={`${id}-sources-title`} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
          <div className="mb-5"><h2 id={`${id}-sources-title`} className="text-balance text-lg font-semibold">Nguồn tài liệu</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Thêm nguồn vào bản nháp để sẵn sàng phân tích sau khi kết nối dịch vụ.</p></div>
          <div role="group" aria-label="Loại nguồn" className="mb-4 flex flex-wrap gap-2">
            {([ ["file", "Tệp"], ["link", "Đường dẫn"], ["text", "Văn bản"] ] as const).map(([type, label]) => <button key={type} type="button" aria-pressed={sourceType === type} onClick={() => setSourceType(type)} className={cn("min-h-9 rounded-lg border border-outline-variant px-3 text-sm hover:bg-surface-container-low", sourceType === type && "border-primary bg-primary/10 font-medium text-primary", focusClass)}>{label}</button>)}
          </div>
          {sourceType === "file" ? <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-5 text-center">
            <FilePlus2 className="mx-auto size-8 text-primary" aria-hidden="true" /><p className="mt-2 text-pretty text-sm text-on-surface-variant">Chọn tệp để đưa vào bản nháp. Tệp chưa được tải lên.</p>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" onChange={addFiles} aria-label="Chọn tệp nguồn cho Notebook" className="sr-only" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className={cn("mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}><Plus className="size-4" aria-hidden="true" />Chọn tệp</button>
          </div> : <form onSubmit={addSource} className="space-y-3">
            {sourceType === "link" ? <div><label htmlFor={`${id}-url`} className="mb-2 block text-sm font-medium">Đường dẫn tài liệu</label><input id={`${id}-url`} type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." className={inputClass} /></div> : <div><label htmlFor={`${id}-text`} className="mb-2 block text-sm font-medium">Nội dung văn bản</label><textarea id={`${id}-text`} required rows={5} value={text} onChange={event => setText(event.target.value)} placeholder="Dán hoặc nhập nội dung tại đây" className={cn(inputClass, "resize-y")} /></div>}
            <button type="submit" className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}><Plus className="size-4" aria-hidden="true" />Thêm vào bản nháp</button>
          </form>}
          <div className="mt-7 border-t border-outline-variant pt-5"><h3 className="text-balance text-sm font-semibold">Nguồn đã chọn ({sources.length})</h3>
            {sources.length ? <ul className="mt-3 divide-y divide-outline-variant">{sources.map(source => <li key={source.id} className="flex min-w-0 items-center gap-3 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant">{source.type === "link" ? <Link2 className="size-4" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}</span><span className="min-w-0 flex-1 truncate text-sm" title={source.name}>{source.name}</span><button type="button" aria-label={`Bỏ nguồn ${source.name}`} onClick={() => setSources(current => current.filter(item => item.id !== source.id))} className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface", focusClass)}><Trash2 className="size-4" aria-hidden="true" /></button></li>)}</ul> : <div className="flex flex-col items-center py-5 text-center"><HrEmptyIllustration kind="project" className="h-20 w-32" /><p className="mt-2 text-pretty text-sm text-on-surface-variant">Chưa có nguồn nào trong bản nháp.</p></div>}
          </div>
        </section>
        <section aria-labelledby={`${id}-question-title`} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
          <h2 id={`${id}-question-title`} className="text-balance text-lg font-semibold">Hỏi đáp với nguồn</h2><p className="mt-1 text-pretty text-sm text-on-surface-variant">Soạn trước câu hỏi của bạn. Phần trả lời sẽ có khi kết nối dịch vụ AI.</p>
          <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-lg bg-surface-container-low px-4 text-center"><HrEmptyIllustration kind="search" className="h-20 w-32" /><p className="mt-2 text-pretty text-sm text-on-surface-variant">Chưa có kết quả phân tích.</p></div>
          <form onSubmit={prepareQuestion} className="mt-5"><label htmlFor={`${id}-question`} className="mb-2 block text-sm font-medium">Câu hỏi</label><textarea id={`${id}-question`} rows={4} value={question} onChange={event => { setQuestion(event.target.value); setNotice(""); }} placeholder="Bạn muốn tìm hiểu điều gì từ các nguồn?" className={cn(inputClass, "resize-y")} /><button type="submit" disabled={!question.trim()} className={cn("mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Send className="size-4" aria-hidden="true" />Chuẩn bị câu hỏi</button>{notice && <p role="status" className="mt-3 text-pretty text-sm text-on-surface-variant">{notice}</p>}</form>
        </section>
      </div>
      <p className="mt-5 text-pretty text-xs text-on-surface-variant">Bản nháp chỉ tồn tại trong phiên mở trang này; chưa lưu hoặc gửi dữ liệu lên máy chủ.</p>
    </div> : <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center justify-center py-10 text-center">
      <h1 className="max-w-3xl text-balance text-3xl font-semibold leading-tight sm:text-4xl">Biến tài liệu và dữ liệu thành <span className="bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)] bg-clip-text text-transparent">hiểu biết hữu ích</span></h1>
      <div className="mt-9 grid w-full max-w-2xl gap-4 sm:grid-cols-2">{notebookTypes.map(item => <button key={item.id} type="button" onClick={() => { setKind(item.id); setSources([]); setQuestion(""); setNotice(""); }} className={cn("group flex min-h-64 flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center hover:border-primary hover:bg-surface-container-low", focusClass)}><img src={item.artwork} alt="" width="112" height="112" className="size-28 object-contain" /><span className="mt-4 text-lg font-semibold text-on-surface">{item.title}</span><span className="mt-3 max-w-xs text-pretty text-sm leading-6 text-on-surface-variant">{item.description}</span></button>)}</div>
    </div>}
  </main>;
}
