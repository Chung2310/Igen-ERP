import { AudioLines, Check, ExternalLink, LoaderCircle, Play, UserRound, X } from "lucide-react";
import type { HeyGenLibraryItem } from "../../api/heygen";
import { HEYGEN_THEME } from "./heygenTheme";

export type ElevenLabsAudioRecord = {
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

export function ModelSelectionPopover({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-[360px] rounded-[24px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} p-3 shadow-2xl`}>
        <div className="mb-2 flex items-center justify-between gap-2 px-1 py-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${HEYGEN_THEME.textMuted}`}>{title}</p>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
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
                className={`flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                  isSelected ? `${HEYGEN_THEME.accentBorder} ${HEYGEN_THEME.accentBg} text-slate-900` : `${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-slate-600 hover:bg-slate-50`
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-300 via-violet-200 to-slate-300 text-xs font-bold text-slate-900">
                  {item.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold">{item.id}</p>
                  <p className="text-xs leading-5 text-slate-500">{item.description}</p>
                </div>
                {isSelected ? <Check className="h-5 w-5 text-cyan-600" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PickerPopover({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-[min(92vw,760px)] rounded-[28px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} p-4 shadow-2xl`}>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className={`text-xs ${HEYGEN_THEME.textMuted}`}>Chọn trực tiếp từ thư viện được cấp</p>
          </div>
          <button type="button" onClick={onClose} className={`flex h-8 w-8 items-center justify-center rounded-full border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-slate-500 transition hover:text-slate-900`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {items.length === 0 ? (
          <div className={`rounded-2xl border border-dashed ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-4 py-6 text-center text-sm ${HEYGEN_THEME.textMuted}`}>{emptyLabel}</div>
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
                    isSelected ? `${HEYGEN_THEME.accentBorder} ${HEYGEN_THEME.accentBg}` : `${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} hover:bg-slate-50`
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.previewImage ? (
                        <img src={item.previewImage} alt={item.name} loading="lazy" decoding="async" className="h-20 w-16 rounded-2xl object-cover" />
                      ) : (
                        <div className="flex h-20 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                          <UserRound className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                        <p className={`truncate text-xs ${HEYGEN_THEME.textMuted}`}>{item.accent || item.language || item.id}</p>
                        <p className="mt-2 line-clamp-1 text-[11px] text-slate-400">{item.id}</p>
                      </div>
                    </div>
                    {isSelected ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white"><Check className="h-3.5 w-3.5" /></span> : null}
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

export function AudioHistoryPopover({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-[min(92vw,760px)] rounded-[28px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} p-4 shadow-2xl`}>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className={`text-xs ${HEYGEN_THEME.textMuted}`}>Nguồn này được lấy từ lịch sử tạo giọng nói của ElevenLabs</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onRefresh} className={`inline-flex h-8 items-center rounded-full border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-3 text-xs font-semibold text-slate-600 transition hover:text-slate-900`}>Làm mới</button>
            <button type="button" onClick={onClose} className={`flex h-8 w-8 items-center justify-center rounded-full border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-slate-500 transition hover:text-slate-900`}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {isLoading ? (
          <div className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-sm ${HEYGEN_THEME.textMuted}`}>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Dang tai audio...
          </div>
        ) : items.length === 0 ? (
          <div className={`rounded-2xl border border-dashed ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-4 py-6 text-center text-sm ${HEYGEN_THEME.textMuted}`}>Chua co audio ElevenLabs trong lich su.</div>
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
                    isSelected ? `${HEYGEN_THEME.accentBorder} ${HEYGEN_THEME.accentBg}` : `${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} hover:bg-slate-50`
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                        <AudioLines className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.metadata?.title || item.metadata?.voiceName || "Audio ElevenLabs"}</p>
                        <p className={`line-clamp-2 text-xs ${HEYGEN_THEME.textMuted}`}>{item.prompt || "Khong co mo ta"}</p>
                        <p className="mt-2 text-[11px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "Moi tao"}</p>
                      </div>
                    </div>
                    {isSelected ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white"><Check className="h-3.5 w-3.5" /></span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`inline-flex h-8 items-center gap-1.5 rounded-full border ${HEYGEN_THEME.border} bg-white px-3 text-xs font-semibold text-slate-600 transition hover:text-slate-900`}>
                      <Play className="h-3.5 w-3.5" />
                      Nghe
                    </a>
                    <a href={item.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className={`inline-flex h-8 items-center gap-1.5 rounded-full border ${HEYGEN_THEME.border} bg-white px-3 text-xs font-semibold text-slate-600 transition hover:text-slate-900`}>
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
