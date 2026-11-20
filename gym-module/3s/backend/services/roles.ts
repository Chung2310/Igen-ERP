import type { UserRole } from '../models/User.js';

export function isAdminRole(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function hasRequiredRole(actual: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(actual) || (actual === 'SUPER_ADMIN' && allowed.includes('ADMIN'));
}
