import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, CheckCircle2, Loader2, Save, CreditCard, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ExamSession } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { cn, parseVND } from '../../lib/utils';
import { toast } from '../../../../pages/Toast';
import { getExamSegmentLabel, isStudentEligibleForExamRank } from '../../pages/Exams/exam-utils';
import { useEntityLabel } from '../../hooks/useEntityLabel';

interface AssignStudentModalProps {
  exam: ExamSession | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignStudentModal({ exam, isOpen, onClose, onSuccess }: AssignStudentModalProps) {
  const entityLabel = useEntityLabel();
  const { students, loading } = useStudents();
  const businessType = 'general';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  

  if (!isOpen || !exam) return null;

  const eligibleStudents = students
    .filter(student => {
      const matchesRank = isStudentEligibleForExamRank(businessType, exam.rank, student.rank);
      const notInExam = !student.examId;
      const matchesSearch =
        student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.rank || '').toLowerCase().includes(searchQuery.toLowerCase());

      return matchesRank && notInExam && matchesSearch;
    })
    .map(student => {
      const totalFee = parseInt(parseVND(student.fee)) || 0;
      const paidAmount = student.paidAmount || 0;
      const isFullyPaid = paidAmount >= totalFee;
      return { ...student, isFullyPaid };
    });

  const toggleStudent = (student: { id: string; isFullyPaid: boolean }) => {
    if (!student.isFullyPaid) return;
    setSelectedStudentIds(prev => (prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]));
  };

  const handleSubmit = async () => {
    if (selectedStudentIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await apiFetch(`/exams/${exam.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });

      window.dispatchEvent(new Event('student-mutation'));
      window.dispatchEvent(new Event('exam-mutation'));

      toast.success(`Đã thêm ${selectedStudentIds.length} ${entityLabel.singular} vào đợt thi thành công!`);
      onSuccess();
      onClose();
      setSelectedStudentIds([]);
    } catch (error: unknown) {
      console.error('Error assigning students:', error);
      toast.error(error instanceof Error ? error.message : `Lỗi gán ${entityLabel.singular} vào đợt thi.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const examSegment = getExamSegmentLabel(businessType, exam.rank);

  return (
    <AnimatePresence>
      <div key="assign-student-portal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="flex items-center gap-2 text-base font-medium text-slate-900 before:w-1 before:h-5 before:rounded-full before:bg-brand-primary">Thêm {entityLabel.singular} vào đợt thi</h3>
              <button type="button" onClick={onClose} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Đợt thi: <span className="text-brand-primary">{exam.name}</span>
              {examSegment ? ` • ${examSegment}` : ''}
            </p>
          </div>

          <div className="p-4 pb-3">
            <div className="relative">
              <input
                type="text"
                placeholder={`Tìm kiếm ${entityLabel.singular} theo tên hoặc hạng...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 bg-white pl-10 pr-4 rounded-xl border border-sky-100 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition-colors"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-xs text-rose-600 mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Lưu ý: {entityLabel.titleCase} hoàn thành học phí mới được thêm vào đợt thi
            </p>
          </div>

          <div className="mx-4 mb-3 min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 md:mx-5">
            {loading ? (
              <div className="py-10 text-center text-slate-400 italic text-sm">Đang nạp danh sách {entityLabel.singular}...</div>
            ) : eligibleStudents.length === 0 ? (
              <div className="py-10 text-center text-slate-400 italic text-sm">Không tìm thấy {entityLabel.singular} phù hợp.</div>
            ) : (
              eligibleStudents.map((student) => (
                <button
                  key={student.id}
                  onClick={() => toggleStudent(student)}
                  disabled={!student.isFullyPaid}
                  className={cn(
                    'group flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                    selectedStudentIds.includes(student.id) ? 'bg-sky-50' : 'bg-white hover:bg-slate-50',
                    !student.isFullyPaid && 'cursor-not-allowed bg-slate-50/50 opacity-60'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium',
                        selectedStudentIds.includes(student.id) ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-400'
                      )}
                    >
                      {student.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-xs md:text-sm font-medium text-slate-800">{student.fullName}</p>
                        {!student.isFullyPaid && (
                          <span className="flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[11px] text-rose-600">
                            <AlertCircle className="w-2.5 h-2.5" /> Nợ phí
                          </span>
                        )}
                        {student.isFullyPaid && (
                          <span className="flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-600">
                            <CreditCard className="w-2.5 h-2.5" /> Đã đóng đủ
                          </span>
                        )}
                      </div>
                      {student.rank && <p className="text-xs text-slate-500">{student.rank}</p>}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all',
                      selectedStudentIds.includes(student.id)
                        ? 'bg-cyan-600 border-cyan-600'
                        : !student.isFullyPaid
                          ? 'border-slate-200 bg-slate-100'
                          : 'border-slate-200 group-hover:border-slate-400'
                    )}
                  >
                    {selectedStudentIds.includes(student.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    {!student.isFullyPaid && !selectedStudentIds.includes(student.id) && <X className="w-2.5 h-2.5 text-slate-300" />}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-4 md:px-6 md:py-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
            <div>
              <p className="text-xs md:text-sm text-slate-700 text-center sm:text-left">
                Đã chọn: <span className="text-brand-primary">{selectedStudentIds.length} {entityLabel.singular}</span>
              </p>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2.5">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedStudentIds.length === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Xác nhận thêm
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
