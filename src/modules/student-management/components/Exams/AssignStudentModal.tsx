import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, CheckCircle2, Loader2, Save, CreditCard, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ExamSession } from '../../types';
import { useStudents } from '../../hooks/useStudents';
import { cn, parseVND } from '../../lib/utils';
import { toast } from '../../../../pages/Toast';
import { useAuth } from '../../../../context/AuthContext';
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
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-800">Thêm {entityLabel.singular} vào đợt thi</h3>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 font-medium">
              Đợt thi: <span className="text-cyan-600 font-bold">{exam.name}</span>
              {examSegment ? ` • ${examSegment}` : ''}
            </p>
          </div>

          <div className="p-6 pb-2">
            <div className="relative">
              <input
                type="text"
                placeholder={`Tìm kiếm ${entityLabel.singular} theo tên hoặc hạng...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-slate-50 pl-11 pr-4 rounded-2xl border border-slate-100 text-sm font-medium outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/5 transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <p className="text-[10px] text-rose-500 font-bold mt-2 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Lưu ý: {entityLabel.titleCase} hoàn thành học phí mới được thêm vào đợt thi
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-2">
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
                    'w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left group',
                    selectedStudentIds.includes(student.id) ? 'bg-cyan-50/50 border-cyan-200' : 'bg-white border-slate-100 hover:border-slate-300',
                    !student.isFullyPaid && 'opacity-60 grayscale-[0.5] cursor-not-allowed border-dashed bg-slate-50/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm',
                        selectedStudentIds.includes(student.id) ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-400'
                      )}
                    >
                      {student.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">{student.fullName}</p>
                        {!student.isFullyPaid && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-500 rounded text-[9px] font-black uppercase tracking-tighter border border-rose-100">
                            <AlertCircle className="w-2.5 h-2.5" /> Nợ phí
                          </span>
                        )}
                        {student.isFullyPaid && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase tracking-tighter border border-emerald-100">
                            <CreditCard className="w-2.5 h-2.5" /> Đã đóng đủ
                          </span>
                        )}
                      </div>
                      {student.rank && <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{student.rank}</p>}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'w-6 h-6 rounded-lg border flex items-center justify-center transition-all',
                      selectedStudentIds.includes(student.id)
                        ? 'bg-cyan-600 border-cyan-600'
                        : !student.isFullyPaid
                          ? 'border-slate-200 bg-slate-100'
                          : 'border-slate-200 group-hover:border-slate-400'
                    )}
                  >
                    {selectedStudentIds.includes(student.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                    {!student.isFullyPaid && !selectedStudentIds.includes(student.id) && <X className="w-3 h-3 text-slate-300" />}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-800">
                Đã chọn: <span className="text-cyan-600">{selectedStudentIds.length} {entityLabel.singular}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800">
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedStudentIds.length === 0}
                className="flex items-center gap-2 px-8 py-2.5 bg-cyan-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Xác nhận thêm
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
