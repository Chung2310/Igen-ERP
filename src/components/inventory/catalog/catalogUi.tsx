import React, { useEffect, useId, useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { toast } from "../../../pages/Toast";
import { productCatalogService } from "../../../services/productCatalogService";

export function ImageUploadBox({
  value,
  onChange,
  className = "",
}: {
  value?: string;
  onChange: (url: string) => void;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await productCatalogService.uploadMedia(file);
      onChange(url);
    } catch (err) {
      toast.error("Lỗi khi tải ảnh lên.");
    } finally {
      setUploading(false);
    }
  };

  const isSmall = className.includes("w-10") || className.includes("w-12") || className.includes("h-10") || className.includes("h-12");

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:bg-slate-100 hover:border-cyan-400 group ${className}`}
    >
      {value ? (
        <img src={value} alt="Uploaded" className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-cyan-600 p-1">
          <ImageIcon className={`opacity-70 ${isSmall ? "h-5 w-5" : "h-6 w-6 mb-1"}`} />
          {!isSmall && <span className="text-[10px] font-medium text-center leading-tight">Thêm ảnh</span>}
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
        </div>
      )}
      <input type="file" accept="image/*" aria-label="Chọn ảnh" onChange={handleFile} className="absolute inset-0 cursor-pointer opacity-0" />
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  className = "",
  placeholder = "",
}: {
  value: number | string;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (value === 0 || !value) {
      setInputValue("");
    } else {
      setInputValue(new Intl.NumberFormat("vi-VN").format(Number(value)));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setInputValue("");
      onChange(0);
      return;
    }
    const num = parseInt(rawValue, 10);
    setInputValue(new Intl.NumberFormat("vi-VN").format(num));
    onChange(num);
  };

  return <input type="text" value={inputValue} onChange={handleChange} className={className} placeholder={placeholder} />;
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  stacked = false,
  closeDisabled = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  stacked?: boolean;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const disabledRef = useRef(closeDisabled);
  closeRef.current = onClose;
  disabledRef.current = closeDisabled;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.querySelector<HTMLElement>("[data-erp-modal-close]")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) !== dialog) return;
      if (event.key === "Escape" && !disabledRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, a[href], [tabindex="0"]',
      )).filter(item => item.getClientRects().length > 0);
      const first = focusable.at(0);
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className={`fixed inset-0 ${stacked || title.includes("SKU") ? "z-[60]" : "z-50"} flex items-center justify-center bg-slate-950/40 p-4`}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`max-h-[92dvh] w-full overflow-y-auto rounded-lg bg-surface-container-lowest text-on-surface shadow-xl ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-5 py-4">
          <h3 id={titleId} className="text-base font-semibold text-on-surface">{title}</h3>
          <button type="button" onClick={onClose} disabled={closeDisabled} className="inline-flex size-8 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" title="Đóng" aria-label="Đóng" data-erp-modal-close>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

export function ModalActions({ onClose, submitting, label }: { onClose: () => void; submitting: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
      <button type="button" disabled={submitting} onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        Hủy
      </button>
      <button type="submit" disabled={submitting} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60 shadow-sm transition-colors">
        {submitting ? "Đang lưu..." : label}
      </button>
    </div>
  );
}
