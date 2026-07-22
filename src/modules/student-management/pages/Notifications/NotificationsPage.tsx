import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, History, UserCheck, 
  ChevronDown, SendHorizontal,
  AlertCircle, MessageCircle, Smartphone, Mail,
  Inbox, Loader2, CheckCircle2, X, Trash2, Lock,
  Plus, Minus, ToggleLeft, ToggleRight, Banknote, BadgeCheck
} from 'lucide-react';
import { cn, parseVND, getVietQRBankCode } from '../../lib/utils';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../../../context/AuthContext';
import { apiFetch, getAccessToken } from '../../lib/api';
import { BroadcastNotification, Student } from '../../types';
import { toast } from '../../../../pages/Toast';
import { AddPaymentModal } from '../../components/Fees/AddPaymentModal';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface InstallmentPlanItem {
  installmentNo: number;
  percent: number;
  label: string;
}

interface SendResult {
  student: Student;
  status: 'Thành công' | 'Thất bại';
  error?: string;
  installmentAmount?: number;   // Số tiền đợt này (nếu có)
  installmentNo?: number;
  markingPaid?: boolean;        // Loading state khi đang đánh dấu đã thu
  markedPaid?: boolean;         // Đã đánh dấu thành công
}

interface HistoryCardProps {
  key?: string | number;
  notification: BroadcastNotification;
  onDelete: (id: string) => void;
}

// ─── HistoryCard ─────────────────────────────────────────────────────────────

function HistoryCard({ notification, onDelete }: HistoryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  
  let dateObj: Date | null = null;
  if (notification.createdAt) {
    const ca = notification.createdAt as unknown as { toDate?: () => Date };
    if (ca && typeof ca.toDate === 'function') {
      dateObj = ca.toDate();
    } else {
      dateObj = new Date(notification.createdAt);
    }
  }

  const formattedDate = dateObj && !isNaN(dateObj.getTime())
    ? new Intl.DateTimeFormat('vi-VN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj)
    : 'Đang xử lý...';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.id || isDeleting) {
      console.error("Missing notification ID:", notification);
      return;
    }
    
    setIsDeleting(true);
    try {
      await onDelete(notification.id);
    } catch (error) {
      console.error("Delete failed:", error);
      setIsDeleting(false);
      toast.error("Lỗi khi xóa: " + (error instanceof Error ? error.message : "Không rõ nguyên nhân"));
    }
  };

  // Lấy installmentPlan nếu có
  const installmentPlan = (notification as BroadcastNotification & { installmentPlan?: InstallmentPlanItem }).installmentPlan;

  return (
    <div className="p-3 rounded-xl border border-slate-100 hover:border-cyan-100 hover:bg-cyan-50/20 transition-all group relative">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="space-y-0.5">
          <h4 className="text-xs font-black text-slate-800 line-clamp-1 text-left">{notification.title}</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-left">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {installmentPlan && (
            <div className="px-1.5 py-0.5 rounded text-[9px] font-black border bg-violet-50 text-violet-600 border-violet-100/50 flex items-center gap-1">
              <Banknote className="w-2.5 h-2.5" />
              {installmentPlan.label || `Đợt ${installmentPlan.installmentNo}`} · {installmentPlan.percent}%
            </div>
          )}
          <div className={cn(
            "px-2 py-0.5 rounded text-[9px] font-black border",
            notification.status === 'Đã gửi' ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" : "bg-rose-50 text-rose-600 border-rose-100/50"
          )}>
            {notification.status}
          </div>
          <button 
            onClick={handleDelete}
            disabled={isDeleting}
            className={cn(
              "p-1 rounded-lg transition-all active:scale-95 disabled:opacity-50",
              isDeleting ? "bg-slate-100 text-slate-400" : "bg-rose-50 text-rose-500 hover:bg-rose-100"
            )}
            title="Xóa lịch sử"
          >
            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
      
      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2.5 text-left">
        {notification.content}
      </p>

      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100/50">
        <div className="flex items-center gap-1.5">
          {notification.channels.map(channel => (
            <span key={channel} className="px-1.5 py-0.2 bg-slate-100 rounded text-[8px] font-black text-slate-500 uppercase tracking-wider">
              {channel}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <UserCheck className="w-3 h-3 text-slate-400" />
          <span className="text-[9px] font-extrabold text-slate-600">{notification.recipientCount} HV</span>
        </div>
      </div>
    </div>
  );
}

// ─── InstallmentPlanEditor ────────────────────────────────────────────────────

interface InstallmentPlanEditorProps {
  plan: InstallmentPlanItem[];
  onChange: (plan: InstallmentPlanItem[]) => void;
  selectedInstallmentNo: number;
  onSelectInstallmentNo: (no: number) => void;
}

function InstallmentPlanEditor({
  plan,
  onChange,
  selectedInstallmentNo,
  onSelectInstallmentNo,
}: InstallmentPlanEditorProps) {
  const totalPercent = plan.reduce((s, p) => s + p.percent, 0);
  const isOver = totalPercent > 100;

  const addInstallment = () => {
    const nextNo = plan.length + 1;
    const remaining = Math.max(0, 100 - totalPercent);
    onChange([
      ...plan,
      { installmentNo: nextNo, percent: remaining > 0 ? remaining : 10, label: `Đợt ${nextNo}` },
    ]);
    onSelectInstallmentNo(nextNo);
  };

  const removeLastInstallment = () => {
    if (plan.length <= 1) return;
    const newPlan = plan.slice(0, -1);
    onChange(newPlan);
    if (selectedInstallmentNo > newPlan.length) {
      onSelectInstallmentNo(newPlan[newPlan.length - 1].installmentNo);
    }
  };

  const updatePercent = (idx: number, value: number) => {
    const clamped = Math.max(1, Math.min(100, value));
    const updated = plan.map((p, i) => i === idx ? { ...p, percent: clamped } : p);
    onChange(updated);
  };

  const updateLabel = (idx: number, value: string) => {
    const updated = plan.map((p, i) => i === idx ? { ...p, label: value } : p);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Danh sách đợt */}
      <div className="space-y-2">
        {plan.map((item, idx) => (
          <motion.div
            key={item.installmentNo}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer",
              selectedInstallmentNo === item.installmentNo
                ? "bg-violet-50 border-violet-200 shadow-sm shadow-violet-100"
                : "bg-slate-50 border-slate-100 hover:border-violet-100"
            )}
            onClick={() => onSelectInstallmentNo(item.installmentNo)}
          >
            {/* Radio indicator */}
            <div className={cn(
              "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
              selectedInstallmentNo === item.installmentNo
                ? "border-violet-600 bg-violet-600"
                : "border-slate-300"
            )}>
              {selectedInstallmentNo === item.installmentNo && (
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </div>

            {/* Label input */}
            <input
              type="text"
              value={item.label}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateLabel(idx, e.target.value)}
              className="flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none min-w-0"
              placeholder={`Đợt ${item.installmentNo}`}
            />

            {/* Percent input */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); updatePercent(idx, item.percent - 5); }}
                className="w-5 h-5 rounded-md bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors text-xs font-black"
              >−</button>
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  value={item.percent}
                  min={1}
                  max={100}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updatePercent(idx, parseInt(e.target.value) || 0)}
                  className={cn(
                    "w-10 text-center text-xs font-black rounded-lg border px-1 py-0.5 outline-none",
                    isOver ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-violet-700"
                  )}
                />
                <span className="text-[10px] font-black text-slate-500">%</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); updatePercent(idx, item.percent + 5); }}
                className="w-5 h-5 rounded-md bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-300 transition-colors text-xs font-black"
              >+</button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addInstallment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-xl text-[11px] font-black border border-violet-100 hover:bg-violet-100 transition-all active:scale-95"
          >
            <Plus className="w-3 h-3" />
            Thêm đợt
          </button>
          {plan.length > 1 && (
            <button
              type="button"
              onClick={removeLastInstallment}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-500 rounded-xl text-[11px] font-black border border-rose-100 hover:bg-rose-100 transition-all active:scale-95"
            >
              <Minus className="w-3 h-3" />
              Xóa đợt cuối
            </button>
          )}
        </div>

        {/* Tổng % */}
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border",
          isOver
            ? "bg-rose-50 text-rose-600 border-rose-100"
            : totalPercent === 100
            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
            : "bg-amber-50 text-amber-600 border-amber-100"
        )}>
          {isOver ? <AlertCircle className="w-3 h-3" /> : totalPercent === 100 ? <CheckCircle2 className="w-3 h-3" /> : null}
          Tổng: {totalPercent}%
          {totalPercent === 100 && " ✓"}
          {isOver && " — Vượt quá 100%!"}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const { students } = useStudents();
  const { userProfile: user } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState('Tất cả học viên đang học');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [channels, setChannels] = useState<string[]>(['Email']);
  const [history, setHistory] = useState<BroadcastNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Installment state
  const [useInstallment, setUseInstallment] = useState(false);
  const [installmentPlan, setInstallmentPlan] = useState<InstallmentPlanItem[]>([
    { installmentNo: 1, percent: 50, label: 'Đợt 1' },
    { installmentNo: 2, percent: 50, label: 'Đợt 2' },
  ]);
  const [selectedInstallmentNo, setSelectedInstallmentNo] = useState(1);

  const [sendProgress, setSendProgress] = useState<{
    current: number;
    total: number;
    results: SendResult[];
    showModal: boolean;
    isFinishing: boolean;
  }>({
    current: 0,
    total: 0,
    results: [],
    showModal: false,
    isFinishing: false
  });

  const [apiStatus, setApiStatus] = useState<'Checking' | 'Ready' | 'Missing Key' | 'Error'>('Checking');
  const [smsApiStatus, setSmsApiStatus] = useState<'Checking' | 'Ready' | 'Sandbox' | 'Error'>('Checking');
  const [localVietqrConfig] = useState(() => {
    try {
      const cfg = localStorage.getItem("vietqrConfig");
      return cfg ? JSON.parse(cfg) : null;
    } catch (e) {
      console.error("Error parsing vietqrConfig in NotificationBot", e);
      return null;
    }
  });

  const vietqrConfig = {
    enabled: (user as any)?.bankQrEnabled !== false,
    bankId: localVietqrConfig?.bankId || (user as any)?.bankId || '',
    accountNo: localVietqrConfig?.accountNo || (user as any)?.bankAccountNo || '',
    accountName: localVietqrConfig?.accountName || (user as any)?.bankAccountName || user?.displayName || '',
    template: localVietqrConfig?.template || '[Mã HV] - [Họ tên] - Nộp học phí khóa {hang}'
  };
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const checkApiStatus = async () => {
    try {
      const data = await apiFetch('/send-email', {
        method: 'POST',
        body: JSON.stringify({ check: true }) 
      });
      if (data.success && data.status === 'Ready') {
        setApiStatus('Ready');
      } else {
        setApiStatus('Error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('SMTP_CONFIG_missing') || msg.includes('cấu hình') || msg.includes('SMTP')) {
        setApiStatus('Missing Key');
      } else {
        setApiStatus('Error');
      }
    }
  };

  const checkSmsApiStatus = async () => {
    try {
      const token = getAccessToken();
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ check: true })
      });
      if (response.ok) {
        setSmsApiStatus('Ready');
      } else {
        setSmsApiStatus('Error');
      }
    } catch {
      setSmsApiStatus('Error');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      checkApiStatus();
      checkSmsApiStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await apiFetch('/student-notifications');
      if (res.success && res.notifications) {
        const mapped = res.notifications.map((n: Omit<BroadcastNotification, 'id'> & { _id: string }) => ({
          ...n,
          id: n._id,
        })) as BroadcastNotification[];
        setHistory(mapped);
      }
    } catch (error) {
      console.error("Lỗi khi tải lịch sử thông báo:", error);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(() => {
      fetchHistory();
    }, 0);

    const handleMutation = () => {
      fetchHistory();
    };

    window.addEventListener('notification-mutation', handleMutation);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('notification-mutation', handleMutation);
    };
  }, [user, fetchHistory]);

  const toggleChannel = (channel: string) => {
    if (channel === 'Zalo OA' || channel === 'SMS') {
      toast.info('Tính năng đang phát triển');
      return;
    }
    setChannels(prev => 
      prev.includes(channel) 
        ? prev.filter(c => c !== channel) 
        : [...prev, channel]
    );
  };

  const getTargetStudents = () => {
    switch (recipientFilter) {
      case 'Tất cả học viên đang học':
        return students.filter(s => s.status.includes('Đang học'));
      case 'Học viên sắp thi':
        return students.filter(s => s.status.includes('Đang thi') || s.exams?.some(e => e.status === 'Sắp thi'));
      case 'Học viên còn nợ học phí':
        return students.filter(s => {
          const totalFee = parseInt(parseVND(s.fee) || '0');
          return (s.paidAmount || 0) < totalFee;
        });
      case 'Học viên cần thi lại':
        return students.filter(s => s.status.includes('Thi lại'));
      default:
        return [];
    }
  };

  // Tính số tiền đợt hiện tại cho 1 học viên (dựa trên tổng học phí gốc × %)
  const calcInstallmentAmount = (student: Student, percent: number) => {
    const totalFee = parseInt(parseVND(student.fee) || '0');
    return Math.round(totalFee * percent / 100);
  };

  const replaceVariables = (str: string, student: Student, installmentAmount?: number) => {
    const examDate = student.exams?.find(e => e.status === 'Sắp thi')?.date || 
                    (student.status.includes('Đang thi') ? student.examDate : '') || 
                    'Chưa có lịch';
    const totalFee = parseInt(parseVND(student.fee) || '0');
    const debtAmount = totalFee - (student.paidAmount || 0);
    const formattedSotien = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(debtAmount);

    // {tiendot} = số tiền đợt hiện tại
    const dotAmount = installmentAmount ?? Math.round(debtAmount * 0.5);
    const formattedTiendot = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dotAmount);

    // {nhac_dong_phi} = gợi ý văn bản nhắc đóng phí
    const currentInstallment = installmentPlan.find(p => p.installmentNo === selectedInstallmentNo);
    const dotLabel = currentInstallment?.label || `Đợt ${selectedInstallmentNo}`;
    const nhacDongPhi = useInstallment && currentInstallment
      ? `Đề nghị bạn hoàn thành ${formattedTiendot} (${dotLabel} - ${currentInstallment.percent}% học phí). Số dư còn lại sau đợt này: ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.max(0, debtAmount - dotAmount))}.`
      : `Đề nghị bạn hoàn thành toàn bộ ${formattedSotien} học phí còn lại.`;
    
    return str
      .replace(/\{ten\}/g, student.fullName)
      .replace(/\{hang\}/g, student.rank || '')
      .replace(/\{kv\}/g, '')
      .replace(/\{email\}/g, student.email || '')
      .replace(/\{ngaythi\}/g, examDate)
      .replace(/\{sotien\}/g, formattedSotien)
      .replace(/\{tiendot\}/g, formattedTiendot)
      .replace(/\{nhac_dong_phi\}/g, nhacDongPhi);
  };

  const buildQrEmailHtml = (
    student: Student,
    config: { bankId: string; accountNo: string; accountName: string; template: string },
    textContent: string,
    qrAmount: number  // Số tiền QR — có thể là đợt hoặc toàn bộ nợ
  ) => {
    let note = config.template || "Nop hoc phi {ten} {phone}";
    note = note
      .replace(/\[Mã HV\]|\[Ma HV\]|\{id\}|\{ma\}|\{mahv\}/gi, student.id || '')
      .replace(/\[Họ tên\]|\[Ho ten\]|\{ten\}|\{hoten\}/gi, student.fullName || '')
      .replace(/\{phone\}|\{sdt\}/gi, student.phone || '')
      .replace(/\{hang\}|\{rank\}/gi, student.rank || '');

    const objectIdRegex = /[0-9a-fA-F]{24}/;
    if (student.id && !objectIdRegex.test(note)) {
      note = `${note} ${student.id}`.trim();
    }
               
    const removeVietnameseTones = (str: string) => {
      str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a");
      str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e");
      str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i");
      str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o");
      str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u");
      str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y");
      str = str.replace(/đ/g,"d");
      str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g,"A");
      str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g,"E");
      str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g,"I");
      str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g,"O");
      str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g,"U");
      str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g,"Y");
      str = str.replace(/Đ/g,"D");
      str = str.replace(/[^a-zA-Z0-9 ]/g, "");
      return str;
    };
    note = removeVietnameseTones(note);

    const qrUrl = `https://img.vietqr.io/image/${getVietQRBankCode(config.bankId)}-${config.accountNo}-compact2.png?amount=${qrAmount}&addInfo=${encodeURIComponent(note)}&accountName=${encodeURIComponent(config.accountName)}`;
    const formattedAmount = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(qrAmount);

    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #0f172a; margin-bottom: 16px;">Thông báo thanh toán học phí</h2>
        <div style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          ${textContent.replace(/\n/g, "<br/>")}
        </div>
        
        <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Quét mã QR để thanh toán</p>
          <img src="${qrUrl}" alt="Mã QR thanh toán" style="max-width: 250px; height: auto; display: block; margin: 0 auto 15px auto; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />
          <div style="text-align: left; max-width: 300px; margin: 0 auto; font-size: 13px; color: #334155;">
            <p style="margin: 4px 0;"><b>Ngân hàng:</b> ${config.bankId.toUpperCase()}</p>
            <p style="margin: 4px 0;"><b>Số tài khoản:</b> ${config.accountNo}</p>
            <p style="margin: 4px 0;"><b>Chủ tài khoản:</b> ${config.accountName}</p>
            <p style="margin: 4px 0;"><b>Số tiền:</b> <span style="color: #0284c7; font-weight: bold;">${formattedAmount}</span></p>
            <p style="margin: 4px 0;"><b>Nội dung CK:</b> <span style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; color: #0f172a;">${note}</span></p>
          </div>
        </div>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">Email này được gửi tự động từ hệ thống quản lý học phí.</p>
      </div>
    `;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title || !content || channels.length === 0) return;

    // Validate installment plan nếu đang dùng
    if (useInstallment && recipientFilter === 'Học viên còn nợ học phí') {
      const totalPercent = installmentPlan.reduce((s, p) => s + p.percent, 0);
      if (totalPercent > 100) {
        toast.error(`Tổng % các đợt đang là ${totalPercent}%, không được vượt quá 100%.`);
        return;
      }
    }

    const targetStudents = getTargetStudents();
    if (targetStudents.length === 0) {
      toast.warning("Không tìm thấy học viên phù hợp với bộ lọc này.");
      return;
    }

    // Lấy thông tin đợt đang chọn gửi
    const currentInstallment = useInstallment && recipientFilter === 'Học viên còn nợ học phí'
      ? installmentPlan.find(p => p.installmentNo === selectedInstallmentNo)
      : null;

    setIsSubmitting(true);
    setSendProgress({
      current: 0,
      total: targetStudents.length,
      results: [],
      showModal: true,
      isFinishing: false
    });

    try {
      const results: SendResult[] = [];
      for (let i = 0; i < targetStudents.length; i++) {
        const student = targetStudents[i];

        // Tính số tiền đợt (nếu có installment plan)
        const installmentAmount = currentInstallment
          ? calcInstallmentAmount(student, currentInstallment.percent)
          : undefined;

        const personalizedContent = replaceVariables(content, student, installmentAmount);
        const personalizedTitle = replaceVariables(title, student, installmentAmount);
        
        let isSuccess = true;
        let errorMessage = '';

        // Email channel
        if (channels.includes('Email') && student.email) {
          try {
            const hasVietQr = vietqrConfig && vietqrConfig.enabled && vietqrConfig.bankId && vietqrConfig.accountNo;
            const isDebtFilter = recipientFilter === 'Học viên còn nợ học phí';

            let emailHtml: string;
            if (isDebtFilter && hasVietQr) {
              // QR amount = installmentAmount nếu đang gửi theo đợt, ngược lại = toàn bộ nợ
              const totalFee = parseInt(parseVND(student.fee) || '0');
              const debtAmount = totalFee - (student.paidAmount || 0);
              const qrAmount = installmentAmount ?? debtAmount;
              emailHtml = buildQrEmailHtml(student, vietqrConfig, personalizedContent, qrAmount);
            } else {
              emailHtml = personalizedContent.replace(/\n/g, '<br/>');
            }

            const data = await apiFetch('/send-email', {
               method: 'POST',
               body: JSON.stringify({
                 to: student.email,
                 subject: personalizedTitle,
                 html: emailHtml
               })
            });
            if (!data.success) {
              isSuccess = false;
              errorMessage = data.error || 'Lỗi gửi mail';
            }
          } catch (err: unknown) {
            isSuccess = false;
            errorMessage = err instanceof Error ? err.message : 'Lỗi gửi mail';
          }
        }

        // SMS channel
        if (channels.includes('SMS')) {
          try {
            const token = getAccessToken();
            const response = await fetch('/api/send-sms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({
                to: student.phone,
                message: personalizedContent
              })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
              isSuccess = false;
              errorMessage = (errorMessage ? errorMessage + ' & ' : '') + (data.error || 'Lỗi gửi SMS');
            }
          } catch {
            isSuccess = false;
            errorMessage = (errorMessage ? errorMessage + ' & ' : '') + 'Lỗi kết nối server (SMS)';
          }
        }

        // Simulation for other channels (Zalo)
        if (channels.includes('Zalo OA')) {
          await new Promise(resolve => setTimeout(resolve, 300));
          const zaloSuccess = Math.random() < 0.95;
          if (!zaloSuccess) {
            isSuccess = false;
            errorMessage = (errorMessage ? errorMessage + ' & ' : '') + 'Lỗi Zalo OA (Giả lập)';
          }
        }
        
        results.push({
          student,
          status: isSuccess ? 'Thành công' : 'Thất bại',
          error: isSuccess ? undefined : errorMessage,
          installmentAmount,
          installmentNo: currentInstallment?.installmentNo,
        });

        setSendProgress(prev => ({
          ...prev,
          current: i + 1,
          results: [...results]
        }));
      }

      setSendProgress(prev => ({ ...prev, isFinishing: true }));

      // Lưu vào history — kèm installmentPlan và studentIds để backend update trạng thái
      const successStudentIds = results
        .filter(r => r.status === 'Thành công')
        .map(r => r.student.id)
        .filter(Boolean) as string[];

      await apiFetch('/student-notifications', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          recipients: recipientFilter,
          recipientCount: targetStudents.length,
          channels,
          status: 'Đã gửi',
          ...(currentInstallment ? {
            installmentPlan: {
              installmentNo: currentInstallment.installmentNo,
              percent: currentInstallment.percent,
              label: currentInstallment.label,
            },
            studentIds: successStudentIds,
          } : {}),
        }),
      });

      window.dispatchEvent(new Event('notification-mutation'));

      setTitle('');
      setContent('');
    } catch (error) {
      console.error("Error sending notification:", error);
      toast.error("Lỗi khi gửi thông báo: " + (error instanceof Error ? error.message : "Không rõ nguyên nhân"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeResults = () => {
    setSendProgress(prev => ({ ...prev, showModal: false }));
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await apiFetch(`/student-notifications/${id}`, {
        method: 'DELETE',
      });
      window.dispatchEvent(new Event('notification-mutation'));
      toast.success("Đã xóa lịch sử thông báo!");
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Không thể xóa thông báo này. Vui lòng thử lại.");
    }
  };

  // Đánh dấu đã thu đợt cho học viên trong danh sách kết quả
  const handleMarkInstallmentPaid = async (resultIdx: number) => {
    const result = sendProgress.results[resultIdx];
    if (!result || !result.installmentNo || result.markingPaid || result.markedPaid) return;

    // Optimistic update — show loading
    setSendProgress(prev => ({
      ...prev,
      results: prev.results.map((r, i) => i === resultIdx ? { ...r, markingPaid: true } : r)
    }));

    try {
      await apiFetch(`/students/${result.student.id}/installment/${result.installmentNo}/mark-paid`, {
        method: 'PATCH',
      });
      setSendProgress(prev => ({
        ...prev,
        results: prev.results.map((r, i) => i === resultIdx ? { ...r, markingPaid: false, markedPaid: true } : r)
      }));
      toast.success(`Đã đánh dấu đã thu đợt ${result.installmentNo} cho ${result.student.fullName}!`);
    } catch (error) {
      setSendProgress(prev => ({
        ...prev,
        results: prev.results.map((r, i) => i === resultIdx ? { ...r, markingPaid: false } : r)
      }));
      toast.error("Không thể đánh dấu đã thu: " + (error instanceof Error ? error.message : "Lỗi không xác định"));
    }
  };

  const recipientCounts = {
    'Tất cả học viên đang học': students.filter(s => s.status.includes('Đang học')).length,
    'Học viên sắp thi': students.filter(s => s.status.includes('Đang thi') || s.exams?.some(e => e.status === 'Sắp thi')).length,
    'Học viên còn nợ học phí': students.filter(s => (s.paidAmount || 0) < parseInt(parseVND(s.fee) || '0')).length,
    'Học viên cần thi lại': students.filter(s => s.status.includes('Thi lại')).length,
  };

  const currentRecipientCount = recipientCounts[recipientFilter as keyof typeof recipientCounts] || 0;

  // Thông tin đợt đang chọn gửi
  const currentInstallment = useInstallment && recipientFilter === 'Học viên còn nợ học phí'
    ? installmentPlan.find(p => p.installmentNo === selectedInstallmentNo)
    : null;

  const templates = [
    {
      name: 'Nhắc phí',
      title: 'THÔNG BÁO HOÀN THÀNH HỌC PHÍ - {ten}',
      content: 'Kính gửi học viên {ten}, Trung tâm xin thông báo học phí khóa học hạng {hang} của bạn hiện vẫn còn nợ {sotien}. {nhac_dong_phi} Để đảm bảo tiến độ học tập và dự thi đúng hạn, bạn vui lòng hoàn tất học phí trong tuần này. Trân trọng.'
    },
    {
      name: 'Lịch thi',
      title: 'THÔNG BÁO LỊCH THI SÁT HẠCH - {ten}',
      content: 'Kính gửi học viên {ten}, Trung tâm xin thông báo lịch thi sát hạch hạng {hang} của bạn đã có vào ngày {ngaythi}. Bạn vui lòng có mặt đúng giờ và mang theo CCCD bản gốc để làm thủ tục dự thi. Chúc bạn thi tốt.'
    },
    {
      name: 'Thi lại',
      title: 'LỊCH THI LẠI & ÔN TẬP - {ten}',
      content: 'Kính gửi học viên {ten}, Trung tâm đã sắp xếp lịch ôn tập và thi lại cho bạn khóa hạng {hang} tại trung tâm. Vui lòng liên hệ văn phòng để xác nhận lịch thi dự kiến kế tiếp. Cố gắng lên bạn nhé.'
    }
  ];

  const applyTemplate = (tpl: typeof templates[0]) => {
    setTitle(tpl.title);
    setContent(tpl.content);
  };

  const isDebtFilter = recipientFilter === 'Học viên còn nợ học phí';
  const totalInstallmentPercent = installmentPlan.reduce((s, p) => s + p.percent, 0);

  return (
    <div className="space-y-6">
      {/* Send Progress Modal */}
      <AnimatePresence>
        {sendProgress.showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Kết quả gửi thông báo</h3>
                  <p className="text-slate-500 text-xs font-bold mt-1">Đang xử lý: {sendProgress.current}/{sendProgress.total} học viên</p>
                  {currentInstallment && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-lg text-[10px] font-black border border-violet-200">
                        {currentInstallment.label} · {currentInstallment.percent}% học phí gốc
                      </span>
                    </div>
                  )}
                </div>
                {!isSubmitting && (
                  <button onClick={closeResults} className="p-2 bg-white text-slate-400 hover:text-slate-600 rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="p-8 space-y-6 flex-1 overflow-y-auto">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Tiến độ</span>
                    <span>{Math.round((sendProgress.current / sendProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                    <motion.div 
                      className={cn(
                        "h-full rounded-full",
                        currentInstallment ? "bg-violet-500" : "bg-cyan-600"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Results List */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Danh sách phản hồi</p>
                  <div className="space-y-1.5 min-h-[200px]">
                    {sendProgress.results.slice().reverse().map((res, i) => {
                      // index trong mảng gốc (chưa reverse)
                      const originalIdx = sendProgress.results.length - 1 - i;
                      return (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border text-xs font-bold gap-2",
                            res.status === 'Thành công' ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" : "bg-rose-50/50 border-rose-100 text-rose-700"
                          )}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {res.status === 'Thành công' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                            <div className="min-w-0">
                              <span className="truncate block">{res.student.fullName}</span>
                              {res.installmentAmount !== undefined && (
                                <span className="text-[10px] text-violet-600 font-black">
                                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(res.installmentAmount)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Nút đánh dấu đã thu (chỉ khi thành công + có đợt + chưa mark) */}
                            {res.status === 'Thành công' && isDebtFilter && res.installmentNo && !res.markedPaid && (
                              <button
                                type="button"
                                onClick={() => handleMarkInstallmentPaid(originalIdx)}
                                disabled={res.markingPaid}
                                className={cn(
                                  "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black transition-all active:scale-95",
                                  res.markingPaid
                                    ? "bg-slate-100 text-slate-400"
                                    : "bg-violet-600 hover:bg-violet-700 text-white"
                                )}
                              >
                                {res.markingPaid ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />}
                                {res.markingPaid ? "..." : "Đã thu"}
                              </button>
                            )}
                            {res.markedPaid && (
                              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <BadgeCheck className="w-3 h-3" /> Đã thu
                              </span>
                            )}
                            {/* Nút đánh dấu đã thu (thanh toán manual — không có đợt) */}
                            {res.status === 'Thành công' && isDebtFilter && !res.installmentNo && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentForPayment(res.student);
                                  setIsPaymentModalOpen(true);
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] rounded-lg transition-colors font-black active:scale-95"
                              >
                                Đánh dấu đã thu
                              </button>
                            )}
                            <span className="text-[10px] uppercase opacity-60">
                              {res.status} {res.error ? `- ${res.error}` : ''}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {!isSubmitting && (
                <div className="p-8 bg-slate-50 border-t border-slate-100">
                  <button 
                    onClick={closeResults}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg shadow-slate-200 hover:bg-black transition-all active:scale-95"
                  >
                    Hoàn tất
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight text-left">BOT Thông báo</h1>
          <p className="text-slate-400 text-[11px] font-medium mt-0.5 text-left">Gửi thông báo tự động đến học viên</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* Composer */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/30">
            <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
              <SendHorizontal className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">Soạn thông báo</h3>
          </div>

          <form onSubmit={handleSend} className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left block">Đối tượng nhận</label>
              <div className="relative group">
                <select 
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  className="w-full h-8 bg-slate-50 px-3 pr-8 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-800 outline-none appearance-none focus:border-cyan-600 transition-all text-left"
                >
                  <option>Tất cả học viên đang học</option>
                  <option>Học viên sắp thi</option>
                  <option>Học viên còn nợ học phí</option>
                  <option>Học viên cần thi lại</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* ── Installment Plan Section ── */}
            <AnimatePresence>
              {isDebtFilter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-lg border border-violet-100 bg-violet-50/40 space-y-3">
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => setUseInstallment(v => !v)}
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-black text-violet-800">Thu học phí theo đợt</span>
                      </div>
                      <div className={cn("transition-colors", useInstallment ? "text-violet-600" : "text-slate-300")}>
                        {useInstallment
                          ? <ToggleRight className="w-8 h-8" />
                          : <ToggleLeft className="w-8 h-8" />
                        }
                      </div>
                    </button>

                    {/* Plan editor */}
                    <AnimatePresence>
                      {useInstallment && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-3 pt-1"
                        >
                          <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">
                            Cấu hình đợt · Chọn đợt muốn gửi thông báo lần này
                          </p>
                          <InstallmentPlanEditor
                            plan={installmentPlan}
                            onChange={setInstallmentPlan}
                            selectedInstallmentNo={selectedInstallmentNo}
                            onSelectInstallmentNo={setSelectedInstallmentNo}
                          />
                          {/* Summary */}
                          {currentInstallment && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-100/60 border border-violet-200/50">
                              <Send className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                              <p className="text-xs font-black text-violet-700">
                                Sẽ gửi thông báo cho <b>{currentInstallmentCount()}</b> học viên với QR số tiền = <b>{currentInstallment.percent}%</b> tổng học phí gốc ({currentInstallment.label})
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left block">Tiêu đề</label>
              <input 
                type="text" 
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề thông báo..."
                className="w-full h-8 bg-slate-50 px-3 rounded-lg border border-slate-200 text-[11px] font-medium outline-none focus:border-cyan-600 transition-all text-left"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left block">Nội dung</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Mẫu:</span>
                  <div className="flex gap-1">
                    {templates.map(tpl => (
                      <button 
                        key={tpl.name}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="px-1.5 py-0.5 bg-cyan-50 text-cyan-600 text-[9px] font-bold rounded border border-cyan-100 hover:bg-cyan-600 hover:text-white transition-all"
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="relative">
                <textarea 
                  required
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nội dung thông báo..."
                  className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-medium outline-none focus:border-cyan-600 transition-all min-h-[140px] resize-none text-left pb-24"
                />
                <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-lg bg-white/80 border border-slate-100 backdrop-blur-sm">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 text-left">Biến dùng được:</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    <VariableTag name="ten" label="Tên" />
                    <VariableTag name="hang" label="Hạng" />
                    <VariableTag name="kv" label="KV" />
                    <VariableTag name="email" label="Email" />
                    <VariableTag name="ngaythi" label="Ngày thi" />
                    <VariableTag name="sotien" label="Tổng nợ" />
                    <VariableTag name="tiendot" label="Tiền đợt" highlight={useInstallment && isDebtFilter} />
                    <VariableTag name="nhac_dong_phi" label="Gợi ý đóng phí" highlight={useInstallment && isDebtFilter} />
                  </div>
                </div>
              </div>
            </div>

            {isDebtFilter && channels.includes('Email') && (
              <div className="text-xs font-bold text-left">
                {vietqrConfig && vietqrConfig.enabled && vietqrConfig.bankId && vietqrConfig.accountNo ? (
                  <div className="flex items-center gap-2 text-cyan-700 bg-cyan-50/50 border border-cyan-100/50 p-3.5 rounded-2xl">
                    <Smartphone size={16} className="text-cyan-600 flex-shrink-0" />
                    <span>
                      📲 Mã QR chuyển khoản sẽ được chèn vào thư điện tử.
                      {useInstallment && currentInstallment
                        ? ` Số tiền QR = ${currentInstallment.percent}% học phí gốc (${currentInstallment.label}).`
                        : ' Số tiền QR = toàn bộ nợ còn lại.'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50/50 border border-amber-100/50 p-3.5 rounded-2xl">
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                    <span>⚠️ Chưa cấu hình mã QR chuyển khoản hoặc tính năng này đang tắt. Thư điện tử sẽ chỉ có văn bản thông thường. Vào Cài đặt để kích hoạt.</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left block">Kênh gửi</label>
                  <div className="flex items-center gap-4">
                    {channels.includes('Email') && (
                      <div className="flex items-center gap-1.5 border-r border-slate-100 pr-4">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Dịch vụ gửi Email :</span>
                        {apiStatus === 'Checking' && <Loader2 className="w-2.5 h-2.5 text-slate-400 animate-spin" />}
                        {apiStatus === 'Ready' && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-wider">
                              <CheckCircle2 size={8} /> Sẵn sàng
                            </span>
                          </div>
                        )}
                        {apiStatus === 'Missing Key' && <span className="text-[9px] font-black text-rose-500 uppercase">Thiếu Key</span>}
                        {apiStatus === 'Error' && <span className="text-[9px] font-black text-amber-500 uppercase">Lỗi</span>}
                      </div>
                    )}
                    {channels.includes('SMS') && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Dịch vụ gửi tin nhắn SMS :</span>
                        {smsApiStatus === 'Checking' && <Loader2 className="w-2.5 h-2.5 text-slate-400 animate-spin" />}
                        {smsApiStatus === 'Ready' && (
                          <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-wider">
                            <CheckCircle2 size={8} /> Sẵn sàng
                          </span>
                        )}
                        {smsApiStatus === 'Error' && <span className="text-[9px] font-black text-rose-500 uppercase">Chưa cấu hình</span>}
                      </div>
                    )}
                  </div>
                </div>
                {channels.includes('Email') && apiStatus === 'Ready' && (
                  <p className="text-[9px] text-slate-400 font-medium italic text-right">* Dịch vụ gửi thư: Gửi thư điện tử không giới hạn qua tài khoản của bạn.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <button 
                  type="button"
                  onClick={() => toggleChannel('Email')}
                  className="flex items-center gap-2 group cursor-pointer"
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                    channels.includes('Email') ? "bg-cyan-600 border-cyan-600" : "border-slate-300 group-hover:border-slate-400"
                  )}>
                    {channels.includes('Email') && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">EMAIL</span>
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => toggleChannel('Zalo OA')}
                  className="flex items-center gap-2 group cursor-pointer opacity-60 hover:opacity-80 transition-opacity"
                  title="Tính năng đang phát triển"
                >
                  <div className="w-5 h-5 rounded-md border border-slate-300 flex items-center justify-center bg-slate-50">
                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">ZALO OA</span>
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Sắp có</span>
                  </div>
                </button>

                <button 
                  type="button"
                  onClick={() => toggleChannel('SMS')}
                  className="flex items-center gap-2 group cursor-pointer opacity-60 hover:opacity-80 transition-opacity"
                  title="Tính năng đang phát triển"
                >
                  <div className="w-5 h-5 rounded-md border border-slate-300 flex items-center justify-center bg-slate-50">
                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">SMS</span>
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Sắp có</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-50">
              <p className="text-[11px] font-bold text-cyan-600 bg-cyan-50 px-3 py-1.5 rounded-full">
                Sẽ gửi đến: <span className="font-black underline underline-offset-4">{currentRecipientCount} học viên</span>
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  type="submit"
                  disabled={isSubmitting || channels.length === 0 || currentRecipientCount === 0 || (useInstallment && totalInstallmentPercent > 100)}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 px-6 py-2 rounded-lg text-[11px] font-black shadow-md transition-all disabled:opacity-50 active:scale-95",
                    useInstallment && isDebtFilter
                      ? "bg-violet-600 text-white shadow-violet-100 hover:bg-violet-700"
                      : "bg-cyan-600 text-white shadow-cyan-100 hover:bg-cyan-700"
                  )}
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {useInstallment && currentInstallment
                    ? `Gửi ${currentInstallment.label}`
                    : 'Gửi hàng loạt'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>

        {/* History */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col"
        >
          <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2 bg-slate-50/30">
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <History className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">Lịch sử thông báo</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingHistory ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-xs font-medium">Đang nạp lịch sử...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-12">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-slate-200" />
                </div>
                <p className="text-xs font-bold tracking-tight">Chưa có thông báo nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <HistoryCard key={item.id} notification={item} onDelete={handleDeleteNotification} />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {isPaymentModalOpen && selectedStudentForPayment && (
        <AddPaymentModal
          student={selectedStudentForPayment}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedStudentForPayment(null);
          }}
          onSuccess={() => {
            window.dispatchEvent(new Event('student-mutation'));
          }}
        />
      )}
    </div>
  );

  // Helper — số học viên nợ phí (dùng trong summary installment)
  function currentInstallmentCount() {
    return students.filter(s => (s.paidAmount || 0) < parseInt(parseVND(s.fee) || '0')).length;
  }
}

function VariableTag({ name, label, highlight = false }: { name: string, label: string, highlight?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 group cursor-help px-2 py-1 rounded-lg border transition-all",
      highlight
        ? "bg-violet-50 border-violet-200"
        : "bg-slate-50 border-slate-100"
    )}>
      <span className={cn(
        "text-[11px] font-black leading-none",
        highlight ? "text-violet-600" : "text-cyan-600"
      )}>{"{" + name + "}"}</span>
      <span className="text-[10px] font-extrabold text-slate-400 tracking-tight"> - {label}</span>
    </div>
  );
}
