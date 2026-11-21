import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  BookOpen,
  Bot,
  CalendarDays,
  LayoutDashboard,
  UserRound,
  Menu,
  Ruler,
  Salad,
  Users,
  X
} from 'lucide-react';
import { INSUFFICIENT_CREDITS_EVENT } from '../services/api';
import { navigationForPath, visibleNavigation, type NavigationSection } from '../config/portalNavigation';
import type { User } from '../types';
import { useMobile } from '../hooks/useMobile';
import { GymSidebarIcon, GymSidebarToggleIcon } from './GymSidebarIcon';
import GymSidebarSearch from './GymSidebarSearch';

const sectionOrder: NavigationSection[] = ['Tổng quan', 'Vận hành', 'Trợ lý AI', 'Tài khoản'];

interface AppShellProps {
  user: User;
  children: ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [creditError, setCreditError] = useState('');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isMobile = useMobile();
  const isCollapsed = collapsed && !isMobile;
  const location = useLocation();
  const items = visibleNavigation(user);
  const current = navigationForPath(location.pathname, user);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    const showCreditError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setCreditError(detail?.message || 'Số dư credit không đủ để sử dụng tính năng AI này.');
    };
    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, showCreditError);
    return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, showCreditError);
  }, []);

  // Định nghĩa các Quick Nav tabs đáy màn hình cho từng vai trò trên mobile
  const renderMobileBottomNav = () => {
    if (user.role === 'CUSTOMER') {
      const customerTabs = [
        { path: '/me', label: 'Hành trình', icon: LayoutDashboard, exact: true },
        { path: '/me/sessions', label: 'Lịch tập', icon: CalendarDays },
        { path: '/me/workouts', label: 'Giáo án', icon: BookOpen },
        { path: '/me/nutrition', label: 'Dinh dưỡng', icon: Salad },
        { path: '/me/inbody', label: 'InBody', icon: Ruler },
      ];
      return (
        <nav className="portal-bottom-nav" aria-label="Thanh điều hướng nhanh">
          {customerTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.exact ? location.pathname === tab.path : location.pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`portal-bottom-nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      );
    }

    if (user.role === 'PT' || user.role === 'ADMIN') {
      const ptTabs = [
        { path: '/customers', label: 'Khách hàng', icon: Users },
        { path: '/pt/inbody', label: 'InBody', icon: Ruler },
        { path: '/pt/my-workout-plans', label: 'Giáo án', icon: BookOpen },
        { path: '/pt/assistant', label: 'Trợ lý AI', icon: Bot },
      ];
      return (
        <nav className="portal-bottom-nav" aria-label="Thanh điều hướng nhanh">
          {ptTabs.map((tab) => {
            const Icon = tab.icon;
            const active = location.pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`portal-bottom-nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`portal-bottom-nav-item ${open ? 'active' : ''}`}
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Xem thêm menu"
          >
            <Menu size={19} aria-hidden="true" />
            <span>Thêm</span>
          </button>
        </nav>
      );
    }

    // ADMIN Role
    const adminTabs = [
      { path: '/customers', label: 'Khách hàng', icon: Users },
      { path: '/transfers', label: 'Điều chuyển', icon: Users },
    ];
    return (
      <nav className="portal-bottom-nav" aria-label="Thanh điều hướng nhanh">
        {adminTabs.map((tab) => {
          const Icon = tab.icon;
          const active = location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`portal-bottom-nav-item ${active ? 'active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`portal-bottom-nav-item ${open ? 'active' : ''}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Xem thêm menu"
        >
          <Menu size={19} aria-hidden="true" />
          <span>Thêm</span>
        </button>
      </nav>
    );
  };

  return (
    <div className={`portal-shell ${isMobile ? 'has-bottom-nav' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`portal-sidebar ${open ? 'mobile-open' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <button ref={closeButtonRef} type="button" className="mobile-close" aria-label="Đóng menu" onClick={() => { setOpen(false); menuButtonRef.current?.focus(); }}>
          <X aria-hidden="true" />
        </button>

        <div className="portal-sidebar-top">
          <button
            type="button"
            className="portal-collapse-toggle"
            aria-label={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-pressed={isCollapsed}
            aria-controls="portal-navigation"
            onClick={() => setCollapsed((value) => !value)}
          >
            <GymSidebarToggleIcon collapsed={isCollapsed} />
          </button>
          <GymSidebarSearch items={items} onNavigate={() => setOpen(false)} />
        </div>

        <nav id="portal-navigation" aria-label="Điều hướng portal" className="portal-navigation">
          {sectionOrder.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);
            if (!sectionItems.length) return null;
            return (
              <div className="portal-nav-section" key={section} aria-label={section}>
                {sectionItems.map((item) => {
                  const active = current?.path === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'active' : undefined}
                      title={isCollapsed ? item.label : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <GymSidebarIcon name={item.icon} />
                      {!isCollapsed && <span className="gym-nav-label">{item.label}</span>}
                      {!isCollapsed && active && <span className="gym-nav-active-dot" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="portal-sidebar-footer">
          <div className="portal-logout-wrap">
            <Link
              to="/account"
              aria-current={location.pathname === '/account' ? 'page' : undefined}
              className={`portal-logout-btn${location.pathname === '/account' ? ' active' : ''}`}
              aria-label="Tài khoản của tôi"
              title={isCollapsed ? 'Tài khoản của tôi' : undefined}
              onClick={() => setOpen(false)}
            >
              <UserRound size={20} aria-hidden="true" />
              {!isCollapsed && <span>Tài khoản của tôi</span>}
            </Link>
          </div>
        </div>
      </aside>

      {open && <button type="button" className="sidebar-overlay" aria-label="Đóng menu" onClick={() => { setOpen(false); menuButtonRef.current?.focus(); }} />}

      <div className="portal-main">
        {isMobile && (
          <header className="portal-header">
            <button ref={menuButtonRef} className="mobile-menu" type="button" aria-controls="portal-navigation" aria-expanded={open} onClick={() => setOpen(true)}>
              <Menu aria-hidden="true" /> Menu
            </button>
          </header>
        )}

        <main className="portal-content" aria-label={current?.label || 'Quản lý phòng Gym'}>
          {creditError && (
            <div role="alert" className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center">
              <div>
                <strong className="block text-sm">Không đủ credit</strong>
                <span className="text-sm">{creditError}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href="/vi-nap-tien" target="_top" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                  Nạp Credit trong ERP
                </a>
                <button type="button" aria-label="Đóng cảnh báo credit" onClick={() => setCreditError('')} className="rounded-lg p-2 text-amber-800 hover:bg-amber-100">
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
          {children}
        </main>

        {/* Bottom Navigation Bar for Native-like Mobile UX */}
        {isMobile && renderMobileBottomNav()}
      </div>
    </div>
  );
}
