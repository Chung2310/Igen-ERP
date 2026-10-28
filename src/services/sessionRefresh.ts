import { withRequestTimeout } from '../utils/requestTimeout';

let pending: Promise<string | null> | null = null;
let pendingToken: string | null = null;
let lastRefresh: { previous: string; token: string } | null = null;
export function wasTokenRefreshed(previous: string | null, token: string) {
  return lastRefresh?.previous === previous && lastRefresh.token === token;
}

/** Share one bounded refresh across the interceptor and older API clients. */
export function refreshAccessToken(fetcher: typeof fetch = window.fetch): Promise<string | null> {
  const previous = localStorage.getItem('accessToken');
  if (pending && pendingToken === previous) return pending;
  if (!previous) return Promise.resolve(null);
  pendingToken = previous;
  const request = withRequestTimeout(async (signal) => {
    const response = await fetcher('/api/v1/auth/refresh-token', { method: 'POST', signal });
    if (signal.aborted || localStorage.getItem('accessToken') !== previous) throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử lại.');
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('accessToken');
      window.dispatchEvent(new Event('unauthorized'));
      return null;
    }
    if (!response.ok) throw new Error('Không thể làm mới phiên đăng nhập. Hãy thử lại.');
    const body = await response.json() as { accessToken?: string; data?: { accessToken?: string } };
    if (signal.aborted || localStorage.getItem('accessToken') !== previous) throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử lại.');
    const token = body.accessToken || body.data?.accessToken;
    if (!token) throw new Error('Máy chủ chưa trả về phiên đăng nhập hợp lệ. Hãy thử lại.');
    localStorage.setItem('accessToken', token);
    lastRefresh = { previous, token };
    return token;
  }, 10000, 'Làm mới phiên đăng nhập quá lâu. Kiểm tra kết nối và thử lại.')
    .finally(() => { if (pending === request) { pending = null; pendingToken = null; } });
  pending = request;
  return request;
}
