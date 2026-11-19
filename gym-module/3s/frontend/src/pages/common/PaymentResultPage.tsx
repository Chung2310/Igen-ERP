import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCreditWallet } from '../../contexts/CreditWalletContext';
import { creditsService } from '../../services/credits';
import type { PaymentOrder } from '../../types/credits';

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderId =
    params.get('orderId') ||
    window.sessionStorage.getItem('3s:pending-credit-order-id') ||
    '';
  const { refresh } = useCreditWallet();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(Date.now());

  const read = useCallback(async () => {
    if (!orderId) {
      setError('Thiếu mã đơn thanh toán.');
      return false;
    }
    try {
      const next = await creditsService.order(orderId);
      setOrder(next);
      setError('');
      if (next.status === 'PAID') {
        window.sessionStorage.removeItem('3s:pending-credit-order-id');
        await refresh?.();
      }
      return next.status === 'PENDING';
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra đơn thanh toán.');
      return false;
    }
  }, [orderId, refresh]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const poll = async () => {
      const pending = await read();
      if (!active || !pending) return;
      if (Date.now() - started.current >= 60_000) {
        setTimedOut(true);
        return;
      }
      timer = window.setTimeout(poll, 2_000);
    };

    void poll();

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [read]);

  const status = order?.status;
  const isSuccess = status === 'PAID';
  const isFailed = status === 'FAILED' || status === 'EXPIRED';

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 text-center shadow-xl shadow-slate-100">
        {/* Status Icon */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full">
          {isSuccess ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-in zoom-in-75 duration-200">
              <CheckCircle2 size={48} />
            </div>
          ) : isFailed ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <XCircle size={48} />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Clock3 size={48} />
            </div>
          )}
        </div>

        {/* Status Title */}
        <h1 className="mt-5 text-2xl font-bold text-slate-900 font-montserrat">
          {isSuccess
            ? 'Nạp credit thành công'
            : status === 'FAILED'
              ? 'Thanh toán thất bại'
              : status === 'EXPIRED'
                ? 'Đơn thanh toán đã hết hạn'
                : 'Đang xác nhận thanh toán'}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {isSuccess
            ? 'Credit đã được cộng vào ví của bạn. Bạn có thể sử dụng ngay bây giờ.'
            : isFailed
              ? 'Giao dịch chưa được hoàn tất hoặc đã bị hủy.'
              : 'Hệ thống đang kiểm tra trạng thái thanh toán, vui lòng chờ trong giây lát.'}
        </p>

        {/* Loading Spinner for pending */}
        {!order && !error && (
          <div className="my-6 flex justify-center">
            <LoaderCircle className="animate-spin text-sky-600" size={28} />
          </div>
        )}

        {/* Order Details Card */}
        {order && (
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-left text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Mã đơn hàng:</span>
              <span className="font-mono font-bold text-slate-800">#{order.orderCode}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Phương thức:</span>
              <span className="font-bold text-slate-800">Quét mã VietQR</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500">Số tiền thanh toán:</span>
              <span className="font-oswald text-sm font-bold text-slate-900">
                {order.amountVnd.toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Credit nhận được:</span>
              <span className="font-oswald text-sm font-bold text-emerald-600 flex items-center gap-1">
                <Sparkles size={12} />
                +{order.grantCredits.toLocaleString('vi-VN')} credit
              </span>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        {timedOut && (
          <p className="mt-4 text-xs font-medium text-amber-700">
            Chưa nhận được xác nhận sau 60 giây. Vui lòng bấm kiểm tra lại hoặc kiểm tra lịch sử trong ví.
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          {(timedOut || error || (!isSuccess && !isFailed)) && (
            <button
              type="button"
              onClick={() => {
                setTimedOut(false);
                started.current = Date.now();
                void read();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={14} /> Kiểm tra lại
            </button>
          )}

          <Link
            to="/portal/wallet"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#00284d] transition-colors"
          >
            <WalletCards size={14} /> Về ví credit
          </Link>
        </div>
      </div>
    </div>
  );
}
