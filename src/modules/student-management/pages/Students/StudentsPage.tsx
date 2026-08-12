import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Search, Download, Printer, Plus,
  Eye, Trash2, Pencil,
  X, Calendar as CalendarIcon, ChevronDown,
  Users, Car, Upload, Languages, Lightbulb, BookOpen, UserX, QrCode
} from 'lucide-react';
import { cn, formatVND, formatDisplayDate } from '../../lib/utils';
import { useStudents } from '../../hooks/useStudents';
import { useBatches } from '../../hooks/useBatches';
import { useCourses } from '../../hooks/useCourses';
import { useCourseCategories, CourseCategoryItem } from '../../hooks/useCourseCategories';
import { toast } from '../../../../pages/Toast';
import { Student, Batch } from '../../types';
import { apiFetch } from '../../lib/api';
import { EditStudentModal } from '../../components/Student/EditStudentModal';
import { AssignStudentBranchModal } from '../../components/Student/AssignStudentBranchModal';
import { ImportStudentModal } from '../../components/Student/ImportStudentModal';
import { RegisterQRModal } from '../../components/Student/RegisterQRModal';
import { Pagination } from '../../components/ui/Pagination';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { useBranch } from '../../../../context/BranchContext';
import { useAuth } from '../../../../context/AuthContext';
import { getOperationalStatusLabel, getWorkerOperationalCopy, usesEducationBilling as presetUsesEducationBilling } from '../../config/workerRecruitmentCopy';
import * as XLSX from 'xlsx';

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

// Tab phân loại ảo, luôn có bên cạnh các phân loại khóa học động
const TAB_ALL = 'Tất cả';
const TAB_UNASSIGNED = 'Chưa xếp lớp';

// Icon gợi ý theo tên phân loại; phân loại mới chưa nhận diện được thì dùng icon chung
function categoryIcon(name: string): React.ComponentType<{ className?: string }> {
  const n = name.toLowerCase();
  if (n.includes('lái xe') || n.includes('lai xe')) return Car;
  if (n.includes('ngoại ngữ') || n.includes('ngoai ngu') || n.includes('tiếng')) return Languages;
  if (n.includes('kỹ năng') || n.includes('ky nang')) return Lightbulb;
  return BookOpen;
}

export function StudentsPage({ onSelectStudent, onAddStudent, selectedCenter, canManage = true }: StudentsPageProps) {
  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { userProfile } = useAuth();
  // Phạm vi danh sách luôn theo chi nhánh đang chọn — lối vào "Chưa gán chi nhánh" đã được gỡ khỏi thanh công cụ.
  const [listScope] = useState<'branch' | 'unassigned'>('branch');
  const [isRegisterQROpen, setIsRegisterQROpen] = useState(false);
  const isUnassignedScope = listScope === 'unassigned';
  const { students, loading } = useStudents(resolvedCenter, listScope);
  const { branches } = useBranch();
  const getBranchLabel = (branchId?: string) => branches.find((b) => b._id === branchId)?.name;
  const { batches } = useBatches();
  const { courses } = useCourses(resolvedCenter);
  const { categories } = useCourseCategories(resolvedCenter);
  const entityLabel = useEntityLabel();
  const operationalCopy = getWorkerOperationalCopy(entityLabel.preset);
  const usesEducationBilling = presetUsesEducationBilling(entityLabel.preset);

  const [category, setCategory] = useState<string>(TAB_ALL);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rankFilter] = useState('Tất cả hạng');
  const [feeStatusFilter, setFeeStatusFilter] = useState('Tất cả học phí');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [assigningStudent, setAssigningStudent] = useState<Student | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeletePreview, setBulkDeletePreview] = useState<BulkDeletePreview | null>(null);

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
  }, [category, selectedStatus, searchQuery, startDate, endDate, rankFilter, feeStatusFilter, selectedCenter]);

  // Helper to parse DD/MM/YYYY to Date object
  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date(0);
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
        const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
        const start = new Date(sYear, sMonth - 1, sDay);
        if (regDate < start) return false;
      }
      if (endDate) {
        const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
        const end = new Date(eYear, eMonth - 1, eDay);
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

  const totalPages = Math.ceil(filteredStudents.length / pageSize);
  const paginatedStudents = filteredStudents.slice(
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
      if (result.deletedCount > 0) toast.success(`Đã xóa ${result.deletedCount} ${entityLabel.singular} không có dữ liệu liên quan.`);
      if (result.blocked?.length > 0) toast.warning(`${result.blocked.length} ${entityLabel.singular} vừa phát sinh dữ liệu nên không được xóa.`);
      setSelectedStudentIds(bulkDeletePreview.blockedIds);
      setBulkDeletePreview(null);
      window.dispatchEvent(new Event("student-mutation"));
    } catch (error) {
      console.error("Error bulk deleting students:", error);
      toast.error(`Có lỗi xảy ra khi xóa hàng loạt ${entityLabel.singular}.`);
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

  const handleExport = () => {
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
        student.registrationDate,
        ...(usesEducationBilling ? [feeStatusStr] : []),
        (Array.isArray(student.status) ? student.status : [student.status])
          .map((status) => getOperationalStatusLabel(entityLabel.preset, status))
          .join(', '),
        getBatchLabels(student.id).join(', ') || 'Chưa xếp lớp',
        student.createdByName || 'Chưa xác định',
        student.birthday || '',
        student.idCard || '',
        student.email || '',
        student.referral || '',
        student.address || '',
        student.enrollmentDate || '',
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

    const data = filteredStudents.map(getRowData);

    try {
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

    const rowsHtml = filteredStudents.map(student => {
      const cats = Array.from(studentCategories.get(student.id) || []);
      return `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${student.fullName}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${student.phone}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${cats.length > 0 ? cats.join(', ') : (student.rank || '')}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${student.registrationDate}</td>
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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-cyan-700 tracking-tight">{entityLabel.tabLabel}</h1>
          <p className="text-slate-400 text-[11px] font-medium mt-0.5">{loading ? '...' : `${filteredStudents.length} / ${students.length}`} {entityLabel.singular}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canManage && selectedStudentIds.length > 0 && !isUnassignedScope && (
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa hàng loạt ({selectedStudentIds.length})
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> Xuất
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> In
          </button>
          {canManage && usesEducationBilling && <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" /> Nhập Excel
          </button>}
          {canManage && userProfile?.uid && <button
            onClick={() => setIsRegisterQROpen(true)}
            title="QR để học viên tự đăng ký"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5" /> QR đăng ký
          </button>}
          {canManage && <button
            onClick={onAddStudent}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-primary text-white rounded-lg text-[11px] font-bold shadow-md shadow-cyan-100 hover:bg-brand-primary/95 transition-all cursor-pointer whitespace-nowrap"
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
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap cursor-pointer",
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white shadow-md"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {getOperationalStatusLabel(entityLabel.preset, tab.label)}
              {tab.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px]",
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 bg-white p-2 shadow-sm sm:grid-cols-2 lg:grid-cols-5 filters-bar">
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Khóa học</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-7 px-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] appearance-none focus:outline-none focus:border-cyan-600 truncate pr-7"
            >
              <option value={TAB_ALL}>Tất cả khóa học</option>
              {Array.from(new Map(categories.map((cat) => [cat.name, cat])).values()).map((cat: CourseCategoryItem) => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
              <option value={TAB_UNASSIGNED}>{operationalCopy.unassignedGroupLabel}</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Từ ngày</label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              placeholder="Từ ngày..."
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-7 pl-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium focus:outline-none focus:border-cyan-600 transition-all"
            />
            <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Đến ngày</label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              placeholder="Đến ngày..."
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-7 pl-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium focus:outline-none focus:border-cyan-600 transition-all"
            />
            <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {usesEducationBilling && <div className="space-y-0.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Học phí</label>
          <div className="relative">
            <select
              value={feeStatusFilter}
              onChange={(e) => setFeeStatusFilter(e.target.value)}
              className="w-full h-7 px-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] appearance-none focus:outline-none focus:border-cyan-600"
            >
              <option>Tất cả học phí</option>
              <option>Đã đóng đủ</option>
              <option>Chưa đóng</option>
              <option>Còn thiếu</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>}
        <div className="space-y-0.5 col-span-2 lg:col-span-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tìm kiếm</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Tên / SĐT / CCCD..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 pl-7 pr-7 bg-slate-50 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:border-cyan-600"
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[760px] text-left sm:min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
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
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Họ và tên</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Ngày ĐK</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lớp / Dự án</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Người phụ trách</th>
                {usesEducationBilling && <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Học phí</th>}
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right no-print">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={usesEducationBilling ? 8 : 7} className="px-4 py-16 text-center text-slate-400 text-xs italic">Đang nạp dữ liệu...</td></tr>
              ) : paginatedStudents.length === 0 ? (
                <tr><td colSpan={usesEducationBilling ? 8 : 7} className="px-4 py-16 text-center text-slate-400 text-xs italic">Không tìm thấy {entityLabel.singular} nào phù hợp với bộ lọc.</td></tr>
              ) : paginatedStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
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
                      <span className="text-xs font-bold text-slate-800 capitalize">{student.fullName}</span>
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-medium text-slate-400">
                        <span>{student.phone}</span>
                        {student.idCard && (
                          <>
                            <span className="text-slate-200">•</span>
                            <span className="bg-slate-100 px-1 py-0.5 rounded text-[9px] text-slate-600 font-semibold">CCCD: {student.idCard}</span>
                          </>
                        )}
                        <span className="text-slate-200">•</span>
                        {getBranchLabel(student.branchId) ? (
                          <span className="bg-cyan-50 px-1 py-0.5 rounded text-[9px] text-cyan-700 font-semibold">{getBranchLabel(student.branchId)}</span>
                        ) : (
                          <span className="bg-amber-50 px-1 py-0.5 rounded text-[9px] text-amber-700 font-semibold">Chưa gán chi nhánh</span>
                        )}
                        {student.birthday && (
                          <>
                            <span className="text-slate-200">•</span>
                            <span>NS: {student.birthday}</span>
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
                              className="bg-indigo-50 px-1.5 py-0.5 rounded text-[9px] text-indigo-700 font-semibold whitespace-nowrap"
                            >
                              {b.code || b.courseTitle}
                            </span>
                          ))}
                          {joined.length > 2 && (
                            <span
                              title={joined.slice(2).map((b) => b.code || b.courseTitle).join(', ')}
                              className="text-[9px] font-bold text-slate-400"
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
                      <div className="flex items-center text-[10px] font-bold">
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
                            "px-1.5 py-0.5 rounded text-[9px] font-bold border shadow-none whitespace-nowrap",
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
                              className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 flex flex-col gap-2 min-w-[140px]"
                            >
                              <p className="text-[10px] font-bold text-slate-800 text-center">Xóa {entityLabel.singular} này?</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="flex-1 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                                >
                                  Hủy
                                </button>
                                <button
                                  onClick={() => handleDelete(student)}
                                  className="flex-1 py-1 text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-lg transition-all shadow-md shadow-rose-100"
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
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-base font-bold text-slate-800">Kiểm tra trước khi xóa</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Có thể xóa <strong className="text-emerald-600">{bulkDeletePreview.deletableCount}</strong>, bị chặn <strong className="text-rose-600">{bulkDeletePreview.blockedCount}</strong> {entityLabel.singular}.
                </p>
              </div>
              <button disabled={isBulkDeleting} onClick={() => setBulkDeletePreview(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {bulkDeletePreview.blockedCount > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold text-rose-700">Không thể xóa vì đang được sử dụng</h3>
                  <div className="space-y-2">
                    {bulkDeletePreview.items.filter(item => item.reasons.length > 0).map(item => (
                      <div key={item.studentId} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
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
                  <h3 className="text-xs font-bold text-emerald-700">Có thể xóa</h3>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {bulkDeletePreview.items.filter(item => item.reasons.length === 0).map(item => item.name).join(', ')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button disabled={isBulkDeleting} onClick={() => setBulkDeletePreview(null)} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50">Hủy</button>
              {bulkDeletePreview.deletableCount > 0 && (
                <button disabled={isBulkDeleting} onClick={confirmBulkDelete} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                  {isBulkDeleting ? 'Đang xóa...' : `Xóa ${bulkDeletePreview.deletableCount} ${entityLabel.singular}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}



      <AssignStudentBranchModal
        student={assigningStudent}
        branches={branches}
        onClose={() => setAssigningStudent(null)}
        onSuccess={() => setAssigningStudent(null)}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        student={editingStudent}
        selectedCenter={selectedCenter}
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        onSuccess={() => setEditingStudent(null)}
        students={students}
      />

      {/* Import Student Modal */}
      {usesEducationBilling && <ImportStudentModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => setIsImportOpen(false)}
        selectedCenter={selectedCenter}
      />}

      {/* QR để học viên tự đăng ký */}
      <RegisterQRModal
        isOpen={isRegisterQROpen}
        teacherId={userProfile?.uid || ''}
        onClose={() => setIsRegisterQROpen(false)}
      />
    </div>
  );
}
