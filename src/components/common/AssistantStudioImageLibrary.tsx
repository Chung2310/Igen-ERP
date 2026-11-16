import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { prioritizeAssistantStudioStyles } from "./useAssistantStudioStyleFavorites";
import type { StudioStyleSample } from "./AssistantStudioImage";

function getLibraryColumnCount() {
  if (typeof window === "undefined") return 4;
  if (window.innerWidth >= 1280) return 4;
  if (window.innerWidth >= 768) return 3;
  return 2;
}

export function AssistantStudioImageLibrary({ samples, favoriteIds, onToggleFavorite, onSelect, selectedPrompt, disabled = false, fullWidth = false }: {
  samples: StudioStyleSample[];
  favoriteIds: string[];
  onToggleFavorite: (sampleId: string) => void;
  onSelect: (sample: StudioStyleSample) => void;
  selectedPrompt?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const [columnCount, setColumnCount] = useState(getLibraryColumnCount);

  useEffect(() => {
    const updateColumns = () => setColumnCount(getLibraryColumnCount());
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const columns = Array.from({ length: columnCount }, () => [] as StudioStyleSample[]);
  prioritizeAssistantStudioStyles(samples, favoriteIds).forEach((sample, index) => {
    columns[index % columnCount].push(sample);
  });

  return <section aria-label="Thư viện mẫu" className={cn("w-full space-y-3.5 pt-6 sm:pt-8", fullWidth ? "max-w-none" : "max-w-4xl")}>
    {fullWidth ? <h2 className="mb-4 text-balance text-lg font-semibold text-on-surface">Thư viện mẫu</h2> : <h3 className="px-1 text-left text-sm font-semibold text-on-surface">Thư viện mẫu</h3>}
    <div className={cn("grid items-start gap-2.5", columnCount === 4 ? "grid-cols-4" : columnCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {columns.map((column, columnIndex) => <div key={columnIndex} className="flex min-w-0 flex-col gap-2.5">{column.map((sample) => {
        const isSelected = selectedPrompt === sample.prompt;
        const isFavorite = favoriteIds.includes(sample.id);
        return <div key={sample.id} className="relative min-w-0">
          <button
            type="button"
            aria-label={sample.accessibleLabel ?? sample.label}
            onClick={() => onSelect(sample)}
            disabled={disabled}
            aria-pressed={isSelected}
            data-style-card={sample.id}
            className={cn("group relative h-full w-full overflow-hidden rounded-xl border border-outline-variant transition-all hover:border-primary hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", isSelected && "border-primary ring-2 ring-primary/30")}
          >
            <div className="relative w-full overflow-hidden bg-surface-container-low" style={{ aspectRatio: sample.previewRatio ?? ({ cinema: "16 / 9", banner: "16 / 9", poster: "4 / 5", period: "4 / 5", anime: "4 / 5" }[sample.id] || "1 / 1") }}>
              <img src={sample.imageUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none" />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <span className={cn("absolute bottom-1.5 left-2 right-2 truncate text-left text-xs font-semibold text-white drop-shadow-sm", isSelected && "text-primary-container")}>{sample.label}</span>
            </div>
          </button>
          <button
            type="button"
            aria-label={`${isFavorite ? "Bỏ ghim" : "Ghim"} phong cách ${sample.accessibleLabel ?? sample.label}`}
            title={`${isFavorite ? "Bỏ ghim" : "Ghim"} phong cách ${sample.accessibleLabel ?? sample.label}`}
            aria-pressed={isFavorite}
            onClick={() => onToggleFavorite(sample.id)}
            className={cn("absolute right-1.5 top-1.5 z-10 grid size-8 place-items-center rounded-full border border-outline-variant bg-surface-container-lowest/95 shadow-xs hover:bg-surface-container-lowest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest", isFavorite && "text-primary")}
          >
            <Heart className={cn("size-4", isFavorite ? "fill-primary text-primary" : "text-on-surface-variant")} aria-hidden="true" />
          </button>
        </div>;
      })}</div>)}
    </div>
  </section>;
}
