import { useEffect, useRef, type ReactNode } from 'react';
import { ToastContainer } from '../../../../../pages/Toast';
import { cn } from '../../../../student-management/lib/utils';

type MarketingDialogProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
};

let scrollLockCount = 0;
let previousBodyOverflow = '';

/** Native modal nesting keeps focus, Escape and toasts in the active top layer. */
export function MarketingDialog({ open, onClose, labelledBy, children, className }: MarketingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    let disposed = false;
    let previousFocus: HTMLElement | null = null;
    if (scrollLockCount++ === 0) previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const show = (attempt = 0) => {
      if (disposed || !dialog.isConnected) return;
      const parent = dialog.parentElement?.closest<HTMLDialogElement>('dialog[data-marketing-dialog]');
      // Child effects run before parent effects. Open the parent first when both
      // levels mount together, otherwise the parent would cover its own child.
      if (parent && !parent.open) {
        if (attempt < 3) queueMicrotask(() => show(attempt + 1));
        return;
      }
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.open) dialog.showModal();
    };
    queueMicrotask(() => show());

    return () => {
      disposed = true;
      if (dialog.open) dialog.close();
      if (--scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
      queueMicrotask(() => {
        if (!previousFocus?.isConnected) return;
        const activeModal = document.activeElement?.closest('dialog:modal')
          || Array.from(document.querySelectorAll('dialog:modal')).at(-1);
        const previousModal = previousFocus.closest('dialog:modal');
        if (activeModal ? previousModal === activeModal : !document.querySelector('dialog:modal')) previousFocus.focus();
      });
    };
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      data-marketing-dialog="true"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      className={cn('marketing-workspace fixed inset-0 m-0 size-full max-h-none max-w-none bg-transparent p-4 text-slate-800 backdrop:bg-slate-900/60 open:flex open:items-center open:justify-center', className)}
    >
      {children}
      <ToastContainer dialogRef={dialogRef} />
    </dialog>
  );
}
