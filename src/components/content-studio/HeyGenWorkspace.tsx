import { useMemo, useState } from 'react';
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

const AVATAR_PRESETS = [
  { id: 'avt-01', name: 'Linh Host', role: 'MC san pham', accent: 'VI - Bac', color: 'from-amber-100 to-orange-200' },
  { id: 'avt-02', name: 'Mia Seller', role: 'Sales advisor', accent: 'EN - US', color: 'from-sky-100 to-cyan-200' },
  { id: 'avt-03', name: 'Ken Coach', role: 'Corporate trainer', accent: 'VI - Nam', color: 'from-emerald-100 to-teal-200' },
];

const VOICE_PRESETS = [
  { id: 'voice-01', name: 'Warm Narrator', meta: 'Female, soft sell' },
  { id: 'voice-02', name: 'Energetic Host', meta: 'Male, promo style' },
  { id: 'voice-03', name: 'Studio Presenter', meta: 'Neutral, explainer' },
];

const TEMPLATE_OPTIONS = ['Product Launch', 'Social Ad', 'Talking Head', 'Training Clip'];
const ASPECT_OPTIONS = ['16:9', '9:16', '1:1'];
export function HeyGenWorkspace({ initialPrompt: _initialPrompt }: { initialPrompt?: string }) {
  const [activeMode, setActiveMode] = useState<HeyGenMode>('avatar');
  const [selectedAvatarId, setSelectedAvatarId] = useState(AVATAR_PRESETS[0].id);
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_PRESETS[0].id);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_OPTIONS[0]);
  const [template, setTemplate] = useState(TEMPLATE_OPTIONS[0]);
  const [script, setScript] = useState(
    'Xin chao, day la video gioi thieu san pham. Trong 30 giay, hay trinh bay loi ich chinh, diem khac biet va ket thuc bang loi keu goi hanh dong ro rang.'
  );

  const selectedAvatar = useMemo(
    () => AVATAR_PRESETS.find((avatar) => avatar.id === selectedAvatarId) || AVATAR_PRESETS[0],
    [selectedAvatarId]
  );
  const selectedVoice = useMemo(
    () => VOICE_PRESETS.find((voice) => voice.id === selectedVoiceId) || VOICE_PRESETS[0],
    [selectedVoiceId]
  );
  const activeModeLabel = HEYGEN_MODES.find((mode) => mode.id === activeMode)?.label || HEYGEN_MODES[0].label;

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
              <div className="w-full lg:w-[128px]">
                <button
                  type="button"
                  onClick={() => setSelectedAvatarId(nextPresetId(AVATAR_PRESETS, selectedAvatarId))}
                  className="w-full"
                >
                  <div className={`overflow-hidden rounded-[22px] bg-gradient-to-b ${selectedAvatar.color} p-[1px] shadow-sm`}>
                    <div className="flex aspect-[3/4.4] items-end rounded-[21px] bg-[linear-gradient(180deg,#314158_0%,#172033_100%)] p-3">
                      <div className="w-full rounded-[18px] bg-white/8 p-3 backdrop-blur-sm">
                        <div className="mb-6 flex justify-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/90 text-slate-800">
                            <UserRound className="h-8 w-8" />
                          </div>
                        </div>
                        <p className="text-center text-sm font-semibold text-white">{selectedAvatar.name}</p>
                        <p className="mt-1 text-center text-[11px] text-slate-300">{selectedAvatar.role}</p>
                      </div>
                    </div>
                  </div>
                </button>
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

                    <PillButton onClick={() => setSelectedVoiceId(nextPresetId(VOICE_PRESETS, selectedVoiceId))}>
                      <AudioLines className="h-4 w-4 text-slate-500" />
                      <span className="max-w-[120px] truncate">{selectedVoice.name}</span>
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
                      className="rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Generate
                    </button>
                  </div>
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
                <div className="absolute inset-y-0 left-0 w-[30%] bg-[linear-gradient(90deg,rgba(15,23,42,0.86)_0%,rgba(15,23,42,0.15)_100%)]" />
                <div className="absolute inset-y-0 right-0 w-[30%] bg-[linear-gradient(270deg,rgba(15,23,42,0.86)_0%,rgba(15,23,42,0.15)_100%)]" />
                <div className="absolute inset-y-0 left-1/2 w-[30%] -translate-x-1/2 rounded-[16px] bg-gradient-to-b from-slate-300 via-slate-500 to-slate-800 p-[2px]">
                  <div className="flex h-full items-end justify-center rounded-[14px] bg-[linear-gradient(180deg,#475569_0%,#0f172a_100%)] p-3">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] bg-white/90 text-slate-800 shadow-lg">
                      <UserRound className="h-9 w-9" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    type="button"
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-sm transition hover:scale-105"
                  >
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </button>
                </div>
                <div className="absolute bottom-3 right-3 rounded-lg bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                  00:01
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="line-clamp-3 text-2xl leading-tight text-slate-900">{script || 'Video script preview'}</p>
                <p className="mt-5 text-sm text-slate-500">1 minute ago · Avatar V</p>
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
        </div>
      </div>
    </div>
  );
}

function nextPresetId<T extends { id: string }>(items: T[], currentId: string) {
  const currentIndex = items.findIndex((item) => item.id === currentId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
  return items[nextIndex].id;
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
  children: React.ReactNode;
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

function ActionCircle({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
    >
      {children}
    </button>
  );
}
