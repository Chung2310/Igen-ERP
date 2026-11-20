import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, RefreshCw, X, Clock, AlertCircle, ShieldCheck } from "lucide-react";
import { walletService, type BankTransferPayment, type WalletTransactionStatus } from "../../services/walletService";

export function BankTransferCheckout({
  orderCode,
  initialPayment,
  initialCreatedAt,
  onPaid,
  onClose,
}: {
  orderCode: number;
  initialPayment?: BankTransferPayment;
  initialCreatedAt?: string | Date;
  onPaid: () => void;
  onClose: () => void;
}) {
  const [payment, setPayment] = useState(initialPayment);
  const [status, setStatus] = useState<WalletTransactionStatus["transactionStatus"]>("pending");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [retry, setRetry] = useState(0);
  const [createdAt, setCreatedAt] = useState<string | Date | undefined>(initialCreatedAt);
  const paidCallback = useRef(onPaid);
  const notified = useRef(false);
  paidCallback.current = onPaid;

  // Thời gian hết hạn: 15 phút kể từ khi tạo đơn
  const [createdTimestamp] = useState<number>(() => {
    if (initialCreatedAt) {
      const parsed = new Date(initialCreatedAt).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return Date.now();
  });

  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - createdTimestamp) / 1000);
    return Math.max(0, 15 * 60 - elapsed);
  });

  // Countdown timer 15 phút
  useEffect(() => {
    if (status !== "pending") return;

    const interval = setInterval(() => {
      const baseTime = createdAt ? new Date(createdAt).getTime() : createdTimestamp;
      const elapsed = Math.floor((Date.now() - baseTime) / 1000);
      const remaining = Math.max(0, 15 * 60 - elapsed);
      setTimeLeftSeconds(remaining);

      if (remaining <= 0) {
        setStatus("failed");
        setError("Giao dịch đã quá 15 phút mà chưa nhận được thanh toán nên đã tự động bị hủy.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, createdAt, createdTimestamp]);

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Polling trạng thái giao dịch
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      let terminal = false;
      try {
        const result = await walletService.checkTransactionStatus(orderCode);
        if (cancelled) return;
        if (result.paymentProvider !== "sepay" || !result.bankTransfer) {
          setError("Giao dịch này không hỗ trợ thanh toán QR tại đây.");
          return;
        }
        setPayment(result.bankTransfer);
        setStatus(result.transactionStatus);
        if (result.createdAt) {
          setCreatedAt(result.createdAt);
        }
        setError("");
        terminal = result.transactionStatus !== "pending";
        if (result.transactionStatus === "success" && !notified.current) {
          notified.current = true;
          paidCallback.current();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Chưa kiểm tra được giao dịch.");
      }
      if (!cancelled && !terminal) timer = setTimeout(check, 5000);
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderCode, retry]);

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(payment!.transferContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("Không thể sao chép tự động. Bạn có thể chọn nội dung chuyển khoản bên dưới để sao chép.");
    }
  };

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(payment!.qrAccountNumber);
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 3000);
    } catch {
      setError("Không thể sao chép số tài khoản.");
    }
  };

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const formattedCountdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="region"
        aria-label="Thanh toán chuyển khoản"
        className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Popup */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-blue-50/70 via-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Nạp tiền bằng chuyển khoản · #{orderCode}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Quét mã VietQR hoặc chuyển khoản theo thông tin bên dưới
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Thanh đếm ngược 15 phút nếu đang chờ thanh toán */}
          {status === "pending" && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 px-4 py-2.5 text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Thời gian giữ giao dịch còn lại:</span>
              </div>
              <span className="font-mono text-sm font-bold text-amber-800 bg-white px-2.5 py-0.5 rounded-lg border border-amber-200/70 shadow-2xs">
                {formattedCountdown}
              </span>
            </div>
          )}

          {/* Trạng thái giao dịch */}
          {status === "success" ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p role="status" className="flex items-center justify-center gap-2 text-base font-bold text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" /> Đã nhận tiền và cộng Credit vào ví.
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  Số dư ví của bạn đã được cập nhật thành công.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          ) : status === "failed" ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50/80 p-5 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <p role="status" className="text-sm font-bold text-rose-700">
                Giao dịch không còn chờ thanh toán. Vui lòng tạo yêu cầu nạp mới.
              </p>
              <p className="text-xs text-rose-500">
                (Giao dịch đã quá 15 phút mà chưa nhận được tiền hoặc đã bị hủy)
              </p>
            </div>
          ) : payment ? (
            <div className="space-y-4">
              {/* QR Code & Bank Info */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-col items-center shrink-0">
                  <div className="p-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
                    <img
                      src={payment.qrUrl}
                      alt="Mã QR nạp ví với số tiền và nội dung chuyển khoản"
                      className="w-48 h-48 sm:w-44 sm:h-44 object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1.5 text-center">
                    Quét mã VietQR bằng ứng dụng ngân hàng
                  </span>
                </div>

                <div className="w-full space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500">Ngân hàng:</span>
                    <strong className="font-bold text-slate-800">{payment.bank}</strong>
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500">Số tài khoản:</span>
                    <div className="flex items-center gap-1.5">
                      <strong className="select-all font-mono text-sm font-bold text-slate-900">
                        {payment.qrAccountNumber}
                      </strong>
                      <button
                        type="button"
                        onClick={copyAccountNumber}
                        aria-label="Sao chép số tài khoản"
                        className="rounded p-1 text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Sao chép STK"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {payment.accountName && (
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                      <span className="text-slate-500">Chủ tài khoản:</span>
                      <strong className="font-bold text-slate-800">{payment.accountName}</strong>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500">Số tiền:</span>
                    <div className="text-right">
                      <strong className="text-sm font-extrabold text-blue-600">
                        {payment.amountVND.toLocaleString("vi-VN")} VND
                      </strong>
                      <span className="text-[11px] text-emerald-600 font-bold block">
                        +{(payment.amountVND / 100).toLocaleString("vi-VN")} Credit
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hộp nội dung chuyển khoản quan trọng */}
              <div className="rounded-2xl border-2 border-blue-200/80 bg-blue-50/60 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                    Nội dung chuyển khoản (bắt buộc)
                  </span>
                  <button
                    type="button"
                    onClick={copyContent}
                    aria-label="Sao chép nội dung chuyển khoản"
                    className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800 shrink-0 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs active:scale-95 transition-all"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copied ? "Đã chép" : "Sao chép"}</span>
                  </button>
                </div>
                <div className="rounded-xl bg-white p-2.5 border border-blue-100 shadow-inner">
                  <strong className="font-mono text-base font-black text-blue-900 select-all break-all tracking-wide block text-center">
                    {payment.transferContent}
                  </strong>
                </div>
                <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                  Lưu ý: Quét QR để điền sẵn thông tin. Chuyển đúng số tiền và giữ nguyên nội dung để ví được cộng tự động trong vòng vài giây.
                </p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <p role="status" className="flex items-center gap-2 text-amber-700 font-medium">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600" />
                  <span>Đang chờ ngân hàng xác nhận...</span>
                </p>
                <button
                  type="button"
                  onClick={() => setRetry((value) => value + 1)}
                  className="rounded-xl border border-blue-200 bg-white px-3.5 py-1.5 text-xs font-bold text-blue-700 shadow-2xs hover:bg-blue-50 transition-colors"
                >
                  Kiểm tra thanh toán
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Đang tải thông tin thanh toán...</p>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Nếu gặp sự cố thanh toán, vui lòng liên hệ admin kèm mã #{orderCode}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </section>
    </div>
  );
}
