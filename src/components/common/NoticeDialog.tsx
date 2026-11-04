import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

type NoticeDialogProps = {
  message: string | null;
  onClose: () => void;
};

export function NoticeDialog({ message, onClose }: NoticeDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!message) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [message, onClose]);

  if (!message) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="notice-dialog-title" aria-describedby="notice-dialog-message" className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" />
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container" aria-hidden="true"><Info className="size-4" /></span>
            <h2 id="notice-dialog-title" className="text-sm font-medium text-on-surface text-balance">Thông báo</h2>
          </div>
          <button ref={closeRef} type="button" aria-label="Đóng thông báo" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" data-erp-modal-close>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p id="notice-dialog-message" className="mt-4 whitespace-pre-line text-sm font-normal leading-6 text-on-surface-variant text-pretty">{message}</p>
      </div>
    </div>,
    document.body,
  );
}
