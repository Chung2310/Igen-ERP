import React, { useMemo, useState } from 'react';
import { 
  Users, 
  BarChart3, 
  PieChart, 
  CheckCircle2, 
  Stethoscope, 
  FolderIcon, 
  Wallet, 
  Briefcase, 
  Calendar, 
  ChevronRight, 
  ArrowUpRight, 
  Plus, 
  FileText, 
  TrendingUp,
  DollarSign,
  UserCheck,
  Filter,
  Phone,
  CreditCard,
  Building2
} from 'lucide-react';
import { ErpCard, ErpFilterTab } from '../Erp/ErpUI';
import { useStudents } from '../../hooks/useStudents';
import { useBatches } from '../../hooks/useBatches';
import { useCourses } from '../../hooks/useCourses';
import { useEntityLabel } from '../../hooks/useEntityLabel';
import { DrivingStudent } from '../../types';
import { cn } from '../../lib/utils';

interface WorkerOverviewDashboardProps {
  onSelectStudent: (student: DrivingStudent) => void;
  onNavigate: (view: string) => void;
  selectedCenter?: string;
}

export function WorkerOverviewDashboard({
  onSelectStudent,
  onNavigate,
  selectedCenter
}: WorkerOverviewDashboardProps) {
  const { students, loading: studentsLoading } = useStudents(selectedCenter === 'all' ? undefined : selectedCenter);
  const { batches } = useBatches(selectedCenter === 'all' ? undefined : selectedCenter);
  const { courses } = useCourses(selectedCenter === 'all' ? undefined : selectedCenter);
  const entityLabel = useEntityLabel();
  const isEducation = entityLabel.preset === 'student';
  const courseTitleById = useMemo(() => new Map(courses.map((course) => [String(course.id), course.title])), [courses]);
  const batchCourseByStudentId = useMemo(() => {
    const map = new Map<string, string>();
    batches.forEach((batch) => (batch.learnerIds || []).forEach((studentId) => {
      if (!map.has(String(studentId))) map.set(String(studentId), courseTitleById.get(String(batch.courseId)) || batch.courseTitle || 'Chưa xếp khóa học');
    }));
    return map;
  }, [batches, courseTitleById]);

  const [timeRange, setTimeRange] = useState<'all' | 'this_year' | 'this_month'>('this_year');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Helper parsing date string DD/MM/YYYY
  const parseRegDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Filtered workers based on timeRange
  const filteredWorkers = useMemo(() => {
    return students.filter(s => {
      if (timeRange === 'all') return true;
      const d = parseRegDate(s.registrationDate);
      if (!d) return true;
      if (timeRange === 'this_year') return d.getFullYear() === currentYear;
      if (timeRange === 'this_month') return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      return true;
    });
  }, [students, timeRange, currentYear, currentMonth]);

  // Helper status check
  const hasStatus = (s: DrivingStudent, st: string) =>
    Array.isArray(s.status) ? s.status.includes(st as any) : s.status === st;

  // Key KPI Metrics
  const totalWorkersCount = filteredWorkers.length;
  const submittedDossierCount = filteredWorkers.filter(s => hasStatus(s, 'Đã nộp HS')).length;
  const inTrainingCount = filteredWorkers.filter(s => hasStatus(s, 'Đang học') || hasStatus(s, 'Đang thi')).length;
  const referredWorkersCount = filteredWorkers.filter(s => Boolean(s.referral || s.partnerId)).length;
  const completedCount = filteredWorkers.filter(s => hasStatus(s, 'Đã đậu')).length;

  // Total Financial Metrics
  const totalPaidAmount = useMemo(() => {
    return filteredWorkers.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
  }, [filteredWorkers]);

  const totalFeeAmount = useMemo(() => {
    return filteredWorkers.reduce((acc, s) => {
      const num = parseInt((s.fee || '').replace(/\D/g, ''), 10);
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
  }, [filteredWorkers]);

  // 1. Monthly Registration Column Chart Data (12 months)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      monthLabel: `T${i + 1}`,
      fullLabel: `Tháng ${i + 1}`,
      count: 0
    }));

    filteredWorkers.forEach(s => {
      const d = parseRegDate(s.registrationDate);
      if (d && d.getFullYear() === currentYear) {
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          months[m].count += 1;
        }
      }
    });

    const maxCount = Math.max(...months.map(m => m.count), 1);
    return { months, maxCount };
  }, [filteredWorkers, currentYear]);

  // 2. Course distribution for education; rank distribution for labor.
  const rankDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredWorkers.forEach(s => {
      const label = isEducation
        ? courseTitleById.get(String(s.courseId || '')) || batchCourseByStudentId.get(String(s.id)) || 'Chưa xếp khóa học'
        : s.rank?.trim() || 'Chưa phân vị trí';
      map.set(label, (map.get(label) || 0) + 1);
    });

    const items = Array.from(map.entries()).map(([rank, count]) => ({
      rank,
      count,
      percent: totalWorkersCount ? Math.round((count / totalWorkersCount) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    return items;
  }, [filteredWorkers, totalWorkersCount, isEducation, courseTitleById, batchCourseByStudentId]);

  // 3. Referral Source Breakdown Data
  const referralSources = useMemo(() => {
    const map = new Map<string, number>();
    filteredWorkers.forEach(s => {
      const src = s.referral?.trim() || 'Trực tiếp / Tự do';
      map.set(src, (map.get(src) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([source, count]) => ({
        source,
        count,
        percent: totalWorkersCount ? Math.round((count / totalWorkersCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredWorkers, totalWorkersCount]);

  // Table filtering
  const tableWorkers = useMemo(() => {
    return filteredWorkers.filter(w => {
      if (statusFilter !== 'all' && !hasStatus(w, statusFilter)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = w.fullName.toLowerCase().includes(q);
        const matchPhone = (w.phone || '').includes(q);
        if (isEducation) {
          return matchName || matchPhone || (w.email || '').toLowerCase().includes(q);
        }
        const matchRank = (w.rank || '').toLowerCase().includes(q);
        const matchIdCard = (w.idCard || '').includes(q);
        return matchName || matchPhone || matchRank || matchIdCard;
      }
      return true;
    });
  }, [filteredWorkers, statusFilter, searchTerm, isEducation]);

  const getStudentCourseLabel = (student: DrivingStudent) =>
    courseTitleById.get(String(student.courseId || '')) ||
    batchCourseByStudentId.get(String(student.id)) ||
    'Chưa xếp khóa học';

  const detailColumnCount = isEducation ? 7 : 8;

  const getStatusBadge = (statusList: string[]) => {
    const main = statusList[0] || 'Chưa cập nhật';
    switch (main) {
      case 'Đã nộp HS':
        return <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-medium text-cyan-700">Đã nộp HS</span>;
      case 'Đang học':
        return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700">{entityLabel.preset === 'student' ? 'Đang học' : 'Đang tuyển / Đào tạo'}</span>;
      case 'Đã đậu':
        return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">{entityLabel.preset === 'student' ? 'Đã tốt nghiệp' : 'Đã tiếp nhận'}</span>;
      default:
        return <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-700">{main}</span>;
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="animate-fade-in space-y-5 text-left">
      




      {/* Row 1: Charts Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        
        {/* Left (7 cols): Column Chart (Biểu đồ cột Đăng ký lao động theo Tháng) */}
        <ErpCard className="space-y-4 rounded-[22px] border-[#DFECF5] bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,105,165,0.28)] sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#E8F2F8] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-[#E8F7FF] p-2 text-[#00ADFC]">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-slate-800">
                  Đăng ký {isEducation ? 'học viên' : entityLabel.titleCase.toLocaleLowerCase('vi')} theo tháng · {currentYear}
                </h3>
                <p className="text-[11px] font-normal tracking-wide text-slate-500">
                  Theo dõi xu hướng {isEducation ? 'đăng ký học' : 'đăng ký'} theo từng tháng
                </p>
              </div>
            </div>
            <span className="rounded-lg bg-[#E8F7FF] px-2.5 py-1 text-xs font-medium text-[#007EB8]">
              Tổng: {totalWorkersCount}
            </span>
          </div>

          <div className="pt-5 pb-2 overflow-x-auto scrollbar-thin">
            <div className="min-w-[600px] md:min-w-0">
              <div className="grid grid-cols-[30px_1fr] gap-2">
                <div className="flex h-60 flex-col justify-between pb-7 text-right text-[10px] font-medium text-slate-400">
                  <span>{monthlyData.maxCount}</span><span>{Math.ceil(monthlyData.maxCount / 2)}</span><span>0</span>
                </div>
                <div>
                  <div className="relative flex h-52 items-end gap-2 border-b border-slate-200 px-2">
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between"><div className="border-t border-dashed border-slate-200" /><div className="border-t border-dashed border-slate-200" /><div className="border-t border-dashed border-slate-200" /></div>
                    {monthlyData.months.map((m, idx) => {
                      const heightPercent = m.count ? Math.max(10, Math.round((m.count / monthlyData.maxCount) * 100)) : 0;
                      return <div key={idx} className="group relative z-10 flex h-full flex-1 flex-col justify-end">
                        {m.count > 0 && <span className="mb-1 text-center text-[10px] font-medium text-[#007EB8]">{m.count}</span>}
                        <div key={`${m.count}-${timeRange}-${selectedCenter}`} title={`${m.fullLabel}: ${m.count} ${isEducation ? 'học viên' : entityLabel.singular}`} className={cn("mx-auto w-full max-w-[36px] rounded-t-lg transition-[filter] duration-300 group-hover:brightness-105", m.count ? "student-chart-column bg-gradient-to-t from-[#00ADFC] via-[#63CFFF] to-[#C8F0FF] shadow-[0_4px_12px_rgba(0,173,252,.14)]" : "bg-[#EDF5FA]")} style={{ height: `${heightPercent}%`, animationDelay: `${idx * 45}ms` }} />
                      </div>;
                    })}
                  </div>
                  <div className="flex gap-2 px-2 pt-2">{monthlyData.months.map((m, idx) => <div key={idx} className="flex-1 text-center text-[10px] font-medium text-slate-400">{m.monthLabel}</div>)}</div>
                </div>
              </div>
            </div>
          </div>
        </ErpCard>

        {/* Right (5 cols): Position / Rank Horizontal Distribution */}
        <ErpCard className="space-y-4 rounded-[22px] border-[#DFECF5] bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,105,165,0.28)] sm:p-6 lg:col-span-5">
          <div className="flex items-center gap-2.5 border-b border-[#E8F2F8] pb-3">
            <div className="rounded-xl bg-[#E5FAF8] p-2 text-[#009EB9]">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-800">
                {isEducation ? 'Phân bổ theo khóa học' : 'Phân bổ theo Vị trí Tuyển chọn (Rank)'}
              </h3>
              <p className="text-[11px] font-normal tracking-wide text-slate-500">
                {isEducation ? 'Cơ cấu học viên theo khóa học hoặc lớp đã xếp' : 'Cơ cấu vị trí ứng tuyển của người lao động'}
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-2 max-h-[230px] overflow-y-auto pr-1">
            {rankDistribution.length === 0 ? (
              <p className="py-8 text-center text-xs font-medium italic text-slate-400">
                Chưa có dữ liệu vị trí ứng tuyển.
              </p>
            ) : (
              rankDistribution.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="max-w-[180px] truncate font-medium text-slate-700">{item.rank}</span>
                    <span className="font-medium text-slate-500">{item.count} {entityLabel.singular} ({item.percent}%)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#EAF4F9]">
                    <div
                      key={`${item.count}-${item.percent}-${timeRange}-${selectedCenter}`}
                      className="student-chart-progress h-full rounded-full bg-gradient-to-r from-[#00ADFC] via-[#5BCBFF] to-[#B9E9FC]"
                      style={{ width: `${item.percent}%`, animationDelay: `${idx * 90}ms` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </ErpCard>

      </div>

      {/* Row 2: Referral Sources Breakdown Card */}
      <ErpCard className="space-y-4 rounded-[22px] border-[#DFECF5] bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,105,165,0.28)] sm:p-6">
        <div className="flex items-center justify-between border-b border-[#E8F2F8] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#E8F7FF] p-2 text-[#00ADFC]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-800">
                Phân bổ Nguồn tuyển dụng & Đối tác CTV
              </h3>
              <p className="text-[11px] font-medium tracking-wide text-slate-500">
                Thống kê số lượng lao động tiếp nhận theo từng nguồn cung ứng
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('Partners')}
            className="flex cursor-pointer items-center gap-1 text-xs font-medium text-[#008FCD] transition-colors hover:text-[#006D9D]"
          >
            Quản lý CTV / Đối tác <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {referralSources.map((ref, idx) => (
            <div key={idx} className="space-y-1.5 rounded-2xl border border-[#DFECF5] bg-[#F8FCFF] p-3.5 transition-all hover:border-[#8DDCFF] hover:bg-white hover:shadow-sm">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nguồn #{idx + 1}</span>
              <p className="truncate text-xs font-medium text-slate-800" title={ref.source}>{ref.source}</p>
              <div className="flex items-center justify-between border-t border-[#E8F2F8] pt-1.5">
                <span className="text-sm font-medium text-[#007EB8]">{ref.count}</span>
                <span className="text-[10px] font-medium text-slate-400">{ref.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </ErpCard>

      {/* Row 3: Comprehensive Worker Data Table (Cột chi tiết theo các trường thực tế) */}
      <ErpCard className="space-y-4 rounded-[22px] border-[#DFECF5] bg-white p-5 shadow-[0_12px_32px_-24px_rgba(0,105,165,0.28)] sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#E8F2F8] pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#E8F7FF] p-2 text-[#00ADFC]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-slate-800">
                Danh sách Chi tiết {entityLabel.titleCase} ({tableWorkers.length})
              </h3>
              <p className="text-[11px] font-medium tracking-wide text-slate-500">
                Hiển thị dữ liệu chuẩn theo đúng các trường thông tin {entityLabel.singular} trong hệ thống
              </p>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder={isEducation ? 'Tìm tên, SĐT, email...' : 'Tìm tên, SĐT, CCCD, Vị trí...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-44 rounded-xl border border-[#DFECF5] bg-[#F8FCFF] py-1.5 pl-3.5 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-[#00ADFC] focus:bg-white sm:w-60"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cursor-pointer rounded-xl border border-[#DFECF5] bg-[#F8FCFF] px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-[#00ADFC]"
            >
              <option value="all">Tất cả trạng thái</option>
              {isEducation ? (
                <>
                  <option value="Đang học">Đang học</option>
                  <option value="Đang thi">Đang thi</option>
                  <option value="Đã đậu">Đã tốt nghiệp</option>
                  <option value="Thi lại">Thi lại</option>
                </>
              ) : (
                <>
                  <option value="Đã nộp HS">Đã nộp HS</option>
                  <option value="Đang học">Đang tuyển / Đào tạo</option>
                  <option value="Đã đậu">Đã tiếp nhận / Đi làm</option>
                </>
              )}
            </select>

            <button
              onClick={() => onNavigate('Students')}
              className="cursor-pointer rounded-xl bg-[#00ADFC] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-200 transition-all hover:bg-[#0096DF]"
            >
              Quản lý danh sách
            </button>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead>
              <tr className="border-b border-[#DFECF5] bg-[#F4FAFE] text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {isEducation ? (
                  <>
                    <th className="px-4 py-3">Họ và tên học viên</th>
                    <th className="px-4 py-3">Số điện thoại</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">CCCD / CMND</th>
                    <th className="px-4 py-3">Khóa học / Lớp</th>
                    <th className="px-4 py-3 text-center">Ngày nhập học</th>
                    <th className="px-4 py-3 text-center">Trạng thái học</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3">Họ và tên {entityLabel.singular}</th>
                    <th className="px-4 py-3">Số điện thoại</th>
                    <th className="px-4 py-3">CCCD / CMND</th>
                    <th className="px-4 py-3 text-center">Vị trí tuyển chọn (Rank)</th>
                    <th className="px-4 py-3">Nguồn giới thiệu</th>
                    <th className="px-4 py-3">Địa chỉ thường trú</th>
                    <th className="px-4 py-3 text-center">Ngày đăng ký</th>
                    <th className="px-4 py-3 text-center">Trạng thái hồ sơ</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF4F8] font-normal text-slate-700">
              {studentsLoading ? (
                <tr>
                  <td colSpan={detailColumnCount} className="py-8 text-center text-slate-400 text-xs italic">
                    Đang tải dữ liệu {entityLabel.singular}...
                  </td>
                </tr>
              ) : tableWorkers.length === 0 ? (
                <tr>
                  <td colSpan={detailColumnCount} className="py-8 text-center text-slate-400 text-xs italic">
                    Không tìm thấy thông tin {entityLabel.singular} nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                tableWorkers.slice(0, 10).map((worker) => (
                  <tr
                    key={worker.id}
                    onClick={() => onSelectStudent(worker)}
                    className="group cursor-pointer transition-colors hover:bg-[#F4FBFF]"
                  >
                    <td className="px-4 py-3.5 font-medium text-slate-800 transition-colors group-hover:text-[#007EB8]">
                      {worker.fullName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                      {worker.phone || '-'}
                    </td>
                    {isEducation ? (
                      <>
                        <td className="px-4 py-3.5 text-slate-600 text-[11px]">{worker.email || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">{worker.idCard || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-600 text-[11px] max-w-[220px] truncate" title={getStudentCourseLabel(worker)}>
                          {getStudentCourseLabel(worker)}
                        </td>
                        <td className="px-4 py-3.5 text-center text-[10px] font-medium text-slate-500">
                          {worker.enrollmentDate || worker.registrationDate || '-'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">{worker.idCard || '-'}</td>
                        <td className="px-4 py-3.5 text-center"><span className="rounded-lg bg-[#E8F7FF] px-2.5 py-1 text-[10px] font-medium text-[#007EB8]">{worker.rank || 'Lao động phổ thông'}</span></td>
                        <td className="px-4 py-3.5 text-slate-600 text-[11px]">{worker.referral || 'Trực tiếp'}</td>
                        <td className="px-4 py-3.5 text-slate-600 text-[11px] max-w-[180px] truncate" title={worker.address}>{worker.address || '-'}</td>
                        <td className="px-4 py-3.5 text-center text-[10px] font-medium text-slate-500">{worker.registrationDate || '-'}</td>
                      </>
                    )}
                    <td className="px-4 py-3.5 text-center">
                      {getStatusBadge(worker.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ErpCard>

    </div>
  );
}
