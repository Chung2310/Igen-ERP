import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Search, Download, Printer, Plus,
  Eye, Trash2, Pencil,
  X, Calendar as CalendarIcon, ChevronDown,
  Users, Car, Upload, Languages, Lightbulb, BookOpen, UserX
} from 'lucide-react';
import { cn, formatVND, formatDisplayDate } from '../../lib/utils';
import { useStudents } from '../../hooks/useStudents';
import { useBatches } from '../../hooks/useBatches';
import { useCourses } from '../../hooks/useCourses';
import { useCourseCategories, CourseCategoryItem } from '../../hooks/useCourseCategories';
import { toast } from '../../../../pages/Toast';
import { Student } from '../../types';
import { apiFetch } from '../../lib/api';
import { EditStudentModal } from '../../components/Student/EditStudentModal';
import { ImportStudentModal } from '../../components/Student/ImportStudentModal';
import { Pagination } from '../../components/ui/Pagination';
import { useAuth } from '../../../../context/AuthContext';
import * as XLSX from 'xlsx';

interface StudentsPageProps {
  onSelectStudent: (student: Student) => void;
  onAddStudent: () => void;
  selectedCenter?: string;
}

type StatusFilter = 'Tất cả' | 'KSK' | 'Đã KSK' | 'Nộp HS' | 'Đang học' | 'Đang thi' | 'Đã đậu' | 'Thi lại' | 'Nghỉ học';

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

export function StudentsPage({ onSelectStudent, onAddStudent, selectedCenter }: StudentsPageProps) {
  const { userProfile: user } = useAuth();
  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { students, loading } = useStudents(resolvedCenter);
  const { batches } = useBatches();
  const { courses } = useCourses(resolvedCenter);
  const { categories } = useCourseCategories(resolvedCenter);
  
  const [category, setCategory] = useState<string>(TAB_ALL);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rankFilter, setRankFilter] = useState('Tất cả hạng');
  const [feeStatusFilter, setFeeStatusFilter] = useState('Tất cả học phí');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

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

  // Hạng bằng là dữ liệu riêng ngành lái xe — chỉ hiện filter/cột khi còn học viên có hạng
  const hasRankData = useMemo(() => students.some(s => s.rank), [students]);
  const rankOptions = useMemo(() => {
    const ranks = [...new Set(students.map(s => s.rank).filter(Boolean))] as string[];
    return ['Tất cả hạng', ...ranks.sort()];
  }, [students]);

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
      const hasMatch = studentStatuses.includes(dbStatus);
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
    if (feeStatusFilter !== 'Tất cả học phí') {
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

  const handleDelete = async (student: Student) => {
    setIsDeleting(student.id);
    try {
      await apiFetch(`/students/${student.id}`, { method: 'DELETE' });
      window.dispatchEvent(new Event("student-mutation"));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error('Có lỗi xảy ra khi xóa học viên.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleExport = () => {
    if (filteredStudents.length === 0) {
      toast.warning('Không có dữ liệu để xuất.');
      return;
    }

    let headers: string[];
    let getRowData: (student: Student) => (string | number)[];
    let cols: { wch: number }[];

    const commonHeadersAfter = [
      'Học phí', 'Đã đóng', 'Còn nợ',
      'Ngày đăng ký', 'Trạng thái học phí', 'Trạng thái học tập',
      'Ngày sinh', 'CCCD / CMND', 'Email', 'Người giới thiệu', 'Địa chỉ', 'Ngày nhập học',
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
        totalFeeNum.toLocaleString('vi-VN'),
        paidSoFar.toLocaleString('vi-VN'),
        remaining.toLocaleString('vi-VN'),
        student.registrationDate,
        feeStatusStr,
        Array.isArray(student.status) ? student.status.join(', ') : student.status,
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

    headers = ['Họ và tên', 'Số điện thoại', ...commonHeadersAfter];
    getRowData = (student: Student) => {
      return [
        student.fullName,
        student.phone,
        ...getCommonRowDataAfter(student)
      ];
    };
    cols = [
      { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
      { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 35 }, { wch: 16 },
      { wch: 30 }, { wch: 30 }, { wch: 30 }
    ];

    const data = filteredStudents.map(getRowData);

    try {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách học viên");
      
      const fileName = `danh_sach_hoc_vien_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất file Excel thành công!');
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error('Có lỗi xảy ra khi xuất file Excel.');
    }
  };

  const handlePrint = () => {
    if (filteredStudents.length === 0) {
      toast.warning('Không có dữ liệu học viên để in.');
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
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${Array.isArray(student.status) ? student.status.join(', ') : student.status}</td>
      </tr>
    `;
    }).join('');

    const printContent = `
      <html>
        <head>
          <title>Danh sách học viên - ${new Date().toLocaleDateString('vi-VN')}</title>
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
          <h1>DANH SÁCH HỌC VIÊN</h1>
          <p class="info">Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} | Tổng số: ${filteredStudents.length} học viên</p>
          <table>
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Số điện thoại</th>
                <th>Ngành / Hạng</th>
                <th>Ngày đăng ký</th>
                <th>Trạng thái</th>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Học viên</h1>
          <p className="text-slate-400 text-[11px] font-medium mt-0.5">{loading ? '...' : `${filteredStudents.length} / ${students.length}`} học viên</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Xuất
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> In
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Nhập Excel
          </button>
          <button
            onClick={onAddStudent}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-primary text-white rounded-lg text-[11px] font-bold shadow-md shadow-cyan-100 hover:bg-brand-primary/95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm
          </button>
        </div>
      </div>

      {/* Primary Tabs — sinh động từ phân loại khóa học */}
      <div className="flex items-center gap-2 sm:gap-5 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[
          { id: TAB_ALL, icon: Users },
          // dedup by name — superadmin thấy categories từ nhiều trung tâm, tránh tab trùng
          ...Array.from(new Map(categories.map((cat) => [cat.name, cat])).values())
            .map((cat: CourseCategoryItem) => ({ id: cat.name, icon: categoryIcon(cat.name) })),
          { id: TAB_UNASSIGNED, icon: UserX },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            className={cn(
              "flex items-center gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold transition-all relative whitespace-nowrap cursor-pointer",
              category === item.id ? "text-cyan-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <item.icon className={cn("w-4 h-4", category === item.id ? "text-cyan-600" : "text-slate-400")} />
            {item.id}
            {category === item.id && (
              <motion.div layoutId="catLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600" />
            )}
          </button>
        ))}
      </div>

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
              {tab.label}
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-sm filters-bar">
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

        <div className="space-y-0.5">
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
        </div>
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
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 w-8 no-print">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
                </th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Họ và tên</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Ngày ĐK</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Học phí</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right no-print">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-xs italic">Đang nạp dữ liệu...</td></tr>
              ) : paginatedStudents.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-xs italic">Không tìm thấy học viên nào phù hợp với bộ lọc.</td></tr>
              ) : paginatedStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-3 py-1.5 no-print">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600" />
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
                  </td>
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
                          {st}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 no-print">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingStudent(student)}
                        title="Sửa thông tin"
                        className="p-1 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectStudent(student)}
                        title="Xem chi tiết"
                        className="p-1 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                       <div className="relative">
                        <button
                          onClick={() => setConfirmDeleteId(confirmDeleteId === student.id ? null : student.id)}
                          disabled={isDeleting === student.id}
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
                              <p className="text-[10px] font-bold text-slate-800 text-center">Xóa học viên này?</p>
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
          itemName="học viên"
          className="pagination-bar"
        />
      </div>



      {/* Edit Student Modal */}
      <EditStudentModal
        student={editingStudent}
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        onSuccess={() => setEditingStudent(null)}
        students={students}
      />

      {/* Import Student Modal */}
      <ImportStudentModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => setIsImportOpen(false)}
      />
    </div>
  );
}
