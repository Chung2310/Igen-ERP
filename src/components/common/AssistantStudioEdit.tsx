import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { ArrowLeft, ArrowCounterClockwise, ClockCounterClockwise, DownloadSimple, Eraser, ImageSquare, PaintBucket, Selection, Sparkle, SpinnerGap, UploadSimple, X } from "@phosphor-icons/react";
import { cn } from "../../modules/student-management/lib/utils";
import { requestStudioImageEdit, type StudioEditMode, type StudioEditRegion } from "./assistantStudioImageApi";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const modes = [
  { id: "custom", label: "Theo mô tả", icon: Sparkle, hint: "Ví dụ: Chỉ đổi màu chiếc áo thành xanh dương; giữ nguyên khuôn mặt, tóc và bối cảnh." },
  { id: "erase", label: "Xóa vùng ảnh", icon: Eraser, hint: "Ví dụ: Xóa chiếc cốc trên bàn và lấp phần trống theo mặt bàn xung quanh." },
  { id: "remove-background", label: "Xóa nền", icon: ImageSquare, hint: "Ví dụ: Tách người khỏi nền, giữ nguyên tóc và đường viền tự nhiên." },
  { id: "change-background", label: "Đổi màu nền", icon: PaintBucket, hint: "Ví dụ: Đổi nền phía sau thành màu xanh nhạt, giữ nguyên người ở phía trước." },
  { id: "enhance", label: "Nâng cao chất lượng", icon: Sparkle, hint: "Ví dụ: Làm ảnh rõ nét hơn, giảm nhiễu, giữ nguyên mọi chi tiết và khuôn mặt." },
] as const;

type EditedResult = { url: string; source: string; name: string; prompt: string; mode: StudioEditMode; regionApplied: boolean };

function clamp(value: number) { return Math.max(0, Math.min(1, value)); }

export function AssistantStudioEdit({ onBack }: { onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const [sourceImage, setSourceImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<StudioEditMode>("custom");
  const [prompt, setPrompt] = useState("");
  const [selectingRegion, setSelectingRegion] = useState(false);
  const [region, setRegion] = useState<StudioEditRegion | null>(null);
  const [result, setResult] = useState<EditedResult | null>(null);
  const [history, setHistory] = useState<EditedResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draggingFile, setDraggingFile] = useState(false);
  const activeMode = modes.find(item => item.id === mode)!;

  async function loadFile(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_FILE_BYTES) {
      setError("Chọn ảnh JPG, PNG hoặc WebP không quá 15 MB.");
      return;
    }
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không thể đọc tệp ảnh."));
        reader.readAsDataURL(file);
      });
      setSourceImage(url);
      setFileName(file.name);
      setResult(null);
      setRegion(null);
      setError("");
      setShowHistory(false);
    } catch (readError) { setError((readError as Error).message); }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDraggingFile(false);
    void loadFile(event.dataTransfer.files?.[0]);
  }

  function position(event: PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
  }

  function onSelectionStart(event: PointerEvent<HTMLButtonElement>) {
    if (!selectingRegion) return;
    const point = position(event);
    anchorRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    setRegion({ ...point, width: 0, height: 0 });
  }

  function onSelectionMove(event: PointerEvent<HTMLButtonElement>) {
    if (!anchorRef.current) return;
    const point = position(event);
    const anchor = anchorRef.current;
    setRegion({ x: Math.min(anchor.x, point.x), y: Math.min(anchor.y, point.y), width: Math.abs(anchor.x - point.x), height: Math.abs(anchor.y - point.y) });
  }

  function onSelectionEnd(event: PointerEvent<HTMLButtonElement>) {
    if (!anchorRef.current) return;
    onSelectionMove(event);
    anchorRef.current = null;
    setSelectingRegion(false);
    setRegion(current => current && current.width >= 0.02 && current.height >= 0.02 ? current : null);
  }

  function onSelectionKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") { setRegion(null); setSelectingRegion(false); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setRegion({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
      setSelectingRegion(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!sourceImage) { setError("Tải ảnh cần chỉnh sửa lên trước."); return; }
    if (prompt.trim().length < 3) { setError("Nhập yêu cầu chỉnh sửa ít nhất 3 ký tự."); return; }
    setLoading(true);
    setError("");
    try {
      const response = await requestStudioImageEdit({ sourceImage, prompt: prompt.trim(), mode, ...(region ? { region } : {}) });
      const next = { url: response.image.url, source: sourceImage, name: fileName, prompt: prompt.trim(), mode, regionApplied: response.regionApplied };
      setResult(next);
      setHistory(items => [next, ...items].slice(0, 10));
      setShowHistory(false);
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setLoading(false); }
  }

  function useResultAsSource() {
    if (!result) return;
    setSourceImage(result.url);
    setFileName(`da-chinh-sua-${result.name}`);
    setResult(null);
    setRegion(null);
    setPrompt("");
  }

  const canSelectRegion = mode === "custom" || mode === "erase";
  return <div className="flex min-h-dvh min-w-0 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-sm"><button type="button" onClick={onBack} className={cn("inline-flex items-center gap-2 rounded-md p-1 text-on-surface-variant hover:text-primary", focusClass)}><ArrowLeft size={18} aria-hidden="true" />AI Studio</button><span className="text-on-surface-variant" aria-hidden="true">/</span><h1 className="truncate text-balance font-semibold">Chỉnh sửa hình ảnh</h1></div>
      <button type="button" onClick={() => setShowHistory(value => !value)} aria-label={`Lịch sử chỉnh sửa (${history.length})`} aria-pressed={showHistory} className={cn("inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm hover:bg-surface-container-low", focusClass)}><ClockCounterClockwise size={18} aria-hidden="true" /><span className="hidden sm:inline">Lịch sử ({history.length})</span></button>
    </header>
    <nav aria-label="Cách chỉnh sửa ảnh" className="flex gap-2 overflow-x-auto border-b border-outline-variant px-4 py-3 sm:px-6">
      {modes.map(item => { const Icon = item.icon; return <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setResult(null); setError(""); if (item.id !== "custom" && item.id !== "erase") { setRegion(null); setSelectingRegion(false); } }} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition-colors", mode === item.id ? "border-primary bg-primary font-medium text-on-primary" : "border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-low", focusClass)}><Icon size={18} aria-hidden="true" />{item.label}</button>; })}
    </nav>
    {showHistory ? <section aria-label="Ảnh đã chỉnh sửa trong phiên" className="mx-auto w-full max-w-5xl p-4 sm:p-6"><h2 className="text-balance text-lg font-semibold">Lịch sử trong phiên này</h2>{history.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{history.map((item, index) => <button key={`${index}-${item.url.slice(0, 30)}`} type="button" onClick={() => { setResult(item); setSourceImage(item.source); setFileName(item.name); setPrompt(item.prompt); setMode(item.mode); setRegion(null); setShowHistory(false); }} className={cn("overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest text-left hover:border-primary", focusClass)}><img src={item.url} alt="" className="aspect-video w-full object-contain" /><span className="block truncate p-3 text-sm">{item.prompt}</span></button>)}</div> : <p className="mt-3 text-pretty text-sm text-on-surface-variant">Ảnh đã chỉnh sửa sẽ xuất hiện ở đây sau khi bạn tạo kết quả đầu tiên.</p>}</section> : !sourceImage ? <section onDragOver={event => { event.preventDefault(); setDraggingFile(true); }} onDragLeave={() => setDraggingFile(false)} onDrop={onDrop} aria-label="Tải ảnh cần chỉnh sửa" className={cn("mx-auto my-6 flex min-h-[28rem] w-[calc(100%-2rem)] max-w-5xl flex-1 flex-col items-center justify-center rounded-2xl border border-dashed bg-surface-container-lowest px-5 py-10 text-center sm:my-10", draggingFile ? "border-outline" : "border-outline-variant")}>
      <span className="grid size-16 place-items-center rounded-2xl border border-outline-variant bg-surface-container-lowest text-on-surface-variant"><ImageSquare size={32} weight="duotone" aria-hidden="true" /></span>
      <h2 className="mt-5 text-balance text-xl font-semibold">Kéo và thả ảnh vào đây</h2><p className="mt-2 text-pretty text-sm text-on-surface-variant">hoặc chọn ảnh từ máy tính để bắt đầu chỉnh sửa</p>
      <button type="button" onClick={() => fileRef.current?.click()} className={cn("mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90", focusClass)}><UploadSimple size={18} aria-hidden="true" />Tải ảnh từ máy tính</button>
      <p className="mt-5 text-pretty text-xs text-on-surface-variant">JPG, PNG, WebP · tối đa 15 MB</p>
      {error && <p role="alert" className="mt-5 text-pretty text-sm text-error">{error}</p>}
    </section> : <form onSubmit={submit} aria-label="Chỉnh sửa hình ảnh" className="mx-auto grid w-full max-w-7xl min-w-0 flex-1 gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-6">
      <section aria-label="Xem trước ảnh" className="flex min-w-0 flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-balance text-sm font-semibold">{result ? "Ảnh đã chỉnh sửa" : fileName}</h2><p className="text-xs text-on-surface-variant">{result?.regionApplied ? "Vùng ngoài lựa chọn được giữ từ ảnh gốc" : region ? "Chỉ vùng chọn sẽ được thay đổi" : "Chỉnh sửa toàn ảnh"}</p></div><div className="flex items-center gap-2"><button type="button" onClick={() => fileRef.current?.click()} disabled={loading} className={cn("rounded-lg border border-outline-variant px-3 py-2 text-xs hover:bg-surface-container-lowest disabled:opacity-50", focusClass)}>Đổi ảnh</button>{result && <button type="button" onClick={useResultAsSource} className={cn("inline-flex items-center gap-1 rounded-lg border border-outline-variant px-3 py-2 text-xs hover:bg-surface-container-lowest", focusClass)}><ArrowCounterClockwise size={15} aria-hidden="true" />Sửa tiếp</button>}</div></div>
        <div className="relative flex min-h-72 flex-1 items-center justify-center overflow-hidden rounded-lg bg-surface-container-lowest p-2 sm:min-h-96"><div className="relative inline-block max-h-[65vh] max-w-full"><img src={result?.url || sourceImage} alt={result ? "Ảnh sau chỉnh sửa" : "Ảnh gốc cần chỉnh sửa"} className="block max-h-[65vh] max-w-full object-contain" />{!result && canSelectRegion && selectingRegion && <button type="button" onPointerDown={onSelectionStart} onPointerMove={onSelectionMove} onPointerUp={onSelectionEnd} onKeyDown={onSelectionKey} aria-label="Kéo để chọn vùng ảnh. Nhấn Enter để chọn vùng giữa ảnh, Escape để hủy." className={cn("absolute inset-0 cursor-crosshair touch-none bg-transparent", focusClass)} />}{!result && region && <div aria-hidden="true" className="pointer-events-none absolute border-2 border-outline bg-surface/20" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}</div></div>
        {result ? <div className="mt-3 flex flex-wrap gap-2"><a href={result.url} download="igen-ai-anh-da-chinh-sua.png" className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary", focusClass)}><DownloadSimple size={18} aria-hidden="true" />Tải ảnh kết quả</a><button type="button" onClick={() => setResult(null)} className={cn("min-h-10 rounded-lg border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-lowest", focusClass)}>Xem lại ảnh gốc</button></div> : canSelectRegion && <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => { setSelectingRegion(value => !value); setRegion(null); }} aria-pressed={selectingRegion} className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm", selectingRegion ? "border-primary bg-primary text-on-primary" : "border-outline-variant hover:bg-surface-container-lowest", focusClass)}><Selection size={17} aria-hidden="true" />{selectingRegion ? "Đang chọn vùng" : "Chọn vùng cần sửa"}</button>{region && <button type="button" onClick={() => setRegion(null)} className={cn("inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm text-on-surface-variant hover:bg-surface-container-lowest", focusClass)}><X size={15} aria-hidden="true" />Bỏ vùng chọn</button>}<p className="text-pretty text-xs text-on-surface-variant">Chọn vùng để giữ nguyên chính xác phần ảnh bên ngoài.</p></div>}
      </section>
      <aside className="flex min-w-0 flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><h2 className="text-balance text-base font-semibold">Yêu cầu chỉnh sửa</h2><p className="mt-1 text-pretty text-xs text-on-surface-variant">Nói rõ phần cần đổi và những chi tiết phải giữ nguyên.</p><label htmlFor="studio-edit-prompt" className="mt-5 text-sm font-medium">Mô tả thay đổi</label><textarea id="studio-edit-prompt" required minLength={3} maxLength={2000} rows={8} value={prompt} onChange={event => { setPrompt(event.target.value); setResult(null); setError(""); }} placeholder={activeMode.hint} aria-invalid={Boolean(error && prompt.trim().length < 3)} aria-describedby={error ? "studio-edit-hint studio-edit-error" : "studio-edit-hint"} disabled={loading} className="mt-2 min-h-40 w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none disabled:opacity-60" /><p id="studio-edit-hint" className="mt-2 text-pretty text-xs text-on-surface-variant">{activeMode.hint}</p><span className="mt-1 text-right text-xs tabular-nums text-on-surface-variant">{prompt.length}/2.000</span>{error && <p id="studio-edit-error" role="alert" className="mt-3 text-pretty text-sm text-error">{error}</p>}<button type="submit" disabled={loading || prompt.trim().length < 3} className={cn("mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:mt-auto", focusClass)}>{loading ? <><SpinnerGap size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang chỉnh sửa…</> : <><Sparkle size={18} aria-hidden="true" />Chỉnh sửa ảnh</>}</button>{loading && <p role="status" className="mt-3 text-pretty text-xs text-on-surface-variant">Đang xử lý ảnh. Vui lòng chờ trong giây lát…</p>}</aside>
    </form>}
    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="sr-only" tabIndex={-1} aria-label="Chọn ảnh cần chỉnh sửa" />
  </div>;
}
