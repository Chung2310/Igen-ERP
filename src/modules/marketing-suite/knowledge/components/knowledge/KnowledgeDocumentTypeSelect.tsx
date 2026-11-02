import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { KnowledgeDocumentType } from "../../services/companyKnowledgeService";

interface Option {
  id: KnowledgeDocumentType;
  label: string;
}

interface Props {
  value: KnowledgeDocumentType;
  onChange: (value: KnowledgeDocumentType) => void;
  groups: Array<{ label?: string; options: Option[] }>;
  disabled?: boolean;
  className?: string;
}

export function KnowledgeDocumentTypeSelect({ value, onChange, groups, disabled = false, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const selectedLabel = groups.flatMap((group) => group.options).find((option) => option.id === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]')?.focus();
    });
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") { setOpen(false); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) { setOpen(true); return; }
    const options = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') || []);
    if (!options.length) return;
    const index = options.findIndex((option) => option === document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (index + (event.key === "ArrowUp" ? -1 : 1) + options.length) % options.length;
    options[next]?.focus();
  };

  return (
    <div ref={rootRef} onKeyDown={handleKeyDown} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={`Loại tài liệu: ${selectedLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm text-slate-800 transition-colors hover:border-[#00ADFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00ADFC]/30 disabled:cursor-not-allowed disabled:opacity-50 ${open ? "border-[#00ADFC]" : "border-slate-200"}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={17} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id={menuId} role="listbox" aria-label="Loại tài liệu" className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full min-w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/70">
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? groupIndex}>
              {group.label && <div className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">{group.label}</div>}
              {group.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  role="option"
                  aria-selected={value === option.id}
                  onClick={() => { onChange(option.id); setOpen(false); triggerRef.current?.focus(); }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${value === option.id ? "bg-sky-50 text-[#0089C8]" : "text-slate-700 hover:bg-slate-50 hover:text-[#0089C8]"}`}
                >
                  <span>{option.label}</span>
                  {value === option.id && <Check size={16} className="shrink-0" />}
                </button>
              ))}
              {groupIndex < groups.length - 1 && <div className="mx-2 my-1 border-t border-slate-100" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
