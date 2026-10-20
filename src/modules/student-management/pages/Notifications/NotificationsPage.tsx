import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, History, UserCheck, 
  SendHorizontal,
  AlertCircle, MessageCircle, Smartphone, Mail,
  Inbox, Loader2, CheckCircle2, X, Trash2, Lock,
  Plus, Minus, ToggleLeft, ToggleRight, Banknote, BadgeCheck, Check
} from 'lucide-react';
import { cn, parseVND, getVietQRBankCode } from '../../lib/utils';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../../../context/AuthContext';
import { useBranch } from '../../../../context/BranchContext';
import { apiFetch, getAccessToken } from '../../lib/api';
import { BroadcastNotification, Student } from '../../types';
import { toast } from '../../../../pages/Toast';
import { getApiErrorMessage } from '../../../../utils/errorMessage';
import { AddPaymentModal } from '../../components/Fees/AddPaymentModal';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getWorkerOperationalCopy } from '../../config/workerRecruitmentCopy';
import { PartnerFormDropdown } from '../Partners/components/PartnerFormDropdown';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface InstallmentPlanItem {
  installmentNo: number;
  percent: number;
  label: string;
  dueDate: string;
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
  onDelete?: (id: string) => void;
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
    if (!notification.id || isDeleting || !onDelete) {
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
    <div className="group relative rounded-xl border border-slate-200 p-3 transition-colors hover:border-cyan-200 hover:bg-cyan-50/20">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="space-y-0.5">
          <h4 className="line-clamp-1 text-sm font-medium text-slate-800 text-left">{notification.title}</h4>
          <p className="text-[11px] font-normal text-slate-500 text-left">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {installmentPlan && (
            <div className="flex items-center gap-1 rounded-md border border-cyan-100 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
              <Banknote className="w-2.5 h-2.5" />
              {installmentPlan.label || `Đợt ${installmentPlan.installmentNo}`} · {installmentPlan.percent}%
            </div>
          )}
          <div className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium",
            notification.status === 'Đã gửi' ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" : "bg-rose-50 text-rose-600 border-rose-100/50"
          )}>
            {notification.status}
          </div>
          {onDelete && <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50",
              isDeleting ? "border-slate-200 bg-slate-50 text-slate-400" : "border-rose-100 bg-white text-rose-500 hover:bg-rose-50"
            )}
            title="Xóa lịch sử"
            aria-label="Xóa lịch sử thông báo"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>}
        </div>
      </div>
      
      <p className="mb-2.5 line-clamp-2 text-xs leading-relaxed text-slate-600 text-left">
        {notification.content}
      </p>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
        <div className="flex items-center gap-1.5">
          {notification.channels.map(channel => (
            <span key={channel} className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-normal text-slate-600">
              {channel}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <UserCheck className="w-3 h-3 text-slate-400" />
          <span className="text-xs font-normal text-slate-600">{notification.recipientCount} HV</span>
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
      { installmentNo: nextNo, percent: remaining > 0 ? remaining : 10, label: `Đợt ${nextNo}`, dueDate: '' },
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

  const updateDueDate = (idx: number, value: string) => {
    onChange(plan.map((p, i) => i === idx ? { ...p, dueDate: value } : p));
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
              "flex items-center gap-2 rounded-lg border p-2 transition-colors cursor-pointer",
              selectedInstallmentNo === item.installmentNo
                ? "border-cyan-200 bg-cyan-50/50"
                : "border-slate-200 bg-white hover:border-cyan-200"
            )}
            onClick={() => onSelectInstallmentNo(item.installmentNo)}
          >
            {/* Radio indicator */}
            <div className={cn(
              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
              selectedInstallmentNo === item.installmentNo
                ? "border-cyan-600 bg-cyan-600"
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
              className="min-w-0 flex-1 bg-transparent text-sm font-normal text-slate-700 outline-none"
              placeholder={`Đợt ${item.installmentNo}`}
            />

            {/* Percent input */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); updatePercent(idx, item.percent - 5); }}
                aria-label="Giảm tỷ lệ đợt"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
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
                    "h-8 w-12 rounded-lg border px-1 text-center text-xs font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100",
                    isOver ? "border-rose-300 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-700"
                  )}
                />
                <span className="text-xs font-normal text-slate-500">%</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); updatePercent(idx, item.percent + 5); }}
                aria-label="Tăng tỷ lệ đợt"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
              >+</button>
            </div>
            <input
              type="date"
              value={item.dueDate}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateDueDate(idx, e.target.value)}
              aria-label={`Hạn thanh toán đợt ${item.installmentNo}`}
              lang="vi"
              className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-2 text-xs font-normal text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addInstallment}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-cyan-100 bg-cyan-50 px-3 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-100"
          >
            <Plus className="w-3 h-3" />
            Thêm đợt
          </button>
          {plan.length > 1 && (
            <button
              type="button"
              onClick={removeLastInstallment}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-500 transition-colors hover:bg-rose-50"
              aria-label="Xóa đợt cuối"
              title="Xóa đợt cuối"
            >
              <Minus className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tổng % */}
        <div className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium",
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

export function NotificationsPage({ canManage = true }: { canManage?: boolean }) {
  const { students } = useStudents();
  const { userProfile: user } = useAuth();
  const { activeBranchId } = useBranch();
  const entityLabel = useEntityLabel();
  const operationalCopy = getWorkerOperationalCopy(entityLabel.preset);
  
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
    { installmentNo: 1, percent: 50, label: 'Đợt 1', dueDate: '' },
    { installmentNo: 2, percent: 50, label: 'Đợt 2', dueDate: '' },
  ]);
  const [selectedInstallmentNo, setSelectedInstallmentNo] = useState(1);

  useEffect(() => {
    if (operationalCopy.isWorker || operationalCopy.isCustomer) {
      setRecipientFilter(operationalCopy.notificationAudienceLabel);
      setUseInstallment(false);
    }
  }, [operationalCopy.isWorker, operationalCopy.isCustomer, operationalCopy.notificationAudienceLabel]);

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

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const insertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const variableString = `{${varName}}`;
    const newContent = text.substring(0, start) + variableString + text.substring(end);
    setContent(newContent);

    // Focus back and place cursor after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variableString.length;
    }, 0);
  };

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
  }, [activeBranchId]);

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
      case 'Tất cả lao động':
      case 'Tất cả khách hàng':
        return students;
      case 'Tất cả học viên đang học':
        return students.filter(s => s.status.includes('Đang học'));
      case 'Học viên sắp thi':
        return students.filter(s => s.status.includes('Đang thi') || s.exams?.some(e => e.status === 'Sắp thi'));
      case 'Học viên còn nợ học phí':
        return students.filter(s => {
          const totalFee = parseInt(parseVND(s.fee) || '0');
          return (s.paidAmount || 0) < totalFee;
        });
      case 'Học viên cần học lại':
      case 'Học viên cần thi lại':
        return students.filter(s => {
          const statuses = Array.isArray(s.status) ? s.status : (s.status ? [s.status] : []);
          return statuses.some(st => ['Thi lại', 'Học lại', 'Cần học lại'].includes(st));
        });
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
      toast.warning(`Không tìm thấy ${entityLabel.singular} phù hợp với bộ lọc này.`);
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
              dueDate: currentInstallment.dueDate || undefined,
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
      toast.error(getApiErrorMessage(error, "Không thể xóa thông báo này. Vui lòng thử lại."));
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
    'Tất cả lao động': students.length,
    'Tất cả khách hàng': students.length,
    'Tất cả học viên đang học': students.filter(s => s.status.includes('Đang học')).length,
    'Học viên sắp thi': students.filter(s => s.status.includes('Đang thi') || s.exams?.some(e => e.status === 'Sắp thi')).length,
    'Học viên còn nợ học phí': students.filter(s => (s.paidAmount || 0) < parseInt(parseVND(s.fee) || '0')).length,
    'Học viên cần học lại': students.filter(s => {
      const statuses = Array.isArray(s.status) ? s.status : (s.status ? [s.status] : []);
      return statuses.some(st => ['Thi lại', 'Học lại', 'Cần học lại'].includes(st));
    }).length,
    'Học viên cần thi lại': students.filter(s => {
      const statuses = Array.isArray(s.status) ? s.status : (s.status ? [s.status] : []);
      return statuses.some(st => ['Thi lại', 'Học lại', 'Cần học lại'].includes(st));
    }).length,
  };

  const currentRecipientCount = recipientCounts[recipientFilter as keyof typeof recipientCounts] || 0;

  // Thông tin đợt đang chọn gửi
  const currentInstallment = useInstallment && recipientFilter === 'Học viên còn nợ học phí'
    ? installmentPlan.find(p => p.installmentNo === selectedInstallmentNo)
    : null;

  const educationTemplates = [
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
      name: 'Học lại',
      title: 'LỊCH HỌC LẠI & ÔN TẬP - {ten}',
      content: 'Kính gửi học viên {ten}, Trung tâm đã sắp xếp lịch ôn tập và học lại cho bạn khóa học {hang} tại trung tâm. Vui lòng liên hệ văn phòng để xác nhận lịch học dự kiến kế tiếp. Cố gắng lên bạn nhé.'
    }
  ];
  const workerTemplates = [
    {
      name: 'Lịch phỏng vấn',
      title: 'THÔNG BÁO LỊCH PHỎNG VẤN - {ten}',
      content: 'Kính gửi {ten}, công ty xin thông báo lịch phỏng vấn của bạn. Vui lòng kiểm tra thời gian, địa điểm trong nội dung được cung cấp và có mặt đúng giờ. Khi cần hỗ trợ, vui lòng liên hệ cán bộ phụ trách. Trân trọng.',
    },
    {
      name: 'Bổ sung hồ sơ',
      title: 'YÊU CẦU BỔ SUNG HỒ SƠ - {ten}',
      content: 'Kính gửi {ten}, hồ sơ tuyển dụng của bạn hiện cần được bổ sung. Vui lòng liên hệ cán bộ phụ trách để hoàn thiện giấy tờ đúng thời hạn. Trân trọng.',
    },
    {
      name: 'Nhận việc',
      title: 'THÔNG BÁO NHẬN VIỆC - {ten}',
      content: 'Kính gửi {ten}, công ty xin thông báo kế hoạch nhận việc của bạn. Vui lòng chuẩn bị đầy đủ giấy tờ và có mặt theo thời gian, địa điểm đã được hướng dẫn. Trân trọng.',
    },
  ];
  const customerTemplates = [
    {
      name: 'Lịch hẹn',
      title: 'THÔNG BÁO LỊCH HẸN - {ten}',
      content: 'Kính gửi khách hàng {ten}, chúng tôi xin thông báo lịch hẹn phục vụ của quý khách. Vui lòng kiểm tra thời gian và địa điểm trong nội dung được cung cấp. Khi cần hỗ trợ, quý khách vui lòng liên hệ nhân viên phụ trách. Trân trọng.',
    },
    {
      name: 'Thông tin dịch vụ',
      title: 'THÔNG TIN DỊCH VỤ - {ten}',
      content: 'Kính gửi khách hàng {ten}, chúng tôi gửi đến quý khách thông tin cập nhật về dịch vụ đang sử dụng. Vui lòng liên hệ nhân viên phụ trách nếu quý khách cần tư vấn hoặc hỗ trợ thêm. Trân trọng.',
    },
    {
      name: 'Chăm sóc khách hàng',
      title: 'CHĂM SÓC KHÁCH HÀNG - {ten}',
      content: 'Kính gửi khách hàng {ten}, cảm ơn quý khách đã sử dụng dịch vụ. Chúng tôi mong nhận được phản hồi để tiếp tục nâng cao chất lượng phục vụ. Trân trọng.',
    },
  ];
  const templates = operationalCopy.isWorker
    ? workerTemplates
    : operationalCopy.isCustomer
      ? customerTemplates
      : educationTemplates;

  const applyTemplate = (tpl: typeof templates[0]) => {
    setTitle(tpl.title);
    setContent(tpl.content);
  };

  const isDebtFilter = recipientFilter === 'Học viên còn nợ học phí';
  const totalInstallmentPercent = installmentPlan.reduce((s, p) => s + p.percent, 0);

  return (
    <div className="space-y-4">
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
              className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-cyan-500" aria-hidden="true" />
                  <div>
                    <h3 className="text-base font-medium text-slate-900">Kết quả gửi thông báo</h3>
                    <p className="mt-1 text-xs font-normal text-slate-500">Đang xử lý: {sendProgress.current}/{sendProgress.total} {entityLabel.singular}</p>
                    {currentInstallment && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-md border border-cyan-100 bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700">
                          {currentInstallment.label} · {currentInstallment.percent}% học phí gốc
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {!isSubmitting && (
                  <button onClick={closeResults} aria-label="Đóng kết quả gửi" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-normal text-slate-500">
                    <span>Tiến độ</span>
                    <span>{Math.round((sendProgress.current / sendProgress.total) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
                  <p className="text-sm font-medium text-slate-700">Danh sách phản hồi</p>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto">
                    {sendProgress.results.slice().reverse().map((res, i) => {
                      // index trong mảng gốc (chưa reverse)
                      const originalIdx = sendProgress.results.length - 1 - i;
                      return (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs font-normal",
                            res.status === 'Thành công' ? "bg-emerald-50/50 border-emerald-100 text-emerald-700" : "bg-rose-50/50 border-rose-100 text-rose-700"
                          )}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {res.status === 'Thành công' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
                            <div className="min-w-0">
                              <span className="truncate block">{res.student.fullName}</span>
                              {res.installmentAmount !== undefined && (
                                <span className="text-[11px] font-medium text-cyan-700">
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
                                  "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                                  res.markingPaid
                                    ? "bg-slate-100 text-slate-400"
                                    : "bg-cyan-600 text-white hover:bg-cyan-700"
                                )}
                              >
                                {res.markingPaid ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />}
                                {res.markingPaid ? "..." : "Đã thu"}
                              </button>
                            )}
                            {res.markedPaid && (
                              <span className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
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
                                className="rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-cyan-700"
                              >
                                Đánh dấu đã thu
                              </button>
                            )}
                            <span className="text-[11px] font-normal opacity-70">
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
                <div className="border-t border-slate-100 bg-white px-5 py-4">
                  <button 
                    onClick={closeResults}
                    className="h-10 w-full rounded-lg bg-cyan-600 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
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
          <h1 className="text-xl font-medium tracking-tight text-slate-900 text-left">BOT Thông báo</h1>
          <p className="text-slate-400 text-[11px] font-medium mt-0.5 text-left">{operationalCopy.notificationSubtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {/* Composer */}
        {canManage && <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="rounded-lg bg-cyan-50 p-1.5 text-cyan-600">
              <SendHorizontal className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-medium text-slate-800">Soạn thông báo</h3>
          </div>

          <form onSubmit={handleSend} className="space-y-3 p-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 text-left">Đối tượng nhận</label>
              <PartnerFormDropdown
                label="Đối tượng nhận"
                value={recipientFilter}
                onChange={setRecipientFilter}
                options={operationalCopy.isWorker || operationalCopy.isCustomer
                  ? [{ value: operationalCopy.notificationAudienceLabel, label: operationalCopy.notificationAudienceLabel }]
                  : [
                      { value: 'Tất cả học viên đang học', label: 'Tất cả học viên đang học' },
                      { value: 'Học viên sắp thi', label: 'Học viên sắp thi' },
                      { value: 'Học viên còn nợ học phí', label: 'Học viên còn nợ học phí' },
                      { value: 'Học viên cần học lại', label: 'Học viên cần học lại' },
                    ]}
              />
            </div>

            {/* ── Installment Plan Section ── */}
            <AnimatePresence>
              {!operationalCopy.isWorker && !operationalCopy.isCustomer && isDebtFilter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 rounded-lg border border-cyan-100 bg-cyan-50/40 p-3">
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => setUseInstallment(v => !v)}
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-cyan-100 p-1.5 text-cyan-700">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-cyan-800">Thu học phí theo đợt</span>
                      </div>
                      <div className={cn("transition-colors", useInstallment ? "text-cyan-600" : "text-slate-300")}>
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
                          <p className="text-xs font-medium text-cyan-700">
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
                              <div className="flex items-center gap-2 rounded-lg border border-cyan-100 bg-cyan-50 p-3">
                              <Send className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                              <p className="text-xs font-normal text-cyan-800">
                                Sẽ gửi thông báo cho <span className="font-medium">{currentInstallmentCount()}</span> học viên với QR số tiền = <span className="font-medium">{currentInstallment.percent}%</span> tổng học phí gốc ({currentInstallment.label})
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
              <label className="block text-xs font-medium text-slate-600 text-left">Tiêu đề</label>
              <input 
                type="text" 
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề thông báo..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 text-left"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600 text-left">Nội dung</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-normal text-slate-500">Mẫu:</span>
                  <div className="flex gap-1">
                    {templates.map(tpl => (
                      <button 
                        key={tpl.name}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="rounded-md border border-cyan-100 bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-700 transition-colors hover:bg-cyan-600 hover:text-white"
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <textarea 
                  ref={textareaRef}
                  required
                  rows={5}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nội dung thông báo..."
                  className="min-h-[120px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal text-slate-700 outline-none transition-colors focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 text-left"
                />
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600 text-left">Biến dùng được (Nhấp để chèn)</p>
                  <div className="flex flex-wrap gap-1.5">
                    <VariableTag name="ten" label="Tên" onClick={() => insertVariable('ten')} />
                    <VariableTag name="email" label="Email" onClick={() => insertVariable('email')} />
                    {!operationalCopy.isWorker && !operationalCopy.isCustomer && (
                      <>
                        <VariableTag name="hang" label="Hạng" onClick={() => insertVariable('hang')} />
                        <VariableTag name="kv" label="KV" onClick={() => insertVariable('kv')} />
                        <VariableTag name="ngaythi" label="Ngày thi" onClick={() => insertVariable('ngaythi')} />
                        <VariableTag name="sotien" label="Tổng nợ" onClick={() => insertVariable('sotien')} />
                        <VariableTag name="tiendot" label="Tiền đợt" highlight={useInstallment && isDebtFilter} onClick={() => insertVariable('tiendot')} />
                        <VariableTag name="nhac_dong_phi" label="Gợi ý đóng phí" highlight={useInstallment && isDebtFilter} onClick={() => insertVariable('nhac_dong_phi')} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {isDebtFilter && channels.includes('Email') && (
              <div className="text-xs font-normal text-left">
                {vietqrConfig && vietqrConfig.enabled && vietqrConfig.bankId && vietqrConfig.accountNo ? (
                  <div className="flex items-center gap-2 rounded-lg border border-cyan-100 bg-cyan-50/50 p-3 text-cyan-700">
                    <Smartphone size={16} className="text-cyan-600 flex-shrink-0" />
                    <span>
                      📲 Mã QR chuyển khoản sẽ được chèn vào thư điện tử.
                      {useInstallment && currentInstallment
                        ? ` Số tiền QR = ${currentInstallment.percent}% học phí gốc (${currentInstallment.label}).`
                        : ' Số tiền QR = toàn bộ nợ còn lại.'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-amber-700">
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                    <span>⚠️ Chưa cấu hình mã QR chuyển khoản hoặc tính năng này đang tắt. Thư điện tử sẽ chỉ có văn bản thông thường. Vào Cài đặt để kích hoạt.</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-600 text-left">Kênh gửi</label>
                  <div className="flex items-center gap-4">
                    {channels.includes('Email') && (
                      <div className="flex items-center gap-1.5 border-r border-slate-100 pr-4">
                        <span className="text-[11px] font-normal text-slate-500">Dịch vụ gửi Email:</span>
                        {apiStatus === 'Checking' && <Loader2 className="w-2.5 h-2.5 text-slate-400 animate-spin" />}
                        {apiStatus === 'Ready' && (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                              <CheckCircle2 size={8} /> Sẵn sàng
                            </span>
                          </div>
                        )}
                        {apiStatus === 'Missing Key' && <span className="text-[11px] font-medium text-rose-600">Thiếu Key</span>}
                        {apiStatus === 'Error' && <span className="text-[11px] font-medium text-amber-600">Lỗi</span>}
                      </div>
                    )}
                    {channels.includes('SMS') && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-normal text-slate-500">Dịch vụ gửi tin nhắn SMS:</span>
                        {smsApiStatus === 'Checking' && <Loader2 className="w-2.5 h-2.5 text-slate-400 animate-spin" />}
                        {smsApiStatus === 'Ready' && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle2 size={8} /> Sẵn sàng
                          </span>
                        )}
                        {smsApiStatus === 'Error' && <span className="text-[11px] font-medium text-rose-600">Chưa cấu hình</span>}
                      </div>
                    )}
                  </div>
                </div>
                {channels.includes('Email') && apiStatus === 'Ready' && (
                  <p className="text-[11px] font-normal italic text-slate-500 text-right">* Dịch vụ gửi thư: Gửi thư điện tử không giới hạn qua tài khoản của bạn.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <button 
                  type="button"
                  onClick={() => toggleChannel('Email')}
                  className="flex items-center gap-2 group cursor-pointer"
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                    channels.includes('Email') ? "bg-cyan-600 border-cyan-600" : "border-slate-300 group-hover:border-slate-400"
                  )}>
                    {channels.includes('Email') && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-rose-500" />
                    <span className="text-sm font-medium text-slate-700">Email</span>
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
                    <span className="text-sm font-medium text-slate-500">Zalo OA</span>
                    <span className="rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">Sắp có</span>
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
                    <span className="text-sm font-medium text-slate-500">SMS</span>
                    <span className="rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[10px] font-normal text-amber-700">Sắp có</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-3 sm:flex-row">
              <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs font-normal text-cyan-700">
                Sẽ gửi đến: <span className="font-medium">{currentRecipientCount} {entityLabel.singular}</span>
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  type="submit"
                  disabled={isSubmitting || channels.length === 0 || currentRecipientCount === 0 || (useInstallment && totalInstallmentPercent > 100)}
                  className={cn(
                    "flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto",
                    useInstallment && isDebtFilter
                      ? "bg-cyan-700 hover:bg-cyan-800"
                      : "bg-cyan-600 hover:bg-cyan-700"
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
        </motion.div>}

        {/* History */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex min-h-[400px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="rounded-lg bg-orange-50 p-1.5 text-orange-600">
              <History className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-medium text-slate-800">Lịch sử thông báo</h3>
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
                <p className="text-sm font-normal text-slate-500">Chưa có thông báo nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <HistoryCard key={item.id} notification={item} onDelete={canManage ? handleDeleteNotification : undefined} />
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

function VariableTag({ name, label, highlight = false, onClick }: { name: string, label: string, highlight?: boolean, onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-colors cursor-pointer",
        highlight
          ? "border-cyan-200 bg-cyan-50 hover:bg-cyan-100"
          : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/40"
      )}
      title="Nhấp để chèn biến này vào nội dung"
    >
      <span className={cn(
        "text-[11px] font-medium leading-none",
        highlight ? "text-cyan-700" : "text-cyan-600"
      )}>{"{" + name + "}"}</span>
      <span className="text-[11px] font-normal text-slate-600"> - {label}</span>
    </button>
  );
}
