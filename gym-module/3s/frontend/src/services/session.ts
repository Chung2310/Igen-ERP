import type { Session, User, UserRole } from '../types';

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { username?: unknown; role?: unknown };
  return typeof candidate.username === 'string' && ['SUPER_ADMIN', 'ADMIN', 'PT', 'CUSTOMER'].includes(candidate.role as UserRole);
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function saveSession({ token, user }: Session): void {
  localStorage.setItem('gym:token', token);
  localStorage.setItem('gym:user', JSON.stringify(user));
}

export function getSession(): Session | null {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('gym:token');
  const storedUser = localStorage.getItem('gym:user');

  if (!token || !storedUser) return null;

  try {
    const user: unknown = JSON.parse(storedUser);
    return isUser(user) ? { token, user } : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem('gym:token');
  localStorage.removeItem('gym:user');
  deleteCookie('gym:token');
  deleteCookie('gym:user');
}

export function destinationForRole(): string {
  return '/portal';
}

