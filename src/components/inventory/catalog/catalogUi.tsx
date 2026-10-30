import React, { useEffect, useState } from "react";
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
      <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 cursor-pointer opacity-0" />
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
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  stacked?: boolean;
}) {
  return (
    <div className={`fixed inset-0 ${stacked || title.includes("SKU") ? "z-[60]" : "z-50"} flex items-center justify-center bg-slate-950/40 p-4`}>
      <div role="dialog" aria-modal="true" className={`max-h-[92vh] w-full overflow-y-auto rounded-lg bg-white shadow-xl ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" title="Đóng">
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
      <span className="block text-xs font-medium text-slate-600">{label}</span>
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
