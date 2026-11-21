import { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

export type SelectOption<T extends string | number = string> = CustomSelectOption<T>;

export interface CustomSelectProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  label?: string;
  ariaLabel?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  triggerStyle?: CSSProperties;
  size?: 'sm' | 'md';
}

export default function CustomSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = '-- Chọn --',
  label,
  ariaLabel,
  required = false,
  disabled = false,
  className = '',
  style = {},
  triggerStyle = {},
  size = 'md',
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [hoveredTrigger, setHoveredTrigger] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 280 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const effectiveAriaLabel = ariaLabel || label || placeholder;

  const updatePosition = useCallback(() => {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const desiredHeight = Math.min(280, options.length * 36 + 10);
    const spaceBelow = window.innerHeight - bounds.bottom - 10;
    const spaceAbove = bounds.top - 10;
    const placeAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.min(desiredHeight, Math.max(96, placeAbove ? spaceAbove : spaceBelow));
    const menuWidth = Math.max(bounds.width, 160);
    setPosition({
      top: placeAbove ? bounds.top - maxHeight - 4 : bounds.bottom + 4,
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - menuWidth - 8)),
      width: Math.min(menuWidth, window.innerWidth - 16),
      maxHeight,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handleResize = () => updatePosition();
    const handleScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) updatePosition();
      setOpen((prev) => !prev);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        updatePosition();
        setOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        if (currentIndex < options.length - 1) {
          onChange(options[currentIndex + 1].value);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        updatePosition();
        setOpen(true);
      } else {
        const currentIndex = options.findIndex((opt) => opt.value === value);
        if (currentIndex > 0) {
          onChange(options[currentIndex - 1].value);
        }
      }
    }
  };

  const controlHeight = size === 'sm' ? '32px' : '36px';

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className}`.trim()}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: '#475569',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          {label} {required && <strong style={{ color: '#e11d48' }}>*</strong>}
        </span>
      )}

      {/* Trigger */}
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={effectiveAriaLabel}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (disabled) return;
          if (!open) updatePosition();
          setOpen((prev) => !prev);
        }}
        onMouseEnter={() => setHoveredTrigger(true)}
        onMouseLeave={() => setHoveredTrigger(false)}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          height: controlHeight,
          minHeight: controlHeight,
          borderRadius: '6px',
          border: open || (hoveredTrigger && !disabled) ? '1px solid #00adfc' : '1px solid #d8e2f0',
          background: disabled ? '#f1f5fb' : '#ffffff',
          padding: size === 'sm' ? '0 8px' : '0 10px',
          fontSize: '13px',
          color: selectedOption ? '#071629' : '#94a3b8',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: 'none',
          transition: 'border-color 150ms ease',
          userSelect: 'none',
          ...triggerStyle,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            fontWeight: 400,
            color: selectedOption ? '#071629' : '#94a3b8',
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          size={15}
          aria-hidden="true"
          style={{
            color: open ? '#00adfc' : '#64748b',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease, color 150ms ease',
          }}
        />
      </div>

      {/* Dropdown Options List rendered via Portal (chuẩn StyledSelect của ERP Nhân sự) */}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={effectiveAriaLabel}
            style={{
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              maxHeight: `${position.maxHeight}px`,
              boxSizing: 'border-box',
              zIndex: 9999,
              background: '#ffffff',
              border: '1px solid #d8e2f0',
              borderRadius: '6px',
              boxShadow: '0 10px 20px rgb(11 65 99 / 12%)',
              overflowY: 'auto',
              padding: '4px',
              fontFamily: '"Inter", "Be Vietnam Pro", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={String(opt.value)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '5px',
                    fontSize: '13px',
                    lineHeight: '18px',
                    cursor: 'pointer',
                    fontWeight: 400,
                    background: isSelected ? 'color-mix(in srgb, #00adfc 10%, #ffffff)' : 'transparent',
                    color: isSelected ? '#0077b3' : '#071629',
                    transition: 'background-color 120ms ease',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'color-mix(in srgb, #00adfc 5%, #ffffff)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {opt.label}
                  </span>
                  {isSelected && <Check size={15} aria-hidden="true" style={{ color: '#00adfc', flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
