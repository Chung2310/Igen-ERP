import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Download, Printer,
  ClipboardList, CheckCircle2, Clock, Users as UsersIcon,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { apiFetch } from '../../lib/api';
import { useExams } from '../../hooks/useExams';
import { useStudents } from '../../hooks/useStudents';
import { useBatches } from '../../hooks/useBatches';
import { useResources } from '../../hooks/useResources';
import { ExamSession } from '../../types';
import { AddExamModal } from '../../components/Exams/AddExamModal';
import { AssignStudentModal } from '../../components/Exams/AssignStudentModal';
import { ExamCard } from '../../components/Exams/ExamCard';
import { toast } from '../../../../pages/Toast';
import { getApiErrorMessage } from '../../../../utils/errorMessage';
import { Pagination } from '../../components/ui/Pagination';
import { ErpModal } from '../../components/Erp/ErpUI';
import { VietnameseDatePicker } from '../../components/Batches/VietnameseDatePicker';
import { RoadmapPicker } from '../../components/ui/RoadmapPicker';
import { getBatchProgression, getWaitlist, placeWaitlist, saveProgression, type BatchProgression } from '../../api/learningRoadmap.api';

export function ExamsPage({ selectedCenter, canManage = true }: { selectedCenter?: string; canManage?: boolean }) {
  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { exams, loading: examsLoading } = useExams(resolvedCenter);
  const { students } = useStudents(resolvedCenter);
  const { batches } = useBatches(resolvedCenter);
  const { resources } = useResources();
  const classrooms = React.useMemo(() => resources.filter((resource) => resource.type === "Phòng học"), [resources]);

  const [activeTab, setActiveTab] = useState<'exams' | 'students'>('exams');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSession | null>(null);
  const [assignModalExam, setAssignModalExam] = useState<ExamSession | null>(null);
  const [deleteModalExam, setDeleteModalExam] = useState<ExamSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingExam, setViewingExam] = useState<ExamSession | null>(null);
  const [progressingExam, setProgressingExam] = useState<ExamSession | null>(null);

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
          <h1 className="text-xl font-medium tracking-tight text-slate-900">Lịch thi</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-sky-100 rounded-xl text-xs font-medium text-slate-700 hover:bg-sky-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Xuất
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-sky-100 rounded-xl text-xs font-medium text-slate-700 hover:bg-sky-50 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> In
          </button>
          {canManage && <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-primary text-white rounded-xl text-xs font-medium hover:bg-brand-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo đợt thi
          </button>}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 no-print">
        <StatCard label="Tổng đợt thi" value={stats.totalExams} icon={ClipboardList} color="text-cyan-600" bgColor="bg-sky-50" />
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
            "flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors relative whitespace-nowrap cursor-pointer",
            activeTab === 'exams' ? "text-brand-primary" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Đợt thi
          {activeTab === 'exams' && <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />}
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={cn(
            "flex items-center gap-1.5 px-2 py-2 text-sm font-medium transition-colors relative whitespace-nowrap cursor-pointer",
            activeTab === 'students' ? "text-brand-primary" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <UsersIcon className="w-3.5 h-3.5" /> HV chưa có lịch
          {activeTab === 'students' && <motion.div layoutId="tabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" />}
        </button>
      </div>

      {activeTab === 'exams' ? (
        <>
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 bg-white p-3 rounded-2xl border border-sky-100 shadow-sm no-print">
            <FilterItem label="Từ ngày">
              <VietnameseDatePicker ariaLabel="Từ ngày" value={fromDate} max={toDate || undefined} onChange={setFromDate} selectionOnly variant="filter" />
            </FilterItem>
            <FilterItem label="Đến ngày">
              <VietnameseDatePicker ariaLabel="Đến ngày" value={toDate} min={fromDate || undefined} onChange={setToDate} selectionOnly variant="filter" />
            </FilterItem>
            {hasRankData && (
              <FilterSelect label="Hạng bằng" value={rankFilter} onChange={setRankFilter} options={rankOptions} />
            )}

            <FilterSelect label="Trạng thái" value={statusFilter} onChange={setStatusFilter} options={['Tất cả', 'Sắp diễn ra', 'Đã xác nhận', 'Đã hoàn thành']} />
            <div className="flex items-end col-span-2 sm:col-span-1">
              <button
                onClick={() => {
                  setRankFilter('Tất cả hạng');
                  setStatusFilter('Tất cả');
                  setSearchQuery('');
                  setFromDate('');
                  setToDate('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-brand-primary flex items-center gap-1 transition-colors h-10"
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
              <div className="py-14 bg-white rounded-2xl border border-sky-100 text-center text-slate-500 text-sm">Không tìm thấy đợt thi nào.</div>
            ) : paginatedExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                resourceCompanyCode={resolvedCenter}
                assignedStudents={exam.batchId ? students.filter((student) => batches.find((batch) => batch.id === exam.batchId)?.learnerIds.includes(student.id)) : students.filter(s => s.examId === exam.id)}
                onDelete={() => setDeleteModalExam(exam)}
                onEdit={() => handleEditExam(exam)}
                onAssignClick={() => handleAssignStudent(exam)}
                onProgressRoute={exam.batchId ? async () => {
                  if ((exam.results || []).some((item) => typeof item.score !== 'number')) { toast.warning('Hãy nhập đủ điểm thi trước khi chuyển lộ trình.'); return; }
                  const sourceBatch = batches.find((batch) => batch.id === exam.batchId);
                  if (!sourceBatch?.roadmapId || !sourceBatch.roadmapStepId) { toast.warning('Lớp nguồn chưa được gắn chặng lộ trình. Hãy cập nhật lớp trước khi chuyển tiếp.'); return; }
                  setProgressingExam(exam);
                } : undefined}
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
                    toast.error(getApiErrorMessage(error, "Có lỗi xảy ra khi xóa học viên khỏi đợt thi."));
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
                    window.dispatchEvent(new Event("batch-mutation"));
                    toast.success("Cập nhật kết quả thi thành công.");
                  } catch (error) {
                    console.error("Error updating student result:", error);
                    toast.error(getApiErrorMessage(error, "Có lỗi xảy ra khi cập nhật kết quả thi."));
                  }
                }}
                onSaveStudentScores={async (results) => {
                  try {
                    await apiFetch(`/exams/${exam.id}/results`, { method: 'PATCH', body: JSON.stringify({ results }) });
                    window.dispatchEvent(new Event("student-mutation"));
                    window.dispatchEvent(new Event("exam-mutation"));
                    window.dispatchEvent(new Event("batch-mutation"));
                    toast.success(`Đã lưu điểm cho ${results.length} học viên.`);
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, "Không thể lưu điểm thi."));
                    throw error;
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
            className="mt-4 bg-white rounded-2xl border border-sky-100"
          />
        </>
      ) : (
        <div className="py-14 bg-white rounded-2xl border border-sky-100 text-center text-slate-500 text-sm">Danh sách học viên chưa có lịch thi.</div>
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
        tenantId={resolvedCenter || editingExam?.ownerId}
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
            className="relative bg-white rounded-2xl shadow-xl border border-sky-100 p-5 max-w-sm w-full"
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <h3 className="flex items-center gap-2 text-base font-medium text-slate-900 before:w-1 before:h-5 before:rounded-full before:bg-brand-primary">Xóa đợt thi</h3>
              <button type="button" onClick={() => setDeleteModalExam(null)} aria-label="Đóng" className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-slate-600 text-sm my-5 leading-relaxed">
              Bạn có chắc chắn muốn xóa đợt thi <span className="text-slate-900">"{deleteModalExam.name}"</span>?
              Dữ liệu của học viên trong đợt thi này sẽ bị xóa khỏi lịch.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleDeleteExam}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-xl hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {viewingExam && (
        <ErpModal title={`Chi tiết đợt thi: ${viewingExam.name}`} onClose={() => setViewingExam(null)}>
          <div className="space-y-4 text-slate-700 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Tên đợt thi</label>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{viewingExam.name}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">Hạng bằng</label>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{viewingExam.rank || 'N/A'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Trạng thái</label>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{viewingExam.status}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">Địa điểm</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{viewingExam.location || 'Chưa cập nhật'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">Ngày thi dự kiến</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{viewingExam.tentativeDate}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">Ngày thi chính thức</label>
                <p className="text-sm font-medium text-slate-700 mt-0.5">{viewingExam.officialDate || 'Chưa xác nhận'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500">Tổng số học viên</label>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{viewingExam.studentCount}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 text-emerald-600">Đậu</label>
                <p className="text-sm font-medium text-emerald-600 mt-0.5">{viewingExam.passCount}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 text-rose-600">Trượt</label>
                <p className="text-sm font-medium text-rose-600 mt-0.5">{viewingExam.failCount}</p>
              </div>
            </div>

            {viewingExam.customFields && Object.keys(viewingExam.customFields).length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h5 className="text-xs font-bold text-slate-800 mb-3">Trường thông tin thêm</h5>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(viewingExam.customFields).map(([key, val]) => (
                    <div key={key}>
                      <label className="text-xs text-slate-500">{key}</label>
                      <p className="text-sm font-medium text-slate-700 mt-0.5">{String(val || 'N/A')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ErpModal>
      )}
      {progressingExam ? <ExamProgressionModal exam={progressingExam} students={students} batches={batches} classrooms={classrooms} onClose={() => setProgressingExam(null)} /> : null}
    </div>
  );
}

function ExamProgressionModal({ exam, students, batches, classrooms, onClose }: { exam: ExamSession; students: import('../../types').DrivingStudent[]; batches: import('../../types').Batch[]; classrooms: Array<import('../../types').ResourceItem>; onClose: () => void }) {
  const [progression, setProgression] = React.useState<BatchProgression | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [targetBatchId, setTargetBatchId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [showQuickCreate, setShowQuickCreate] = React.useState(false);
  const sourceBatch = batches.find((batch) => batch.id === exam.batchId);
  const [quickClass, setQuickClass] = React.useState({ code: "", startDate: "", endDate: "", startTime: sourceBatch?.startTime || "18:00", endTime: sourceBatch?.endTime || "20:00", daysOfWeek: sourceBatch?.daysOfWeek || [], location: sourceBatch?.location || "" });
  const [creatingClass, setCreatingClass] = React.useState(false);
  const resultFor = (studentId: string) => {
    const entry = exam.results?.find((result) => result.studentId === studentId);
    // "Chưa có" là giá trị khởi tạo của kỳ thi, không được che mất điểm vừa lưu.
    if (entry?.outcome === "Đậu" || entry?.outcome === "Trượt") return entry.outcome;
    if (typeof entry?.score === "number") return entry.score >= (exam.passScore ?? Math.ceil((exam.maxScore || 100) / 2)) ? "Đậu" : "Trượt";
    return students.find((student) => student.id === studentId)?.exams?.find((entry) => entry.id === exam.id)?.result?.overall || "Chưa có";
  };
  const passedIds = (exam.results || []).map((result) => result.studentId).filter((studentId) => resultFor(studentId) === "Đậu");
  const failedIds = (exam.results || []).map((result) => result.studentId).filter((studentId) => resultFor(studentId) === "Trượt");
  const passedStudents = students.filter((student) => passedIds.includes(student.id));
  const targetBatches = progression?.targetStep ? batches.filter((batch) => batch.courseId === progression.targetStep!.courseId && batch.roadmapId === progression.selectedRoadmapId && batch.roadmapStepId === progression.targetStep!.id && batch.status === "Sắp khai giảng") : [];

  React.useEffect(() => {
    let active = true;
    if (!exam.batchId) return;
    void getBatchProgression(exam.batchId, "").then((data) => {
      if (!active) return;
      setProgression(data);
      setSelectedIds((data.rows || []).map((row) => row.studentId).filter((id) => passedIds.includes(id)));
    }).catch((error) => toast.error(getApiErrorMessage(error, "Không thể tải chặng lộ trình kế tiếp."))).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [exam.batchId]);

  const promote = async () => {
    if (!exam.batchId || !progression?.selectedRoadmapId || !progression.targetStep || !targetBatchId || !selectedIds.length) return;
    setSaving(true);
    try {
      await Promise.all(selectedIds.map((studentId) => saveProgression(exam.batchId!, studentId, { roadmapId: progression.selectedRoadmapId, intent: "continue", teacherNote: "Đạt kết quả thi", overrideEligible: true, overrideReason: "Đạt kết quả thi" })));
      const waitlist = await getWaitlist({ page: 1, limit: 100, roadmapId: progression.selectedRoadmapId, targetStepId: progression.targetStep.id, batchId: exam.batchId });
      const entryIds = waitlist.items.filter((item) => selectedIds.includes(item.studentId)).map((item) => item.id);
      if (entryIds.length !== selectedIds.length) throw new Error("Không thể tạo đủ danh sách học viên để xếp lớp.");
      await placeWaitlist(targetBatchId, entryIds);
      toast.success(`Đã chuyển ${selectedIds.length} học viên vào lớp khóa học tiếp theo.`);
      window.dispatchEvent(new Event("batch-mutation"));
      window.dispatchEvent(new Event("student-mutation"));
      onClose();
    } catch (error) { toast.error(getApiErrorMessage(error, "Không thể chuyển học viên sang lớp tiếp theo.")); }
    finally { setSaving(false); }
  };

  const createTargetClass = async () => {
    if (!progression?.targetStep || !progression.selectedRoadmapId) return;
    if (!quickClass.code.trim() || !quickClass.startDate || !quickClass.endDate || !quickClass.daysOfWeek.length) { toast.warning("Hãy nhập mã lớp, ngày bắt đầu/kết thúc và ít nhất một ngày học."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quickClass.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(quickClass.endDate)) { toast.warning("Ngày học không hợp lệ."); return; }
    if (quickClass.startDate > quickClass.endDate) { toast.warning("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."); return; }
    if (quickClass.startTime >= quickClass.endTime) { toast.warning("Giờ bắt đầu phải trước giờ kết thúc."); return; }
    const normalizedCode = quickClass.code.trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN");
    if (normalizedCode.length < 2 || normalizedCode.length > 50) { toast.warning("Mã lớp cần từ 2 đến 50 ký tự."); return; }
    if (batches.some((batch) => batch.code.trim().replace(/\s+/g, " ").toLocaleUpperCase("vi-VN") === normalizedCode)) { toast.warning(`Mã lớp "${normalizedCode}" đã tồn tại. Hãy dùng mã khác.`); return; }
    setCreatingClass(true);
    try {
      const response = await apiFetch<{ success: boolean; data: { id?: string; _id?: string } }>("/batches", { method: "POST", body: JSON.stringify({ code: normalizedCode, name: quickClass.code.trim(), courseId: progression.targetStep.courseId, roadmapId: progression.selectedRoadmapId, roadmapStepId: progression.targetStep.id, status: "Sắp khai giảng", quota: 0, daysOfWeek: quickClass.daysOfWeek, startTime: quickClass.startTime, endTime: quickClass.endTime, startDate: quickClass.startDate, endDate: quickClass.endDate, location: quickClass.location }) });
      const newBatchId = response.data?.id || response.data?._id;
      if (!newBatchId) throw new Error("Không nhận được mã lớp vừa tạo.");
      setTargetBatchId(newBatchId); setShowQuickCreate(false); window.dispatchEvent(new Event("batch-mutation")); toast.success("Đã tạo lớp chặng tiếp theo.");
    } catch (error) { toast.error(getApiErrorMessage(error, "Không thể tạo lớp chặng tiếp theo.")); }
    finally { setCreatingClass(false); }
  };
  const scoredCount = (exam.results || []).filter((result) => typeof result.score === "number" || result.outcome === "Đậu" || result.outcome === "Trượt").length;
  return <ErpModal title="Chuyển lộ trình tiếp theo" onClose={onClose} maxWidth="max-w-3xl">
    <p className="text-sm text-slate-500">Lớp nguồn vẫn giữ nguyên trạng thái hoạt động. Chỉ các học viên được chọn mới được xếp vào lớp của khóa học kế tiếp.</p>
    <div className="grid grid-cols-3 gap-3"><div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-lg font-medium text-slate-800">{scoredCount}</p><p className="text-xs text-slate-500">Đã có điểm</p></div><div className="rounded-xl bg-emerald-50 p-3 text-center"><p className="text-lg font-medium text-emerald-700">{passedIds.length}</p><p className="text-xs font-bold text-emerald-700">Học viên đậu</p></div><div className="rounded-xl bg-rose-50 p-3 text-center"><p className="text-lg font-medium text-rose-700">{failedIds.length}</p><p className="text-xs font-bold text-rose-700">Học viên trượt</p></div></div>
    {loading ? <p className="py-6 text-center text-sm text-slate-500">Đang kiểm tra lộ trình...</p> : !progression?.targetStep ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Lớp này chưa được gắn lộ trình hoặc đang ở chặng cuối nên chưa có khóa học tiếp theo.</p> : <>
      <div className="rounded-lg border border-cyan-100 bg-sky-50 p-3 text-sm text-cyan-800">Chặng kế tiếp: <b>{progression.targetStep.order}</b>. Chọn lớp mở cho khóa học này và các học viên đậu cần chuyển.</div>
      <RoadmapPicker value={targetBatchId} onChange={setTargetBatchId} placeholder="Ch?n l?p kh?a h?c ti?p theo" options={targetBatches.map((batch) => ({ value: batch.id, label: batch.code + " ? " + batch.courseTitle + " (" + batch.learnerIds.length + "/" + (batch.maxLearners || "?") + ")" }))} />
      <button type="button" onClick={() => setShowQuickCreate((current) => !current)} className="w-fit text-xs font-medium text-brand-primary hover:underline">{showQuickCreate ? "Ẩn tạo nhanh" : "+ Tạo lớp chặng tiếp theo"}</button>
      {showQuickCreate ? <section className="overflow-hidden rounded-xl border border-sky-200 bg-white shadow-sm"><div className="flex flex-col gap-2 border-b border-cyan-100 bg-sky-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-800">Tạo lớp cho chặng {progression.targetStep.order}</p><p className="mt-0.5 text-xs text-slate-600">Lớp được gắn tự động vào đúng lộ trình và khóa học kế tiếp.</p></div><span className="w-fit rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">Sắp khai giảng</span></div><div className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs text-slate-700">Mã lớp <span className="text-rose-500">*</span></span><input value={quickClass.code} onChange={(event) => setQuickClass((current) => ({ ...current, code: event.target.value }))} placeholder="VD: LH-HSK2-08" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label><label className="block"><span className="mb-1.5 block text-xs text-slate-700">Phòng học <span className="font-medium text-slate-400">(tùy chọn)</span></span><RoadmapPicker value={quickClass.location} onChange={(value) => setQuickClass((current) => ({ ...current, location: value }))} placeholder="Ch?a x?p ph?ng" options={classrooms.map((room) => ({ value: room.name, label: room.name + (room.identifier ? " ? " + room.identifier : "") }))} /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs text-slate-700">Ngày khai giảng <span className="text-rose-500">*</span></span><VietnameseDatePicker ariaLabel="Ng?y khai gi?ng" value={quickClass.startDate} max={quickClass.endDate || undefined} onChange={(value) => setQuickClass((current) => ({ ...current, startDate: value }))} selectionOnly variant="filter" /></label><label className="block"><span className="mb-1.5 block text-xs text-slate-700">Ngày bế giảng <span className="text-rose-500">*</span></span><VietnameseDatePicker ariaLabel="Ng?y b? gi?ng" value={quickClass.endDate} min={quickClass.startDate || undefined} onChange={(value) => setQuickClass((current) => ({ ...current, endDate: value }))} selectionOnly variant="filter" /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs text-slate-700">Giờ bắt đầu <span className="text-rose-500">*</span></span><input type="time" value={quickClass.startTime} onChange={(event) => setQuickClass((current) => ({ ...current, startTime: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label><label className="block"><span className="mb-1.5 block text-xs text-slate-700">Giờ kết thúc <span className="text-rose-500">*</span></span><input type="time" value={quickClass.endTime} onChange={(event) => setQuickClass((current) => ({ ...current, endTime: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label></div><div className="border-t border-slate-100 pt-3"><p className="text-xs text-slate-700">Lịch học <span className="text-rose-500">*</span></p><p className="mt-0.5 text-xs text-slate-500">Chọn những ngày có buổi học trong tuần.</p><div className="mt-2 flex flex-wrap gap-2">{["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((label, day) => <button type="button" key={label} aria-pressed={quickClass.daysOfWeek.includes(day)} onClick={() => setQuickClass((current) => ({ ...current, daysOfWeek: current.daysOfWeek.includes(day) ? current.daysOfWeek.filter((item) => item !== day) : [...current.daysOfWeek, day] }))} className={`h-9 min-w-10 rounded-lg border px-2 text-xs font-bold transition ${quickClass.daysOfWeek.includes(day) ? "border-cyan-700 bg-brand-primary text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-cyan-700"}`}>{label}</button>)}</div></div><div className="flex items-center justify-between border-t border-slate-100 pt-3"><p className="text-xs text-slate-500"><span className="text-rose-500">*</span> Trường bắt buộc</p><button type="button" disabled={creatingClass} onClick={() => void createTargetClass()} className="h-10 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{creatingClass ? "Đang tạo lớp..." : "Tạo lớp và chọn"}</button></div></div></section> : null}
      {!targetBatches.length ? <p className="text-xs text-amber-700">Chưa có lớp “Sắp khai giảng” cho khóa học kế tiếp.</p> : null}
      <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200"><label className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold"><input type="checkbox" checked={passedStudents.length > 0 && selectedIds.length === passedStudents.length} onChange={(event) => setSelectedIds(event.target.checked ? passedStudents.map((student) => student.id) : [])} />Chọn tất cả học viên đậu ({passedStudents.length})</label>{passedStudents.map((student) => <label key={student.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0"><input type="checkbox" checked={selectedIds.includes(student.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} /><span className="flex-1 font-medium">{student.fullName}</span><span className="text-xs text-slate-400">{student.phone}</span><span className="text-xs font-bold text-emerald-600">Đậu</span></label>)}</div>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-600">Hủy</button><button type="button" disabled={saving || !targetBatchId || !selectedIds.length} onClick={() => void promote()} className="h-10 rounded-lg bg-brand-primary px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang chuyển..." : `Chuyển ${selectedIds.length} học viên`}</button></div>
    </>}
  </ErpModal>;
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
    <div className="bg-white p-2.5 px-3 rounded-xl border border-sky-100 shadow-sm flex items-center gap-2.5">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bgColor)}>
        <Icon className={cn("w-3.5 h-3.5", color)} />
      </div>
      <div>
        <p className="text-base font-medium text-slate-900 leading-none">{value}</p>
        <p className="text-xs font-normal text-slate-600 mt-0.5">{label}</p>
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
      <label className="text-xs font-normal text-slate-700">{label}</label>
      <div className="relative">
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
      <label className="text-xs font-normal text-slate-700">{label}</label>
      <RoadmapPicker value={value} placeholder={options[0]} allowClear={false} options={options.map((opt) => ({ value: opt, label: opt }))} onChange={onChange} />
    </div>
  );
}


