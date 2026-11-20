import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ProgressPhotoLightboxProps {
  open: boolean;
  imageUrl: string;
  imageAlt: string;
  onClose: () => void;
}

export default function ProgressPhotoLightbox({ open, imageUrl, imageAlt, onClose }: ProgressPhotoLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={imageAlt}
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-slate-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button
          ref={closeButtonRef}
          type="button"
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/75 text-white ring-1 ring-white/20 transition hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary motion-reduce:transition-none"
          aria-label="Đóng ảnh"
          onClick={onClose}
        >
          <X size={21} aria-hidden="true" />
        </button>
        <img className="block max-h-[85vh] max-w-[85vw] object-contain" src={imageUrl} alt={imageAlt} />
      </div>
    </div>
  );
}
