import React, { useState } from 'react';
import { CreditCard, History, Trash2, Pencil, Zap, AlertCircle, QrCode, Copy, Check, Info, Download } from 'lucide-react';
import { Student } from '../../../types';
import { cn, formatVND, parseVND, getVietQRBankCode } from '../../../lib/utils';
import { useAuth } from '../../../../../context/AuthContext';
import { useEntityLabel } from '../../../hooks/useEntityLabel';
import { companyPaymentApi } from '../../../../../services/companyPaymentService';
import { apiFetch } from '../../../lib/api';
import { toast } from '../../../../../pages/Toast';

type PaymentHistoryItem = NonNullable<Student['paymentHistory']>[number];

function getLocalVietQrConfig() {
  const saved = localStorage.getItem('vietqrConfig');
  if (!saved) return null;
  try {
    return JSON.parse(saved) as {
      bankId?: string;
      accountNo?: string;
      accountName?: string;
      enabled?: boolean;
    };
  } catch {
    return null;
  }
}

interface TuitionTabProps {
  student: Student;
  handleStartEditPayment: (p: PaymentHistoryItem, idx: number) => void;
  handleDeletePaymentClick: (p: PaymentHistoryItem, idx: number) => Promise<void>;
  undoState?: { history: any[], message: string } | null;
  handleUndoPayment?: () => Promise<void>;
}

export function TuitionTab({
  student,
  handleStartEditPayment,
  handleDeletePaymentClick,
  undoState,
  handleUndoPayment
}: TuitionTabProps) {
  const { userProfile: user } = useAuth();
  const entityLabel = useEntityLabel();
  const feeLabel = 'Học phí đã chốt';
  const totalFee = parseInt(parseVND(student.fee)) || 0;
  const paid = student.paymentHistory?.length
    ? student.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    : (student.paidAmount || 0);
  const remaining = totalFee - paid;

  const [paymentAmount, setPaymentAmount] = useState<number>(remaining > 0 ? remaining : 0);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>(formatVND(remaining > 0 ? remaining : 0));
  const [copied, setCopied] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [vietqrConfig, setVietqrConfig] = useState(() => {
    const localConfig = getLocalVietQrConfig();
    const bankId = localConfig?.bankId || (user as any)?.bankId || '';
    const accountNo = localConfig?.accountNo || (user as any)?.bankAccountNo || '';
    const accountName = localConfig?.accountName || (user as any)?.bankAccountName || user?.displayName || '';
    const enabled = localConfig?.enabled ?? ((user as any)?.bankQrEnabled !== false);
    return { enabled, bankId, accountNo, accountName };
  });

  React.useEffect(() => {
    const localConfig = getLocalVietQrConfig();
    const fallbackConfig = {
      enabled: localConfig?.enabled ?? ((user as any)?.bankQrEnabled !== false),
      bankId: localConfig?.bankId || (user as any)?.bankId || '',
      accountNo: localConfig?.accountNo || (user as any)?.bankAccountNo || '',
      accountName: localConfig?.accountName || (user as any)?.bankAccountName || user?.displayName || ''
    };
    setVietqrConfig(fallbackConfig);

    // Company settings are the source of truth for tuition payments. Keep
    // personal/local settings as a fallback for older installations.
    companyPaymentApi.getVietqr()
      .then((companyConfig) => {
        if (companyConfig?.bankId && companyConfig?.accountNo) {
          setVietqrConfig({
            ...fallbackConfig,
            bankId: companyConfig.bankId,
            accountNo: companyConfig.accountNo,
            accountName: companyConfig.accountName || fallbackConfig.accountName,
          });
        }
      })
      .catch(() => {
        // The fallback above still supports accounts configured per user.
      });
  }, [user]);

  const [prevRemaining, setPrevRemaining] = useState(remaining);
  if (remaining !== prevRemaining) {
    setPaymentAmount(remaining > 0 ? remaining : 0);
    setPaymentAmountInput(formatVND(remaining > 0 ? remaining : 0));
    setPrevRemaining(remaining);
  }

  const handleCopyMemo = () => {
    navigator.clipboard.writeText(student.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTuitionReminder = async () => {
    const email = String((student as any).email || '').trim();
    if (!email) {
      toast.warning('Học viên chưa có địa chỉ email.');
      return;
    }
    if (remaining <= 0) {
      toast.info('Học viên đã hoàn tất học phí.');
      return;
    }

    setSendingReminder(true);
    try {
      const qr = hasValidConfig
        ? `<p><b>Ngân hàng:</b> ${accountName ? accountName : 'Tài khoản SePay doanh nghiệp'}<br/><b>Số tài khoản:</b> ${accountNo}<br/><b>Nội dung chuyển khoản:</b> ${student.id}</p><img src="${qrCodeUrl}" alt="VietQR" width="260" />`
        : '<p>Vui lòng liên hệ trung tâm để nhận thông tin chuyển khoản.</p>';
      const data = await apiFetch('/send-email', {
        method: 'POST',
        body: JSON.stringify({
          to: email,
          subject: `Nhắc nhở học phí - ${student.fullName}`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Nhắc nhở thanh toán học phí</h2><p>Xin chào ${student.fullName},</p><p>Học phí cần thanh toán: <b>${formatVND(totalFee)}đ</b><br/>Đã đóng: <b>${formatVND(paid)}đ</b><br/>Còn nợ: <b style="color:#e11d48">${formatVND(remaining)}đ</b></p>${qr}<p>Trân trọng.</p></div>`,
        }),
      });
      if (!data?.success) throw new Error(data?.error || 'Không thể gửi email.');
      toast.success(`Đã gửi nhắc học phí đến ${email}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gửi email nhắc học phí.');
    } finally {
      setSendingReminder(false);
    }
  };

  const handleAmountInputChange = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (!raw) {
      setPaymentAmountInput('');
      setPaymentAmount(0);
      return;
    }
    const num = parseInt(raw, 10);
    const capped = Math.min(remaining, num);
    setPaymentAmount(capped);
    setPaymentAmountInput(formatVND(capped));
  };

  const bankId = vietqrConfig.bankId;
  const accountNo = vietqrConfig.accountNo;
  const accountName = vietqrConfig.accountName;
  const enabled = vietqrConfig.enabled;

  const hasValidConfig = enabled && !!accountNo && !!bankId;
  const qrCodeUrl = hasValidConfig
    ? `https://img.vietqr.io/image/${getVietQRBankCode(bankId)}-${accountNo}-compact2.png?amount=${paymentAmount}&addInfo=${student.id}&accountName=${encodeURIComponent(accountName)}`
    : '';

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vietqr_${student.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Lỗi khi tải ảnh QR:", error);
      window.open(qrCodeUrl, '_blank');
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <FeeCard label={feeLabel} amount={totalFee} icon={CreditCard} color="text-slate-800" />
        <FeeCard label="Đã đóng" amount={paid} icon={CreditCard} color="text-brand-primary" isPaid />
        <FeeCard label="Còn nợ" amount={remaining} icon={AlertCircle} color="text-rose-600" isWarning />
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
        <div className="space-y-2.5 lg:col-span-2">
          <div className="rounded-2xl border border-sky-100 bg-white p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
            <History className="h-4 w-4 text-brand-primary" /> Nhật ký đóng phí
          </h3>
          
          {undoState && (
            <div className="animate-in slide-in-from-top-2 mb-3 flex items-center justify-between rounded-xl bg-slate-800 p-3 text-xs font-medium text-white">
              <span className="flex-1 pr-4">{undoState.message}</span>
              <button onClick={handleUndoPayment} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 active:scale-95 rounded-lg transition-all shrink-0">
                Hoàn tác
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            {(student.paymentHistory || []).length > 0 ? (
              student.paymentHistory?.map((p, idx) => (
                <div key={idx} className="group relative flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/40 p-2.5 transition-colors hover:bg-sky-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-primary">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">Thanh toán đợt {idx + 1}</p>
                      <p className="text-xs text-slate-500">{p.date} • {p.method}</p>
                      {p.note && <p className="text-[10px] text-slate-400 italic mt-0.5 max-w-[200px] truncate" title={p.note}>Ghi chú: {p.note}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-800">{formatVND(p.amount)}</p>
                      <p className="text-xs font-normal text-slate-500">{p.recipient}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button onClick={() => handleStartEditPayment(p, idx)} className="rounded-lg border border-sky-100 bg-white p-1.5 text-slate-500 transition-colors hover:bg-sky-50 hover:text-brand-primary" title="Sửa giao dịch">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeletePaymentClick(p, idx)} className="rounded-lg border border-rose-100 bg-white p-1.5 text-rose-500 transition-colors hover:bg-rose-50" title="Xóa giao dịch">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-6 opacity-60">
                <History className="mb-2 h-7 w-7 text-slate-300" />
                <p className="text-xs font-normal text-slate-500">Chưa có lịch sử thanh toán.</p>
              </div>
            )}
          </div>
        </div>

          <div className="rounded-2xl border border-sky-100 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-brand-primary">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-800">Thông tin đóng phí</h4>
                <p className="mt-0.5 text-xs text-slate-500">{entityLabel.titleCase} cần hoàn tất học phí trước ngày thi sát hạch 15 ngày.</p>
              </div>
            </div>

            <div className="mt-3 grid w-full gap-2 sm:grid-cols-[1fr_auto]">
              {(() => {
                let statusLabel = 'Chưa đóng';
                let statusColor = 'text-rose-500';
                let bgColor = 'bg-rose-50 border-rose-100';

                if (remaining <= 0 && totalFee > 0) {
                  statusLabel = 'Đã đóng đủ';
                  statusColor = 'text-emerald-600';
                  bgColor = 'bg-emerald-50 border-emerald-100';
                } else if (paid > 0) {
                  statusLabel = 'Còn thiếu';
                  statusColor = 'text-amber-600';
                  bgColor = 'bg-amber-50 border-amber-100';
                }

                return (
                  <div className={cn("rounded-xl border px-3 py-2 text-left", bgColor)}>
                    <p className="text-xs font-normal text-slate-500">Trạng thái hiện tại</p>
                    <p className={cn("text-sm font-medium", statusColor)}>{statusLabel}</p>
                  </div>
                );
              })()}
              <button onClick={handleSendTuitionReminder} disabled={sendingReminder} className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-600 disabled:opacity-60">
                {sendingReminder ? 'Đang gửi...' : 'Nhắc nhở đóng phí'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 lg:col-span-1">
          <div className="flex flex-col items-center rounded-2xl border border-sky-100 bg-white p-3 shadow-sm">
            <div className="mb-2 flex w-full items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <QrCode className="h-4 w-4 text-brand-primary" /> Thanh toán VietQR
              </h4>
              {hasValidConfig && remaining > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>

            {totalFee === 0 ? (
              <div className="w-full py-4 text-center text-xs font-normal text-rose-600">
                Chưa đóng học phí (Chưa cấu hình học phí)
              </div>
            ) : remaining <= 0 ? (
              <div className="w-full py-5 text-center text-slate-500 text-xs italic">
                {entityLabel.titleCase} đã hoàn tất đóng học phí.
              </div>
            ) : !hasValidConfig ? (
              <div className="w-full space-y-2 py-4 text-center">
                <Info className="mx-auto h-6 w-6 text-amber-500" />
                <p className="text-xs text-slate-500 leading-relaxed px-2">
                  Chưa cấu hình thông tin tài khoản ngân hàng nhận tiền.
                </p>
                <p className="text-[10px] text-slate-400">
                  Vui lòng truy cập trang <strong>Cài đặt ERP</strong> hoặc cấu hình cá nhân để thiết lập VietQR.
                </p>
              </div>
            ) : (
              <div className="w-full space-y-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-normal text-slate-500">Số tiền thanh toán</label>
                  <input
                    type="text"
                    value={paymentAmountInput}
                    onChange={(e) => handleAmountInputChange(e.target.value)}
                    placeholder="Nhập số tiền..."
                    className="w-full rounded-xl border border-sky-100 bg-sky-50/40 px-3 py-2 text-sm font-normal text-slate-800 transition-colors focus:border-brand-primary focus:outline-none"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Còn nợ: {formatVND(remaining)}đ</span>
                    <button onClick={() => { setPaymentAmount(remaining); setPaymentAmountInput(formatVND(remaining)); }} className="font-medium text-brand-primary hover:underline">
                      Đóng hết
                    </button>
                  </div>
                </div>

                <div className="flex w-full flex-col items-center rounded-xl border border-sky-100 bg-sky-50/40 p-2.5">
                  <div className="mb-2 rounded-xl border border-sky-100 bg-white p-1.5">
                    <img src={qrCodeUrl} alt="VietQR Payment Code" className="h-28 w-28 object-contain" />
                  </div>

                  <button onClick={handleDownloadQR} className="mb-2 flex items-center gap-1.5 rounded-lg border border-sky-100 bg-white px-2.5 py-1 text-xs font-normal text-slate-600 transition-colors hover:bg-sky-50 hover:text-brand-primary" title="Tải ảnh mã QR về máy">
                    <Download className="w-3.5 h-3.5" />
                    Tải mã QR
                  </button>

                  <div className="w-full space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ngân hàng:</span>
                      <span className="font-medium text-slate-800">{bankId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số tài khoản:</span>
                      <span className="font-medium text-slate-800">{accountNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Chủ tài khoản:</span>
                      <span className="font-medium text-slate-800">{accountName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số tiền:</span>
                      <span className="font-medium text-brand-primary">{formatVND(paymentAmount)}đ</span>
                    </div>
                    <div className="mt-1 flex flex-col gap-1 border-t border-sky-100 pt-1.5">
                      <span className="text-xs font-normal text-slate-500">Nội dung chuyển khoản</span>
                      <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                        <span className="select-all font-mono text-xs font-normal text-slate-800">{student.id}</span>
                        <button onClick={handleCopyMemo} className="text-slate-400 hover:text-cyan-600 p-0.5 rounded transition-colors" title="Sao chép nội dung">
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-center text-xs leading-normal text-slate-500 italic">
                  * Hệ thống tự động ghi nhận học phí ngay lập tức sau khi nhận được tiền từ ngân hàng.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

interface FeeCardProps {
  label: string;
  amount: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isPaid?: boolean;
  isWarning?: boolean;
}

function FeeCard({ label, amount, icon: Icon, color, isPaid, isWarning }: FeeCardProps) {
  return (
    <div className={cn(
      "relative flex items-center gap-3 overflow-hidden rounded-2xl border border-sky-100 bg-white p-3 shadow-sm",
      isPaid && "border-sky-100 bg-sky-50/40",
      isWarning && "border-rose-100 bg-rose-50/40"
    )}>
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50", color)}>
          <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-normal text-slate-600">{label}</p>
        <p className={cn("whitespace-nowrap text-lg font-medium tracking-tight", color)}>
          {formatVND(amount)}đ
        </p>
      </div>
    </div>
  );
}
