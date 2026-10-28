import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../modules/student-management/lib/utils';
import './module-navigation.css';

interface ModuleNavigationProps {
  label: string;
  activeValue?: string;
  children: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  wheelScroll?: boolean;
}

/** Shared horizontal module navigation, using the HR navigation as the visual standard. */
export function ModuleNavigation({ label, activeValue, children, actions, id, className, wheelScroll }: ModuleNavigationProps) {
  const navRef = useRef<HTMLElement>(null);
  const revealedItemRef = useRef<{ element: HTMLElement; value: string | undefined } | null>(null);
  const [scroll, setScroll] = useState({ left: false, right: false });

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const left = nav.scrollLeft > 1;
      const right = nav.scrollLeft < nav.scrollWidth - nav.clientWidth - 1;
      setScroll(previous => previous.left === left && previous.right === right ? previous : { left, right });
    };
    update();
    nav.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(nav);
    Array.from(nav.children).forEach(child => observer?.observe(child));
    return () => {
      nav.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [children]);

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
    if (item.left < viewport.left) nav.scrollLeft -= viewport.left - item.left;
    else if (item.right > viewport.right) nav.scrollLeft += item.right - viewport.right;
  }, [activeValue, children]);

  const move = (direction: number) => {
    const nav = navRef.current;
    if (!nav) return;
    nav.scrollBy({ left: direction * Math.max(240, nav.clientWidth * 0.75), behavior: 'auto' });
  };
  const arrowClass = 'flex size-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40';

  return <div id={id} data-module-navigation className={cn('flex min-w-0 shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-5', className)}>
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {(scroll.left || scroll.right) && <button type="button" aria-label={`Cuộn ${label} sang trái`} disabled={!scroll.left} onClick={() => move(-1)} className={arrowClass}><ChevronLeft className="size-4" aria-hidden="true" /></button>}
      <nav ref={navRef} aria-label={label} className="scrollbar-none flex min-w-0 max-w-full flex-1 select-none gap-1 overflow-x-auto py-1" onWheel={wheelScroll ? event => { if (navRef.current) navRef.current.scrollLeft += event.deltaY || event.deltaX; } : undefined}>
        {children}
      </nav>
      {(scroll.left || scroll.right) && <button type="button" aria-label={`Cuộn ${label} sang phải`} disabled={!scroll.right} onClick={() => move(1)} className={arrowClass}><ChevronRight className="size-4" aria-hidden="true" /></button>}
    </div>
    {actions && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3">{actions}</div>}
  </div>;
}

interface ModuleNavigationButtonProps extends ComponentProps<'button'> {
  active: boolean;
  icon?: ReactNode;
}

export function ModuleNavigationButton({ active, icon, children, className, ...props }: ModuleNavigationButtonProps) {
  return <button {...props} type={props.type || 'button'} aria-current={active ? 'page' : undefined}
    className={cn('flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold normal-case focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9', active ? 'bg-primary font-bold text-on-primary shadow-xs' : 'text-on-surface-variant hover:bg-surface hover:text-primary', className)}>
    {icon && <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>}
    <span>{children}</span>
  </button>;
}
