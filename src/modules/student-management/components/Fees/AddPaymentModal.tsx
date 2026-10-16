import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Loader2, Save, CreditCard, QrCode, Banknote, Landmark } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { Student } from '../../types';
import { useAuth } from '../../../../context/AuthContext';
import { toast } from '../../../../pages/Toast';
import { getVietQRBankCode, toDisplayDate } from '../../lib/utils';
import { companyPaymentApi } from '../../../../services/companyPaymentService';
import { VietnameseDatePicker } from '../Batches/VietnameseDatePicker';

const BANK_NAMES: Record<string, string> = {
  mbbank: 'MBBank',
  vietcombank: 'Vietcombank',
  techcombank: 'Techcombank',
  vietinbank: 'Vietinbank',
  bidv: 'BIDV',
  agribank: 'Agribank',
  acb: 'ACB',
  sacombank: 'Sacombank',
  tpbank: 'TPBank',
  vpbank: 'VPBank'
};

function removeVietnameseTones(str: string): string {
  let result = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(//g, "d").replace(//g, "D");
  result = result.replace(/[^a-zA-Z0-9\s-_/.]/g, "");
  result = result.replace(/\s+/g, " ");
  return result.trim().toUpperCase();
}

function getLocalVietQrConfig() {
  const saved = localStorage.getItem('vietqrConfig');
  if (!saved) return null;
  try {
    return JSON.parse(saved) as {
      bankId?: string;
      accountNo?: string;
      accountName?: string;
      enabled?: boolean;
      template?: string;
    };
  } catch {
    return null;
  }
}

interface AddPaymentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPaymentModal({ student, isOpen, onClose, onSuccess }: AddPaymentModalProps) {
  const { userProfile } = useAuth();
  const user = userProfile as any;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [showTransferQr, setShowTransferQr] = useState(false);
  const [transferStartPaid, setTransferStartPaid] = useState(0);
  const [transferTimedOut, setTransferTimedOut] = useState(false);
  const [transferCheckError, setTransferCheckError] = useState('');
  const [vietqrConfig, setVietqrConfig] = useState(() => {
    const localConfig = getLocalVietQrConfig();
    const bankId = localConfig?.bankId || user?.bankId || '';
    const accountNo = localConfig?.accountNo || user?.bankAccountNo || '';
    const accountName = localConfig?.accountName || user?.bankAccountName || user?.displayName || '';
    const enabled = localConfig?.enabled ?? (user?.bankQrEnabled !== false);
    const template = localConfig?.template || '[Mã HV] - [Họ tên] - Nộp học phí khóa {hang}';
    return { enabled, bankId, accountNo, accountName, template };
  });

  React.useEffect(() => {
    if (!isOpen) return;
    const localConfig = getLocalVietQrConfig();
    setVietqrConfig({
      enabled: localConfig?.enabled ?? (user?.bankQrEnabled !== false),
      bankId: localConfig?.bankId || user?.bankId || '',
      accountNo: localConfig?.accountNo || user?.bankAccountNo || '',
      accountName: localConfig?.accountName || user?.bankAccountName || user?.displayName || '',
      template: localConfig?.template || '[Mã HV] - [Họ tên] - Nộp học phí khóa {hang}',
    });
    companyPaymentApi.getVietqr().then((companyConfig) => {
      if (companyConfig?.bankId && companyConfig?.accountNo) {
        setVietqrConfig((current) => ({
          ...current,
          bankId: companyConfig.bankId,
          accountNo: companyConfig.accountNo,
          accountName: companyConfig.accountName || current.accountName,
        }));
      }
    }).catch(() => undefined);
  }, [isOpen, user]);

  React.useEffect(() => {
    if (isOpen && student) {
      const timer = setTimeout(() => {
        const totalFee = parseInt(student.fee.replace(/\D/g, ''));
        const remaining = totalFee - (student.paidAmount || 0);
        if (remaining > 0) {
          setAmount(new Intl.NumberFormat('vi-VN').format(remaining));
        } else {
          setAmount('');
        }

        if (vietqrConfig.enabled && vietqrConfig.template) {
          const compiled = vietqrConfig.template
            .replace(/\[Mã HV\]|\[Ma HV\]/gi, student.id || student.idCard || '')
            .replace(/\[Họ tên\]|\[Ho ten\]/gi, student.fullName || '')
            .replace(/\{hang\}|\{rank\}/gi, student.rank || '');
          setNote(removeVietnameseTones(compiled));
        } else {
          setNote('');
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, student, vietqrConfig]);

  React.useEffect(() => {
    if (!showTransferQr || !student?.id) return;

    let cancelled = false;
    let failedChecks = 0;
    const checkPaymentReceived = async () => {
      try {
        const data = await apiFetch(`/students/${student.id}`);
        // StudentController trả dữ liệu theo dạng { success, data }. Đọc sai
        // `data.student` làm polling không bao giờ thấy khoản SePay vừa ghi nhận,
        // nên modal QR vẫn mở dù công nợ trên server đã được cập nhật.
        const updatedStudent = data?.data ?? data?.student;
        // SePay can record a partial transfer (for example a test transfer).
        // Once this student's paid amount increases, the callback was handled
        // successfully; waiting for the full QR amount leaves the modal open
        // forever after a valid partial payment.
        if (!cancelled && updatedStudent && Number(updatedStudent.paidAmount || 0) > transferStartPaid) {
          toast.success('SePay đã nhận tiền và ghi nhận học phí thành công.');
          window.dispatchEvent(new Event('payment-mutation'));
          window.dispatchEvent(new Event('student-mutation'));
          setShowTransferQr(false);
          onSuccess();
          onClose();
        }
      } catch {
        failedChecks += 1;
        if (!cancelled && failedChecks >= 3) {
          setTransferCheckError('Không thể kiểm tra trạng thái giao dịch. Hệ thống sẽ tiếp tục thử lại.');
        }
      }
    };

    void checkPaymentReceived();
    const interval = window.setInterval(() => void checkPaymentReceived(), 3000);
    const timeout = window.setTimeout(() => {
      if (!cancelled) setTransferTimedOut(true);
    }, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [showTransferQr, student?.id, transferStartPaid, onSuccess, onClose]);

  if (!isOpen || !student || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !student) return;

    try {
      const rawAmount = amount.replace(/\D/g, '');
      const rawFee = (student.fee || '0').replace(/\D/g, '');
      const payAmount = parseInt(rawAmount, 10);
      const totalFee = parseInt(rawFee, 10);
      const paidSoFar = student.paidAmount || 0;
      const remaining = totalFee - paidSoFar;

      if (isNaN(payAmount) || payAmount <= 0) {
        toast.warning('Vui lòng nhập số tiền hợp lệ');
        return;
      }

      if (payAmount > remaining) {
        toast.warning('Số tiền đóng vượt quá số tiền còn nợ. Vui lòng kiểm tra lại!');
        return;
      }

      if (paymentMethod === 'Chuyển khoản') {
        if (!vietqrConfig.enabled || !vietqrConfig.bankId || !vietqrConfig.accountNo) {
          toast.warning('Chưa có cấu hình tài khoản SePay để nhận chuyển khoản.');
          return;
        }
        setTransferStartPaid(student.paidAmount || 0);
        setTransferTimedOut(false);
        setTransferCheckError('');
        setShowTransferQr(true);
        return;
      }

      setIsSubmitting(true);

      await apiFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.fullName,
          amount: payAmount,
          date: toDisplayDate(date),
          method: paymentMethod,
          note: note.trim(),
        }),
      });

      window.dispatchEvent(new Event("payment-mutation"));
      window.dispatchEvent(new Event("student-mutation"));

      toast.success('Ghi nhận thanh toán thành công!');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Payment Submission Error:", error);
      toast.error('Đã có lỗi xảy ra khi ghi nhận thanh toán: ' + (error instanceof Error ? error.message : 'Lỗi không xác định'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatInputCurrency = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (!raw) return '';
    return new Intl.NumberFormat('vi-VN').format(parseInt(raw));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          className={`relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl ${showTransferQr ? 'hidden' : ''}`}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-sky-100 px-5 py-4">
            <h3 className="border-l-4 border-brand-primary pl-3 text-base font-medium text-slate-900">Thanh toán học phí</h3>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600" aria-label="Đóng">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-5 no-scrollbar">
            <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-brand-primary/5 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-white text-brand-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 leading-none">{student.fullName}</p>
                <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <p className="text-xs font-normal text-slate-600">Học phí: {student.fee}đ</p>
                  <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-300" />
                  <p className="text-xs font-medium text-rose-500">
                    Còn nợ: {new Intl.NumberFormat('vi-VN').format(parseInt(student.fee.replace(/\D/g, '')) - (student.paidAmount || 0))}đ
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-normal text-slate-700">Số tiền đóng (VNĐ) *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={amount}
                    onChange={(e) => setAmount(formatInputCurrency(e.target.value))}
                    placeholder="VD: 5.000.000"
                    className="h-10 w-full rounded-xl border border-sky-100 bg-white px-3 pr-12 text-sm font-medium text-brand-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-normal text-slate-500">VNĐ</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-normal text-slate-700">Ngày đóng</label>
                <VietnameseDatePicker ariaLabel="Ngày đóng" required value={date} onChange={setDate} selectionOnly variant="filter" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-normal text-slate-700">Phương thức thanh toán</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['Tiền mặt', Banknote],
                    ['Chuyển khoản', Landmark],
                  ] as const).map(([value, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPaymentMethod(value)}
                      className={`flex h-9 items-center justify-center gap-2 rounded-xl border text-xs font-normal transition-colors ${paymentMethod === value ? 'border-brand-primary bg-brand-primary/10 text-brand-primary' : 'border-sky-100 bg-white text-slate-600 hover:border-sky-300'}`}
                    >
                      <Icon className="w-4 h-4" />
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-normal text-slate-700">Ghi chú</label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="VD: Đóng đợt 1, chuyển khoản..."
                    className="w-full resize-none rounded-xl border border-sky-100 bg-white p-3 pr-9 text-sm font-normal text-slate-800 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
                  />
                  <FileText className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {!showTransferQr && paymentMethod === 'Chuyển khoản' && vietqrConfig.enabled && vietqrConfig.bankId && vietqrConfig.accountNo && (() => {
                const qrCodeMemo = (() => {
                  let m = note;
                  const objectIdRegex = /[0-9a-fA-F]{24}/;
                  if (student.id && !objectIdRegex.test(m)) {
                    m = `${m} ${student.id}`.trim();
                  }
                  return m;
                })();

                return (
                  <div className="space-y-3 rounded-xl border border-sky-100 bg-brand-primary/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <QrCode className="w-3.5 h-3.5 text-brand-primary" /> Quét mã thanh toán (SePay)
                      </span>
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-normal text-emerald-700">Tự động điền số tiền</span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div className="bg-white p-2 border border-slate-100 rounded-xl shrink-0 flex items-center justify-center">
                        <img
                          src={`https://img.vietqr.io/image/${getVietQRBankCode(vietqrConfig.bankId)}-${vietqrConfig.accountNo}-compact2.png?amount=${amount.replace(/\D/g, '') || '0'}&addInfo=${encodeURIComponent(qrCodeMemo)}&accountName=${encodeURIComponent(vietqrConfig.accountName)}`}
                          alt="VietQR Chuyển khoản"
                          className="w-24 h-24 object-contain"
                        />
                      </div>
                      <div className="text-xs space-y-1.5 select-all flex-1 min-w-0">
                        <p className="font-normal text-slate-500">Ngân hàng: <span className="text-slate-800">{BANK_NAMES[vietqrConfig.bankId] || vietqrConfig.bankId.toUpperCase()}</span></p>
                        <p className="font-normal text-slate-500">Số tài khoản: <span className="text-slate-800">{vietqrConfig.accountNo}</span></p>
                        <p className="font-normal text-slate-500">Chủ tài khoản: <span className="text-slate-800">{vietqrConfig.accountName}</span></p>
                        <p className="font-medium text-slate-500 flex flex-col gap-0.5">
                          <span>Nội dung chuyển khoản QR:</span>
                          <span className="bg-slate-200/80 text-slate-800 font-mono px-1.5 py-0.5 rounded text-[10px] font-semibold break-all inline-block select-all">
                            {qrCodeMemo || '(Trống)'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end border-t border-sky-100 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-9 items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-xs font-medium text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Xác nhận
              </button>
            </div>
          </form>
        </motion.div>
        {showTransferQr && paymentMethod === 'Chuyển khoản' && (
          <div className="absolute z-10 w-full max-w-sm rounded-2xl border border-sky-100 bg-white p-5 text-center shadow-2xl">
            <button type="button" onClick={() => { setShowTransferQr(false); onClose(); }} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600" aria-label="Đóng"><X className="h-4 w-4" /></button>
            <QrCode className="mx-auto mb-2 h-7 w-7 text-brand-primary" />
            <h4 className="text-base font-medium text-slate-900">Quét mã để chuyển khoản</h4>
            <p className="text-xs text-slate-500 mt-1">Sau khi SePay nhận tiền, học phí sẽ được ghi nhận tự động.</p>
            {transferTimedOut && <p className="mt-2 text-xs font-semibold text-amber-600">Chưa nhận được giao dịch sau 15 phút. Vui lòng kiểm tra lại nội dung chuyển khoản hoặc liên hệ trung tâm.</p>}
            {!transferTimedOut && transferCheckError && <p className="mt-2 text-xs font-semibold text-amber-600">{transferCheckError}</p>}
            <img
              className="w-64 h-64 object-contain mx-auto my-4"
              src={`https://img.vietqr.io/image/${getVietQRBankCode(vietqrConfig.bankId)}-${vietqrConfig.accountNo}-compact2.png?amount=${amount.replace(/\D/g, '')}&addInfo=${encodeURIComponent(note)}&accountName=${encodeURIComponent(vietqrConfig.accountName)}`}
              alt="Mã QR chuyển khoản SePay"
            />
            <p className="text-xs text-slate-500">Nội dung: <strong className="font-mono text-slate-800">{note}</strong></p>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
