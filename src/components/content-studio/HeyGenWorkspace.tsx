import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { elevenlabsApi } from "../../api/elevenlabs";
import { type HeyGenLibraryItem, heygenApi } from "../../api/heygen";
import type { ElevenLabsAudioRecord } from "./HeyGenPopovers";
import { HeyGenVideoItem } from "./HeyGenVideoItem";
import { HeyGenVideoPreview } from "./HeyGenVideoPreview";
import { HeyGenVerticalToolbar, type HeyGenTab } from "./HeyGenVerticalToolbar";
import { HEYGEN_MODEL_OPTIONS, HEYGEN_THEME } from "./heygenTheme";

const HeyGenOptionsDrawer = lazy(() =>
  import("./HeyGenOptionsDrawer").then((module) => ({ default: module.HeyGenOptionsDrawer }))
);
const PickerPopover = lazy(() =>
  import("./HeyGenPopovers").then((module) => ({ default: module.PickerPopover }))
);
const AudioHistoryPopover = lazy(() =>
  import("./HeyGenPopovers").then((module) => ({ default: module.AudioHistoryPopover }))
);
const ModelSelectionPopover = lazy(() =>
  import("./HeyGenPopovers").then((module) => ({ default: module.ModelSelectionPopover }))
);

const TERMINAL_JOB_STATES = new Set(["completed", "failed", "error", "canceled"]);
const HISTORY_PAGE_SIZE = 6;
const HEYGEN_FALLBACK_POLL_DELAYS = [8000, 20000] as const;

export function HeyGenWorkspace({ initialPrompt }: { initialPrompt?: string }) {
  const [avatars, setAvatars] = useState<HeyGenLibraryItem[]>([]);
  const [audioRecords, setAudioRecords] = useState<ElevenLabsAudioRecord[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [selectedAudioRecordId, setSelectedAudioRecordId] = useState("");
  const [selectedAvatarModel, setSelectedAvatarModel] = useState(HEYGEN_MODEL_OPTIONS[0].id);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [isLoadingAudioHistory, setIsLoadingAudioHistory] = useState(false);
  const [hasLoadedAudioHistory, setHasLoadedAudioHistory] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState("");
  const [jobVideoUrl, setJobVideoUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [activeTab, setActiveTab] = useState<HeyGenTab>("avatar");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [enableCaption, setEnableCaption] = useState(false);
  const [captionPreset, setCaptionPreset] = useState<"brand" | "clean" | "outline" | "highlight">("brand");
  const [captionFontFamily, setCaptionFontFamily] = useState("Georgia, serif");
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

  async function loadWorkspaceData() {
    setErrorMessage("");
    try {
      const [libraryResult] = await Promise.allSettled([heygenApi.getLibrary()]);
      if (libraryResult.status === "fulfilled") {
        const nextAvatars = libraryResult.value.avatars || [];
        const defaultAvatarId = libraryResult.value.defaults?.avatarId || "";
        setAvatars(nextAvatars);
        setWarnings(libraryResult.value.warnings || []);
        setSelectedAvatarId((current) => current && nextAvatars.some((avatar) => avatar.id === current) ? current : defaultAvatarId && nextAvatars.some((avatar) => avatar.id === defaultAvatarId) ? defaultAvatarId : nextAvatars[0]?.id || "");
        preloadAvatarImages(nextAvatars);
      } else {
        setErrorMessage(libraryResult.reason?.message || "Khong the tai thu vien HeyGen");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Khong the tai du lieu HeyGen");
    }
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
      setErrorMessage((current) => current || error.message || "Khong the tai lich su HeyGen");
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
      setErrorMessage((current) => current || error.message || "Khong the tai lich su HeyGen");
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
      setErrorMessage(error.message || "Khong the tai lich su audio ElevenLabs");
    } finally {
      setIsLoadingAudioHistory(false);
    }
  }

  async function handleOpenVoicePicker() {
    setIsAudioPickerOpen(true);
    if (!hasLoadedAudioHistory && !isLoadingAudioHistory) {
      await ensureAudioHistoryLoaded();
    }
  }

  async function refreshAudioHistory() {
    await ensureAudioHistoryLoaded({ force: true });
  }

  async function pollVideoStatus(videoId: string, payload: { avatarId: string; audioRecordId?: string; audioUrl?: string; aspectRatio: "16:9" | "9:16" | "1:1"; title: string; description: string; enableCaption?: boolean }) {
    for (const delay of HEYGEN_FALLBACK_POLL_DELAYS) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      const status = await heygenApi.getVideoStatus(videoId, payload);
      const nextStatus = String(status.jobStatus || "processing").toLowerCase();
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
      setErrorMessage("Vui long chon avatar truoc khi tao video.");
      return;
    }
    const hasAudio = Boolean(selectedAudioRecordId);
    if (!hasAudio) {
      setErrorMessage("Vui long chon audio ElevenLabs de tao video.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");
    setJobStatus("processing");
    setJobVideoUrl("");

    try {
      const payload: {
        avatarId: string;
        audioRecordId?: string;
        audioUrl?: string;
        enableCaption?: boolean;
        aspectRatio: "16:9" | "9:16" | "1:1";
        resolution: "720p";
        engineType: "avatar_v" | "avatar_iv" | "avatar_iii";
        title: string;
        description: string;
      } = {
        avatarId: selectedAvatarId,
        audioRecordId: selectedAudioRecordId || undefined,
        audioUrl: selectedAudio?.url || undefined,
        enableCaption,
        aspectRatio: "16:9",
        resolution: "720p" as const,
        engineType: selectedModel.engineType,
        title: "Video nguoi noi",
        description: "Video avatar voi HeyGen Studio",
      };

      const created = await heygenApi.createAvatarVideo(payload);
      setJobStatus(String(created.jobStatus || "processing").toLowerCase());
      const finalStatus = await pollVideoStatus(created.videoId, payload);
      if (!finalStatus?.videoUrl) {
        setWarnings((current) => current.includes("Video dang cho webhook/lich su cap nhat. Ban xem truc tiep trong lich su ben duoi.") ? current : ["Video dang cho webhook/lich su cap nhat. Ban xem truc tiep trong lich su ben duoi.", ...current]);
      }
      const historyRes = await heygenApi.getVideoHistory();
      setHistory(historyRes.history || []);
      setHasLoadedHistory(true);
      if (!finalStatus?.videoUrl) {
        const matched = (historyRes.history || []).find((item: any) => (item.videoId || item.id || item._id) === created.videoId);
        if (matched?.url) setJobVideoUrl(matched.url);
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
      await reloadHistoryData();
    } catch (error: any) {
      setErrorMessage(error.message || "Khong the xoa video");
    }
  }

  function handleReuseRecent(item: any) {
    const nextAvatarId = String(item?.metadata?.heygenAvatarId || "").trim();
    const nextAudioRecordId = String(item?.metadata?.heygenAudioRecordId || "").trim();
    const nextAudioUrl = String(item?.metadata?.heygenAudioUrl || "").trim();
    const nextModel = String(item?.model || item?.metadata?.title || "").trim();

    if (nextAvatarId && avatars.some((avatar) => avatar.id === nextAvatarId)) {
      setSelectedAvatarId(nextAvatarId);
    }

    if (nextAudioRecordId && audioRecords.some((record) => record._id === nextAudioRecordId)) {
      setSelectedAudioRecordId(nextAudioRecordId);
    } else if (nextAudioUrl) {
      const matchedAudio = audioRecords.find((record) => record.url === nextAudioUrl);
      if (matchedAudio) {
        setSelectedAudioRecordId(matchedAudio._id);
      }
    }

    if (nextModel && HEYGEN_MODEL_OPTIONS.some((option) => option.id === nextModel)) {
      setSelectedAvatarModel(nextModel);
    }

    setActiveTab("avatar");
    setIsDrawerOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-5 px-2">
      <div className={`flex h-[calc(100vh-190px)] min-h-[560px] max-h-[760px] w-full overflow-hidden rounded-[24px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} shadow-sm transition-all duration-300`}>
        <HeyGenVideoPreview
          selectedAvatar={selectedAvatar}
          script={selectedAudio?.prompt || selectedAudio?.metadata?.title || ""}
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
        />

        {isDrawerOpen ? (
          <Suspense fallback={<DrawerFallback />}>
            <HeyGenOptionsDrawer
              activeTab={activeTab}
              onClose={() => setIsDrawerOpen(false)}
              selectedAvatar={selectedAvatar}
              selectedAudio={selectedAudio}
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
            />
          </Suspense>
        ) : null}

        <HeyGenVerticalToolbar activeTab={activeTab} onChangeTab={(tab) => { setActiveTab(tab); setIsDrawerOpen(true); }} />
      </div>

      {(errorMessage || warnings.length > 0 || jobStatus) ? (
        <div className={`rounded-2xl border p-4 text-xs font-semibold ${errorMessage ? "border-rose-200 bg-rose-50 text-rose-700" : "border-cyan-200 bg-cyan-50 text-cyan-700"}`}>
          {errorMessage ? <p className="font-bold">{errorMessage}</p> : null}
          {!errorMessage && warnings.length > 0 ? <p className="font-bold">{warnings[0]}</p> : null}
          {!errorMessage && !warnings.length && jobStatus ? <p className="font-bold">Trang thai render: {jobStatus}</p> : null}
        </div>
      ) : null}

      <div ref={historySectionRef} className={`rounded-[24px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} p-5 text-slate-900 shadow-sm md:p-6`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-2xl font-bold tracking-tight text-slate-900">Lich su tao video</h4>
            <p className="text-sm text-slate-500">Xem va tai xuong cac video avatar da hoan thanh cua ban</p>
          </div>
          <span className={`rounded-full border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-3 py-1 text-xs font-semibold text-slate-600`}>{history.length} video</span>
        </div>

        {!hasLoadedHistory ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <p className="text-sm">Lich su se duoc tai khi ban cuon xuong day.</p>
          </div>
        ) : isLoadingHistory && history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <p className="text-sm">Dang tai lich su video...</p>
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-6">
            <div className="grid gap-6">
              {paginatedHistory.map((item) => (
                <div key={item._id}>
                  <HeyGenVideoItem
                    item={item}
                    onPlay={(url) => setPreviewVideoUrl(url)}
                    onReuse={handleReuseRecent}
                    onDelete={handleDeleteHistory}
                    onStatusUpdate={(updatedItem) => setHistory((current) => current.map((historyItem) => historyItem._id === updatedItem._id ? updatedItem : historyItem))}
                  />
                </div>
              ))}
            </div>

            {totalHistoryPages > 1 ? (
              <div className={`flex flex-col gap-3 rounded-[18px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}>
                <p className="text-sm text-slate-500">Trang {historyPage}/{totalHistoryPages}</p>
                <div className="flex items-center gap-2">
                  <PagerButton disabled={historyPage === 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}>Truoc</PagerButton>
                  <PagerButton disabled={historyPage === totalHistoryPages} onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))}>Sau</PagerButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <p className="text-sm">Chua co video HeyGen nao duoc tao.</p>
          </div>
        )}
      </div>

      {previewVideoUrl ? (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm cursor-pointer"
          onClick={() => setPreviewVideoUrl("")}
        >
          <div 
            className="relative w-full max-w-5xl rounded-[28px] bg-white p-3 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button" 
              onClick={() => setPreviewVideoUrl("")} 
              className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 text-white shadow-md transition hover:scale-105 hover:bg-slate-950"
              title="Đóng xem trước"
            >
              <X className="h-5 w-5" />
            </button>
            <video src={previewVideoUrl} controls autoPlay playsInline className="aspect-video w-full rounded-[22px] bg-white object-contain" style={{ objectPosition: "center top" }} />
          </div>
        </div>
      ) : null}

      {isAvatarPickerOpen ? (
        <Suspense fallback={<ModalFallback label="Dang tai avatar picker..." />}>
          <PickerPopover title="Replace avatar" items={avatars} selectedId={selectedAvatarId} onClose={() => setIsAvatarPickerOpen(false)} onSelect={(item) => { setSelectedAvatarId(item.id); setIsAvatarPickerOpen(false); }} emptyLabel="Chua co avatar nao duoc cap cho user nay." />
        </Suspense>
      ) : null}
      {isAudioPickerOpen ? (
        <Suspense fallback={<ModalFallback label="Dang tai voice picker..." />}>
          <AudioHistoryPopover title="Edit Voice" items={audioRecords} selectedId={selectedAudioRecordId} isLoading={isLoadingAudioHistory} onRefresh={() => void refreshAudioHistory()} onClose={() => setIsAudioPickerOpen(false)} onSelect={(item) => { setSelectedAudioRecordId(item._id); setIsAudioPickerOpen(false); }} />
        </Suspense>
      ) : null}
      {isModelPickerOpen ? (
        <Suspense fallback={<ModalFallback label="Dang tai motion engine..." />}>
          <ModelSelectionPopover title="Motion Engine" items={HEYGEN_MODEL_OPTIONS.map((item) => ({ id: item.id, description: item.description, icon: item.icon }))} selectedValue={selectedAvatarModel} onClose={() => setIsModelPickerOpen(false)} onSelect={(value) => { setSelectedAvatarModel(value); setIsModelPickerOpen(false); }} />
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
