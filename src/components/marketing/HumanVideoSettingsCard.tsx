import React, { useMemo, useState } from "react";
import { BookOpen, Check, Play, Search, Video, X } from "lucide-react";
import type { HeyGenLibraryItem } from "../../api/heygen";

interface HumanVideoSettingsCardProps {
  selectedAvatar: string;
  selectedVoice: string;
  selectedVoiceModel: string;
  estimatedDurationSeconds: string;
  avatars: HeyGenLibraryItem[];
  voices: Array<{
    voice_id?: string;
    id?: string;
    name?: string;
    label?: string;
    description?: string;
    category?: string;
  }>;
  isLoadingAvatars: boolean;
  isLoadingVoices: boolean;
  isPreviewingVoice: boolean;
  onAvatarChange: (value: string) => void;
  onVoiceChange: (value: string) => void;
  onVoiceModelChange: (value: string) => void;
  onEstimatedDurationChange: (value: string) => void;
  onPreviewVoice: (voiceId?: string) => void;

  // New props for Engine Type & HeyGen native voices
  selectedEngineType: string;
  onEngineTypeChange: (value: string) => void;
  heygenVoices: HeyGenLibraryItem[];
  isAutoPilot?: boolean;
  inputText?: string;
  onInputTextChange?: (value: string) => void;
}

const ENGINE_OPTIONS = [
  {
    value: "avatar_iv",
    label: "Avatar IV (Chất lượng cao)",
    description: "Biểu cảm tự nhiên, tích hợp giọng nói iGen audio cao cấp."
  },
  {
    value: "avatar_v",
    label: "Avatar V (Phát thanh viên)",
    description: "Phong cách chuẩn thuyết trình doanh nghiệp dài."
  },
  {
    value: "avatar_iii",
    label: "Avatar III (Tốc độ cao - Direct Text)",
    description: "Nhập text trực tiếp không qua iGen audio, tối ưu hóa tốc độ dựng."
  }
];

const VOICE_MODEL_OPTIONS = [
  {
    value: "eleven_turbo_v2_5",
    label: "iGen Audio Turbo v2.5",
    description: "Tự nhiên hơn, hợp lời đọc dài."
  },
  {
    value: "eleven_flash_v2_5",
    label: "iGen Audio Flash v2.5",
    description: "Nhanh hơn, hợp video social ngắn."
  }
];

function getVoiceKey(voice: any) {
  return voice?.voice_id || voice?.id || "";
}

function getVoiceName(voice: any) {
  return voice?.label || voice?.name || "Chọn giọng đọc";
}

function getVoiceDesc(voice: any) {
  if (voice?.description) {
    const desc = String(voice.description);
    if (!desc.toLowerCase().includes("easy")) {
      return desc;
    }
  }
  const parts = [voice?.gender, voice?.language, voice?.accent]
    .filter(Boolean)
    .filter((p) => {
      if (typeof p !== "string") return false;
      const lower = p.toLowerCase();
      return (
        lower !== "unknown" &&
        lower !== "vietnamese" &&
        lower !== "vietnam" &&
        !lower.includes("easy")
      );
    });
  return parts.join(" • ") || voice?.category || "Giọng nói mặc định";
}

export default function HumanVideoSettingsCard({
  selectedAvatar,
  selectedVoice,
  selectedVoiceModel,
  estimatedDurationSeconds,
  avatars,
  voices,
  isLoadingAvatars,
  isLoadingVoices,
  isPreviewingVoice,
  onAvatarChange,
  onVoiceChange,
  onVoiceModelChange,
  onEstimatedDurationChange,
  onPreviewVoice,
  selectedEngineType,
  onEngineTypeChange,
  heygenVoices,
  isAutoPilot = true,
  inputText = "",
  onInputTextChange
}: HumanVideoSettingsCardProps) {
  const [isVoiceLibraryOpen, setIsVoiceLibraryOpen] = useState(false);
  const [voiceTab, setVoiceTab] = useState<"my-voices" | "library">("library");
  const [searchQuery, setSearchQuery] = useState("");

  const isAvatarThree = selectedEngineType === "avatar_iii";
  const activeVoices = isAvatarThree ? heygenVoices : voices;

  const selectedAvatarItem = avatars.find((avatar) => avatar.id === selectedAvatar) || avatars[0] || null;
  const selectedVoiceItem = activeVoices.find((voice) => getVoiceKey(voice) === selectedVoice) || activeVoices[0] || null;

  const myVoices = useMemo(
    () => isAvatarThree ? [] : (activeVoices as any[]).filter((voice) => ["cloned", "generated", "custom"].includes((voice.category || "").toLowerCase())),
    [activeVoices, isAvatarThree]
  );
  const libraryVoices = useMemo(
    () => isAvatarThree ? activeVoices : (activeVoices as any[]).filter((voice) => !["cloned", "generated", "custom"].includes((voice.category || "").toLowerCase())),
    [activeVoices, isAvatarThree]
  );
  const visibleVoices = (isAvatarThree ? activeVoices : (voiceTab === "my-voices" ? myVoices : libraryVoices)).filter((voice) => {
    const keyword = searchQuery.toLowerCase();
    return (
      getVoiceName(voice).toLowerCase().includes(keyword) ||
      getVoiceDesc(voice).toLowerCase().includes(keyword)
    );
  });

  if (!isAutoPilot) {
    return (
      <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 font-mono text-xs font-extrabold uppercase tracking-wide text-slate-800">
          <Video className="h-4 w-4 text-indigo-500" />
          Cấu hình video người thật
        </div>

        {/* Engine Selection Dropdown */}
        <div className="grid grid-cols-1 gap-4">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">Mô hình Avatar (Engine)</p>
            <select
              value={selectedEngineType}
              onChange={(e) => onEngineTypeChange(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {ENGINE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              {ENGINE_OPTIONS.find((option) => option.value === selectedEngineType)?.description}
            </p>
          </section>
        </div>

        {/* Input Text Script for Avatar III */}
        {isAvatarThree && (
          <div className="grid grid-cols-1 gap-4">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">Kịch bản phát thanh (Văn bản)</p>
              <textarea
                value={inputText}
                onChange={(e) => onInputTextChange?.(e.target.value)}
                placeholder="Nhập kịch bản để render video..."
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs">
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 font-mono text-xs font-extrabold uppercase tracking-wide text-slate-800">
        <Video className="h-4 w-4 text-indigo-500" />
        Cấu hình video người thật
      </div>

      {/* Engine Selection Dropdown */}
      <div className="grid grid-cols-1 gap-4">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">Mô hình Avatar (Engine)</p>
          <select
            value={selectedEngineType}
            onChange={(e) => onEngineTypeChange(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {ENGINE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
            {ENGINE_OPTIONS.find((option) => option.value === selectedEngineType)?.description}
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="flex min-h-[188px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 h-8">
            <p className="text-sm font-bold text-slate-900">Nhân vật</p>
          </div>

          <div className="mt-3 flex gap-4 items-center flex-1">
            {selectedAvatarItem?.previewImage ? (
              <img
                src={selectedAvatarItem.previewImage}
                alt={selectedAvatarItem.name || "Avatar"}
                className="h-20 w-16 shrink-0 rounded-2xl border border-slate-200 bg-white object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[10px] font-bold text-slate-400 shadow-sm">
                Avatar
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div>
                <select
                  value={selectedAvatar}
                  onChange={(e) => onAvatarChange(e.target.value)}
                  disabled={isLoadingAvatars || avatars.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  {avatars.map((avatar) => (
                    <option key={avatar.id} value={avatar.id}>
                      {avatar.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center">
            <p className="text-[11px] font-medium text-slate-500">
              Chọn nhân vật đại diện AI phát ngôn cho kịch bản video của bạn.
            </p>
          </div>
        </section>

        <section className="flex min-h-[188px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 h-8">
            <p className="text-sm font-bold text-slate-900">Giọng nói đã chọn</p>
            <button
              type="button"
              onClick={() => setIsVoiceLibraryOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition-all hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" />
              Thư viện giọng nói
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 flex-1 flex items-center">
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {isLoadingVoices ? "Đang tải thư viện giọng đọc..." : getVoiceName(selectedVoiceItem)}
                </p>
              </div>
              {!isAvatarThree && (
                <button
                  type="button"
                  onClick={() => onPreviewVoice(selectedVoice)}
                  disabled={isLoadingVoices || voices.length === 0 || isPreviewingVoice}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-700 transition-all hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <Play className={`h-3.5 w-3.5 ${isPreviewingVoice ? "animate-pulse" : ""}`} />
                  {isPreviewingVoice ? "Đang phát" : "Nghe thử"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center">
            <p className="text-[11px] font-medium text-slate-500">
              Chọn hoặc đổi giọng đọc trong thư viện giọng nói.
            </p>
          </div>
        </section>
      </div>

      {/* Conditionally render ElevenLabs Voice settings */}
      {!isAvatarThree && (
        <div className="grid grid-cols-1 gap-4">
          <section className="min-h-[118px] rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500">Model giọng nói</p>
            <select
              value={selectedVoiceModel}
              onChange={(e) => onVoiceModelChange(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {VOICE_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
              {VOICE_MODEL_OPTIONS.find((option) => option.value === selectedVoiceModel)?.description}
            </p>
          </section>
        </div>
      )}

      {isAvatarThree && (
        <div className="p-3 bg-amber-50 border border-amber-250 rounded-xl text-[11px] leading-relaxed text-amber-800 font-medium">
          💡 <strong>Thông tin</strong>: Bạn đã chọn mô hình <strong>Avatar III (Tốc độ cao)</strong>. Hệ thống sẽ bỏ qua ElevenLabs và tạo video đọc trực tiếp văn bản qua công nghệ HeyGen TTS, giúp tiết kiệm chi phí và tăng tốc độ xử lý.
        </div>
      )}

      {isVoiceLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-lg font-bold text-slate-900">Cài đặt giọng nói nâng cao</p>
                <p className="mt-1 text-sm text-slate-400">Tìm chỉnh model, giọng và các thông số khác để có kết quả tốt nhất.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsVoiceLibraryOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm giọng nói..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-cyan-300 focus:bg-white"
                />
              </div>

              {!isAvatarThree && (
                <div className="flex border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setVoiceTab("my-voices")}
                    className={`flex-1 pb-2 text-xs font-bold transition ${voiceTab === "my-voices" ? "border-b-2 border-cyan-500 text-cyan-600" : "border-b-2 border-transparent text-slate-400"}`}
                  >
                    Giọng của tôi ({myVoices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceTab("library")}
                    className={`flex-1 pb-2 text-xs font-bold transition ${voiceTab === "library" ? "border-b-2 border-cyan-500 text-cyan-600" : "border-b-2 border-transparent text-slate-400"}`}
                  >
                    Thư viện ({libraryVoices.length})
                  </button>
                </div>
              )}

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {visibleVoices.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">Không tìm thấy giọng đọc phù hợp.</div>
                ) : (
                  visibleVoices.map((voice) => {
                    const voiceKey = getVoiceKey(voice);
                    const isSelected = voiceKey === selectedVoice;

                    return (
                      <div
                        key={voiceKey}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          onVoiceChange(voiceKey);
                          setIsVoiceLibraryOpen(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onVoiceChange(voiceKey);
                            setIsVoiceLibraryOpen(false);
                          }
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border p-4 text-left transition ${isSelected ? "border-cyan-300 bg-cyan-50/60" : "border-slate-200 hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {!isAvatarThree && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onPreviewVoice(voiceKey);
                              }}
                              disabled={isPreviewingVoice}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs"
                            >
                              <Play className="ml-0.5 h-4 w-4" />
                            </button>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {getVoiceName(voice)}
                            </p>
                          </div>
                        </div>
                        {isSelected ? <Check className="h-4 w-4 shrink-0 text-cyan-600" /> : null}
                      </div>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsVoiceLibraryOpen(false)}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
              >
                Quay lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
