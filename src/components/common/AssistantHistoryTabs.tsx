import { cn } from "../../modules/student-management/lib/utils";
import { assistantHistoryCategories, type AssistantHistoryCategory } from "./assistant-history";

export function AssistantHistoryTabs({ value, onChange, showMeeting = false }: { value: AssistantHistoryCategory; onChange: (value: AssistantHistoryCategory) => void; showMeeting?: boolean }) {
  return <div role="group" aria-label="Loại lịch sử" className="flex shrink-0 gap-5 overflow-x-auto border-b border-outline-variant bg-surface-container-lowest px-4 sm:px-6">
    {assistantHistoryCategories.filter(category => showMeeting || category.value !== "meeting").map(category => <button
      key={category.value}
      type="button"
      aria-pressed={value === category.value}
      onClick={() => onChange(category.value)}
      className={cn("assistant-history-category relative min-h-11 shrink-0 whitespace-nowrap px-1 text-sm font-medium text-on-surface-variant hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary", value === category.value && "is-active")}
    >{category.label}</button>)}
  </div>;
}
