import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export type PartnerDropdownOption = { value: string; label: string };

interface PartnerFormDropdownProps {
  label: string;
  value: string;
  options: PartnerDropdownOption[];
  onChange: (value: string) => void;
}

export function PartnerFormDropdown({ label, value, options, onChange }: PartnerFormDropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? '';

  const openMenu = () => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const desiredHeight = Math.min(280, options.length * 44 + 12);
    const below = window.innerHeight - bounds.bottom - 12;
    const above = bounds.top - 12;
    const placeAbove = below < desiredHeight && above > below;
    const maxHeight = Math.min(desiredHeight, Math.max(80, placeAbove ? above : below));
    setPosition({
      top: placeAbove ? bounds.top - maxHeight - 6 : bounds.bottom + 6,
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - bounds.width - 12)),
      width: Math.min(bounds.width, window.innerWidth - 24),
      maxHeight,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    optionRefs.current[selectedIndex]?.focus();
    const handleOutside = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    const handleScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, options, value]);

  const closeAndFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = optionRefs.current.findIndex((option) => option === document.activeElement);
    let next = current;
    if (event.key === 'ArrowDown') next = (current + 1) % options.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocus();
      return;
    } else if (event.key === 'Tab') {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
    optionRefs.current[next]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => open ? setOpen(false) : openMenu()}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            openMenu();
          }
        }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-[#eef9ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00adfc]"
      >
        <span className={`min-w-0 truncate ${value ? '' : 'text-slate-500'}`}>{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#008ecf] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className="fixed z-[100] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-[0_16px_40px_rgba(11,65,99,0.2)]"
          style={position}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  closeAndFocus();
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[#00adfc] ${selected ? 'bg-[#e8f7ff] text-[#007cb9]' : 'text-slate-700 hover:bg-[#f1f9fd]'}`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0 text-[#00adfc]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>, document.body
      )}
    </>
  );
}
