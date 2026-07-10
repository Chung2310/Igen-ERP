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
    () => false
  );
}

/** true khi màn hình dưới breakpoint md (768px) của Tailwind */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
