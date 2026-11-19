import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook phát hiện thiết bị màn hình nhỏ / Mobile (mặc định breakpoint < 768px).
 * Tự động cập nhật theo kích thước viewport và sự kiện resize/matchMedia.
 *
 * @param breakpoint Ngưỡng chiều rộng màn hình (px) để coi là mobile, mặc định 768px.
 * @returns boolean - true nếu màn hình nhỏ hơn breakpoint, ngược lại false.
 */
export function useMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateMobileState = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Kiểm tra và cập nhật trạng thái ban đầu
    updateMobileState();

    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      if (mql.addEventListener) {
        mql.addEventListener('change', updateMobileState);
      } else if ('addListener' in mql) {
        (mql as { addListener: (cb: () => void) => void }).addListener(updateMobileState);
      }
    }

    window.addEventListener('resize', updateMobileState);

    return () => {
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', updateMobileState);
        } else if ('removeListener' in mql) {
          (mql as { removeListener: (cb: () => void) => void }).removeListener(updateMobileState);
        }
      }
      window.removeEventListener('resize', updateMobileState);
    };
  }, [breakpoint]);

  return isMobile;
}

export const useIsMobile = useMobile;
export default useMobile;
