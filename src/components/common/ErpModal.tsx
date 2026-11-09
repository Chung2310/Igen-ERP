import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";

export function ErpModal({
  isOpen = true,
  title,
  titleClassName,
  onClose,
  children,
  maxWidth = "max-w-md",
  zIndex = "z-50",
  className,
  native = false,
  closeDisabled = false,
}: {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  titleClassName?: string;
  children: ReactNode;
  maxWidth?: string;
  zIndex?: string;
  className?: string;
  native?: boolean;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !native || !dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    titleRef.current?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
    };
  }, [isOpen, native]);

  if (!isOpen) return null;
  const content = <div className={cn(
    "relative max-h-[90vh] w-full space-y-3.5 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-lowest p-4 text-on-surface shadow-lg sm:p-5",
    native && "max-h-[calc(100dvh-1.5rem)] overscroll-contain sm:max-h-[90dvh]",
    maxWidth,
    className,
  )}>
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 shrink-0 rounded-full bg-[#00ADFC]" aria-hidden="true" />
        <h3 id={native ? titleId : undefined} ref={titleRef} tabIndex={native ? -1 : undefined}
          className={cn("text-balance text-sm font-semibold normal-case text-on-surface sm:text-base", titleClassName)}>{title}</h3>
      </div>
      <button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Đóng" title="Đóng" data-erp-modal-close
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-rose-500 text-white shadow-xs hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-primary">
        <X className="size-4 stroke-[2.5]" aria-hidden="true" />
      </button>
    </div>
    {children}
  </div>;

  if (native) {
    return <dialog ref={dialogRef} aria-labelledby={titleId} closedby={closeDisabled ? "none" : "closerequest"}
      onKeyDown={event => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        if (!closeDisabled) onClose();
      }}
      onCancel={event => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        if (!closeDisabled) onClose();
      }}
      onClick={event => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none items-center justify-center border-0 bg-transparent p-3 backdrop:bg-slate-950/60 open:flex sm:p-4">
      {content}
    </dialog>;
  }

  return <div className={cn("fixed inset-0 flex items-center justify-center p-3 sm:p-4", zIndex)}>
    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={closeDisabled ? undefined : onClose} />
    {content}
  </div>;
}
