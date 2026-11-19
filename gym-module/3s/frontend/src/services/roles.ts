import type { UserRole } from '../types';

interface AccountIdentity {
  id?: string;
  _id?: string;
  role?: UserRole;
}

function identityId(account: AccountIdentity): string | undefined {
  return account._id || account.id;
}

export function isAdminRole(role?: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function hasRequiredRole(actual: UserRole, allowed: UserRole[]): boolean {
  return allowed.includes(actual) || (actual === 'SUPER_ADMIN' && allowed.includes('ADMIN'));
}

export function creatableRoles(actorRole: UserRole): UserRole[] {
  return actorRole === 'SUPER_ADMIN' ? ['ADMIN', 'PT', 'CUSTOMER'] : ['PT', 'CUSTOMER'];
}

export function canEditAccount(actor: AccountIdentity, target: AccountIdentity): boolean {
  if (!isAdminRole(actor.role) || !target.role) return false;
  if (target.role === 'SUPER_ADMIN') {
    return actor.role === 'SUPER_ADMIN' && identityId(actor) === identityId(target);
  }
  if (target.role === 'ADMIN') return actor.role === 'SUPER_ADMIN';
  return target.role === 'PT' || target.role === 'CUSTOMER';
}

export function canDeleteAccount(actor: AccountIdentity, target: AccountIdentity): boolean {
  if (!isAdminRole(actor.role) || !target.role || target.role === 'SUPER_ADMIN') return false;
  if (target.role === 'ADMIN') return actor.role === 'SUPER_ADMIN';
  return target.role === 'PT' || target.role === 'CUSTOMER';
}
