import { useSyncExternalStore } from "react";

/**
 * Theo dõi một media query và re-render khi kết quả thay đổi.
 * Dùng useSyncExternalStore để an toàn với React 19 concurrent rendering.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** true khi màn hình dưới breakpoint md (768px) của Tailwind */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/** true trong khoảng md → dưới lg (768px–1023px): tablet dọc */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

/** true từ breakpoint lg (1024px) trở lên */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
