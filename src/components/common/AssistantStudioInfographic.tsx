import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronDown, Clock3, Download, LoaderCircle, Plus } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { StyledSelect } from "./StyledSelect";
import { requestStudioImages, type StudioImageRequest, type StudioImageResponse } from "./assistantStudioImageApi";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const layouts = [
  { id: "auto", label: "Tự động", group: "" },
  { id: "timeline", label: "Timeline", group: "Dòng thời gian" },
  { id: "gantt", label: "Gantt", group: "Dòng thời gian" },
  { id: "cycle", label: "Vòng tròn", group: "Dòng thời gian" },
  { id: "sequence", label: "Trình tự", group: "Dòng thời gian" },
  { id: "compare", label: "So sánh", group: "So sánh" },
  { id: "ranking", label: "Xếp hạng", group: "So sánh" },
  { id: "matrix", label: "Ma trận", group: "So sánh" },
  { id: "venn", label: "Venn", group: "So sánh" },
  { id: "flow", label: "Flowchart", group: "Quy trình" },
  { id: "steps", label: "Bậc thang", group: "Quy trình" },
  { id: "journey", label: "Hành trình", group: "Quy trình" },
  { id: "loop", label: "Vòng lặp", group: "Quy trình" },
  { id: "funnel", label: "Phễu", group: "Mô hình kinh doanh" },
  { id: "pyramid", label: "Kim tự tháp", group: "Mô hình kinh doanh" },
  { id: "tree", label: "Sơ đồ cây", group: "Mô hình kinh doanh" },
] as const;
type Layout = (typeof layouts)[number];
type Result = { id: number; content: StudioImageResponse; prompt: string; layout: Layout["id"] };
const illustrationColors = {
  blue: "#00adfc",
  coral: "#ff8d78",
  teal: "#36c7b8",
  yellow: "#f4c65f",
  violet: "#8d7de3",
};
const layoutColors: Record<Layout["id"], string> = {
  auto: illustrationColors.blue, timeline: illustrationColors.blue, gantt: illustrationColors.coral,
  cycle: illustrationColors.violet, sequence: illustrationColors.teal, compare: illustrationColors.coral,
  ranking: illustrationColors.yellow, matrix: illustrationColors.teal, venn: illustrationColors.violet,
  flow: illustrationColors.blue, steps: illustrationColors.coral, journey: illustrationColors.yellow,
  loop: illustrationColors.teal, funnel: illustrationColors.violet, pyramid: illustrationColors.coral,
  tree: illustrationColors.blue,
};
const infographicPromptIdeas = [
  { label: "Quy trình", color: "border-primary/20 bg-primary/10 text-primary", layout: "flow" as const, prompt: "Quy trình tuyển dụng nhân sự gồm tiếp nhận nhu cầu, đăng tuyển, phỏng vấn, đánh giá và nhận việc." },
  { label: "Dòng thời gian", color: "border-tertiary/20 bg-tertiary-container text-tertiary", layout: "timeline" as const, prompt: "Lộ trình triển khai dự án trong 4 tuần, từ khảo sát yêu cầu đến bàn giao và đánh giá." },
  { label: "So sánh", color: "border-secondary/20 bg-secondary-container text-secondary", layout: "compare" as const, prompt: "So sánh làm việc tại văn phòng và làm việc từ xa theo chi phí, giao tiếp, tập trung và tính linh hoạt." },
];

function LayoutArtwork({ kind, className = "" }: { kind: Layout["id"]; className?: string }) {
  return <svg viewBox="0 0 120 90" className={cn("size-full", className)} style={{ color: layoutColors[kind] }} fill="none" aria-hidden="true">
    <rect x="3" y="3" width="114" height="84" rx="8" className="fill-surface-container-lowest" />
    <rect x="13" y="12" width="43" height="4" rx="2" fill="currentColor" opacity=".55" />
    <rect x="13" y="19" width="66" height="2" rx="1" fill="currentColor" opacity=".18" />
    {kind === "auto" ? <><rect x="15" y="30" width="27" height="38" rx="3" fill={illustrationColors.blue} opacity=".14" /><rect x="47" y="30" width="27" height="38" rx="3" fill={illustrationColors.coral} opacity=".18" /><rect x="79" y="30" width="27" height="38" rx="3" fill={illustrationColors.teal} opacity=".16" /><circle cx="28" cy="44" r="7" fill={illustrationColors.blue} opacity=".7" /><rect x="20" y="56" width="16" height="2" rx="1" fill={illustrationColors.blue} opacity=".4" /><rect x="53" y="39" width="16" height="5" rx="2" fill={illustrationColors.coral} /><rect x="53" y="48" width="12" height="4" rx="2" fill={illustrationColors.yellow} /><path d="m83 55 6-9 5 4 6-11" stroke={illustrationColors.teal} strokeWidth="2.5" strokeLinecap="round" /><rect x="22" y="74" width="76" height="2" rx="1" fill="currentColor" opacity=".16" /></>
      : kind === "timeline" || kind === "journey" ? <><path d="M23 46h74" stroke="currentColor" strokeWidth="2" opacity=".35" />{[29, 50, 71, 92].map((x, index) => <g key={x}><circle cx={x} cy="46" r="6" fill="currentColor" opacity={.4 + index * .13} /><rect x={x - 10} y={index % 2 ? 58 : 29} width="20" height="4" rx="2" fill="currentColor" opacity=".3" /></g>)}</>
      : kind === "gantt" ? <>{[0, 1, 2, 3].map((index) => <g key={index}><rect x="17" y={27 + index * 13} width="13" height="4" rx="2" fill="currentColor" opacity=".25" /><rect x={35 + index * 10} y={25 + index * 13} width={43 - index * 4} height="7" rx="3" fill="currentColor" opacity={.35 + index * .13} /></g>)}</>
      : kind === "cycle" || kind === "loop" ? <><circle cx="61" cy="51" r="27" stroke="currentColor" strokeWidth="10" strokeDasharray="37 6 35 6 37 6 35 6" opacity=".55" /><circle cx="61" cy="51" r="10" fill="currentColor" opacity=".12" /></>
      : kind === "sequence" || kind === "steps" ? <>{[0, 1, 2, 3].map(index => <g key={index}><rect x={14 + index * 25} y={kind === "steps" ? 55 - index * 10 : 35} width="21" height={kind === "steps" ? 22 + index * 10 : 30} rx="3" fill="currentColor" opacity={.28 + index * .14} /><circle cx={24 + index * 25} cy={kind === "steps" ? 62 - index * 10 : 46} r="3" className="fill-surface-container-lowest" /></g>)}</>
      : kind === "compare" || kind === "ranking" ? <>{[0, 1, 2, 3].map(index => <g key={index}><rect x="16" y={25 + index * 14} width="15" height="5" rx="2" fill="currentColor" opacity=".25" /><rect x="38" y={24 + index * 14} width={kind === "ranking" ? 66 - index * 12 : 30 + index * 9} height="8" rx="3" fill="currentColor" opacity={.35 + index * .13} /></g>)}</>
      : kind === "matrix" ? <>{[0, 1, 2].flatMap(row => [0, 1, 2].map(col => <rect key={`${row}-${col}`} x={23 + col * 26} y={24 + row * 18} width="20" height="13" rx="2" fill="currentColor" opacity={.18 + ((row + col) % 3) * .2} />))}</>
      : kind === "venn" ? <><circle cx="47" cy="49" r="25" fill="currentColor" opacity=".3" /><circle cx="73" cy="49" r="25" fill="currentColor" opacity=".5" /></>
      : kind === "flow" || kind === "tree" ? <><path d="M60 31v10M28 41h64M28 41v10M60 41v10M92 41v10" stroke="currentColor" strokeWidth="2" opacity=".5" /><rect x="43" y="21" width="34" height="13" rx="4" fill="currentColor" opacity=".65" />{[11, 43, 75].map(x => <rect key={x} x={x} y="51" width="34" height="17" rx="4" fill="currentColor" opacity=".35" />)}</>
      : kind === "funnel" || kind === "pyramid" ? <>{[0, 1, 2, 3].map(index => <path key={index} d={kind === "funnel" ? `M${16 + index * 9} ${23 + index * 14}h${88 - index * 18}l-9 11H${25 + index * 9}Z` : `M${50 - index * 11} ${23 + index * 14}h${20 + index * 22}l10 11H${40 - index * 11}Z`} fill="currentColor" opacity={.25 + index * .15} />)}</>
      : null}
    {kind !== "auto" && <><rect x="15" y="76" width="34" height="2" rx="1" fill="currentColor" opacity=".22" /><rect x="53" y="76" width="24" height="2" rx="1" fill="currentColor" opacity=".15" /><rect x="81" y="76" width="20" height="2" rx="1" fill="currentColor" opacity=".15" /></>}
  </svg>;
}

function EmptyArtwork() {
  return <img src="/ai-studio-infographic-hero.png" alt="Minh họa infographic với quy trình, mốc thời gian và biểu đồ" width="1536" height="1024" className="h-auto max-h-[36dvh] w-full max-w-xl object-contain" />;
}

export function AssistantStudioInfographic({ onBack }: { onBack: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [layoutId, setLayoutId] = useState<Layout["id"]>("auto");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const layoutRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<StudioImageRequest["aspectRatio"]>("3:4");
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!layoutOpen) return;
    const closeOutside = (event: PointerEvent) => { if (!layoutRef.current?.contains(event.target as Node)) setLayoutOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [layoutOpen]);

  async function createInfographic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = prompt.trim();
    if (content.length < 3 || loading) return;
    setError("");
    setLoading(true);
    setShowHistory(false);
    const layout = layouts.find(item => item.id === layoutId)!;
    const instruction = `Tạo một infographic hoàn chỉnh bằng tiếng Việt, rõ ràng, dễ đọc, trình bày chuyên nghiệp. Bố cục: ${layoutId === "auto" ? "tự chọn bố cục phù hợp nhất với nội dung" : layout.label}. Giữ đúng toàn bộ số liệu, tên riêng và mối quan hệ trong yêu cầu; không thêm dữ kiện mới. Chữ trong ảnh phải dễ đọc, không có watermark. Nội dung: ${content}`;
    try {
      const response = await requestStudioImages({ prompt: instruction, aspectRatio: ratio, count: 1 });
      const next = { id: Date.now(), content: response, prompt: content, layout: layoutId };
      setResult(next);
      setHistory(previous => [next, ...previous]);
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setLoading(false); }
  }

  function reset() {
    setPrompt("");
    setLayoutId("auto"); setRatio("3:4"); setResult(null); setShowHistory(false); setError("");
  }

  const selectedLayout = layouts.find(item => item.id === layoutId)!;
  return <div className="grid min-h-full min-w-0 lg:min-h-[calc(100dvh-5.5rem)] lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
    <form onSubmit={createInfographic} aria-label="Thiết lập tạo infographic" className="flex min-w-0 flex-col gap-4 border-b border-outline-variant bg-surface-container-lowest p-4 sm:p-5 lg:min-h-full lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex min-h-9 items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm lg:text-xs"><button type="button" onClick={onBack} className={cn("inline-flex shrink-0 items-center gap-1 rounded-md py-1 text-on-surface-variant hover:text-primary", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />AI Studio</button><span className="text-on-surface-variant" aria-hidden="true">/</span><h1 className="min-w-0 truncate font-semibold">Tạo infographic</h1></div>
      <div>
        <label htmlFor="studio-infographic-prompt" className="mb-1 block text-sm font-medium">Nội dung cần thể hiện <span className="text-error">*</span></label>
        <textarea
          id="studio-infographic-prompt"
          required
          minLength={3}
          maxLength={1500}
          rows={9}
          value={prompt}
          onChange={event => { setPrompt(event.target.value); setError(""); }}
          disabled={loading}
          aria-describedby="studio-infographic-count"
          placeholder="Ví dụ: Quy trình kê khai thuế của hộ kinh doanh, gồm các bước, thời hạn và lưu ý quan trọng…"
          className="min-h-52 w-full resize-y rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
        />
        <div className="mt-1 flex justify-end text-xs text-on-surface-variant">
          <span id="studio-infographic-count" className="shrink-0 tabular-nums">{prompt.length.toLocaleString("vi-VN")}/1.500</span>
        </div>
      </div>
      <div ref={layoutRef} onKeyDown={event => { if (event.key === "Escape" && layoutOpen) { setLayoutOpen(false); (layoutRef.current?.querySelector("button") as HTMLButtonElement)?.focus(); } }} className="relative">
        <span className="mb-1 block text-sm font-medium">Bố cục</span>
        <button type="button" aria-label="Bố cục" aria-expanded={layoutOpen} aria-controls={layoutOpen ? "studio-infographic-layouts" : undefined} onClick={() => setLayoutOpen(value => !value)} disabled={loading} className={cn("flex min-h-10 w-full items-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-left text-sm hover:border-primary", focusClass)}><span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-primary"><LayoutArtwork kind={selectedLayout.id} /></span><span className="min-w-0 flex-1 truncate">{selectedLayout.label}</span><ChevronDown className={cn("size-4 text-on-surface-variant", layoutOpen && "rotate-180")} aria-hidden="true" /></button>
        {layoutOpen && <div id="studio-infographic-layouts" className="absolute left-0 top-full z-20 mt-1 max-h-96 w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-3 shadow-lg">
          {(["", "Dòng thời gian", "So sánh", "Quy trình", "Mô hình kinh doanh"] as const).map(group => <div key={group} className="mb-3 last:mb-0">
            {group && <p className="mb-2 text-xs font-medium text-on-surface-variant">{group}</p>}
            <div className="grid grid-cols-4 gap-2">{layouts.filter(item => item.group === group).map(item => <button key={item.id} type="button" aria-pressed={layoutId === item.id} onClick={() => { setLayoutId(item.id); setLayoutOpen(false); }} className={cn("flex min-w-0 flex-col items-center gap-1 rounded-md p-1 text-center text-xs hover:bg-surface-container-low", layoutId === item.id && "text-primary", focusClass)}><span className={cn("block aspect-[4/3] w-full overflow-hidden rounded-md border", layoutId === item.id ? "border-primary" : "border-outline-variant")}><LayoutArtwork kind={item.id} /></span><span className="text-pretty">{item.label}</span></button>)}</div>
          </div>)}
        </div>}
      </div>
      <div><span className="mb-1 block text-sm font-medium">Tỷ lệ khung hình</span><StyledSelect appearance="erp" ariaLabel="Tỷ lệ infographic" value={ratio} onChange={value => setRatio(value as StudioImageRequest["aspectRatio"])} disabled={loading} options={[{ value: "3:4", label: "3:4 · Dọc" }, { value: "9:16", label: "9:16 · Dọc dài" }, { value: "1:1", label: "1:1 · Vuông" }, { value: "16:9", label: "16:9 · Ngang" }, { value: "4:3", label: "4:3 · Ngang gọn" }]} className="h-10 rounded-md" /></div>
      <button type="submit" disabled={loading || prompt.trim().length < 3} className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 lg:sticky lg:bottom-0 lg:z-10 lg:mt-auto", focusClass)}>{loading ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang tạo infographic…</> : "Tạo infographic"}</button>
      {error && <p role="alert" className="text-pretty rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
    </form>
    <section aria-label="Kết quả tạo infographic" aria-busy={loading} className="flex min-h-96 min-w-0 flex-col bg-surface-container-lowest p-4 lg:min-h-full lg:p-6"><div className="flex items-center justify-end gap-2"><button type="button" onClick={reset} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant px-3 text-xs hover:bg-surface-container-low", focusClass)}><Plus className="size-4" aria-hidden="true" />Tạo mới</button><button type="button" aria-pressed={showHistory} onClick={() => setShowHistory(value => !value)} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant px-3 text-xs hover:bg-surface-container-low", focusClass)}><Clock3 className="size-4" aria-hidden="true" />Lịch sử</button></div>
      {showHistory ? <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-8"><h2 className="text-balance text-lg font-semibold">Lịch sử trong phiên này</h2>{history.length ? <ul className="mt-4 space-y-2">{history.map(item => <li key={item.id}><button type="button" onClick={() => { setResult(item); setShowHistory(false); }} className={cn("flex w-full items-center gap-3 rounded-lg border border-outline-variant p-2 text-left hover:bg-surface-container-low", focusClass)}><img src={item.content.images[0]?.url} alt="" className="size-14 rounded-md object-cover" /><span className="min-w-0 flex-1 truncate text-sm">{item.prompt}</span></button></li>)}</ul> : <p className="mt-3 text-pretty text-sm text-on-surface-variant">Infographic bạn tạo sẽ xuất hiện ở đây.</p>}</div>
        : loading ? <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-center"><LoaderCircle className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" /><p className="text-pretty text-sm text-on-surface-variant">Đang tạo infographic. Quá trình này có thể mất một lúc…</p></div>
          : result?.content.images.length ? <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-balance text-lg font-semibold">Infographic đã tạo</h2><p className="text-sm text-on-surface-variant">{layouts.find(item => item.id === result.layout)?.label} · iGenAI · {result.content.aspectRatio}</p></div><a href={result.content.images[0].url} download="igen-infographic.png" target="_blank" rel="noopener noreferrer" className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 text-sm font-medium text-primary hover:bg-primary/10", focusClass)}><Download className="size-4" aria-hidden="true" />Tải ảnh</a></div>{result.content.warning && <p role="status" className="mb-3 text-sm text-on-surface-variant">{result.content.warning}</p>}<img src={result.content.images[0].url} alt={`Infographic AI đã tạo từ nội dung: ${result.prompt.slice(0, 100)}`} className="max-h-[70dvh] w-full rounded-lg border border-outline-variant bg-surface-container-low object-contain" /></div>
            : <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8 text-center lg:py-10"><div className="space-y-2"><h2 className="mx-auto max-w-2xl text-balance text-xl font-semibold leading-tight sm:text-2xl"><span className="text-tertiary">Biến ý tưởng</span>{" "}<span className="text-on-surface">thành infographic</span>{" "}<span className="text-primary">trực quan</span></h2><p className="text-pretty text-sm text-on-surface-variant">Sắp xếp nội dung thành quy trình, dòng thời gian hoặc biểu đồ dễ theo dõi.</p></div><EmptyArtwork /><section aria-label="Gợi ý bố cục infographic" className="space-y-2"><h3 className="text-sm font-medium text-on-surface-variant">Thử một ý tưởng</h3><div className="flex flex-wrap justify-center gap-2">{infographicPromptIdeas.map(idea => <button key={idea.label} type="button" onClick={() => { setPrompt(idea.prompt); setLayoutId(idea.layout); setLayoutOpen(false); setError(""); }} disabled={loading} className={cn("min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50", idea.color, focusClass)}>{idea.label}</button>)}</div></section></div>}
    </section>
  </div>;
}
