import React from "react";

interface ScrollableXProps {
  children: React.ReactNode;
  className?: string;
  /** Bật gợi ý "vuốt ngang để xem thêm" trên mobile. */
  hint?: boolean;
}

/**
 * Vùng cuộn ngang cho nội dung không thể xếp lại theo chiều dọc
 * (bảng tính Excel, sơ đồ tổ chức, biểu đồ rộng).
 *
 * `min-w-0` là bắt buộc: thiếu nó thì phần tử con flex sẽ đẩy cả layout
 * tràn ngang thay vì kích hoạt cuộn nội bộ.
 */
export function ScrollableX({ children, className = "", hint = false }: ScrollableXProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="w-full overflow-x-auto overscroll-x-contain">{children}</div>
      {hint && (
        <p className="mt-1 text-center text-[11px] text-on-surface-variant md:hidden">Vuốt ngang để xem thêm</p>
      )}
    </div>
  );
}

export default ScrollableX;
