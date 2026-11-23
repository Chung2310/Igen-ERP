/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-refresh/only-export-components */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X, ChevronLeft, ChevronRight, Play, Download, Trash2, Pencil, LoaderCircle } from "lucide-react";
import { elevenlabsApi } from "../../api/elevenlabs";
import { type HeyGenLibraryItem, heygenApi } from "../../api/heygen";
import type { ElevenLabsAudioRecord } from "./HeyGenPopovers";
import { HeyGenVideoItem } from "./HeyGenVideoItem";
import { HeyGenVideoPreview } from "./HeyGenVideoPreview";
import { HeyGenVerticalToolbar, type HeyGenTab } from "./HeyGenVerticalToolbar";
import { HEYGEN_MODEL_OPTIONS, HEYGEN_THEME } from "./heygenTheme";
import { marketingService } from "../../../campaign/services/marketingService";
import { toast } from "../../../../../pages/Toast";
import { socketService } from "../../../../../services/socketService";
import { ConfirmDialog } from "../../../../../components/common/ConfirmDialog";

const HeyGenOptionsDrawer = lazy(() =>
  import("./HeyGenOptionsDrawer").then((module) => ({ default: module.HeyGenOptionsDrawer }))
);
const PickerPopover = lazy(() =>
  import("./HeyGenPopovers").then((module) => ({ default: module.PickerPopover }))
);
const VoiceSourcePopover = lazy(() =>
  import("./VoiceSourcePopover").then((module) => ({ default: module.VoiceSourcePopover }))
);
const ModelSelectionPopover = lazy(() =>
  import("./HeyGenPopovers").then((module) => ({ default: module.ModelSelectionPopover }))
);

const TERMINAL_JOB_STATES = new Set(["completed", "failed", "error", "canceled"]);
const HISTORY_PAGE_SIZE = 6;
const HEYGEN_FALLBACK_POLL_DELAYS = [8000, 20000] as const;

function isPlayableVideoUrl(url?: string | null) {
  const value = String(url || "").trim();
  return value.startsWith("http://") || value.startsWith("https://");
}

export function translateJobStatus(status: string): string {
  const s = String(status || "").toLowerCase().trim();
  switch (s) {
    case "waiting":
    case "pending":
      return "Đang chờ trong hàng đợi";
    case "processing":
    case "running":
      return "Đang render video...";
    case "completed":
      return "Hoàn thành";
    case "failed":
    case "error":
      return "Thất bại";
    case "canceled":
      return "Đã hủy";
    default:
      return status;
  }
}

export function HeyGenWorkspace({
  initialPrompt,
  onEditVideo,
  cardId,
  onMediaSaved,
  autoTrigger,
  engineType,
  usePersonalVoice,
}: {
  initialPrompt?: string;
  onEditVideo?: (url: string) => void;
  cardId?: string;
  onMediaSaved?: (cardId: string, mediaUrl: string, type: 'image' | 'video' | 'audio') => void;
  autoTrigger?: boolean;
  engineType?: string;
  usePersonalVoice?: boolean;
}) {
  const [avatars, setAvatars] = useState<HeyGenLibraryItem[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [audioRecords, setAudioRecords] = useState<ElevenLabsAudioRecord[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [selectedAudioRecordId, setSelectedAudioRecordId] = useState("");
  const [selectedAvatarModel, setSelectedAvatarModel] = useState(
    engineType === 'avatar_iii' ? 'Avatar III' : HEYGEN_MODEL_OPTIONS[0].id
  );
  const [voices, setVoices] = useState<HeyGenLibraryItem[]>([]);
  const [personalVoices, setPersonalVoices] = useState<HeyGenLibraryItem[]>([]);
  const [selectedHeyGenVoiceId, setSelectedHeyGenVoiceId] = useState("");
  const [usePersonalVoiceMode, setUsePersonalVoiceMode] = useState(
    usePersonalVoice !== undefined ? usePersonalVoice : (engineType === "avatar_iii")
  );
  const [voicePickerTab, setVoicePickerTab] = useState<"third-party" | "personal">(
    (usePersonalVoice !== undefined ? usePersonalVoice : (engineType === "avatar_iii")) ? "personal" : "third-party"
  );
  const [avatarThreeScript, setAvatarThreeScript] = useState(initialPrompt || "");
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [isLoadingAudioHistory, setIsLoadingAudioHistory] = useState(false);
  const [hasLoadedAudioHistory, setHasLoadedAudioHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [jobStatus, setJobStatus] = useState("");
  const [jobVideoUrl, setJobVideoUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [isCardAudioLoaded, setIsCardAudioLoaded] = useState(false);
  const autoTriggeredRef = useRef(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [pendingDeleteVideoId, setPendingDeleteVideoId] = useState<string | null>(null);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [activeTab, setActiveTab] = useState<HeyGenTab>("avatar");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [enableCaption, setEnableCaption] = useState(false);
  const [captionPreset, setCaptionPreset] = useState<"brand" | "clean" | "outline" | "highlight">("brand");
  const [captionFontFamily, setCaptionFontFamily] = useState('"Be Vietnam Pro", Inter, sans-serif');
  const [captionFontSize, setCaptionFontSize] = useState(28);
  const [captionPrimaryColor, setCaptionPrimaryColor] = useState("#9bff4f");
  const [captionSecondaryColor, setCaptionSecondaryColor] = useState("#ffffff");
  const [captionPosition, setCaptionPosition] = useState<"top" | "middle" | "bottom">("bottom");
  const [captionOffset, setCaptionOffset] = useState({ x: 50, y: 86 });
  const [avatarBackground, setAvatarBackground] = useState<"customize" | "remove" | "color">("customize");
  const [avatarLayout, setAvatarLayout] = useState<"original" | "circle">("original");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const selectedAvatar = useMemo(() => avatars.find((avatar) => avatar.id === selectedAvatarId) || avatars[0] || null, [avatars, selectedAvatarId]);
  const selectedAudio = useMemo(() => audioRecords.find((record) => record._id === selectedAudioRecordId) || audioRecords[0] || null, [audioRecords, selectedAudioRecordId]);
  const selectedModel = useMemo(() => HEYGEN_MODEL_OPTIONS.find((item) => item.id === selectedAvatarModel) || HEYGEN_MODEL_OPTIONS[0], [selectedAvatarModel]);
  const selectedHeyGenVoice = useMemo(
    () => personalVoices.find((v) => v.id === selectedHeyGenVoiceId) || voices.find((v) => v.id === selectedHeyGenVoiceId) || personalVoices[0] || voices[0] || null,
    [personalVoices, voices, selectedHeyGenVoiceId]
  );
  const personalHeyGenVoices = useMemo(() => personalVoices, [personalVoices]);
  const personalVoiceHint = useMemo(() => {
    if (personalVoices.length > 0) {
      return "Đang hiển thị đúng danh sách My Voice riêng từ HeyGen.";
    }
    return "Chưa nhận được voice nào từ HeyGen cho tài khoản hiện tại.";
  }, [personalVoices.length]);
  const activeScript = useMemo(() => {
    if (selectedAvatarModel === "Avatar III" || usePersonalVoiceMode) {
      return avatarThreeScript;
    }
    return selectedAudio?.prompt || selectedAudio?.metadata?.title || "";
  }, [selectedAvatarModel, usePersonalVoiceMode, avatarThreeScript, selectedAudio]);
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const paginatedHistory = history.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

  useEffect(() => {
    void loadWorkspaceData();
  }, []);

  useEffect(() => {
    if (cardId) {
      const loadCardAudio = async () => {
        setIsCardAudioLoaded(false);
        try {
          const card = await marketingService.getCardById(cardId);
          if (card) {
            const cardRatio = (card as any).videoAspectRatio || (card as any).aspectRatio || (card.channel === "TikTok" ? "9:16" : "16:9");
            if (cardRatio === "9:16" || cardRatio === "1:1" || cardRatio === "16:9") {
              setAspectRatio(cardRatio as any);
            }
            if (card.engineType === 'avatar_iii') {
              setSelectedAvatarModel("Avatar III");
              setUsePersonalVoiceMode(true);
              if (card.avatarId) {
                setSelectedAvatarId(card.avatarId);
              }
              if (card.voiceId) {
                setSelectedHeyGenVoiceId(card.voiceId);
              }
              setAvatarThreeScript((current) => card.inputText || card.voiceScript || current || initialPrompt || "");
              toast.info(`Đã nạp kịch bản Avatar III cho bài đăng: "${card.title}"`);
            } else {
              const hasPersonalVoiceCardState = card.usePersonalVoice || Boolean(card.voiceId && (card.inputText || card.voiceScript));
              setUsePersonalVoiceMode(hasPersonalVoiceCardState);
              if (hasPersonalVoiceCardState) {
                setVoicePickerTab("personal");
              }
              if (card.engineType === 'avatar_v') {
                setSelectedAvatarModel("Avatar V");
              } else {
                setSelectedAvatarModel("Avatar IV");
              }
              if (card.avatarId) {
                setSelectedAvatarId(card.avatarId);
              }
              if (hasPersonalVoiceCardState) {
                if (card.voiceId) {
                  setSelectedHeyGenVoiceId(card.voiceId);
                }
                setAvatarThreeScript((current) => card.inputText || card.voiceScript || current || initialPrompt || "");
              }
              if (card.audioRecordId) {
                setSelectedAudioRecordId(card.audioRecordId);
              }
              if (card.audioUrl) {
                setAudioRecords((prev) => {
                  const alreadyExists = prev.some(item => item._id === card.audioRecordId);
                  if (alreadyExists) return prev;
                  const newRecord = {
                    _id: card.audioRecordId || `mod_aud_${Date.now()}`,
                    url: card.audioUrl!,
                    title: card.title || "Giọng nói được tạo",
                    description: "Nạp từ kịch bản bài đăng",
                    generatedAt: card.generatedAt || new Date().toISOString()
                  } as any;
                  return [newRecord, ...prev];
                });
                toast.info(`Đã tự động nạp giọng nói cho bài đăng: "${card.title}"`);
              }
            }
          }
        } catch (err) {
          console.error("Lỗi nạp audio từ card trong HeyGen:", err);
        } finally {
          setIsCardAudioLoaded(true);
        }
      };
      void loadCardAudio();
    } else {
      setIsCardAudioLoaded(true);
    }
  }, [cardId]);

  useEffect(() => {
    if (usePersonalVoiceMode) {
      if (!selectedHeyGenVoiceId && personalVoices[0]?.id) {
        setSelectedHeyGenVoiceId(personalVoices[0].id);
        return;
      }
      if (selectedHeyGenVoiceId && !personalVoices.some((voice) => voice.id === selectedHeyGenVoiceId) && personalVoices[0]?.id) {
        setSelectedHeyGenVoiceId(personalVoices[0].id);
      }
      return;
    }

    if (!selectedAudioRecordId && audioRecords[0]?._id) {
      setSelectedAudioRecordId(audioRecords[0]._id);
    }
  }, [usePersonalVoiceMode, personalVoices, selectedHeyGenVoiceId, audioRecords, selectedAudioRecordId]);

  useEffect(() => {
    if (autoTrigger && !isLoadingLibrary && isCardAudioLoaded && !autoTriggeredRef.current) {
      const usesTextToVoice = selectedAvatarModel === "Avatar III" || usePersonalVoiceMode;
      if (usesTextToVoice) {
        if (selectedAvatarId && selectedHeyGenVoiceId && avatarThreeScript.trim()) {
          autoTriggeredRef.current = true;
          toast.info("Chế độ AutoTrigger: Tự động khởi chạy video text-to-voice HeyGen...");
          void handleGenerate();
        }
      } else {
        if (selectedAvatarId && selectedAudioRecordId) {
          autoTriggeredRef.current = true;
          toast.info("Chế độ AutoTrigger: Tự động khởi chạy kết xuất Video Avatar...");
          void handleGenerate();
        }
      }
    }
  }, [autoTrigger, isLoadingLibrary, isCardAudioLoaded, selectedAvatarModel, usePersonalVoiceMode, selectedAvatarId, selectedHeyGenVoiceId, selectedAudioRecordId, avatarThreeScript]);

  useEffect(() => {
    setHistoryPage(1);
  }, [history.length]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  useEffect(() => {
    if (!historySectionRef.current || hasLoadedHistory) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        void loadHistoryData();
        observer.disconnect();
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(historySectionRef.current);
    return () => observer.disconnect();
  }, [hasLoadedHistory]);

  useEffect(() => {
    if (!hasLoadedHistory) return;
    const hasActiveJobs = history.some((item) => !TERMINAL_JOB_STATES.has(String(item.status || "").toLowerCase()));
    if (!hasActiveJobs) return;
    const interval = window.setInterval(async () => {
      try {
        const historyRes = await heygenApi.getVideoHistory();
        setHistory(historyRes.history || []);
      } catch (error) {
        console.error("Failed to poll video history:", error);
      }
    }, 10000);
    return () => window.clearInterval(interval);
  }, [history]);

  useEffect(() => {
    const unsubscribe = socketService.onVideoStatusUpdated((data) => {
      console.log("[HeyGenWorkspace] Real-time video update received:", data);
      
      // Reload history so user sees the update instantly
      reloadHistoryData().catch((err) => console.error("Error reloading history on socket event:", err));
      
      // Determine video title and status
      const videoTitle = data.updates?.[0]?.metadata?.title || "Video AI HeyGen";
      const statusText = String(data.status).toLowerCase();
      
      if (statusText === "completed" || statusText === "success") {
        toast.success(`Video "${videoTitle}" đã tạo thành công!`);
      } else if (statusText === "failed" || statusText === "error") {
        toast.error(`Video "${videoTitle}" tạo thất bại.`);
      } else {
        toast.info(`ℹ️ Video "${videoTitle}" đang: ${translateJobStatus(data.status)}`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  async function loadWorkspaceData() {
    setIsLoadingLibrary(true);
    setErrorMessage("");
    try {
      const [libraryResult] = await Promise.allSettled([heygenApi.getLibrary({ force: true })]);
      if (libraryResult.status === "fulfilled") {
        const nextAvatars = libraryResult.value.avatars || [];
        const nextVoices = libraryResult.value.voices || [];
        const nextPersonalVoices = libraryResult.value.personalVoices || [];
        setAvatars(nextAvatars);
        setVoices(nextVoices);
        setPersonalVoices(nextPersonalVoices);
        setWarnings(libraryResult.value.warnings || []);
        setSelectedAvatarId((current) => current && nextAvatars.some((avatar) => avatar.id === current) ? current : "");
        setSelectedHeyGenVoiceId((current) => {
          const personalIds = new Set(nextPersonalVoices.map((voice) => voice.id));
          const allIds = new Set(nextVoices.map((voice) => voice.id));
          if (current && (personalIds.has(current) || allIds.has(current))) {
            return current;
          }
          return "";
        });
        preloadAvatarImages(nextAvatars);
      } else {
        setErrorMessage(libraryResult.reason?.message || "Không thể tải thư viện khuôn mặt");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Không thể tải dữ liệu khuôn mặt");
    }
    setIsLoadingLibrary(false);
  }

  function preloadAvatarImages(items: HeyGenLibraryItem[]) {
    items
      .filter((item) => Boolean(item.previewImage))
      .slice(0, 4)
      .forEach((item) => {
        const image = new Image();
        image.src = item.previewImage!;
      });
  }

  async function loadHistoryData() {
    if (isLoadingHistory || hasLoadedHistory) return;
    setIsLoadingHistory(true);
    try {
      const historyResult = await heygenApi.getVideoHistory();
      setHistory(historyResult.history || []);
      setHasLoadedHistory(true);
    } catch (error: any) {
      setErrorMessage((current) => current || error.message || "Không thể tải lịch sử khuôn mặt");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function reloadHistoryData() {
    setIsLoadingHistory(true);
    try {
      const historyResult = await heygenApi.getVideoHistory();
      setHistory(historyResult.history || []);
      setHasLoadedHistory(true);
    } catch (error: any) {
      setErrorMessage((current) => current || error.message || "Không thể tải lịch sử khuôn mặt");
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function ensureAudioHistoryLoaded(options?: { force?: boolean }) {
    setIsLoadingAudioHistory(true);
    setErrorMessage("");
    try {
      const data = await elevenlabsApi.getVoiceHistory({ force: options?.force });
      const records = (data.history || []).filter((item: ElevenLabsAudioRecord) => Boolean(item?._id && item?.url));
      setAudioRecords(records);
      setSelectedAudioRecordId((current) => current && records.some((item) => item._id === current) ? current : records[0]?._id || "");
      setHasLoadedAudioHistory(true);
    } catch (error: any) {
      setErrorMessage(error.message || "Không thể tải lịch sử giọng nói");
    } finally {
      setIsLoadingAudioHistory(false);
    }
  }

  async function handleOpenVoicePicker() {
    const openPersonalByDefault = selectedAvatarModel === "Avatar III" || usePersonalVoiceMode;
    setVoicePickerTab(openPersonalByDefault ? "personal" : "third-party");
    setIsAudioPickerOpen(true);
    if (!openPersonalByDefault && !hasLoadedAudioHistory && !isLoadingAudioHistory) {
      await ensureAudioHistoryLoaded();
    }
  }

  async function refreshAudioHistory() {
    await ensureAudioHistoryLoaded({ force: true });
  }

  async function pollVideoStatus(videoId: string, payload: any) {
    for (const delay of HEYGEN_FALLBACK_POLL_DELAYS) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const status = await heygenApi.getVideoStatus(videoId, payload);
      const nextStatus = String(status.jobStatus || "processing").toLowerCase();
      console.log("[HeyGenWorkspace] pollVideoStatus:", {
        videoId,
        delay,
        nextStatus,
        hasVideoUrl: Boolean(status.videoUrl),
        hasThumbnailUrl: Boolean(status.thumbnailUrl),
        error: status.error || "",
      });
      setJobStatus(nextStatus);
      if (status.videoUrl) setJobVideoUrl(status.videoUrl);
      if (TERMINAL_JOB_STATES.has(nextStatus)) {
        if (nextStatus !== "completed" && status.error) setErrorMessage(status.error);
        return status;
      }
    }
    setJobStatus("processing");
    return null;
  }

  async function handleGenerate() {
    if (!selectedAvatarId) {
      setErrorMessage("Vui lòng chọn avatar trước khi tạo video.");
      return;
    }

    if (selectedModel.engineType === "avatar_iii" || usePersonalVoiceMode) {
      if (!avatarThreeScript.trim()) {
        setErrorMessage("Vui lòng nhập kịch bản phát thanh để render bằng HeyGen voice.");
        return;
      }
      if (!selectedHeyGenVoiceId) {
        setErrorMessage("Vui lòng chọn giọng nói HeyGen.");
        return;
      }
    } else {
      const hasAudio = Boolean(selectedAudioRecordId);
      if (!hasAudio) {
        setErrorMessage("Vui lòng chọn giọng nói để tạo video.");
        return;
      }
    }

    setIsGenerating(true);
    setErrorMessage("");
    setJobStatus("processing");
    setJobVideoUrl("");

    try {
      const payload: any = {
        avatarId: selectedAvatarId,
        enableCaption,
        aspectRatio,
        resolution: "720p" as const,
        engineType: selectedModel.engineType,
        title: selectedModel.engineType === "avatar_iii" ? "Video Avatar III" : "Video người nói",
        description: selectedModel.engineType === "avatar_iii" ? "Tạo từ kịch bản văn bản" : "Video avatar với HeyGen Studio",
        avatarBackground,
        backgroundColor,
        avatarLayout,
        cardId,
      };

      if (selectedModel.engineType === "avatar_iii" || usePersonalVoiceMode) {
        payload.voiceId = selectedHeyGenVoiceId;
        payload.inputText = avatarThreeScript;
        payload.usePersonalVoice = usePersonalVoiceMode;
      } else {
        payload.audioRecordId = selectedAudioRecordId || undefined;
        payload.audioUrl = selectedAudio?.url || undefined;
      }

      const created = await heygenApi.createAvatarVideo(payload);
      console.log("[HeyGenWorkspace] createAvatarVideo result:", created);
      setJobStatus(String(created.jobStatus || "processing").toLowerCase());
      const finalStatus = await pollVideoStatus(created.videoId, payload);
      console.log("[HeyGenWorkspace] finalStatus after polling:", finalStatus);
      if (!finalStatus?.videoUrl) {
        setWarnings((current) => current.includes("Video đang chờ cập nhật lịch sử. Bạn xem trực tiếp trong lịch sử bên dưới.") ? current : ["Video đang chờ cập nhật lịch sử. Bạn xem trực tiếp trong lịch sử bên dưới.", ...current]);
      }
      const historyRes = await heygenApi.getVideoHistory();
      console.log("[HeyGenWorkspace] history after create:", historyRes.history || []);
      setHistory(historyRes.history || []);
      setHasLoadedHistory(true);

      let finalVideoUrl = finalStatus?.videoUrl || "";
      if (!finalVideoUrl) {
        const matched = (historyRes.history || []).find((item: any) => (item.videoId || item.id || item._id) === created.videoId);
        if (matched?.url) {
          finalVideoUrl = matched.url;
          setJobVideoUrl(matched.url);
        }
      }

      if (finalVideoUrl && cardId && onMediaSaved) {
        toast.info("Đang tối ưu lưu trữ video trên Cloudinary...");
        try {
          const filename = `human_video_${Date.now()}.mp4`;
          const cloudinaryUrl = await marketingService.uploadMediaToStorage(finalVideoUrl, filename, 'video');
          onMediaSaved(cardId, cloudinaryUrl, 'video');
          toast.success("Tối ưu lưu trữ và cập nhật trạng thái bài đăng thành công!");
        } catch (cloudinaryErr) {
          console.error("Cloudinary upload failed, using original URL:", cloudinaryErr);
          onMediaSaved(cardId, finalVideoUrl, 'video');
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Không thể tạo video");
      setJobStatus("failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDeleteHistory(videoId: string) {
    try {
      await heygenApi.deleteVideoHistory(videoId);
      await reloadHistoryData();
    } catch (error: any) {
      setErrorMessage(error.message || "Không thể xóa video");
    }
  }

  function handleEditRecent(item: any) {
    const editUrl = String(item?.url || item?.captionedVideoUrl || item?.videoPageUrl || "").trim();
    if (!isPlayableVideoUrl(editUrl)) {
      setErrorMessage("Video này chưa sẵn sàng để đưa sang chỉnh sửa Video.");
      return;
    }

    if (onEditVideo) {
      onEditVideo(editUrl);
      return;
    }

    setPreviewVideoUrl(editUrl);
  }

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const { scrollLeft, clientWidth } = carouselRef.current;
      const scrollAmount = clientWidth * 0.75;
      const scrollTo = direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
      carouselRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const handleDownloadVideo = async (item: any) => {
    const downloadUrl = item.url || item.captionedVideoUrl || item.videoPageUrl || "";
    if (!isPlayableVideoUrl(downloadUrl)) return;
    toast.info("Đang tải xuống video...");
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${item.prompt || "heygen-video"}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Tải xuống video thành công!");
    } catch (error) {
      console.error("Direct download failed, opening in new tab:", error);
      window.open(downloadUrl, "_blank");
      toast.warning("Mở video trong tab mới để tải về.");
    }
  };

  const focusRingClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 pb-6">
      <div className={`flex h-[calc(100dvh-190px)] min-h-[560px] max-h-[760px] w-full overflow-hidden rounded-xl border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface}`}>
        <HeyGenVideoPreview
          selectedAvatar={selectedAvatar}
          script={activeScript}
          onScriptChange={setAvatarThreeScript}
          selectedAvatarModel={selectedAvatarModel}
          usePersonalVoiceMode={usePersonalVoiceMode}
          enableCaption={enableCaption}
          setEnableCaption={setEnableCaption}
          captionPreset={captionPreset}
          captionFontFamily={captionFontFamily}
          captionFontSize={captionFontSize}
          captionPrimaryColor={captionPrimaryColor}
          captionSecondaryColor={captionSecondaryColor}
          captionPosition={captionPosition}
          captionOffset={captionOffset}
          setCaptionOffset={setCaptionOffset}
          avatarLayout={avatarLayout}
          avatarBackground={avatarBackground}
          backgroundColor={backgroundColor}
          previewVideoUrl={previewVideoUrl || jobVideoUrl}
          aspectRatio={aspectRatio}
        />

        {isDrawerOpen ? (
          <Suspense fallback={<DrawerFallback />}>
            <HeyGenOptionsDrawer
              activeTab={activeTab}
              onClose={() => setIsDrawerOpen(false)}
              selectedAvatar={selectedAvatar}
              selectedAudio={selectedAudio}
              selectedHeyGenVoice={selectedHeyGenVoice}
              usePersonalVoiceMode={usePersonalVoiceMode}
              isLoadingLibrary={isLoadingLibrary}
              onOpenAvatarPicker={() => setIsAvatarPickerOpen(true)}
              onOpenVoicePicker={() => void handleOpenVoicePicker()}
              onOpenModelPicker={() => setIsModelPickerOpen(true)}
              selectedAvatarModel={selectedAvatarModel}
              selectedAvatarModelDescription={selectedModel.description}
              avatarBackground={avatarBackground}
              setAvatarBackground={setAvatarBackground}
              avatarLayout={avatarLayout}
              setAvatarLayout={setAvatarLayout}
              backgroundColor={backgroundColor}
              setBackgroundColor={setBackgroundColor}
              enableCaption={enableCaption}
              setEnableCaption={setEnableCaption}
              captionPreset={captionPreset}
              setCaptionPreset={setCaptionPreset}
              captionFontFamily={captionFontFamily}
              setCaptionFontFamily={setCaptionFontFamily}
              captionFontSize={captionFontSize}
              setCaptionFontSize={setCaptionFontSize}
              captionPrimaryColor={captionPrimaryColor}
              setCaptionPrimaryColor={setCaptionPrimaryColor}
              captionSecondaryColor={captionSecondaryColor}
              setCaptionSecondaryColor={setCaptionSecondaryColor}
              captionPosition={captionPosition}
              setCaptionPosition={(position) => {
                setCaptionPosition(position);
                setCaptionOffset(position === "top" ? { x: 50, y: 16 } : position === "middle" ? { x: 50, y: 50 } : { x: 50, y: 86 });
              }}
              isGenerating={isGenerating}
              onRender={handleGenerate}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
            />
          </Suspense>
        ) : null}

        <HeyGenVerticalToolbar activeTab={activeTab} onChangeTab={(tab) => { setActiveTab(tab); setIsDrawerOpen(true); }} />
      </div>

      {isLoadingLibrary ? (
        <div role="status" className="rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm text-primary">
          <p className="font-semibold">Đang tải thư viện AI…</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">Hệ thống đang đồng bộ avatar và tùy chọn chuyển động từ máy chủ.</p>
        </div>
      ) : null}

      {(errorMessage || warnings.length > 0 || jobStatus) ? (
        <div
          role={errorMessage ? "alert" : "status"}
          className={`rounded-xl border p-4 text-sm font-medium ${
            errorMessage
              ? "border-error/30 bg-error/10 text-error"
              : "border-primary/25 bg-primary/10 text-primary"
          }`}
        >
          {errorMessage ? <p>{errorMessage}</p> : null}
          {!errorMessage && warnings.length > 0 ? <p>{warnings[0]}</p> : null}
          {!errorMessage && !warnings.length && jobStatus ? <p>Trạng thái render: {translateJobStatus(jobStatus)}</p> : null}
        </div>
      ) : null}

      <section
        ref={historySectionRef}
        aria-label="Lịch sử tạo video"
        className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5"
      >
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-3.5">
          <div>
            <h2 className="text-balance text-sm font-semibold text-on-surface">Lịch sử tạo video</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">Hiển thị tối đa 20 kết quả gần nhất, từ mới đến cũ.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary">
            {history.slice(0, 20).length}/20
          </span>
        </div>

        <div className="mt-4">
          {!hasLoadedHistory ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 py-8 text-on-surface-variant">
              <p className="text-sm">Lịch sử sẽ được tải khi bạn cuộn xuống dưới cùng.</p>
            </div>
          ) : isLoadingHistory && history.length === 0 ? (
            <div role="status" className="flex flex-col items-center justify-center gap-2 py-8 text-on-surface-variant">
              <LoaderCircle className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
              <p className="text-xs">Đang tải lịch sử video…</p>
            </div>
          ) : history.length > 0 ? (
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                aria-label="Cuộn lịch sử sang trái"
                onClick={() => scrollCarousel("left")}
                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>

              <div
                ref={carouselRef}
                className="flex flex-1 gap-4 overflow-x-auto scroll-smooth py-1 scrollbar-none"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {history.slice(0, 20).map((item, index) => {
                  const status = String(item.status || "").toLowerCase();
                  const isCompleted = status === "completed";
                  const isFailed = ["failed", "error", "canceled"].includes(status);
                  const isProcessing = !isCompleted && !isFailed;
                  const renderName = `Render ${history.length - index}`;
                  const itemRatio = item.metadata?.aspectRatio || "16:9";
                  const videoUrl = item.url || item.captionedVideoUrl || item.videoPageUrl || "";
                  const hasVideoUrl = isPlayableVideoUrl(videoUrl);

                  return (
                    <div
                      key={item._id || item.id || index}
                      className={`group/card relative aspect-[16/9] w-56 shrink-0 overflow-hidden rounded-lg border-2 bg-black transition-colors duration-150 ${
                        index === 0
                          ? "border-primary"
                          : "border-outline-variant hover:border-outline"
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={`Xem chi tiết ${renderName}`}
                        onClick={() => {
                          if (isProcessing) {
                            toast.info("Video đang trong quá trình xử lý, vui lòng chờ hoàn tất.");
                            return;
                          }
                          setPreviewItem(item);
                        }}
                        title={item.prompt || item.title || renderName}
                        className={`block size-full cursor-pointer text-left ${focusRingClass}`}
                      >
                        {isCompleted ? (
                          <>
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={renderName}
                                loading="lazy"
                                className="absolute inset-0 size-full object-cover"
                              />
                            ) : hasVideoUrl ? (
                              <video
                                src={videoUrl}
                                preload="metadata"
                                playsInline
                                className="absolute inset-0 size-full object-cover bg-transparent"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low">
                                <Play className="size-7 text-on-surface-variant" aria-hidden="true" />
                              </div>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-opacity duration-150 group-hover/card:bg-black/35">
                              <span className="flex size-10 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xs">
                                <Play className="ml-0.5 size-4 fill-current" aria-hidden="true" />
                              </span>
                            </span>
                          </>
                        ) : isFailed ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-error/20 p-3 text-center text-white">
                            <span className="text-xs font-semibold">Thất bại</span>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-low p-3 text-center text-primary">
                            <LoaderCircle className="mb-1.5 size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                            <span className="text-xs font-medium">Đang xử lý</span>
                          </div>
                        )}
                      </button>

                      {isCompleted ? (
                        <button
                          type="button"
                          aria-label={`Tải ${renderName}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleDownloadVideo(item);
                          }}
                          className={`absolute right-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity duration-150 hover:bg-primary focus-visible:opacity-100 group-hover/card:opacity-100 cursor-pointer ${focusRingClass}`}
                          title="Tải video trực tiếp"
                        >
                          <Download className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2.5 py-1.5 text-xs font-medium tabular-nums text-white">
                        <span className="truncate">{renderName}</span>
                        <span className="rounded bg-white/15 px-1.5 py-0.5 text-[11px]">{itemRatio}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                aria-label="Cuộn lịch sử sang phải"
                onClick={() => scrollCarousel("right")}
                className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 py-10 text-on-surface-variant">
              <p className="text-sm">Chưa có video người dẫn AI nào được tạo.</p>
            </div>
          )}
        </div>
      </section>

      {/* Detail Preview & Action Modal */}
      {previewItem ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem chi tiết video"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative flex w-full max-w-2xl flex-col gap-5 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-xl md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Đóng xem trước"
              onClick={() => setPreviewItem(null)}
              className={`absolute right-4 top-4 z-20 inline-flex size-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer ${focusRingClass}`}
              title="Đóng"
            >
              <X className="size-4" aria-hidden="true" />
            </button>

            <div className="relative flex w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-black md:h-[420px]">
              {String(previewItem.status || "").toLowerCase() === "completed" && isPlayableVideoUrl(previewItem.url || previewItem.captionedVideoUrl || previewItem.videoPageUrl) ? (
                <video
                  src={previewItem.url || previewItem.captionedVideoUrl || previewItem.videoPageUrl || ""}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full bg-transparent object-contain"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center bg-surface-container-low p-6 text-center">
                  <span className="mb-1.5 text-sm font-semibold text-error">Video này render bị lỗi</span>
                  <p className="max-w-xs text-pretty text-xs text-on-surface-variant">
                    {previewItem.error || "Không thể phát video này do lỗi hệ thống HeyGen."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex w-full flex-row items-center justify-center gap-3 border-t border-outline-variant pt-4 md:w-16 md:flex-col md:border-l md:border-t-0 md:pl-4 md:pt-0">
              {String(previewItem.status || "").toLowerCase() === "completed" && (
                <>
                  <button
                    type="button"
                    aria-label="Chỉnh sửa video này"
                    onClick={() => {
                      handleEditRecent(previewItem);
                      setPreviewItem(null);
                    }}
                    className={`inline-flex size-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition-colors duration-150 hover:bg-primary/15 cursor-pointer ${focusRingClass}`}
                    title="Chỉnh sửa video này"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    aria-label="Tải xuống video"
                    onClick={async () => {
                      setIsDownloading(true);
                      await handleDownloadVideo(previewItem);
                      setIsDownloading(false);
                    }}
                    disabled={isDownloading}
                    className={`inline-flex size-11 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-on-surface transition-colors duration-150 hover:bg-surface-container cursor-pointer disabled:opacity-50 ${focusRingClass}`}
                    title="Tải xuống video"
                  >
                    {isDownloading ? (
                      <LoaderCircle className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Download className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                aria-label="Xóa video khỏi lịch sử"
                onClick={() => {
                  setPendingDeleteVideoId(previewItem.videoId || previewItem.id || previewItem._id);
                }}
                className={`inline-flex size-11 items-center justify-center rounded-lg border border-error/25 bg-error/10 text-error transition-colors duration-150 hover:bg-error/15 cursor-pointer ${focusRingClass}`}
                title="Xóa lịch sử video"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        appearance="erp"
        isOpen={Boolean(pendingDeleteVideoId)}
        isSubmitting={isDeletingHistory}
        title="Xóa video khỏi lịch sử"
        description="Bạn có chắc chắn muốn xóa video này khỏi lịch sử tạo video?"
        confirmLabel="Xóa video"
        cancelLabel="Hủy"
        tone="danger"
        onClose={() => {
          if (!isDeletingHistory) setPendingDeleteVideoId(null);
        }}
        onConfirm={async () => {
          if (!pendingDeleteVideoId) return;
          setIsDeletingHistory(true);
          try {
            await handleDeleteHistory(pendingDeleteVideoId);
            setPendingDeleteVideoId(null);
            setPreviewItem(null);
          } finally {
            setIsDeletingHistory(false);
          }
        }}
      />

      {isAvatarPickerOpen ? (
        <Suspense fallback={<ModalFallback label="Đang tải danh sách avatar..." />}>
          <PickerPopover title="Thay avatar" items={avatars} selectedId={selectedAvatarId} onClose={() => setIsAvatarPickerOpen(false)} onSelect={(item) => { setSelectedAvatarId(item.id); setIsAvatarPickerOpen(false); }} emptyLabel="Chưa có avatar nào được cấp cho tài khoản này." />
        </Suspense>
      ) : null}
      {isAudioPickerOpen ? (
        <Suspense fallback={<ModalFallback label="Đang tải danh sách giọng nói..." />}>
          <VoiceSourcePopover
            title="Đổi giọng nói"
            activeTab={voicePickerTab}
            onTabChange={(tab) => {
              setVoicePickerTab(tab);
              if (tab === "third-party" && !hasLoadedAudioHistory && !isLoadingAudioHistory) {
                void ensureAudioHistoryLoaded();
              }
            }}
            thirdPartyItems={audioRecords}
            selectedThirdPartyId={selectedAudioRecordId}
            isLoadingThirdParty={isLoadingAudioHistory}
            onRefreshThirdParty={() => void refreshAudioHistory()}
            onSelectThirdParty={(item) => {
              setSelectedAudioRecordId(item._id);
              setUsePersonalVoiceMode(false);
              setIsAudioPickerOpen(false);
            }}
            personalItems={personalHeyGenVoices}
            selectedPersonalId={selectedHeyGenVoiceId}
            onSelectPersonal={(item) => {
              setSelectedHeyGenVoiceId(item.id);
              setUsePersonalVoiceMode(true);
              setAvatarThreeScript((current) => current.trim() || selectedAudio?.prompt || initialPrompt || "");
              setIsAudioPickerOpen(false);
              toast.info(`Đã chọn giọng cá nhân "${item.name}" và bật chế độ text-to-voice của HeyGen.`);
            }}
            personalHint={`${personalVoiceHint} Khi chọn giọng cá nhân, bạn có thể dùng text-to-voice HeyGen cho Avatar IV/V hoặc Avatar III.`}
            onClose={() => setIsAudioPickerOpen(false)}
          />
        </Suspense>
      ) : null}
      {isModelPickerOpen ? (
        <Suspense fallback={<ModalFallback label="Đang tải bộ máy chuyển động..." />}>
          <ModelSelectionPopover title="Bộ máy chuyển động" items={HEYGEN_MODEL_OPTIONS.map((item) => ({ id: item.id, description: item.description, icon: item.icon }))} selectedValue={selectedAvatarModel} onClose={() => setIsModelPickerOpen(false)} onSelect={(value) => { setSelectedAvatarModel(value); setIsModelPickerOpen(false); }} />
        </Suspense>
      ) : null}
    </div>
  );
}

function PagerButton({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex h-9 items-center justify-center rounded-full border ${HEYGEN_THEME.border} bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50`}>{children}</button>;
}

function DrawerFallback() {
  return <div className={`h-full w-[340px] shrink-0 border-l ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} xl:w-[360px]`} />;
}

function ModalFallback({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`rounded-[24px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} px-6 py-5 text-sm font-semibold text-slate-600 shadow-2xl`}>
        {label}
      </div>
    </div>
  );
}
