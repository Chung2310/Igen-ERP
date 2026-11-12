import { useId, useRef, useState } from "react";
import { Copy, MoreHorizontal } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest";

export function AssistantMessageActions({ content }: { content: string }) {
  const id = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [feedback, setFeedback] = useState("");

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(content);
      setFeedback("");
    } catch {
      setFeedback("Không thể sao chép. Vui lòng thử lại.");
    }
    popoverRef.current?.hidePopover();
  }

  return <div className="mt-2 flex items-center justify-end gap-2">
    <button type="button" popoverTarget={id} aria-label="Tùy chọn câu trả lời AI" title="Tùy chọn câu trả lời AI"
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top: Math.max(8, rect.top - 48), left: Math.max(8, Math.min(rect.left, window.innerWidth - 200)) });
        setFeedback("");
      }}
      className={cn("order-last grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low", focusClass)}>
      <MoreHorizontal className="size-4" aria-hidden="true" />
    </button>
    <div ref={popoverRef} id={id} popover="auto" role="group" aria-label="Thao tác tin nhắn"
      onToggle={event => { if (event.newState === "open") event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); }}
      style={position} className="fixed inset-auto z-50 m-0 w-48 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 text-on-surface shadow-md">
      <button type="button" onClick={() => { void copyMessage(); }} className={cn("flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-surface-container-low", focusClass)}>
        <Copy className="size-4" aria-hidden="true" />Copy tin nhắn
      </button>
    </div>
    {feedback && <span role="alert" className="text-pretty text-xs text-error">{feedback}</span>}
  </div>;
}
