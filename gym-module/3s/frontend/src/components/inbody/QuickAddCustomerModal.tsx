import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Sparkles, User, UserPlus, X } from 'lucide-react';
import { api } from '../../services/api';
import { errorMessage, fieldErrors, type Customer } from '../../types';
import { useToast } from '../ui/ToastProvider';

export interface QuickCustomerInitialData {
  fullName?: string | null;
  height?: number | null;
  initialWeight?: number | null;
  assignedPtId?: string | null;
}

interface QuickAddCustomerModalProps {
  open: boolean;
  initialData?: QuickCustomerInitialData;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export default function QuickAddCustomerModal({
  open,
  initialData,
  onClose,
  onCreated,
}: QuickAddCustomerModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('OTHER');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [height, setHeight] = useState('');
  const [initialWeight, setInitialWeight] = useState('');
  const [initialGoal, setInitialGoal] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync initialData when modal opens
  useEffect(() => {
    if (open) {
      setFullName(initialData?.fullName?.trim() || '');
      setHeight(initialData?.height != null ? String(initialData.height) : '');
      setInitialWeight(initialData?.initialWeight != null ? String(initialData.initialWeight) : '');
      setPhone('');
      setGender('OTHER');
      setDateOfBirth('');
      setInitialGoal('');
      setInternalNotes('Tạo nhanh từ phiếu đo InBody');
      setClientErrors({});
      setTimeout(() => {
        if (!initialData?.fullName?.trim()) {
          nameInputRef.current?.focus();
        }
      }, 50);
    }
  }, [open, initialData]);

  // Handle ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const cleanName = fullName.trim();
    if (!cleanName) {
      errs.fullName = 'Vui lòng nhập họ và tên học viên.';
    } else if (cleanName.length < 2) {
      errs.fullName = 'Họ tên phải có ít nhất 2 ký tự.';
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      errs.phone = 'Vui lòng nhập số điện thoại.';
    } else if (!/^[0-9+]{9,15}$/.test(cleanPhone)) {
      errs.phone = 'Số điện thoại không hợp lệ (9 đến 15 chữ số).';
    }

    if (height.trim() && (isNaN(Number(height)) || Number(height) <= 0)) {
      errs.height = 'Chiều cao phải là số dương.';
    }

    if (initialWeight.trim() && (isNaN(Number(initialWeight)) || Number(initialWeight) <= 0)) {
      errs.initialWeight = 'Cân nặng phải là số dương.';
    }

    setClientErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!validate() || loading) return;

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender,
        status: 'ACTIVE',
      };

      if (dateOfBirth) payload.dateOfBirth = dateOfBirth;
      if (height.trim()) payload.height = Number(height);
      if (initialWeight.trim()) payload.initialWeight = Number(initialWeight);
      if (initialGoal.trim()) payload.initialGoal = initialGoal.trim();
      if (internalNotes.trim()) payload.internalNotes = internalNotes.trim();
      if (initialData?.assignedPtId) payload.assignedPtId = initialData.assignedPtId;

      const res = await api.post<Customer>('/api/customers', payload);
      toast.success(res.message || `Đã thêm học viên ${res.data.fullName} thành công!`);
      onCreated(res.data);
      onClose();
    } catch (error) {
      const serverFieldErrors = fieldErrors(error);
      if (Object.keys(serverFieldErrors).length > 0) {
        setClientErrors(serverFieldErrors);
      }
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  const modalContent = (
    <div
      className="fixed inset-0 z-[10005] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-customer-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto relative"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/50 via-white to-sky-50/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 id="quick-customer-modal-title" className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                Thêm Nhanh Học Viên Mới
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tạo hồ sơ học viên ngay và tự động gán kết quả đo InBody vừa quét.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Đóng modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* AI Pre-fill Badge */}
        {(initialData?.fullName || initialData?.height || initialData?.initialWeight) && (
          <div className="mx-6 mt-4 p-2.5 rounded-xl bg-sky-50/80 border border-sky-200/80 flex items-center gap-2 text-xs text-sky-800">
            <Sparkles size={16} className="text-sky-600 shrink-0" />
            <span>
              Hệ thống đã tự động trích xuất thông tin từ phiếu đo InBody. Bạn chỉ cần bổ sung số điện thoại của học viên.
            </span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 text-left">
          {/* Row 1: Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Họ và tên học viên <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={nameInputRef}
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (clientErrors.fullName) setClientErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                placeholder="vd: Nguyễn Văn An"
                className={`w-full px-3.5 py-2 text-sm rounded-xl border ${
                  clientErrors.fullName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:border-sky-500'
                } focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition-all`}
                required
              />
              <User size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
            </div>
            {clientErrors.fullName && (
              <p className="text-xs text-rose-500 mt-1">{clientErrors.fullName}</p>
            )}
          </div>

          {/* Row 2: Phone & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số điện thoại <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (clientErrors.phone) setClientErrors((prev) => ({ ...prev, phone: '' }));
                }}
                placeholder="vd: 0912345678"
                className={`w-full px-3.5 py-2 text-sm rounded-xl border ${
                  clientErrors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:border-sky-500'
                } focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition-all`}
                required
              />
              {clientErrors.phone && (
                <p className="text-xs text-rose-500 mt-1">{clientErrors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Giới tính
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                      gender === g
                        ? 'bg-white text-sky-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {g === 'MALE' ? 'Nam' : g === 'FEMALE' ? 'Nữ' : 'Khác'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Height, Initial Weight, Date of Birth */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chiều cao (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={height}
                onChange={(e) => {
                  setHeight(e.target.value);
                  if (clientErrors.height) setClientErrors((prev) => ({ ...prev, height: '' }));
                }}
                placeholder="vd: 170"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cân nặng (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={initialWeight}
                onChange={(e) => {
                  setInitialWeight(e.target.value);
                  if (clientErrors.initialWeight) setClientErrors((prev) => ({ ...prev, initialWeight: '' }));
                }}
                placeholder="vd: 65.5"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày sinh
              </label>
              <input
                type="date"
                max={todayStr}
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
            </div>
          </div>

          {/* Row 4: Initial Goal & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mục tiêu ban đầu
              </label>
              <input
                type="text"
                value={initialGoal}
                onChange={(e) => setInitialGoal(e.target.value)}
                placeholder="vd: Giảm mỡ, tăng cơ, cải thiện vóc dáng"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú nội bộ
              </label>
              <input
                type="text"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="vd: Khách mới đo thử nghiệm InBody"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-sky-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 transition-all"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-xl shadow-md shadow-sky-600/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang tạo...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Tạo & Chọn học viên</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
