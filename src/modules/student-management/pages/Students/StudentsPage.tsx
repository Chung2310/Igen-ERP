import React, { Suspense, lazy, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Search, Download, Printer, Plus,
  Eye, Trash2, Pencil,
  X,
  Upload, QrCode
} from 'lucide-react';
import { cn, formatVND, formatDisplayDate } from '../../lib/utils';
import { useStudents } from '../../hooks/useStudents';
import { useBatches } from '../../hooks/useBatches';
import { useCourses } from '../../hooks/useCourses';
import { useCourseCategories, CourseCategoryItem } from '../../hooks/useCourseCategories';
import { toast } from '../../../../pages/Toast';
import { Student, Batch } from '../../types';
import { apiFetch } from '../../lib/api';
import { StudentLoadState } from '../../components/StudentLoadState';
import { Pagination } from '../../components/ui/Pagination';
import { RoadmapPicker } from '../../components/ui/RoadmapPicker';
import { VietnameseDatePicker } from '../../components/Batches/VietnameseDatePicker';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { useBranch } from '../../../../context/BranchContext';
import { useAuth } from '../../../../context/AuthContext';
import { getOperationalStatusLabel, getWorkerOperationalCopy, usesEducationBilling as presetUsesEducationBilling } from '../../config/workerRecruitmentCopy';
const EditStudentModal = lazy(() => import('../../components/Student/EditStudentModal').then((m) => ({ default: m.EditStudentModal })));
const AssignStudentBranchModal = lazy(() => import('../../components/Student/AssignStudentBranchModal').then((m) => ({ default: m.AssignStudentBranchModal })));
const ImportStudentModal = lazy(() => import('../../components/Student/ImportStudentModal').then((m) => ({ default: m.ImportStudentModal })));
const RegisterQRModal = lazy(() => import('../../components/Student/RegisterQRModal').then((m) => ({ default: m.RegisterQRModal })));

interface StudentsPageProps {
  onSelectStudent: (student: Student) => void;
  onAddStudent: () => void;
  selectedCenter?: string;
  canManage?: boolean;
}

type StatusFilter = 'Tất cả' | 'KSK' | 'Đã KSK' | 'Nộp HS' | 'Đang học' | 'Đang thi' | 'Đã đậu' | 'Thi lại' | 'Nghỉ học';

interface StudentDeleteImpactItem {
  studentId: string;
  name: string;
  reasons: Array<{ key: string; label: string; count: number; details?: string[] }>;
}

interface BulkDeletePreview {
  items: StudentDeleteImpactItem[];
  deletableIds: string[];
  blockedIds: string[];
  deletableCount: number;
  blockedCount: number;
}

type StudentSortOption =
  | 'newest'
  | 'oldest'
  | 'name-asc'
  | 'name-desc'
  | 'registration-newest'
  | 'registration-oldest';

function toTimestamp(value?: Date | string) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

// Tab phân loại ảo, luôn có bên cạnh các phân loại khóa học động
const TAB_ALL = 'Tất cả';
const TAB_UNASSIGNED = 'Chưa xếp lớp';

export function StudentsPage({ onSelectStudent, onAddStudent, selectedCenter, canManage = true }: StudentsPageProps) {
  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { userProfile } = useAuth();
  // Phạm vi danh sách luôn theo chi nhánh đang chọn — lối vào "Chưa gán chi nhánh" đã được gỡ khỏi thanh công cụ.
  const [listScope] = useState<'branch' | 'unassigned'>('branch');
  const [isRegisterQROpen, setIsRegisterQROpen] = useState(false);
  const isUnassignedScope = listScope === 'unassigned';
  const { students, loading, error: loadError, refetch } = useStudents(resolvedCenter, listScope);
  const { branches, activeBranchId } = useBranch();
  const getBranchLabel = (branchId?: string) => branches.find((b) => b._id === branchId)?.name;
  const { batches, error: batchLoadError, refetch: reloadBatches } = useBatches();
  const { courses, error: courseLoadError, refetch: reloadCourses } = useCourses(resolvedCenter);
  const { categories, error: categoryLoadError, refetch: reloadCategories } = useCourseCategories(resolvedCenter);
  const entityLabel = useEntityLabel();
  const operationalCopy = getWorkerOperationalCopy(entityLabel.preset);
  const usesEducationBilling = presetUsesEducationBilling(entityLabel.preset);

  const [category, setCategory] = useState<string>(TAB_ALL);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<StudentSortOption>('newest');
  const [rankFilter] = useState('Tất cả hạng');
  const [feeStatusFilter, setFeeStatusFilter] = useState('Tất cả học phí');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeletePreview, setBulkDeletePreview] = useState<BulkDeletePreview | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Nếu phân loại đang chọn bị xóa khỏi danh mục thì quay về "Tất cả"
  React.useEffect(() => {
    if (category !== TAB_ALL && category !== TAB_UNASSIGNED && categories.length > 0 && !categories.some(c => c.name === category)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategory(TAB_ALL);
    }
  }, [categories, category]);

  // Reset to first page when filtering
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [category, selectedStatus, searchQuery, startDate, endDate, sortBy, rankFilter, feeStatusFilter, selectedCenter]);

  // Helper to parse DD/MM/YYYY to Date object
  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date(0);
    const isoParts = dateStr.split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4) {
      const [year, month, day] = isoParts.map(Number);
      return new Date(year, month - 1, day);
    }
    const parts = dateStr.split('/');
    if (parts.length < 3) return new Date(0);
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return new Date(0);
    return new Date(year, month - 1, day);
  };

  // Học viên thuộc phân loại nào = phân loại của các khóa học mà lớp (batch) của họ đang mở
  const studentCategories = useMemo(() => {
    const categoryByCourseId = new Map<string, string>(courses.map(c => [c.id, c.category]));
    const map = new Map<string, Set<string>>();
    for (const b of batches) {
      const cat = categoryByCourseId.get(b.courseId);
      if (!cat) continue;
      for (const sid of b.learnerIds) {
        const set = map.get(sid) || new Set<string>();
        set.add(cat);
        map.set(sid, set);
      }
    }
    return map;
  }, [batches, courses]);

  // Lớp / dự án mà từng học viên đang tham gia
  const studentBatches = useMemo(() => {
    const map = new Map<string, Batch[]>();
    for (const b of batches) {
      for (const sid of b.learnerIds) {
        const list = map.get(sid) || [];
        list.push(b);
        map.set(sid, list);
      }
    }
    return map;
  }, [batches]);

  const getBatchLabels = (studentId: string) =>
    (studentBatches.get(studentId) || []).map((b) => b.code || b.courseTitle).filter(Boolean);

  // Hạng bằng là dữ liệu riêng ngành lái xe — chỉ hiện filter/cột khi còn học viên có hạng
  const hasRankData = useMemo(() => students.some(s => s.rank), [students]);

  const filteredStudents = students.filter(student => {
    // 1. Category Filter (theo phân loại khóa học của lớp học viên đang tham gia)
    if (category !== TAB_ALL) {
      const cats = studentCategories.get(student.id);
      if (category === TAB_UNASSIGNED) {
        if (cats && cats.size > 0) return false;
      } else if (!cats || !cats.has(category)) {
        return false;
      }
    }

    // 2. Status Filter
    if (selectedStatus !== 'Tất cả') {
      const statusMap: Record<string, string> = {
        'Nộp HS': 'Đã nộp HS',
        'KSK': 'Chờ KSK'
      };
      const dbStatus = statusMap[selectedStatus] || selectedStatus;
      const studentStatuses = Array.isArray(student.status) ? student.status : [student.status];
      const hasMatch = (studentStatuses as string[]).includes(dbStatus);
      if (!hasMatch) return false;
    }

    // 3. Rank Filter (chỉ áp dụng với dữ liệu ngành lái xe)
    if (hasRankData && rankFilter !== 'Tất cả hạng' && student.rank !== rankFilter) return false;

    // 4. Date Range Filter
    if (startDate || endDate) {
      const regDate = parseDate(student.registrationDate);
      if (startDate) {
        const start = parseDate(startDate);
        if (regDate < start) return false;
      }
      if (endDate) {
        const end = parseDate(endDate);
        end.setHours(23, 59, 59, 999);
        if (regDate > end) return false;
      }
    }

    // 6. Search Query (Name, Phone, ID Card)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchName = student.fullName.toLowerCase().includes(query);
      const matchPhone = student.phone.includes(query);
      const matchId = student.idCard?.toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchId) return false;
    }

    // 7. Tuition Status Filter
    if (usesEducationBilling && feeStatusFilter !== 'Tất cả học phí') {
      const totalFeeNum = parseInt(String(student.fee).replace(/\D/g, ''), 10) || 0;
      const paidSoFar = student.paidAmount || 0;
      const remaining = totalFeeNum - paidSoFar;

      if (feeStatusFilter === 'Đã đóng đủ') {
        if (remaining > 0) return false;
      } else if (feeStatusFilter === 'Chưa đóng') {
        if (paidSoFar > 0) return false;
      } else if (feeStatusFilter === 'Còn thiếu') {
        if (paidSoFar === 0 || remaining <= 0) return false;
      }
    }

    return true;
  });

  const sortedStudents = [...filteredStudents].sort((left, right) => {
    if (sortBy === 'name-asc' || sortBy === 'name-desc') {
      const result = (left.fullName || '').localeCompare(right.fullName || '', 'vi', {
        sensitivity: 'base',
      });
      return sortBy === 'name-asc' ? result : -result;
    }

    const leftRegistration = parseDate(left.registrationDate).getTime();
    const rightRegistration = parseDate(right.registrationDate).getTime();
    const leftCreated = left.createdAt ? toTimestamp(left.createdAt) : leftRegistration;
    const rightCreated = right.createdAt ? toTimestamp(right.createdAt) : rightRegistration;
    const leftTime = sortBy.startsWith('registration') ? leftRegistration : leftCreated;
    const rightTime = sortBy.startsWith('registration') ? rightRegistration : rightCreated;
    if (leftTime !== rightTime) {
      return sortBy.endsWith('oldest') ? leftTime - rightTime : rightTime - leftTime;
    }
    return (left.fullName || '').localeCompare(right.fullName || '', 'vi', {
      sensitivity: 'base',
    });
  });

  const totalPages = Math.ceil(sortedStudents.length / pageSize);
  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const statusTabs: { label: StatusFilter; count?: number }[] = [
    { label: 'Tất cả', count: students.length },
    { label: 'Đang học', count: students.filter(s => Array.isArray(s.status) ? s.status.includes('Đang học') : s.status === 'Đang học').length },
    { label: 'Đang thi', count: students.filter(s => Array.isArray(s.status) ? s.status.includes('Đang thi') : s.status === 'Đang thi').length },
    { label: 'Đã đậu', count: students.filter(s => Array.isArray(s.status) ? s.status.includes('Đã đậu') : s.status === 'Đã đậu').length },
    { label: 'Thi lại', count: students.filter(s => Array.isArray(s.status) ? s.status.includes('Thi lại') : s.status === 'Thi lại').length },
    { label: 'Nghỉ học', count: students.filter(s => Array.isArray(s.status) ? s.status.includes('Nghỉ học') : s.status === 'Nghỉ học').length },
  ];

  const getStatusBadgeClass = (status: string) => {
    const map: Record<string, string> = {
      'Đang thi': 'bg-teal-100 text-teal-700 border-teal-200',
      'Đã đậu': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Đang học': 'bg-sky-100 text-sky-700 border-sky-200',
      'Chờ KSK': 'bg-amber-100 text-amber-700 border-amber-200',
      'Thi lại': 'bg-rose-100 text-rose-700 border-rose-200',
      'Đã KSK': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Đã nộp HS': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'Nợ học phí': 'bg-orange-100 text-orange-700 border-orange-200',
      'Nghỉ học': 'bg-slate-200 text-slate-600 border-slate-300',
    };
    return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const preview = await apiFetch('/students/bulk-delete-preview', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedStudentIds }),
      });
      setBulkDeletePreview(preview);
    } catch (error) {
      console.error("Error previewing bulk student deletion:", error);
      toast.error(`Không thể kiểm tra dữ liệu liên quan của ${entityLabel.singular}.`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeletePreview || bulkDeletePreview.deletableIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const result = await apiFetch('/students/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: bulkDeletePreview.deletableIds }),
      });
      if (result.deletedCount > 0) toast.success(`Đã xóa ${result.deletedCount} ${entityLabel.singular} và dữ liệu vận hành liên quan. Phiếu thu vẫn được giữ lại.`);
      if (result.blocked?.length > 0) toast.warning(`${result.blocked.length} ${entityLabel.singular} vừa phát sinh dữ liệu nên không được xóa.`);
      setSelectedStudentIds(bulkDeletePreview.blockedIds);
      setBulkDeletePreview(null);
      window.dispatchEvent(new Event("student-mutation"));
    } catch (error) {
      console.error("Error bulk deleting students:", error);
      toast.error(error instanceof Error ? error.message : `Có lỗi xảy ra khi xóa hàng loạt ${entityLabel.singular}.`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDelete = async (student: Student) => {
    setIsDeleting(student.id);
    try {
      await apiFetch(`/students/${student.id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event("student-mutation"));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error(error instanceof Error ? error.message : `Có lỗi xảy ra khi xóa ${entityLabel.singular}.`);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    if (filteredStudents.length === 0) {
      toast.warning('Không có dữ liệu để xuất.');
      return;
    }

    const commonHeadersAfter = [
      ...(usesEducationBilling ? ['Học phí', 'Đã đóng', 'Còn nợ'] : []),
      'Ngày đăng ký', ...(usesEducationBilling ? ['Trạng thái học phí'] : []), 'Trạng thái',
      'Lớp / Dự án', 'Người phụ trách',
      'Ngày sinh', 'CCCD / CMND', 'Email', 'Người giới thiệu', 'Địa chỉ',
      entityLabel.preset === 'customer' ? 'Ngày bắt đầu sử dụng' : entityLabel.preset === 'worker' ? 'Ngày tiếp nhận' : 'Ngày nhập học',
      'Ảnh CCCD mặt trước', 'Ảnh CCCD mặt sau', 'Ảnh chân dung'
    ];

    const getCommonRowDataAfter = (student: Student) => {
      const totalFeeNum = parseInt(String(student.fee).replace(/\D/g, ''), 10) || 0;
      const paidSoFar = student.paidAmount || 0;
      const remaining = totalFeeNum - paidSoFar;

      let feeStatusStr = 'Chưa đóng';
      if (remaining <= 0 && totalFeeNum > 0) {
        feeStatusStr = 'Đã đóng đủ';
      } else if (paidSoFar > 0) {
        feeStatusStr = 'Còn thiếu';
      }

      return [
        ...(usesEducationBilling ? [
          totalFeeNum.toLocaleString('vi-VN'),
          paidSoFar.toLocaleString('vi-VN'),
          remaining.toLocaleString('vi-VN'),
        ] : []),
        formatDisplayDate(student.registrationDate),
        ...(usesEducationBilling ? [feeStatusStr] : []),
        (Array.isArray(student.status) ? student.status : [student.status])
          .map((status) => getOperationalStatusLabel(entityLabel.preset, status))
          .join(', '),
        getBatchLabels(student.id).join(', ') || 'Chưa xếp lớp',
        student.createdByName || 'Chưa xác định',
        formatDisplayDate(student.birthday),
        student.idCard || '',
        student.email || '',
        student.referral || '',
        student.address || '',
        formatDisplayDate(student.enrollmentDate),
        student.idCardFrontFile?.url || '',
        student.idCardBackFile?.url || '',
        student.portraitFile?.url || ''
      ];
    };

    const headers = ['Họ và tên', 'Số điện thoại', ...commonHeadersAfter];
    const getRowData = (student: Student) => {
      return [
        student.fullName,
        student.phone,
        ...getCommonRowDataAfter(student)
      ];
    };
    const cols = [
      { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
      { wch: 25 }, { wch: 20 },
      { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 35 }, { wch: 16 },
      { wch: 30 }, { wch: 30 }, { wch: 30 }
    ];

    const data = sortedStudents.map(getRowData);

    setIsExporting(true);
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, entityLabel.listTitle);
      
      const fileName = `${operationalCopy.exportFilePrefix}_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất file Excel thành công!');
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error('Có lỗi xảy ra khi xuất file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (filteredStudents.length === 0) {
      toast.warning(`Không có dữ liệu ${entityLabel.singular} để in.`);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      toast.warning('Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cho phép bật lên để in hoặc mở ứng dụng trong tab mới.');
      return;
    }

    const rowsHtml = sortedStudents.map(student => {
      const cats = Array.from(studentCategories.get(student.id) || []);
      return `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${student.fullName}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${student.phone}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${cats.length > 0 ? cats.join(', ') : (student.rank || '')}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${formatDisplayDate(student.registrationDate)}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${(Array.isArray(student.status) ? student.status : [student.status]).map((status) => getOperationalStatusLabel(entityLabel.preset, status)).join(', ')}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${getBatchLabels(student.id).join(', ') || 'Chưa xếp lớp'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${student.createdByName || 'Chưa xác định'}</td>
      </tr>
    `;
    }).join('');

    const printContent = `
      <html>
        <head>
          <title>${entityLabel.listTitle} - ${new Date().toLocaleDateString('vi-VN')}</title>
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
          <h1>${operationalCopy.printTitle}</h1>
          <p class="info">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} | Tổng số: ${filteredStudents.length} ${entityLabel.singular}</p>
          <table>
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Số điện thoại</th>
                <th>Ngành / Hạng</th>
                <th>Ngày đăng ký</th>
                <th>Trạng thái</th>
                <th>Lớp / Dự án</th>
                <th>Người phụ trách</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">
            Xuất bởi ${operationalCopy.printFooter}
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
      {loadError && <StudentLoadState error={loadError} onRetry={() => { void refetch(); }} />}
      {(batchLoadError || courseLoadError || categoryLoadError) && <StudentLoadState error={batchLoadError || courseLoadError || categoryLoadError} onRetry={() => { void Promise.all([reloadBatches(), reloadCourses(), reloadCategories()]); }} />}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-slate-900">{entityLabel.tabLabel}</h1>
          <p className="mt-0.5 text-xs font-normal text-slate-500">{loading ? '...' : `${filteredStudents.length} / ${students.length}`} {entityLabel.singular}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canManage && selectedStudentIds.length > 0 && !isUnassignedScope && (
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa hàng loạt ({selectedStudentIds.length})
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-brand-primary"
          >
            <Download className="w-3.5 h-3.5" /> {isExporting ? 'Đang xuất...' : 'Xuất'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-brand-primary"
          >
            <Printer className="w-3.5 h-3.5" /> In
          </button>
          {canManage && usesEducationBilling && <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-brand-primary"
          >
            <Upload className="w-3.5 h-3.5" /> Nhập Excel
          </button>}
          {canManage && userProfile?.uid && <button
            onClick={() => setIsRegisterQROpen(true)}
            title="QR để học viên tự đăng ký"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-100 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-brand-primary"
          >
            <QrCode className="w-3.5 h-3.5" /> QR đăng ký
          </button>}
          {canManage && <button
            onClick={onAddStudent}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-brand-primary px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-600"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm
          </button>}
        </div>
      </div>

      {/* Primary Tabs removed — replaced by Category Dropdown in Filters Bar */}

      {/* Sub-Tabs (Status Workflow) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 status-tabs">
        {statusTabs.map((tab) => {
          const isSelected = selectedStatus === tab.label;
          return (
            <button
              key={tab.label}
              onClick={() => setSelectedStatus(tab.label)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                isSelected
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-sky-100 bg-white text-slate-600 hover:border-sky-300 hover:text-brand-primary"
              )}
            >
              {getOperationalStatusLabel(entityLabel.preset, tab.label)}
              {tab.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px]",
                  isSelected ? "bg-white/20 text-white" : "bg-sky-50 text-slate-500"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="filters-bar grid grid-cols-1 gap-2 rounded-xl border border-sky-100 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-0.5">
          <label className="text-xs font-normal text-slate-600">Khóa học</label>
          <RoadmapPicker value={category} placeholder="Chọn khóa học" options={[{ value: TAB_ALL, label: 'Tất cả khóa học' }, ...Array.from(new Map(categories.map((cat) => [cat.name, cat])).values()).map((cat: CourseCategoryItem) => ({ value: cat.name, label: cat.name })), { value: TAB_UNASSIGNED, label: operationalCopy.unassignedGroupLabel }]} onChange={(value) => setCategory(value || TAB_ALL)} />
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-normal text-slate-600">Từ ngày</label>
          <VietnameseDatePicker ariaLabel="Từ ngày" value={startDate} onChange={setStartDate} selectionOnly variant="filter" />
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-normal text-slate-600">Đến ngày</label>
          <VietnameseDatePicker ariaLabel="Đến ngày" value={endDate} onChange={setEndDate} selectionOnly variant="filter" />
        </div>

        <div className="space-y-0.5">
          <label className="text-xs font-normal text-slate-600">Sắp xếp</label>
          <RoadmapPicker value={sortBy} placeholder="Mới thêm trước" options={[{ value: 'newest', label: 'Mới thêm trước' }, { value: 'oldest', label: 'Cũ nhất trước' }, { value: 'name-asc', label: 'Họ tên A - Z' }, { value: 'name-desc', label: 'Họ tên Z - A' }, { value: 'registration-newest', label: 'Ngày đăng ký mới nhất' }, { value: 'registration-oldest', label: 'Ngày đăng ký cũ nhất' }]} onChange={(value) => setSortBy((value || 'newest') as StudentSortOption)} />
        </div>

        {usesEducationBilling && <div className="space-y-0.5">
          <label className="text-xs font-normal text-slate-600">Học phí</label>
          <RoadmapPicker value={feeStatusFilter} placeholder="Tất cả học phí" options={[{ value: 'Tất cả học phí', label: 'Tất cả học phí' }, { value: 'Đã đóng đủ', label: 'Đã đóng đủ' }, { value: 'Chưa đóng', label: 'Chưa đóng' }, { value: 'Còn thiếu', label: 'Còn thiếu' }]} onChange={(value) => setFeeStatusFilter(value || 'Tất cả học phí')} />
        </div>}
        <div className="space-y-0.5 col-span-2 lg:col-span-1">
          <label className="text-xs font-normal text-slate-600">Tìm kiếm</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Tên / SĐT / CCCD..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-sky-100 bg-white pl-9 pr-8 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[760px] text-left sm:min-w-[1100px]">
            <thead>
              <tr className="border-b border-sky-100 bg-brand-primary/10">
                <th className="px-3 py-2 w-8 no-print">
                  <input
                    type="checkbox"
                    checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedStudentIds.includes(s.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newIds = [...selectedStudentIds];
                        paginatedStudents.forEach(s => {
                          if (!newIds.includes(s.id)) newIds.push(s.id);
                        });
                        setSelectedStudentIds(newIds);
                      } else {
                        setSelectedStudentIds(selectedStudentIds.filter(id => !paginatedStudents.some(s => s.id === id)));
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-2.5 text-xs font-medium text-slate-700">Họ và tên</th>
                <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-700">Ngày đăng ký</th>
                <th className="px-3 py-2.5 text-xs font-medium text-slate-700">Lớp / Dự án</th>
                <th className="px-3 py-2.5 text-xs font-medium text-slate-700">Người phụ trách</th>
                {usesEducationBilling && <th className="px-3 py-2.5 text-xs font-medium text-slate-700">Học phí</th>}
                <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-700">Trạng thái</th>
                <th className="no-print px-3 py-2.5 text-right text-xs font-medium text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={usesEducationBilling ? 8 : 7} className="px-4 py-16 text-center text-slate-400 text-xs italic">Đang nạp dữ liệu...</td></tr>
              ) : paginatedStudents.length === 0 ? (
                <tr><td colSpan={usesEducationBilling ? 8 : 7} className="px-4 py-16 text-center text-slate-400 text-xs italic">Không tìm thấy {entityLabel.singular} nào phù hợp với bộ lọc.</td></tr>
              ) : paginatedStudents.map((student) => (
                <tr key={student.id} className="group transition-colors hover:bg-sky-50/40">
                  <td className="px-3 py-1.5 no-print">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.id)}
                      disabled={isUnassignedScope}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds([...selectedStudentIds, student.id]);
                        } else {
                          setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                        }
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-800">{student.fullName}</span>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs font-normal text-slate-500">
                        <span>{student.phone}</span>
                        {student.idCard && (
                          <>
                            <span className="text-slate-200">•</span>
                            <span className="rounded bg-slate-100 px-1 py-0.5 text-xs font-normal text-slate-600">CCCD: {student.idCard}</span>
                          </>
                        )}
                        <span className="text-slate-200">•</span>
                        {getBranchLabel(student.branchId) ? (
                          <span className="rounded bg-sky-50 px-1 py-0.5 text-xs font-normal text-brand-primary">{getBranchLabel(student.branchId)}</span>
                        ) : (
                          <span className="rounded bg-amber-50 px-1 py-0.5 text-xs font-normal text-amber-700">Chưa gán chi nhánh</span>
                        )}
                        {student.birthday && (
                          <>
                            <span className="text-slate-200">•</span>
                            <span>NS: {formatDisplayDate(student.birthday)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-center text-[11px] font-medium text-slate-500">
                    {formatDisplayDate(student.registrationDate)}
                  </td>
                  <td className="px-3 py-1.5">
                    {(() => {
                      const joined = studentBatches.get(student.id) || [];
                      if (joined.length === 0) {
                        return <span className="text-[10px] font-medium text-slate-300">Chưa xếp lớp</span>;
                      }
                      return (
                        <div className="flex flex-wrap items-center gap-1 max-w-[180px]">
                          {joined.slice(0, 2).map((b) => (
                            <span
                              key={b.id}
                              title={b.courseTitle}
                              className="whitespace-nowrap rounded bg-sky-50 px-1.5 py-0.5 text-xs font-normal text-brand-primary"
                            >
                              {b.code || b.courseTitle}
                            </span>
                          ))}
                          {joined.length > 2 && (
                            <span
                              title={joined.slice(2).map((b) => b.code || b.courseTitle).join(', ')}
                              className="text-xs font-normal text-slate-500"
                            >
                              +{joined.length - 2}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-1.5 text-[11px] font-medium text-slate-500 whitespace-nowrap">
                    {student.createdByName || <span className="text-slate-300">Chưa xác định</span>}
                  </td>

                  {usesEducationBilling && <td className="px-3 py-1.5">
                    <div className="flex flex-col gap-0.5 w-24">
                      <div className="flex items-center text-xs font-normal">
                        {(() => {
                          const totalFeeNum = parseInt(String(student.fee).replace(/\D/g, ''), 10) || 0;
                          const paidSoFar = student.paidAmount || 0;
                          const remaining = totalFeeNum - paidSoFar;
                          return (
                            <>
                              {totalFeeNum === 0 ? (
                                <span className="text-rose-500/80 whitespace-nowrap">Chưa đóng</span>
                              ) : remaining > 0 ? (
                                <span className="text-rose-500 whitespace-nowrap">-{formatVND(remaining)}đ</span>
                              ) : (
                                <span className="text-emerald-600 whitespace-nowrap">Đã hoàn tất</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        {(() => {
                          const totalFeeNum = parseInt(String(student.fee).replace(/\D/g, ''), 10) || 0;
                          const paidSoFar = student.paidAmount || 0;
                          const percentage = totalFeeNum > 0 ? (paidSoFar / totalFeeNum) * 100 : 0;
                          return (
                            <div
                              className="h-full bg-cyan-600 transition-all duration-500 ease-in-out"
                              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                            />
                          );
                        })()}
                      </div>
                    </div>
                  </td>}
                  <td className="px-3 py-1.5 text-center">
                    <div className="flex flex-wrap justify-center gap-1">
                      {(Array.isArray(student.status) ? student.status : [student.status]).map((st) => (
                        <span
                          key={st}
                          className={cn(
                            "whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-normal shadow-none",
                            getStatusBadgeClass(st)
                          )}
                        >
                          {getOperationalStatusLabel(entityLabel.preset, st)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 no-print">
                    <div className="flex items-center justify-end gap-1">
                      {isUnassignedScope && (
                        <button onClick={() => setAssigningStudent(student)} className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100">Gán chi nhánh</button>
                      )}
                      <button
                        onClick={() => setEditingStudent(student)}
                        title="Sửa thông tin"
                        className={cn("p-1 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer", isUnassignedScope && "hidden")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectStudent(student)}
                        title="Xem chi tiết"
                        className={cn("p-1 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer", isUnassignedScope && "hidden")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                       <div className={cn("relative", isUnassignedScope && "hidden")}>
                        <button
                          onClick={() => setConfirmDeleteId(confirmDeleteId === student.id ? null : student.id)}
                          disabled={isDeleting === student.id || isUnassignedScope}
                          title="Xóa"
                          className={cn(
                            "p-1 rounded-lg transition-colors disabled:opacity-50 cursor-pointer",
                            confirmDeleteId === student.id
                              ? "bg-rose-600 text-white"
                              : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {confirmDeleteId === student.id && (
                          <div className="absolute right-0 bottom-full mb-2 z-20">
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className="bg-white border border-sky-100 rounded-xl shadow-xl p-3 flex flex-col gap-2 min-w-[150px]"
                            >
                              <p className="text-xs font-normal text-slate-800 text-center">Xóa {entityLabel.singular} này?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="flex-1 py-1.5 text-xs font-normal text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleDelete(student)}
                                  className="flex-1 py-1.5 text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 rounded-lg transition-colors"
                                >
                                  Xóa
                                </button>
                              </div>
                            </motion.div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredStudents.length}
          pageSize={pageSize}
          itemName={entityLabel.singular}
          className="pagination-bar"
        />
      </div>

      {bulkDeletePreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Đóng"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => !isBulkDeleting && setBulkDeletePreview(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-sky-100 px-5 py-4">
              <div className="border-l-4 border-brand-primary pl-3">
                <h2 className="text-base font-medium text-slate-900">Kiểm tra trước khi xóa</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Sẽ xóa <strong className="text-emerald-600">{bulkDeletePreview.deletableCount}</strong> {entityLabel.singular}, dữ liệu lớp học/điểm danh/điểm số liên quan; phiếu thu vẫn được giữ lại.
                </p>
              </div>
              <button disabled={isBulkDeleting} onClick={() => setBulkDeletePreview(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {bulkDeletePreview.blockedCount > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium text-rose-700">Không thể xóa vì đang được sử dụng</h3>
                  <div className="space-y-2">
                    {bulkDeletePreview.items.filter(item => item.reasons.length > 0).map(item => (
                      <div key={item.studentId} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                        <p className="text-xs font-medium text-slate-800">{item.name}</p>
                        <ul className="mt-1.5 space-y-1 text-[11px] text-rose-700">
                          {item.reasons.map(reason => (
                            <li key={reason.key}>
                              • {reason.label}: {reason.count}{reason.details?.length ? ` (${reason.details.join(', ')})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {bulkDeletePreview.deletableCount > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <h3 className="text-xs font-medium text-emerald-700">Sẽ xóa</h3>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {bulkDeletePreview.items.filter(item => bulkDeletePreview.deletableIds.includes(item.studentId)).map(item => item.name).join(', ')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-sky-100 px-5 py-4">
              {bulkDeletePreview.deletableCount > 0 && (
                <button disabled={isBulkDeleting} onClick={confirmBulkDelete} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                  {isBulkDeleting ? 'Đang xóa...' : `Xóa ${bulkDeletePreview.deletableCount} ${entityLabel.singular}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={<StudentLoadState label="Đang tải biểu mẫu..." />}>
      {assigningStudent && <AssignStudentBranchModal
        student={assigningStudent}
        branches={branches}
        onClose={() => setAssigningStudent(null)}
        onSuccess={() => setAssigningStudent(null)}
      />}

      {/* Edit Student Modal */}
      {editingStudent && <EditStudentModal
        student={editingStudent}
        selectedCenter={selectedCenter}
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        onSuccess={() => setEditingStudent(null)}
        students={students}
      />}

      {/* Import Student Modal */}
      {usesEducationBilling && isImportOpen && (
        <ImportStudentModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => setIsImportOpen(false)}
          selectedCenter={selectedCenter}
        />
      )}

      {/* QR để học viên tự đăng ký */}
      {isRegisterQROpen && <RegisterQRModal
        isOpen={isRegisterQROpen}
        teacherId={userProfile?.uid || ''}
        companyCode={selectedCenter && selectedCenter !== 'all' ? selectedCenter : (userProfile?.companyCode || (userProfile && 'centerId' in userProfile && typeof userProfile.centerId === 'string' ? userProfile.centerId : ''))}
        branchId={activeBranchId || userProfile?.branchId || ''}
        entityPreset={entityLabel.preset}
        onClose={() => setIsRegisterQROpen(false)}
      />}
      </Suspense>
    </div>
  );
}
