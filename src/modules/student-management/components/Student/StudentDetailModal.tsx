import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Printer, FileText, CreditCard, History, ScanFace
} from 'lucide-react';
import { Student } from '../../types';
import { apiFetch } from '../../lib/api';
import { cn, toDisplayDate } from '../../lib/utils';

import { toast } from '../../../../pages/Toast';
import { useAuth } from '../../../../context/AuthContext';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { getWorkerOperationalCopy } from '../../config/workerRecruitmentCopy';


import { ProfileTab } from './DetailTabs/ProfileTab';
import { TuitionTab } from './DetailTabs/TuitionTab';
import { EditPaymentModal } from './DetailTabs/EditPaymentModal';
import { FaceEnrollmentTab } from './DetailTabs/FaceEnrollmentTab';
import { QualityTab } from './DetailTabs/QualityTab';

interface StudentDetailModalProps {
  student: Student | null;
  selectedCenter?: string;
  onClose: () => void;
  initialTab?: TabType;
}

type TabType = 'Hồ sơ' | 'Học phí' | 'Khuôn mặt' | 'Lịch sử học tập' | 'Lịch sử';

export function StudentDetailModal({ student: initialStudent, selectedCenter, onClose, initialTab = 'Hồ sơ' }: StudentDetailModalProps) {
  const { userProfile: user } = useAuth();
  const entityLabel = useEntityLabel();
  const operationalCopy = getWorkerOperationalCopy(entityLabel.preset);

  const [student, setStudent] = React.useState<Student | null>(initialStudent);
  const [activeTab, setActiveTab] = React.useState<TabType>(initialTab);

  interface EditingPaymentState {
    index: number;
    id: string;
    amount: string;
    date: string;
    note: string;
    method: 'Tiền mặt' | 'Chuyển khoản';
    recipient: string;
  }
  const [editingPayment, setEditingPayment] = React.useState<EditingPaymentState | null>(null);
  const [undoState, setUndoState] = React.useState<{ history: any[], message: string } | null>(null);

  const fetchStudentDetail = React.useCallback(async () => {
    if (!initialStudent?.id) return;
    try {
      const res = await apiFetch(`/students/${initialStudent.id}`);
      if (res.success && res.student) {
        setStudent({ ...res.student, id: res.student._id || res.student.id });
      }
    } catch (error) {
      console.error("Error fetching student detail:", error);
    }
  }, [initialStudent]);

  // Sync realtime data
  React.useEffect(() => {
    if (!initialStudent?.id) {
      const timer = setTimeout(() => {
        setStudent(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Set initially so it doesn't flicker
    const timer = setTimeout(() => {
      setStudent(initialStudent);
      fetchStudentDetail();
    }, 0);

    const handleMutation = () => {
      fetchStudentDetail();
    };

    window.addEventListener("student-mutation", handleMutation);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("student-mutation", handleMutation);
    };
  }, [initialStudent, fetchStudentDetail]);

  const tabs: TabType[] = operationalCopy.isWorker || operationalCopy.isCustomer
    ? ['Hồ sơ', 'Lịch sử']
    : ['Hồ sơ', 'Lịch sử học tập', 'Học phí', 'Lịch sử'];

  // Nếu tab đang mở không còn khả dụng thì quay về Hồ sơ
  React.useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab('Hồ sơ');
    }
  }, [activeTab]);

  const handleStartEditPayment = (p: NonNullable<Student['paymentHistory']>[number], idx: number) => {
    setEditingPayment({
      index: idx,
      id: p.id,
      amount: new Intl.NumberFormat('vi-VN').format(p.amount),
      date: p.date,
      note: p.note || '',
      method: p.method,
      recipient: p.recipient || 'Hệ thống'
    });
  };

  const handleUndoPayment = async () => {
    if (!student || !undoState) return;
    try {
      await apiFetch(`/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentHistory: undoState.history })
      });
      toast.success('Đã hoàn tác giao dịch thành công!');
      
      setStudent({ ...student, paymentHistory: undoState.history });
      setUndoState(null);
      
      window.dispatchEvent(new Event("payment-mutation"));
      window.dispatchEvent(new Event('student-mutation'));
      
      fetchStudentDetail();
    } catch (error) {
      console.error("Undo error:", error);
      toast.error('Lỗi hoàn tác: ' + (error instanceof Error ? error.message : 'Không xác định'));
    }
  };

  const handleSavePaymentEdit = async () => {
    if (!student || !student.paymentHistory || !editingPayment) return;

    const parsedAmount = parseInt(editingPayment.amount.replace(/\D/g, ''), 10) || 0;
    if (parsedAmount <= 0) {
      toast.warning('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    try {
      const oldHistory = [...student.paymentHistory];
      const updatedHistory = [...student.paymentHistory];
      updatedHistory[editingPayment.index] = {
        ...updatedHistory[editingPayment.index],
        amount: parsedAmount,
        date: toDisplayDate(editingPayment.date),
        method: editingPayment.method,
        note: editingPayment.note,
        recipient: editingPayment.recipient
      };

      await apiFetch(`/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentHistory: updatedHistory })
      });

      toast.success('Cập nhật đợt thanh toán thành công!');
      
      setStudent({ ...student, paymentHistory: updatedHistory });
      setEditingPayment(null);
      
      setUndoState({ history: oldHistory, message: `Đã lưu thay đổi giao dịch.` });
      setTimeout(() => setUndoState(null), 10000);

      // Dispatch events to refresh lists
      window.dispatchEvent(new Event("payment-mutation"));
      window.dispatchEvent(new Event('student-mutation'));

      // Reload student details
      fetchStudentDetail();
    } catch (error) {
      console.error("Edit payment error:", error);
      toast.error('Lỗi khi cập nhật giao dịch: ' + (error instanceof Error ? error.message : 'Không xác định'));
    }
  };

  const handleDeletePaymentClick = async (p: NonNullable<Student['paymentHistory']>[number], idx: number) => {
    if (!student || !student.paymentHistory) return;
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn xóa đợt thanh toán ${new Intl.NumberFormat('vi-VN').format(p.amount)}đ ngày ${p.date} không?`);
    if (!confirmDelete) return;

    try {
      const oldHistory = [...student.paymentHistory];
      const updatedHistory = student.paymentHistory.filter((_, i) => i !== idx);

      await apiFetch(`/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentHistory: updatedHistory })
      });

      toast.success('Đã xóa giao dịch đóng phí thành công!');
      
      setStudent({ ...student, paymentHistory: updatedHistory });
      
      setUndoState({ history: oldHistory, message: `Đã xóa giao dịch ${new Intl.NumberFormat('vi-VN').format(p.amount)}đ.` });
      setTimeout(() => setUndoState(null), 10000);

      // Dispatch events to refresh lists
      window.dispatchEvent(new Event("payment-mutation"));
      window.dispatchEvent(new Event('student-mutation'));

      // Reload student details
      fetchStudentDetail();
    } catch (error) {
      console.error("Delete payment error:", error);
      toast.error('Lỗi khi xóa giao dịch: ' + (error instanceof Error ? error.message : 'Không xác định'));
    }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'Đã đậu': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Đang học': 'bg-blue-100 text-blue-700 border-blue-200',
      'Thi lại': 'bg-rose-100 text-rose-700 border-rose-200',
      'Nợ học phí': 'bg-orange-100 text-orange-700 border-orange-200',
      'Nghỉ học': 'bg-slate-200 text-slate-600 border-slate-300',
    };
    return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <AnimatePresence>
      {student && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-5xl h-full sm:h-auto sm:max-h-[95vh] overflow-hidden flex flex-col bg-slate-50 sm:rounded-[2rem] shadow-2xl"
          >
            {/* Header Section */}
            <div className="bg-white px-4 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg shadow-cyan-100 shrink-0">
                    {student.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">{student.fullName}</h2>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                      <span className="text-slate-500 text-[10px] sm:text-xs font-medium">{student.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-center">
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {(Array.isArray(student.status) ? student.status : [student.status]).map((st) => (
                      <span
                        key={st}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border shadow-sm whitespace-nowrap",
                          getStatusColor(st)
                        )}
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      title="In thông tin"
                      className="p-2 sm:p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
                    >
                      <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                      onClick={onClose}
                      title="Đóng"
                      className="p-2 sm:p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-95"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="mt-6 sm:mt-8">
                <div className="flex items-center justify-start gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200",
                        activeTab === tab
                          ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      )}
                    >
                      <TabIcon tab={tab} />
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                {student && activeTab === tabs[tabs.length - 1] && <StudentHistoryTab student={student} />}
                {student && activeTab === 'Hồ sơ' && (
                  <ProfileTab student={student} selectedCenter={selectedCenter} />
                )}

                {student && activeTab === 'Học phí' && (
                  <TuitionTab
                    student={student}
                    handleStartEditPayment={handleStartEditPayment}
                    handleDeletePaymentClick={handleDeletePaymentClick}
                    undoState={undoState}
                    handleUndoPayment={handleUndoPayment}
                  />
                )}

                {student && activeTab === 'Khuôn mặt' && (
                  <FaceEnrollmentTab student={student} />
                )}

                {student && activeTab === 'Lịch sử học tập' && (
                  <QualityTab student={student} />
                )}

                {activeTab !== 'Hồ sơ' &&
                  activeTab !== 'Học phí' &&
                  activeTab !== 'Khuôn mặt' &&
                  activeTab !== 'Lịch sử học tập' &&
                  activeTab !== 'Lịch sử' && (
                    <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-[2rem] border border-slate-100">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
                        <TabIcon tab={activeTab} size={32} />
                      </div>
                      <h3 className="text-slate-800 font-bold mb-2">Tính năng đang phát triển</h3>
                      <p className="text-slate-400 text-sm text-center">Chúng tôi đang cập nhật phân hệ {activeTab} sớm nhất có thể.</p>
                    </div>
                  )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal chỉnh sửa giao dịch học phí */}
      <EditPaymentModal
        editingPayment={editingPayment}
        setEditingPayment={setEditingPayment}
        handleSavePaymentEdit={handleSavePaymentEdit}
      />
    </AnimatePresence>
  );
}

function TabIcon({ tab, size = 16 }: { tab: TabType, size?: number }) {
  switch (tab) {
    case 'Hồ sơ': return <FileText size={size} />;
    case 'Học phí': return <CreditCard size={size} />;
    case 'Khuôn mặt': return <ScanFace size={size} />;
    case 'Lịch sử học tập': return <History size={size} />;
    case 'Lịch sử': return <History size={size} />;
    default: return null;
  }
}

function StudentHistoryTab({ student }: { student: Student }) {
  const payments = student.paymentHistory || [];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800">Lịch sử thanh toán</h3>
        <span className="text-xs font-bold text-slate-400">{payments.length} giao dịch</span>
      </div>
      {payments.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">Chưa có dữ liệu lịch sử.</div>
      ) : (
        <div className="space-y-2">
          {[...payments].reverse().map((payment, index) => (
            <div key={payment.id || index} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-700">{payment.method}</p>
                <p className="text-xs text-slate-400">{payment.date}{payment.note ? ` · ${payment.note}` : ''}</p>
              </div>
              <span className="shrink-0 text-sm font-black text-emerald-600">{new Intl.NumberFormat('vi-VN').format(payment.amount)}đ</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
