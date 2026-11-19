import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { FeatureKey, User, UserRole } from '../types';
import { useFeatures } from '../services/features';
import { hasRequiredRole } from '../services/roles';

interface FeatureRouteProps {
  children: ReactNode;
  user: User;
  roles: UserRole[];
  feature?: FeatureKey;
}

function FeatureAccess({ children, feature }: Pick<FeatureRouteProps, 'children' | 'feature'>) {
  const { isEnabled } = useFeatures();
  if (feature && !isEnabled(feature)) {
    return <section className="panel"><h1>Tính năng chưa khả dụng</h1><p>Tính năng này đang bị tắt hoặc tài khoản chưa được cấp quyền.</p></section>;
  }
  return children;
}

export default function FeatureRoute({ children, user, roles, feature }: FeatureRouteProps) {
  if (!hasRequiredRole(user.role, roles)) return <Navigate to="/portal" replace />;
  if (!feature) return children;
  return <FeatureAccess feature={feature}>{children}</FeatureAccess>;
}
