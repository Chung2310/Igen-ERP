import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';

interface FilterBarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  children?: ReactNode;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
}

export default function FilterBar({
  keyword,
  onKeywordChange,
  children,
  ariaLabel = 'Tìm kiếm',
  placeholder = 'Tìm theo tên, số điện thoại...',
  className = '',
}: FilterBarProps) {
  return (
    <div className={`filter-bar ${className}`.trim()}>
      <div className="search-field">
        <Search size={16} className="search-icon" aria-hidden="true" />
        <span className="sr-only">{ariaLabel}</span>
        <input
          aria-label={ariaLabel}
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder={placeholder}
        />
        {keyword && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => onKeywordChange('')}
            aria-label="Xóa tìm kiếm"
            title="Xóa tìm kiếm"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
