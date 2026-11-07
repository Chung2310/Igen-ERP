import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { isTabHidden } from '../../config/modules';
import { tabToPath } from '../../seo/seo-config';
import { subTabToSlug } from '../../router/subTabRoutes';
import { globalSearchIndex } from './globalSearchIndex';

export function GlobalSidebarSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery
    ? globalSearchIndex.filter((item) => !isTabHidden(item.tab) && (
      item.label.toLowerCase().includes(normalizedQuery) || item.keywords.toLowerCase().includes(normalizedQuery)
    ))
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

  const selectResult = (item: (typeof globalSearchIndex)[number]) => {
    const url = new URL(window.location.href);
    url.pathname = tabToPath(item.tab);
    const slug = item.subTab ? subTabToSlug(item.tab, item.subTab) : '';
    if (slug) url.searchParams.set('sub', slug);
    else url.searchParams.delete('sub');
    if (url.toString() !== window.location.href) window.history.pushState(null, '', url.toString());
    window.dispatchEvent(new Event('popstate'));
    setQuery('');
    setOpen(false);
  };

  return <div ref={rootRef} className="relative">
    <button
      ref={triggerRef}
      data-global-sidebar-search-trigger
      type="button"
      aria-label="Tìm kiếm trong ERP"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={() => setOpen((current) => !current)}
      className="flex size-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Search className="size-5" aria-hidden="true" />
    </button>
    {open && <div id={panelId} data-global-sidebar-search-panel className="absolute left-0 top-full z-50 mt-3 w-80 max-w-[calc(100vw-5rem)] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xl">
      <div className="flex items-center gap-2 border-b border-outline-variant p-2">
        <Search className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          inputMode="search"
          aria-label="Tìm kiếm trong ERP"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none focus-visible:outline-2 focus-visible:outline-primary"
        />
        <button type="button" aria-label="Đóng tìm kiếm" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="flex size-9 shrink-0 items-center justify-center rounded-lg border-0 bg-surface text-on-surface-variant hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {normalizedQuery && <div aria-label="Kết quả tìm kiếm" className="max-h-80 overflow-y-auto">
        <div className="border-b border-outline-variant bg-surface px-4 py-2 text-xs font-semibold text-on-surface-variant">Kết quả tìm kiếm ({results.length})</div>
        {results.length ? results.map((item) => <button
          key={`${item.tab}-${item.subTab ?? item.label}`}
          type="button"
          onClick={() => selectResult(item)}
          className="flex w-full flex-col gap-1 border-b border-outline-variant px-4 py-3 text-left last:border-0 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="text-sm font-semibold text-on-surface">{item.label}</span>
          <span className="text-xs text-on-surface-variant">{item.tab}{item.subTab ? ` › ${item.subTab}` : ''}</span>
        </button>) : <p className="p-5 text-center text-sm text-on-surface-variant">Không tìm thấy phân mục phù hợp.</p>}
      </div>}
    </div>}
  </div>;
}
