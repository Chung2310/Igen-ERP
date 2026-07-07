import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Download, Printer,
  ChevronDown, Trash2,
  ClipboardList, CheckCircle2, Clock, Users as UsersIcon,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { useExams } from '../../hooks/useExams';
import { useStudents } from '../../hooks/useStudents';
import { ExamSession, ExamStatus } from '../../types';
import { AddExamModal } from '../../components/Exams/AddExamModal';
import { ExamStatusModal } from '../../components/Exams/ExamStatusModal';
import { AssignStudentModal } from '../../components/Exams/AssignStudentModal';
import { ExamCard } from '../../components/Exams/ExamCard';
import { toast } from '../../../../pages/Toast';
import { Pagination } from '../../components/ui/Pagination';

export function ExamsPage({ selectedCenter }: { selectedCenter?: string }) {
  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { exams, loading: examsLoading } = useExams(resolvedCenter);
  const { students } = useStudents(resolvedCenter);

  const [activeTab, setActiveTab] = useState<'exams' | 'students'>('exams');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSession | null>(null);
  const [statusModalExam, setStatusModalExam] = useState<ExamSession | null>(null);
  const [assignModalExam, setAssignModalExam] = useState<ExamSession | null>(null);
  const [deleteModalExam, setDeleteModalExam] = useState<ExamSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stats
  const stats = {
    totalExams: exams.length,
    upcoming: exams.filter(e => e.status === 'Sắp diễn ra' || e.status === 'Đã xác nhận').length,
    confirmed: exams.filter(e => e.status === 'Đã xác nhận').length,
    completed: exams.filter(e => e.status === 'Đã hoàn thành').length,
    unassignedStudents: students.filter(s => s.status.includes('Đang học')).length // Example logic
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [rankFilter, setRankFilter] = useState('Tất cả hạng');
  // Hạng bằng — riêng ngành lái xe; chỉ hiện filter khi có dữ liệu
  const hasRankData = React.useMemo(() => exams.some(e => e.rank), [exams]);
  const rankOptions = React.useMemo(() => {
    const ranks = [...new Set(exams.map(e => e.rank).filter(Boolean))] as string[];
    return ['Tất cả hạng', ...ranks.sort()];
  }, [exams]);

  const [statusFilter, setStatusFilter] = useState('Tất cả');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery, rankFilter, statusFilter, fromDate, toDate, selectedCenter]);

  // Helper to parse DD/MM/YYYY to Date object
  const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/').map(Number);
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const filteredExams = exams.filter(exam => {
    if (hasRankData && rankFilter !== 'Tất cả hạng' && exam.rank !== rankFilter) return false;

    if (statusFilter !== 'Tất cả' && exam.status !== statusFilter) return false;
    if (searchQuery && !exam.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    // Date filter
    const examDateStr = exam.officialDate || exam.tentativeDate;
    if (examDateStr) {
      const examDate = parseDateString(examDateStr);
      if (examDate) {
        if (fromDate) {
          const from = new Date(fromDate);
          from.setHours(0, 0, 0, 0);
          examDate.setHours(0, 0, 0, 0);
          if (examDate < from) return false;
        }
        if (toDate) {
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          examDate.setHours(0, 0, 0, 0);
          if (examDate > to) return false;
        }
      }
    }
    return true;
  });

  const totalPages = Math.ceil(filteredExams.length / pageSize);
  const paginatedExams = filteredExams.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusInfo = (status: ExamStatus) => {
    switch (status) {
      case 'Đã hoàn thành':
        return { color: 'text-emerald-500 bg-emerald-50 border-emerald-100', icon: CheckCircle2, label: 'Đã hoàn thành' };
      case 'Sắp diễn ra':
        return { color: 'text-amber-500 bg-amber-50 border-amber-100', icon: Clock, label: 'Sắp diễn ra' };
      case 'Đã xác nhận':
        return { color: 'text-blue-500 bg-blue-50 border-blue-100', icon: CheckCircle2, label: 'Đã xác nhận' };
      case 'Đã hủy':
        return { color: 'text-rose-500 bg-rose-50 border-rose-100', icon: X, label: 'Đã hủy' };
      default:
        return { color: 'text-slate-500 bg-slate-50 border-slate-100', icon: ClipboardList, label: status };
    }
  };

  const handleDeleteExam = async () => {
    if (!deleteModalExam) return;

    setIsDeleting(true);
    try {
      await apiFetch(`/exams/${deleteModalExam.id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event("exam-mutation"));
      setDeleteModalExam(null);
      toast.success("Xóa đợt thi thành công!");
    } catch (error: unknown) {
      console.error("Error deleting exam:", error);
      const msg = error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa đợt thi.";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditExam = (exam: ExamSession) => {
    setEditingExam(exam);
    setIsAddModalOpen(true);
  };

  const handleStatusUpdate = (exam: ExamSession) => {
    setStatusModalExam(exam);
  };

  const handleAssignStudent = (exam: ExamSession) => {
    setAssignModalExam(exam);
  };

  const handleExport = () => {
    if (filteredExams.length === 0) {
      toast.warning('Không có dữ liệu đợt thi để xuất.');
      return;
    }

    const headers = ['Tên đợt thi', 'Hạng', 'Trạng thái', 'Ngày dự kiến', 'Ngày chính thức', 'Địa điểm', 'Số học viên', 'Đậu', 'Trượt'];

    const rows = filteredExams.map(exam => [
      exam.name,
      exam.rank || '',
      exam.status,
      exam.tentativeDate,
      exam.officialDate || '',
      exam.location,
      exam.studentCount,
      exam.passCount,
      exam.failCount
    ]);

    try {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, // Tên đợt thi
        { wch: 10 }, // Hạng
        { wch: 15 }, // Trạng thái
        { wch: 15 }, // Ngày dự kiến
        { wch: 15 }, // Ngày chính thức
        { wch: 25 }, // Địa điểm
        { wch: 12 }, // Số học viên
        { wch: 10 }, // Đậu
        { wch: 10 }  // Trượt
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách đợt thi");
      XLSX.writeFile(wb, `danh_sach_lich_thi_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
      toast.success('Xuất file Excel thành công.');
    } catch (error) {
      console.error('Error exporting exams to excel:', error);
      toast.error('Có lỗi xảy ra khi xuất file Excel.');
    }
  };

  const handlePrint = () => {
    if (filteredExams.length === 0) {
      toast.warning('Không có dữ liệu đợt thi để in.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      toast.error('Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép bật lên để in hoặc mở ứng dụng trong tab mới.');
      return;
    }

    const rowsHtml = filteredExams.map(exam => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${exam.name}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${exam.rank || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${exam.status}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${exam.tentativeDate}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${exam.officialDate || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${exam.location}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${exam.studentCount}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #10b981;">${exam.passCount}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #f43f5e;">${exam.failCount}</td>
      </tr>
    `).join('');

    const printContent = `
      <html>
        <head>
          <title>Danh sách lịch thi - ${new Date().toLocaleDateString('vi-VN')}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #334155; }
            h1 { text-align: center; color: #1e293b; margin-bottom: 5px; }
            p.info { text-align: center; margin-bottom: 30px; color: #64748b; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f8fafc; color: #475569; font-weight: bold; text-transform: uppercase; font-size: 12px; padding: 12px; border: 1px solid #ddd; }
            tr:nth-child(even) { background-color: #fcfcfc; }
            .footer { margin-top: 30px; text-align: right; font-size: 12px; font-style: italic; color: #94a3b8; }
          </style>
        </head>
        <body>
          <h1>DANH SÁCH LỊCH THI</h1>
          <p class="info">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} | Tổng số: ${filteredExams.length} đợt thi</p>
          <table>
            <thead>
              <tr>
                <th>Tên đợt thi</th>
                <th>Hạng</th>
                <th>Trạng thái</th>
                <th>Dự kiến</th>
                <th>Chính thức</th>
                <th>Địa điểm</th>
                <th>HV</th>
                <th>Đậu</th>
                <th>Trượt</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">
            Xuất bởi Hệ thống Quản lý Đào tạo & Học viên iGen
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lịch thi</h1>
          <p className="text-slate-400 text-xs font-medium mt-0.5">Quản lý đợt thi, gắn học viên và theo dõi kết quả</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Xuất
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> In
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-md shadow-cyan-100 hover:bg-cyan-700 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo đợt thi
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 no-print">
        <StatCard label="Tổng đợt thi" value={stats.totalExams} icon={ClipboardList} color="text-cyan-600" bgColor="bg-cyan-50" />
        <StatCard label="Sắp diễn ra" value={stats.upcoming} icon={Clock} color="text-orange-500" bgColor="bg-orange-50" />
        <StatCard label="Đã xác nhận" value={stats.confirmed} icon={CheckCircle2} color="text-emerald-500" bgColor="bg-emerald-50" />
        <StatCard label="Đã hoàn thành" value={stats.completed} icon={CheckCircle2} color="text-sky-500" bgColor="bg-sky-50" />
        <StatCard label="HV chưa có lịch" value={stats.unassignedStudents} icon={UsersIcon} color="text-purple-500" bgColor="bg-purple-50" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 sm:gap-4 border-b border-slate-200 mt-1 overflow-x-auto no-scrollbar no-print">
        <button
          onClick={() => setActiveTab('exams')}
          className={cn(
            "flex items-center gap-1 px-1.5 py-2 text-xs font-bold transition-all relative whitespace-nowrap cursor-pointer",
            activeTab === 'exams' ? "text-cyan-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Đợt thi
          {activeTab === 'exams' && <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600" />}
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={cn(
            "flex items-center gap-1 px-1.5 py-2 text-xs font-bold transition-all relative whitespace-nowrap cursor-pointer",
            activeTab === 'students' ? "text-cyan-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <UsersIcon className="w-3.5 h-3.5" /> HV chưa có lịch
          {activeTab === 'students' && <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600" />}
        </button>
      </div>

      {activeTab === 'exams' ? (
        <>
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm no-print">
            <FilterItem label="Từ ngày">
              <input
                type="date"
                value={fromDate}
                placeholder="Từ ngày..."
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-transparent outline-none text-[11px] font-bold relative"
              />
            </FilterItem>
            <FilterItem label="Đến ngày">
              <input
                type="date"
                value={toDate}
                placeholder="Đến ngày..."
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-transparent outline-none text-[11px] font-bold relative"
              />
            </FilterItem>
            {hasRankData && (
              <FilterSelect label="Hạng bằng" value={rankFilter} onChange={setRankFilter} options={rankOptions} />
            )}

            <FilterSelect label="Trạng thái" value={statusFilter} onChange={setStatusFilter} options={['Tất cả', 'Sắp diễn ra', 'Đã xác nhận', 'Đã hoàn thành']} />
            <div className="flex items-end pb-1 col-span-2 sm:col-span-1">
              <button
                onClick={() => {
                  setRankFilter('Tất cả hạng');
                  setStatusFilter('Tất cả');
                  setSearchQuery('');
                  setFromDate('');
                  setToDate('');
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors h-7"
              >
                <X className="w-3 h-3" /> Xóa lọc
              </button>
            </div>
          </div>

          {/* Exam List */}
          <div className="space-y-3">
            {examsLoading ? (
              <div className="py-20 text-center text-slate-400 text-sm italic">Đang nạp dữ liệu đợt thi...</div>
            ) : paginatedExams.length === 0 ? (
              <div className="py-20 bg-white rounded-3xl border border-slate-100 text-center text-slate-400 text-sm italic">Không tìm thấy đợt thi nào.</div>
            ) : paginatedExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                assignedStudents={students.filter(s => s.examId === exam.id)}
                getStatusInfo={getStatusInfo}
                onDelete={() => setDeleteModalExam(exam)}
                onEdit={() => handleEditExam(exam)}
                onStatusClick={() => handleStatusUpdate(exam)}
                onAssignClick={() => handleAssignStudent(exam)}
                onUnassignStudent={async (studentId) => {
                  try {
                    await apiFetch(`/exams/${exam.id}/unassign`, {
                      method: 'POST',
                      body: JSON.stringify({ studentId })
                    });
                    window.dispatchEvent(new Event("student-mutation"));
                    window.dispatchEvent(new Event("exam-mutation"));
                    toast.success("Đã xóa học viên khỏi đợt thi.");
                  } catch (error) {
                    console.error("Error unassigning student:", error);
                    toast.error("Có lỗi xảy ra khi xóa học viên khỏi đợt thi.");
                  }
                }}
                onUpdateStudentResult={async (studentId, overallResult) => {
                  try {
                    await apiFetch(`/exams/${exam.id}/students/${studentId}/result`, {
                      method: 'POST',
                      body: JSON.stringify({ overallResult })
                    });
                    window.dispatchEvent(new Event("student-mutation"));
                    window.dispatchEvent(new Event("exam-mutation"));
                    toast.success("Cập nhật kết quả thi thành công.");
                  } catch (error) {
                    console.error("Error updating student result:", error);
                    toast.error("Có lỗi xảy ra khi cập nhật kết quả thi.");
                  }
                }}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredExams.length}
            pageSize={pageSize}
            itemName="đợt thi"
            className="mt-4 shadow-sm bg-white rounded-3xl border border-slate-100"
          />
        </>
      ) : (
        <div className="py-20 bg-white rounded-3xl border border-slate-100 text-center text-slate-400 text-sm italic">Danh sách học viên chưa có lịch thi.</div>
      )}

      {/* Add Exam Modal */}
      <AddExamModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingExam(null);
        }}
        onSuccess={() => { }}
        initialData={editingExam}
      />

      <ExamStatusModal
        isOpen={!!statusModalExam}
        exam={statusModalExam}
        onClose={() => setStatusModalExam(null)}
        onSuccess={() => { }}
      />

      <AssignStudentModal
        isOpen={!!assignModalExam}
        exam={assignModalExam}
        onClose={() => setAssignModalExam(null)}
        onSuccess={() => { }}
      />

      {/* Delete Confirmation Modal */}
      {deleteModalExam && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteModalExam(null)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 max-w-sm w-full text-center"
          >
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">Xác nhận xóa</h3>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              Bạn có chắc chắn muốn xóa đợt thi <span className="font-bold text-slate-800">"{deleteModalExam.name}"</span>?
              Dữ liệu của học viên trong đợt thi này sẽ bị xóa khỏi lịch.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalExam(null)}
                className="flex-1 px-6 py-3 bg-slate-50 text-slate-400 font-bold rounded-2xl hover:bg-slate-100 transition-all border border-slate-100"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDeleteExam}
                disabled={isDeleting}
                className="flex-1 px-6 py-3 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Đúng, xóa nó'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white p-1.5 px-2.5 rounded-lg border border-slate-100 shadow-sm flex items-center gap-2.5">
      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", bgColor)}>
        <Icon className={cn("w-3.5 h-3.5", color)} />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-[9px] font-semibold text-slate-550 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

interface FilterItemProps {
  label: string;
  children: React.ReactNode;
}

function FilterItem({ label, children }: FilterItemProps) {
  return (
    <div className="space-y-0.5">
      <label className="text-[9px] font-bold text-slate-550 uppercase tracking-wider">{label}</label>
      <div className="bg-slate-50 px-2 py-1 rounded-md border border-slate-100 h-7 flex items-center relative">
        {children}
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="space-y-0.5">
      <label className="text-[9px] font-bold text-slate-550 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-7 bg-slate-50 px-2 pr-7 rounded-md border border-slate-100 text-[11px] font-bold text-slate-800 outline-none appearance-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/5 transition-all"
        >
          {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}


