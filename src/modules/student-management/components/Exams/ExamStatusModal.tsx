import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Clock, Save, Loader2, Calendar } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ExamSession, ExamStatus } from '../../types';
import { cn } from '../../lib/utils';
import { toast } from '../../../../pages/Toast';

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
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xl font-extrabold text-slate-800">Cập nhật trạng thái</h3>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8 overflow-y-auto max-h-[80vh]">
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.1em]">Chọn trạng thái đợt thi</label>
              <div className="grid grid-cols-1 gap-3">
                {statuses.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedStatus(item.value)}
                    className={cn(
                      "flex items-center justify-between p-5 rounded-3xl border-2 transition-all text-left group",
                      selectedStatus === item.value 
                        ? "bg-white border-cyan-600 shadow-xl shadow-cyan-100/50" 
                        : "bg-white border-slate-50 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-active:scale-95", item.color)}>
                        <item.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className={cn("text-base font-extrabold", selectedStatus === item.value ? "text-cyan-600" : "text-slate-700")}>
                          {item.label}
                        </p>
                        <p className="text-xs font-bold text-slate-400 mt-1">Thay đổi tiến độ đợt thi</p>
                      </div>
                    </div>
                    {selectedStatus === item.value && (
                      <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center animate-in zoom-in duration-300">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-[0.1em]">Ngày thi chính thức (Nếu có)</label>
              <div className="relative">
                <input
                  type="date"
                  value={officialDate.includes('/') ? officialDate.split('/').reverse().join('-') : officialDate}
                  onChange={(e) => setOfficialDate(e.target.value)}
                  className="w-full h-14 bg-slate-50 px-5 rounded-2xl border border-slate-100 text-base font-bold text-slate-800 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all appearance-none"
                />
                <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-14 bg-slate-100 text-slate-600 rounded-2xl text-base font-black hover:bg-slate-200 transition-all active:scale-95"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-[2] flex items-center justify-center gap-3 h-14 bg-cyan-600 text-white rounded-2xl text-base font-black shadow-xl shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50"
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
