import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, Clock3, FileSpreadsheet, Paperclip, Plus, WandSparkles, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { ErpModal } from "./ErpModal";
import { StyledSelect } from "./StyledSelect";
import { AssistantStudioChartResult } from "./AssistantStudioChartResult";
import { chartTypes, type ChartType } from "./AssistantStudioChartTypes";
import { normalizeChartPrompt } from "./assistantStudioChartPrompt";
import "./AssistantStudio.css";

type ChartResult = { type: ChartType; title: string; fileName: string; sourcePrompt: string; editRequest: string };
type Screen = "input" | "result" | "history";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";
const allowedExtensions = /\.(pdf|xlsx|xls|docx|csv)$/i;

function ChartStars({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M10.5 1.5c.35 0 .63.23.72.56l1.65 6.02 6.02 1.65a.75.75 0 0 1 0 1.44l-6.02 1.65-1.65 6.02a.75.75 0 0 1-1.44 0l-1.65-6.02-6.02-1.65a.75.75 0 0 1 0-1.44l6.02-1.65 1.65-6.02a.75.75 0 0 1 .72-.56Z" />
    <path d="M19.5 16.4c.22 0 .42.15.48.36l.58 2.14 2.14.58a.5.5 0 0 1 0 .96l-2.14.58-.58 2.14a.5.5 0 0 1-.96 0l-.58-2.14-2.14-.58a.5.5 0 0 1 .48-.36Z" />
  </svg>;
}

export function AssistantStudioChart({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<Screen>("input");
  const [chartType, setChartType] = useState<ChartType>("Tự động");
  const [prompt, setPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");
  const [promptStatus, setPromptStatus] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChartResult | null>(null);
  const [lastResult, setLastResult] = useState<ChartResult | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState<ChartType>("Tự động");
  const [editTitle, setEditTitle] = useState("");
  const [editRequest, setEditRequest] = useState("");
  const [originalEditRequest, setOriginalEditRequest] = useState("");
  const [editPromptStatus, setEditPromptStatus] = useState("");
  const [editError, setEditError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setScreen("input");
    setChartType("Tự động");
    setPrompt("");
    setOriginalPrompt("");
    setPromptStatus("");
    setAttachment(null);
    setError("");
    setResult(null);
    setEditOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!allowedExtensions.test(file.name)) {
      setAttachment(null);
      setError("Chọn tệp PDF, Excel, Word (.docx) hoặc CSV.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAttachment(null);
      setError("Tệp không được vượt quá 20 MB.");
      event.currentTarget.value = "";
      return;
    }
    setAttachment(file);
    setError("");
  }

  function createChart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attachment) { setError("Đính kèm tệp dữ liệu trước khi tạo biểu đồ."); return; }
    if (!prompt.trim()) { setError("Nhập yêu cầu để xác định dữ liệu hoặc mục cần vẽ."); return; }
    const nextResult = { type: chartType, title: "Cơ cấu dữ liệu theo mục đã chọn", fileName: attachment.name, sourcePrompt: prompt.trim(), editRequest: "" };
    setResult(nextResult);
    setLastResult(nextResult);
    setError("");
    setScreen("result");
  }

  function openEdit() {
    if (!result) return;
    setEditType(result.type);
    setEditTitle(result.title);
    setEditRequest("");
    setOriginalEditRequest("");
    setEditPromptStatus("");
    setEditError("");
    setEditOpen(true);
  }

  function applyEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!result) return;
    if (!editTitle.trim()) { setEditError("Nhập tiêu đề biểu đồ."); return; }
    if (!editRequest.trim() && editType === result.type && editTitle.trim() === result.title) {
      setEditError("Nhập yêu cầu chỉnh sửa hoặc thay đổi loại hay tiêu đề biểu đồ.");
      return;
    }
    const nextResult = { ...result, title: editTitle.trim(), type: editType, editRequest: editRequest.trim() };
    setResult(nextResult);
    setLastResult(nextResult);
    setEditOpen(false);
  }

  function normalizeCreatePrompt() {
    const source = prompt.trim();
    if (source.length < 3) return;
    const normalized = normalizeChartPrompt(source, "create");
    if (normalized.length > 10000) { setError("Yêu cầu quá dài để chuẩn hóa. Hãy rút gọn nội dung trước."); return; }
    setOriginalPrompt(source);
    setPrompt(normalized);
    setPromptStatus("Đã chuẩn hóa cấu trúc yêu cầu. Bạn có thể chỉnh lại trước khi tạo biểu đồ.");
    setError("");
  }

  function normalizeEditPrompt() {
    const source = editRequest.trim();
    if (source.length < 3) return;
    const normalized = normalizeChartPrompt(source, "edit");
    if (normalized.length > 10000) { setEditError("Yêu cầu quá dài để chuẩn hóa. Hãy rút gọn nội dung trước."); return; }
    setOriginalEditRequest(source);
    setEditRequest(normalized);
    setEditPromptStatus("Đã chuẩn hóa yêu cầu chỉnh sửa. Bạn có thể chỉnh lại trước khi áp dụng.");
    setEditError("");
  }

  function downloadDemoCsv() {
    const csv = "\uFEFFMục đích chính,Lượng khách (lượt),Tỷ trọng\nTham quan cảnh quan sinh thái,3200,40%\nDu lịch văn hóa tâm linh,2400,30%\nNghỉ dưỡng trải nghiệm địa phương,1200,15%\nHọc tập ngoại khóa,800,10%\nHội họp công tác kết hợp du lịch,400,5%\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "bieu-do-minh-hoa.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="flex min-h-full min-w-0 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1 text-sm"><button type="button" onClick={onBack} className={cn("inline-flex items-center gap-1 rounded-md px-1 py-1 text-on-surface-variant hover:text-primary", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />AI Studio</button><span className="text-on-surface-variant" aria-hidden="true">/</span><span className="truncate font-medium">Tạo biểu đồ</span></div>
      {screen === "result" && <div className="order-3 flex w-full items-center justify-center gap-2 text-xs text-on-surface-variant sm:order-none sm:w-auto"><span className="text-primary">1 Nhập yêu cầu</span><span aria-hidden="true">—</span><span className="font-medium text-primary">2 Tạo biểu đồ</span></div>}
      <div className="flex items-center gap-2"><button type="button" onClick={reset} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium hover:bg-surface-container-low", focusClass)}><Plus className="size-4" aria-hidden="true" />Tạo mới</button><button type="button" aria-expanded={screen === "history"} onClick={() => setScreen(screen === "history" ? (result ? "result" : "input") : "history")} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium hover:bg-surface-container-low", focusClass)}><Clock3 className="size-4" aria-hidden="true" />Lịch sử</button></div>
    </header>

    {screen === "history" ? <section aria-label="Lịch sử tạo biểu đồ" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-12 text-center"><Clock3 className="size-8 text-on-surface-variant" aria-hidden="true" /><h1 className="mt-4 text-balance text-lg font-semibold">{lastResult ? "Biểu đồ gần đây" : "Chưa có biểu đồ nào"}</h1>{lastResult ? <button type="button" onClick={() => { setResult(lastResult); setScreen("result"); }} className={cn("mt-5 w-full rounded-lg border border-outline-variant p-4 text-left text-sm hover:bg-surface-container-low", focusClass)}><span className="block font-medium">{lastResult.title}</span><span className="mt-1 block text-xs text-on-surface-variant">{lastResult.fileName} · {lastResult.type === "Tự động" ? "Tự động chọn biểu đồ" : lastResult.type}</span></button> : <p className="mt-2 text-pretty text-sm text-on-surface-variant">Biểu đồ tạo trong phiên này sẽ xuất hiện ở đây.</p>}<button type="button" onClick={reset} className={cn("mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary", focusClass)}>Tạo biểu đồ</button></section> : screen === "result" && result ? <AssistantStudioChartResult type={result.type} title={result.title} fileName={result.fileName} editRequest={result.editRequest} onEdit={openEdit} onDownload={downloadDemoCsv} /> : <form onSubmit={createChart} className="flex min-h-[calc(100dvh-9rem)] flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-8 sm:pt-10"><div className="text-center"><div className="flex items-center justify-center gap-2"><ChartStars className="size-6 text-primary" /><h1 className="text-balance text-xl font-semibold">Tạo biểu đồ</h1><ChartStars className="size-4 text-primary" /></div><p className="mt-2 text-pretty text-xs text-on-surface-variant">Đính kèm tệp, mô tả dữ liệu cần vẽ và chọn kiểu biểu đồ</p></div>
        <div className="assistant-studio-chart-prompt mt-5 rounded-xl p-3">
          <label htmlFor="studio-chart-prompt" className="sr-only">Yêu cầu tạo biểu đồ</label>
          <textarea id="studio-chart-prompt" aria-required="true" aria-invalid={Boolean(error && attachment && !prompt.trim())} maxLength={10000} rows={2} value={prompt} onChange={event => { setPrompt(event.target.value); setOriginalPrompt(""); setPromptStatus(""); setError(""); }} placeholder="Ví dụ: Vẽ cơ cấu khách du lịch theo mục đích chuyến đi từ bảng số liệu trong tệp đính kèm" className="min-h-14 w-full resize-y border-0 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none" aria-describedby={cn("studio-chart-count", promptStatus && "studio-chart-prompt-status", error && attachment && !prompt.trim() && "studio-chart-error")} />
          {attachment && <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-xs"><FileSpreadsheet className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 truncate" title={attachment.name}>{attachment.name}</span><button type="button" onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Bỏ tệp đính kèm" className={cn("shrink-0 rounded-md p-1 hover:bg-surface-container", focusClass)}><X className="size-4" aria-hidden="true" /></button></div>}
          <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Đính kèm tệp dữ liệu" aria-describedby={error && !attachment ? "studio-chart-error" : undefined} title="Đính kèm tệp dữ liệu" className={cn("inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-container-low hover:text-primary", focusClass)}><Paperclip className="size-4" aria-hidden="true" /></button>
            <div className="flex items-center gap-2"><span id="studio-chart-count" className="tabular-nums">{prompt.length.toLocaleString("vi-VN")} / 10.000</span><button type="button" onClick={normalizeCreatePrompt} disabled={prompt.trim().length < 3 || Boolean(originalPrompt && prompt === normalizeChartPrompt(originalPrompt, "create"))} aria-label="Chuẩn hóa prompt tạo biểu đồ" title="Chuẩn hóa prompt" className={cn("inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}><WandSparkles className="size-4" aria-hidden="true" /></button></div>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.csv" onChange={chooseFile} className="sr-only" tabIndex={-1} aria-label="Chọn tệp dữ liệu" />
        </div>
        {promptStatus && <p id="studio-chart-prompt-status" role="status" className="mt-2 text-pretty text-xs text-on-surface-variant">{promptStatus} Bản FE chưa gọi AI.</p>}
        {originalPrompt && <button type="button" onClick={() => { setPrompt(originalPrompt); setOriginalPrompt(""); setPromptStatus(""); }} className={cn("mt-1 self-start text-xs text-primary hover:underline", focusClass)}>Khôi phục prompt gốc</button>}
        {!attachment && <p id="studio-chart-file-hint" className="mt-2 text-pretty text-xs text-on-surface-variant">PDF, Excel, Word (.docx), CSV · tối đa 20 MB</p>}
        <fieldset className="mt-4"><legend className="sr-only">Chọn loại biểu đồ</legend><div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6 sm:gap-x-2">{chartTypes.map((type, index) => <button key={type} type="button" aria-pressed={chartType === type} onClick={() => setChartType(type)} className={cn("group flex min-w-0 flex-col items-center gap-1 rounded-lg text-center", focusClass)}><span aria-hidden="true" className={cn("grid size-14 place-items-center rounded-lg border bg-no-repeat shadow-xs sm:size-16", index === 0 ? "border-primary bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)]" : "bg-surface-container-lowest", chartType === type ? "border-primary" : "border-outline-variant group-hover:border-primary/60")} style={index === 0 ? undefined : { backgroundImage: 'url("/ai-studio-chart-types.webp")', backgroundSize: "600% 200%", backgroundPosition: `${(index % 6) * 20}% ${Math.floor(index / 6) * 100}%` }}>{index === 0 && <ChartStars className="size-8 text-on-primary" />}</span><span className={cn("min-h-8 text-pretty text-xs leading-4", chartType === type ? "font-medium text-primary" : "text-on-surface-variant")}>{type}</span></button>)}</div></fieldset>
        {error && <p id="studio-chart-error" role="alert" className="mt-4 text-pretty text-sm text-error">{error}</p>}
      </main><div className="sticky bottom-0 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 text-center"><button type="submit" className={cn("inline-flex min-h-10 w-full max-w-52 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}>Tạo biểu đồ <ChartStars className="size-4 text-on-primary" /></button></div>
    </form>}

    <ErpModal native isOpen={editOpen} title="Chỉnh sửa bằng AI" onClose={() => setEditOpen(false)} maxWidth="max-w-lg">
      <form onSubmit={applyEdit} className="space-y-4">
        <div>
          <label htmlFor="studio-chart-edit-prompt" className="mb-1 block text-sm font-medium">Yêu cầu chỉnh sửa</label>
          <div className="relative">
            <textarea id="studio-chart-edit-prompt" rows={3} maxLength={10000} value={editRequest} onChange={event => { setEditRequest(event.target.value); setOriginalEditRequest(""); setEditPromptStatus(""); setEditError(""); }} aria-describedby={editPromptStatus ? "studio-chart-edit-prompt-status" : undefined} placeholder="Ví dụ: Đổi biểu đồ sang dạng cột và làm nổi bật nhóm có tỷ trọng cao nhất" className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 pb-10 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none" />
            <button type="button" onClick={normalizeEditPrompt} disabled={editRequest.trim().length < 3 || Boolean(originalEditRequest && editRequest === normalizeChartPrompt(originalEditRequest, "edit"))} aria-label="Chuẩn hóa prompt chỉnh sửa biểu đồ" title="Chuẩn hóa prompt" className={cn("absolute bottom-3 right-2 inline-flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40", focusClass)}><WandSparkles className="size-4" aria-hidden="true" /></button>
          </div>
          {editPromptStatus && <p id="studio-chart-edit-prompt-status" role="status" className="mt-1 text-pretty text-xs text-on-surface-variant">{editPromptStatus} Bản FE chưa gọi AI.</p>}
          {originalEditRequest && <button type="button" onClick={() => { setEditRequest(originalEditRequest); setOriginalEditRequest(""); setEditPromptStatus(""); }} className={cn("mt-1 text-xs text-primary hover:underline", focusClass)}>Khôi phục yêu cầu gốc</button>}
        </div>
        <div><label htmlFor="studio-chart-edit-title" className="mb-1 block text-sm font-medium">Tiêu đề biểu đồ</label><input id="studio-chart-edit-title" value={editTitle} onChange={event => { setEditTitle(event.target.value); setEditError(""); }} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none" /></div>
        <div><span className="mb-1 block text-sm font-medium">Loại biểu đồ</span><StyledSelect appearance="erp" ariaLabel="Loại biểu đồ sau chỉnh sửa" value={editType} onChange={value => setEditType(value as ChartType)} options={chartTypes.map(type => ({ value: type, label: type }))} className="h-10 rounded-lg" /></div>
        <p className="text-pretty text-xs text-on-surface-variant">Bản xem trước chỉ cập nhật tiêu đề và loại biểu đồ. Yêu cầu bằng lời sẽ được xử lý khi AI được kết nối.</p>
        {editError && <p role="alert" className="text-sm text-error">{editError}</p>}
        <button type="submit" className={cn("min-h-10 w-full rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}>Áp dụng chỉnh sửa</button>
      </form>
    </ErpModal>
  </div>;
}
