import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useIsMobile } from "../../../hooks/useMediaQuery";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "md:max-w-sm",
  md: "md:max-w-md",
  lg: "md:max-w-lg",
  xl: "md:max-w-xl",
  "2xl": "md:max-w-2xl",
  "3xl": "md:max-w-3xl",
  "4xl": "md:max-w-4xl",
  "5xl": "md:max-w-5xl",
};

interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Hàng nút ở chân modal. Trên mobile được ghim lại, không cuộn theo nội dung. */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Ẩn nút X ở góc (khi muốn buộc người dùng chọn một hành động ở footer). */
  hideCloseButton?: boolean;
  children: React.ReactNode;
}

/**
 * Dialog hai chế độ: modal căn giữa trên desktop, bottom sheet trên mobile.
 *
 * Dùng `dvh` thay cho `vh` để chiều cao không nhảy khi thanh địa chỉ của
 * trình duyệt di động ẩn/hiện.
 */
export function ResponsiveModal({
  open,
  onClose,
  title,
  footer,
  size = "lg",
  hideCloseButton = false,
  children,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  // Khoá cuộn nền và cho phép đóng bằng phím Esc khi modal đang mở.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/50 ${isMobile ? "items-end" : "items-center justify-center p-4"}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className={`flex w-full flex-col bg-surface-container-lowest shadow-xl ${
          isMobile ? "max-h-[90dvh] rounded-t-2xl" : `max-h-[85dvh] rounded-2xl ${SIZE_CLASS[size]}`
        }`}
      >
        {/* Tay nắm kéo — tín hiệu trực quan quen thuộc của bottom sheet. */}
        {isMobile && <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-outline-variant" />}

        {(title || !hideCloseButton) && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
            <h2 className="min-w-0 truncate text-base font-semibold text-on-surface">{title}</h2>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="safe-bottom flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-outline-variant px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResponsiveModal;
