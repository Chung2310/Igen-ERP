import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function toIsoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatViDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return '';
  return `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}`;
}

function getTodayIso(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export default function CustomDatePicker({
  value,
  onChange,
  label,
  ariaLabel,
  placeholder = 'dd/mm/yyyy',
  min,
  max,
  disabled = false,
  clearable = true,
  required = false,
  className = '',
  style = {},
}: CustomDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const initial = parseIsoDate(value) || parseIsoDate(getTodayIso())!;
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m); // 1-12
  const [position, setPosition] = useState({ top: 0, left: 0, width: 276 });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const todayIso = getTodayIso();
  const effectiveAriaLabel = ariaLabel || label || 'Chọn ngày';

  const updatePosition = useCallback(() => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const width = Math.min(276, window.innerWidth - 16);
    const height = popoverRef.current?.getBoundingClientRect().height || 310;
    const spaceBelow = window.innerHeight - bounds.bottom - 10;
    const spaceAbove = bounds.top - 10;
    const placeAbove = spaceBelow < height && spaceAbove > spaceBelow;
    setPosition({
      top: Math.max(8, Math.min(placeAbove ? bounds.top - height - 4 : bounds.bottom + 4, window.innerHeight - height - 8)),
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handleResize = () => updatePosition();
    const handleScroll = (event: Event) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, viewYear, viewMonth, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      const parsed = parseIsoDate(value) || parseIsoDate(todayIso)!;
      setViewYear(parsed.y);
      setViewMonth(parsed.m);
      updatePosition();
    }
    setOpen((prev) => !prev);
  };

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build calendar cells (Monday-first)
  const firstDayJs = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun..6=Sat
  const offset = (firstDayJs + 6) % 7; // 0=Mon..6=Sun
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isDisabledDay = (iso: string) => {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  const displayValue = formatViDate(value);

  return (
    <div
      ref={containerRef}
      className={`custom-date-picker ${className}`.trim()}
      style={{ position: 'relative', width: '100%', minWidth: 0, ...style }}
    >
      {label && (
        <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '4px' }}>
          {label} {required && <strong style={{ color: '#e11d48' }}>*</strong>}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={effectiveAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggleOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          height: '36px',
          minHeight: '36px',
          padding: '0 10px',
          borderRadius: '6px',
          border: open || (hovered && !disabled) ? '1px solid #00adfc' : '1px solid #d8e2f0',
          background: disabled ? '#f1f5fb' : '#ffffff',
          color: displayValue ? '#071629' : '#94a3b8',
          fontSize: '13px',
          fontWeight: 400,
          fontVariantNumeric: 'tabular-nums',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: 'none',
          transition: 'border-color 150ms ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
          {displayValue || placeholder}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Xóa ngày"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                color: '#64748b',
              }}
            >
              <X size={12} aria-hidden="true" />
            </span>
          )}
          <CalendarDays size={15} aria-hidden="true" style={{ color: '#00adfc' }} />
        </span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={`Lịch ${effectiveAriaLabel.toLowerCase()}`}
            style={{
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              zIndex: 9999,
              background: '#ffffff',
              border: '1px solid #d8e2f0',
              borderRadius: '6px',
              boxShadow: '0 10px 20px rgb(11 65 99 / 12%)',
              padding: '10px',
              fontFamily: '"Inter", "Be Vietnam Pro", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
            }}
          >
            {/* Header Month / Year */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#071629' }}>
                Tháng {viewMonth} / {viewYear}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button
                  type="button"
                  aria-label="Tháng trước"
                  onClick={prevMonth}
                  style={{
                    width: '28px',
                    height: '28px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Tháng sau"
                  onClick={nextMonth}
                  style={{
                    width: '28px',
                    height: '28px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Weekdays */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#64748b',
                    padding: '4px 0',
                  }}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {cells.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} />;
                const iso = toIsoDate(viewYear, viewMonth, day);
                const isSelected = iso === value;
                const isToday = iso === todayIso;
                const dayDisabled = isDisabledDay(iso);

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={dayDisabled}
                    aria-label={formatViDate(iso)}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    style={{
                      height: '32px',
                      borderRadius: '5px',
                      border: isToday && !isSelected ? '1px solid #7dd3fc' : '1px solid transparent',
                      background: isSelected ? '#00adfc' : 'transparent',
                      color: dayDisabled ? '#cbd5e1' : isSelected ? '#ffffff' : isToday ? '#0077b3' : '#071629',
                      fontSize: '12px',
                      fontWeight: isSelected || isToday ? 600 : 400,
                      fontVariantNumeric: 'tabular-nums',
                      cursor: dayDisabled ? 'not-allowed' : 'pointer',
                      transition: 'background-color 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !dayDisabled) e.currentTarget.style.background = '#e0f2fe';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !dayDisabled) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Footer quick actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!isDisabledDay(todayIso)) {
                    onChange(todayIso);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#0077b3',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Hôm nay
              </button>
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '2px 4px',
                  }}
                >
                  Xóa
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
