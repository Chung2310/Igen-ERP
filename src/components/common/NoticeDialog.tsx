import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="notice-dialog-title" aria-describedby="notice-dialog-message" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="notice-dialog-title" className="text-sm font-medium text-slate-900">Thông báo</h2>
          <button ref={closeRef} type="button" aria-label="Đóng thông báo" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p id="notice-dialog-message" className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm font-normal leading-6 text-slate-700">{message}</p>
      </div>
    </div>,
    document.body,
  );
}
