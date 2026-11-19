import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function ProgressModal({
  open,
  title,
  description,
  loading,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  loading?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop profile-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="profile-form-modal modal-xl max-h-[94dvh] sm:max-h-[88vh] flex flex-col shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header dùng class chuẩn profile-form-header từ index.css */}
        <header className="profile-form-header shrink-0">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            ref={closeButton}
            type="button"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        {/* Body dùng class chuẩn profile-form-body từ index.css kết hợp flex-1 min-h-0 */}
        <div className="profile-form-body flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-64 p-8 text-center text-slate-500" role="status">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-sky-600 border-t-transparent mb-3" />
              <p className="text-xs font-bold text-slate-700">Đang tải dữ liệu tiến độ...</p>
              <p className="text-[11px] text-slate-400 mt-1">Vui lòng chờ trong giây lát</p>
            </div>
          ) : (
            children
          )}
        </div>
      </section>
    </div>
  );
}
