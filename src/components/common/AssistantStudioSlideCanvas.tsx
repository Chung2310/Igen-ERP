import type { AssistantSlideContent, AssistantSlideDeck } from "../../shared/assistant-slide";
import { cn } from "../../modules/student-management/lib/utils";
import { getAssistantSlideTheme, getSlideMetrics, inferSlideLayout, type AssistantSlideTheme } from "./assistant-slide-design";
import { AssistantStudioSlideEditLayer, SlideEditableText } from "./AssistantStudioSlideEditLayer";

interface SlideCanvasProps {
  deck: AssistantSlideDeck;
  activeIndex: number;
  editable?: boolean;
  selectedField?: string | null;
  selectedObjectId?: string | null;
  onSelectField?: (field: string) => void;
  onSelectObject?: (id: string) => void;
  onCommitText?: (field: string, value: string) => void;
}

function CoverSlide({ deck, theme, editable = false, selectedField, selectedObjectId, onSelectField, onSelectObject, onCommitText }: SlideCanvasProps & { theme: AssistantSlideTheme }) {
  const chapterTitles = deck.slides.slice(0, 3).map(slide => slide.title);
  return <div className="relative flex h-full min-h-0 flex-col overflow-hidden p-5 font-sans sm:p-8 lg:p-10" style={{ backgroundColor: theme.canvas, color: theme.ink }}>
    <div className="flex items-center gap-2 text-[clamp(.55rem,1vw,.8rem)] font-bold uppercase" style={{ color: theme.primary }}>
      <span className="size-2.5 rounded-sm" style={{ backgroundColor: theme.secondary }} />
      iGen ERP <span aria-hidden="true" className="opacity-50">/</span> AI Studio
    </div>
    <div className="my-auto grid min-h-0 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_30%] sm:gap-6">
      <div className="min-w-0">
        <p className="mb-2 text-[clamp(.55rem,1vw,.8rem)] font-semibold uppercase" style={{ color: theme.primary }}>Bài thuyết trình</p>
        <SlideEditableText as="h2" field="title" label="Tiêu đề bài thuyết trình" value={deck.title} style={deck.coverTextStyles?.title} editable={editable} selected={selectedField === "title"} onSelect={onSelectField} onCommit={onCommitText} className={cn("line-clamp-3 text-balance text-lg font-semibold leading-tight sm:text-3xl lg:text-4xl", editable && "line-clamp-none")} />
        {deck.subtitle && <SlideEditableText field="subtitle" label="Mô tả trang bìa" value={deck.subtitle} style={deck.coverTextStyles?.subtitle} editable={editable} selected={selectedField === "subtitle"} onSelect={onSelectField} onCommit={onCommitText} className={cn("mt-2 line-clamp-3 text-pretty text-xs leading-relaxed sm:mt-4 sm:text-base lg:text-lg", editable && "line-clamp-none")} />}
      </div>
      <div aria-hidden="true" className="relative hidden aspect-square items-center justify-center rounded-2xl sm:flex" style={{ backgroundColor: theme.primary }}>
        <span className="absolute right-[10%] top-[10%] size-[18%] rounded-full" style={{ backgroundColor: theme.secondary }} />
        <span className="absolute bottom-[12%] left-[10%] size-[14%] rounded-full" style={{ backgroundColor: theme.line }} />
        <div className="grid size-[62%] place-items-center rounded-xl border border-white/50 text-5xl font-semibold text-white lg:text-7xl">01</div>
      </div>
    </div>
    <div className="mt-auto flex flex-wrap gap-1.5 border-t pt-3 sm:gap-2 sm:pt-4" style={{ borderColor: theme.line }}>
    {chapterTitles.map((title, index) => <span key={`${title}-${index}`} className="max-w-[32%] truncate rounded-full border px-2 py-1 text-[clamp(.5rem,.85vw,.75rem)] font-medium sm:px-3" style={{ backgroundColor: theme.cards[index], borderColor: theme.accents[index], color: theme.ink }}>{String(index + 1).padStart(2, "0")} · {title}</span>)}
      <span className="ml-auto self-center text-[clamp(.5rem,.8vw,.7rem)] tabular-nums" style={{ color: theme.muted }}>{deck.slides.length + 1} trang</span>
    </div>
    <AssistantStudioSlideEditLayer objects={deck.coverObjects || []} editable={editable} selectedObjectId={selectedObjectId} onSelectObject={onSelectObject} onCommitText={onCommitText} />
  </div>;
}

function IdeaCards({ slide, theme, ...editProps }: { slide: AssistantSlideContent; theme: AssistantSlideTheme } & Pick<SlideCanvasProps, "editable" | "selectedField" | "onSelectField" | "onCommitText">) {
  return <div className="grid min-h-0 flex-1 content-center grid-cols-2 gap-2 sm:gap-3">
    {slide.bullets.map((bullet, index) => <div key={`${bullet}-${index}`} className="flex min-h-0 items-start gap-2 rounded-lg border-l-4 p-2.5 sm:gap-3 sm:rounded-xl sm:p-4" style={{ backgroundColor: theme.cards[index % theme.cards.length], borderColor: theme.accents[index % theme.accents.length] }}>
      <span className="grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold text-white sm:size-8 sm:text-sm" style={{ backgroundColor: theme.accents[index % theme.accents.length] }}>{String(index + 1).padStart(2, "0")}</span>
      <SlideEditableText field={`bullet-${index}`} label={`Ý ${index + 1}`} value={bullet} style={slide.textStyles?.[`bullet-${index}`]} editable={editProps.editable} selected={editProps.selectedField === `bullet-${index}`} onSelect={editProps.onSelectField} onCommit={editProps.onCommitText} className={cn("line-clamp-4 text-pretty text-[clamp(.62rem,1vw,.9rem)] font-medium leading-snug", editProps.editable && "line-clamp-none")} />
    </div>)}
  </div>;
}

function Timeline({ slide, theme, ...editProps }: { slide: AssistantSlideContent; theme: AssistantSlideTheme } & Pick<SlideCanvasProps, "editable" | "selectedField" | "onSelectField" | "onCommitText">) {
  return <div className="relative grid min-h-0 flex-1 content-center grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-6">
    {slide.bullets.map((bullet, index) => <div key={`${bullet}-${index}`} className="relative min-w-0">
      {index < slide.bullets.length - 1 && index % 2 === 0 && <span aria-hidden="true" className="absolute left-7 top-3 h-0.5 w-[calc(100%+0.75rem)] sm:hidden" style={{ backgroundColor: theme.accents[index % theme.accents.length] }} />}
      {index < slide.bullets.length - 1 && index % 3 !== 2 && <span aria-hidden="true" className="absolute left-7 top-3 hidden h-0.5 w-[calc(100%+1.25rem)] sm:left-9 sm:top-4 sm:block" style={{ backgroundColor: theme.accents[index % theme.accents.length] }} />}
      <div className="relative mb-2 grid size-7 place-items-center rounded-full border-2 text-xs font-bold text-white sm:size-9 sm:text-sm" style={{ borderColor: theme.accents[index % theme.accents.length], backgroundColor: theme.accents[index % theme.accents.length] }}>{String(index + 1).padStart(2, "0")}</div>
      <SlideEditableText field={`bullet-${index}`} label={`Mốc ${index + 1}`} value={bullet} style={slide.textStyles?.[`bullet-${index}`]} editable={editProps.editable} selected={editProps.selectedField === `bullet-${index}`} onSelect={editProps.onSelectField} onCommit={editProps.onCommitText} className={cn("line-clamp-4 rounded-md border-l-2 px-2.5 py-2 text-pretty text-[clamp(.62rem,1vw,.9rem)] font-medium leading-snug sm:px-3", editProps.editable && "line-clamp-none")} styleOverrides={{ backgroundColor: theme.cards[index % theme.cards.length], borderColor: theme.accents[index % theme.accents.length] }} />
    </div>)}
  </div>;
}

function Steps({ slide, theme, ...editProps }: { slide: AssistantSlideContent; theme: AssistantSlideTheme } & Pick<SlideCanvasProps, "editable" | "selectedField" | "onSelectField" | "onCommitText">) {
  return <ol className="grid min-h-0 flex-1 content-center grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
    {slide.bullets.map((bullet, index) => <li key={`${bullet}-${index}`} className="min-h-0 rounded-lg border-l-4 p-2.5 sm:rounded-xl sm:p-4" style={{ borderColor: theme.accents[index % theme.accents.length], backgroundColor: theme.cards[index % theme.cards.length] }}>
      <span className="block text-lg font-semibold sm:text-2xl" style={{ color: theme.accents[index % theme.accents.length] }}>{String(index + 1).padStart(2, "0")}</span>
      <SlideEditableText field={`bullet-${index}`} label={`Bước ${index + 1}`} value={bullet} style={slide.textStyles?.[`bullet-${index}`]} editable={editProps.editable} selected={editProps.selectedField === `bullet-${index}`} onSelect={editProps.onSelectField} onCommit={editProps.onCommitText} className={cn("mt-1 line-clamp-4 text-pretty text-[clamp(.62rem,1vw,.9rem)] font-medium leading-snug", editProps.editable && "line-clamp-none")} />
    </li>)}
  </ol>;
}

function Comparison({ slide, theme, ...editProps }: { slide: AssistantSlideContent; theme: AssistantSlideTheme } & Pick<SlideCanvasProps, "editable" | "selectedField" | "onSelectField" | "onCommitText">) {
  const split = Math.ceil(slide.bullets.length / 2);
  const groups = [slide.bullets.slice(0, split), slide.bullets.slice(split)];
  return <div className="grid min-h-0 flex-1 content-center grid-cols-2 gap-2 sm:gap-4">
    {groups.map((group, index) => <section key={index} className="min-h-0 rounded-lg border-t-4 p-3 sm:rounded-xl sm:p-5" style={{ backgroundColor: theme.cards[index], borderColor: theme.accents[index] }}>
      <h3 className="text-[clamp(.58rem,.9vw,.8rem)] font-bold uppercase" style={{ color: theme.accents[index] }}>Nhóm {index + 1}</h3>
      <ul className="mt-2 space-y-2 sm:mt-3 sm:space-y-3">{group.map((bullet, itemIndex) => { const bulletIndex = index === 0 ? itemIndex : split + itemIndex; return <li key={`${bullet}-${itemIndex}`} className="border-l-2 pl-2" style={{ borderColor: theme.accents[index] }}><SlideEditableText field={`bullet-${bulletIndex}`} label={`Ý ${bulletIndex + 1}`} value={bullet} style={slide.textStyles?.[`bullet-${bulletIndex}`]} editable={editProps.editable} selected={editProps.selectedField === `bullet-${bulletIndex}`} onSelect={editProps.onSelectField} onCommit={editProps.onCommitText} className={cn("line-clamp-4 text-pretty text-[clamp(.62rem,1vw,.9rem)] font-medium leading-snug", editProps.editable && "line-clamp-none")} /></li>; })}</ul>
    </section>)}
  </div>;
}

function Chart({ slide, theme, ...editProps }: { slide: AssistantSlideContent; theme: AssistantSlideTheme } & Pick<SlideCanvasProps, "editable" | "selectedField" | "onSelectField" | "onCommitText">) {
  const metrics = getSlideMetrics(slide);
  const max = Math.max(...metrics.map(item => item.value), 1);
  return <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5 sm:gap-4">
    {metrics.map((metric, index) => { const bulletIndex = slide.bullets.indexOf(metric.label); return <div key={`${metric.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
      <SlideEditableText field={`bullet-${bulletIndex}`} label={`Dữ liệu ${index + 1}`} value={metric.label} style={slide.textStyles?.[`bullet-${bulletIndex}`]} editable={editProps.editable} selected={editProps.selectedField === `bullet-${bulletIndex}`} onSelect={editProps.onSelectField} onCommit={editProps.onCommitText} className={cn("line-clamp-2 text-pretty text-[clamp(.58rem,.9vw,.8rem)] font-medium", editProps.editable && "line-clamp-none")} />
      <span className="text-[clamp(.58rem,.9vw,.8rem)] font-semibold tabular-nums" style={{ color: theme.accents[index % theme.accents.length] }}>{metric.rawValue}</span>
      <div className="col-span-2 h-2.5 overflow-hidden rounded-full sm:h-3.5" style={{ backgroundColor: theme.soft }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(8, metric.value / max * 100)}%`, backgroundColor: theme.accents[index % theme.accents.length] }} />
      </div>
    </div>; })}
  </div>;
}

export function AssistantStudioSlideCanvas({ deck, activeIndex, editable = false, selectedField, selectedObjectId, onSelectField, onSelectObject, onCommitText }: SlideCanvasProps) {
  const theme = getAssistantSlideTheme(deck.themeId);
  const slide = activeIndex > 0 ? deck.slides[activeIndex - 1] : null;
  const layout = slide ? inferSlideLayout(slide) : null;
  const layoutLabel = layout === "timeline" ? "DÒNG THỜI GIAN" : layout === "steps" ? "CÁC BƯỚC" : layout === "comparison" ? "SO SÁNH" : layout === "chart" ? "SỐ LIỆU" : "Ý CHÍNH";

  if (!slide) return <CoverSlide deck={deck} activeIndex={activeIndex} theme={theme} editable={editable} selectedField={selectedField} selectedObjectId={selectedObjectId} onSelectField={onSelectField} onSelectObject={onSelectObject} onCommitText={onCommitText} />;

  return <div className="relative flex h-full min-h-0 flex-col overflow-hidden p-5 font-sans sm:p-8 lg:p-10" style={{ backgroundColor: theme.canvas, color: theme.ink }}>
    <div className="mb-2 flex items-center gap-2 text-[clamp(.55rem,1vw,.78rem)] font-bold uppercase" style={{ color: theme.primary }}>
      <span className="size-2 rounded-sm" style={{ backgroundColor: theme.secondary }} />
      {layoutLabel} <span aria-hidden="true" className="opacity-50">·</span> {String(activeIndex + 1).padStart(2, "0")}
    </div>
    <SlideEditableText as="h2" field="title" label="Tiêu đề slide" value={slide.title} style={slide.textStyles?.title} editable={editable} selected={selectedField === "title"} onSelect={onSelectField} onCommit={onCommitText} className={cn("line-clamp-2 text-balance text-lg font-semibold leading-tight sm:text-3xl lg:text-4xl", editable && "line-clamp-none")} />
    {slide.keyMessage && <SlideEditableText field="keyMessage" label="Thông điệp chính" value={slide.keyMessage} style={slide.textStyles?.keyMessage} editable={editable} selected={selectedField === "keyMessage"} onSelect={onSelectField} onCommit={onCommitText} className={cn("mt-2 line-clamp-2 rounded-md border-l-4 px-3 py-2 text-pretty text-[clamp(.65rem,1vw,.95rem)] font-semibold leading-snug sm:mt-3 sm:px-4 sm:py-2.5", editable && "line-clamp-none")} styleOverrides={{ borderColor: theme.primary, backgroundColor: theme.soft }} />}
    <div className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-5">
      {layout === "timeline" ? <Timeline slide={slide} theme={theme} editable={editable} selectedField={selectedField} onSelectField={onSelectField} onCommitText={onCommitText} />
        : layout === "steps" ? <Steps slide={slide} theme={theme} editable={editable} selectedField={selectedField} onSelectField={onSelectField} onCommitText={onCommitText} />
          : layout === "comparison" ? <Comparison slide={slide} theme={theme} editable={editable} selectedField={selectedField} onSelectField={onSelectField} onCommitText={onCommitText} />
            : layout === "chart" && getSlideMetrics(slide).length >= 2 ? <Chart slide={slide} theme={theme} editable={editable} selectedField={selectedField} onSelectField={onSelectField} onCommitText={onCommitText} />
              : <IdeaCards slide={slide} theme={theme} editable={editable} selectedField={selectedField} onSelectField={onSelectField} onCommitText={onCommitText} />}
    </div>
    <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2 text-[clamp(.5rem,.8vw,.7rem)]" style={{ borderColor: theme.line, color: theme.muted }}>
      <span className="min-w-0" aria-hidden="true" />
      <span className="shrink-0 tabular-nums">{activeIndex + 1} / {deck.slides.length + 1}</span>
    </div>
    <AssistantStudioSlideEditLayer objects={slide.objects || []} editable={editable} selectedObjectId={selectedObjectId} onSelectObject={onSelectObject} onCommitText={onCommitText} />
  </div>;
}
