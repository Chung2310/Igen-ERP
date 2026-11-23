/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, PointerEvent } from "react";
import { Pause, Play, Plus, Volume2 } from "lucide-react";
import { HEYGEN_THEME } from "./heygenTheme";
import { HeyGenLegacyScriptInput } from "./HeyGenLegacyScriptInput";

interface HeyGenVideoPreviewProps {
  selectedAvatar?: any;
  script: string;
  onScriptChange?: (val: string) => void;
  selectedAvatarModel?: string;
  usePersonalVoiceMode?: boolean;
  enableCaption: boolean;
  setEnableCaption: (value: boolean) => void;
  captionPreset?: "brand" | "clean" | "outline" | "highlight";
  captionFontFamily?: string;
  captionFontSize?: number;
  captionPrimaryColor?: string;
  captionSecondaryColor?: string;
  captionPosition?: "top" | "middle" | "bottom";
  captionOffset: { x: number; y: number };
  setCaptionOffset: (value: { x: number; y: number }) => void;
  avatarLayout: "original" | "circle";
  avatarBackground: "customize" | "remove" | "color";
  backgroundColor: string;
  previewVideoUrl?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1";
}

const MOCK_DURATION = 15;
const CAPTION_MAX_WORDS = 5;
const CAPTION_BREAK_PATTERN = /[,.!?;:]\s+/;

function isRenderableVideoUrl(url?: string | null) {
  const value = String(url || "").trim();
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:video/")
  );
}

export function HeyGenVideoPreview({
  selectedAvatar,
  script,
  onScriptChange,
  selectedAvatarModel,
  usePersonalVoiceMode = false,
  enableCaption,
  setEnableCaption,
  captionPreset = "brand",
  captionFontFamily = "Georgia, serif",
  captionFontSize = 28,
  captionPrimaryColor = "#9bff4f",
  captionSecondaryColor = "#ffffff",
  captionPosition = "bottom",
  captionOffset,
  setCaptionOffset,
  avatarLayout,
  avatarBackground,
  backgroundColor,
  previewVideoUrl,
  aspectRatio = "16:9",
}: HeyGenVideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const renderablePreviewVideoUrl = isRenderableVideoUrl(previewVideoUrl) ? previewVideoUrl : "";
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(80);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  const avatarImage = selectedAvatar?.previewImage;
  const avatarName = selectedAvatar?.name || "Avatar preview";
  const mediaFitClass = avatarLayout === "circle" ? "object-cover" : "object-contain";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewVideoUrl) return;
    video.volume = volume / 100;
    video.playbackRate = playbackSpeed;
  }, [previewVideoUrl, volume, playbackSpeed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewVideoUrl) return;
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [previewVideoUrl]);

  useEffect(() => {
    if (previewVideoUrl || !isPlaying) return;
    const interval = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.1 * playbackSpeed;
        if (next >= MOCK_DURATION) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [isPlaying, playbackSpeed, previewVideoUrl]);

  const sentences = useMemo(() => {
    if (!script.trim()) return [];

    return script
      .split(CAPTION_BREAK_PATTERN)
      .flatMap((segment) => {
        const words = segment.trim().split(/\s+/).filter(Boolean);
        if (!words.length) return [];

        const chunks: string[] = [];
        for (let index = 0; index < words.length; index += CAPTION_MAX_WORDS) {
          chunks.push(words.slice(index, index + CAPTION_MAX_WORDS).join(" "));
        }
        return chunks;
      })
      .filter(Boolean);
  }, [script]);

  const currentCaption = useMemo(() => {
    if (!enableCaption || sentences.length === 0) return "";
    const activeIndex = Math.min(sentences.length - 1, Math.floor((currentTime / MOCK_DURATION) * sentences.length));
    return sentences[activeIndex];
  }, [currentTime, enableCaption, sentences]);

  const backgroundClass = avatarBackground === "remove" ? "bg-transparent" : avatarBackground === "color" ? "" : "bg-[radial-gradient(circle_at_center,#253140_0%,#161d27_52%,#0c1117_100%)]";
  function togglePlayback() {
    setIsPlaying((prev) => !prev);
    const video = videoRef.current;
    if (!video || !previewVideoUrl) return;
    if (isPlaying) {
      video.pause();
      return;
    }
    void video.play().catch((error) => console.error("Video playback failed", error));
  }

  function formatTime(time: number) {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function renderCaption(captionText: string) {
    const baseStyle: CSSProperties = { fontFamily: captionFontFamily, fontSize: `${captionFontSize}px`, lineHeight: 1.15 };
    if (captionPreset === "clean") {
      return <span style={{ ...baseStyle, color: "#3f3f46", backgroundColor: "rgba(255,255,255,0.92)", padding: "10px 16px", borderRadius: "10px", fontWeight: 500 }}>{captionText}</span>;
    }
    if (captionPreset === "outline") {
      return <span style={{ ...baseStyle, color: captionSecondaryColor, fontWeight: 800, textTransform: "uppercase", textShadow: "-1px -1px 0 #111827, 1px -1px 0 #111827, -1px 1px 0 #111827, 1px 1px 0 #111827, 0 0 12px rgba(0,0,0,0.16)" }}>{captionText}</span>;
    }
    if (captionPreset === "highlight") {
      return <span style={{ ...baseStyle, color: "#111827", background: "linear-gradient(90deg, rgba(56,189,248,0.95) 0%, rgba(255,255,255,0.92) 45%, rgba(255,255,255,0.92) 100%)", padding: "8px 14px", borderRadius: "6px", fontWeight: 700 }}>{captionText}</span>;
    }

    const words = captionText.split(" ");
    const splitIndex = Math.max(1, Math.ceil(words.length / 2));
    return (
      <span style={{ ...baseStyle, color: captionSecondaryColor, fontWeight: 800, fontStyle: "italic", textShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
        <span style={{ color: captionPrimaryColor }}>{words.slice(0, splitIndex).join(" ")}</span>{" "}
        <span style={{ color: captionSecondaryColor }}>{words.slice(splitIndex).join(" ")}</span>
      </span>
    );
  }

  function handleCaptionPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!stageRef.current) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: captionOffset.x,
      startOffsetY: captionOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCaptionPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!stageRef.current || !dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) return;
    const rect = stageRef.current.getBoundingClientRect();
    const deltaXPercent = ((event.clientX - dragStateRef.current.startX) / rect.width) * 100;
    const deltaYPercent = ((event.clientY - dragStateRef.current.startY) / rect.height) * 100;
    setCaptionOffset({
      x: Math.max(12, Math.min(88, dragStateRef.current.startOffsetX + deltaXPercent)),
      y: Math.max(10, Math.min(92, dragStateRef.current.startOffsetY + deltaYPercent)),
    });
  }

  function handleCaptionPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePreviewDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes("application/x-heygen-caption")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    }
  }

  function handlePreviewDrop(event: DragEvent<HTMLDivElement>) {
    if (!stageRef.current || !event.dataTransfer.types.includes("application/x-heygen-caption")) return;
    event.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setEnableCaption(true);
    setCaptionOffset({
      x: Math.max(12, Math.min(88, x)),
      y: Math.max(10, Math.min(92, y)),
    });
  }

  const aspectClass =
    aspectRatio === "9:16"
      ? "aspect-[9/16] max-w-[280px]"
      : aspectRatio === "1:1"
      ? "aspect-square max-w-[420px]"
      : "aspect-[16/9] max-w-[920px]";

  const scriptInputTitle = selectedAvatarModel === "Avatar III"
    ? "Kịch bản phát thanh (Avatar III)"
    : usePersonalVoiceMode
      ? `Kịch bản text-to-voice (${selectedAvatarModel || "HeyGen"})`
      : "Kịch bản phát thanh";

  const scriptInputPlaceholder = usePersonalVoiceMode
    ? "Nhập nội dung văn bản để HeyGen My Voice đọc trực tiếp..."
    : "Nhập nội dung văn bản để avatar phát biểu...";

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${HEYGEN_THEME.surface} text-on-surface`}>
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-surface-container-low/60 px-4 py-3">
        <div
          ref={stageRef}
          onDragOver={handlePreviewDragOver}
          onDrop={handlePreviewDrop}
          className={`relative ${aspectClass} h-full max-h-[420px] w-full overflow-hidden rounded-xl border ${HEYGEN_THEME.border} bg-slate-950 transition-all duration-150`}
        >
          {renderablePreviewVideoUrl ? (
            <video
              ref={videoRef}
              src={renderablePreviewVideoUrl}
              className={`size-full ${mediaFitClass} bg-transparent`}
              style={{ objectPosition: "center top" }}
              onClick={togglePlayback}
              playsInline
              crossOrigin="anonymous"
            />
          ) : (
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${backgroundClass}`} style={{ backgroundColor: avatarBackground === "color" ? backgroundColor : undefined }}>
              {avatarImage ? (
                <div className={`relative overflow-hidden transition-all duration-150 ${avatarLayout === "circle" ? "size-36 rounded-full border-4 border-primary/50" : "size-full"}`}>
                  <img src={avatarImage} alt={avatarName} loading="eager" decoding="async" className={`size-full ${mediaFitClass} bg-transparent`} style={{ objectPosition: "center top" }} />
                </div>
              ) : (
                <div className="text-sm font-medium text-white/80">Chọn avatar để xem trước</div>
              )}
            </div>
          )}

          {enableCaption && currentCaption ? (
            <div
              role="button"
              tabIndex={0}
              onPointerDown={handleCaptionPointerDown}
              onPointerMove={handleCaptionPointerMove}
              onPointerUp={handleCaptionPointerUp}
              onPointerCancel={handleCaptionPointerUp}
              className="absolute z-20 w-[82%] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none text-center active:cursor-grabbing"
              style={{ left: `${captionOffset.x}%`, top: `${captionOffset.y}%` }}
              title="Kéo thả phụ đề"
            >
              <div className="rounded-lg border border-primary/50 bg-black/30 px-3 py-2 backdrop-blur-[1px]">
                {renderCaption(currentCaption)}
              </div>
            </div>
          ) : null}
          {!previewVideoUrl ? (
            <div className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white/90">
              Xem trước
            </div>
          ) : null}
        </div>
      </div>

      <div className={`flex items-center justify-between border-t ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-4 py-2.5`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={isPlaying ? "Tạm dừng" : "Phát xem trước"}
            onClick={togglePlayback}
            className="flex size-9 items-center justify-center rounded-full bg-primary text-on-primary transition-colors duration-150 hover:bg-primary/90 cursor-pointer"
          >
            {isPlaying ? <Pause className="size-4 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />}
          </button>
          <span className="font-sans text-xs font-medium tabular-nums text-on-surface-variant">{formatTime(currentTime)} / {formatTime(MOCK_DURATION)}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="heygen-playback-speed" className="text-xs font-medium text-on-surface-variant">Tốc độ</label>
            <select
              id="heygen-playback-speed"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className={`h-8 rounded-md border ${HEYGEN_THEME.border} bg-surface-container-lowest px-2 text-xs font-medium text-on-surface focus:border-primary focus:outline-none`}
            >
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="size-4 text-on-surface-variant" aria-hidden="true" />
            <input
              type="range"
              aria-label="Âm lượng xem trước"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value, 10))}
              className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-outline-variant accent-primary"
            />
          </div>
        </div>
      </div>
      
      {selectedAvatarModel === "Avatar III" || usePersonalVoiceMode ? (
        <HeyGenLegacyScriptInput
          value={script}
          onChange={onScriptChange || (() => {})}
          title={scriptInputTitle}
          placeholder={scriptInputPlaceholder}
        />
      ) : null}

      <div className={`space-y-2 border-t ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-3`}>
        <h4 className="text-xs font-medium text-on-surface-variant">Các phân cảnh</h4>
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          <div className={`relative flex h-20 w-36 shrink-0 flex-col overflow-hidden rounded-lg border-2 border-primary ${HEYGEN_THEME.surface}`}>
            {avatarImage ? (
              <img src={avatarImage} alt="Ảnh phân cảnh" loading="lazy" decoding="async" className="h-13 w-full bg-surface-container-lowest object-contain" style={{ objectPosition: "center top" }} />
            ) : (
              <div className="flex h-13 w-full items-center justify-center bg-surface-container-low text-xs text-on-surface-variant">Chưa chọn avatar</div>
            )}
            <div className={`flex flex-1 items-center justify-between px-2.5 text-xs font-medium tabular-nums text-on-surface-variant ${HEYGEN_THEME.surfaceMuted}`}>
              <span>Phân cảnh 1</span>
              <span>{MOCK_DURATION}s</span>
            </div>
          </div>

          <button type="button" className={`flex h-20 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-on-surface-variant transition-colors duration-150 hover:border-primary hover:bg-surface-container-lowest hover:text-primary cursor-pointer`}>
            <Plus className="size-4" aria-hidden="true" />
            <span className="text-xs font-medium">Thêm cảnh</span>
          </button>
        </div>
      </div>
    </div>
  );
}
