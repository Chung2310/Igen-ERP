import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, UserRound, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { erpInputClass } from '../Erp/ErpUI';

export interface InstructorOption {
  /** uid tài khoản */
  value: string;
  /** Nhãn hiển thị, ví dụ "Nguyễn Văn A (Nhân viên)" */
  label: string;
}

interface InstructorComboboxProps {
  /** uid tài khoản trong công ty được gán (rỗng nếu nhập tay) */
  instructorId: string;
  /** Tên nhập tay (chỉ dùng khi instructorId rỗng) */
  instructorText: string;
  /** Danh sách tài khoản có thể gán (đã lọc theo chi nhánh) */
  options: InstructorOption[];
  onChange: (next: { instructorId: string; instructorText: string }) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

/**
 * Người phụ trách: có thể gõ tên tự do hoặc chọn một tài khoản trong công ty.
 * Chọn tài khoản sẽ gán instructorId, gõ tay sẽ gán instructorText.
 */
export function InstructorCombobox({
  instructorId,
  instructorText,
  options,
  onChange,
  placeholder = 'Nhập tên hoặc chọn tài khoản...',
  required = false,
  className,
}: InstructorComboboxProps) {
  const darkMode = false;
  const selected = options.find((o) => o.value === instructorId);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Giá trị hiển thị: tên tài khoản đã gán, hoặc nội dung đang gõ / đã nhập tay
  const inputValue = isOpen ? query : selected?.label ?? instructorText;

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('vi');
    if (!term) return options;
    return options.filter((o) => o.label.toLocaleLowerCase('vi').includes(term));
  }, [options, query]);

  const openWith = (value: string) => {
    setQuery(value);
    setIsOpen(true);
  };

  const handleType = (value: string) => {
    setQuery(value);
    // Gõ tay => bỏ liên kết tài khoản, lưu thành text
    onChange({ instructorId: '', instructorText: value });
  };

  const pick = (option: InstructorOption) => {
    onChange({ instructorId: option.value, instructorText: '' });
    setQuery('');
    setIsOpen(false);
  };

  const clear = () => {
    onChange({ instructorId: '', instructorText: '' });
    setQuery('');
    setIsOpen(false);
  };

  const hasValue = Boolean(instructorId || instructorText);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        autoComplete="off"
        required={required && !hasValue}
        placeholder={placeholder}
        value={inputValue}
        onFocus={() => openWith(selected ? '' : instructorText)}
        onChange={(e) => handleType(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
          if (e.key === 'Enter' && isOpen) {
            e.preventDefault();
            if (matches.length === 1) pick(matches[0]);
            else setIsOpen(false);
          }
        }}
        className={cn(erpInputClass(darkMode), 'pr-16', className)}
      />

      <div className="absolute top-0 right-1 h-9 flex items-center gap-1 text-slate-400">
        {hasValue && (
          <button
            type="button"
            title="Bỏ người phụ trách"
            onClick={clear}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:text-rose-500 hover:bg-rose-50 cursor-pointer transition-colors border border-transparent"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Chọn tài khoản trong công ty"
          onClick={() => (isOpen ? setIsOpen(false) : openWith(selected ? '' : instructorText))}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:text-brand-primary hover:bg-slate-100 cursor-pointer transition-colors border border-transparent"
        >
          <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
        </button>
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border shadow-lg py-1',
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          )}
        >
          {matches.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] font-semibold text-slate-400">
              {query.trim()
                ? `Không có tài khoản khớp — giữ nguyên "${query.trim()}" dạng tên nhập tay.`
                : 'Chưa có tài khoản nào trong công ty.'}
            </div>
          ) : (
            matches.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold cursor-pointer transition-colors',
                  darkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <UserRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate flex-1">{o.label}</span>
                {o.value === instructorId && <Check className="w-3.5 h-3.5 text-brand-primary shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}

      <p className="mt-1 text-[10px] font-semibold text-slate-400">
        {instructorId
          ? 'Đã gán tài khoản trong công ty — sẽ nhận email thông báo.'
          : instructorText
            ? 'Tên nhập tay — không gắn với tài khoản nào.'
            : 'Gõ tên tự do hoặc chọn một tài khoản trong công ty.'}
      </p>
    </div>
  );
}
