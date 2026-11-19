import type { LucideIcon } from 'lucide-react';
import {
  ArrowRightLeft,
  BookOpen,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  Map,
  Ruler,
  Salad,
  ShieldCheck,
  User as UserIcon,
  Users,
  WalletCards,
} from 'lucide-react';
import type { FeatureKey, FeatureState, User, UserRole } from '../types';
import { hasRequiredRole } from '../services/roles';

export type NavigationSection = 'Tổng quan' | 'Vận hành' | 'Trợ lý AI' | 'Tài khoản';
export interface NavigationItem {
  path: string;
  label: string;
  section: NavigationSection;
  icon: LucideIcon;
  roles: UserRole[];
  feature?: FeatureKey;
  matchChildren?: boolean;
}

export const portalNavigation: NavigationItem[] = [
  { path: '/pt/profile', label: 'Hồ sơ cá nhân', section: 'Tài khoản', icon: UserIcon, roles: ['PT'] },
  { path: '/wallet', label: 'Ví credit', section: 'Tài khoản', icon: WalletCards, roles: ['ADMIN', 'PT', 'CUSTOMER'], matchChildren: true },
  { path: '/admin/credits', label: 'Quản trị credit', section: 'Tài khoản', icon: WalletCards, roles: ['ADMIN'], matchChildren: true },
  { path: '/admin', label: 'Quản trị & HLV PT', section: 'Vận hành', icon: LayoutDashboard, roles: ['ADMIN'] },
  { path: '/admin/customers', label: 'Tất cả khách hàng', section: 'Vận hành', icon: Users, roles: ['ADMIN'], matchChildren: true },
  { path: '/admin/transfers', label: 'Điều chuyển khách', section: 'Vận hành', icon: ArrowRightLeft, roles: ['ADMIN'], matchChildren: true },
  { path: '/admin/admin-accounts', label: 'Tài khoản Admin', section: 'Vận hành', icon: ShieldCheck, roles: ['SUPER_ADMIN'], matchChildren: true },
  { path: '/admin/users', label: 'Quản lý tài khoản', section: 'Vận hành', icon: ShieldCheck, roles: ['ADMIN'], matchChildren: true },
  { path: '/admin/knowledge', label: 'Kho tri thức & Ảnh món', section: 'Vận hành', icon: BookOpen, roles: ['ADMIN'], matchChildren: true },

  { path: '/pt/dashboard', label: 'Dashboard PT', section: 'Tổng quan', icon: LayoutDashboard, roles: ['PT'], feature: 'DASHBOARD' },
  { path: '/pt/customers', label: 'Khách hàng', section: 'Vận hành', icon: Users, roles: ['PT'], matchChildren: true },
  { path: '/pt/inbody', label: 'Chỉ số InBody', section: 'Vận hành', icon: Ruler, roles: ['PT'], feature: 'OCR_INBODY', matchChildren: true },
  { path: '/pt/nutrition', label: 'Dinh dưỡng & Thực đơn', section: 'Vận hành', icon: Salad, roles: ['PT'], feature: 'NUTRITION_AI', matchChildren: true },
  { path: '/pt/roadmaps', label: 'Roadmap', section: 'Vận hành', icon: Map, roles: ['PT'], feature: 'ROADMAP', matchChildren: true },
  { path: '/pt/my-workout-plans', label: 'Giáo án của tôi', section: 'Vận hành', icon: BookOpen, roles: ['PT'], feature: 'EXERCISE_LIBRARY', matchChildren: true },
  { path: '/pt/progress', label: 'Tiến độ', section: 'Vận hành', icon: ChartNoAxesCombined, roles: ['PT'], feature: 'PROGRESS', matchChildren: true },
  { path: '/pt/assistant', label: 'Trợ lý PT 3S', section: 'Trợ lý AI', icon: Bot, roles: ['PT'], matchChildren: true },

  { path: '/me', label: 'Hành trình của tôi', section: 'Tổng quan', icon: LayoutDashboard, roles: ['CUSTOMER'] },
  { path: '/me/workouts', label: 'Giáo án tập luyện', section: 'Vận hành', icon: BookOpen, roles: ['CUSTOMER'] },
  { path: '/me/nutrition', label: 'Kế hoạch Dinh dưỡng', section: 'Vận hành', icon: Salad, roles: ['CUSTOMER'] },
  { path: '/me/roadmap', label: 'Lộ trình phát triển', section: 'Vận hành', icon: Map, roles: ['CUSTOMER'] },
  { path: '/me/inbody', label: 'Chỉ số & Mục tiêu', section: 'Vận hành', icon: Ruler, roles: ['CUSTOMER'] },
  { path: '/me/sessions', label: 'Lịch & Buổi tập', section: 'Vận hành', icon: CalendarDays, roles: ['CUSTOMER'] },
  { path: '/me/progress', label: 'Tiến độ & Báo cáo', section: 'Vận hành', icon: ChartNoAxesCombined, roles: ['CUSTOMER'] },
  { path: '/me/assistant', label: 'Trợ lý AI 3S', section: 'Trợ lý AI', icon: Bot, roles: ['CUSTOMER'], matchChildren: true },
];

export function visibleNavigation(user: User, features: FeatureState = {}): NavigationItem[] {
  return portalNavigation.filter((item) => hasRequiredRole(user.role, item.roles) && (!item.feature || features[item.feature] === true));
}

export function itemMatchesPath(item: NavigationItem, pathname: string): boolean {
  if (item.path === '/admin') {
    return pathname === '/admin' || pathname === '/admin/';
  }
  return pathname === item.path || Boolean(item.matchChildren && pathname.startsWith(`${item.path}/`));
}

export function navigationForPath(pathname: string, user: User, features: FeatureState = {}): NavigationItem | undefined {
  return visibleNavigation(user, features)
    .filter((item) => itemMatchesPath(item, pathname))
    .sort((a, b) => b.path.length - a.path.length)[0];
}
