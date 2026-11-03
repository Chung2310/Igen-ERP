import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../modules/student-management/lib/utils';
import { getSidebarMenuIcon } from './SidebarMenuIcon';
import './module-navigation.css';

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.7" y="3.6" width="18.6" height="16.8" rx="4" />
      <path d="M8.8 3.8v16.4" />
      <path d={collapsed ? 'm13 8.8 3.2 3.2-3.2 3.2' : 'm16.2 8.8-3.2 3.2 3.2 3.2'} />
    </svg>
  );
}

interface ModuleNavigationProps {
  label: string;
  activeValue?: string;
  children: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  wheelScroll?: boolean;
  layout?: 'sidebar' | 'horizontal';
}

/** Shared module navigation. Its desktop layout is placed beside the workspace in CSS. */
export function ModuleNavigation({
  label,
  activeValue,
  children,
  actions,
  id,
  className,
  wheelScroll = true,
  layout = 'sidebar',
}: ModuleNavigationProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navId = useId();
  const gradientId = `module-nav-gradient-${navId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const railRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const revealedItemRef = useRef<{ element: HTMLElement; value: string | undefined } | null>(null);

  useLayoutEffect(() => {
    if (layout === 'horizontal') {
      railRef.current?.style.removeProperty('visibility');
      return;
    }
    const rail = railRef.current;
    const parent = rail?.parentElement;
    const page = rail?.closest<HTMLElement>('#primary_page_container');
    if (!rail || !parent || !page) return;

    let frame = 0;
    const updatePosition = () => {
      frame = 0;
      if (window.innerWidth < 1024) {
        rail.style.visibility = '';
        return;
      }
      const pageBounds = page.getBoundingClientRect();
      const parentBounds = parent.getBoundingClientRect();
      const top = Math.max(pageBounds.top + 8, parentBounds.top);
      const bottom = Math.min(pageBounds.bottom - 8, parentBounds.bottom, window.innerHeight - 8);
      rail.style.visibility = bottom > top ? '' : 'hidden';
      rail.style.setProperty('--module-navigation-left', `${parentBounds.left}px`);
      rail.style.setProperty('--module-navigation-top', `${top}px`);
      rail.style.setProperty('--module-navigation-height', `${Math.max(0, bottom - top)}px`);
    };
    const schedulePosition = () => {
      if (!frame) frame = window.requestAnimationFrame(updatePosition);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePosition);
    observer?.observe(page);
    observer?.observe(parent);
    page.addEventListener('scroll', schedulePosition, { passive: true });
    window.addEventListener('resize', schedulePosition);
    updatePosition();
    return () => {
      observer?.disconnect();
      page.removeEventListener('scroll', schedulePosition);
      window.removeEventListener('resize', schedulePosition);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [layout]);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) {
      revealedItemRef.current = null;
      return;
    }
    if (revealedItemRef.current?.element === active && revealedItemRef.current.value === activeValue) return;
    revealedItemRef.current = { element: active, value: activeValue };
    const viewport = nav.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (getComputedStyle(nav).flexDirection === 'column') {
      if (item.top < viewport.top) nav.scrollTop -= viewport.top - item.top;
      else if (item.bottom > viewport.bottom) nav.scrollTop += item.bottom - viewport.bottom;
    } else if (item.left < viewport.left) nav.scrollLeft -= viewport.left - item.left;
    else if (item.right > viewport.right) nav.scrollLeft += item.right - viewport.right;
  }, [activeValue, children]);

  return (
    <div
      id={id}
      ref={railRef}
      data-module-navigation
      data-layout={layout}
      data-collapsed={collapsed}
      style={{ '--module-nav-icon-gradient': `url(#${gradientId})` } as CSSProperties}
      className={cn(
        'flex min-w-0 shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5',
        className
      )}
    >
      <svg className="absolute size-0" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#007db8" />
            <stop offset="25%" stopColor="#00adfc" />
            <stop offset="58%" stopColor="#7567ff" />
            <stop offset="100%" stopColor="#a21caf" />
          </linearGradient>
        </defs>
      </svg>
      {layout === 'sidebar' && <button
        type="button"
        data-module-navigation-toggle
        aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
        aria-pressed={collapsed}
        aria-controls={navId}
        title={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
        onClick={() => setCollapsed((current) => !current)}
        className="hidden size-10 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
      >
        <SidebarToggleIcon collapsed={collapsed} />
      </button>}
      <div className="flex min-w-0 flex-1 items-center">
        <nav
          id={navId}
          ref={navRef}
          aria-label={label}
          className="scrollbar-none flex min-w-0 max-w-full flex-1 select-none gap-1 overflow-x-auto py-1"
          onWheel={
            wheelScroll
              ? (event) => {
                  if (navRef.current) {
                    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
                    if (delta !== 0) {
                      if (getComputedStyle(navRef.current).flexDirection === 'column') navRef.current.scrollTop += delta;
                      else navRef.current.scrollLeft += delta;
                    }
                  }
                }
              : undefined
          }
        >
          {children}
        </nav>
      </div>
      {actions && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

interface ModuleNavigationButtonProps extends ComponentProps<'button'> {
  active: boolean;
  icon?: ReactNode;
}

function getMenuLabel(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(getMenuLabel).join('');
  return '';
}

export function ModuleNavigationButton({ active, icon, children, className, ...props }: ModuleNavigationButtonProps) {
  const menuLabel = getMenuLabel(children).trim();
  const displayIcon = (menuLabel ? getSidebarMenuIcon(menuLabel) : null) ?? icon;
  return (
    <button
      {...props}
      type={props.type || 'button'}
      aria-current={active ? 'page' : undefined}
      title={props.title ?? (menuLabel || undefined)}
      className={cn(
        'flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium normal-case focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9',
        active ? 'bg-primary/5 font-semibold text-primary hover:bg-primary/10' : 'text-on-surface hover:bg-surface hover:text-primary focus-visible:text-primary',
        className
      )}
    >
      {displayIcon && <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center [&>svg]:size-5">{displayIcon}</span>}
      <span>{children}</span>
    </button>
  );
}
