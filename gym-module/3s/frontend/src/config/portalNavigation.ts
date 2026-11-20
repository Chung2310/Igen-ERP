import type { GymSidebarIconName } from '../components/GymSidebarIcon';
import type { User, UserRole } from '../types';
import { hasRequiredRole } from '../services/roles';

export type NavigationSection = 'Tổng quan' | 'Vận hành' | 'Trợ lý AI' | 'Tài khoản';
export interface NavigationItem {
  path: string;
  label: string;
  section: NavigationSection;
  icon: GymSidebarIconName;
  roles: UserRole[];
  matchChildren?: boolean;
}

// Tạm ẩn dashboard cho đến khi giao diện tổng quan sẵn sàng.
export const GYM_DASHBOARD_VISIBLE = false;

export const portalNavigation: NavigationItem[] = [
  { path: '/customers', label: 'Khách hàng', section: 'Vận hành', icon: 'customers', roles: ['ADMIN', 'PT'], matchChildren: true },
  { path: '/pt/dashboard', label: 'Dashboard PT', section: 'Tổng quan', icon: 'dashboard', roles: ['PT'] },
  { path: '/pt/inbody', label: 'InBody', section: 'Vận hành', icon: 'body', roles: ['ADMIN', 'PT'], matchChildren: true },
  { path: '/pt/nutrition', label: 'Dinh dưỡng', section: 'Vận hành', icon: 'nutrition', roles: ['ADMIN', 'PT'], matchChildren: true },
  { path: '/pt/roadmaps', label: 'Lộ trình', section: 'Vận hành', icon: 'roadmap', roles: ['ADMIN', 'PT'], matchChildren: true },
  { path: '/pt/my-workout-plans', label: 'Giáo án', section: 'Vận hành', icon: 'workout', roles: ['ADMIN', 'PT'], matchChildren: true },
  { path: '/pt/progress', label: 'Tiến độ', section: 'Vận hành', icon: 'progress', roles: ['ADMIN', 'PT'], matchChildren: true },
  { path: '/pt/assistant', label: 'Trợ lý AI', section: 'Trợ lý AI', icon: 'assistant', roles: ['ADMIN', 'PT'], matchChildren: true },
  { path: '/management/trainers', label: 'Đội ngũ PT', section: 'Vận hành', icon: 'trainers', roles: ['ADMIN'] },
  { path: '/management/packages', label: 'Gói mẫu', section: 'Vận hành', icon: 'packages', roles: ['ADMIN'] },
  { path: '/transfers', label: 'Điều chuyển', section: 'Vận hành', icon: 'transfer', roles: ['ADMIN'], matchChildren: true },
  { path: '/knowledge', label: 'Kho tư liệu', section: 'Vận hành', icon: 'knowledge', roles: ['ADMIN'], matchChildren: true },
  { path: '/admin/admin-accounts', label: 'Tài khoản', section: 'Vận hành', icon: 'admin', roles: ['SUPER_ADMIN'], matchChildren: true },

  { path: '/me', label: 'Hành trình', section: 'Tổng quan', icon: 'me', roles: ['CUSTOMER'] },
  { path: '/me/workouts', label: 'Giáo án', section: 'Vận hành', icon: 'workout', roles: ['CUSTOMER'] },
  { path: '/me/nutrition', label: 'Dinh dưỡng', section: 'Vận hành', icon: 'nutrition', roles: ['CUSTOMER'] },
  { path: '/me/roadmap', label: 'Lộ trình', section: 'Vận hành', icon: 'roadmap', roles: ['CUSTOMER'] },
  { path: '/me/inbody', label: 'Chỉ số', section: 'Vận hành', icon: 'body', roles: ['CUSTOMER'] },
  { path: '/me/sessions', label: 'Lịch tập', section: 'Vận hành', icon: 'sessions', roles: ['CUSTOMER'] },
  { path: '/me/progress', label: 'Tiến độ', section: 'Vận hành', icon: 'progress', roles: ['CUSTOMER'] },
  { path: '/me/assistant', label: 'Trợ lý AI', section: 'Trợ lý AI', icon: 'assistant', roles: ['CUSTOMER'], matchChildren: true },
];

export function visibleNavigation(user: User): NavigationItem[] {
  return portalNavigation.filter((item) =>
    (GYM_DASHBOARD_VISIBLE || item.path !== '/pt/dashboard') &&
    hasRequiredRole(user.role, item.roles)
  );
}

export function itemMatchesPath(item: NavigationItem, pathname: string): boolean {
  return pathname === item.path || Boolean(item.matchChildren && pathname.startsWith(`${item.path}/`));
}

export function navigationForPath(pathname: string, user: User): NavigationItem | undefined {
  return visibleNavigation(user)
    .filter((item) => itemMatchesPath(item, pathname))
    .sort((a, b) => b.path.length - a.path.length)[0];
}
