import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Clock, Save, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ExamSession, ExamStatus } from '../../types';
import { cn } from '../../lib/utils';
import { toast } from '../../../../pages/Toast';
import { VietnameseDatePicker } from '../Batches/VietnameseDatePicker';

interface ExamStatusModalProps {
  exam: ExamSession | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExamStatusModal({ exam, isOpen, onClose, onSuccess }: ExamStatusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ExamStatus | ''>(exam?.status || '');
  const [officialDate, setOfficialDate] = useState(exam?.officialDate || '');
  

  // Update local state when exam changes - deferred to avoid synchronous setState in effect
  React.useEffect(() => {
    if (exam) {
      const timer = setTimeout(() => {
        setSelectedStatus(exam.status);
        setOfficialDate(exam.officialDate || '');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [exam]);

  if (!isOpen || !exam) return null;

  const statuses: { value: ExamStatus; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'Sắp diễn ra', label: 'Sắp diễn ra', icon: Clock, color: 'text-amber-500 bg-amber-50 border-amber-100' },
    { value: 'Đã xác nhận', label: 'Đã xác nhận', icon: CheckCircle2, color: 'text-blue-500 bg-blue-50 border-blue-100' },
    { value: 'Đã hoàn thành', label: 'Đã hoàn thành', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 border-emerald-100' },
    { value: 'Đã hủy', label: 'Đã hủy', icon: X, color: 'text-rose-500 bg-rose-50 border-rose-100' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) return;

    setIsSubmitting(true);
    try {
      const updateData: { status: ExamStatus; officialDate?: string } = {
        status: selectedStatus,
      };

      if (officialDate) {
        if (officialDate.includes('-')) {
          const parts = officialDate.split('-');
          updateData.officialDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
          updateData.officialDate = officialDate;
        }
      }

      await apiFetch(`/exams/${exam.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      window.dispatchEvent(new Event("exam-mutation"));
      toast.success("Cập nhật trạng thái đợt thi thành công!");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error("Error updating exam status:", error);
      toast.error(error instanceof Error ? error.message : "Lỗi cập nhật trạng thái đợt thi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
        >
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-medium text-slate-900 before:w-1 before:h-5 before:rounded-full before:bg-brand-primary">Cập nhật trạng thái</h3>
            <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
            <div className="space-y-2">
              <label className="text-sm text-slate-700">Chọn trạng thái đợt thi</label>
              <div className="grid grid-cols-1 gap-2">
                {statuses.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedStatus(item.value)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-colors text-left group",
                      selectedStatus === item.value 
                        ? "bg-sky-50 border-brand-primary"
                        : "bg-white border-slate-200 hover:border-sky-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", item.color)}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={cn("text-sm font-medium", selectedStatus === item.value ? "text-brand-primary" : "text-slate-700")}>
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500">Thay đổi tiến độ đợt thi</p>
                      </div>
                    </div>
                    {selectedStatus === item.value && (
                      <div className="w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-700">Ngày thi chính thức (nếu có)</label>
              <VietnameseDatePicker ariaLabel="Ngày thi chính thức" value={officialDate.includes('/') ? officialDate.split('/').reverse().join('-') : officialDate} onChange={setOfficialDate} selectionOnly variant="filter" />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 h-10 px-4 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
