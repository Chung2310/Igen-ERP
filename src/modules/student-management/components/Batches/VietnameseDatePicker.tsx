import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { erpInputClass } from '../Erp/ErpUI';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

function parseDisplayDate(text: string): string | null {
  if (!DATE_PATTERN.test(text)) return null;
  const [day, month, year] = text.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function toDisplayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function toLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
}

interface VietnameseDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  ariaLabel: string;
}

export function VietnameseDatePicker({ value, onChange, required, ariaLabel }: VietnameseDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(() => toDisplayDate(value));
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => toLocalDate(value));
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDisplayValue(toDisplayDate(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const calendarHeight = 350;
      const top = window.innerHeight - rect.bottom >= calendarHeight || rect.top < calendarHeight
        ? rect.bottom + 6
        : rect.top - calendarHeight - 6;
      setPosition({ top, left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)) });
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!inputRef.current?.contains(event.target as Node) && !calendarRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
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

  const selectDate = (date: Date) => {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    onChange(iso);
    setDisplayValue(toDisplayDate(iso));
    inputRef.current?.setCustomValidity('');
    setOpen(false);
  };

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const dates = Array.from({ length: 42 }, (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index - offset + 1));
  const today = new Date();
  const selected = toLocalDate(value);

  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        aria-label={ariaLabel}
        placeholder="dd/MM/yyyy"
        value={displayValue}
        onChange={(event) => {
          setDisplayValue(event.target.value);
          event.currentTarget.setCustomValidity('');
        }}
        onBlur={(event) => {
          const text = event.currentTarget.value.trim();
          const iso = parseDisplayDate(text);
          if (iso) {
            if (iso !== value) onChange(iso);
            setDisplayValue(toDisplayDate(iso));
            event.currentTarget.setCustomValidity('');
          } else if (text) {
            event.currentTarget.setCustomValidity('Vui lòng nhập ngày hợp lệ theo dd/MM/yyyy.');
          } else {
            if (value) onChange('');
            event.currentTarget.setCustomValidity('');
          }
        }}
        onClick={() => {
          setVisibleMonth(toLocalDate(value));
          setOpen(true);
        }}
        className={`${erpInputClass(false)} cursor-pointer pl-9 pr-10`}
      />
      <button type="button" onClick={() => { setVisibleMonth(toLocalDate(value)); setOpen((current) => !current); }} aria-label={`Chọn ${ariaLabel.toLowerCase()}`} aria-expanded={open} className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-500 hover:text-brand-primary">
        <CalendarDays className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={calendarRef} role="dialog" aria-label={`Lịch chọn ${ariaLabel.toLowerCase()}`} className="fixed z-[70] w-72 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-xl" style={position}>
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước" className="rounded-lg p-1.5 hover:bg-sky-50"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-medium">Tháng {visibleMonth.getMonth() + 1}/{visibleMonth.getFullYear()}</span>
            <button type="button" onClick={() => changeMonth(1)} aria-label="Tháng sau" className="rounded-lg p-1.5 hover:bg-sky-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day) => <span key={day} className="py-1 text-xs text-slate-500">{day}</span>)}
            {dates.map((date) => {
              const isSelected = Boolean(value) && date.getTime() === selected.getTime();
              const isToday = date.toDateString() === today.toDateString();
              return <button key={date.toISOString()} type="button" onClick={() => selectDate(date)} aria-label={`${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`} aria-pressed={isSelected} className={`h-8 rounded-lg text-xs transition-colors ${isSelected ? 'bg-brand-primary text-white' : date.getMonth() === visibleMonth.getMonth() ? 'text-slate-700 hover:bg-sky-50' : 'text-slate-400 hover:bg-sky-50'} ${isToday && !isSelected ? 'ring-1 ring-brand-primary' : ''}`}>{date.getDate()}</button>;
            })}
          </div>
          <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-xs">
            <button type="button" onClick={() => { onChange(''); setDisplayValue(''); inputRef.current?.setCustomValidity(''); setOpen(false); }} className="px-2 py-1 text-slate-500 hover:text-brand-primary">Xóa ngày</button>
            <button type="button" onClick={() => selectDate(today)} className="px-2 py-1 text-brand-primary hover:underline">Hôm nay</button>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
