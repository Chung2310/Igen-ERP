import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  ExternalLink,
  Lightbulb,
  LoaderCircle,
  MonitorPlay,
  Pencil,
  Play,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { elevenlabsApi } from "../../api/elevenlabs";
import { type HeyGenLibraryItem, heygenApi } from "../../api/heygen";

type ElevenLabsAudioRecord = {
  _id: string;
  url: string;
  prompt?: string;
  createdAt?: string;
  metadata?: {
    title?: string;
    voiceName?: string;
    duration?: number;
  };
};

const HEYGEN_MODEL_OPTIONS = [
  {
    id: "Avatar V",
    description: "Chuyen dong tu nhien theo noi dung.",
    icon: "V",
    engineType: "avatar_v" as const,
  },
  {
    id: "Avatar IV",
    description: "Chuyen dong tieu chuan, de dung.",
    icon: "IV",
    engineType: "avatar_iv" as const,
  },
] as const;

const TEMPLATE_OPTIONS = ["Gioi thieu san pham", "Quang cao mang xa hoi", "Video nguoi noi", "Video dao tao"];
const ASPECT_OPTIONS = ["16:9", "9:16", "1:1"] as const;
const RESOLUTION_OPTIONS = ["720p", "1080p"] as const;
const TERMINAL_JOB_STATES = new Set(["completed", "failed", "error", "canceled"]);
const HISTORY_PAGE_SIZE = 6;
const HEYGEN_FALLBACK_POLL_DELAYS = [8000, 20000] as const;

function usePseudoProgress(createdAt?: string, status?: string) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const isCompleted = String(status || "").toLowerCase() === "completed";
    const isFailed = ["failed", "error", "canceled"].includes(String(status || "").toLowerCase());
    
    if (isCompleted) {
      setProgress(100);
      return;
    }
    if (isFailed) {
      setProgress(0);
      return;
    }

    const calculateProgress = () => {
      if (!createdAt) return 0;
      const elapsedMs = Date.now() - new Date(createdAt).getTime();
      const elapsedSec = elapsedMs / 1000;
      
      let p = 0;
      if (elapsedSec <= 10) {
        p = 10;
      } else if (elapsedSec <= 30) {
        p = 10 + (elapsedSec - 10) * 1.5;
      } else if (elapsedSec <= 60) {
        p = 40 + (elapsedSec - 30) * 1.0;
      } else if (elapsedSec <= 120) {
        p = 70 + (elapsedSec - 60) * 0.3;
      } else {
        p = 88 + (elapsedSec - 120) * 0.1;
      }
      return Math.min(95, Math.round(p));
    };

    setProgress(calculateProgress());

    const interval = setInterval(() => {
      setProgress(calculateProgress());
    }, 1000);

    return () => clearInterval(interval);
  }, [createdAt, status]);

  return progress;
}

function HeyGenVideoItem({
  item,
  onPlay,
  onReuse,
  onDelete,
  onStatusUpdate,
}: {
  key?: any;
  item: any;
  onPlay: (url: string) => void;
  onReuse: (item: any) => void;
  onDelete: (videoId: string) => void | Promise<void>;
  onStatusUpdate?: (updatedItem: any) => void;
}) {
  const status = String(item.status || "").toLowerCase();
  const isCompleted = status === "completed";
  const isFailed = ["failed", "error", "canceled"].includes(status);
  const isProcessing = !isCompleted && !isFailed;

  const pseudoProgress = usePseudoProgress(item.createdAt, item.status);

  useEffect(() => {
    if (!isProcessing || !item.videoId) return;

    const interval = setInterval(async () => {
      try {
        const res = await heygenApi.getVideoStatus(item.videoId, {
          avatarId: item.metadata?.heygenAvatarId,
          audioRecordId: item.metadata?.heygenAudioRecordId,
          audioUrl: item.metadata?.heygenAudioUrl,
          script: item.prompt,
          aspectRatio: item.metadata?.aspectRatio,
          title: item.metadata?.title,
          description: item.metadata?.description,
        });

        const nextStatus = String(res.jobStatus || "processing").toLowerCase();
        if (nextStatus !== status && onStatusUpdate) {
          const updatedRecord = {
            ...item,
            status: nextStatus,
            url: res.videoUrl || item.url,
            thumbnailUrl: res.thumbnailUrl || item.thumbnailUrl,
            metadata: {
              ...item.metadata,
              status: nextStatus,
            },
          };
          onStatusUpdate(updatedRecord);
        }
      } catch (err) {
        console.error("Failed to poll video status:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isProcessing, item.videoId, status, onStatusUpdate]);

  const downloadUrl = useMemo(() => {
    if (!isCompleted) return "";
    const url = item.url || item.captionedVideoUrl || item.videoPageUrl || "";
    if (url.startsWith("pending://") || !url.startsWith("http")) {
      return "";
    }
    return url;
  }, [item, isCompleted]);

  const canPlay = Boolean(downloadUrl);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,560px)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_center,#dde7f2_0%,#cddaea_60%,#bfd0e6_100%)]">
          {item.thumbnailUrl ? (
            <img src={item.thumbnailUrl} alt={item.title || item.prompt || "HeyGen video"} className="absolute inset-0 z-10 h-full w-full object-cover" />
          ) : downloadUrl ? (
            <video src={downloadUrl} className="absolute inset-0 z-10 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 p-4 text-center text-cyan-400">
              {isFailed ? (
                <div className="text-rose-400 font-semibold text-xs">Thất bại</div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <LoaderCircle className="h-6 w-6 animate-spin text-cyan-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">Đang xử lý</span>
                  <span className="text-xs font-mono text-cyan-300/80">{pseudoProgress}%</span>
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-cyan-400 transition-all duration-1000" style={{ width: `${pseudoProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {isCompleted && canPlay && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <button
                type="button"
                onClick={() => onPlay(downloadUrl)}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-slate-950/35 text-white backdrop-blur-sm transition hover:scale-105 hover:bg-slate-950/50"
              >
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              </button>
            </div>
          )}

          {isProcessing && !item.thumbnailUrl && (
            <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center">
              <span className="rounded-full bg-slate-950/70 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 backdrop-blur-xs">
                Đang render ({pseudoProgress}%)
              </span>
            </div>
          )}

          {isCompleted && (
            <div className="absolute bottom-3 right-3 z-20 rounded-lg bg-slate-950/65 px-2.5 py-1 text-xs font-semibold text-white">
              {item.duration ? `${Math.max(1, Math.round(item.duration))}s` : "Video"}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-between py-2">
        <div>
          <p className="line-clamp-3 text-2xl leading-tight text-slate-900">{item.prompt}</p>
          <p className="mt-5 text-sm text-slate-500 flex items-center gap-2">
            <span>{item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "Chưa có video"}</span>
            <span>·</span>
            <span>{item.model || "Avatar V"}</span>
            <span>·</span>
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
              isCompleted 
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10' 
                : isFailed 
                ? 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/10' 
                : 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-600/10'
            }`}>
              {status === 'processing' ? 'Đang xử lý' : status === 'completed' ? 'Hoàn thành' : status === 'failed' ? 'Thất bại' : status}
            </span>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <ActionCircle onClick={() => onReuse(item)}>
              <Pencil className="h-4 w-4" />
            </ActionCircle>
            {canPlay ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                download={item.title || "heygen-video"}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                title="Tải video"
              >
                <Download className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-300"
                title="Video chưa sẵn sàng để tải"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onDelete(item.videoId || item.id || item._id)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onReuse(item)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function HeyGenWorkspace({ initialPrompt }: { initialPrompt?: string }) {
  const [avatars, setAvatars] = useState<HeyGenLibraryItem[]>([]);
  const [audioRecords, setAudioRecords] = useState<ElevenLabsAudioRecord[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [selectedAudioRecordId, setSelectedAudioRecordId] = useState("");
  const [selectedAvatarModel, setSelectedAvatarModel] = useState(HEYGEN_MODEL_OPTIONS[0].id);
  const [aspectRatio, setAspectRatio] = useState<(typeof ASPECT_OPTIONS)[number]>("16:9");
  const [template, setTemplate] = useState(TEMPLATE_OPTIONS[0]);
  const [resolution, setResolution] = useState<(typeof RESOLUTION_OPTIONS)[number]>("720p");
  const [script, setScript] = useState(initialPrompt || "");
  const [motionText, setMotionText] = useState("");
  const [isMotionOpen, setIsMotionOpen] = useState(false);
  const [isMotionExpressive, setIsMotionExpressive] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isLoadingAudioHistory, setIsLoadingAudioHistory] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [jobVideoId, setJobVideoId] = useState<string>("");
  const [jobVideoUrl, setJobVideoUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");

  const selectedAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) || avatars[0] || null,
    [avatars, selectedAvatarId]
  );
  const selectedAudio = useMemo(
    () => audioRecords.find((record) => record._id === selectedAudioRecordId) || audioRecords[0] || null,
    [audioRecords, selectedAudioRecordId]
  );
  const selectedModel = useMemo(
    () => HEYGEN_MODEL_OPTIONS.find((item) => item.id === selectedAvatarModel) || HEYGEN_MODEL_OPTIONS[0],
    [selectedAvatarModel]
  );
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = history.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  useEffect(() => {
    void loadWorkspaceData();
  }, []);

  useEffect(() => {
    setHistoryPage(1);
  }, [history.length]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  useEffect(() => {
    const hasActiveJobs = history.some((item) => {
      const status = String(item.status || "").toLowerCase();
      return !["completed", "failed", "error", "canceled"].includes(status);
    });

    if (!hasActiveJobs) return;

    const interval = setInterval(async () => {
      try {
        const historyRes = await heygenApi.getVideoHistory();
        setHistory(historyRes.history || []);
      } catch (err) {
        console.error("Failed to poll video history:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [history]);

  async function loadWorkspaceData() {
    setIsLoadingLibrary(true);
    setErrorMessage("");
    try {
      const [libraryResult, historyResult, audioResult] = await Promise.allSettled([
        heygenApi.getLibrary(),
        heygenApi.getVideoHistory(),
        elevenlabsApi.getVoiceHistory(),
      ]);

      if (libraryResult.status === "fulfilled") {
        const nextAvatars = libraryResult.value.avatars || [];
        const defaultAvatarId = libraryResult.value.defaults?.avatarId || "";

        setAvatars(nextAvatars);
        setWarnings(libraryResult.value.warnings || []);
        setSelectedAvatarId((current) => {
          if (current && nextAvatars.some((avatar) => avatar.id === current)) {
            return current;
          }
          if (defaultAvatarId && nextAvatars.some((avatar) => avatar.id === defaultAvatarId)) {
            return defaultAvatarId;
          }
          return nextAvatars[0]?.id || "";
        });
      } else {
        setErrorMessage(libraryResult.reason?.message || "Khong the tai thu vien HeyGen");
      }

      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value.history || []);
      } else if (libraryResult.status === "fulfilled") {
        setErrorMessage(historyResult.reason?.message || "Khong the tai lich su HeyGen");
      }

      if (audioResult.status === "fulfilled") {
        const records = (audioResult.value.history || []).filter((item: ElevenLabsAudioRecord) => Boolean(item?._id && item?.url));
        setAudioRecords(records);
        setSelectedAudioRecordId((current) => {
          if (current && records.some((item) => item._id === current)) {
            return current;
          }
          return records[0]?._id || "";
        });
      } else if (!errorMessage) {
        setErrorMessage(audioResult.reason?.message || "Khong the tai lich su audio ElevenLabs");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Khong the tai du lieu HeyGen");
    } finally {
      setIsLoadingLibrary(false);
      setIsLoadingAudioHistory(false);
    }
  }

  async function pollVideoStatus(videoId: string, payload: {
    avatarId: string;
    audioRecordId: string;
    audioUrl?: string;
    script?: string;
    motionText?: string;
    aspectRatio: string;
    title: string;
    description: string;
  }) {
    for (const delay of HEYGEN_FALLBACK_POLL_DELAYS) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const status = await heygenApi.getVideoStatus(videoId, payload);
      const nextStatus = String(status.jobStatus || "processing").toLowerCase();

      setJobStatus(nextStatus);
      if (status.videoUrl) {
        setJobVideoUrl(status.videoUrl);
      }

      if (TERMINAL_JOB_STATES.has(nextStatus)) {
        if (nextStatus !== "completed" && status.error) {
          setErrorMessage(status.error);
        }
        return status;
      }
    }

    setJobStatus("processing");
    return null;
  }

  async function handleGenerate() {
    if (!selectedAvatarId || !selectedAudioRecordId) {
      setErrorMessage("Vui long chon avatar va audio ElevenLabs truoc khi tao video.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");
    setJobStatus("processing");
    setJobVideoUrl("");

    try {
      const payload = {
        avatarId: selectedAvatarId,
        audioRecordId: selectedAudioRecordId,
        audioUrl: selectedAudio?.url,
        script: "",
        motionText,
        aspectRatio,
        resolution,
        engineType: selectedModel.engineType,
        title: template,
        description: "Video avatar voi audio ElevenLabs",
      };

      const created = await heygenApi.createAvatarVideo({
        ...payload,
        aspectRatio: aspectRatio as "16:9" | "9:16" | "1:1",
      });

      setJobVideoId(created.videoId || "");
      setJobStatus(String(created.jobStatus || "processing").toLowerCase());

      const finalStatus = await pollVideoStatus(created.videoId, payload);
      if (finalStatus?.videoUrl) {
        setJobVideoUrl(finalStatus.videoUrl);
      } else {
        setWarnings((current) => {
          const nextMessage = "Video dang cho webhook/lich su cap nhat. Ban xem truc tiep trong lich su ben duoi.";
          return current.includes(nextMessage) ? current : [nextMessage, ...current];
        });
      }

      const historyRes = await heygenApi.getVideoHistory();
      setHistory(historyRes.history || []);

      if (!finalStatus?.videoUrl) {
        const matched = (historyRes.history || []).find((item: any) => (item.videoId || item.id || item._id) === created.videoId);
        if (matched?.url) {
          setJobVideoUrl(matched.url);
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Khong the tao video");
      setJobStatus("failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDeleteHistory(videoId: string) {
    try {
      await heygenApi.deleteVideoHistory(videoId);
      setHistory((current) => current.filter((item) => (item.videoId || item.id || item._id) !== videoId));
      const historyRes = await heygenApi.getVideoHistory();
      setHistory(historyRes.history || []);
    } catch (error: any) {
      setErrorMessage(error.message || "Khong the xoa video");
    }
  }

  function handleReuseRecent(item: any) {
    if (item?.prompt) {
      setScript(item.prompt);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-2">
      <div className="space-y-5">
        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fdfefe_0%,#f4f8fb_100%)] p-5 shadow-sm md:p-6">
          <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbfe_0%,#eef4f9_100%)] p-4 shadow-inner">
            <div className="flex min-h-[290px] flex-col gap-4 lg:flex-row">
              <div className="relative flex w-full shrink-0 flex-col gap-3 lg:w-[130px]">
                <div className="relative overflow-hidden rounded-[18px]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarPickerOpen((current) => !current);
                      setIsAudioPickerOpen(false);
                      setIsModelPickerOpen(false);
                    }}
                    className="block w-full text-left"
                  >
                    {selectedAvatar?.previewImage ? (
                      <img
                        src={selectedAvatar.previewImage}
                        alt={selectedAvatar.name}
                        className="h-[205px] w-full rounded-[18px] object-cover"
                      />
                    ) : (
                      <div className="flex h-[205px] w-full items-center justify-center rounded-[18px] bg-slate-200 text-slate-600">
                        <UserRound className="h-10 w-10" />
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarPickerOpen((current) => !current);
                      setIsAudioPickerOpen(false);
                      setIsModelPickerOpen(false);
                    }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarPickerOpen((current) => !current);
                      setIsAudioPickerOpen(false);
                      setIsModelPickerOpen(false);
                    }}
                    className="absolute bottom-3 left-3 rounded-full bg-slate-950/78 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm"
                  >
                    Doi avatar
                  </button>
                </div>

                {isAvatarPickerOpen ? (
                  <PickerPopover
                    title="Chon avatar"
                    items={avatars}
                    selectedId={selectedAvatarId}
                    onClose={() => setIsAvatarPickerOpen(false)}
                    onSelect={(item) => {
                      setSelectedAvatarId(item.id);
                      setIsAvatarPickerOpen(false);
                    }}
                    emptyLabel="Khong co avatar"
                  />
                ) : null}
              </div>

              <div className="flex min-h-[205px] min-w-0 flex-1 flex-col pt-3">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  <span>Kich ban video</span>
                </div>

                <textarea
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  placeholder="Vi du: mo ta ngan de luu lich su va tao motion prompt. Audio noi se duoc lay tu ElevenLabs."
                  className="min-h-[110px] w-full flex-1 resize-none border-0 bg-transparent px-0 text-[17px] leading-8 text-slate-900 outline-none placeholder:text-slate-400 md:text-[18px]"
                />

                {isMotionOpen ? (
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span>Tuy chinh chuyen dong</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                        Beta
                      </span>
                      <CircleHelp className="h-4 w-4 text-slate-400" />
                    </div>

                    <textarea
                      value={motionText}
                      onChange={(event) => setMotionText(event.target.value)}
                      placeholder="e.g., lean in, look at camera, thumbs up at the end..."
                      className="min-h-[110px] w-full resize-none rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400"
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                        <Lightbulb className="h-4 w-4" />
                        <span>Dien dat sinh dong hon</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsMotionExpressive((current) => !current)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                          isMotionExpressive ? "bg-cyan-400" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                            isMotionExpressive ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <PillButton
                        onClick={() => {
                          setIsModelPickerOpen((current) => !current);
                          setIsAvatarPickerOpen(false);
                          setIsAudioPickerOpen(false);
                        }}
                      >
                        <Sparkles className="h-4 w-4 text-fuchsia-400" />
                        {selectedModel.id}
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isModelPickerOpen ? "rotate-180" : ""}`} />
                      </PillButton>

                      {isModelPickerOpen ? (
                        <ModelSelectionPopover
                          title="Chon mau chuyen dong"
                          items={HEYGEN_MODEL_OPTIONS as unknown as Array<{ id: string; description: string; icon: string }>}
                          selectedValue={selectedAvatarModel}
                          onClose={() => setIsModelPickerOpen(false)}
                          onSelect={(value) => {
                            setSelectedAvatarModel(value);
                            setIsModelPickerOpen(false);
                          }}
                        />
                      ) : null}
                    </div>

                    <PillButton onClick={() => setIsMotionOpen((current) => !current)}>
                      <MonitorPlay className="h-4 w-4 text-slate-500" />
                      Chuyen dong
                    </PillButton>

                    <div className="relative">
                      <PillButton
                        onClick={() => {
                          setIsAudioPickerOpen((current) => !current);
                          setIsAvatarPickerOpen(false);
                          setIsModelPickerOpen(false);
                        }}
                      >
                        <AudioLines className="h-4 w-4 text-slate-500" />
                        <span className="max-w-[220px] truncate">
                          {selectedAudio?.metadata?.title || selectedAudio?.metadata?.voiceName || "Audio ElevenLabs"}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isAudioPickerOpen ? "rotate-180" : ""}`} />
                      </PillButton>

                      {isAudioPickerOpen ? (
                        <AudioHistoryPopover
                          title="Chon audio ElevenLabs"
                          items={audioRecords}
                          selectedId={selectedAudioRecordId}
                          isLoading={isLoadingAudioHistory}
                          onRefresh={() => void loadWorkspaceData()}
                          onClose={() => setIsAudioPickerOpen(false)}
                          onSelect={(item) => {
                            setSelectedAudioRecordId(item._id);
                            setIsAudioPickerOpen(false);
                          }}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <PillButton onClick={() => setAspectRatio(nextValue(ASPECT_OPTIONS, aspectRatio))}>
                      <Smartphone className="h-4 w-4 text-slate-500" />
                      {aspectRatio}
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </PillButton>

                    <PillButton onClick={() => setResolution(nextValue(RESOLUTION_OPTIONS, resolution))}>
                      {resolution}
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </PillButton>

                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || isLoadingLibrary || !selectedAvatarId || !selectedAudioRecordId}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGenerating ? "Dang tao video..." : "Tao video"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  {selectedAudio ? (
                    <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-cyan-700">
                      Audio: {selectedAudio.metadata?.title || selectedAudio.metadata?.voiceName || "ElevenLabs"}
                    </span>
                  ) : null}
                  {errorMessage ? <span className="text-rose-600">{errorMessage}</span> : null}
                  {!errorMessage && warnings.length > 0 ? <span className="text-amber-600">{warnings[0]}</span> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fdfefe_0%,#f4f8fb_100%)] p-4 text-slate-900 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-xl font-bold tracking-tight text-slate-900">Video gan day</h4>
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
              Xem tat ca
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {history.length > 0 ? (
            <div className="space-y-4">
              {paginatedHistory.map((item) => (
                <HeyGenVideoItem
                  key={item._id}
                  item={item}
                  onPlay={(url) => setPreviewVideoUrl(url)}
                  onReuse={handleReuseRecent}
                  onDelete={handleDeleteHistory}
                  onStatusUpdate={(updatedItem) => {
                    setHistory((current) =>
                      current.map((h) => (h._id === updatedItem._id ? updatedItem : h))
                    );
                  }}
                />
              ))}

              {totalHistoryPages > 1 ? (
                <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Trang {historyPage}/{totalHistoryPages} · {history.length} video
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                      disabled={historyPage === 1}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Truoc
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))}
                      disabled={historyPage === totalHistoryPages}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Chua co video HeyGen nao trong lich su.
            </div>
          )}
        </div>
      </div>

      {previewVideoUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl rounded-[28px] bg-slate-950 p-3 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewVideoUrl("")}
              className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <video
              src={previewVideoUrl}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full rounded-[22px] bg-black object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function nextValue<T extends string>(values: readonly T[], currentValue: T) {
  const currentIndex = values.indexOf(currentValue);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % values.length : 0;
  return values[nextIndex];
}

function PillButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function ModelSelectionPopover({
  title,
  items,
  selectedValue,
  onClose,
  onSelect,
}: {
  title: string;
  items: Array<{ id: string; description: string; icon: string }>;
  selectedValue: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[360px] rounded-[22px] border border-white/10 bg-[#17191d] p-3 shadow-[0_18px_50px_rgba(15,23,42,0.32)]">
        <div className="mb-2 flex items-center justify-between gap-2 px-1 py-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item) => {
            const isSelected = item.id === selectedValue;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition ${
                  isSelected ? "bg-white/10 text-white" : "bg-white/5 text-slate-200 hover:bg-white/8"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 to-violet-500 text-xs font-bold text-slate-950">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{item.id}</p>
                  <p className="text-sm leading-5 text-slate-400">{item.description}</p>
                </div>
                {isSelected ? <Check className="h-5 w-5 text-cyan-400" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActionCircle({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
    >
      {children}
    </button>
  );
}

function PickerPopover({
  title,
  items,
  selectedId,
  onClose,
  onSelect,
  emptyLabel,
}: {
  title: string;
  items: HeyGenLibraryItem[];
  selectedId: string;
  onClose: () => void;
  onSelect: (item: HeyGenLibraryItem) => void;
  emptyLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[min(92vw,760px)] rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_30px_80px_rgba(15,23,42,0.2)]">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">Chon truc tiep tu thu vien da cap</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`rounded-[18px] border p-3 text-left transition ${
                    isSelected
                      ? "border-cyan-300 bg-cyan-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.previewImage ? (
                        <img
                          src={item.previewImage}
                          alt={item.name}
                          className="h-20 w-16 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#e2e8f0_0%,#cbd5e1_100%)] text-slate-700">
                          <UserRound className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="truncate text-xs text-slate-500">{item.accent || item.language || item.id}</p>
                        <p className="mt-2 line-clamp-1 text-[11px] text-slate-400">{item.id}</p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AudioHistoryPopover({
  title,
  items,
  selectedId,
  isLoading,
  onRefresh,
  onClose,
  onSelect,
}: {
  title: string;
  items: ElevenLabsAudioRecord[];
  selectedId: string;
  isLoading: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onSelect: (item: ElevenLabsAudioRecord) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-[min(92vw,760px)] rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_30px_80px_rgba(15,23,42,0.2)]">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">Nguon nay lay tu lich su tao giong noi cua ElevenLabs</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Lam moi
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Dang tai audio...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Chua co audio ElevenLabs trong lich su.
          </div>
        ) : (
          <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto pr-1">
            {items.map((item) => {
              const isSelected = item._id === selectedId;
              return (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`rounded-[18px] border p-3 text-left transition ${
                    isSelected
                      ? "border-cyan-300 bg-cyan-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <AudioLines className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.metadata?.title || item.metadata?.voiceName || "ElevenLabs audio"}
                        </p>
                        <p className="line-clamp-2 text-xs text-slate-500">{item.prompt || "Khong co mo ta"}</p>
                        <p className="mt-2 text-[11px] text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "Moi tao"}
                        </p>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Nghe
                    </a>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Mo file
                    </a>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
