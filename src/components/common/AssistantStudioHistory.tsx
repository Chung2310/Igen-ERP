import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, LoaderCircle } from "lucide-react";
import { assistantService } from "../../services/assistantService";
import { combineAssistantStudioHistory, listAssistantStudioCreationHistory, type AssistantStudioHistoryEntry } from "../../services/assistantStudioHistory";
import { getAssistantSpeechHistoryUserId, listAssistantSpeechHistory } from "../../services/assistantSpeechHistory";
import { cn } from "../../modules/student-management/lib/utils";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function AssistantStudioHistory({ onOpen, onStart }: { onOpen: (item: AssistantStudioHistoryEntry) => void; onStart: () => void }) {
  const [items, setItems] = useState<AssistantStudioHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const userId = getAssistantSpeechHistoryUserId();
    void Promise.allSettled([
      assistantService.studioCharts(),
      assistantService.studioSlideDecks(),
      assistantService.studioTranscripts(),
      listAssistantStudioCreationHistory(userId),
      listAssistantSpeechHistory(userId),
    ]).then((results) => {
      if (!active) return;
      const [charts, slides, transcripts, creations, speech] = results;
      const readError = results.find((result) => result.status === "rejected");
      if (readError?.status === "rejected") setError(readError.reason instanceof Error ? readError.reason.message : "Không tải được lịch sử AI Studio.");
      setItems(combineAssistantStudioHistory({
        charts: charts.status === "fulfilled" ? charts.value : [],
        slides: slides.status === "fulfilled" ? slides.value : [],
        transcripts: transcripts.status === "fulfilled" ? transcripts.value : [],
        creations: creations.status === "fulfilled" ? creations.value : [],
        speech: speech.status === "fulfilled" ? speech.value : [],
      }));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <section aria-label="Lịch sử AI Studio" aria-busy={loading} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-container-lowest">
    <div className="w-full py-4">
      {loading && <p role="status" className="flex items-center gap-2 py-5 text-sm text-on-surface-variant"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang tải lịch sử Studio…</p>}
      {error && <p role="alert" className="mb-3 rounded-lg border border-error/30 bg-error/5 p-3 text-pretty text-sm text-error">{error}</p>}
      {!loading && items.length === 0 && <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center"><Clock3 className="size-7 text-on-surface-variant" aria-hidden="true" /><p className="text-sm font-medium">Chưa có hoạt động Studio</p><p className="text-pretty text-xs text-on-surface-variant">Ảnh, graphic, Mindmap, biểu đồ, slide và audio bạn tạo sẽ xuất hiện ở đây.</p><button type="button" onClick={onStart} className={cn("mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}>Mở AI Studio <ArrowUpRight className="size-3.5" aria-hidden="true" /></button></div>}
      {!loading && items.length > 0 && <ul className="divide-y divide-outline-variant" aria-label="Danh sách hoạt động AI Studio">
        {items.map((item) => <li key={item.id}>
          <button type="button" onClick={() => onOpen(item)} className={cn("flex w-full min-w-0 items-start gap-3 px-1 py-4 text-left hover:bg-surface-container-low", focusClass)}>
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{item.label}</span>
            <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="line-clamp-2 min-w-0 text-sm font-semibold text-on-surface">{item.title}</span><time className="shrink-0 text-xs tabular-nums text-on-surface-variant" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></span><span className="mt-1 block line-clamp-2 text-pretty text-xs text-on-surface-variant">{item.summary}</span></span>
          </button>
        </li>)}
      </ul>}
    </div>
  </section>;
}
