import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  MonitorPlay,
  Play,
  Smartphone,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from 'lucide-react';
import { type HeyGenLibraryItem, heygenApi } from '../../api/heygen';

type HeyGenMode = 'avatar' | 'voice' | 'prompt';

const HEYGEN_SURFACES = ['Presenter', 'Avatar IV', 'Cinematic', 'Design a look'];

const HEYGEN_MODES: Array<{
  id: HeyGenMode;
  label: string;
  icon: typeof UserRound;
}> = [
  { id: 'avatar', label: 'Avatar Video', icon: UserRound },
  { id: 'voice', label: 'Voice Video', icon: AudioLines },
  { id: 'prompt', label: 'Prompt to Video', icon: Sparkles },
];

const TEMPLATE_OPTIONS = ['Product Launch', 'Social Ad', 'Talking Head', 'Training Clip'];
const ASPECT_OPTIONS = ['16:9', '9:16', '1:1'];
const TERMINAL_JOB_STATES = new Set(['completed', 'failed', 'error', 'canceled']);

export function HeyGenWorkspace({ initialPrompt }: { initialPrompt?: string }) {
  const [activeMode, setActiveMode] = useState<HeyGenMode>('avatar');
  const [avatars, setAvatars] = useState<HeyGenLibraryItem[]>([]);
  const [voices, setVoices] = useState<HeyGenLibraryItem[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [aspectRatio, setAspectRatio] = useState(ASPECT_OPTIONS[0]);
  const [template, setTemplate] = useState(TEMPLATE_OPTIONS[0]);
  const [script, setScript] = useState(
    initialPrompt ||
      'Xin chao, day la video gioi thieu san pham. Trong 30 giay, hay trinh bay loi ich chinh, diem khac biet va ket thuc bang loi keu goi hanh dong ro rang.'
  );
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [jobVideoId, setJobVideoId] = useState<string>('');
  const [jobVideoUrl, setJobVideoUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);

  const selectedAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) || avatars[0] || null,
    [avatars, selectedAvatarId]
  );
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) || voices[0] || null,
    [voices, selectedVoiceId]
  );
  const activeModeLabel = HEYGEN_MODES.find((mode) => mode.id === activeMode)?.label || HEYGEN_MODES[0].label;

  useEffect(() => {
    void loadWorkspaceData();
  }, []);

  async function loadWorkspaceData() {
    setIsLoadingLibrary(true);
    setErrorMessage('');
    try {
      const [libraryRes, historyRes] = await Promise.all([
        heygenApi.getLibrary(),
        heygenApi.getVideoHistory(),
      ]);

      const nextAvatars = libraryRes.avatars || [];
      const nextVoices = libraryRes.voices || [];

      setAvatars(nextAvatars);
      setVoices(nextVoices);
      setWarnings(libraryRes.warnings || []);
      setSelectedAvatarId((current) => current || nextAvatars[0]?.id || '');
      setSelectedVoiceId((current) => current || nextVoices[0]?.id || '');
      setHistory(historyRes.history || []);
    } catch (error: any) {
      setErrorMessage(error.message || 'Khong the tai du lieu HeyGen');
    } finally {
      setIsLoadingLibrary(false);
    }
  }

  async function pollVideoStatus(videoId: string, payload: {
    avatarId: string;
    voiceId: string;
    script: string;
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
        aspectRatio,
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
      setErrorMessage(error.message || 'Khong the tao video avatar');
      setJobStatus('failed');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-2">
      <div className="space-y-5">
        <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#fdfefe_0%,#f4f8fb_100%)] p-4 shadow-sm md:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {HEYGEN_SURFACES.map((item) => {
              const isActive = item === 'Avatar IV';
              return (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbfe_0%,#eef4f9_100%)] p-4 shadow-inner md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="w-full lg:w-[180px]">
                <div className={`overflow-hidden rounded-[22px] bg-gradient-to-b ${selectedAvatar ? 'from-amber-100 to-orange-200' : 'from-slate-200 to-slate-300'} p-[1px] shadow-sm`}>
                  <div className="flex aspect-[3/4.2] items-end rounded-[21px] bg-[linear-gradient(180deg,#314158_0%,#172033_100%)] p-3">
                    <div className="w-full rounded-[18px] bg-white/8 p-3 backdrop-blur-sm">
                      <div className="mb-6 flex justify-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/90 text-slate-800">
                          <UserRound className="h-8 w-8" />
                        </div>
                      </div>
                      <p className="text-center text-sm font-semibold text-white">{selectedAvatar?.name || 'Avatar'}</p>
                      <p className="mt-1 text-center text-[11px] text-slate-300">{selectedAvatar?.accent || selectedAvatar?.language || 'HeyGen Library'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                  <span>Video Script</span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-600">
                    {activeModeLabel}
                  </span>
                </div>

                <textarea
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  placeholder="Type your script, or upload/record"
                  className="min-h-[120px] w-full resize-none border-0 bg-transparent text-lg leading-8 text-slate-900 outline-none placeholder:text-slate-400 md:min-h-[140px] md:text-[20px]"
                />

                <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <PillButton onClick={() => setActiveMode('avatar')}>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 to-violet-500 text-slate-950">
                        <Sparkles className="h-3 w-3" />
                      </div>
                      Avatar V
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </PillButton>

                    <PillButton onClick={() => setActiveMode('prompt')}>
                      <MonitorPlay className="h-4 w-4 text-slate-500" />
                      Motion
                    </PillButton>

                    <PillButton>
                      <AudioLines className="h-4 w-4 text-slate-500" />
                      <span className="max-w-[120px] truncate">{selectedVoice?.name || 'Voice'}</span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                        <Play className="h-3 w-3 fill-current" />
                      </span>
                    </PillButton>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <PillButton onClick={() => setAspectRatio(nextValue(ASPECT_OPTIONS, aspectRatio))}>
                      <Smartphone className="h-4 w-4 text-slate-500" />
                      {aspectRatio}
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </PillButton>

                    <PillButton onClick={() => setTemplate(nextValue(TEMPLATE_OPTIONS, template))}>
                      {template === 'Social Ad' ? '1080p' : '720p'}
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </PillButton>

                    <button
                      type="button"
                      onClick={() => void handleGenerate()}
                      disabled={isGenerating || !script.trim() || !selectedAvatarId || !selectedVoiceId}
                      className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HeyGen Avatar</p>
                    <select
                      value={selectedAvatarId}
                      onChange={(event) => setSelectedAvatarId(event.target.value)}
                      className="mt-2 w-full border-0 bg-transparent text-sm text-slate-900 outline-none"
                    >
                      {avatars.length === 0 ? <option value="">Khong co avatar</option> : null}
                      {avatars.map((avatar) => (
                        <option key={avatar.id} value={avatar.id}>
                          {avatar.name} ({avatar.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HeyGen Voice</p>
                    <select
                      value={selectedVoiceId}
                      onChange={(event) => setSelectedVoiceId(event.target.value)}
                      className="mt-2 w-full border-0 bg-transparent text-sm text-slate-900 outline-none"
                    >
                      {voices.length === 0 ? <option value="">Khong co voice</option> : null}
                      {voices.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name} ({voice.id})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
                    Trang thai: {jobStatus || (isLoadingLibrary ? 'loading' : 'idle')}
                  </span>
                  {jobVideoId ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">
                      Job: {jobVideoId}
                    </span>
                  ) : null}
                  {errorMessage ? <span className="text-rose-600">{errorMessage}</span> : null}
                  {!errorMessage && warnings.length > 0 ? <span className="text-amber-600">{warnings[0]}</span> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="text-xl font-bold tracking-tight text-slate-900">Recent Creations</h4>
            <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
              All Projects
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#eef4f9_0%,#e8f0f7_100%)] p-3 shadow-sm">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,#253142_0%,#111827_62%,#09090b_100%)]">
                {jobVideoUrl ? <video src={jobVideoUrl} controls className="absolute inset-0 z-10 h-full w-full object-cover" /> : null}
                <div className="absolute inset-y-0 left-0 w-[30%] bg-[linear-gradient(90deg,rgba(15,23,42,0.86)_0%,rgba(15,23,42,0.15)_100%)]" />
                <div className="absolute inset-y-0 right-0 w-[30%] bg-[linear-gradient(270deg,rgba(15,23,42,0.86)_0%,rgba(15,23,42,0.15)_100%)]" />
                <div className="absolute inset-y-0 left-1/2 w-[30%] -translate-x-1/2 rounded-[16px] bg-gradient-to-b from-slate-300 via-slate-500 to-slate-800 p-[2px]">
                  <div className="flex h-full items-end justify-center rounded-[14px] bg-[linear-gradient(180deg,#475569_0%,#0f172a_100%)] p-3">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] bg-white/90 text-slate-800 shadow-lg">
                      <UserRound className="h-9 w-9" />
                    </div>
                  </div>
                </div>
                {!jobVideoUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-sm transition hover:scale-105"
                    >
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </button>
                  </div>
                ) : null}
                <div className="absolute bottom-3 right-3 z-20 rounded-lg bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                  {jobStatus || 'Idle'}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="line-clamp-3 text-2xl leading-tight text-slate-900">{script || 'Video script preview'}</p>
                <p className="mt-5 text-sm text-slate-500">
                  {history[0]?.createdAt ? new Date(history[0].createdAt).toLocaleString('vi-VN') : 'Chua co video'} · Avatar V
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <ActionCircle><ThumbsUp className="h-4 w-4" /></ActionCircle>
                <ActionCircle><ThumbsDown className="h-4 w-4" /></ActionCircle>
                <ActionCircle><Copy className="h-4 w-4" /></ActionCircle>
                <ActionCircle><Download className="h-4 w-4" /></ActionCircle>
                <ActionCircle><Ellipsis className="h-4 w-4" /></ActionCircle>
              </div>
            </div>
          </div>

          {history.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {history.slice(0, 6).map((item) => (
                <div key={item._id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.prompt}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.metadata?.status || 'processing'} · {item.metadata?.heygenVideoId || 'HeyGen video'}</p>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700"
                    >
                      Xem video
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                      Dang xu ly
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
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
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function ActionCircle({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
    >
      {children}
    </button>
  );
}
