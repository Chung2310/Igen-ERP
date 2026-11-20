import React, { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, Info, XCircle, X, Wallet } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
  details?: string[];
}

const TOAST_EVENT = "igen-toast-trigger";
const MAX_VISIBLE_TOASTS = 5;

export interface ToastOptions {
  duration?: number;
  title?: string;
  details?: string[];
}

export interface ValidationIssue {
  field: string;
  label: string;
  message: string;
  element?: HTMLElement | null;
}

type ToastInput = number | ToastOptions;

const optionsOf = (input: ToastInput | undefined, fallbackDuration: number): ToastOptions =>
  typeof input === "number" ? { duration: input } : { ...input, duration: input?.duration ?? fallbackDuration };

const dispatchToast = (message: string, type: ToastType, input: ToastInput | undefined, fallbackDuration: number) => {
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: { message, type, ...optionsOf(input, fallbackDuration) },
    }),
  );
};

const findValidationElement = (issue: ValidationIssue): HTMLElement | null => {
  if (issue.element) return issue.element;
  const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(issue.field) : issue.field.replace(/["\\]/g, "\\$&");
  return document.querySelector<HTMLElement>(`[name="${escaped}"], #${escaped}, [data-field="${escaped}"]`);
};

const nativeValidationLabel = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  if (element.labels?.[0]?.textContent?.trim()) return element.labels[0].textContent.replace(/\s*\*\s*$/, "").trim();
  return element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.name || "Trường dữ liệu";
};

const nativeValidationMessage = (element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
  if (element.validity.valueMissing) return "Không được để trống.";
  if (element.validity.typeMismatch) return "Không đúng định dạng yêu cầu.";
  if (element.validity.tooShort) return `Phải có ít nhất ${element.getAttribute("minlength")} ký tự.`;
  if (element.validity.tooLong) return `Không được vượt quá ${element.getAttribute("maxlength")} ký tự.`;
  if (element.validity.rangeUnderflow) return `Giá trị nhỏ nhất là ${element.getAttribute("min")}.`;
  if (element.validity.rangeOverflow) return `Giá trị lớn nhất là ${element.getAttribute("max")}.`;
  if (element.validity.patternMismatch) return "Không đúng định dạng yêu cầu.";
  return "Dữ liệu chưa hợp lệ.";
};

/**
 * Trình phát sự kiện Toast thông minh sử dụng CustomEvent
 */
export const toast = {
  success: (message: string, input?: ToastInput) => dispatchToast(message, "success", input, 4000),
  error: (message: string, input?: ToastInput) => dispatchToast(message, "error", input, 5000),
  warning: (message: string, input?: ToastInput) => dispatchToast(message, "warning", input, 4000),
  info: (message: string, input?: ToastInput) => dispatchToast(message, "info", input, 4000),
  validation: (issues: ValidationIssue[], input?: Omit<ToastOptions, "details">) => {
    const validIssues = issues.filter((issue) => issue.message.trim());
    if (validIssues.length === 0) return false;

    dispatchToast(
      "Vui lòng kiểm tra và sửa các trường được liệt kê.",
      "error",
      {
        ...input,
        title: input?.title ?? "Dữ liệu chưa hợp lệ",
        details: validIssues.map((issue) => `${issue.label}: ${issue.message}`),
        duration: input?.duration ?? 7000,
      },
      7000,
    );

    queueMicrotask(() => {
      const element = findValidationElement(validIssues[0]);
      element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      element?.focus?.({ preventScroll: true });
    });
    return true;
  },
};

/**
 * Hộp chứa Toast hiển thị ở góc màn hình
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let pending: ValidationIssue[] = [];
    let scheduled = false;
    const handleInvalid = (event: Event) => {
      const element = event.target;
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      pending.push({
        field: element.name || element.id,
        label: nativeValidationLabel(element),
        message: nativeValidationMessage(element),
        element,
      });
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        const issues = pending;
        pending = [];
        scheduled = false;
        toast.validation(issues);
      });
    };
    document.addEventListener("invalid", handleInvalid, true);
    return () => document.removeEventListener("invalid", handleInvalid, true);
  }, []);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<ToastItem, "id">>;
      const { message, type, duration = 4000, title, details } = customEvent.detail;

      const newId = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      setToasts((prev) => {
        if (
          message.includes("Phân hệ chưa được kích hoạt") &&
          localStorage.getItem("hide_module_disabled_toast") === "true"
        ) {
          return prev;
        }

        // Prevent identical messages from appearing multiple times concurrently
        const isDuplicate = prev.some(
          (t) => t.message === message && t.title === title && JSON.stringify(t.details) === JSON.stringify(details),
        );
        if (isDuplicate) return prev;

        const newToast: ToastItem = {
          id: newId,
          message,
          type,
          duration,
          title,
          details,
        };

        // Tự động đóng sau khoảng thời gian duration
        setTimeout(() => {
          removeToast(newId);
        }, duration);

        return [...prev, newToast].slice(-MAX_VISIBLE_TOASTS);
      });
    };

    window.addEventListener(TOAST_EVENT, handleToastEvent);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToastEvent);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div aria-live="assertive" aria-relevant="additions" className="fixed top-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-[10000] flex flex-col gap-3 max-w-[90vw] md:max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        let bgColor = "bg-white";
        let borderColor = "border-slate-200";
        let textColor = "text-slate-800";
        let icon = <Info className="h-5 w-5 text-blue-500 shrink-0" />;

        switch (t.type) {
          case "success":
            bgColor = "bg-emerald-50/95";
            borderColor = "border-emerald-200";
            textColor = "text-emerald-900";
            icon = <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />;
            break;
          case "error":
            if (t.message.includes("Số dư ví không đủ")) {
              bgColor = "bg-amber-50/98";
              borderColor = "border-amber-300";
              textColor = "text-amber-950";
              icon = <AlertTriangle className="h-5.5 w-5.5 text-amber-600 shrink-0 animate-bounce" />;
            } else {
              bgColor = "bg-rose-50/95";
              borderColor = "border-rose-200";
              textColor = "text-rose-900";
              icon = <XCircle className="h-5 w-5 text-rose-600 shrink-0" />;
            }
            break;
          case "warning":
            bgColor = "bg-amber-50/95";
            borderColor = "border-amber-200";
            textColor = "text-amber-900";
            icon = <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />;
            break;
          case "info":
            bgColor = "bg-sky-50/95";
            borderColor = "border-sky-200";
            textColor = "text-sky-900";
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
            <div className="flex-1 text-xs font-semibold leading-relaxed font-sans select-none min-w-0">
              {t.title && <p className="mb-1 text-sm font-extrabold leading-snug">{t.title}</p>}
              <p className="font-medium">{t.message}</p>
              {t.details && t.details.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4 font-medium">
                  {t.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              )}
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
              onClick={() => removeToast(t.id)}
              aria-label="Đóng thông báo"
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
