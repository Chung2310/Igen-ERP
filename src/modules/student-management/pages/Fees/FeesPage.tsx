import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Download, Search,
  CreditCard, Clock, Users as UsersIcon,
  Banknote, History, CalendarDays
} from 'lucide-react';
import { cn, toDisplayDate } from '../../lib/utils';
import { useStudents } from '../../hooks/useStudents';
import { toast } from '../../../../pages/Toast';
import { Student } from '../../types';
import { AddPaymentModal } from '../../components/Fees/AddPaymentModal';
import { Pagination } from '../../components/ui/Pagination';
import { apiFetch } from '../../lib/api';
import { RoadmapPicker } from '../../components/ui/RoadmapPicker';
import { VietnameseDatePicker } from '../../components/Batches/VietnameseDatePicker';

type PaymentRecord = { studentId: string; studentName?: string; amount: number; date: string; method: string; paidOn?: string };

const toDateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

interface FeesPageProps {
  onSelectStudent?: (student: Student, tab: string) => void;
  selectedCenter?: string;
}

export function FeesPage({ onSelectStudent, selectedCenter }: FeesPageProps) {
  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { students, loading } = useStudents(resolvedCenter);
  const hasRankData = React.useMemo(() => students.some(s => s.rank && s.rank.trim() !== ''), [students]);

  const [searchQuery, setSearchQuery] = useState('');
  const [debtFilter, setDebtFilter] = useState('Tất cả');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const fetchPayments = React.useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const result = await apiFetch<{ success: boolean; payments?: PaymentRecord[] }>('/payments', { params: { startDate: appliedStartDate, endDate: appliedEndDate, limit: 1000 } });
      setPayments(result.payments || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setPaymentsLoading(false);
    }
  }, [appliedStartDate, appliedEndDate]);

  React.useEffect(() => { void fetchPayments(); }, [fetchPayments]);
  const applyQuickRange = (days: number) => {
    const end = toDateInput(new Date());
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startValue = toDateInput(start);
    setStartDate(startValue);
    setEndDate(end);
    setAppliedStartDate(startValue);
    setAppliedEndDate(end);
  };
  const periodStudentIds = React.useMemo(() => new Set(payments.map((payment) => String(payment.studentId))), [payments]);
  const periodPaidByStudent = React.useMemo(() => payments.reduce<Record<string, number>>((total, payment) => {
    total[String(payment.studentId)] = (total[String(payment.studentId)] || 0) + Number(payment.amount || 0);
    return total;
  }, {}), [payments]);
  const studentsInPeriod = React.useMemo(() => {
    const activeStudents = students.filter((student) => periodStudentIds.has(String(student.id)));
    const activeIds = new Set(activeStudents.map((student) => String(student.id)));
    const archivedById = new Map<string, { name: string; paid: number; lastPaidOn?: string }>();
    payments.forEach((payment) => {
      const id = String(payment.studentId);
      if (activeIds.has(id)) return;
      const record = archivedById.get(id) || { name: payment.studentName || 'Học viên đã xóa', paid: 0, lastPaidOn: payment.paidOn || payment.date };
      record.paid += Number(payment.amount || 0);
      if (payment.paidOn || payment.date) record.lastPaidOn = payment.paidOn || payment.date;
      archivedById.set(id, record);
    });
    const archivedStudents = Array.from(archivedById, ([id, record]) => ({
      id, fullName: `${record.name} (đã xóa)`, phone: '-', rank: '', fee: record.paid.toLocaleString('vi-VN'), paidAmount: record.paid,
      status: [], registrationDate: '', updatedAt: record.lastPaidOn || '', paymentHistory: [],
    } as Student));
    return [...activeStudents, ...archivedStudents];
  }, [students, periodStudentIds, payments]);

  // Modal state
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Helper to parse currency string "12.000.000" to number 12000000
  const parseCurrency = (val: string) => {
    if (!val) return 0;
    return parseInt(val.replace(/\D/g, ''), 10);
  };

  // Helper to format number to VN currency
  const formatCurrency = (amount: number, withSpace = true) => {
    const formatted = new Intl.NumberFormat('vi-VN').format(amount);
    return withSpace ? `${formatted}\u00a0đ` : `${formatted}đ`;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleExport = () => {
    if (filteredStudents.length === 0) {
      toast.warning('Không có dữ liệu để xuất.');
      return;
    }

    // Define CSV headers
    const headers = ['Họ và tên', 'Số điện thoại', 'Hạng', 'Tổng học phí', 'Đã đóng', 'Còn nợ', 'Tiến độ (%)'];

    // Map data to CSV rows
    const rows = filteredStudents.map(student => {
      const total = parseCurrency(student.fee || '0');
      const paid = periodPaidByStudent[String(student.id)] || 0;
      const debt = total - paid;
      const progress = total > 0 ? Math.round((paid / total) * 100) : 0;

      return [
        student.fullName,
        student.phone,
        student.rank,
        total,
        paid,
        debt,
        `${progress}%`
      ];
    });

    // Construct CSV content
    const csvContent = [
      `Kỳ báo cáo: ${appliedStartDate || 'Tất cả lịch sử'} đến ${appliedEndDate || 'hiện tại'}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create a blob and download link
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bao_cao_hoc_phi_${appliedStartDate}_${appliedEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats calculation (computed from all students)
  const stats = studentsInPeriod.reduce((acc, student) => {
    const total = parseCurrency(student.fee || '0');
    const paid = periodPaidByStudent[String(student.id)] || 0;
    const debt = total - paid;

    acc.totalFee += total;
    acc.totalPaid += paid;
    acc.totalDebt += debt;
    if (debt > 0) acc.studentsWithDebt += 1;

    return acc;
  }, { totalFee: 0, totalPaid: 0, totalDebt: 0, studentsWithDebt: 0 });

  const filteredStudents = studentsInPeriod.filter(student => {
    const total = parseCurrency(student.fee || '0');
    const paid = periodPaidByStudent[String(student.id)] || 0;
    const debt = total - paid;

    if (debtFilter === 'Còn nợ' && debt <= 0) return false;
    if (debtFilter === 'Đã hoàn thành' && debt > 0) return false;
    if (searchQuery && !student.fullName.toLowerCase().includes(searchQuery.toLowerCase()) && !student.phone.includes(searchQuery)) return false;

    return true;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filters change - deferred to avoid synchronous setState in effect
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
    }, 0);
    return () => clearTimeout(timer);
  }, [searchQuery, debtFilter, startDate, endDate]);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-slate-900">Học phí</h1>
          <p className="mt-1 text-xs font-normal text-slate-500">Số liệu theo kỳ: {toDisplayDate(appliedStartDate) || 'Tất cả lịch sử'} đến {toDisplayDate(appliedEndDate) || 'hiện tại'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-sky-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-sky-50 hover:text-brand-primary transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FeeStatCard
          label="Tổng học phí"
          value={formatCurrency(stats.totalFee)}
          icon={Banknote}
          color="text-brand-primary"
          bgColor="bg-brand-primary/10"
        />
        <FeeStatCard
          label="Đã thu"
          value={formatCurrency(stats.totalPaid)}
          icon={CheckCircle2Icon}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <FeeStatCard
          label="Còn nợ"
          value={formatCurrency(stats.totalDebt)}
          icon={Clock}
          color="text-orange-500"
          bgColor="bg-orange-50"
        />
        <FeeStatCard
          label="HV còn nợ"
          value={stats.studentsWithDebt}
          icon={UsersIcon}
          color="text-brand-primary"
          bgColor="bg-brand-primary/10"
          isText={false}
        />
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border border-sky-100 bg-brand-primary/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <CalendarDays className="h-4 w-4" />
            Dữ liệu thu học phí theo thời gian
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              ['Hôm nay', 0], ['1 tuần', 7], ['1 tháng', 30], ['3 tháng', 90],
            ].map(([label, days]) => (
              <button key={String(days)} type="button" onClick={() => applyQuickRange(Number(days))} disabled={paymentsLoading} className="h-8 rounded-lg border border-sky-200 bg-white px-2.5 text-xs font-normal text-brand-primary hover:bg-sky-50 disabled:opacity-50">
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex w-full min-w-0 items-center gap-2 text-sm font-normal text-slate-600 sm:w-auto">
            <span className="shrink-0">Từ ngày</span>
            <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
              <VietnameseDatePicker ariaLabel="Từ ngày" value={startDate} max={endDate || undefined} onChange={setStartDate} selectionOnly variant="filter" />
            </div>
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 text-sm font-normal text-slate-600 sm:w-auto">
            <span className="shrink-0">Đến ngày</span>
            <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
              <VietnameseDatePicker ariaLabel="Đến ngày" value={endDate} min={startDate || undefined} max={toDateInput(new Date())} onChange={setEndDate} selectionOnly variant="filter" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setAppliedStartDate(startDate); setAppliedEndDate(endDate); }}
            disabled={paymentsLoading || (Boolean(startDate) !== Boolean(endDate))}
            className="h-9 w-full rounded-lg bg-brand-primary px-5 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {paymentsLoading ? 'Đang lọc...' : 'Lọc'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-sky-100 bg-white p-3 shadow-sm sm:grid-cols-3">
        <div className="space-y-0.5">
          <label className="text-xs font-normal text-slate-600">Trạng thái nợ</label>
          <RoadmapPicker value={debtFilter} placeholder="Tất cả" allowClear={false} options={[{ value: 'Tất cả', label: 'Tất cả' }, { value: 'Còn nợ', label: 'Còn nợ' }, { value: 'Đã hoàn thành', label: 'Đã hoàn thành' }]} onChange={setDebtFilter} />
        </div>

        <div className="space-y-0.5 sm:col-span-2">
          <label className="text-xs font-normal text-slate-600">Tìm học viên</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Tên / SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-sky-100 bg-white pl-9 pr-3 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-sm">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-brand-primary/10">
                <th className="border-b border-sky-100 px-3 py-2.5 text-xs font-medium text-slate-700">Học viên</th>
                {hasRankData && <th className="border-b border-sky-100 px-3 py-2.5 text-center text-xs font-medium text-slate-700">Hạng</th>}
                <th className="whitespace-nowrap border-b border-sky-100 px-3 py-2.5 text-right text-xs font-medium text-slate-700">Tổng học phí</th>
                <th className="whitespace-nowrap border-b border-sky-100 px-3 py-2.5 text-right text-xs font-medium text-slate-700">Đã đóng</th>
                <th className="whitespace-nowrap border-b border-sky-100 px-3 py-2.5 text-right text-xs font-medium text-slate-700">Còn nợ</th>
                <th className="border-b border-sky-100 px-3 py-2.5 text-xs font-medium text-slate-700">Tiến độ</th>
                <th className="border-b border-sky-100 px-3 py-2.5 text-center text-xs font-medium text-slate-700">Lần cuối</th>
                <th className="border-b border-sky-100 px-3 py-2.5 text-right text-xs font-medium text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {((loading && students.length === 0) || (paymentsLoading && payments.length === 0)) ? (
                <tr>
                  <td colSpan={hasRankData ? 8 : 7} className="px-6 py-20 text-center text-slate-400 italic font-medium">Đang nạp dữ liệu học phí...</td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={hasRankData ? 8 : 7} className="px-6 py-20 text-center text-slate-400 italic font-medium tracking-tight">
                    Không tìm thấy dữ liệu học phí phù hợp.
                  </td>
                </tr>
              ) : paginatedStudents.map((student) => {
                const total = parseCurrency(student.fee || '0');
                const paid = periodPaidByStudent[String(student.id)] || 0;
                const debt = total - paid;
                const progress = total > 0 ? Math.round((paid / total) * 100) : 0;

                return (
                  <tr key={student.id} className="group transition-colors hover:bg-sky-50/40">
                    <td className="px-3 py-1.5 border-b border-slate-50">
                      <div className="flex flex-col items-start">
                        <button
                          onClick={() => onSelectStudent?.(student, 'Học phí')}
                          className="text-left text-sm font-medium text-slate-800 transition-colors hover:text-brand-primary hover:underline"
                        >
                          {student.fullName}
                        </button>
                        <span className="mt-0.5 text-xs font-normal text-slate-500">{student.phone}</span>
                      </div>
                    </td>
                    {hasRankData && (
                      <td className="px-3 py-1.5 border-b border-slate-50 text-center">
                        {student.rank && student.rank.trim() !== '' ? (
                          <span className="rounded border border-sky-100 bg-brand-primary/10 px-1.5 py-0.5 text-xs font-normal text-brand-primary">
                            {student.rank}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-3 py-1.5 border-b border-slate-50 text-right whitespace-nowrap">
                      <span className="whitespace-nowrap text-xs font-normal text-slate-800">
                        {formatCurrency(total, false)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-50 text-right whitespace-nowrap">
                      <span className={cn(
                        "whitespace-nowrap text-xs font-medium",
                        paid > 0 ? "text-brand-primary" : "text-slate-400"
                      )}>
                        {formatCurrency(paid)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-50 text-right whitespace-nowrap">
                      <span className={cn(
                        "whitespace-nowrap text-xs font-medium",
                        debt > 0 ? "text-rose-500" : "text-slate-400"
                      )}>
                        {formatCurrency(debt)}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-50 min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <motion.div
                            initial={false}
                            animate={{ width: `${progress}%` }}
                            className={cn(
                              "h-full rounded-full transition-colors",
                              progress === 100 ? "bg-emerald-500" : "bg-brand-primary"
                            )}
                          />
                        </div>
                        <span className="w-7 text-xs font-normal text-slate-500">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-50 text-center">
                      <span className="text-xs font-normal text-slate-500">
                        {student.updatedAt ? "Hôm nay" : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 border-b border-slate-50 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedStudentForPayment(student);
                            setIsPaymentModalOpen(true);
                          }}
                          title="Thu học phí"
                          className="rounded-lg border border-sky-100 bg-white p-1.5 text-slate-500 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-brand-primary"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectStudent?.(student, 'Học phí')}
                          title="Nhật ký & Sửa học phí"
                          className="rounded-lg border border-sky-100 bg-white p-1.5 text-slate-500 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-brand-primary"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredStudents.length}
          pageSize={itemsPerPage}
          itemName="học viên"
          className="pagination-bar"
        />
      </div>

      <AddPaymentModal
        student={selectedStudentForPayment}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedStudentForPayment(null);
        }}
        onSuccess={() => { void fetchPayments(); }}
      />
    </div>
  );
}

interface FeeStatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  isText?: boolean;
}

function FeeStatCard({ label, value, icon: Icon, color, bgColor }: FeeStatCardProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-sky-100 bg-white p-3 shadow-sm">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bgColor)}>
        <Icon className={cn("w-4.5 h-4.5", color)} />
      </div>
      <div>
        <p className="whitespace-nowrap text-base font-medium leading-none text-slate-900">
          {value}
        </p>
        <p className="mt-1 text-xs font-normal text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function CheckCircle2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}
