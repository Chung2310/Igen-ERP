import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  LoaderCircle,
  Pencil,
  MonitorPlay,
  Play,
  Smartphone,
  Sparkles,
  UserRound,
  X,
  Lightbulb,
  Trash2,
} from 'lucide-react';
import { type HeyGenLibraryItem, heygenApi } from '../../api/heygen';

type HeyGenMode = 'avatar' | 'voice' | 'prompt';

const HEYGEN_MODEL_OPTIONS = [
  {
    id: 'Avatar V',
    description: 'Chuyển động tự nhiên theo nội dung.',
    icon: 'V',
  },
  {
    id: 'Avatar IV',
    description: 'Chuyển động tiêu chuẩn, dễ dùng.',
    icon: 'IV',
  },
  {
    id: 'Avatar III',
    description: 'Phiên bản cũ của HeyGen.',
    icon: 'III',
  },
] as const;

const HEYGEN_MODES: Array<{
  id: HeyGenMode;
  label: string;
  icon: typeof UserRound;
}> = [
  { id: 'avatar', label: 'Video avatar', icon: UserRound },
  { id: 'voice', label: 'Video giọng đọc', icon: AudioLines },
  { id: 'prompt', label: 'Văn bản thành video', icon: Sparkles },
];

const TEMPLATE_OPTIONS = ['Giới thiệu sản phẩm', 'Quảng cáo mạng xã hội', 'Video người nói', 'Video đào tạo'];
const ASPECT_OPTIONS = ['16:9', '9:16', '1:1'];
const RESOLUTION_OPTIONS = ['720p', '1080p'] as const;
const TERMINAL_JOB_STATES = new Set(['completed', 'failed', 'error', 'canceled']);
const HISTORY_PAGE_SIZE = 6;

export function HeyGenWorkspace({ initialPrompt }: { initialPrompt?: string }) {
  const [activeMode, setActiveMode] = useState<HeyGenMode>('avatar');
  const [avatars, setAvatars] = useState<HeyGenLibraryItem[]>([]);
  const [voices, setVoices] = useState<HeyGenLibraryItem[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [selectedAvatarModel, setSelectedAvatarModel] = useState(HEYGEN_MODEL_OPTIONS[0].id);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_OPTIONS[0]);
  const [template, setTemplate] = useState(TEMPLATE_OPTIONS[0]);
  const [resolution, setResolution] = useState<(typeof RESOLUTION_OPTIONS)[number]>('720p');
  const [script, setScript] = useState(initialPrompt || '');
  const [motionText, setMotionText] = useState('');
  const [isMotionOpen, setIsMotionOpen] = useState(false);
  const [isMotionExpressive, setIsMotionExpressive] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [jobVideoId, setJobVideoId] = useState<string>('');
  const [jobVideoUrl, setJobVideoUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [previewVideoUrl, setPreviewVideoUrl] = useState('');

  const selectedAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) || avatars[0] || null,
    [avatars, selectedAvatarId]
  );
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) || voices[0] || null,
    [voices, selectedVoiceId]
  );
  const selectedModel = useMemo(
    () => HEYGEN_MODEL_OPTIONS.find((item) => item.id === selectedAvatarModel) || HEYGEN_MODEL_OPTIONS[0],
    [selectedAvatarModel]
  );
  const activeModeLabel = HEYGEN_MODES.find((mode) => mode.id === activeMode)?.label || HEYGEN_MODES[0].label;
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

  async function loadWorkspaceData() {
    setIsLoadingLibrary(true);
    setErrorMessage('');
    try {
      const [libraryResult, historyResult] = await Promise.allSettled([
        heygenApi.getLibrary(),
        heygenApi.getVideoHistory(),
      ]);

      if (libraryResult.status === 'fulfilled') {
        const nextAvatars = libraryResult.value.avatars || [];
        const nextVoices = libraryResult.value.voices || [];
        const defaultAvatarId = libraryResult.value.defaults?.avatarId || '';
        const defaultVoiceId = libraryResult.value.defaults?.voiceId || '';

        setAvatars(nextAvatars);
        setVoices(nextVoices);
        setWarnings(libraryResult.value.warnings || []);
        setSelectedAvatarId((current) => {
          if (current && nextAvatars.some((avatar) => avatar.id === current)) {
            return current;
          }
          if (defaultAvatarId && nextAvatars.some((avatar) => avatar.id === defaultAvatarId)) {
            return defaultAvatarId;
          }
          return nextAvatars[0]?.id || '';
        });
        setSelectedVoiceId((current) => {
          if (current && nextVoices.some((voice) => voice.id === current)) {
            return current;
          }
          if (defaultVoiceId && nextVoices.some((voice) => voice.id === defaultVoiceId)) {
            return defaultVoiceId;
          }
          return nextVoices[0]?.id || '';
        });
      } else {
        setErrorMessage(libraryResult.reason?.message || 'Không thể tải thư viện HeyGen');
      }

      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value.history || []);
      } else if (libraryResult.status === 'fulfilled') {
        setErrorMessage(historyResult.reason?.message || 'Không thể tải lịch sử HeyGen');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Không thể tải dữ liệu HeyGen');
    } finally {
      setIsLoadingLibrary(false);
    }
  }

  async function pollVideoStatus(videoId: string, payload: {
    avatarId: string;
    voiceId: string;
    script: string;
    motionText?: string;
    aspectRatio: string;
    title: string;
    description: string;
  }) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await heygenApi.getVideoStatus(videoId, payload);
      const nextStatus = String(status.jobStatus || 'processing').toLowerCase();

      setJobStatus(nextStatus);
      if (status.videoUrl) {
        setJobVideoUrl(status.videoUrl);
      }

      if (TERMINAL_JOB_STATES.has(nextStatus)) {
        if (nextStatus !== 'completed' && status.error) {
          setErrorMessage(status.error);
        }
        return status;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 6000));
    }

    setErrorMessage('Video HeyGen dang xu ly lau hon du kien. Hay kiem tra lai trong lich su.');
    return null;
  }

  async function handleGenerate() {
    if (!selectedAvatarId || !selectedVoiceId || !script.trim()) {
      setErrorMessage('Vui long chon avatar, giong doc va nhap kich ban truoc khi tao video.');
      return;
    }

    if (selectedAvatarModel === 'Avatar III') {
      setErrorMessage('Avatar III dùng API cũ của HeyGen. Vui lòng chọn Avatar IV hoặc Avatar V.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');
    setJobStatus('processing');
    setJobVideoUrl('');

    try {
      const payload = {
        avatarId: selectedAvatarId,
        voiceId: selectedVoiceId,
        script,
        motionText,
        aspectRatio,
        resolution,
        engineType:
          selectedAvatarModel === 'Avatar V'
            ? ('avatar_v' as const)
            : selectedAvatarModel === 'Avatar IV'
              ? ('avatar_iv' as const)
              : ('avatar_iii' as const),
        title: template,
        description: `${activeModeLabel} via HeyGen`,
      };

      const created = await heygenApi.createAvatarVideo({
        ...payload,
        aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
      });

      setJobVideoId(created.videoId || '');
      setJobStatus(String(created.jobStatus || 'processing').toLowerCase());

      await pollVideoStatus(created.videoId, payload);

      const historyRes = await heygenApi.getVideoHistory();
      setHistory(historyRes.history || []);
    } catch (error: any) {
      setErrorMessage(error.message || 'Không thể tạo video');
      setJobStatus('failed');
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
      setErrorMessage(error.message || 'Không thể xóa video');
    }
  }

  function handleReuseRecent(item: any) {
    if (item?.prompt) {
      setScript(item.prompt);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getDownloadUrl(item: any) {
    return item?.url || item?.captionedVideoUrl || item?.videoPageUrl || '';
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
                      setIsVoicePickerOpen(false);
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
                      setIsVoicePickerOpen(false);
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
                      setIsVoicePickerOpen(false);
                      setIsModelPickerOpen(false);
                    }}
                    className="absolute bottom-3 left-3 rounded-full bg-slate-950/78 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm"
                  >
                    Đổi avatar
                  </button>
                </div>

                {isAvatarPickerOpen ? (
                  <PickerPopover
                    title="Chọn avatar"
                    items={avatars}
                    selectedId={selectedAvatarId}
                    onClose={() => setIsAvatarPickerOpen(false)}
                    onSelect={(item) => {
                      setSelectedAvatarId(item.id);
                      setIsAvatarPickerOpen(false);
                    }}
                    emptyLabel="Không có avatar"
                  />
                ) : null}
              </div>

              <div className="flex min-h-[205px] min-w-0 flex-1 flex-col pt-3">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  <span>Kịch bản video</span>
                </div>

                <textarea
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  placeholder="Ví dụ: Xin chào, hôm nay tôi sẽ giới thiệu nhanh về sản phẩm và lợi ích nổi bật dành cho khách hàng."
                  className="min-h-[110px] w-full flex-1 resize-none border-0 bg-transparent px-0 text-[17px] leading-8 text-slate-900 outline-none placeholder:text-slate-400 md:text-[18px]"
                />

                {isMotionOpen ? (
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span>Tùy chỉnh chuyển động</span>
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
                        <span>Diễn đạt sinh động hơn</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsMotionExpressive((current) => !current)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                          isMotionExpressive ? 'bg-cyan-400' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                            isMotionExpressive ? 'translate-x-6' : 'translate-x-1'
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
                          setIsVoicePickerOpen(false);
                        }}
                      >
                        <Sparkles className="h-4 w-4 text-fuchsia-400" />
                        {selectedModel.id}
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isModelPickerOpen ? 'rotate-180' : ''}`} />
                      </PillButton>

                      {isModelPickerOpen ? (
                        <ModelSelectionPopover
                          title="Chọn mẫu chuyển động"
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
                      Chuyển động
                    </PillButton>

                    <div className="relative">
                      <PillButton
                        onClick={() => {
                          setIsVoicePickerOpen((current) => !current);
                          setIsAvatarPickerOpen(false);
                          setIsModelPickerOpen(false);
                        }}
                      >
                        <AudioLines className="h-4 w-4 text-slate-500" />
                        <span className="max-w-[180px] truncate">{selectedVoice?.name || 'Giọng đọc'}</span>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isVoicePickerOpen ? 'rotate-180' : ''}`} />
                      </PillButton>

                      {isVoicePickerOpen ? (
                        <PickerPopover
                          title="Chọn giọng đọc"
                          items={voices}
                          selectedId={selectedVoiceId}
                          onClose={() => setIsVoicePickerOpen(false)}
                          onSelect={(item) => {
                            setSelectedVoiceId(item.id);
                            setIsVoicePickerOpen(false);
                          }}
                          emptyLabel="Không có giọng đọc"
                          className="left-0 top-[calc(100%+10px)] w-[320px]"
                          compact
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

                    <PillButton onClick={() => setResolution(nextValue(RESOLUTION_OPTIONS as unknown as string[], resolution) as (typeof RESOLUTION_OPTIONS)[number])}>
                      {resolution}
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </PillButton>

                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || !script.trim() || !selectedAvatarId || !selectedVoiceId}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGenerating ? 'Đang tạo video...' : 'Tạo video'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  {jobVideoId ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
                      Mã video: {jobVideoId}
                    </span>
                  ) : null}
                  {errorMessage ? <span className="text-rose-600">{errorMessage}</span> : null}
                  {!errorMessage && warnings.length > 0 ? <span className="text-amber-600">{warnings[0]}</span> : null}
                </div>

                {(isGenerating || jobStatus || jobVideoUrl) ? (
                  <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Trạng thái tạo video</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {jobVideoUrl
                          ? 'Video đã sẵn sàng. Bạn có thể xem ngay bên dưới.'
                          : isGenerating || jobStatus === 'processing'
                            ? 'HeyGen đang xử lý video. Vui lòng chờ trong giây lát.'
                            : 'Hệ thống đang cập nhật trạng thái video.'}
                      </p>
                    </div>

                    {jobVideoUrl ? (
                      <div className="space-y-3 p-4">
                        <video
                          src={jobVideoUrl}
                          controls
                          playsInline
                          className="aspect-video w-full rounded-[18px] bg-slate-950 object-contain"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={jobVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                          >
                            Xem toàn màn hình
                          </a>
                          <a
                            href={jobVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            download="heygen-video"
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            Tải video
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="flex aspect-video w-full flex-col items-center justify-center rounded-[18px] bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_52%,#e2e8f0_100%)] text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-sm">
                            <LoaderCircle className="h-8 w-8 animate-spin text-cyan-500" />
                          </div>
                          <p className="mt-4 text-base font-semibold text-slate-900">Đang tạo video</p>
                          <p className="mt-1 max-w-md text-sm text-slate-500">
                            Video sẽ tự xuất hiện tại đây ngay khi HeyGen xử lý xong.
                          </p>
                          <div className="mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/80">
                            <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-500" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fdfefe_0%,#f4f8fb_100%)] p-4 text-slate-900 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-xl font-bold tracking-tight text-slate-900">Video gần đây</h4>
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
              Xem tất cả
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {history.length > 0 ? (
            <div className="space-y-4">
              {paginatedHistory.map((item) => (
                (() => {
                  const downloadUrl = getDownloadUrl(item);
                  const canDownload = Boolean(downloadUrl);
                  return (
                <div key={item._id} className="grid gap-4 lg:grid-cols-[minmax(320px,560px)_minmax(0,1fr)]">
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] bg-[radial-gradient(circle_at_center,#dde7f2_0%,#cddaea_60%,#bfd0e6_100%)]">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt={item.title || item.prompt || 'HeyGen video'} className="absolute inset-0 z-10 h-full w-full object-cover" />
                      ) : item.url && (item.url.startsWith('http') || item.url.startsWith('blob:') || item.url.startsWith('data:')) ? (
                        <video src={item.url} className="absolute inset-0 z-10 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900 text-[10px] font-bold text-cyan-400 uppercase tracking-widest p-2 text-center">
                          <LoaderCircle className="h-5 w-5 animate-spin mb-1" />
                          Đang xử lý
                        </div>
                      )}
                      <div className="absolute inset-y-0 left-0 w-[34%] bg-[linear-gradient(90deg,rgba(241,245,249,0.88)_0%,rgba(241,245,249,0.1)_100%)]" />
                      <div className="absolute inset-y-0 right-0 w-[34%] bg-[linear-gradient(270deg,rgba(241,245,249,0.88)_0%,rgba(241,245,249,0.1)_100%)]" />
                      <div className="absolute inset-y-0 left-1/2 w-[34%] -translate-x-1/2 overflow-hidden rounded-[18px]">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title || item.prompt || 'HeyGen video'}
                            className="h-full w-full object-cover"
                          />
                        ) : selectedAvatar?.previewImage ? (
                          <img
                            src={selectedAvatar.previewImage}
                            alt={selectedAvatar.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,#475569_0%,#0f172a_100%)] text-white">
                            <UserRound className="h-10 w-10" />
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 z-20 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            const url = getDownloadUrl(item);
                            if (url) {
                              setPreviewVideoUrl(url);
                            }
                          }}
                          className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-slate-950/35 text-white backdrop-blur-sm"
                        >
                          <Play className="ml-0.5 h-5 w-5 fill-current" />
                        </button>
                      </div>
                      <div className="absolute bottom-3 right-3 z-20 rounded-lg bg-slate-950/65 px-2.5 py-1 text-xs font-semibold text-white">
                        {item.duration ? `${Math.max(1, Math.round(item.duration))}s` : 'Video'}
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col justify-between py-2">
                    <div>
                      <p className="line-clamp-3 text-2xl leading-tight text-slate-900">{item.prompt}</p>
                      <p className="mt-5 text-sm text-slate-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : 'Chưa có video'} · {item.model || 'Avatar V'}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionCircle dark onClick={() => handleReuseRecent(item)}>
                          <Pencil className="h-4 w-4" />
                        </ActionCircle>
                        {canDownload ? (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={item.title || 'heygen-video'}
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
                          onClick={() => void handleDeleteHistory(item.videoId || item.id || item._id)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleReuseRecent(item)}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
                  );
                })()
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
                      Trước
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
              Chưa có video HeyGen nào trong lịch sử.
            </div>
          )}
        </div>
      </div>

      {previewVideoUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl rounded-[28px] bg-slate-950 p-3 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewVideoUrl('')}
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

function nextValue(values: string[], currentValue: string) {
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
                  isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-200 hover:bg-white/8'
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

function formatAvatarName(name: string) {
  if (name.length <= 14) {
    return name;
  }
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts.slice(0, -1).join(' ')}\n${parts[parts.length - 1]}`;
  }
  return name;
}

function ActionCircle({
  children,
  dark = false,
  onClick,
}: {
  children: ReactNode;
  dark?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
        dark
          ? 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
          : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
      }`}
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
  className,
  compact = false,
}: {
  title: string;
  items: HeyGenLibraryItem[];
  selectedId: string;
  onClose: () => void;
  onSelect: (item: HeyGenLibraryItem) => void;
  emptyLabel: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 p-4 backdrop-blur-[2px]">
      <div className={`w-full max-w-[min(92vw,760px)] rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_30px_80px_rgba(15,23,42,0.2)] ${className || ''}`}>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">Chọn trực tiếp từ thư viện đã cấp</p>
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
          <div className={`grid gap-3 overflow-y-auto pr-1 ${compact ? 'max-h-[70vh] grid-cols-1' : 'max-h-[70vh] grid-cols-1 sm:grid-cols-2'}`}>
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`rounded-[18px] border p-3 text-left transition ${
                    isSelected
                      ? 'border-cyan-300 bg-cyan-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.previewImage ? (
                        <img
                          src={item.previewImage}
                          alt={item.name}
                          className={`${compact ? 'h-12 w-12 rounded-xl' : 'h-20 w-16 rounded-2xl'} object-cover`}
                        />
                      ) : (
                        <div className={`flex ${compact ? 'h-12 w-12 rounded-xl' : 'h-20 w-16 rounded-2xl'} items-center justify-center bg-[linear-gradient(180deg,#e2e8f0_0%,#cbd5e1_100%)] text-slate-700`}>
                          {compact ? <AudioLines className="h-4 w-4" /> : <UserRound className="h-5 w-5" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className="truncate text-xs text-slate-500">{item.accent || item.language || item.id}</p>
                        {!compact ? <p className="mt-2 line-clamp-1 text-[11px] text-slate-400">{item.id}</p> : null}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                  {compact ? <p className="mt-3 truncate text-[11px] text-slate-400">{item.id}</p> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
