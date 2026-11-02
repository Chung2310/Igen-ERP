import { refreshAccessToken, wasTokenRefreshed } from '../services/sessionRefresh';
import { withRequestTimeout } from './requestTimeout';

const originalFetch = window.fetch.bind(window);

window.fetch = async function (input, init) {
  const previousToken = localStorage.getItem('accessToken');
  const retryInput = input instanceof Request ? input.clone() : input;
  const response = await originalFetch(input, init);
  if (response.status !== 401) return response;
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/v1/')
    || /\/auth\/(refresh-token|login|register)(?:\/|$)/.test(url.pathname)
    || url.pathname.includes('/super-admin/auth/')) return response;

  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const sentToken = headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? previousToken;
  const currentToken = localStorage.getItem('accessToken');
  if (!currentToken && sentToken) {
    window.dispatchEvent(new Event('unauthorized'));
    return response;
  }
  if (sentToken && sentToken !== currentToken && (!currentToken || !wasTokenRefreshed(sentToken, currentToken))) throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử lại.');
  if (currentToken !== previousToken && (!currentToken || !wasTokenRefreshed(previousToken, currentToken))) throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử lại.');
  const token = currentToken && currentToken !== previousToken ? currentToken : await withRequestTimeout(() => refreshAccessToken(originalFetch), 12000, 'Làm mới phiên đăng nhập quá lâu. Hãy thử lại.', signal ?? undefined);
  if (!token) return response;
  if (localStorage.getItem('accessToken') !== token) throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử lại.');
  headers.set('Authorization', `Bearer ${token}`);
  const retried = await originalFetch(retryInput, { ...init, headers });
  if (retried.status === 401 && localStorage.getItem('accessToken') === token) {
    localStorage.removeItem('accessToken');
    window.dispatchEvent(new Event('unauthorized'));
  }
  return retried;
};
