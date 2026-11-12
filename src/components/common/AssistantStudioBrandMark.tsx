import { useId } from "react";

export function AssistantStudioBrandMark({ className = "ml-1 mt-0.5 size-6 shrink-0 sm:size-7" }: { className?: string }) {
  const gradientId = useId().replace(/:/g, "");
  return <svg viewBox="0 0 28 28" className={className} aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} x1="0" x2="1"><stop offset="0%" stopColor="#00adfc" /><stop offset="55%" stopColor="#199bff" /><stop offset="100%" stopColor="#7567ff" /></linearGradient></defs>
    <path fill={`url(#${gradientId})`} d="m12 1.5 2.2 6.7 6.7 2.2-6.7 2.2-2.2 6.7-2.2-6.7-6.7-2.2 6.7-2.2L12 1.5Zm10.5 13.3 1.1 3.1 3.1 1.1-3.1 1.1-1.1 3.1-1.1-3.1-3.1-1.1 3.1-1.1 1.1-3.1ZM5 19.3l.7 2 .7-2 2-.7-2-.7-.7-2-.7 2-2 .7 2 .7Z" />
  </svg>;
}
