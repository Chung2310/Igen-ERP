import React from "react";
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
  const PAGE_SIZE = 12;
  const isAvatarMode = title.toLowerCase().includes("avatar");

  const [selectedFolder, setSelectedFolder] = React.useState<string>('');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const gridScrollRef = React.useRef<HTMLDivElement>(null);

  // Group avatars by a pseudo‑folder (using avatar name as folder identifier)
  const avatarsByFolder = React.useMemo(() => {
    const map: Record<string, HeyGenLibraryItem[]> = {};
    const sourceItems = isAvatarMode ? items.filter(item => item.isCustom) : items;
    sourceItems.forEach(item => {
      const folder = item.name || item.id;
      if (!map[folder]) map[folder] = [];
      map[folder].push(item);
    });
    return map;
  }, [items, isAvatarMode]);

  const folderNames = React.useMemo(() => Object.keys(avatarsByFolder), [avatarsByFolder]);

  // Initialize selectedFolder to first folder when data changes
  React.useEffect(() => {
    if (folderNames.length > 0 && !folderNames.includes(selectedFolder)) {
      setSelectedFolder(folderNames[0]);
    }
  }, [folderNames]);

  // Reset visible count & scroll to top when folder changes
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 0;
  }, [selectedFolder]);

  const filteredItems = React.useMemo(() => {
    return selectedFolder ? avatarsByFolder[selectedFolder] || [] : [];
  }, [avatarsByFolder, selectedFolder]);

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  // IntersectionObserver – load next batch when sentinel enters viewport
  React.useEffect(() => {
    if (!hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredItems.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filteredItems.length]);

  // UI render – split into two columns: folder list (left) and avatar grid (right)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-[min(92vw,780px)] rounded-[28px] border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surface} shadow-2xl flex flex-col overflow-hidden`}
        style={{ maxHeight: "min(90vh, 640px)" }}
      >
        {/* ── Header ── */}
        <div className={`flex items-center justify-between gap-3 px-5 py-4 border-b ${HEYGEN_THEME.border} shrink-0`}>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className={`text-xs ${HEYGEN_THEME.textMuted}`}>
              {isAvatarMode ? `${folderNames.length} nhóm · ${items.filter(i => i.isCustom).length} avatar` : `${items.length} mục`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full border ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} text-slate-500 transition hover:bg-slate-100 hover:text-slate-900`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body: sidebar + grid ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Folder sidebar */}
          <div className={`w-44 shrink-0 border-r ${HEYGEN_THEME.border} overflow-y-auto py-2 px-2`}>
            <p className={`mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest ${HEYGEN_THEME.textMuted}`}>Nhóm avatar</p>
            <ul className="space-y-0.5">
              {folderNames.map(name => {
                const isActive = name === selectedFolder;
                const count = avatarsByFolder[name]?.length ?? 0;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => setSelectedFolder(name)}
                      className={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-cyan-50 text-cyan-700 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3)]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className="min-w-0 truncate leading-snug">{name}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums transition-colors ${
                        isActive ? "bg-cyan-200 text-cyan-700" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                      }`}>
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Avatar grid */}
          <div ref={gridScrollRef} className="flex-1 overflow-y-auto p-3">
            {filteredItems.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-full gap-2 rounded-2xl border border-dashed ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} py-10`}>
                <UserRound className={`h-8 w-8 ${HEYGEN_THEME.textMuted}`} />
                <p className={`text-sm ${HEYGEN_THEME.textMuted}`}>Không có avatar nào trong nhóm này.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {visibleItems.map(item => {
                    const isSelected = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect(item)}
                        className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-150 hover:scale-[1.03] hover:shadow-md ${
                          isSelected
                            ? `${HEYGEN_THEME.accentBorder} shadow-[0_0_0_3px_rgba(6,182,212,0.15)]`
                            : `${HEYGEN_THEME.border} hover:border-slate-300`
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                          <img
                            src={item.thumbnail || item.avatarUrl || item.previewImage || ''}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                          {/* Selected overlay */}
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-cyan-600/20">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-white shadow-lg">
                                <Check className="h-4 w-4" />
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Label */}
                        <div className={`px-2 py-1.5 ${isSelected ? HEYGEN_THEME.accentBg : ""}`}>
                          <p className={`truncate text-[11px] font-semibold leading-tight ${isSelected ? "text-cyan-700" : "text-slate-700"}`}>
                            {item.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* ── Infinite scroll sentinel + progress ── */}
                {hasMore ? (
                  <div ref={sentinelRef} className="mt-4 flex flex-col items-center gap-2 pb-2">
                    {/* Progress bar */}
                    <div className="w-full max-w-[200px] overflow-hidden rounded-full bg-slate-100 h-1">
                      <div
                        className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.round((visibleCount / filteredItems.length) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      <span className={`text-[11px] ${HEYGEN_THEME.textMuted}`}>
                        Đang tải… {visibleCount}/{filteredItems.length}
                      </span>
                    </div>
                  </div>
                ) : filteredItems.length > PAGE_SIZE ? (
                  <p className={`mt-4 pb-2 text-center text-[11px] ${HEYGEN_THEME.textMuted}`}>
                    Đã hiển thị tất cả {filteredItems.length} avatar
                  </p>
                ) : null}
              </>
            )}
          </div>

        </div>
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
            Đang tải audio...
          </div>
        ) : items.length === 0 ? (
          <div className={`rounded-2xl border border-dashed ${HEYGEN_THEME.border} ${HEYGEN_THEME.surfaceMuted} px-4 py-6 text-center text-sm ${HEYGEN_THEME.textMuted}`}>Chưa có audio ElevenLabs trong lịch sử.</div>
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
                        <p className={`line-clamp-2 text-xs ${HEYGEN_THEME.textMuted}`}>{item.prompt || "Không có mô tả"}</p>
                        <p className="mt-2 text-[11px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString("vi-VN") : "Mới tạo"}</p>
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
                      Mở file
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
