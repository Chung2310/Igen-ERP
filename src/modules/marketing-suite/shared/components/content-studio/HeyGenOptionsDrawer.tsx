/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Grip, LoaderCircle, Plus, SlidersHorizontal, Trash2, Tv, Volume2, X } from "lucide-react";
import { type HeyGenTab } from "./HeyGenVerticalToolbar";
import { HEYGEN_CAPTION_FONTS, HEYGEN_CAPTION_STYLES, HEYGEN_THEME } from "./heygenTheme";
import { HeyGenLegacyVoiceOption } from "./HeyGenLegacyVoiceOption";

interface HeyGenOptionsDrawerProps {
  activeTab: HeyGenTab;
  onClose: () => void;
  selectedAvatar?: any;
  selectedAudio?: any;
  isLoadingLibrary?: boolean;
  onOpenAvatarPicker: () => void;
  onOpenVoicePicker: () => void;
  onOpenModelPicker: () => void;
  selectedAvatarModel: string;
  selectedAvatarModelDescription?: string;
  selectedHeyGenVoice?: any;
  usePersonalVoiceMode: boolean;
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
  aspectRatio: "16:9" | "9:16" | "1:1";
  onAspectRatioChange: (ratio: "16:9" | "9:16" | "1:1") => void;
}

export function HeyGenOptionsDrawer(props: HeyGenOptionsDrawerProps) {
  const {
    activeTab,
    onClose,
    selectedAvatar,
    selectedAudio,
    isLoadingLibrary = false,
    onOpenAvatarPicker,
    onOpenVoicePicker,
    onOpenModelPicker,
    selectedAvatarModel,
    selectedAvatarModelDescription,
    selectedHeyGenVoice,
    usePersonalVoiceMode,
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
    aspectRatio,
    onAspectRatioChange,
  } = props;

  return (
    <div className={`flex h-full w-[340px] shrink-0 flex-col border-l ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} text-on-surface xl:w-[360px]`}>
      <div className={`flex items-center justify-between border-b ${HEYGEN_THEME.border} px-4 py-3`}>
        <h3 className="text-sm font-semibold text-on-surface">
          {activeTab === "avatar" && "Chỉnh sửa avatar"}
          {activeTab === "captions" && "Phụ đề và văn bản"}
        </h3>
        <button
          type="button"
          aria-label="Đóng bảng tùy chỉnh"
          onClick={onClose}
          className="rounded-lg p-1.5 text-on-surface-variant transition-colors duration-150 hover:bg-surface-container-low hover:text-on-surface cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {activeTab === "avatar" && (
          <>
            <OptionCard onClick={onOpenAvatarPicker} disabled={isLoadingLibrary}>
              <div className="flex items-center gap-3">
                {isLoadingLibrary ? (
                  <div className="flex size-11 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                    <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  </div>
                ) : selectedAvatar?.previewImage ? (
                  <img src={selectedAvatar.previewImage} alt={selectedAvatar.name || "Avatar"} loading="lazy" decoding="async" className="size-11 rounded-lg object-cover" />
                ) : (
                  <div className="flex size-11 items-center justify-center rounded-lg bg-surface-container text-sm font-medium text-on-surface-variant">A</div>
                )}
                <div>
                  <p className="text-sm font-medium text-on-surface">{isLoadingLibrary ? "Đang tải avatar" : selectedAvatar?.name || "Thay avatar"}</p>
                  <p className="text-xs text-on-surface-variant">{isLoadingLibrary ? "Đang đồng bộ thư viện…" : selectedAvatar?.language || selectedAvatar?.gender || "Thư viện AI"}</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-on-surface-variant" aria-hidden="true" />
            </OptionCard>

            {selectedAvatarModel === "Avatar III" || usePersonalVoiceMode ? (
              <HeyGenLegacyVoiceOption
                selectedVoiceName={selectedHeyGenVoice?.name}
                selectedVoiceLanguage={selectedHeyGenVoice?.language || selectedHeyGenVoice?.accent}
                onClick={onOpenVoicePicker}
              />
            ) : (
              <OptionCard onClick={onOpenVoicePicker}>
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Volume2 className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{selectedAudio?.metadata?.title || selectedAudio?.metadata?.voiceName || "Đổi giọng nói"}</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-on-surface-variant" aria-hidden="true" />
              </OptionCard>
            )}

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-on-surface">Model tạo video</p>
              <button
                type="button"
                onClick={onOpenModelPicker}
                disabled={isLoadingLibrary}
                className={`flex w-full items-center justify-between rounded-lg border ${HEYGEN_THEME.accentBorder} ${HEYGEN_THEME.surfaceMuted} px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-primary/5 cursor-pointer disabled:cursor-wait disabled:opacity-70`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {isLoadingLibrary ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : selectedAvatarModel.replace("Avatar ", "")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{isLoadingLibrary ? "Đang tải mô hình…" : selectedAvatarModel}</p>
                    <p className="text-xs text-on-surface-variant">{selectedAvatarModelDescription || "Chuyển động tự nhiên theo nội dung."}</p>
                  </div>
                </div>
                <ChevronDown className="size-4 text-on-surface-variant" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-on-surface">Nền avatar</p>
              <div className="grid grid-cols-3 gap-2">
                <ToggleCard active={avatarBackground === "customize"} onClick={() => setAvatarBackground("customize")} label="Tùy chỉnh" icon={<Plus className="size-4" aria-hidden="true" />} />
                <ToggleCard active={avatarBackground === "remove"} onClick={() => setAvatarBackground("remove")} label="Xóa nền" icon={<Tv className="size-4" aria-hidden="true" />} />
                <ToggleCard active={avatarBackground === "color"} onClick={() => setAvatarBackground("color")} label="Màu nền" icon={<div className="size-4 rounded-full border border-outline-variant" style={{ backgroundColor }} />} />
              </div>
              {avatarBackground === "color" && (
                <div className={`flex items-center gap-2 rounded-lg border ${HEYGEN_THEME.border} bg-surface-container-lowest p-2`}>
                  <input type="color" aria-label="Chọn màu nền" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="size-9 cursor-pointer rounded-md border-0 bg-transparent" />
                  <input type="text" aria-label="Mã màu nền" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className={`h-9 flex-1 rounded-md border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-3 text-xs text-on-surface focus:border-primary focus:outline-none`} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-on-surface">Bố cục</p>
              <div className={`grid grid-cols-2 gap-1 rounded-lg border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-1`}>
                <SegmentButton active={avatarLayout === "original"} onClick={() => setAvatarLayout("original")} label="Mặc định" />
                <SegmentButton active={avatarLayout === "circle"} onClick={() => setAvatarLayout("circle")} label="Hình tròn" />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-on-surface">Tỷ lệ khung hình</p>
              <div className={`grid grid-cols-3 gap-1 rounded-lg border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-1`}>
                <SegmentButton active={aspectRatio === "16:9"} onClick={() => onAspectRatioChange("16:9")} label="16:9" />
                <SegmentButton active={aspectRatio === "9:16"} onClick={() => onAspectRatioChange("9:16")} label="9:16" />
                <SegmentButton active={aspectRatio === "1:1"} onClick={() => onAspectRatioChange("1:1")} label="1:1" />
              </div>
            </div>
          </>
        )}

        {activeTab === "captions" && (
          <div className="space-y-4">
            <div className={`rounded-lg border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-3.5`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-on-surface">Phụ đề tự động</p>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" aria-label="Bật phụ đề tự động" checked={enableCaption} onChange={(e) => setEnableCaption(e.target.checked)} className="peer sr-only" />
                  <div className="peer h-6 w-11 rounded-full bg-outline-variant after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:bg-white after:shadow-xs after:transition-transform after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-5" />
                </label>
              </div>
            </div>

            <div
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-heygen-caption", "caption");
                event.dataTransfer.effectAllowed = "move";
              }}
              className="cursor-grab rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3.5 transition-colors duration-150 hover:border-primary hover:bg-primary/10 active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-primary">Kéo vào khung xem trước</p>
                <button
                  type="button"
                  onClick={() => setEnableCaption(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-error/25 bg-surface-container-lowest px-2 py-1 text-xs font-medium text-error transition-colors hover:bg-error/10 cursor-pointer"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                  Xóa phụ đề
                </button>
              </div>
              <div className={`mt-2.5 flex min-h-16 items-center justify-center rounded-lg border ${HEYGEN_THEME.border} bg-surface-container-lowest px-3 py-2 text-center`}>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface">
                  <Grip className="size-3.5 text-primary" aria-hidden="true" />
                  Khối phụ đề
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-on-surface">Kiểu phụ đề</p>
              <div className="grid grid-cols-1 gap-2.5">
                {HEYGEN_CAPTION_STYLES.map((style) => {
                  const isActive = captionPreset === style.id;
                  return (
                    <button key={style.id} type="button" onClick={() => setCaptionPreset(style.id)} className={`rounded-lg border p-3 text-left transition-colors duration-150 cursor-pointer ${isActive ? "border-primary bg-primary/10" : `${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} hover:bg-surface-container-lowest`}`}>
                      <p className="mb-2 text-xs font-medium text-on-surface-variant">{style.label}</p>
                      <div className="flex min-h-16 items-center justify-center rounded-md bg-slate-900 px-3 text-center">
                        <span
                          className={`${style.id === "outline" ? "font-bold text-white [text-shadow:-1px_-1px_0_#111,1px_-1px_0_#111,-1px_1px_0_#111,1px_1px_0_#111]" : style.id === "clean" ? "rounded-md bg-white px-3 py-1.5 font-medium text-zinc-800" : style.id === "highlight" ? "rounded-md bg-white px-3 py-1.5 font-semibold text-zinc-900" : "font-semibold italic"}`}
                          style={{ fontFamily: captionFontFamily, fontSize: style.id === "outline" ? "17px" : "16px", color: style.id === "brand" ? captionSecondaryColor : undefined }}
                        >
                          {style.id === "brand" ? <><span style={{ color: captionPrimaryColor }}>Bring your</span>{" "}<span style={{ color: captionSecondaryColor }}>story to life</span></> : style.sample}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Panel title="Văn bản">
              <select
                aria-label="Phông chữ phụ đề"
                value={captionFontFamily}
                onChange={(e) => setCaptionFontFamily(e.target.value)}
                className={`h-9 w-full rounded-md border ${HEYGEN_THEME.border} bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none`}
              >
                {HEYGEN_CAPTION_FONTS.map((font) => <option key={font} value={font}>{font.replaceAll("\"", "")}</option>)}
              </select>
              <div className="mt-2.5 flex items-center gap-3">
                <input type="range" aria-label="Cỡ chữ phụ đề" min="18" max="56" step="1" value={captionFontSize} onChange={(e) => setCaptionFontSize(parseInt(e.target.value, 10))} className="flex-1 accent-primary" />
                <span className="w-10 text-right text-sm font-medium tabular-nums text-on-surface">{captionFontSize}</span>
              </div>
            </Panel>

            <Panel title="Màu sắc">
              <div className="flex items-center gap-4">
                <ColorField label="Màu chính" value={captionPrimaryColor} onChange={setCaptionPrimaryColor} />
                <ColorField label="Màu phụ" value={captionSecondaryColor} onChange={setCaptionSecondaryColor} />
              </div>
            </Panel>
          </div>
        )}
      </div>

      <div className={`border-t ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} p-4`}>
        <button
          type="button"
          onClick={onRender}
          disabled={isGenerating}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg ${HEYGEN_THEME.accentSolid} px-4 py-2.5 text-sm font-medium text-on-primary transition-colors duration-150 ${HEYGEN_THEME.accentSolidHover} cursor-pointer disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isGenerating ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang render…</> : <><SlidersHorizontal className="size-4" aria-hidden="true" />Render video</>}
        </button>
      </div>
    </div>
  );
}

function OptionCard({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`flex w-full items-center justify-between rounded-lg border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-3 text-left transition-colors duration-150 hover:border-primary hover:bg-primary/5 cursor-pointer disabled:cursor-wait disabled:opacity-70`}>{children}</button>;
}

function ToggleCard({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${active ? "border-primary bg-primary/10 text-primary" : `${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface`}`}>
      <div className="mb-1 flex justify-center">{icon}</div>
      {label}
    </button>
  );
}

function SegmentButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} className={`rounded-md py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${active ? "bg-surface-container-lowest text-on-surface shadow-xs" : "text-on-surface-variant hover:text-on-surface"}`}>{label}</button>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className={`space-y-2.5 rounded-lg border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} p-3.5`}><p className="text-sm font-medium text-on-surface">{title}</p>{children}</div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-on-surface-variant">{label}</p>
      <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="size-10 cursor-pointer rounded-md border-0 bg-transparent" />
    </div>
  );
}
