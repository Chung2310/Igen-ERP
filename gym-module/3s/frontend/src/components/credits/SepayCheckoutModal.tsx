import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Loader2, QrCode, ShieldCheck, X } from 'lucide-react';
import { creditsService } from '../../services/credits';
import type { PaymentOrder } from '../../types/credits';

interface Props { open: boolean; order: PaymentOrder | null; onClose: () => void; onSuccess: () => void }

export default function SepayCheckoutModal(props: Props) {
  if (!props.open || !props.order) return null;
  return <Checkout key={props.order.id} {...props} order={props.order} />;
}

function Checkout({ order, onClose, onSuccess }: Omit<Props, 'order'> & { order: PaymentOrder }) {
  const [status, setStatus] = useState(order.status);
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.ceil((Date.parse(order.expiresAt) - Date.now()) / 1000)));
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState(order.qrCodeUrl);
  const [qrAttempt, setQrAttempt] = useState(0);
  const [retry, setRetry] = useState(0);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState('');
  const transfer = order.bankTransfer;
  const expired = status === 'EXPIRED' || (status === 'PENDING' && timeLeft === 0);
  const paid = status === 'PAID';
  const failed = status === 'FAILED';

  useEffect(() => {
    const timer = window.setInterval(() => setTimeLeft(Math.max(0, Math.ceil((Date.parse(order.expiresAt) - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [order.expiresAt]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const check = async () => {
      setChecking(true);
      let next: PaymentOrder['status'] = 'PENDING';
      try {
        const latest = await creditsService.order(order.id);
        if (!active) return;
        next = latest.status;
        setStatus(next);
        setQrCodeUrl(latest.qrCodeUrl);
        setError('');
        if (next === 'PAID' && status !== 'PAID') onSuccess();
      } catch {
        if (active) setError('Chưa thể kiểm tra giao dịch. Vui lòng kiểm tra kết nối và thử lại.');
      } finally {
        if (active) {
          setChecking(false);
          if (next === 'PENDING') timer = window.setTimeout(check, 2500);
        }
      }
    };
    if (status !== 'PAID' && status !== 'FAILED') void check();
    return () => { active = false; window.clearTimeout(timer); };
  }, [order.id, retry, onSuccess, status]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);

  const copy = async (value: string, name: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(name); setCopyError(''); }
    catch { setCopyError('Không thể sao chép. Bạn có thể chọn và sao chép thông tin bên dưới.'); }
  };
  const details = [
    ['Ngân hàng', transfer?.bankName],
    ['Chủ tài khoản', transfer?.accountHolder],
    ['Số tài khoản', transfer?.accountNumber],
    ['Số tiền (VNĐ)', String(order.amountVnd)],
    ['Nội dung chuyển khoản', transfer?.content],
  ];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sepay-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 text-slate-800">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <QrCode size={24} className="text-action-primary" />
            <h2 id="sepay-title" className="text-lg font-bold normal-case font-montserrat">Thanh toán SePay</h2>
          </div>
          <button autoFocus type="button" onClick={onClose} aria-label="Đóng thanh toán"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-slate-100"><X size={20} /></button>
        </header>
        {paid ? (
          <div role="status" className="space-y-3 py-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-500" />
            <h3 className="text-xl font-bold normal-case font-montserrat">Thanh toán thành công</h3>
            <p>Đã cộng {order.grantCredits.toLocaleString('vi-VN')} credit vào ví.</p>
          </div>
        ) : failed || expired ? (
          <div role="status" className="space-y-3 py-4">
            <AlertCircle size={32} className="text-amber-600" />
            <h3 className="text-lg font-bold normal-case font-montserrat">{failed ? 'Giao dịch chưa hoàn tất' : 'Đã hết thời gian chờ thanh toán'}</h3>
            <p>Nếu đã chuyển tiền, hãy kiểm tra lại trạng thái hoặc liên hệ hỗ trợ với mã đơn {order.orderCode}. Không chuyển thêm tiền cho đơn này.</p>
          </div>
        ) : (
          <>
            <p className="mb-4 flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin text-action-primary" />
              Đang chờ chuyển khoản · {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </p>
            <PaymentQr key={`${qrCodeUrl || 'missing'}:${qrAttempt}`}
              url={qrCodeUrl ? (qrAttempt ? qrCodeUrl + (qrCodeUrl.includes('?') ? '&' : '?') + '_retry=' + qrAttempt : qrCodeUrl) : undefined}
              onRetry={() => { setQrAttempt(Date.now()); setRetry(value => value + 1); }} />
            <dl className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4">
              {details.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="break-all text-sm font-semibold">{value || 'Chưa có thông tin'}</dd></div>
                  {value && <button type="button" onClick={() => void copy(value, label!)} aria-label={'Sao chép ' + label}
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-action-primary hover:bg-sky-50">
                    {copied === label ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                  </button>}
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm">Chuyển đúng số tiền và giữ nguyên nội dung để hệ thống đối chiếu. Credit chỉ được cộng sau khi xác nhận đã nhận tiền.</p>
          </>
        )}
        {(error || copyError) && <p role="alert" className="mt-3 flex gap-2 text-sm text-red-600"><AlertCircle size={20} className="shrink-0" />{error || copyError}</p>}
        {!paid && !failed && <button type="button" disabled={checking} onClick={() => setRetry(value => value + 1)}
          className="mt-4 min-h-11 w-full rounded-xl bg-action-primary px-4 text-white hover:bg-action-pressed disabled:opacity-50">
          {checking ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán'}
        </button>}
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={16} /> Xác nhận giao dịch qua SePay</p>
      </div>
    </div>
  );
}

function PaymentQr({ url, onRetry }: { url?: string; onRetry: () => void }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(url ? 'loading' : 'error');

  useEffect(() => {
    if (state !== 'loading') return;
    const timer = window.setTimeout(() => setState('error'), 15000);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === 'error') return (
    <div role="alert" className="rounded-2xl bg-amber-50 p-4 text-sm">
      <AlertCircle size={20} className="mb-2 text-amber-600" />
      Không tải được mã QR. Bạn có thể chuyển khoản theo thông tin bên dưới.
      <button type="button" onClick={onRetry} className="block min-h-11 text-action-primary underline">Tải lại mã QR</button>
    </div>
  );

  return (
    <div className="relative mx-auto min-h-64 max-w-sm" aria-busy={state === 'loading'}>
      {state === 'loading' && (
        <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 text-sm">
          <Loader2 size={20} className="animate-spin text-action-primary" /> Đang tải mã QR…
        </div>
      )}
      <img src={url} referrerPolicy="no-referrer" onLoad={() => setState('ready')} onError={() => setState('error')}
        alt="Mã VietQR chuyển khoản SePay"
        className={`mx-auto h-auto w-full object-contain ${state === 'loading' ? 'invisible' : ''}`} />
    </div>
  );
}
