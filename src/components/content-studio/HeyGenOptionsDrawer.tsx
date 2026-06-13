import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Grip, LoaderCircle, Plus, SlidersHorizontal, Trash2, Tv, Volume2, X } from "lucide-react";
import { type HeyGenTab } from "./HeyGenVerticalToolbar";
import { HEYGEN_CAPTION_FONTS, HEYGEN_CAPTION_STYLES, HEYGEN_THEME } from "./heygenTheme";

interface HeyGenOptionsDrawerProps {
  activeTab: HeyGenTab;
  onClose: () => void;
  selectedAvatar?: any;
  selectedAudio?: any;
  onOpenAvatarPicker: () => void;
  onOpenVoicePicker: () => void;
  onOpenModelPicker: () => void;
  selectedAvatarModel: string;
  selectedAvatarModelDescription?: string;
  avatarBackground: "customize" | "remove" | "color";
  setAvatarBackground: (bg: "customize" | "remove" | "color") => void;
  avatarLayout: "original" | "circle";
  setAvatarLayout: (layout: "original" | "circle") => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  enableCaption: boolean;
  setEnableCaption: (val: boolean) => void;
  captionPreset: "brand" | "clean" | "outline" | "highlight";
  setCaptionPreset: (preset: "brand" | "clean" | "outline" | "highlight") => void;
  captionFontFamily: string;
  setCaptionFontFamily: (font: string) => void;
  captionFontSize: number;
  setCaptionFontSize: (size: number) => void;
  captionPrimaryColor: string;
  setCaptionPrimaryColor: (color: string) => void;
  captionSecondaryColor: string;
  setCaptionSecondaryColor: (color: string) => void;
  captionPosition: "top" | "middle" | "bottom";
  setCaptionPosition: (position: "top" | "middle" | "bottom") => void;
  isGenerating: boolean;
  onRender: () => void;
}

export function HeyGenOptionsDrawer(props: HeyGenOptionsDrawerProps) {
  const {
    activeTab,
    onClose,
    selectedAvatar,
    selectedAudio,
    onOpenAvatarPicker,
    onOpenVoicePicker,
    onOpenModelPicker,
    selectedAvatarModel,
    selectedAvatarModelDescription,
    avatarBackground,
    setAvatarBackground,
    avatarLayout,
    setAvatarLayout,
    backgroundColor,
    setBackgroundColor,
    enableCaption,
    setEnableCaption,
    captionPreset,
    setCaptionPreset,
    captionFontFamily,
    setCaptionFontFamily,
    captionFontSize,
    setCaptionFontSize,
    captionPrimaryColor,
    setCaptionPrimaryColor,
    captionSecondaryColor,
    setCaptionSecondaryColor,
    captionPosition,
    setCaptionPosition,
    isGenerating,
    onRender,
  } = props;

  return (
    <div className={`flex h-full w-[340px] shrink-0 flex-col border-l ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} text-slate-900 xl:w-[360px] transition-all duration-300`}>
      <div className={`flex items-center justify-between border-b ${HEYGEN_THEME.border} px-4 py-3`}>
        <h3 className="text-sm font-bold text-slate-900">
          {activeTab === "avatar" && "Edit Avatar"}
          {activeTab === "captions" && "Captions"}
        </h3>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {activeTab === "avatar" && (
          <>
            <OptionCard onClick={onOpenAvatarPicker}>
              <div className="flex items-center gap-3">
                {selectedAvatar?.previewImage ? <img src={selectedAvatar.previewImage} alt={selectedAvatar.name || "Avatar"} loading="lazy" decoding="async" className="h-12 w-12 rounded-2xl object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-600">A</div>}
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedAvatar?.name || "Replace avatar"}</p>
                  <p className="text-xs text-slate-500">{selectedAvatar?.language || selectedAvatar?.gender || "HeyGen library"}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </OptionCard>

            <OptionCard onClick={onOpenVoicePicker}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedAudio?.metadata?.title || selectedAudio?.metadata?.voiceName || "Switch voice"}</p>
                  <p className="text-xs text-slate-500">ElevenLabs audio source</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </OptionCard>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900">Motion Engine</p>
              <button type="button" onClick={onOpenModelPicker} className={`flex w-full items-center justify-between rounded-[20px] border ${HEYGEN_THEME.accentBorder} ${HEYGEN_THEME.surfaceMuted} px-4 py-3 text-left shadow-[0_0_0_1px_rgba(34,211,238,0.1)] transition-all duration-200 hover:bg-cyan-50/60`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 via-violet-200 to-slate-300 text-[11px] font-bold text-slate-900">
                    {selectedAvatarModel.replace("Avatar ", "")}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedAvatarModel}</p>
                    <p className="text-xs text-slate-500">{selectedAvatarModelDescription || "Motion adapts to script."}</p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900">Avatar Background</p>
              <div className="grid grid-cols-3 gap-2">
                <ToggleCard active={avatarBackground === "customize"} onClick={() => setAvatarBackground("customize")} label="Customize" icon={<Plus className="h-4 w-4" />} />
                <ToggleCard active={avatarBackground === "remove"} onClick={() => setAvatarBackground("remove")} label="Remove" icon={<Tv className="h-4 w-4" />} />
                <ToggleCard active={avatarBackground === "color"} onClick={() => setAvatarBackground("color")} label="Color" icon={<div className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor }} />} />
              </div>
              {avatarBackground === "color" && (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
                  <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-xl border-0 bg-transparent" />
                  <input type="text" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className={`flex-1 rounded-xl border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-3 py-2 text-xs uppercase text-slate-700 outline-none`} />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900">Layout</p>
              <div className={`grid grid-cols-2 gap-2 rounded-2xl border ${HEYGEN_THEME.border} bg-white/[0.02] p-1`}>
                <SegmentButton active={avatarLayout === "original"} onClick={() => setAvatarLayout("original")} label="Original" />
                <SegmentButton active={avatarLayout === "circle"} onClick={() => setAvatarLayout("circle")} label="Circle" />
              </div>
            </div>
          </>
        )}

        {activeTab === "captions" && (
          <div className="space-y-5">
            <div className={`rounded-[22px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">Auto captions</p>
                  <p className="text-xs text-slate-500">Mac dinh dang tat. Keo block caption ben duoi vao preview de them nhanh, hoac tat/xoa ngay tren preview.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" checked={enableCaption} onChange={(e) => setEnableCaption(e.target.checked)} className="peer sr-only" />
                  <div className="peer h-6 w-11 rounded-full border border-slate-200 bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-all after:content-[''] peer-checked:border-cyan-500 peer-checked:bg-cyan-500 peer-checked:after:translate-x-full" />
                </label>
              </div>
            </div>

            <div
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-heygen-caption", "caption");
                event.dataTransfer.effectAllowed = "move";
              }}
              className="cursor-grab rounded-[20px] border border-dashed border-cyan-300 bg-cyan-50 p-4 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-100 active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-700">Drag To Preview</p>
                <button
                  type="button"
                  onClick={() => setEnableCaption(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[10px] font-bold text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Xoa caption
                </button>
              </div>
              <div className="mt-3 flex min-h-[76px] items-center justify-center rounded-[16px] border border-cyan-200 bg-white text-center shadow-sm">
                <div className="space-y-2 px-3 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-700">
                    <Grip className="h-3 w-3" />
                    Caption
                  </span>
                  <p className="text-sm font-semibold text-slate-900">Keo block nay vao video preview</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-900">Caption Styles</p>
              <div className="grid grid-cols-1 gap-3">
                {HEYGEN_CAPTION_STYLES.map((style) => {
                  const isActive = captionPreset === style.id;
                  return (
                    <button key={style.id} type="button" onClick={() => setCaptionPreset(style.id)} className={`rounded-[20px] border p-3 text-left transition-all duration-200 ${isActive ? "border-cyan-400 bg-cyan-400/10 shadow-sm" : `border-slate-200 ${HEYGEN_THEME.surfaceMuted} hover:bg-white`}`}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{style.label}</p>
                      <div className="flex min-h-[72px] items-center justify-center rounded-[16px] bg-slate-900/80 px-4 text-center">
                        <span
                          className={`${style.id === "outline" ? "font-extrabold uppercase text-white [text-shadow:-1px_-1px_0_#111,1px_-1px_0_#111,-1px_1px_0_#111,1px_1px_0_#111]" : style.id === "clean" ? "rounded-md bg-white px-3 py-2 font-medium text-zinc-700" : style.id === "highlight" ? "rounded-md bg-white px-3 py-2 font-bold text-zinc-800" : "font-bold italic"}`}
                          style={{ fontFamily: captionFontFamily, fontSize: style.id === "outline" ? "18px" : "17px", color: style.id === "brand" ? captionSecondaryColor : undefined }}
                        >
                          {style.id === "brand" ? <><span style={{ color: captionPrimaryColor }}>Bring your</span>{" "}<span style={{ color: captionSecondaryColor }}>story to life</span></> : style.sample}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Panel title="Text">
              <select value={captionFontFamily} onChange={(e) => setCaptionFontFamily(e.target.value)} className={`w-full rounded-xl border ${HEYGEN_THEME.border} bg-white px-3 py-2 text-sm text-slate-700 outline-none`}>
                {HEYGEN_CAPTION_FONTS.map((font) => <option key={font} value={font} className="text-slate-900">{font.replaceAll("\"", "")}</option>)}
              </select>
              <div className="mt-3 flex items-center gap-3">
                <input type="range" min="18" max="56" step="1" value={captionFontSize} onChange={(e) => setCaptionFontSize(parseInt(e.target.value, 10))} className="flex-1 accent-cyan-400" />
                <span className="w-10 text-right text-sm font-bold text-slate-700">{captionFontSize}</span>
              </div>
            </Panel>

            <Panel title="Style">
              <div className="flex items-center gap-3">
                <ColorField label="Primary" value={captionPrimaryColor} onChange={setCaptionPrimaryColor} />
                <ColorField label="Secondary" value={captionSecondaryColor} onChange={setCaptionSecondaryColor} />
              </div>
            </Panel>
          </div>
        )}
      </div>

      <div className={`border-t ${HEYGEN_THEME.border} bg-white/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-white/90`}>
        <button type="button" onClick={onRender} disabled={isGenerating} className={`flex w-full items-center justify-center gap-2 rounded-[18px] ${HEYGEN_THEME.accentSolid} px-4 py-3 text-sm font-bold text-white transition-all duration-200 ${HEYGEN_THEME.accentSolidHover} hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0`}>
          {isGenerating ? <><LoaderCircle className="h-4 w-4 animate-spin" />Rendering...</> : <><SlidersHorizontal className="h-4 w-4" />Render Scene</>}
        </button>
      </div>
    </div>
  );
}

function OptionCard({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-[20px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-3 text-left transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-50/40 hover:shadow-sm`}>{children}</button>;
}

function ToggleCard({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border px-2 py-3 text-[11px] font-semibold transition-all duration-200 ${active ? "border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm" : `${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-slate-600 hover:bg-white`}`}>
      <div className="mb-1 flex justify-center">{icon}</div>
      {label}
    </button>
  );
}

function SegmentButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={`rounded-xl py-2 text-xs font-bold transition ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{label}</button>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className={`space-y-3 rounded-[20px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-4`}><p className="text-sm font-bold text-slate-900">{title}</p>{children}</div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-11 cursor-pointer rounded-full border-0 bg-transparent" />
    </div>
  );
}
