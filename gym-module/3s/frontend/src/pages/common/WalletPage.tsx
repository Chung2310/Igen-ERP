import { useEffect, useMemo, useState } from 'react';
import {
  History,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import CreditLedgerTable from '../../components/credits/CreditLedgerTable';
import CreditPackageGrid from '../../components/credits/CreditPackageGrid';
import CustomTopupForm from '../../components/credits/CustomTopupForm';
import SepayCheckoutModal from '../../components/credits/SepayCheckoutModal';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/ToastProvider';
import { useCreditWallet } from '../../contexts/CreditWalletContext';
import { creditsService } from '../../services/credits';
import { errorMessage } from '../../types';
import type { CreditLedgerEntry, CreditPackageResponse, PaymentOrder } from '../../types/credits';

export default function WalletPage() {
  const { refresh: refreshWallet } = useCreditWallet();
  const toast = useToast();
  const [catalog, setCatalog] = useState<CreditPackageResponse | null>(null);
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [type, setType] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [mode, setMode] = useState<'PACKAGE' | 'CUSTOM'>('PACKAGE');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Active SePay checkout modal state
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<PaymentOrder | null>(null);

  const loadLedger = async (nextPage = page, nextType = type) => {
    try {
      const result = await creditsService.ledger(nextPage, nextType);
      setEntries(result.items);
      setTotalPages(result.meta?.totalPages || 1);
    } catch (cause) {
      toast.error(errorMessage(cause));
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([creditsService.packages(), creditsService.ledger(1)])
      .then(([nextCatalog, ledger]) => {
        if (!active) return;
        setCatalog(nextCatalog);
        setEntries(ledger.items);
        setTotalPages(ledger.meta?.totalPages || 1);
        if (nextCatalog.packages && nextCatalog.packages.length > 0) {
          setSelectedPackageId(nextCatalog.packages[0].id);
          setMode('PACKAGE');
        } else {
          setMode('CUSTOM');
        }
      })
      .catch((cause) => active && setError(errorMessage(cause)))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  const numericCustom = Number(customAmount);
  const customValid =
    Boolean(catalog?.vndPerCredit && catalog.vndPerCredit > 0 && numericCustom >= catalog.vndPerCredit) &&
    Number.isInteger(numericCustom) &&
    numericCustom >= 10_000 &&
    numericCustom <= 50_000_000 &&
    numericCustom % 1_000 === 0;

  const currentPackage = useMemo(
    () => catalog?.packages.find((item) => item.id === selectedPackageId),
    [catalog, selectedPackageId],
  );

  const paymentAmountVnd = useMemo(() => {
    if (mode === 'CUSTOM') return customValid ? numericCustom : 0;
    return currentPackage?.amountVnd || 0;
  }, [mode, customValid, numericCustom, currentPackage]);

  const estimatedCredits = useMemo(() => {
    if (mode === 'CUSTOM') return customValid && catalog?.vndPerCredit ? Math.floor(numericCustom / catalog.vndPerCredit) : 0;
    return currentPackage?.grantCredits || 0;
  }, [mode, customValid, numericCustom, currentPackage, catalog?.vndPerCredit]);

  const canSubmit =
    Boolean(catalog?.gateways.SEPAY) &&
    (mode === 'CUSTOM' ? customValid : Boolean(selectedPackageId)) &&
    paymentAmountVnd >= 10_000 &&
    !submitting;

  const handleCreatePayment = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const order = await creditsService.createTopup(
        mode === 'CUSTOM'
          ? { gateway: 'SEPAY', customAmountVnd: numericCustom }
          : { gateway: 'SEPAY', packageId: selectedPackageId },
      );

      // Save pending order and show embedded VietQR Modal directly
      setActiveOrder(order);
      setCheckoutModalOpen(true);
      window.sessionStorage.setItem('3s:pending-credit-order-id', order.id);
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    void refreshWallet?.();
    void loadLedger(1, type);
    toast.success('Nạp credit thành công!');
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-pulse p-4">
        <div className="h-44 rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-40 rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-5xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700"
      >
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top-up Section: Clean, Focus on Recharge with SePay VietQR */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        {/* Section Header */}
        <div className="border-b border-slate-100 pb-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-montserrat">
                Nạp credit
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                1.000 đ = 10 credit
              </p>
            </div>

            {/* Clean Toggle Mode Tabs */}
            <div className="mt-3 flex rounded-xl bg-slate-100 p-1 sm:mt-0">
              <button
                type="button"
                onClick={() => setMode('PACKAGE')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  mode === 'PACKAGE'
                    ? 'bg-white text-[#003b70] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gói nạp
              </button>
              <button
                type="button"
                onClick={() => setMode('CUSTOM')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  mode === 'CUSTOM'
                    ? 'bg-white text-[#003b70] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Số tiền tùy chọn
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="mt-6 space-y-6">
          {mode === 'PACKAGE' ? (
            <CreditPackageGrid
              packages={catalog?.packages || []}
              selectedId={selectedPackageId}
              onSelect={(id) => setSelectedPackageId(id)}
            />
          ) : (
            <CustomTopupForm
              vndPerCredit={catalog?.vndPerCredit}
              value={customAmount}
              selected={true}
              onChange={setCustomAmount}
              onSelect={() => {}}
            />
          )}

          {/* SePay VietQR Security Strip */}
          <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-action-primary text-white">
                <QrCode size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    Thanh toán
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                    <Zap size={11} /> VietQR
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Chuyển khoản VietQR, xác nhận qua SePay
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 sm:self-center">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>Đối chiếu qua SePay</span>
            </div>
          </div>

          {!catalog?.gateways.SEPAY && <p role="status" className="flex items-center gap-2 text-sm text-amber-700"><ShieldCheck size={18} /> Nạp tiền SePay hiện chưa sẵn sàng. Vui lòng liên hệ quản trị viên.</p>}

          {/* Action & Settle Strip */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tổng thanh toán:
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-oswald text-2xl font-black text-slate-900">
                  {paymentAmountVnd.toLocaleString('vi-VN')} đ
                </span>
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Sparkles size={12} />
                  Nhận ngay: <strong className="font-oswald text-base">{estimatedCredits.toLocaleString('vi-VN')}</strong> credit
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleCreatePayment}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-[#003b70] px-8 text-sm font-bold text-white shadow-md hover:bg-action-pressed transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <QrCode size={18} />
              )}
              <span>{submitting ? 'Đang tạo mã thanh toán...' : 'Thanh toán'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Transaction History Section: Compact & Clean */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <History size={16} />
            </div>
            <h3 className="text-base font-bold text-slate-900 font-montserrat">
              Lịch sử giao dịch credit
            </h3>
          </div>

          <select
            aria-label="Lọc loại giao dịch"
            value={type}
            onChange={(event) => {
              const next = event.target.value;
              setType(next);
              setPage(1);
              void loadLedger(1, next);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-sky-500 focus:outline-none"
          >
            <option value="">Tất cả giao dịch</option>
            <option value="TOPUP">Nạp credit</option>
            <option value="USAGE">Sử dụng AI</option>
          </select>
        </div>

        <div className="mt-4 space-y-4">
          <CreditLedgerTable entries={entries} />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={async (next) => {
              setPage(next);
              await loadLedger(next);
            }}
          />
        </div>
      </section>

      {/* SePay VietQR Checkout Modal */}
      <SepayCheckoutModal
        open={checkoutModalOpen}
        order={activeOrder}
        onClose={() => setCheckoutModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
