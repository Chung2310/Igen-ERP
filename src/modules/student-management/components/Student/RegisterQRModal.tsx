import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Loader2, QrCode, X } from "lucide-react";
import { toast } from "../../../../pages/Toast";

interface RegisterQRModalProps {
  isOpen: boolean;
  /** uid của người đang đăng nhập — học viên đăng ký qua link sẽ được gán về người này. */
  teacherId: string;
  companyCode?: string;
  branchId?: string;
  entityPreset?: string;
  onClose: () => void;
}

export function RegisterQRModal({
  isOpen,
  teacherId,
  companyCode,
  branchId,
  entityPreset,
  onClose,
}: RegisterQRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams({ teacherId });
  if (entityPreset && entityPreset !== "student") params.set("entityPreset", entityPreset);
  if (companyCode && companyCode !== "all") params.set("registrationCompanyCode", companyCode);
  if (branchId) params.set("registrationBranchId", branchId);

  const registerUrl = `${window.location.origin}/public/dang-ky?${params.toString()}`;

  useEffect(() => {
    if (!isOpen || !teacherId) return;
    let cancelled = false;
    QRCode.toDataURL(registerUrl, { width: 320, margin: 1 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => toast.error("Không tạo được mã QR."));
    return () => { cancelled = true; };
  }, [isOpen, teacherId, registerUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registerUrl);
      setCopied(true);
      toast.success("Đã sao chép link đăng ký.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Trình duyệt chặn sao chép, vui lòng copy thủ công.");
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = "qr-dang-ky-hoc-vien.png";
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-sky-100 bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-start justify-between gap-3 border-b border-sky-100 pb-4">
          <div className="border-l-4 border-brand-primary pl-3">
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
              <QrCode className="h-4 w-4" /> QR đăng ký học viên
            </h2>
            <p className="mt-1 text-xs font-normal text-slate-500">
              Học viên quét mã để tự điền hồ sơ, bản ghi về thẳng danh sách của bạn.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center rounded-xl border border-sky-100 bg-brand-primary/5 p-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR đăng ký học viên" className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-sky-100 bg-slate-50 px-3 py-2">
          <p className="break-all text-[10px] font-medium leading-relaxed text-slate-500">{registerUrl}</p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:bg-brand-primary/90"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Đã sao chép" : "Sao chép link"}
          </button>
          <button
            onClick={handleDownload}
            disabled={!qrDataUrl}
            className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs font-normal text-slate-700 hover:bg-brand-primary/5 disabled:opacity-50"
          >
            Tải QR
          </button>
        </div>
      </div>
    </div>
  );
}
