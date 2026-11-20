import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { User, UserRole } from '../types';
import { hasRequiredRole } from '../services/roles';

interface FeatureRouteProps {
  children: ReactNode;
  user: User;
  roles: UserRole[];
}

export default function FeatureRoute({ children, user, roles }: FeatureRouteProps) {
  if (!hasRequiredRole(user.role, roles)) return <Navigate to="/portal" replace />;
  return children;
}
