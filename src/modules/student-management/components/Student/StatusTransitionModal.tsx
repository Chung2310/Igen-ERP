import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Student, StudentStatus } from '../../types';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getOperationalStatusLabel } from '../../config/workerRecruitmentCopy';

interface StatusTransitionModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusWorkflow: StudentStatus[] = [
  'Chờ KSK',
  'Đã KSK',
  'Đã nộp HS',
  'Đang học',
  'Đang thi',
  'Đã đậu',
  'Thi lại',
  'Nghỉ học'
];

export function StatusTransitionModal({ student, isOpen, onClose }: StatusTransitionModalProps) {
  const entityLabel = useEntityLabel();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feeError, setFeeError] = React.useState<string | null>(null);


  React.useEffect(() => {
    const timer = setTimeout(() => {
      setFeeError(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [student, isOpen]);

  if (!student || !isOpen) return null;

  const studentStatuses = Array.isArray(student.status) ? student.status : [student.status];
  const workflowIndices = studentStatuses
    .map(s => statusWorkflow.indexOf(s as StudentStatus))
    .filter(idx => idx !== -1);
  const currentIndex = workflowIndices.length > 0 ? Math.max(...workflowIndices) : -1;
  const nextStatus = currentIndex !== -1 && currentIndex < statusWorkflow.length - 1
    ? statusWorkflow[currentIndex + 1]
    : null;

  const handleConfirm = async () => {
    if (!nextStatus) return;

    // Kiểm tra học phí nếu chuyển sang "Đang thi"
    if (entityLabel.preset !== 'worker' && entityLabel.preset !== 'customer' && nextStatus === 'Đang thi') {
      const totalFee = parseInt(student.fee.replace(/\D/g, ''), 10) || 0;
      const paidAmount = student.paidAmount || 0;
      if (paidAmount < totalFee) {
        setFeeError(`${entityLabel.titleCase} chưa hoàn tất học phí, không thể chuyển sang trạng thái Đang thi!`);
        return;
      }
    }

    setIsSubmitting(true);
    setFeeError(null);
    try {
      await apiFetch(`/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      window.dispatchEvent(new Event("student-mutation"));
      onClose();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error('Có lỗi xảy ra khi cập nhật trạng thái.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Xác nhận</h3>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="mb-8">
              <p className="text-sm font-medium text-slate-600 mb-2">
                Chuyển bước {entityLabel.singular} <span className="font-bold text-slate-900">{student.fullName}</span>?
              </p>

              {nextStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-400">
                      {(Array.isArray(student.status) ? student.status : [student.status]).map((status) => getOperationalStatusLabel(entityLabel.preset, status)).join(', ')}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                    <span className="text-xs font-bold text-cyan-600">{getOperationalStatusLabel(entityLabel.preset, nextStatus)}</span>
                  </div>
                  {feeError && nextStatus === 'Đang thi' && (
                    <p className="text-[11px] font-bold text-rose-500 bg-rose-50 px-3 py-2 rounded-lg">{feeError}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs italic text-slate-400">{entityLabel.titleCase} đã ở bước cuối cùng của quy trình.</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting || !nextStatus}
                className="flex items-center gap-2 px-8 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-100 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
