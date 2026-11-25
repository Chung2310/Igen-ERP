import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const BASE_MINUTES = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

function normalizeTimeValue(raw: string): string | null {
  const cleaned = raw.trim();
  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(cleaned);
  if (colonMatch) {
    const h = Number(colonMatch[1]);
    const m = Number(colonMatch[2]);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return null;
  }
  if (/^\d{3,4}$/.test(cleaned)) {
    const padded = cleaned.padStart(4, '0');
    const h = Number(padded.slice(0, 2));
    const m = Number(padded.slice(2, 4));
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return null;
}

interface VietnameseTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  required?: boolean;
  variant?: 'default' | 'filter';
  portalTarget?: HTMLElement | null | (() => HTMLElement | null);
  className?: string;
}

export function VietnameseTimePicker({
  value,
  onChange,
  ariaLabel,
  disabled = false,
  required = false,
  variant = 'filter',
  portalTarget,
  className,
}: VietnameseTimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const safeValue = /^\d{2}:\d{2}$/.test(value) ? value : '08:00';
  const [hour, minute] = safeValue.split(':');
  const [displayValue, setDisplayValue] = useState(safeValue);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDisplayValue(safeValue);
  }, [safeValue]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverHeight = 250;
      const popoverWidth = 200;
      const top =
        window.innerHeight - rect.bottom >= popoverHeight || rect.top < popoverHeight
          ? rect.bottom + 6
          : rect.top - popoverHeight - 6;
      setPosition({
        top,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8)),
      });
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!inputRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        inputRef.current?.focus();
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const minutes = BASE_MINUTES.includes(minute)
    ? BASE_MINUTES
    : [...BASE_MINUTES, minute].sort((a, b) => Number(a) - Number(b));

  const target = typeof portalTarget === 'function' ? portalTarget() : portalTarget;
  const mountNode = target ?? (typeof document !== 'undefined' ? document.body : null);

  return (
    <div className={cn('relative w-full', className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        value={displayValue}
        placeholder="HH:mm"
        onFocus={() => { if (!disabled) setOpen(true); }}
        onChange={(event) => {
          const next = event.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
          setDisplayValue(next);
          if (/^(0\d|1\d|2[0-3]):[0-5]\d$/.test(next)) onChange(next);
        }}
        onBlur={() => {
          const parsed = normalizeTimeValue(displayValue);
          if (parsed) {
            setDisplayValue(parsed);
            onChange(parsed);
          } else {
            setDisplayValue(safeValue);
          }
        }}
        className={cn(
          'w-full pr-9 text-sm tabular-nums text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60',
          variant === 'filter'
            ? 'h-10 rounded-md border border-outline-variant bg-surface-container-lowest px-3'
            : 'h-10 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5',
        )}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={`Chọn ${ariaLabel.toLowerCase()}`}
        aria-expanded={open}
        onClick={() => { if (!disabled) setOpen((current) => !current); }}
        className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Clock className="size-4" aria-hidden="true" />
      </button>

      {open && !disabled && mountNode && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Chọn ${ariaLabel.toLowerCase()}`}
          style={{ top: position.top, left: position.left }}
          className="fixed z-[9999] w-[200px] rounded-xl border border-outline-variant bg-surface-container-lowest p-2.5 shadow-lg"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1.5 text-center text-[11px] font-semibold text-on-surface-variant">Giờ</p>
              <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
                {HOURS.map((item) => {
                  const selected = item === hour;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        const next = `${item}:${minute}`;
                        setDisplayValue(next);
                        onChange(next);
                      }}
                      className={cn(
                        'block w-full cursor-pointer rounded-md py-1.5 text-center text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                        selected
                          ? 'bg-primary font-semibold text-on-primary'
                          : 'text-on-surface hover:bg-surface-container-low',
                      )}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-l border-outline-variant pl-2">
              <p className="mb-1.5 text-center text-[11px] font-semibold text-on-surface-variant">Phút</p>
              <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
                {minutes.map((item) => {
                  const selected = item === minute;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        const next = `${hour}:${item}`;
                        setDisplayValue(next);
                        onChange(next);
                        setOpen(false);
                      }}
                      className={cn(
                        'block w-full cursor-pointer rounded-md py-1.5 text-center text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                        selected
                          ? 'bg-primary font-semibold text-on-primary'
                          : 'text-on-surface hover:bg-surface-container-low',
                      )}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        mountNode,
      )}
    </div>
  );
}
