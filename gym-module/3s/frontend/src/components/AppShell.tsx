import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Bot,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Ruler,
  Salad,
  UserPen,
  Users,
  WalletCards,
  X
} from 'lucide-react';
import { clearSession } from '../services/session';
import { api, INSUFFICIENT_CREDITS_EVENT } from '../services/api';
import { navigationForPath, visibleNavigation, type NavigationSection } from '../config/portalNavigation';
import type { FeatureState, User, UserRole } from '../types';
import NotificationDropdown from './notifications/NotificationDropdown';
import { useMobile } from '../hooks/useMobile';
import { useCreditWallet } from '../contexts/CreditWalletContext';

const roleNames: Record<UserRole, string> = {
  SUPER_ADMIN: 'Quản trị cấp cao',
  ADMIN: 'Quản lý hệ thống',
  PT: 'Huấn luyện viên',
  CUSTOMER: 'Khách hàng',
};

const sectionOrder: NavigationSection[] = ['Tổng quan', 'Vận hành', 'Trợ lý AI', 'Tài khoản'];
const sidebarStorageKey = '3s-portal-sidebar-collapsed';

interface AppShellProps {
  user: User;
  children: ReactNode;
  features?: FeatureState;
}

function initialSidebarCollapsed() {
  try {
    return window.localStorage.getItem(sidebarStorageKey) === 'true';
  } catch {
    return false;
  }
}

function getInitials(fullName?: string, username?: string): string {
  const name = (fullName || username || '').trim();
  if (!name) return 'U';
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppShell({ user, children, features = {} }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialSidebarCollapsed);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const isMobile = useMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const items = visibleNavigation(user, features);
  const current = navigationForPath(location.pathname, user, features);
  const { wallet, loading: walletLoading } = useCreditWallet();

  useEffect(() => {
    setImgFailed(false);
  }, [user.avatarUrl]);

  useEffect(() => {
    let mounted = true;
    const pollUnread = () => {
      api
        .get<{ readAt: string | null }[]>('/api/notifications?page=1&limit=20')
        .then((res) => {
          if (mounted && Array.isArray(res.data)) {
            const unread = res.data.filter((n) => !n.readAt).length;
            setUnreadCount(unread);
          }
        })
        .catch(() => {
          // Silently ignore if unauthorized / unauthenticated
        });
    };
    pollUnread();
    const interval = setInterval(pollUnread, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [location.pathname]);

  useEffect(() => {
    const showCreditError = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setCreditError(detail?.message || 'Số dư credit không đủ để sử dụng tính năng AI này.');
    };
    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, showCreditError);
    return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, showCreditError);
  }, []);

  const logout = () => {
    clearSession();
    window.parent.postMessage({ type: 'gym:logout' }, window.location.origin);
  };

  const toggleSidebar = () =>
    setCollapsed((currentValue) => {
      const nextValue = !currentValue;
      try {
        window.localStorage.setItem(sidebarStorageKey, String(nextValue));
      } catch {
        // Fallback in-memory
      }
      return nextValue;
    });

  const toggleLabel = collapsed ? 'Mở rộng menu' : 'Thu gọn menu';
  const displayName = user.fullName || user.username || 'Người dùng';

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

    if (user.role === 'PT') {
      const ptTabs = [
        { path: '/pt/customers', label: 'Học viên', icon: Users },
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
      { path: '/admin', label: 'Quản trị', icon: LayoutDashboard, exact: true },
      { path: '/admin/customers', label: 'Khách hàng', icon: Users },
      { path: '/admin/transfers', label: 'Điều chuyển', icon: Users },
      { path: '/admin/users', label: 'Tài khoản', icon: Users },
    ];
    return (
      <nav className="portal-bottom-nav" aria-label="Thanh điều hướng nhanh">
        {adminTabs.map((tab) => {
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
    <div className={`portal-shell ${collapsed ? 'sidebar-collapsed' : ''} ${isMobile ? 'has-bottom-nav' : ''}`}>
      <aside className={`portal-sidebar ${open ? 'mobile-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div
          className="portal-brand"
          style={{
            padding: collapsed ? '0 0 16px' : '0 4px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              textDecoration: 'none',
              width: '100%',
            }}
            title="3S Wellness Fitness & Yoga"
          >
            <img
              src="/chuoi-gym/images/logo-white.png"
              alt="3S Wellness Logo"
              style={{
                height: collapsed ? '34px' : '52px',
                width: 'auto',
                maxWidth: collapsed ? '44px' : '180px',
                objectFit: 'contain',
                transition: 'all 0.2s ease',
              }}
            />
          </Link>
          <button type="button" className="mobile-close" aria-label="Đóng menu" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>

        <button
          type="button"
          className="portal-sidebar-toggle"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!collapsed}
          aria-controls="portal-navigation"
          onClick={toggleSidebar}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>

        <nav id="portal-navigation" aria-label="Điều hướng portal" className="portal-navigation">
          {sectionOrder.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);
            if (!sectionItems.length) return null;
            return (
              <div className="portal-nav-section" key={section} aria-label={section}>
                <span className="portal-nav-heading">{section}</span>
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  const active = current?.path === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-label={item.label}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={active ? 'active' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="portal-logout-wrap">
          <button
            type="button"
            className="portal-logout-btn"
            aria-label="Đăng xuất"
            title={collapsed ? 'Đăng xuất' : undefined}
            onClick={logout}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {open && <button className="sidebar-overlay" aria-label="Đóng menu" onClick={() => setOpen(false)} />}

      <div className="portal-main">
        <header className="portal-header">
          <button className="mobile-menu" type="button" onClick={() => setOpen(true)}>
            <Menu /> Menu
          </button>

          <nav className="portal-breadcrumb" aria-label="Điều hướng trang">
            <span>Portal</span>
            {location.pathname === '/notifications' ? (
              <>
                <ChevronRight size={15} />
                <strong>Thông báo</strong>
              </>
            ) : current ? (
              <>
                <ChevronRight size={15} />
                <span>{current.section}</span>
                <ChevronRight size={15} />
                <strong>{current.label}</strong>
              </>
            ) : null}
          </nav>

          <div className="portal-header-actions">
            <Link to="/wallet" aria-label="Ví credit" className="portal-credit-chip">
              <WalletCards size={17} aria-hidden="true" />
              <span>{walletLoading ? '… credit' : `${wallet?.availableCredits ?? 0} credit`}</span>
            </Link>
            {/* Notification Bell with Dropdown */}
            <div className="portal-notification-wrap">
              <button
                type="button"
                className={`portal-header-bell ${notificationsOpen ? 'is-active' : ''}`}
                aria-label="Thông báo"
                title={unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'}
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setNotificationsOpen((prev) => !prev)}
              >
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && <span className="bell-badge" aria-label={`${unreadCount} thông báo chưa đọc`} />}
              </button>

              {notificationsOpen && (
                <NotificationDropdown
                  onClose={() => setNotificationsOpen(false)}
                  onUnreadCountChange={(count) => setUnreadCount(count)}
                />
              )}
            </div>

            {/* User Circle Avatar with Hover Popover */}
            <div className="portal-user-wrap" tabIndex={0} role="button" aria-label={`Tài khoản: ${displayName}`}>
              <div className="portal-user-avatar" title={displayName}>
                {user.avatarUrl && !imgFailed ? (
                  <img
                    src={user.avatarUrl}
                    alt={displayName}
                    onError={() => setImgFailed(true)}
                  />
                ) : (
                  <span>{getInitials(user.fullName, user.username)}</span>
                )}
              </div>
              <div className="portal-user-popover">
                <strong>{displayName}</strong>
                <span className="portal-user-role">{roleNames[user.role]}</span>
                {user.username && user.fullName && user.fullName !== user.username && (
                  <div className="portal-user-uname">@{user.username}</div>
                )}
                {user.role === 'PT' && (
                  <Link
                    to="/pt/profile"
                    className="portal-user-edit-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px solid #f1f5f9',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#00a4e4',
                      textDecoration: 'none',
                    }}
                  >
                    <UserPen size={14} /> Chỉnh sửa hồ sơ
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="portal-content">
          {creditError && (
            <div role="alert" className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center">
              <div>
                <strong className="block text-sm">Không đủ credit</strong>
                <span className="text-sm">{creditError}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link to="/wallet" onClick={() => setCreditError('')} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                  Nạp credit
                </Link>
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

