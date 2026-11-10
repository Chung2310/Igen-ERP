import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, FileText, Minus, Plus, RotateCcw, SlidersHorizontal, Upload } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { assistantService, type AssistantStudioTranscript } from "../../services/assistantService";
import { getAssistantSpeechHistoryUserId, listAssistantSpeechHistory, saveAssistantSpeechHistory, type AssistantSpeechHistoryItem } from "../../services/assistantSpeechHistory";
import AssistantSpeechVoicePicker from "./AssistantSpeechVoicePicker";
import { assistantSpeechVoiceLabel, defaultAssistantSpeechVoice, type AssistantSpeechVoice } from "../../shared/assistant-speech-voices";
import { defaultAssistantSpeechControls, type AssistantSpeechControls } from "../../shared/assistant-speech";

export type AudioTool = "clone" | "speak" | "transcribe";
type AssistantSpeechHistoryEntry = AssistantSpeechHistoryItem & { audioUrl: string };
const inputClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none";
const buttonClass = "rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";
const speechPauseLabels: { key: "pausePeriod" | "pauseComma" | "pauseSemicolon" | "pauseNewline"; label: string }[] = [
  { key: "pausePeriod", label: "Ngắt dấu chấm [.]" },
  { key: "pauseComma", label: "Ngắt dấu phẩy [,]" },
  { key: "pauseSemicolon", label: "Ngắt dấu chấm phẩy [;]" },
  { key: "pauseNewline", label: "Ngắt xuống dòng" },
];

function AudioArtwork({ panel }: { panel: 0 | 1 | 2 }) {
  return <span aria-hidden="true" className="mx-auto mb-4 block size-24 rounded-xl border border-outline-variant bg-surface" style={{ backgroundImage: 'url("/ai-studio-audio-tools.png")', backgroundSize: "300% 100%", backgroundPosition: `${panel * 50}% 0%` }} />;
}

function UploadArea({ label, hint, accept, file, onFile, panel, disabled = false }: { label: string; hint: string; accept: string; file: File | null; onFile: (file: File) => void; panel: 0 | 2; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <div className={cn("rounded-xl border border-dashed bg-surface p-6 text-center", dragging ? "border-primary" : "border-outline-variant")}
    onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); setDragging(false); const item = event.dataTransfer.files[0]; if (!disabled && item) onFile(item); }}>
    <AudioArtwork panel={panel} />
    <p className="text-pretty text-sm font-medium text-on-surface">{file ? file.name : label}</p>
    <p className="mt-1 text-pretty text-xs text-on-surface-variant">{hint}</p>
    <input ref={input} type="file" accept={accept} disabled={disabled} className="sr-only" aria-label="Chọn tệp âm thanh" onChange={(event) => { const item = event.target.files?.[0]; if (item) onFile(item); event.currentTarget.value = ""; }} />
    <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="mt-5 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">Tải lên từ máy tính</button>
  </div>;
}

export default function AssistantStudioAudio({ tool, onBack }: { tool: AudioTool; onBack: () => void }) {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<AssistantSpeechVoice>(defaultAssistantSpeechVoice);
  const [speechControls, setSpeechControls] = useState<AssistantSpeechControls>(defaultAssistantSpeechControls);
  const [speechSource, setSpeechSource] = useState<"text" | "file">("text");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState("");
  const [documentBusy, setDocumentBusy] = useState(false);
  const [draggingDocument, setDraggingDocument] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [showSpeechHistory, setShowSpeechHistory] = useState(false);
  const [speechHistory, setSpeechHistory] = useState<AssistantSpeechHistoryEntry[]>([]);
  const [speechHistoryLoading, setSpeechHistoryLoading] = useState(false);
  const [speechHistoryError, setSpeechHistoryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<AssistantStudioTranscript | null>(null);
  const [transcriptHistory, setTranscriptHistory] = useState<AssistantStudioTranscript[]>([]);
  const [showTranscriptHistory, setShowTranscriptHistory] = useState(false);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const speechHistoryUrlsRef = useRef<string[]>([]);
  const speechHistoryRequestIdRef = useRef(0);
  const activeSpeechText = speechSource === "text" ? text : documentText;
  const speechSpeedPercent = ((speechControls.speed - 0.7) / (1.2 - 0.7)) * 100;
  const pageTitle = tool === "clone" ? "Tạo giọng cá nhân" : tool === "speak" ? "Tạo audio" : "Chuyển giọng nói thành văn bản";
  function clearSpeechHistoryUrls() {
    speechHistoryUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    speechHistoryUrlsRef.current = [];
  }
  useEffect(() => () => { if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => () => {
    speechHistoryRequestIdRef.current += 1;
    speechHistoryUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    if (tool !== "transcribe") return;
    let active = true;
    assistantService.studioTranscripts().then((items) => { if (active) setTranscriptHistory(items); }).catch(() => { if (active) setError("Không tải được lịch sử bản chép lời."); });
    return () => { active = false; };
  }, [tool]);

  async function generate() {
    setError(""); setAudioUrl("");
    if (!activeSpeechText.trim()) return setError(speechSource === "file" ? "Tải lên tệp tài liệu cần chuyển thành giọng nói." : "Nhập văn bản cần chuyển đổi.");
    setBusy(true);
    try {
      const audio = await assistantService.speech(activeSpeechText.trim(), undefined, voiceId, speechControls);
      setAudioUrl(URL.createObjectURL(audio));
      try {
        await saveAssistantSpeechHistory({ userId: getAssistantSpeechHistoryUserId(), text: activeSpeechText.trim(), voiceName: assistantSpeechVoiceLabel(voiceId), audio });
      } catch {
        setError("Audio đã tạo xong nhưng không lưu được lịch sử trên trình duyệt này.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo audio."); }
    finally { setBusy(false); }
  }

  async function toggleSpeechHistory() {
    if (showSpeechHistory) {
      speechHistoryRequestIdRef.current += 1;
      setShowSpeechHistory(false);
      setSpeechHistoryLoading(false);
      setSpeechHistoryError("");
      return;
    }
    const requestId = ++speechHistoryRequestIdRef.current;
    setShowSpeechHistory(true);
    setSpeechHistoryLoading(true);
    setSpeechHistoryError("");
    setError("");
    clearSpeechHistoryUrls();
    try {
      const items = await listAssistantSpeechHistory(getAssistantSpeechHistoryUserId());
      if (requestId !== speechHistoryRequestIdRef.current) return;
      const entries = items.map((item) => {
        const itemUrl = URL.createObjectURL(item.audio);
        speechHistoryUrlsRef.current.push(itemUrl);
        return { ...item, audioUrl: itemUrl };
      });
      setSpeechHistory(entries);
    } catch (cause) {
      if (requestId !== speechHistoryRequestIdRef.current) return;
      clearSpeechHistoryUrls();
      setSpeechHistoryError(cause instanceof Error ? cause.message : "Không tải được lịch sử audio.");
      setSpeechHistory([]);
    } finally {
      if (requestId === speechHistoryRequestIdRef.current) setSpeechHistoryLoading(false);
    }
  }

  const chooseAudio = (file: File) => {
    if (!/\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name) || file.size === 0 || file.size > 50 * 1024 * 1024) {
      setTranscriptFile(null); setTranscript(null);
      return setError("Chọn tệp MP3, WAV, M4A, OGG hoặc FLAC, tối đa 50 MB.");
    }
    setError("");
    setTranscriptFile(file); setTranscript(null);
  };

  async function chooseDocument(file: File) {
    if (!/\.(pdf|docx|txt)$/i.test(file.name) || file.size === 0 || file.size > 20 * 1024 * 1024) {
      setDocumentFile(null);
      setDocumentText("");
      setError("Chọn tệp PDF, DOCX hoặc TXT có dung lượng tối đa 20 MB.");
      return;
    }
    setDocumentFile(file);
    setDocumentText("");
    setError("");
    setDocumentBusy(true);
    try {
      const extracted = await assistantService.extractSpeechDocument(file);
      setDocumentText(extracted.text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đọc tệp tài liệu.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function transcribe() {
    if (!transcriptFile) return setError("Chọn tệp âm thanh cần chuyển đổi.");
    setBusy(true); setError("");
    try {
      const result = await assistantService.transcribeStudioAudio(transcriptFile);
      setTranscript(result);
      setTranscriptHistory((items) => [result, ...items.filter((item) => item.id !== result.id)].slice(0, 30));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể chuyển giọng nói thành văn bản."); }
    finally { setBusy(false); }
  }

  function downloadTranscript(item: AssistantStudioTranscript) {
    const url = URL.createObjectURL(new Blob([item.text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${item.fileName.replace(/\.[^.]+$/, "")}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function reset() {
    setText("");
    setSpeechSource("text");
    setDocumentFile(null);
    setDocumentText("");
    setSpeechControls(defaultAssistantSpeechControls);
    setVoiceId(defaultAssistantSpeechVoice);
    setAudioUrl("");
    speechHistoryRequestIdRef.current += 1;
    setShowSpeechHistory(false);
    setSpeechHistoryLoading(false);
    setSpeechHistory([]);
    clearSpeechHistoryUrls();
    setSpeechHistoryError("");
    setError("");
    setTranscriptFile(null);
    setTranscript(null);
    setShowTranscriptHistory(false);
  }

  return <div className="flex min-h-full min-w-0 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-2.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-1 text-sm">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-on-surface-variant hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft className="size-4" aria-hidden="true" />AI Studio</button>
        <span className="text-on-surface-variant" aria-hidden="true">/</span>
        <h1 className="truncate font-semibold text-balance">{pageTitle}</h1>
        {tool === "clone" && <span className="shrink-0 rounded-full border border-outline-variant px-2 py-1 text-xs font-medium text-on-surface-variant">Sắp ra mắt</span>}
      </div>
      {(tool === "speak" || tool === "transcribe") && <div className="flex items-center gap-2">
        <button type="button" onClick={reset} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" aria-hidden="true" />Tạo mới</button>
        {tool === "speak" && <button type="button" onClick={() => void toggleSpeechHistory()} aria-expanded={showSpeechHistory} aria-controls={showSpeechHistory ? "studio-speech-history" : undefined} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Clock3 className="size-4" aria-hidden="true" />Lịch sử</button>}
        {tool === "transcribe" && <button type="button" onClick={() => setShowTranscriptHistory((value) => !value)} aria-expanded={showTranscriptHistory} aria-controls={showTranscriptHistory ? "studio-transcript-history" : undefined} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Clock3 className="size-4" aria-hidden="true" />Lịch sử</button>}
      </div>}
    </header>
    <main className="mx-auto w-full max-w-screen-2xl flex-1 space-y-4 p-3 text-on-surface sm:p-4">

    {tool === "speak" && showSpeechHistory && <section id="studio-speech-history" aria-labelledby="speech-history-title" aria-busy={speechHistoryLoading} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="speech-history-title" className="text-lg font-semibold text-balance">Lịch sử audio</h2><p className="mt-1 text-sm text-on-surface-variant">Lịch sử chỉ lưu trên trình duyệt và thiết bị này.</p></div></div>
      {speechHistoryLoading && <p role="status" className="rounded-lg border border-outline-variant bg-surface p-4 text-pretty text-sm text-on-surface-variant">Đang tải lịch sử…</p>}
      {speechHistoryError && <p role="alert" className="rounded-lg border border-outline bg-surface p-4 text-sm text-on-surface">{speechHistoryError}</p>}
      {!speechHistoryLoading && !speechHistoryError && speechHistory.length === 0 && <div className="rounded-xl border border-outline-variant bg-surface p-8 text-center"><p className="text-pretty text-sm text-on-surface-variant">Bạn chưa tạo audio nào trên trình duyệt này.</p><button type="button" onClick={reset} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Plus className="size-4" aria-hidden="true" />Tạo audio mới</button></div>}
      {!speechHistoryLoading && speechHistory.length > 0 && <ul className="grid gap-3 xl:grid-cols-2">{speechHistory.map((item) => <li key={item.id} className="min-w-0 space-y-3 rounded-xl border border-outline-variant bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-on-surface">Giọng {item.voiceName}</p><time className="text-xs tabular-nums text-on-surface-variant" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></div><p className="line-clamp-2 whitespace-pre-wrap text-pretty text-sm text-on-surface-variant">{item.text}</p><audio controls preload="none" src={item.audioUrl} className="w-full" aria-label={`Phát audio giọng ${item.voiceName}`} /><a href={item.audioUrl} download={`igen-audio-${item.createdAt.slice(0, 16).replace(/[:T]/g, "-")}.mp3`} className="inline-block text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Tải audio xuống</a></li>)}</ul>}
    </section>}

    {tool === "speak" && !showSpeechHistory && <section aria-labelledby="speak-title" aria-busy={busy || documentBusy} className="grid gap-4 lg:grid-cols-5 lg:gap-5">
      <div className="space-y-3 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="speak-title" className="text-lg font-semibold text-balance">Nội dung</h2>
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="sr-only">Nguồn nội dung để chuyển thành giọng nói</legend>
            <label className="inline-flex cursor-pointer items-center gap-2"><input type="radio" name="speech-source" value="text" checked={speechSource === "text"} onChange={() => { setSpeechSource("text"); setError(""); }} className="size-4 shrink-0 appearance-none rounded-full border-2 border-outline bg-surface-container-lowest checked:border-4 checked:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />Văn bản</label>
            <label className="inline-flex cursor-pointer items-center gap-2"><input type="radio" name="speech-source" value="file" checked={speechSource === "file"} onChange={() => { setSpeechSource("file"); setError(""); }} className="size-4 shrink-0 appearance-none rounded-full border-2 border-outline bg-surface-container-lowest checked:border-4 checked:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />Tệp tài liệu</label>
          </fieldset>
        </div>
        {speechSource === "text" ? <div>
          <label htmlFor="audio-text" className="sr-only">Văn bản cần chuyển thành giọng nói</label>
          <textarea id="audio-text" value={text} onChange={(event) => { setText(event.target.value); setError(""); }} maxLength={10000} rows={15} placeholder="Nhập hoặc dán nội dung văn bản cần chuyển thành giọng nói..." className={`${inputClass} min-h-80 lg:min-h-[28rem] resize-y p-4`} aria-describedby="audio-text-count" />
        </div> : <div
          onDragOver={(event) => { event.preventDefault(); if (!documentBusy) setDraggingDocument(true); }}
          onDragLeave={() => setDraggingDocument(false)}
          onDrop={(event) => { event.preventDefault(); setDraggingDocument(false); const file = event.dataTransfer.files[0]; if (file) void chooseDocument(file); }}
          className={cn("flex min-h-80 lg:min-h-[28rem] flex-col items-center justify-center rounded-xl border border-dashed bg-surface p-6 text-center", draggingDocument ? "border-primary" : "border-outline-variant")}
        >
          <FileText className="mb-3 size-10 text-primary" aria-hidden="true" />
          <p className="text-pretty text-sm font-medium">{documentFile?.name || "Kéo và thả tệp tài liệu vào đây"}</p>
          <p className="mt-1 text-pretty text-xs text-on-surface-variant">PDF, DOCX hoặc TXT · tối đa 20 MB. PDF scan cần OCR trước.</p>
          <input ref={documentInputRef} type="file" accept=".pdf,.docx,.txt" className="sr-only" aria-label="Chọn tệp tài liệu" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void chooseDocument(file); event.currentTarget.value = ""; }} />
          <button type="button" onClick={() => documentInputRef.current?.click()} disabled={documentBusy} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><Upload className="size-4" aria-hidden="true" />Tải lên từ máy tính</button>
          {documentBusy && <p role="status" className="mt-3 text-sm text-on-surface-variant">Đang đọc nội dung tài liệu…</p>}
          {documentText && <div className="mt-4 w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-left"><p className="mb-2 text-xs font-medium text-on-surface-variant">Đã trích xuất {documentText.length.toLocaleString("vi-VN")} ký tự</p><p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-pretty text-sm text-on-surface">{documentText}</p></div>}
        </div>}
      </div>
      <aside aria-label="Quản trị và thiết lập" className="space-y-3 rounded-xl border border-outline-variant bg-surface p-4 lg:col-span-2">
        <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-on-surface-variant" aria-hidden="true" /><h2 className="text-lg font-semibold text-balance">Quản trị và thiết lập</h2></div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Giọng đọc</h3><button type="button" disabled aria-label="Tạo giọng cá nhân, sắp ra mắt" className="inline-flex min-h-8 items-center gap-2 rounded-full border border-outline-variant px-3 text-xs font-medium text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-70"><span>Tạo giọng cá nhân</span><span className="rounded-full bg-surface-container-low px-2 py-0.5">Sắp ra mắt</span></button></div>
          <AssistantSpeechVoicePicker value={voiceId} onChange={setVoiceId} />
        </div>
        <section aria-labelledby="speech-settings-title" className="space-y-3 border-t border-outline-variant pt-3">
          <div className="flex items-center justify-between gap-2"><h3 id="speech-settings-title" className="text-sm font-semibold">Tốc độ</h3><button type="button" onClick={() => setSpeechControls(defaultAssistantSpeechControls)} className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><RotateCcw className="size-3.5" aria-hidden="true" />Đặt lại mặc định</button></div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_3.5rem] items-center gap-3"><label htmlFor="speech-speed" className="text-sm">Tốc độ đọc</label><div className="relative flex h-5 items-center"><span aria-hidden="true" className="absolute inset-x-0 h-1.5 rounded-full bg-outline-variant" /><span aria-hidden="true" className="absolute left-0 h-1.5 rounded-full bg-primary" style={{ width: `${speechSpeedPercent}%` }} /><input id="speech-speed" type="range" min="0.7" max="1.2" step="0.05" value={speechControls.speed} aria-valuetext={`${Number(speechControls.speed.toFixed(2))}x`} onChange={(event) => setSpeechControls((current) => ({ ...current, speed: Number(event.target.value) }))} className="ai-studio-audio-range absolute inset-0 h-full w-full" /></div><span className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-center text-sm tabular-nums">{Number(speechControls.speed.toFixed(2))}x</span></div>
          <div className="space-y-2">{speechPauseLabels.map(({ key, label }) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_2rem_5.5rem_2rem] items-center gap-1.5"><label htmlFor={key} className="text-xs text-on-surface">{label}</label><button type="button" aria-label={`Giảm ${label.toLocaleLowerCase("vi-VN")}`} disabled={speechControls[key] <= 0} onClick={() => setSpeechControls((current) => ({ ...current, [key]: Math.max(0, Number((current[key] - 0.05).toFixed(2))) }))} className="inline-flex size-8 items-center justify-center rounded-md border border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"><Minus className="size-4" aria-hidden="true" /></button><div className="relative"><input id={key} type="number" min="0" max="3" step="0.05" value={speechControls[key]} onChange={(event) => { const value = Number(event.target.value); setSpeechControls((current) => ({ ...current, [key]: Math.max(0, Math.min(3, Number.isFinite(value) ? value : 0)) })); }} className="w-full rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 pr-10 text-center text-sm tabular-nums text-on-surface focus:border-primary focus:outline-none" aria-label={`${label}, giây`} /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">giây</span></div><button type="button" aria-label={`Tăng ${label.toLocaleLowerCase("vi-VN")}`} disabled={speechControls[key] >= 3} onClick={() => setSpeechControls((current) => ({ ...current, [key]: Math.min(3, Number((current[key] + 0.05).toFixed(2))) }))} className="inline-flex size-8 items-center justify-center rounded-md border border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary"><Plus className="size-4" aria-hidden="true" /></button></div>)}</div>
        </section>
      </aside>
      <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-5">
        <p id="audio-text-count" className="text-sm tabular-nums text-on-surface-variant">Ký tự: {activeSpeechText.length.toLocaleString("vi-VN")} / 10.000</p>
        <button type="button" onClick={generate} disabled={busy || documentBusy || !activeSpeechText.trim()} className={buttonClass}>{busy ? "Đang chuyển đổi..." : "Chuyển đổi"}</button>
      </div>
      {audioUrl && <div className="space-y-3 lg:col-span-5"><audio controls src={audioUrl} className="w-full" aria-label="Audio vừa tạo" /><a href={audioUrl} download="igen-audio.mp3" className="inline-block text-sm font-medium text-primary underline">Tải audio xuống</a></div>}
    </section>}

    {tool === "clone" && <section aria-labelledby="clone-title" className="mx-auto max-w-3xl space-y-6"><div className="text-center"><h2 id="clone-title" className="text-lg font-semibold text-balance">Tạo giọng cá nhân</h2><p className="mt-2 text-pretty text-sm text-on-surface-variant">Tính năng lưu giọng cá nhân đang được chuẩn bị cho luồng OpenRouter.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-outline-variant bg-surface p-6 text-center"><AudioArtwork panel={0} /><h3 className="font-medium">Ghi âm trực tiếp</h3><p className="mt-1 text-pretty text-xs text-on-surface-variant">Ghi âm mẫu giọng nói trong không gian yên tĩnh.</p><button type="button" disabled className="mt-5 rounded-lg border border-outline-variant px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Bắt đầu ghi âm · Sắp ra mắt</button></div><UploadArea panel={0} disabled label="Tải tệp lên" hint="MP3, WAV, M4A; tối đa 10 MB" accept=".mp3,.wav,.m4a,.webm" file={null} onFile={() => undefined} /></div><ul className="list-inside list-disc space-y-2 rounded-xl border border-outline-variant p-5 text-sm text-on-surface-variant">{["Sử dụng giọng nói của chính bạn hoặc giọng đã được cho phép.", "Đọc trong không gian tĩnh, ít tạp âm.", "Chỉ dùng một giọng nói trong mẫu âm thanh."].map((tip) => <li key={tip}>{tip}</li>)}</ul></section>}

    {tool === "transcribe" && <section aria-labelledby="transcribe-title" aria-busy={busy} className="mx-auto max-w-3xl space-y-6">
      <div><h2 id="transcribe-title" className="text-lg font-semibold text-balance">Chuyển giọng nói thành văn bản</h2><p className="mt-2 text-pretty text-sm text-on-surface-variant">Tải tệp âm thanh để nhận bản chép lời tiếng Việt.</p></div>
      {showTranscriptHistory && <div id="studio-transcript-history" className="rounded-xl border border-outline-variant p-4"><h3 className="mb-3 text-sm font-semibold">Bản chép lời gần đây</h3>{transcriptHistory.length === 0 ? <p className="text-sm text-on-surface-variant">Chưa có bản chép lời.</p> : <ul className="space-y-2">{transcriptHistory.map((item) => <li key={item.id}><button type="button" onClick={() => setTranscript(item)} className="w-full rounded-lg border border-outline-variant p-3 text-left text-sm hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"><span className="block truncate font-medium">{item.fileName}</span><span className="block text-xs text-on-surface-variant">{new Date(item.createdAt).toLocaleString("vi-VN")}</span></button></li>)}</ul>}</div>}
      <UploadArea panel={2} label="Kéo và thả tệp vào đây" hint="Tối đa 50 MB · MP3, WAV, M4A, OGG, FLAC" accept=".mp3,.wav,.m4a,.ogg,.flac" file={transcriptFile} onFile={chooseAudio} />
      <div className="flex justify-end"><button type="button" onClick={transcribe} disabled={!transcriptFile || busy} className={buttonClass}>{busy ? "Đang chuyển đổi..." : "Chuyển thành văn bản"}</button></div>
      {transcript && <div className="rounded-xl border border-outline-variant bg-surface p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Bản chép lời: {transcript.fileName}</h3><div className="flex gap-3"><button type="button" onClick={() => { if (!navigator.clipboard) return setError("Trình duyệt không hỗ trợ sao chép tự động."); navigator.clipboard.writeText(transcript.text).catch(() => setError("Không thể sao chép văn bản.")); }} className="text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Sao chép</button><button type="button" onClick={() => downloadTranscript(transcript)} className="text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary">Tải TXT</button></div></div><p className="whitespace-pre-wrap text-pretty text-sm leading-6">{transcript.text}</p></div>}
    </section>}
    {error && <p role="alert" className="rounded-lg border border-outline bg-surface p-3 text-sm text-on-surface">{error}</p>}
    </main>
  </div>;
}
