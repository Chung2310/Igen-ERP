import { ArrowLeft } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export function AssistantStudioBreadcrumb({ title, onBack, titleAsHeading = true }: { title: string; onBack: () => void; titleAsHeading?: boolean }) {
  const currentTitleClass = "min-w-0 truncate text-on-surface";

  return <div className="flex min-w-0 items-center gap-1 text-sm">
    <button type="button" onClick={onBack} className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-1 text-on-surface/60 hover:text-on-surface", focusClass)}><ArrowLeft className="size-4" aria-hidden="true" />AI Studio</button>
    <span className="text-on-surface/60" aria-hidden="true">/</span>
    {titleAsHeading ? <h1 className={cn(currentTitleClass, "text-sm! leading-5! font-medium! text-balance")}>{title}</h1> : <span className={cn(currentTitleClass, "font-medium")} aria-current="page">{title}</span>}
  </div>;
}
