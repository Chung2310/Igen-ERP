import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type HrSelectOption = { value: string; label: string };

export function HrFormSelect({ value, options, onChange, label, disabled = false }: {
  value: string;
  options: HrSelectOption[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    const closeMenu = () => setIsOpen(false);
    const handleScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", handleOutsideClick);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", handleScroll, true);
    const focusFrame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", handleScroll, true);
      cancelAnimationFrame(focusFrame);
    };
  }, [isOpen]);

  const toggleMenu = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const desiredHeight = Math.min(240, options.length * 36 + 8);
    const spaceBelow = window.innerHeight - bounds.bottom - 12;
    const placeAbove = spaceBelow < desiredHeight && bounds.top > spaceBelow;
    const availableHeight = Math.max(80, placeAbove ? bounds.top - 12 : spaceBelow);
    const maxHeight = Math.min(desiredHeight, availableHeight);
    setMenuPosition({
      top: placeAbove ? bounds.top - maxHeight - 4 : bounds.bottom + 4,
      left: bounds.left,
      width: bounds.width,
      maxHeight,
    });
    setIsOpen(true);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={toggleMenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!isOpen) toggleMenu();
          }
        }}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-slate-800 outline-none transition-colors hover:border-[#8edcff] focus:border-[#00ADFC] focus:ring-2 focus:ring-[#00ADFC]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 cursor-pointer"
      >
        <span className="min-w-0 truncate">{options.find(option => option.value === value)?.label || options[0]?.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#007EB8] transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={label}
          className="fixed z-[60] overflow-y-auto rounded-xl border border-[#DCE7F4] bg-white p-1 shadow-xl"
          style={menuPosition}
        >
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
                  const currentIndex = items.indexOf(event.currentTarget);
                  const nextIndex = (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
                  items[nextIndex]?.focus();
                } else if (event.key === "Tab") {
                  setIsOpen(false);
                }
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition-colors cursor-pointer ${option.value === value ? "bg-[#E8F7FF] text-[#007EB8]" : "text-slate-800 hover:bg-[#F3FAFF]"}`}
            >
              {option.label}
            </button>
          ))}
        </div>, document.fullscreenElement || document.body
      )}
    </>
  );
}

