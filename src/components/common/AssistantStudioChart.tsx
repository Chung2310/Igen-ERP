import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronRight, LoaderCircle, Paperclip, Plus, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { AssistantStudioChartResult } from "./AssistantStudioChartResult";
import { AssistantStudioBreadcrumb } from "./AssistantStudioBreadcrumb";
import { AssistantFileTypeIcon } from "./AssistantFileTypeIcon";
import { AssistantStudioHistoryAction, AssistantStudioHistoryDrawer, AssistantStudioHistoryKindIcon } from "./AssistantStudioHistoryDrawer";
import { chartTypes, type ChartType } from "./AssistantStudioChartTypes";
import { assistantService } from "../../services/assistantService";
import { defaultAssistantChartPrompt, type AssistantChartHistoryItem, type AssistantChartResult as ChartResult } from "../../shared/assistant-chart";
import "./AssistantStudio.css";

type Screen = "input" | "result";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";
const allowedExtensions = /\.(pdf|xlsx|xls|docx|csv)$/i;
const maxFileSize = 20 * 1024 * 1024;

function ChartStars({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M10.5 1.5c.35 0 .63.23.72.56l1.65 6.02 6.02 1.65a.75.75 0 0 1 0 1.44l-6.02 1.65-1.65 6.02a.75.75 0 0 1-1.44 0l-1.65-6.02-6.02-1.65a.75.75 0 0 1 0-1.44l6.02-1.65 1.65-6.02a.75.75 0 0 1 .72-.56Z" />
    <path d="M19.5 16.4c.22 0 .42.15.48.36l.58 2.14 2.14.58a.5.5 0 0 1 0 .96l-2.14.58-.58 2.14a.5.5 0 0 1-.96 0l-.58-2.14-2.14-.58a.5.5 0 0 1 .48-.36Z" />
  </svg>;
}

export function AssistantStudioChart({ onBack, historyId }: { onBack: () => void; historyId?: string | null }) {
  const [screen, setScreen] = useState<Screen>("input");
  const [chartType, setChartType] = useState<ChartType>("Tự động");
  const [prompt, setPrompt] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChartResult | null>(null);
  const [history, setHistory] = useState<AssistantChartHistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!historyId) return;
    let active = true;
    setScreen("result");
    setHistoryLoading(true);
    setError("");
    void assistantService.studioChart(historyId).then((chart) => {
      if (active) setResult(chart);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Không tải được biểu đồ đã lưu.");
    }).finally(() => {
      if (active) setHistoryLoading(false);
    });
    return () => { active = false; };
  }, [historyId]);

  function reset() {
    setScreen("input");
    setChartType("Tự động");
    setPrompt("");
    setAttachment(null);
    setError("");
    setResult(null);
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
    if (file.size === 0) {
      setAttachment(null);
      setError("Tệp đang trống. Hãy chọn tệp khác.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > maxFileSize) {
      setAttachment(null);
      setError("Tệp không được vượt quá 20 MB.");
      event.currentTarget.value = "";
      return;
    }
    setAttachment(file);
    setError("");
  }

  async function createChart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attachment) { setError("Đính kèm tệp dữ liệu trước khi tạo biểu đồ."); return; }
    setBusy(true);
    setError("");
    try {
      const chart = await assistantService.createStudioChart(attachment, prompt.trim() || defaultAssistantChartPrompt, chartType);
      setResult(chart);
      setScreen("result");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo biểu đồ từ tệp dữ liệu.");
    } finally { setBusy(false); }
  }

  async function openHistory() {
    if (historyOpen) { setHistoryOpen(false); return; }
    setError("");
    setHistoryOpen(true);
    setHistoryLoading(true);
    try { setHistory(await assistantService.studioCharts()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được lịch sử biểu đồ."); }
    finally { setHistoryLoading(false); }
  }
  async function openHistoryChart(item: AssistantChartHistoryItem) {
    setHistoryLoading(true);
    setError("");
    try {
      setResult(await assistantService.studioChart(item.id));
      setHistoryOpen(false);
      setScreen("result");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được biểu đồ đã lưu.");
    } finally { setHistoryLoading(false); }
  }

  async function applyChartEdit(request: string, type: ChartType, title: string) {
    if (!result) return;
    const updated = await assistantService.editStudioChart(result.id, {
      request: request.trim() || "Giữ nguyên nội dung, áp dụng loại biểu đồ đã chọn.",
      chartType: type,
      ...(title ? { title } : {}),
    });
    setResult(updated);
  }

  return <div className="flex min-h-full min-w-0 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
      <AssistantStudioBreadcrumb title="Tạo biểu đồ" onBack={onBack} titleAsHeading={false} />
      {screen === "result" && <div className="order-3 flex w-full items-center justify-center gap-2 text-xs text-on-surface-variant sm:order-none sm:w-auto"><span className="text-primary">1 Nhập yêu cầu</span><span aria-hidden="true">—</span><span className="font-medium text-primary">2 Tạo biểu đồ</span></div>}
      <div className="flex items-center gap-2"><button type="button" onClick={reset} disabled={busy} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Plus className="size-4" aria-hidden="true" />Tạo mới</button><AssistantStudioHistoryAction open={historyOpen} onClick={() => void openHistory()} /></div>
    </header>

    {screen === "result" && historyLoading && !result ? <p role="status" className="flex flex-1 items-center justify-center gap-2 text-sm text-on-surface-variant"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang mở biểu đồ đã lưu…</p> : screen === "result" && result ? <AssistantStudioChartResult chart={result} onEdit={applyChartEdit} /> : <form onSubmit={createChart} aria-busy={busy} className="flex min-h-[calc(100dvh-9rem)] flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-8 sm:pt-10"><div className="text-center"><div className="flex items-center justify-center gap-2 whitespace-nowrap"><ChartStars className="hidden size-6 shrink-0 text-primary sm:block" /><h1 data-typography="page-title" className="bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)] bg-clip-text text-xl font-bold leading-tight whitespace-nowrap text-transparent sm:text-[37px] sm:leading-[1.2]">Tạo biểu đồ trực quan với AI</h1><ChartStars className="hidden size-4 shrink-0 text-primary sm:block" /></div><p className="mt-2 text-pretty text-sm text-on-surface-variant">Đính kèm tệp, mô tả dữ liệu cần vẽ và chọn kiểu biểu đồ</p></div>
        <div className="assistant-slide-composer mt-5 p-3">
          <label htmlFor="studio-chart-prompt" className="sr-only">Yêu cầu tạo biểu đồ (không bắt buộc)</label>
          <textarea id="studio-chart-prompt" maxLength={4000} rows={2} value={prompt} onChange={event => { setPrompt(event.target.value); setError(""); }} placeholder="Ví dụ: Vẽ cơ cấu khách du lịch theo mục đích chuyến đi từ bảng số liệu trong tệp đính kèm (có thể để trống để AI tự phân tích)" className="min-h-14 w-full resize-y border-0 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none" aria-describedby="studio-chart-count studio-chart-file-hint studio-chart-privacy" />
          {attachment && <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-xs"><AssistantFileTypeIcon fileName={attachment.name} className="size-6 shrink-0" /><span className="min-w-0 flex-1 truncate" title={attachment.name}>{attachment.name}</span><button type="button" disabled={busy} onClick={() => { setAttachment(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Bỏ tệp đính kèm" className={cn("shrink-0 rounded-md p-1 hover:bg-surface-container disabled:opacity-50", focusClass)}><X className="size-4" aria-hidden="true" /></button></div>}
          <div className="flex items-center justify-between gap-3 text-xs text-on-surface-variant">
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-label="Đính kèm tệp dữ liệu" aria-describedby={error && !attachment ? "studio-chart-error" : "studio-chart-file-hint"} title="Đính kèm tệp dữ liệu" className={cn("inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-container-low hover:text-primary disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><Paperclip className="size-4" aria-hidden="true" /></button>
            <span id="studio-chart-count" className="tabular-nums">{prompt.length.toLocaleString("vi-VN")} / 4.000</span>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.csv" onChange={chooseFile} className="sr-only" tabIndex={-1} aria-label="Chọn tệp dữ liệu" />
        </div>
        <p id="studio-chart-file-hint" className={cn("mt-2 text-pretty text-xs text-on-surface-variant", attachment && "sr-only")}>{attachment ? `Đã đính kèm ${attachment.name}` : "PDF, Excel, Word (.docx), CSV · tối đa 20 MB"}</p>
        <fieldset className="mt-4"><legend className="sr-only">Chọn loại biểu đồ</legend><div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6 sm:gap-x-2">{chartTypes.map((type, index) => <button key={type} type="button" aria-pressed={chartType === type} disabled={busy} onClick={() => setChartType(type)} className={cn("group flex min-w-0 flex-col items-center gap-1 rounded-lg text-center disabled:cursor-not-allowed disabled:opacity-50", focusClass)}><span aria-hidden="true" className={cn("grid size-14 place-items-center rounded-lg border bg-no-repeat shadow-xs sm:size-16", index === 0 ? "border-primary bg-[linear-gradient(90deg,#00adfc_0%,#199bff_55%,#7567ff_100%)]" : "bg-surface-container-lowest", chartType === type ? "border-primary" : "border-outline-variant group-hover:border-primary/60")} style={index === 0 ? undefined : { backgroundImage: 'url("/ai-studio-chart-types.webp")', backgroundSize: "600% 200%", backgroundPosition: String(index % 6 * 20) + "% " + String(Math.floor(index / 6) * 100) + "%" }}>{index === 0 && <ChartStars className="size-8 text-on-primary" />}</span><span className={cn("min-h-8 text-pretty text-xs leading-4", chartType === type ? "font-medium text-primary" : "text-on-surface-variant")}>{type}</span></button>)}</div></fieldset>
        {error && <p id="studio-chart-error" role="alert" className="mt-4 text-pretty text-sm text-error">{error}</p>}
        {busy && <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm text-on-surface-variant"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Đang đọc tệp, phân tích dữ liệu và dựng biểu đồ…</p>}
      </main><div className="sticky bottom-0 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 text-center"><button type="submit" disabled={busy || !attachment} aria-describedby={!attachment ? "studio-chart-file-hint" : undefined} className={cn("inline-flex min-h-10 w-full max-w-52 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>{busy ? <><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Đang tạo biểu đồ…</> : <>Tạo biểu đồ <ChartStars className="size-4 text-on-primary" aria-hidden="true" /></>}</button></div>
    </form>}

    <AssistantStudioHistoryDrawer open={historyOpen} title="Lịch sử biểu đồ" onClose={() => setHistoryOpen(false)}>
      <section aria-label="Danh sách biểu đồ đã tạo" aria-busy={historyLoading} className="py-3">
        {historyLoading && <p role="status" className="py-3 text-sm text-on-surface-variant">Đang tải lịch sử…</p>}
        {error && <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">{error}</p>}
        {!historyLoading && history.length === 0 && !error && <p className="py-3 text-pretty text-sm text-on-surface-variant">Biểu đồ bạn tạo sẽ xuất hiện ở đây.</p>}
        {!historyLoading && history.length > 0 && <ul className="divide-y divide-outline-variant">{history.map(item => <li key={item.id}><button type="button" disabled={historyLoading} onClick={() => void openHistoryChart(item)} className={cn("flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-surface-container-low disabled:opacity-50", focusClass)}><AssistantStudioHistoryKindIcon kind="chart" /><span className="min-w-0 flex-1"><span className="block line-clamp-2 text-sm font-semibold text-on-surface">{item.title}</span><time className="mt-1 block text-xs tabular-nums text-on-surface-variant" dateTime={item.createdAt}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></span><ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" /></button></li>)}</ul>}
      </section>
    </AssistantStudioHistoryDrawer>
  </div>;
}
