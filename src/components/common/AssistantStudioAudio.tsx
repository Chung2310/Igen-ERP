import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock3, Plus } from "lucide-react";
import { assistantService, type AssistantStudioTranscript } from "../../services/assistantService";
import AssistantSpeechVoicePicker from "./AssistantSpeechVoicePicker";
import { defaultAssistantSpeechVoice, type AssistantSpeechVoice } from "../../shared/assistant-speech-voices";

export type AudioTool = "clone" | "speak" | "transcribe";
const inputClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none";
const buttonClass = "rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

function AudioArtwork({ panel }: { panel: 0 | 1 | 2 }) {
  return <span aria-hidden="true" className="mx-auto mb-4 block size-24 rounded-xl border border-outline-variant bg-surface" style={{ backgroundImage: 'url("/ai-studio-audio-tools.png")', backgroundSize: "300% 100%", backgroundPosition: `${panel * 50}% 0%` }} />;
}

function UploadArea({ label, hint, accept, file, onFile, panel, disabled = false }: { label: string; hint: string; accept: string; file: File | null; onFile: (file: File) => void; panel: 0 | 2; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <div className={`rounded-xl border border-dashed bg-surface p-6 text-center ${dragging ? "border-primary" : "border-outline-variant"}`}
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
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<AssistantStudioTranscript | null>(null);
  const [transcriptHistory, setTranscriptHistory] = useState<AssistantStudioTranscript[]>([]);
  const [showTranscriptHistory, setShowTranscriptHistory] = useState(false);
  const pageTitle = tool === "clone" ? "Tạo giọng cá nhân" : tool === "speak" ? "Tạo audio" : "Chuyển giọng nói thành văn bản";
  useEffect(() => () => { if (audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => {
    if (tool !== "transcribe") return;
    let active = true;
    assistantService.studioTranscripts().then((items) => { if (active) setTranscriptHistory(items); }).catch(() => { if (active) setError("Không tải được lịch sử bản chép lời."); });
    return () => { active = false; };
  }, [tool]);

  async function generate() {
    setError(""); setAudioUrl("");
    if (!text.trim()) return setError("Nhập văn bản cần chuyển đổi.");
    setBusy(true);
    try {
      const audio = await assistantService.speech(text.trim(), undefined, voiceId);
      setAudioUrl(URL.createObjectURL(audio));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo audio."); }
    finally { setBusy(false); }
  }

  const chooseAudio = (file: File) => {
    if (!/\.(mp3|wav|m4a|ogg|flac)$/i.test(file.name) || file.size === 0 || file.size > 50 * 1024 * 1024) {
      setTranscriptFile(null); setTranscript(null);
      return setError("Chọn tệp MP3, WAV, M4A, OGG hoặc FLAC, tối đa 50 MB.");
    }
    setError("");
    setTranscriptFile(file); setTranscript(null);
  };

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
    setAudioUrl("");
    setError("");
    setTranscriptFile(null);
    setTranscript(null);
    setShowTranscriptHistory(false);
  }

  return <div className="flex min-h-full min-w-0 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1 text-sm">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-on-surface-variant hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft className="size-4" aria-hidden="true" />AI Studio</button>
        <span className="text-on-surface-variant" aria-hidden="true">/</span>
        <h1 className="truncate font-semibold text-balance">{pageTitle}</h1>
        {tool === "clone" && <span className="shrink-0 rounded-full border border-outline-variant px-2 py-1 text-xs font-medium text-on-surface-variant">Sắp ra mắt</span>}
      </div>
      {(tool === "speak" || tool === "transcribe") && <div className="flex items-center gap-2">
        <button type="button" onClick={reset} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" aria-hidden="true" />Tạo mới</button>
        {tool === "transcribe" && <button type="button" onClick={() => setShowTranscriptHistory((value) => !value)} aria-expanded={showTranscriptHistory} aria-controls={showTranscriptHistory ? "studio-transcript-history" : undefined} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><Clock3 className="size-4" aria-hidden="true" />Lịch sử</button>}
      </div>}
    </header>
    <main className="mx-auto w-full max-w-screen-2xl flex-1 space-y-6 p-4 text-on-surface sm:p-6">

    {tool === "speak" && <section aria-labelledby="speak-title" className="grid gap-5 lg:grid-cols-5 lg:gap-6">
      <div className="space-y-4 lg:col-span-3">
        <h2 id="speak-title" className="text-lg font-semibold text-balance">Nội dung</h2>
        <div>
          <label htmlFor="audio-text" className="sr-only">Văn bản cần chuyển thành giọng nói</label>
          <textarea id="audio-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={10000} rows={15} placeholder="Nhập hoặc dán nội dung văn bản cần chuyển thành giọng nói..." className={`${inputClass} min-h-80 resize-y p-4`} aria-describedby="audio-text-count" />
        </div>
      </div>
      <aside aria-label="Quản trị và thiết lập giọng đọc" className="space-y-5 rounded-xl border border-outline-variant bg-surface p-4 sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-balance">Giọng đọc</h2>
          <button type="button" disabled aria-label="Tạo giọng cá nhân, sắp ra mắt" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-outline-variant px-3 text-sm font-medium text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-70">
            <span>Tạo giọng cá nhân</span>
            <span className="rounded-full bg-surface-container-low px-2 py-0.5 text-xs">Sắp ra mắt</span>
          </button>
        </div>
        <AssistantSpeechVoicePicker value={voiceId} onChange={setVoiceId} />
        <div className="rounded-xl bg-surface-container-low p-4">
          <p className="text-sm font-medium text-on-surface">Giọng đọc tiếng Việt</p>
          <p className="mt-1 text-pretty text-sm text-on-surface-variant">Chọn một giọng để nghe trước khi tải audio.</p>
        </div>
      </aside>
      <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-5">
        <p id="audio-text-count" className="text-sm tabular-nums text-on-surface-variant">Ký tự: {text.length.toLocaleString("vi-VN")} / 10.000</p>
        <button type="button" onClick={generate} disabled={busy || !text.trim()} className={buttonClass}>{busy ? "Đang chuyển đổi..." : "Chuyển đổi"}</button>
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
