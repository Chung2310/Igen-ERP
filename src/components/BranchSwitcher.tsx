import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, GitBranch } from "lucide-react";
import type { BranchOption } from "../context/BranchContext";

interface BranchSwitcherProps {
  branches: BranchOption[];
  activeBranchId: string;
  onChange: (id: string) => void;
}

export default function BranchSwitcher({ branches, activeBranchId, onChange }: BranchSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeBranch = branches.find((branch) => branch._id === activeBranchId);

  useEffect(() => {
    if (!open) return;
    const activeIndex = Math.max(0, branches.findIndex((branch) => branch._id === activeBranchId));
    optionRefs.current[activeIndex]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, activeBranchId, branches]);

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % branches.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + branches.length) % branches.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = branches.length - 1;
    else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocus();
      return;
    } else return;
    event.preventDefault();
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Chi nhánh đang chọn: ${activeBranch?.name ?? "Chọn chi nhánh"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex max-w-[220px] min-w-0 items-center gap-1.5 rounded-xl bg-[#eaf8ff] px-2.5 py-2 text-[#075a82] transition-colors hover:bg-[#d9f2ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00adfc] sm:max-w-[260px]"
      >
        <GitBranch className="h-4 w-4 shrink-0 text-[#0099df]" aria-hidden="true" />
        <span className="hidden shrink-0 text-xs sm:inline">Chi nhánh</span>
        <span className="min-w-0 truncate text-xs font-medium">{activeBranch ? `${activeBranch.name} (${activeBranch.code})` : "Chọn chi nhánh"}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Chọn chi nhánh"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 max-h-72 w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_16px_40px_rgba(11,65,99,0.16)]"
        >
          <div className="px-3 pb-1.5 pt-2 text-xs text-slate-500">Chi nhánh đang xem</div>
          {branches.map((branch, index) => {
            const selected = branch._id === activeBranchId;
            return (
              <button
                key={branch._id}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(branch._id);
                  closeAndFocus();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#00adfc] ${selected ? "bg-[#eaf8ff] text-[#007cb9]" : "text-slate-700 hover:bg-[#f1f9fd]"}`}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{branch.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{branch.code}</span>
                <Check className={`h-4 w-4 shrink-0 ${selected ? "text-[#00adfc]" : "invisible"}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
