import React, { useState } from 'react';
import { CreditCard, History, Trash2, Pencil, Zap, AlertCircle, QrCode, Copy, Check, Info, Download } from 'lucide-react';
import { Student } from '../../../types';
import { cn, formatVND, parseVND, getVietQRBankCode } from '../../../lib/utils';
import { useAuth } from '../../../../../context/AuthContext';
import { useEntityLabel } from '../../../hooks/useEntityLabel';

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
  const paid = student.paidAmount || 0;
  const remaining = totalFee - paid;

  const [paymentAmount, setPaymentAmount] = useState<number>(remaining > 0 ? remaining : 0);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>(formatVND(remaining > 0 ? remaining : 0));
  const [copied, setCopied] = useState(false);
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
    setVietqrConfig({
      enabled: localConfig?.enabled ?? ((user as any)?.bankQrEnabled !== false),
      bankId: localConfig?.bankId || (user as any)?.bankId || '',
      accountNo: localConfig?.accountNo || (user as any)?.bankAccountNo || '',
      accountName: localConfig?.accountName || (user as any)?.bankAccountName || user?.displayName || ''
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeeCard label={feeLabel} amount={totalFee} icon={CreditCard} color="text-slate-800" />
        <FeeCard label="Đã đóng" amount={paid} icon={CreditCard} color="text-emerald-600" isPaid />
        <FeeCard label="Còn nợ" amount={remaining} icon={AlertCircle} color="text-rose-600" isWarning />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-500" /> Nhật ký đóng phí
          </h3>
          
          {undoState && (
            <div className="mb-4 flex items-center justify-between p-3 bg-slate-800 text-white rounded-xl text-xs font-bold shadow-lg animate-in slide-in-from-top-2">
              <span className="flex-1 pr-4">{undoState.message}</span>
              <button onClick={handleUndoPayment} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 active:scale-95 rounded-lg transition-all shrink-0">
                Hoàn tác
              </button>
            </div>
          )}

          <div className="space-y-3">
            {(student.paymentHistory || []).length > 0 ? (
              student.paymentHistory?.map((p, idx) => (
                <div key={idx} className="group relative flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-500 shadow-sm border border-slate-100 shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700">Thanh toán đợt {idx + 1}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{p.date} • {p.method}</p>
                      {p.note && <p className="text-[10px] text-slate-400 italic mt-0.5 max-w-[200px] truncate" title={p.note}>Ghi chú: {p.note}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-800">{formatVND(p.amount)}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{p.recipient}</p>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleStartEditPayment(p, idx)} className="p-2 bg-white hover:bg-cyan-50 border border-slate-200 hover:border-cyan-200 text-slate-500 hover:text-cyan-600 rounded-xl transition-all shadow-sm active:scale-90" title="Sửa giao dịch">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeletePaymentClick(p, idx)} className="p-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 rounded-xl transition-all shadow-sm active:scale-90" title="Xóa giao dịch">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 opacity-30">
                <History className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-xs font-bold text-slate-400 italic">Chưa có lịch sử thanh toán.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-500" /> Thanh toán VietQR
              </h4>
              {hasValidConfig && remaining > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>

            {totalFee === 0 ? (
              <div className="w-full py-8 text-center text-rose-500/80 text-xs font-bold italic">
                Chưa đóng học phí (Chưa cấu hình học phí)
              </div>
            ) : remaining <= 0 ? (
              <div className="w-full py-8 text-center text-slate-400 text-xs italic">
                {entityLabel.titleCase} đã hoàn tất đóng học phí.
              </div>
            ) : !hasValidConfig ? (
              <div className="w-full py-6 text-center space-y-3">
                <Info className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs text-slate-500 leading-relaxed px-2">
                  Chưa cấu hình thông tin tài khoản ngân hàng nhận tiền.
                </p>
                <p className="text-[10px] text-slate-400">
                  Vui lòng truy cập trang <strong>Cài đặt ERP</strong> hoặc cấu hình cá nhân để thiết lập VietQR.
                </p>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Số tiền thanh toán</label>
                  <input
                    type="text"
                    value={paymentAmountInput}
                    onChange={(e) => handleAmountInputChange(e.target.value)}
                    placeholder="Nhập số tiền..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                    <span>Còn nợ: {formatVND(remaining)}đ</span>
                    <button onClick={() => { setPaymentAmount(remaining); setPaymentAmountInput(formatVND(remaining)); }} className="text-cyan-600 hover:underline font-bold">
                      Đóng hết
                    </button>
                  </div>
                </div>

                <div className="w-full bg-slate-50 rounded-2xl p-4 flex flex-col items-center border border-slate-100 shadow-inner">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm mb-3">
                    <img src={qrCodeUrl} alt="VietQR Payment Code" className="w-36 h-36 object-contain" />
                  </div>

                  <button onClick={handleDownloadQR} className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-cyan-600 rounded-xl text-[10px] font-bold transition-all shadow-sm mb-3 active:scale-95" title="Tải ảnh mã QR về máy">
                    <Download className="w-3.5 h-3.5" />
                    Tải mã QR
                  </button>

                  <div className="w-full space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ngân hàng:</span>
                      <span className="font-bold text-slate-800 uppercase">{bankId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số tài khoản:</span>
                      <span className="font-bold text-slate-800">{accountNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Chủ tài khoản:</span>
                      <span className="font-bold text-slate-800">{accountName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số tiền:</span>
                      <span className="font-bold text-cyan-600">{formatVND(paymentAmount)}đ</span>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200/60 mt-1 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Nội dung chuyển khoản</span>
                      <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                        <span className="font-mono text-[10px] font-black text-slate-800 tracking-wider select-all">{student.id}</span>
                        <button onClick={handleCopyMemo} className="text-slate-400 hover:text-cyan-600 p-0.5 rounded transition-colors" title="Sao chép nội dung">
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-normal text-center italic">
                  * Hệ thống tự động ghi nhận học phí ngay lập tức sau khi nhận được tiền từ ngân hàng.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-500 mb-4 shadow-inner shadow-cyan-100/50">
              <Zap className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Thông tin đóng phí</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[180px]">{entityLabel.titleCase} cần hoàn tất học phí trước ngày thi sát hạch 15 ngày.</p>

            <div className="w-full mt-6 space-y-3">
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
                  <div className={cn("p-3 rounded-xl text-left border shadow-sm", bgColor)}>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái hiện tại</p>
                    <p className={cn("text-xs font-black mt-1", statusColor)}>
                      {statusLabel}
                    </p>
                  </div>
                );
              })()}
              <button className="w-full py-3 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition-all active:scale-95 shadow-lg shadow-cyan-100 mt-2">
                Nhắc nhở đóng phí
              </button>
            </div>
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
      "bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden",
      isPaid && "bg-emerald-50/20 border-emerald-100",
      isWarning && "bg-rose-50/20 border-rose-100"
    )}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">{label}</p>
      </div>
      <p className={cn("text-2xl font-black tracking-tight whitespace-nowrap", color)}>
        {formatVND(amount)}đ
      </p>
    </div>
  );
}
