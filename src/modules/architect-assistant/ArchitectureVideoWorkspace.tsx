import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Download, ImagePlus, LoaderCircle, Play, RefreshCw, SkipBack, SkipForward, Sparkles, WandSparkles } from "lucide-react";
import type { ArchitectureProject, ArchitectureVideoJob } from "../../shared/architecture-assistant";
import type { ArchitectAssistantApi } from "./api";

const fieldClass = "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none disabled:opacity-60";

function friendlyError(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Không hoàn tất được yêu cầu.";
}

function resizeImage(dataUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Ảnh không hợp lệ hoặc không đọc được."));
    image.onload = () => {
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Trình duyệt không thể xử lý ảnh."));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.src = dataUrl;
  });
}

export default function ArchitectureVideoWorkspace({ project, api, assetUrls, canUseAi, onProjectUpdated }: {
  project: ArchitectureProject;
  api: ArchitectAssistantApi;
  assetUrls: Record<string, string>;
  canUseAi: boolean;
  onProjectUpdated: (project: ArchitectureProject) => void;
}) {
  const [prompt, setPrompt] = useState("Máy quay tiến chậm qua không gian nội thất, ánh sáng tự nhiên thay đổi nhẹ; giữ nguyên kiến trúc và vật liệu.");
  const [reference, setReference] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState(4);
  const [resolution, setResolution] = useState("720p");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState<ArchitectureVideoJob | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const latestJob = job || project.videoJobs?.slice().reverse().find(item => item.status === "pending" || item.status === "in_progress") || null;
  const latestVideo = project.renders.slice().reverse().find(asset => asset.kind === "video" && assetUrls[asset.id]);

  const chooseReference = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Chọn tệp ảnh PNG, JPEG hoặc WebP."); return; }
    if (file.size > 15 * 1024 * 1024) { setError("Ảnh phải nhỏ hơn 15 MB."); return; }
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onerror = () => reject(new Error("Không đọc được ảnh đã chọn."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      setReference(await resizeImage(dataUrl));
    } catch (cause) { setError(friendlyError(cause)); }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUseAi) { setError("Tài khoản chưa được cấp quyền sử dụng AI kiến trúc."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.createVideo(project._id, { prompt, aspectRatio, duration, resolution, generateAudio, referenceImage: reference || undefined });
      onProjectUpdated(result.project); setJob(result.job); setNotice("Đã gửi tác vụ video. Có thể mất vài phút để hoàn tất.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const refreshJob = async () => {
    if (!latestJob) return;
    setBusy(true); setError("");
    try {
      const result = await api.videoStatus(project._id, latestJob.id);
      onProjectUpdated(result.project); setJob(result.job);
      setNotice(result.job.status === "completed" ? "Video đã hoàn tất và được lưu vào thư viện." : result.job.status === "failed" ? result.job.error || "Không tạo được video." : "Video vẫn đang được xử lý.");
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const optimize = async () => {
    setBusy(true); setError("");
    try { const result = await api.optimizePrompt(project._id, { tool: "video", prompt, style: project.style }); if (result.prompt) setPrompt(result.prompt); }
    catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };

  const videoDuration = videoRef.current?.duration || duration;
  const seekTo = (value: number) => {
    const next = Math.max(0, Math.min(videoDuration, value));
    setCurrentTime(next);
    if (videoRef.current) videoRef.current.currentTime = next;
  };
  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) void videoRef.current.play();
    else videoRef.current.pause();
  };
  const formatTime = (value: number) => `${Math.floor(value / 60).toString().padStart(2, "0")}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
  const preview = reference || "https://lh3.googleusercontent.com/aida-public/AB6AXuBraYQ5_wq5YovRc4XkkNrW1JbA2wMT2d8_NkObLgw_3nxzJonFvjhVW1Mj4sooXOfrinSb3_9ic9K7xzFMsAz0s7Vo8yZ-kKViWnB4wcHLrW8bf8K5O9XWvgVfljd9RsdEWSdklFm28kqPd3q4c1iFJPP2T0yhu4-IoPJFrrqbtH2RiNjcYu3zQon35P2qiZFrnVKoyw9N7QNpNXLpmBTBp92yUJq0tcmaNcUwO2Q0j_4Ufjx_5zSaHPbG7ryR2hjIuznDMIXQsSCy";

  return <section className="space-y-3" aria-busy={busy}>
    {!canUseAi && <p className="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant" role="status">Cần quyền architect-ai:manage để tạo video bằng AI.</p>}
    {error && <p className="rounded-lg border border-error/40 bg-error-container/20 px-3 py-2 text-sm text-on-surface" role="alert">{error}</p>}
    {notice && <p className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface" role="status">{notice}</p>}

    <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 xl:grid-cols-12">
      <aside className="xl:col-span-3">
        <form onSubmit={create} className="space-y-6 rounded-xl bg-surface-container-lowest p-5 shadow-sm sm:p-6">
          <h3 data-typography="section-title" className="text-balance text-lg font-semibold leading-7 text-on-surface">Cấu hình Video</h3>
          <div className="space-y-2">
            <label htmlFor="architecture-video-image" className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">Ảnh khung hình đầu</label>
            <label htmlFor="architecture-video-image" className="group flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low text-center text-xs text-on-surface-variant transition-colors hover:border-primary hover:text-primary">
              {reference ? <img src={reference} alt="Ảnh đầu vào video" className="size-full rounded-md object-cover" /> : <><ImagePlus className="size-8" aria-hidden="true" /><span>Kéo thả hoặc nhấn để tải ảnh</span></>}
            </label>
            <input id="architecture-video-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void chooseReference(event); }} className="sr-only" />
          </div>
          <label className="block space-y-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant"><span>Kịch bản chuyển động</span><textarea required minLength={3} maxLength={1200} rows={5} value={prompt} onChange={event => setPrompt(event.target.value)} className={fieldClass + " resize-y font-normal normal-case tracking-normal"} placeholder="Nhập yêu cầu kịch bản hoặc mô tả chuyển động..." /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm text-on-surface"><span>Tỷ lệ video</span><select value={aspectRatio} onChange={event => setAspectRatio(event.target.value)} className={fieldClass}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option></select></label>
            <label className="block space-y-1.5 text-sm text-on-surface"><span>Thời lượng</span><select value={duration} onChange={event => setDuration(Number(event.target.value))} className={fieldClass}><option value={4}>4 giây</option><option value={6}>6 giây</option><option value={8}>8 giây</option></select></label>
            <label className="block space-y-1.5 text-sm text-on-surface"><span>Độ phân giải</span><select value={resolution} onChange={event => setResolution(event.target.value)} className={fieldClass}><option>720p</option><option>1080p</option></select></label>
            <label className="flex min-h-10 items-center gap-2 text-sm text-on-surface"><input type="checkbox" checked={generateAudio} onChange={event => setGenerateAudio(event.target.checked)} className="size-4 accent-primary" />Tạo âm thanh</label>
          </div>
          <div className="grid gap-2">
            <button type="button" onClick={() => void optimize()} disabled={!canUseAi || busy || prompt.trim().length < 3} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><WandSparkles className="size-4" aria-hidden="true" />Tối ưu kịch bản</button>
            <button type="submit" disabled={!canUseAi || busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}{busy ? "Đang gửi…" : "Tạo video"}</button>
          </div>
          <p className="text-center text-pretty text-xs leading-relaxed text-on-surface-variant">Tác vụ video được lưu theo dự án và có thể mất vài phút để hoàn tất.</p>
        </form>
      </aside>

      <div className="flex min-w-0 flex-col gap-6 xl:col-span-9">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-on-surface shadow-2xl">
          {latestVideo ? <video ref={videoRef} src={assetUrls[latestVideo.id]} playsInline controls className="absolute inset-0 size-full object-contain" aria-label={`Video kiến trúc của ${project.name}`} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={event => setCurrentTime(event.currentTarget.currentTime)} /> : <img src={preview} alt="Khung hình xem trước video" className="absolute inset-0 size-full object-cover opacity-60" />}
          {!latestVideo && <div className="relative z-10 flex max-w-sm flex-col items-center gap-3 px-6 text-center text-white"><span className="material-symbols-outlined text-5xl" aria-hidden="true">movie_filter</span><h3 className="text-xl font-bold">{reference ? "Ảnh đầu vào đã sẵn sàng" : "Xem trước Video"}</h3><p className="text-sm text-white/70">{latestJob ? "Tác vụ đang được xử lý. Kiểm tra tiến độ bên dưới." : "Tải ảnh khung hình đầu hoặc nhập kịch bản để bắt đầu tạo chuyển động."}</p></div>}
          {latestJob && <div className="absolute left-5 top-5 flex items-center gap-3 rounded-xl border border-white/10 bg-black/45 px-4 py-3 text-white backdrop-blur-md"><span className={`size-2 rounded-full ${latestJob.status === "completed" ? "bg-emerald-400" : latestJob.status === "failed" ? "bg-error" : "animate-pulse bg-primary"}`} /><div><p className="text-xs font-bold uppercase tracking-wider">{latestJob.status === "in_progress" ? "Đang dựng video" : latestJob.status === "pending" ? "Đang chờ" : latestJob.status === "completed" ? "Đã hoàn tất" : "Tạo video thất bại"}</p>{latestJob.error && <p className="mt-1 max-w-xs text-xs text-white/70">{latestJob.error}</p>}</div></div>}
        </div>

        <section className="space-y-5 rounded-xl bg-surface-container-lowest p-5 shadow-sm sm:p-7" aria-label="Timeline video">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><button type="button" onClick={() => seekTo(0)} disabled={!latestVideo} aria-label="Về đầu video" className="flex size-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container disabled:opacity-40"><SkipBack className="size-4" aria-hidden="true" /></button><button type="button" onClick={togglePlayback} disabled={!latestVideo} aria-label="Phát hoặc tạm dừng video" className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg disabled:opacity-40"><Play className="size-5" aria-hidden="true" /></button><button type="button" onClick={() => seekTo(videoDuration)} disabled={!latestVideo} aria-label="Tới cuối video" className="flex size-10 items-center justify-center rounded-full text-on-surface hover:bg-surface-container disabled:opacity-40"><SkipForward className="size-4" aria-hidden="true" /></button><span className="ml-2 font-mono text-sm font-semibold tabular-nums text-on-surface">{formatTime(currentTime)} / {formatTime(videoDuration)}</span></div>
            <div className="flex items-center gap-2">{latestJob && (latestJob.status === "pending" || latestJob.status === "in_progress") && <button type="button" onClick={() => void refreshJob()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-outline-variant px-4 text-xs font-bold text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"><RefreshCw className="size-4" aria-hidden="true" />Kiểm tra tiến độ</button>}{latestVideo && <a href={assetUrls[latestVideo.id]} download={latestVideo.filename} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"><Download className="size-4" aria-hidden="true" />Xuất Video</a>}</div>
          </div>
          <input aria-label="Vị trí phát video" type="range" min={0} max={Math.max(videoDuration, 1)} step={0.1} value={currentTime} onChange={event => seekTo(Number(event.target.value))} disabled={!latestVideo} className="w-full accent-primary disabled:opacity-40" />
          <div className="relative h-28 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low"><div className="flex h-full items-center gap-2 p-3">{project.renders.filter(asset => asset.kind === "render" && assetUrls[asset.id]).slice(-6).map(asset => <img key={asset.id} src={assetUrls[asset.id]} alt={`Khung tham chiếu ${asset.filename}`} className="h-full min-w-20 flex-1 rounded-md object-cover" />)}{!project.renders.some(asset => asset.kind === "render" && assetUrls[asset.id]) && <span className="px-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Timeline · {duration}s · {resolution}</span>}</div></div>
        </section>
      </div>
    </div>
  </section>;
}
