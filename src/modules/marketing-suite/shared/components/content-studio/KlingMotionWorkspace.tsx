/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useRef } from "react";
import {
  Loader2, UploadCloud, Video, Download, Play, Sparkles,
  X, Trash2, ChevronLeft, ChevronRight, Film, Volume2, VolumeX,
} from "lucide-react";
import { useProgress } from "../../hooks/use-progress";
import { geminiApi } from "../../api/gemini";
import { klingApi } from "../../api/kling";
import { toast } from "../../../../../pages/Toast";
import { getAccessToken } from "../../services/authService";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";

const KLING_MODELS = [
  { value: "kling-v2-6", label: "Kling v2.6", desc: "Ổn định, nhanh" },
  { value: "kling-v3", label: "Kling v3", desc: "Chất lượng cao nhất" },
] as const;

const MAX_VIDEO_SIZE_MB = 50;
const MAX_IMAGE_SIZE_MB = 10;

const KLING_COST_PER_SECOND: Record<string, Record<string, number>> = {
  "kling-v2-6": { std: 18, pro: 28 },
  "kling-v3":   { std: 32, pro: 43 },
};

function calcEstimatedCost(model: string, m: string, durationSec: number): number {
  const rate = KLING_COST_PER_SECOND[model]?.[m] ?? 32;
  return Math.ceil(durationSec) * rate;
}

export function KlingMotionWorkspace({
  cardId,
  onMediaSaved,
}: {
  cardId?: string;
  onMediaSaved?: (cardId: string, mediaUrl: string, type: "image" | "video" | "audio") => void;
}) {
  const [characterImage, setCharacterImage] = useState<string | null>(null);
  const [motionVideo, setMotionVideo] = useState<string | null>(null);
  const [motionVideoName, setMotionVideoName] = useState<string>("");
  const [prompt, setPrompt] = useState("");

  const [modelName, setModelName] = useState<string>("kling-v2-6");
  const [mode, setMode] = useState<"std" | "pro">("std");
  const [characterOrientation, setCharacterOrientation] = useState<"video" | "image">("video");
  const [keepOriginalSound, setKeepOriginalSound] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const historySliderRef = useRef<HTMLDivElement>(null);

  const generateProgress = useProgress(isGenerating, 120);

  const loadHistory = async (showLoading = true) => {
    if (showLoading) setIsLoadingHistory(true);
    try {
      const response = await geminiApi.getMediaHistory("video");
      const klingRecords = (response.history || []).filter(
        (r: any) => r.metadata?.provider === "kling" || String(r.url || "").startsWith("pending://kling/")
      );
      setHistory(klingRecords);
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Poll history every 5s when there are pending records
  useEffect(() => {
    const hasPending = history.some(
      (r) => r.url && (r.url.startsWith("pending://kling/") || r.metadata?.status === "processing")
    );
    if (!hasPending) return;

    const interval = setInterval(async () => {
      try {
        const response = await geminiApi.getMediaHistory("video");
        const klingRecords = (response.history || []).filter(
          (r: any) => r.metadata?.provider === "kling" || String(r.url || "").startsWith("pending://kling/")
        );
        setHistory(klingRecords);
      } catch (err) {
        console.error("[KlingMotionWorkspace] Polling error:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [history]);

  // Resolve pending URL once history has the completed record
  useEffect(() => {
    if (!generatedVideoUrl || !generatedVideoUrl.startsWith("pending://kling/")) return;

    const pendingTaskId = generatedVideoUrl.replace("pending://kling/", "");
    const matched = history.find(
      (r) => r.metadata?.piapiTaskId === pendingTaskId && r.metadata?.provider === "kling"
    );
    if (!matched) return;

    if (matched.url && !matched.url.startsWith("pending://")) {
      setGeneratedVideoUrl(matched.url);
      setIsGenerating(false);
      return;
    }

    if (matched.metadata?.status === "failed" || matched.metadata?.status === "timeout") {
      setGeneratedVideoUrl(null);
      setIsGenerating(false);
      toast.error("Tạo video motion control thất bại. Vui lòng thử lại.");
    }
  }, [generatedVideoUrl, history]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      toast.error(`Ảnh quá lớn. Giới hạn là ${MAX_IMAGE_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCharacterImage(reader.result as string);
      toast.success("Đã tải ảnh nhân vật lên!");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > MAX_VIDEO_SIZE_MB) {
      toast.error(`Video quá lớn (${sizeMB.toFixed(1)} MB). Giới hạn là ${MAX_VIDEO_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }

    // Detect duration via temporary object URL
    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.onloadedmetadata = () => {
      setVideoDuration(tempVideo.duration);
      URL.revokeObjectURL(objectUrl);
    };
    tempVideo.src = objectUrl;

    setIsUploadingVideo(true);
    setMotionVideoName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMotionVideo(reader.result as string);
      setIsUploadingVideo(false);
      toast.success("Đã tải video chuyển động lên!");
    };
    reader.onerror = () => {
      setIsUploadingVideo(false);
      toast.error("Không thể đọc file video.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDownloadVideo = async (uri?: string) => {
    const targetUri = uri || generatedVideoUrl;
    if (!targetUri) return;

    toast.info("Đang tải video về máy...");
    try {
      const fileName = `kling-motion-${Date.now()}.mp4`;
      const proxyUrl = `/api/v1/media/download?url=${encodeURIComponent(targetUri)}&filename=${encodeURIComponent(fileName)}`;
      const response = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Tải video thành công!");
    } catch {
      const link = document.createElement("a");
      link.href = targetUri;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.warning("Không thể tải trực tiếp. Video đã được mở trong tab mới.");
    }
  };

  const handleGenerate = async () => {
    if (!characterImage) {
      toast.warning("Vui lòng tải lên ảnh nhân vật tham chiếu.");
      return;
    }
    if (!motionVideo) {
      toast.warning("Vui lòng tải lên video chuyển động tham chiếu.");
      return;
    }

    setIsGenerating(true);
    setGeneratedVideoUrl(null);

    try {
      toast.success("Đang gửi lệnh tạo video Motion Control. Quá trình này có thể mất vài phút...");

      const result = await klingApi.createMotionControl({
        imageUrl: characterImage,
        videoUrl: motionVideo,
        modelName,
        mode,
        prompt: prompt.trim() || undefined,
        characterOrientation,
        keepOriginalSound,
        videoDuration: videoDuration > 0 ? videoDuration : undefined,
      });

      setGeneratedVideoUrl(result.url);

      if (!result.url.startsWith("pending://")) {
        setIsGenerating(false);
        toast.success("Tạo video Motion Control thành công!");
      } else {
        toast.success("Yêu cầu đã gửi! Đang xử lý ở chế độ nền, không cần tải lại trang.");
      }

      loadHistory(false);
    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      toast.error(`Không thể tạo video: ${e.message}`);
    }
  };

  const handleDeleteHistory = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDeleteHistory = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setIsDeletingHistory(true);
    try {
      await geminiApi.deleteMediaHistory(id);
      toast.success("Đã xóa video thành công.");
      setHistory((prev) => prev.filter((r) => r._id !== id && r.id !== id));
      const deleted = history.find((r) => r._id === id || r.id === id);
      if (deleted?.url === generatedVideoUrl) setGeneratedVideoUrl(null);
      setPendingDeleteId(null);
    } catch (e: any) {
      toast.error(`Lỗi khi xóa: ${e.message}`);
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const canGenerate = !!characterImage && !!motionVideo && !isGenerating && !isUploadingVideo;
  const focusRingClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
  const modelOptions = KLING_MODELS.map((m) => ({
    value: m.value,
    label: `${m.label} — ${m.desc}`,
  }));

  return (
    <div className="mx-auto w-full max-w-[1440px] pb-6">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">

        {/* LEFT PANEL */}
        <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 lg:col-span-5">

          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-outline-variant pb-3.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Film className="size-4" aria-hidden="true" />
            </div>
            <h2 className="text-balance text-sm font-semibold text-on-surface">Kling Motion Control</h2>
          </div>

          {/* Character Image Upload */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-on-surface">
              Ảnh nhân vật tham chiếu <span className="text-error">*</span>
            </span>
            <div className="relative flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 p-4 transition-colors duration-150 hover:border-primary hover:bg-primary/5">
              {characterImage ? (
                <div className="relative w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
                  <img
                    src={characterImage}
                    alt="Ảnh nhân vật tham chiếu"
                    className="max-h-44 w-full object-contain"
                  />
                  <button
                    type="button"
                    aria-label="Xóa ảnh nhân vật"
                    onClick={() => setCharacterImage(null)}
                    className={`absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/65 text-white transition-colors duration-150 hover:bg-black/85 cursor-pointer ${focusRingClass}`}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center py-2 text-center">
                  <span className="mb-2 inline-flex size-10 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant">
                    <UploadCloud className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-on-surface">Tải ảnh nhân vật lên</span>
                  <span className="mt-0.5 text-xs text-on-surface-variant">PNG, JPG, WebP · tối đa {MAX_IMAGE_SIZE_MB} MB</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          </div>

          {/* Motion Video Upload */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-on-surface">
                Video chuyển động mẫu <span className="text-error">*</span>
              </span>
              <span className="text-xs text-on-surface-variant">Tối đa {MAX_VIDEO_SIZE_MB} MB · MP4 / MOV</span>
            </div>
            <div className="relative flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 p-4 transition-colors duration-150 hover:border-primary hover:bg-primary/5">
              {isUploadingVideo ? (
                <div role="status" className="flex flex-col items-center gap-2 text-on-surface-variant">
                  <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                  <span className="text-sm font-medium">Đang đọc tệp video…</span>
                </div>
              ) : motionVideo ? (
                <div className="flex w-full items-center gap-3 rounded-lg border border-primary/25 bg-primary/10 p-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary">
                    <Film className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">{motionVideoName || "video_motion.mp4"}</p>
                    <p className="text-xs font-medium text-primary">
                      Sẵn sàng{videoDuration > 0 ? ` · ${videoDuration.toFixed(1)} giây` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Xóa video chuyển động mẫu"
                    onClick={() => { setMotionVideo(null); setMotionVideoName(""); setVideoDuration(0); }}
                    className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:text-on-surface cursor-pointer ${focusRingClass}`}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center py-2 text-center">
                  <span className="mb-2 inline-flex size-10 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant">
                    <UploadCloud className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-on-surface">Tải video chuyển động lên</span>
                  <span className="mt-0.5 text-pretty text-xs text-on-surface-variant">
                    Nhân vật trong video cần luôn hiển thị, 1 cảnh liên tục
                  </span>
                  <input type="file" accept="video/mp4,video/mov,video/quicktime" className="sr-only" onChange={handleVideoUpload} />
                </label>
              )}
            </div>
          </div>

          {/* Prompt (optional) */}
          <div className="flex flex-col gap-1.5 border-t border-outline-variant pt-4">
            <label htmlFor="kling-motion-prompt" className="text-sm font-medium text-on-surface">
              Mô tả thêm <span className="font-normal text-on-surface-variant">(tùy chọn)</span>
            </label>
            <textarea
              id="kling-motion-prompt"
              rows={3}
              placeholder="Ví dụ: nhân vật đang nhảy điệu samba trên sân khấu ngoài trời…"
              className="w-full min-h-20 resize-none rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm leading-relaxed text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              maxLength={2500}
            />
          </div>

          {/* Settings */}
          <div className="flex flex-col gap-3.5 border-t border-outline-variant pt-4">
            {/* Model */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-on-surface">Phiên bản mô hình</span>
              <StyledSelect
                appearance="erp"
                ariaLabel="Phiên bản mô hình"
                value={modelName}
                onChange={setModelName}
                disabled={isGenerating}
                options={modelOptions}
                className="h-10 rounded-md"
                menuClassName="rounded-md [&_[role=option]]:rounded-sm"
              />
            </div>

            {/* Mode */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-on-surface">Chất lượng xuất</span>
              <div role="group" aria-label="Chất lượng xuất" className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={mode === "std"}
                  onClick={() => setMode("std")}
                  disabled={isGenerating}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium tabular-nums transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                    mode === "std"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  Standard · 720p
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "pro"}
                  onClick={() => setMode("pro")}
                  disabled={isGenerating}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium tabular-nums transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                    mode === "pro"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  Pro · 1080p
                </button>
              </div>
            </div>

            {/* Character Orientation */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-on-surface">Hướng nhân vật</span>
                <span className="text-xs tabular-nums text-on-surface-variant">
                  {characterOrientation === "video" ? "Tối đa 30 giây" : "Tối đa 10 giây"}
                </span>
              </div>
              <div role="group" aria-label="Hướng nhân vật" className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={characterOrientation === "video"}
                  onClick={() => setCharacterOrientation("video")}
                  disabled={isGenerating}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                    characterOrientation === "video"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  Theo video
                </button>
                <button
                  type="button"
                  aria-pressed={characterOrientation === "image"}
                  onClick={() => setCharacterOrientation("image")}
                  disabled={isGenerating}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                    characterOrientation === "image"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  Theo ảnh
                </button>
              </div>
              <p className="text-pretty text-xs leading-relaxed text-on-surface-variant">
                {characterOrientation === "video"
                  ? "Nhân vật theo hướng trong video mẫu — phù hợp chuyển động phức tạp."
                  : "Nhân vật giữ hướng từ ảnh gốc — phù hợp chuyển động camera."}
              </p>
            </div>

            {/* Keep Original Sound */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-low/60 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                {keepOriginalSound ? (
                  <Volume2 className="size-4 text-primary" aria-hidden="true" />
                ) : (
                  <VolumeX className="size-4 text-on-surface-variant" aria-hidden="true" />
                )}
                <span className="text-sm font-medium text-on-surface">Giữ âm thanh gốc từ video</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={keepOriginalSound}
                aria-label="Giữ âm thanh gốc từ video"
                onClick={() => setKeepOriginalSound(!keepOriginalSound)}
                disabled={isGenerating}
                className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-150 cursor-pointer ${focusRingClass} ${
                  keepOriginalSound ? "bg-primary" : "bg-outline-variant"
                }`}
              >
                <span
                  className={`inline-block size-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${
                    keepOriginalSound ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Estimated Cost */}
          {videoDuration > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-xs tabular-nums">
              <span className="text-on-surface-variant">
                Ước tính phí · {videoDuration.toFixed(1)}s × {KLING_COST_PER_SECOND[modelName]?.[mode] ?? 32} credits/s
              </span>
              <span className="font-semibold text-primary">
                {calcEstimatedCost(modelName, mode, videoDuration).toLocaleString()} credits
              </span>
            </div>
          )}

          {/* Generate Button */}
          <div className="border-t border-outline-variant pt-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${focusRingClass}`}
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {isGenerating ? "Đang tạo video…" : "Tạo video chuyển động"}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex flex-col gap-5 lg:col-span-7">

          {/* Preview Card */}
          <section
            aria-label="Khung xem trước video chuyển động"
            aria-busy={isGenerating}
            className="flex min-h-[420px] flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3">
              <h2 className="text-balance text-sm font-semibold text-on-surface">Khung xem trước</h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-on-surface-variant">
                <span className="rounded-md bg-surface-container-low px-2 py-0.5">
                  {KLING_MODELS.find((m) => m.value === modelName)?.label || modelName}
                </span>
                <span className="rounded-md bg-surface-container-low px-2 py-0.5">
                  {mode === "pro" ? "1080p" : "720p"}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center">
              {isGenerating && !generatedVideoUrl ? (
                <div role="status" className="flex flex-col items-center gap-3 p-8 text-center">
                  <Loader2 className="size-9 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums text-on-surface">
                      Đang dựng Motion Control ({generateProgress}%)…
                    </span>
                    <span className="text-pretty text-xs text-on-surface-variant">
                      Kling AI đang tổng hợp chuyển động, quá trình này có thể mất vài phút.
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-56 overflow-hidden rounded-full bg-surface-container-high">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${generateProgress}%` }}
                    />
                  </div>
                </div>
              ) : generatedVideoUrl ? (
                <div className="flex w-full flex-col gap-3">
                  <div className="relative flex aspect-video max-h-[400px] w-full items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-black">
                    {generatedVideoUrl.startsWith("pending://kling/") ? (() => {
                      const taskId = generatedVideoUrl.replace("pending://kling/", "");
                      const matched = history.find((r) => r.metadata?.piapiTaskId === taskId);
                      const progressVal = matched?.metadata?.progress;
                      return (
                        <div role="status" className="flex size-full flex-col items-center justify-center bg-surface-container-low p-6 text-center">
                          <Loader2 className="mb-3 size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                          <span className="text-sm font-semibold text-on-surface">Video đang được dựng…</span>
                          {progressVal !== undefined && (
                            <div className="mt-2.5 flex w-52 flex-col items-center gap-1.5">
                              <span className="text-xs font-medium tabular-nums text-primary">Tiến độ: {progressVal}%</span>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${progressVal}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <span className="mt-2 text-pretty text-xs text-on-surface-variant">
                            Hệ thống đang xử lý ở chế độ nền, không cần tải lại trang.
                          </span>
                        </div>
                      );
                    })() : (
                      <video
                        src={generatedVideoUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        crossOrigin="anonymous"
                        className="size-full object-contain"
                      />
                    )}
                  </div>

                  {!generatedVideoUrl.startsWith("pending://kling/") && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDownloadVideo()}
                        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors duration-150 hover:bg-surface-container-low cursor-pointer ${focusRingClass}`}
                      >
                        <Download className="size-4" aria-hidden="true" />
                        Tải video
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex w-full flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-12 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Film className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-balance text-sm font-semibold text-on-surface">Motion Control sẵn sàng</h3>
                  <p className="mt-1 max-w-sm text-pretty text-sm text-on-surface-variant">
                    Tải ảnh nhân vật và video chuyển động mẫu ở cột bên trái để bắt đầu.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* History Card */}
          <section
            aria-label="Lịch sử Motion Control"
            className="flex flex-col gap-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="flex items-center justify-between gap-2 border-b border-outline-variant pb-3">
              <h2 className="text-balance text-sm font-semibold text-on-surface">Lịch sử Motion Control</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary">
                {history.slice(0, 20).length}/20
              </span>
            </div>

            {isLoadingHistory ? (
              <div role="status" className="flex flex-col items-center justify-center gap-2 py-8 text-on-surface-variant">
                <Loader2 className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                <span className="text-xs">Đang tải lịch sử…</span>
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 py-8 text-center">
                <Video className="size-5 text-on-surface-variant" aria-hidden="true" />
                <span className="text-sm text-on-surface-variant">Chưa có video chuyển động nào</span>
              </div>
            ) : (
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Cuộn lịch sử sang trái"
                  onClick={() => {
                    if (historySliderRef.current) historySliderRef.current.scrollLeft -= 220;
                  }}
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>

                <div
                  ref={historySliderRef}
                  id="kling_history_slider"
                  className="flex flex-1 gap-3 overflow-x-auto pb-1 scroll-smooth"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {history.slice(0, 20).map((record, index) => {
                    const id = record._id || record.id;
                    const isActive = generatedVideoUrl === record.url;
                    const isPending =
                      !record.url ||
                      record.url.startsWith("pending://") ||
                      record.metadata?.status === "processing";
                    const label = `MC ${history.length - index}`;

                    return (
                      <div
                        key={id}
                        className={`group/item relative aspect-[16/10] w-36 shrink-0 overflow-hidden rounded-lg border-2 bg-black transition-colors duration-150 ${
                          isActive ? "border-primary" : "border-outline-variant hover:border-outline"
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isPending}
                          aria-label={`Xem ${label}`}
                          onClick={() => !isPending && setGeneratedVideoUrl(record.url)}
                          className={`block size-full text-left ${!isPending ? "cursor-pointer" : "cursor-default"} ${focusRingClass}`}
                        >
                          {!isPending && record.url ? (
                            <video
                              src={record.url}
                              className="size-full object-cover"
                              muted
                              preload="metadata"
                              playsInline
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="flex size-full flex-col items-center justify-center bg-surface-container-low p-2 text-center text-xs font-medium text-primary">
                              <Loader2 className="mb-1 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                              <span className="tabular-nums">
                                Đang dựng{record.metadata?.progress !== undefined ? ` ${record.metadata.progress}%` : ""}
                              </span>
                            </div>
                          )}

                          {!isPending && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-80 transition-opacity duration-150 group-hover/item:opacity-100">
                              <span className="flex size-7 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xs">
                                <Play className="ml-0.5 size-3 fill-current" aria-hidden="true" />
                              </span>
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          aria-label={`Xóa ${label} khỏi lịch sử`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistory(id);
                          }}
                          className={`absolute right-1.5 top-1.5 z-10 inline-flex size-6 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity duration-150 hover:bg-error focus-visible:opacity-100 group-hover/item:opacity-100 cursor-pointer ${focusRingClass}`}
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>

                        <div className="pointer-events-none absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
                          <span className="truncate">{label}</span>
                          <span>Kling</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  aria-label="Cuộn lịch sử sang phải"
                  onClick={() => {
                    if (historySliderRef.current) historySliderRef.current.scrollLeft += 220;
                  }}
                  className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        appearance="erp"
        isOpen={Boolean(pendingDeleteId)}
        isSubmitting={isDeletingHistory}
        title="Xóa video khỏi lịch sử"
        description="Bạn có chắc chắn muốn xóa video này khỏi lịch sử Motion Control?"
        confirmLabel="Xóa video"
        cancelLabel="Hủy"
        tone="danger"
        onClose={() => {
          if (!isDeletingHistory) setPendingDeleteId(null);
        }}
        onConfirm={confirmDeleteHistory}
      />
    </div>
  );
}
