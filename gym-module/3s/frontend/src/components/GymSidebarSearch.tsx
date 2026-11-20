import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NavigationItem } from '../config/portalNavigation';

const searchAliases: Record<string, string> = {
  '/customers': 'quản lý khách hàng hội viên',
  '/pt/inbody': 'chỉ số phân tích cơ thể',
  '/pt/nutrition': 'thực đơn bữa ăn',
  '/pt/roadmaps': 'roadmap kế hoạch',
  '/pt/my-workout-plans': 'bài tập giáo án mẫu',
  '/management/trainers': 'huấn luyện viên tài khoản PT phân quyền',
  '/management/packages': 'gói tập mẫu',
  '/transfers': 'điều chuyển khách hàng',
  '/knowledge': 'tri thức ảnh món thư viện',
  '/admin/admin-accounts': 'admin quản trị',
};

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

export default function GymSidebarSearch({ items, onNavigate }: { items: NavigationItem[]; onNavigate: () => void }) {
  const navigate = useNavigate();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearch(query.trim());
  const results = normalizedQuery
    ? items.filter((item) => normalizeSearch(`${item.label} ${searchAliases[item.path] || ''}`).includes(normalizedQuery))
    : [];

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const selectResult = (item: NavigationItem) => {
    navigate(item.path);
    setQuery('');
    setOpen(false);
    onNavigate();
  };

  return (
    <div ref={rootRef} className="portal-search">
      <button
        ref={triggerRef}
        type="button"
        className="portal-search-trigger"
        aria-label="Tìm chức năng Gym"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <Search size={18} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="portal-search-panel">
          <div className="portal-search-field">
            <Search size={16} aria-hidden="true" />
            <input
              ref={inputRef}
              type="search"
              role="searchbox"
              className="portal-search-input"
              aria-label="Tìm chức năng Gym"
              placeholder="Tìm chức năng..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="button" className="portal-search-close" aria-label="Đóng tìm kiếm" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {normalizedQuery && (
            <div className="portal-search-results" aria-label="Kết quả tìm chức năng">
              <div className="portal-search-count">Kết quả ({results.length})</div>
              {results.length ? results.map((item) => (
                <button key={item.path} type="button" className="portal-search-result" onClick={() => selectResult(item)}>
                  {item.label}
                </button>
              )) : <p className="portal-search-empty">Không tìm thấy chức năng phù hợp.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
