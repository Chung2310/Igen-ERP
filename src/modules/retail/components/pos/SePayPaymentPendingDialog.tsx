import React from "react";
import { CheckCircle2, LoaderCircle, X } from "lucide-react";
import { retailOrdersApi } from "../../api/retailOrders.api";
import type { RetailOrderPaymentStatus, RetailPaymentQr, RetailScope } from "../../types";
import { getApiErrorMessage } from "../../../../utils/errorMessage";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

type Props = {
  scope: RetailScope;
  orderId: string;
  orderCode: string;
  paymentCode: string;
  amount: number;
  paidAmountBeforeTransfer: number;
  onPaid: (order: RetailOrderPaymentStatus) => void | Promise<void>;
  onDismiss: () => void;
};

export default function SePayPaymentPendingDialog({
  scope,
  orderId,
  orderCode,
  paymentCode,
  amount,
  paidAmountBeforeTransfer,
  onPaid,
  onDismiss,
}: Props) {
  const [qr, setQr] = React.useState<RetailPaymentQr | null>(null);
  const [qrError, setQrError] = React.useState("");
  const onPaidRef = React.useRef(onPaid);
  onPaidRef.current = onPaid;

  React.useEffect(() => {
    let active = true;
    retailOrdersApi.paymentQr(scope, orderId)
      .then((value) => { if (active) setQr(value); })
      .catch((error) => { if (active) setQrError(getApiErrorMessage(error, "Không tải được mã QR. Đơn hàng đã được lưu; hãy kiểm tra cấu hình tài khoản nhận tiền hoặc tải lại đơn để thử lại.")); });
    return () => { active = false; };
  }, [scope.companyCode, scope.branchId, orderId]);

  React.useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const order = await retailOrdersApi.paymentStatus(scope, orderId);
        if (!active) return;
        if (Number(order.paidAmount) >= paidAmountBeforeTransfer + amount) {
          await onPaidRef.current(order);
          return;
        }
      } catch {
        // Keep polling through short network interruptions while the order remains saved.
      }
      if (active) timer = setTimeout(() => void poll(), 1800);
    };
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [scope.companyCode, scope.branchId, orderId, amount, paidAmountBeforeTransfer]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Đang chờ thanh toán SePay" className="flex max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl [overflow-wrap:anywhere]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LoaderCircle className="h-5 w-5 animate-spin" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-primary">
                <p className="text-sm font-bold">Đơn đã lưu · đang chờ thanh toán</p>
              </div>
              <h2 className="mt-2 text-xl font-extrabold text-slate-900">Quét QR để chuyển khoản</h2>
            </div>
          </div>
          <button type="button" aria-label="Đóng màn hình chờ" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onDismiss}><X className="h-4 w-4" /></button>
        </div>

        <div role="region" aria-label="Chi tiết thanh toán SePay" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-primary sm:px-6">
        <p className="text-sm text-slate-600">Đơn {orderCode}. POS sẽ báo thành công khi SePay xác nhận tiền về.</p>
        {qr ? (
          <div className="mt-5 flex flex-col items-center gap-4 rounded-2xl border border-outline-variant bg-surface p-4 sm:flex-row sm:items-start">
            <img src={qr.qrUrl} alt={`Mã QR chuyển ${money(qr.amount)}`} className="h-48 w-48 shrink-0 rounded-xl bg-white object-contain p-1" />
            <div className="min-w-0 max-w-full text-center sm:pt-2 sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số tiền chuyển</p>
              <p className="mt-1 text-2xl font-black text-primary">{money(qr.amount)}</p>
              {qr.accountName && <p className="mt-3 break-words text-sm font-semibold text-slate-700">{qr.accountName}</p>}
              <p className="mt-1 break-all text-sm text-slate-700">Ngân hàng: {qr.bankId} · STK: {qr.accountNumber}</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">Nội dung chuyển khoản</p>
              <p className="mt-1 break-all rounded-lg bg-white px-2.5 py-2 font-mono text-sm font-bold text-slate-900">{qr.transferContent || qr.paymentCode || paymentCode}</p>
            </div>
          </div>
        ) : qrError ? (
          <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{qrError} Mã thanh toán: <span className="font-mono font-bold">{paymentCode}</span></p>
        ) : (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-8 text-sm text-slate-600"><LoaderCircle className="h-4 w-4 animate-spin" />Đang tạo mã QR...</div>
        )}

        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Giữ nguyên nội dung chuyển khoản để SePay tự đối soát. Màn hình sẽ tự chuyển sang thành công khi nhận được giao dịch.</p>
        </div>
        <div className="shrink-0 border-t border-slate-100 p-4 sm:px-6"><button type="button" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={onDismiss}>Đóng màn hình chờ, đơn vẫn được lưu</button></div>
      </div>
    </div>
  );
}
