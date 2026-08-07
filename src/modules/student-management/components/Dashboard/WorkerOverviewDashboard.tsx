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
  const entityLabel = useEntityLabel();

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

  // 2. Position / Rank Distribution Data
  const rankDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredWorkers.forEach(s => {
      const r = s.rank?.trim() || 'Chưa phân vị trí';
      map.set(r, (map.get(r) || 0) + 1);
    });

    const items = Array.from(map.entries()).map(([rank, count]) => ({
      rank,
      count,
      percent: totalWorkersCount ? Math.round((count / totalWorkersCount) * 100) : 0
    })).sort((a, b) => b.count - a.count);

    return items;
  }, [filteredWorkers, totalWorkersCount]);

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
        const matchRank = (w.rank || '').toLowerCase().includes(q);
        const matchIdCard = (w.idCard || '').includes(q);
        return matchName || matchPhone || matchRank || matchIdCard;
      }
      return true;
    });
  }, [filteredWorkers, statusFilter, searchTerm]);

  const getStatusBadge = (statusList: string[]) => {
    const main = statusList[0] || 'Chưa cập nhật';
    switch (main) {
      case 'Đã nộp HS':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-50 text-cyan-700 border border-cyan-200">Đã nộp HS</span>;
      case 'Đang học':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">{entityLabel.preset === 'student' ? 'Đang học' : 'Đang tuyển / Đào tạo'}</span>;
      case 'Đã đậu':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">{entityLabel.preset === 'student' ? 'Đã tốt nghiệp' : 'Đã tiếp nhận'}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">{main}</span>;
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      




      {/* Row 1: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left (7 cols): Column Chart (Biểu đồ cột Đăng ký lao động theo Tháng) */}
        <ErpCard className="lg:col-span-7 p-6 space-y-4 bg-white border border-slate-150 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">
                  Biểu đồ Cột - Đăng ký {entityLabel.titleCase} theo Tháng năm {currentYear}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Số lượng ứng viên ghi nhận theo từng tháng trong năm
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              Tổng: {totalWorkersCount}
            </span>
          </div>

          {/* SVG / Pure CSS Column Chart */}
          <div className="pt-6 pb-2 overflow-x-auto scrollbar-thin">
            <div className="min-w-[600px] md:min-w-0">
              <div className="h-56 flex items-end justify-between gap-2 px-2 border-b border-slate-200 pb-2 relative">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="border-b border-slate-400 w-full" />
                  <div className="border-b border-slate-400 w-full" />
                  <div className="border-b border-slate-400 w-full" />
                </div>

                {monthlyData.months.map((m, idx) => {
                  const heightPercent = Math.max(8, Math.round((m.count / monthlyData.maxCount) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative z-10">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute -top-8 bg-slate-900 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20">
                        {m.fullLabel}: <strong>{m.count}</strong> {entityLabel.singular}
                      </div>

                      {/* Value Badge above column */}
                      <span className="text-[10px] font-black text-slate-500 group-hover:text-indigo-600 transition-colors">
                        {m.count > 0 ? m.count : ''}
                      </span>

                      {/* Column Bar */}
                      <div className="w-full max-w-[28px] bg-slate-100 rounded-t-xl overflow-hidden flex items-end h-full">
                        <div
                          className={cn(
                            "w-full rounded-t-xl transition-all duration-500 group-hover:brightness-110",
                            m.count > 0
                              ? "bg-gradient-to-t from-indigo-600 to-cyan-500 shadow-md"
                              : "bg-slate-200/60"
                          )}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X Axis Labels */}
              <div className="flex justify-between gap-2 px-2 pt-2">
                {monthlyData.months.map((m, idx) => (
                  <div key={idx} className="flex-1 text-center text-[10px] font-black text-slate-400">
                    {m.monthLabel}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ErpCard>

        {/* Right (5 cols): Position / Rank Horizontal Distribution */}
        <ErpCard className="lg:col-span-5 p-6 space-y-4 bg-white border border-slate-150 shadow-xs">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">
                Phân bổ theo Vị trí Tuyển chọn (Rank)
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Cơ cấu vị trí ứng tuyển của người lao động
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-2 max-h-[230px] overflow-y-auto pr-1">
            {rankDistribution.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold py-8 text-center italic">
                Chưa có dữ liệu vị trí ứng tuyển.
              </p>
            ) : (
              rankDistribution.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-700 truncate max-w-[180px] font-black">{item.rank}</span>
                    <span className="text-slate-500 font-extrabold">{item.count} {entityLabel.singular} ({item.percent}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </ErpCard>

      </div>

      {/* Row 2: Referral Sources Breakdown Card */}
      <ErpCard className="p-6 space-y-4 bg-white border border-slate-150 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">
                Phân bổ Nguồn tuyển dụng & Đối tác CTV
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Thống kê số lượng lao động tiếp nhận theo từng nguồn cung ứng
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('Partners')}
            className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            Quản lý CTV / Đối tác <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {referralSources.map((ref, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl border border-slate-150 bg-slate-50/50 space-y-1 hover:border-sky-300 transition-all">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Nguồn #{idx + 1}</span>
              <p className="text-xs font-black text-slate-800 truncate" title={ref.source}>{ref.source}</p>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-sm font-black text-sky-700">{ref.count}</span>
                <span className="text-[10px] font-bold text-slate-400">{ref.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </ErpCard>

      {/* Row 3: Comprehensive Worker Data Table (Cột chi tiết theo các trường thực tế) */}
      <ErpCard className="p-6 space-y-4 bg-white border border-slate-150 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">
                Danh sách Chi tiết {entityLabel.titleCase} ({tableWorkers.length})
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Hiển thị dữ liệu chuẩn theo đúng các trường thông tin {entityLabel.singular} trong hệ thống
              </p>
            </div>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm tên, SĐT, CCCD, Vị trí..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-3.5 pr-8 py-1.5 text-xs font-semibold border border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-slate-50 w-44 sm:w-60"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Đã nộp HS">Đã nộp HS</option>
              <option value="Đang học">Đang tuyển / Đào tạo</option>
              <option value="Đã đậu">Đã tiếp nhận / Đi làm</option>
            </select>

            <button
              onClick={() => onNavigate('Students')}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
            >
              Quản lý danh sách
            </button>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 py-3">Họ và tên {entityLabel.singular}</th>
                <th className="px-4 py-3">Số điện thoại</th>
                <th className="px-4 py-3">CCCD / CMND</th>
                <th className="px-4 py-3 text-center">Vị trí tuyển chọn (Rank)</th>
                <th className="px-4 py-3">Nguồn giới thiệu</th>
                <th className="px-4 py-3">Địa chỉ thường trú</th>
                <th className="px-4 py-3 text-center">Ngày đăng ký</th>
                <th className="px-4 py-3 text-center">Trạng thái hồ sơ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {studentsLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs italic">
                    Đang tải dữ liệu {entityLabel.singular}...
                  </td>
                </tr>
              ) : tableWorkers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 text-xs italic">
                    Không tìm thấy thông tin {entityLabel.singular} nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                tableWorkers.slice(0, 10).map((worker) => (
                  <tr
                    key={worker.id}
                    onClick={() => onSelectStudent(worker)}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5 font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {worker.fullName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                      {worker.phone || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                      {worker.idCard || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[10px] font-bold">
                        {worker.rank || 'Lao động phổ thông'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                      {worker.referral || 'Trực tiếp'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 text-[11px] max-w-[180px] truncate" title={worker.address}>
                      {worker.address || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-center text-[10px] font-bold text-slate-500">
                      {worker.registrationDate || '-'}
                    </td>
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
