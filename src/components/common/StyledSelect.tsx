import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

export type StyledSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type StyledSelectProps = {
  value: string;
  options: StyledSelectOption[];
  onChange(value: string): void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  appearance?: "default" | "erp";
  describedBy?: string;
  required?: boolean;
};

export function StyledSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Chọn một mục",
  disabled = false,
  className = "",
  menuClassName = "",
  describedBy,
  required = false,
}: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedOption = options.find((option) => option.value === value);
  const showingPlaceholder = !value || !selectedOption;

  const updatePosition = useCallback(() => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const desiredHeight = Math.min(280, options.length * 40 + 12);
    const spaceBelow = window.innerHeight - bounds.bottom - 12;
    const spaceAbove = bounds.top - 12;
    const placeAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(desiredHeight, Math.max(80, placeAbove ? spaceAbove : spaceBelow));
    setPosition({
      top: placeAbove ? bounds.top - maxHeight - 6 : bounds.bottom + 6,
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - bounds.width - 12)),
      width: Math.min(bounds.width, window.innerWidth - 24),
      maxHeight,
    });
  }, [options.length]);

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    setPortalRoot(triggerRef.current?.closest("dialog") || document.body);
    updatePosition();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handleResize = () => updatePosition();
    const handleScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    const firstEnabledIndex = options.findIndex((option) => !option.disabled);
    optionRefs.current[selectedIndex >= 0 ? selectedIndex : firstEnabledIndex]?.focus();
    const handleOutside = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, options, value]);

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const enabledIndexes = options.flatMap((option, index) => option.disabled ? [] : [index]);
    if (!enabledIndexes.length) return;
    const current = enabledIndexes.indexOf(optionRefs.current.findIndex((option) => option === document.activeElement));
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1 + enabledIndexes.length) % enabledIndexes.length;
    else if (event.key === "ArrowUp") next = (current - 1 + enabledIndexes.length) % enabledIndexes.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabledIndexes.length - 1;
    else if (event.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
    optionRefs.current[enabledIndexes[next]]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        aria-invalid={invalid && required && !value || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openMenu();
          }
        }}
        className={cn("flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-left text-sm font-normal text-on-surface outline-none transition-colors hover:border-primary focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60", className)}
      >
        <span className={cn("min-w-0 truncate", showingPlaceholder && "text-on-surface-variant/60")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-primary transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {required && <select
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        required
        disabled={disabled}
        value={value}
        onChange={(event) => { setInvalid(false); onChange(event.target.value); }}
        onInvalid={(event) => { event.preventDefault(); setInvalid(true); triggerRef.current?.focus(); }}
      >
        {!options.some((option) => option.value === "") && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>}
      {invalid && required && !value && !disabled && <span role="alert" className="block text-xs text-error">Vui lòng chọn một mục.</span>}
      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={handleMenuKeyDown}
          className={cn("fixed z-[200] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-1 text-on-surface shadow-lg", menuClassName)}
          style={position}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={`${option.value}-${index}`}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onClick={() => {
                  setInvalid(false);
                  onChange(option.value);
                  closeAndFocus();
                }}
                className={cn("flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-normal transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45", selected ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-primary/5")}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>, portalRoot || document.body,
      )}
    </>
  );
}
