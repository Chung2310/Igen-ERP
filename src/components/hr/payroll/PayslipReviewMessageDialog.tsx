import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { getApiErrorMessage } from "../../../utils/errorMessage";

type Props = {
  title: string;
  description: string;
  label: string;
  submitLabel: string;
  maxLength: number;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
};

export function PayslipReviewMessageDialog({ title, description, label, submitLabel, maxLength, onClose, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    textareaRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      trigger?.focus();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(text);
      onClose();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể gửi nội dung. Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-0 text-on-surface shadow-xl backdrop:bg-inverse-surface/55"
    >
      <form onSubmit={(event) => void submit(event)}>
        <header className="flex items-start justify-between gap-3 border-b border-outline-variant px-5 py-4">
          <div>
            <h2 id={titleId} className="text-balance text-lg font-semibold">{title}</h2>
            <p id={descriptionId} className="mt-1 text-pretty text-sm text-on-surface-variant">{description}</p>
          </div>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>
        <div className="px-5 py-4">
          <label className="block text-sm font-medium" htmlFor={`${titleId}-message`}>{label} <span className="text-on-surface-variant">(bắt buộc)</span></label>
          <textarea
            ref={textareaRef}
            id={`${titleId}-message`}
            required
            maxLength={maxLength}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={`${titleId}-count${error ? ` ${titleId}-error` : ""}`}
            className="mt-2 min-h-32 w-full resize-y rounded-xl border border-outline bg-surface-container-lowest p-3 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
          />
          <p id={`${titleId}-count`} className="mt-1 text-xs tabular-nums text-on-surface-variant">{message.length}/{maxLength} ký tự</p>
          {error && <p id={`${titleId}-error`} role="alert" className="mt-2 text-pretty text-sm text-error">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-outline-variant px-5 py-3">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded-xl border border-outline px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">Hủy</button>
          <button type="submit" disabled={busy || !message.trim()} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? "Đang gửi..." : submitLabel}</button>
        </footer>
      </form>
    </dialog>
  );
}
