import { useEffect, useRef, useState } from "react";
import { AudioLines, History, Mic, Pause, Play, Square, Upload, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { assistantService } from "../../services/assistantService";
import { assistantAgentService } from "../../services/assistantAgentService";

type Meeting = { id: string; title: string; notes: string; transcript: string; summary?: string; fileName: string; createdAt: string };
const limit = 50 * 1024 * 1024;
const maxRecordingSeconds = 60 * 60;
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const readHistory = (storageKey: string): Meeting[] => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(data) ? data.filter((item): item is Meeting => Boolean(item && typeof item.id === "string" && typeof item.title === "string" && typeof item.notes === "string" && typeof item.transcript === "string" && typeof item.fileName === "string" && typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt)))) : [];
  } catch { return []; }
};
const clock = (seconds: number) => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
const formattedNotes = (value: string) => value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|~~[^~]+~~)/g).map((part, index) => {
  if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
  if (part.startsWith("__") && part.endsWith("__")) return <u key={index}>{part.slice(2, -2)}</u>;
  if (part.startsWith("~~") && part.endsWith("~~")) return <s key={index}>{part.slice(2, -2)}</s>;
  if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
  return part;
});

function recordingExtension(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  throw new Error("Trình duyệt không tạo được định dạng âm thanh được hỗ trợ.");
}
async function createMinutes(transcript: string, notes: string): Promise<string> {
  if (!transcript.trim()) throw new Error("Không có nội dung lời nói để tạo biên bản.");
  const agent = {
    instructions: "Phân tích nội dung cuộc họp và soạn biên bản tiếng Việt, không chỉ chép lại lời thoại. Trình bày các mục: Tóm tắt; Phân tích (mục tiêu, vấn đề chính, nguyên nhân và tác động được nêu, điểm còn thiếu hoặc mâu thuẫn); Quyết định; Việc cần làm (người phụ trách và hạn nếu được nói rõ); Vấn đề chưa thống nhất. Chỉ dùng thông tin có trong đầu vào; mục nào không có thông tin thì ghi 'Chưa ghi nhận'.",
    avoid: "Không suy đoán nguyên nhân, tác động, tên, thời hạn, quyết định hoặc nội dung không được đề cập.",
    tone: "Rõ ràng, chuyên nghiệp",
    knowledge: [],
  };
  const parts = transcript.match(/[\s\S]{1,9000}/g) || [];
  const summaries: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const result = await assistantAgentService.chat(agent, [{ role: "user", content: `Bản chép lời, phần ${i + 1}/${parts.length}:\n${parts[i]}${i === 0 && notes ? `\n\nGhi chú của người dùng:\n${notes.slice(0, 1500)}` : ""}` }]);
    summaries.push(result.reply);
  }
  if (summaries.length === 1) return summaries[0];
  let combined = summaries.join("\n\n");
  for (let round = 0; combined.length > 11000 && round < 3; round++) {
    const pieces = combined.match(/[\s\S]{1,9000}/g) || [];
    const reduced: string[] = [];
    for (const piece of pieces) {
      const result = await assistantAgentService.chat(agent, [{ role: "user", content: `Rút gọn phần biên bản sau, giữ nguyên các quyết định và việc cần làm:\n${piece}` }]);
      reduced.push(result.reply);
    }
    combined = reduced.join("\n\n");
  }
  if (combined.length > 11000) throw new Error("Biên bản quá dài để tổng hợp trong một lần.");
  const final = await assistantAgentService.chat(agent, [{ role: "user", content: `Hợp nhất các phần biên bản sau thành một biên bản không trùng lặp:\n${combined}` }]);
  return final.reply;
}

const waveBarCount = 28;

function MeetingWaveform({ stream, paused, seconds }: { stream: MediaStream; paused: boolean; seconds: number }) {
  const waveform = useRef<HTMLDivElement>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof AudioContext === "undefined") return;
    let context: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    try {
      context = new AudioContext();
      source = context.createMediaStreamSource(stream);
      const nextAnalyser = context.createAnalyser();
      nextAnalyser.fftSize = 512;
      source.connect(nextAnalyser);
      setAnalyser(nextAnalyser);
      void context.resume().catch(() => {});
    } catch {
      source?.disconnect();
      if (context) void context.close();
    }
    return () => {
      source?.disconnect();
      if (context) void context.close();
    };
  }, [stream]);

  useEffect(() => {
    if (!waveform.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? false));
    observer.observe(waveform.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const bars = waveform.current?.querySelectorAll<HTMLElement>("[data-wave-bar]");
    if (!bars) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!analyser || paused || !visible || reducedMotion || typeof requestAnimationFrame !== "function") {
      bars.forEach(bar => { bar.style.transform = "scaleY(0.12)"; });
      return;
    }
    const samples = new Uint8Array(analyser.fftSize);
    const levels = Array<number>(waveBarCount).fill(0.12);
    let frame = 0;
    let previous = 0;
    const update = (time: number) => {
      frame = requestAnimationFrame(update);
      if (time - previous < 32) return;
      previous = time;
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
      const volume = Math.min(1, Math.max(0.12, Math.sqrt(energy / samples.length) * 9));
      levels.pop();
      levels.unshift(volume);
      bars.forEach((bar, index) => {
        const level = index < waveBarCount ? levels[waveBarCount - index - 1] : levels[index - waveBarCount];
        bar.style.transform = `scaleY(${level.toFixed(2)})`;
      });
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [analyser, paused, visible]);

  const bars = Array.from({ length: waveBarCount }, (_, index) => <span key={index} data-wave-bar className={cn("h-12 w-1 flex-none origin-center rounded-full bg-primary", index % 2 === 1 && "hidden sm:block")} style={{ transform: "scaleY(0.12)" }} />);
  return <div ref={waveform} className="mb-14 flex w-full max-w-2xl items-center justify-center gap-3 sm:gap-5">
    <div aria-hidden="true" className="flex h-12 min-w-0 flex-1 items-center justify-end gap-0.5 overflow-hidden">{bars}</div>
    <p role="timer" className="shrink-0 text-center text-lg tabular-nums text-on-surface sm:text-xl">{clock(seconds)}</p>
    <div aria-hidden="true" className="flex h-12 min-w-0 flex-1 items-center justify-start gap-0.5 overflow-hidden">{bars}</div>
  </div>;
}

function MeetingAudioFileIcon() {
  return <svg viewBox="0 0 72 72" className="size-14" fill="none" aria-hidden="true">
    <path d="M12 17a5 5 0 0 1 5-5h25l12 12v34a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V17Z" fill="var(--color-primary-container)" stroke="var(--color-primary)" strokeWidth="2" />
    <path d="M27 10a5 5 0 0 1 5-5h21l9 10v34a5 5 0 0 1-5 5H32a5 5 0 0 1-5-5V10Z" fill="var(--color-primary)" />
    <path d="M53 5v8a3 3 0 0 0 3 3h6" fill="var(--color-primary-container)" />
    <path d="M37 30v9m5-14v19m5-14v9m5-12v15" stroke="var(--color-on-primary)" strokeWidth="3" strokeLinecap="round" />
    <path d="M19 30h5m-5 7h5m-5 7h5" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

export function AssistantMeetingNotes({ standalone = true, storageScope = "browser" }: { standalone?: boolean; storageScope?: string }) {
  const storageKey = "igen_erp_meeting_minutes:" + storageScope;
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState(() => readHistory(storageKey));
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const discard = useRef(false);
  const noteValues = useRef({ title: "", notes: "" });
  const input = useRef<HTMLInputElement>(null);
  const noteInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!recording || paused) return;
    const timer = window.setInterval(() => setSeconds(value => {
      if (value >= maxRecordingSeconds - 1 && recorder.current?.state !== "inactive") recorder.current?.stop();
      return Math.min(value + 1, maxRecordingSeconds);
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording, paused]);
  useEffect(() => () => {
    discard.current = true;
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function transcribe(audio: File, meetingTitle = "", meetingNotes = "") {
    setBusy(true); setError("");
    try {
      const result = await assistantService.transcribeStudioAudio(audio);
      const entry: Meeting = { id: result.id, title: meetingTitle.trim() || audio.name.replace(/\.[^.]+$/, ""), notes: meetingNotes, transcript: result.text, fileName: audio.name, createdAt: result.createdAt };
      setHistory(current => {
        const next = [entry, ...current.filter(item => item.id !== entry.id)].slice(0, 30);
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* In-memory history remains usable. */ }
        return next;
      });
      setSelected(entry); setFile(null);
      void summarize(entry);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tạo ghi chép cuộc họp."); }
    finally { setBusy(false); }
  }

  async function summarize(entry: Meeting) {
    setSummarizing(true);
    try {
      const summary = await createMinutes(entry.transcript, entry.notes);
      const updated = { ...entry, summary };
      setSelected(current => current?.id === entry.id ? updated : current);
      setHistory(current => {
        const next = current.map(item => item.id === entry.id ? updated : item);
        try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the result in memory. */ }
        return next;
      });
    } catch { setError("Chưa tạo được biên bản tự động. Bạn có thể thử lại; bản chép lời đã được lưu."); }
    finally { setSummarizing(false); }
  }

  async function start() {
    setError(""); setSelected(null); setSeconds(0); setTitle(""); setNotes(""); noteValues.current = { title: "", notes: "" };
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Trình duyệt không hỗ trợ ghi âm bằng micro."); return; }
    let microphone: MediaStream | null = null;
    try {
      microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      const activeMicrophone = microphone;
      const preferredType = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const device = new MediaRecorder(activeMicrophone, { ...(preferredType ? { mimeType: preferredType } : {}), audioBitsPerSecond: 48_000 });
      stream.current = activeMicrophone; recorder.current = device; chunks.current = []; discard.current = false;
      device.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      device.onstop = () => {
        activeMicrophone.getTracks().forEach(track => track.stop());
        stream.current = null; setRecording(false); setPaused(false);
        if (discard.current) return;
        const audio = new Blob(chunks.current, { type: device.mimeType || chunks.current[0]?.type });
        if (!audio.size) { setError("Bản ghi không có âm thanh."); return; }
        if (audio.size > limit) { setError("Bản ghi vượt quá 50 MB. Hãy ghi âm trong thời lượng ngắn hơn."); return; }
        try {
          const type = audio.type || device.mimeType;
          const file = new File([audio], "cuoc-hop-" + Date.now() + "." + recordingExtension(type), { type });
          void transcribe(file, noteValues.current.title, noteValues.current.notes);
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đọc được bản ghi âm."); }
      };
      device.start(1000); setRecording(true);
    } catch { microphone?.getTracks().forEach(track => track.stop()); setError("Không truy cập được micro. Hãy cấp quyền ghi âm rồi thử lại."); }
  }

  function chooseFile(next?: File) {
    if (!next) return;
    if (!/\.(mp3|wav|m4a|ogg|flac|webm)$/i.test(next.name)) { setError("Chỉ hỗ trợ MP3, WAV, M4A, OGG, FLAC và WEBM."); return; }
    if (next.size > limit) { setError("Tệp âm thanh không được vượt quá 50 MB."); return; }
    setFile(next); setSelected(null); setError("");
  }

  function formatNote(kind: "bold" | "italic" | "underline" | "strike" | "bullet" | "number") {
    const field = noteInput.current;
    if (!field) return;
    const [open, close] = { bold: ["**", "**"], italic: ["*", "*"], underline: ["__", "__"], strike: ["~~", "~~"], bullet: ["• ", ""], number: ["1. ", ""] }[kind];
    const { selectionStart: start, selectionEnd: end } = field;
    const next = notes.slice(0, start) + open + notes.slice(start, end) + close + notes.slice(end);
    setNotes(next); noteValues.current.notes = next;
    requestAnimationFrame(() => { field.focus(); field.setSelectionRange(start + open.length, end + open.length); });
  }

  const action = cn("grid size-16 place-items-center rounded-full border border-outline-variant bg-surface-container-lowest shadow-md hover:bg-surface-container-low sm:size-20", focus);
  return <section aria-label="Ghi chép cuộc họp" data-standalone={standalone} className="min-h-0 flex-1 overflow-y-auto bg-surface-container-lowest px-4 py-5 text-on-surface sm:px-8 lg:px-10">
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col">
      <div className="flex justify-end">{!recording && <button type="button" aria-pressed={historyOpen} onClick={() => { setHistoryOpen(value => !value); setSelected(null); }} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-4 text-sm font-medium hover:bg-surface-container-low", focus)}><History className="size-4" aria-hidden="true" />Lịch sử</button>}</div>
      {!recording && !selected && !historyOpen && <div role="group" aria-label="Nguồn âm thanh cuộc họp" className="mx-auto mt-3 flex w-full max-w-md rounded-lg bg-surface-container-low p-1"><button type="button" aria-pressed={mode === "record"} onClick={() => setMode("record")} className={cn("min-h-10 flex-1 rounded-md text-sm font-medium", mode === "record" ? "bg-surface-container-lowest text-primary shadow-sm" : "hover:bg-surface-container-high", focus)}>Ghi âm</button><button type="button" aria-pressed={mode === "upload"} onClick={() => setMode("upload")} className={cn("min-h-10 flex-1 rounded-md text-sm font-medium", mode === "upload" ? "bg-surface-container-lowest text-primary shadow-sm" : "hover:bg-surface-container-high", focus)}>Tải âm thanh</button></div>}
      {historyOpen ? <div className="mx-auto mt-10 w-full max-w-3xl"><h2 className="text-balance text-xl font-semibold">Lịch sử ghi chép</h2><button type="button" onClick={() => setHistoryOpen(false)} className={cn("mt-4 min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary", focus)}>Tạo ghi chép mới</button>{history.length ? <ul className="mt-5 space-y-2">{history.map(entry => <li key={entry.id}><button type="button" onClick={() => { setSelected(entry); setHistoryOpen(false); }} className={cn("flex min-h-16 w-full flex-col justify-center rounded-xl border border-outline-variant px-4 text-left hover:bg-surface-container-low", focus)}><span className="font-medium">{entry.title}</span><span className="text-xs text-on-surface-variant">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))} · {entry.fileName}</span></button></li>)}</ul> : <p className="mt-6 text-pretty text-sm text-on-surface-variant">Chưa có bản ghi cuộc họp nào.</p>}</div>
      : selected ? <div className="mx-auto mt-10 w-full max-w-4xl">
        <button type="button" onClick={() => setSelected(null)} className={cn("mb-5 text-sm text-primary", focus)}>← Ghi chép mới</button>
        <h2 className="text-balance text-2xl font-semibold">{selected.title}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{selected.fileName}</p>
        <section aria-labelledby="meeting-analysis-title" className="mt-5 rounded-xl border border-outline-variant p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="meeting-analysis-title" className="text-balance text-lg font-semibold">Phân tích và biên bản cuộc họp</h3>
            <button type="button" disabled={summarizing} onClick={() => void summarize(selected)} className={cn("min-h-10 rounded-lg border border-outline-variant px-4 text-sm font-medium text-primary hover:bg-surface-container-low disabled:opacity-50", focus)}>{selected.summary ? "Tạo lại phân tích" : "Phân tích cuộc họp"}</button>
          </div>
          {summarizing ? <p role="status" className="mt-3 text-sm text-on-surface-variant">AI đang phân tích nội dung cuộc họp…</p> : selected.summary ? <p className="mt-3 whitespace-pre-wrap text-pretty text-sm leading-6">{selected.summary}</p> : <p className="mt-3 text-pretty text-sm text-on-surface-variant">Chưa có phân tích. Hãy chọn “Phân tích cuộc họp” để tạo biên bản.</p>}
        </section>
        <details className="mt-4 rounded-xl border border-outline-variant p-5">
          <summary className={cn("cursor-pointer text-sm font-medium text-on-surface", focus)}>Xem bản chép lời và ghi chú đầu vào</summary>
          {selected.notes && <div className="mt-4 border-t border-outline-variant pt-4"><h3 className="text-balance text-sm font-semibold">Ghi chú đầu vào</h3><p className="mt-2 whitespace-pre-wrap text-pretty text-sm text-on-surface-variant">{formattedNotes(selected.notes)}</p></div>}
          <div className="mt-4 border-t border-outline-variant pt-4"><h3 className="text-balance text-sm font-semibold">Bản chép lời</h3><p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-6">{selected.transcript}</p></div>
        </details>
      </div>
      : recording ? <div className="mt-4 grid min-h-96 flex-1 gap-4 lg:grid-cols-3"><div className="flex flex-col items-center justify-center rounded-2xl border border-outline-variant p-6 lg:col-span-2"><MeetingWaveform stream={stream.current!} paused={paused} seconds={seconds} /><div className="flex gap-5 sm:gap-10"><div className="text-center"><button type="button" aria-label="Hủy ghi âm" onClick={() => { discard.current = true; recorder.current?.stop(); }} className={action}><X className="size-7" aria-hidden="true" /></button><span className="mt-3 block text-sm">Hủy</span></div><div className="text-center"><button type="button" aria-label={paused ? "Tiếp tục ghi âm" : "Tạm dừng ghi âm"} onClick={() => { if (paused) recorder.current?.resume(); else recorder.current?.pause(); setPaused(!paused); }} className={action}>{paused ? <Play className="size-7" aria-hidden="true" /> : <Pause className="size-7" aria-hidden="true" />}</button><span className="mt-3 block text-sm">{paused ? "Tiếp tục" : "Tạm dừng"}</span></div><div className="text-center"><button type="button" aria-label="Hoàn tất ghi âm" onClick={() => recorder.current?.stop()} className={action}><Square className="size-7 fill-primary text-primary" aria-hidden="true" /></button><span className="mt-3 block text-sm">Hoàn tất</span></div></div></div><div className="flex min-h-80 flex-col rounded-2xl border border-outline-variant p-4"><h3 className="font-medium">Ghi chú</h3><div role="toolbar" aria-label="Định dạng ghi chú" className="mt-3 flex flex-wrap gap-1 border-b border-outline-variant pb-2">{([ ["bold", "B"], ["italic", "I"], ["underline", "U"], ["strike", "S"], ["bullet", "•"], ["number", "1."] ] as const).map(([kind, label]) => <button key={kind} type="button" aria-label={"Định dạng " + kind} onClick={() => formatNote(kind)} className={cn("grid size-9 place-items-center rounded-md text-sm text-on-surface-variant hover:bg-surface-container-low", focus)}>{label}</button>)}</div><input aria-label="Tiêu đề ghi chú" value={title} onChange={event => { setTitle(event.target.value); noteValues.current.title = event.target.value; }} placeholder="Nội dung tiêu đề" className="mt-5 w-full border-0 bg-transparent text-lg outline-none placeholder:text-on-surface-variant focus-visible:underline" /><textarea ref={noteInput} aria-label="Ghi chú cuộc họp" value={notes} onChange={event => { setNotes(event.target.value); noteValues.current.notes = event.target.value; }} placeholder="Nhập các ghi chú của bạn" className="mt-3 min-h-48 w-full flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-on-surface-variant focus-visible:underline" /></div></div>
      : <div className={cn("flex flex-1 flex-col items-center", mode === "upload" ? "pt-6 sm:pt-8" : "pt-10 sm:pt-14")}><h2 className="text-balance text-2xl font-semibold text-on-surface sm:text-3xl">Phân tích <span className="text-primary">cuộc họp</span></h2><p className="mt-4 max-w-2xl text-center text-pretty text-sm text-on-surface-variant sm:text-base">{mode === "record" ? "Ghi âm để AI phân tích cuộc họp, tổng hợp quyết định và việc cần làm." : "Tải lên tệp âm thanh để AI phân tích và tạo biên bản cuộc họp."}</p>{mode === "record" && <p className="text-sm text-on-surface-variant">Ghi âm tối đa 60 phút mỗi lần · Tệp xử lý tối đa 50 MB</p>}{mode === "record" ? <><div className="mt-12 w-full max-w-lg rounded-xl border border-primary bg-primary/5 p-5"><span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><AudioLines className="size-5" aria-hidden="true" /></span><h3 className="mt-3 text-balance font-medium text-primary">Ghi âm trực tiếp</h3><p className="mt-2 text-pretty text-sm text-on-surface-variant">Ghi lại âm thanh từ micro của bạn ngay lập tức</p></div><button type="button" disabled={busy} onClick={() => void start()} className={cn("mt-12 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50", focus)}><Mic className="size-5" aria-hidden="true" />Bắt đầu ghi âm</button></> : <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }} className="mt-6 flex min-h-64 w-full max-w-4xl flex-col items-center justify-center rounded-2xl border border-dashed border-primary/50 p-6 text-center sm:min-h-72"><MeetingAudioFileIcon /><button type="button" onClick={() => input.current?.click()} className={cn("mt-5 text-lg font-semibold text-on-surface hover:opacity-80", focus)}>Chọn âm thanh <span className="text-primary">để phân tích</span></button><input ref={input} type="file" accept=".mp3,.wav,.m4a,.ogg,.flac,.webm" aria-label="Tệp âm thanh cuộc họp" className="sr-only" onChange={event => chooseFile(event.target.files?.[0])} /><p className="mt-6 text-sm text-on-surface-variant">Dung lượng tối đa: 50 MB</p><p className="mt-2 text-sm text-on-surface-variant">Định dạng hỗ trợ: .mp3, .wav, .m4a, .ogg, .flac, .webm</p>{file && <><p className="mt-5 text-sm font-medium">{file.name}</p><button type="button" disabled={busy} onClick={() => void transcribe(file)} className={cn("mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-on-primary disabled:opacity-50", focus)}><Upload className="size-4" aria-hidden="true" />Phân tích cuộc họp</button></>}</div>}</div>}

      {busy && <p role="status" className="mt-5 text-center text-sm text-primary">Đang xử lý âm thanh để phân tích cuộc họp…</p>}
      {error && <p role="alert" className="mx-auto mt-5 max-w-xl text-center text-pretty text-sm text-error">{error}</p>}
      {!recording && !selected && !historyOpen && <p className="mt-auto pt-8 text-center text-xs text-on-surface-variant">Xử lý âm thanh qua dịch vụ AI của iGen</p>}
    </div>
  </section>;
}
