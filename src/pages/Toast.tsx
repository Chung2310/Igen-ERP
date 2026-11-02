import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X, Wallet } from 'lucide-react';
import { getApiErrorMessage } from "../utils/errorMessage";
import { cn } from "../modules/student-management/lib/utils";

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const TOAST_EVENT = 'igen-toast-trigger';

/**
 * Trình phát sự kiện Toast thông minh sử dụng CustomEvent
 */
// eslint-disable-next-line react-refresh/only-export-components -- Keep the existing shared toast event API alongside its renderer.
export const toast = {
  success: (message: string, duration = 4000) => {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type: 'success', duration } }));
  },
  error: (message: string, duration = 5000) => {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message: getApiErrorMessage(message, "Đã xảy ra lỗi. Vui lòng thử lại."), type: 'error', duration } }));
  },
  warning: (message: string, duration = 4000) => {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type: 'warning', duration } }));
  },
  info: (message: string, duration = 4000) => {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type: 'info', duration } }));
  },
};

/**
 * Hộp chứa Toast hiển thị ở góc màn hình
 */
export function ToastContainer({ dialogRef }: { dialogRef?: React.RefObject<HTMLDialogElement | null> } = {}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pendingDialogToasts = useRef(new Map<string, ToastItem & { expiresAt: number }>());

  useEffect(() => {
    const pending = pendingDialogToasts.current;
    const scope = dialogRef?.current;
    const previousScopeMarker = scope?.getAttribute('data-dialog-toast-scope');
    scope?.setAttribute('data-dialog-toast-scope', 'true');
    const handleToastEvent = (e: Event) => {
      const focusedDialog = document.activeElement?.closest<HTMLDialogElement>('dialog:modal');
      const activeDialog = focusedDialog || Array.from(document.querySelectorAll<HTMLDialogElement>('dialog:modal')).at(-1);
      // Window is itself the event target; its older global listener may run
      // before a scoped listener. Leave marked dialogs to their own renderer.
      if (!dialogRef && activeDialog?.hasAttribute('data-dialog-toast-scope')) return;
      if (dialogRef) {
        const dialog = dialogRef.current;
        if (!dialog?.open || activeDialog !== dialog) return;
        // Route feedback into the browser's active modal layer before the
        // global listener sees it, keeping the notification visible and unique.
        e.stopImmediatePropagation();
      }
      const customEvent = e as CustomEvent<{ message: string; type: ToastType; duration?: number }>;
      const { message, type, duration = 4000 } = customEvent.detail;
      
      const newId = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      if (dialogRef) {
        if (message.includes("Phân hệ chưa được kích hoạt") && localStorage.getItem("hide_module_disabled_toast") === "true") return;
        if (Array.from(pending.values()).some((item) => item.message === message)) return;
        // Record synchronously: closing a form and emitting success may be
        // batched before this container gets another render.
        pending.set(newId, { id: newId, message, type, duration, expiresAt: Date.now() + duration });
      }

      setToasts((prev) => {
        if (message.includes("Phân hệ chưa được kích hoạt") && localStorage.getItem("hide_module_disabled_toast") === "true") {
          return prev;
        }

        // Prevent identical messages from appearing multiple times concurrently
        const isDuplicate = prev.some((t) => t.message === message);
        if (isDuplicate) return prev;

        const newToast: ToastItem = {
          id: newId,
          message,
          type,
          duration,
        };

        // Tự động đóng sau khoảng thời gian duration
        setTimeout(() => {
          pending.delete(newId);
          setToasts((current) => current.filter((item) => item.id !== newId));
        }, duration);

        return [...prev, newToast];
      });
    };

    window.addEventListener(TOAST_EVENT, handleToastEvent, Boolean(dialogRef));
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToastEvent, Boolean(dialogRef));
      if (scope) {
        if (previousScopeMarker == null) scope.removeAttribute('data-dialog-toast-scope');
        else scope.setAttribute('data-dialog-toast-scope', previousScopeMarker);
      }
      if (!dialogRef || pending.size === 0) return;
      const remaining = Array.from(pending.values());
      pending.clear();
      // A closing modal hands feedback to its parent or the global renderer.
      // Preserve the original expiry rather than restarting its lifetime.
      queueMicrotask(() => {
        remaining.forEach(({ message, type, expiresAt }) => {
          const duration = expiresAt - Date.now();
          if (duration > 0) window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type, duration } }));
        });
      });
    };
  }, [dialogRef]);

  const removeToast = (id: string) => {
    pendingDialogToasts.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className={cn("fixed flex flex-col gap-3 pointer-events-none", dialogRef
      ? "inset-x-3 top-3 z-200 sm:inset-x-auto sm:right-6 sm:top-6 sm:w-full sm:max-w-sm"
      : "top-6 right-6 z-100 max-w-sm w-full")}>
      {toasts.map((t) => {
        let bgColor = 'bg-white';
        let borderColor = 'border-slate-200';
        let textColor = 'text-slate-800';
        let icon = <Info className="h-5 w-5 text-blue-500 shrink-0" />;

        switch (t.type) {
          case 'success':
            bgColor = 'bg-sky-50/95';
            borderColor = 'border-sky-200';
            textColor = 'text-sky-950';
            icon = <CheckCircle className="h-5 w-5 text-[#00ADFC] shrink-0" />;
            break;
          case 'error':
            if (t.message.includes("Số dư ví không đủ")) {
              bgColor = 'bg-amber-50/98';
              borderColor = 'border-amber-300';
              textColor = 'text-amber-950';
              icon = <AlertTriangle className="h-5.5 w-5.5 text-amber-600 shrink-0 animate-bounce" />;
            } else {
              bgColor = 'bg-rose-50/95';
              borderColor = 'border-rose-200';
              textColor = 'text-rose-900';
              icon = <XCircle className="h-5 w-5 text-rose-600 shrink-0" />;
            }
            break;
          case 'warning':
            bgColor = 'bg-amber-50/95';
            borderColor = 'border-amber-200';
            textColor = 'text-amber-900';
            icon = <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />;
            break;
          case 'info':
            bgColor = 'bg-sky-50/95';
            borderColor = 'border-sky-200';
            textColor = 'text-sky-900';
            icon = <Info className="h-5 w-5 text-sky-600 shrink-0" />;
            break;
        }
 
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-xl border ${borderColor} ${bgColor} ${textColor} shadow-lg backdrop-blur-md animate-slide-in pointer-events-auto transition-all duration-350`}
            role="alert"
          >
            {icon}
            <div className="flex-1 text-xs font-semibold leading-relaxed font-sans select-none">
              {t.message}
              {t.message.includes("Số dư ví không đủ") && (
                <button 
                  onClick={() => {
                    document.getElementById("sidebar_menu_VÍ_&_NẠP_TIỀN")?.click();
                  }}
                  className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-[10px] font-bold shadow-md cursor-pointer transition-all active:scale-95 pointer-events-auto font-sans"
                >
                  <Wallet className="h-3 w-3" /> Nạp tiền ngay
                </button>
              )}
              {t.message.includes("Phân hệ chưa được kích hoạt") && (
                <button 
                  onClick={() => {
                    localStorage.setItem("hide_module_disabled_toast", "true");
                    removeToast(t.id);
                  }}
                  className="mt-1.5 block text-[10px] font-normal text-rose-700 hover:text-rose-900 hover:underline cursor-pointer pointer-events-auto transition-colors font-sans"
                >
                  (không bao giờ hiển thị thông báo này nữa)
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-650 transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
