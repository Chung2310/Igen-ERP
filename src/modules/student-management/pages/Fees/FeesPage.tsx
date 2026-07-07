import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Download, Search,
  ChevronDown, CreditCard, Clock, Users as UsersIcon,
  Banknote, History
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStudents } from '../../hooks/useStudents';
import { toast } from '../../../../pages/Toast';
import { Student } from '../../types';
import { AddPaymentModal } from '../../components/Fees/AddPaymentModal';
import { Pagination } from '../../components/ui/Pagination';

interface FeesPageProps {
  onSelectStudent?: (student: Student, tab: string) => void;
  selectedCenter?: string;
}

export function FeesPage({ onSelectStudent, selectedCenter }: FeesPageProps) {
  const resolvedCenter = selectedCenter === 'all' ? undefined : selectedCenter;
  const { students, loading } = useStudents(resolvedCenter);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debtFilter, setDebtFilter] = useState('Tất cả');
  
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
      const paid = student.paidAmount || 0;
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
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create a blob and download link
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bao_cao_hoc_phi_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats calculation (computed from all students)
  const stats = students.reduce((acc, student) => {
    const total = parseCurrency(student.fee || '0');
    const paid = student.paidAmount || 0;
    const debt = total - paid;

    acc.totalFee += total;
    acc.totalPaid += paid;
    acc.totalDebt += debt;
    if (debt > 0) acc.studentsWithDebt += 1;

    return acc;
  }, { totalFee: 0, totalPaid: 0, totalDebt: 0, studentsWithDebt: 0 });

  const filteredStudents = students.filter(student => {
    const total = parseCurrency(student.fee || '0');
    const paid = student.paidAmount || 0;
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
  }, [searchQuery, debtFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Học phí</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Theo dõi thu, nợ học phí của tất cả học viên</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-5 h-5" /> Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FeeStatCard 
          label="Tổng học phí" 
          value={formatCurrency(stats.totalFee)} 
          icon={Banknote} 
          color="text-cyan-600" 
          bgColor="bg-cyan-50" 
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
          color="text-teal-500" 
          bgColor="bg-teal-50" 
          isText={false}
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái nợ</label>
          <div className="relative">
            <select 
              value={debtFilter}
              onChange={(e) => setDebtFilter(e.target.value)}
              className="w-full h-11 bg-slate-50 px-4 pr-10 rounded-xl border border-slate-100 text-sm font-bold text-slate-800 outline-none appearance-none focus:border-cyan-600 transition-all"
            >
              <option value="Tất cả">Tất cả</option>
              <option value="Còn nợ">Còn nợ</option>
              <option value="Đã hoàn thành">Đã hoàn thành</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
        
        <div className="sm:col-span-2 lg:col-span-2 space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tìm học viên</label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Tên / SĐT..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 bg-slate-50 pl-11 pr-4 rounded-xl border border-slate-100 text-sm font-medium outline-none focus:border-cyan-600 transition-all"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden shadow-slate-200/50">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Học viên</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Hạng</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right whitespace-nowrap">Tổng HP</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right whitespace-nowrap">Đã đóng</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right whitespace-nowrap">Còn nợ</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Tiến độ</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Lần cuối</th>
                <th className="px-6 py-4 text-right border-b border-slate-100"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center text-slate-400 italic font-medium">Đang nạp dữ liệu học phí...</td>
                </tr>
              ) : paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center text-slate-400 italic font-medium tracking-tight">
                    Không tìm thấy dữ liệu học phí phù hợp.
                  </td>
                </tr>
              ) : paginatedStudents.map((student) => {
                const total = parseCurrency(student.fee || '0');
                const paid = student.paidAmount || 0;
                const debt = total - paid;
                const progress = total > 0 ? Math.round((paid / total) * 100) : 0;

                return (
                  <tr key={student.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5 border-b border-slate-50">
                      <div className="flex flex-col items-start">
                        <button
                          onClick={() => onSelectStudent?.(student, 'Học phí')}
                          className="text-left text-sm font-black text-slate-800 hover:text-cyan-600 hover:underline tracking-tight transition-all"
                        >
                          {student.fullName}
                        </button>
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">{student.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-b border-slate-50 text-center">
                      <span className="px-2 py-1 bg-cyan-50 border border-cyan-100 text-cyan-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        {student.rank}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-b border-slate-50 text-right whitespace-nowrap">
                      <span className="text-sm font-black text-slate-800 tracking-tight whitespace-nowrap">
                        {formatCurrency(total, false)}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-b border-slate-50 text-right whitespace-nowrap">
                      <span className={cn(
                        "text-sm font-black tracking-tight whitespace-nowrap",
                        paid > 0 ? "text-emerald-500" : "text-slate-300"
                      )}>
                        {formatCurrency(paid)}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-b border-slate-50 text-right whitespace-nowrap">
                      <span className={cn(
                        "text-sm font-black tracking-tight whitespace-nowrap",
                        debt > 0 ? "text-rose-500" : "text-slate-300"
                      )}>
                        {formatCurrency(debt)}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-b border-slate-50 min-w-[120px]">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1 bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={cn(
                              "h-full rounded-full transition-colors",
                              progress === 100 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-200"
                            )}
                          />
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-400 w-8">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-b border-slate-50 text-center">
                      <span className="text-[11px] font-bold text-slate-400">
                        {student.updatedAt ? "Hôm nay" : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-5 border-b border-slate-50 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedStudentForPayment(student);
                            setIsPaymentModalOpen(true);
                          }}
                          title="Thu học phí"
                          className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-300 hover:text-cyan-600 hover:border-cyan-100 hover:shadow-xl hover:shadow-cyan-50/50 transition-all group-hover:scale-105 active:scale-95"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onSelectStudent?.(student, 'Học phí')}
                          title="Nhật ký & Sửa học phí"
                          className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-300 hover:text-cyan-600 hover:border-cyan-100 hover:shadow-xl hover:shadow-cyan-50/50 transition-all group-hover:scale-105 active:scale-95"
                        >
                          <History className="w-4 h-4" />
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
        onSuccess={() => {}}
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
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex items-center gap-5">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", bgColor)}>
        <Icon className={cn("w-7 h-7", color)} />
      </div>
      <div>
        <p className={cn("text-xl sm:text-lg md:text-xl lg:text-base xl:text-lg 2xl:text-2xl font-black text-slate-900 leading-none tracking-tight whitespace-nowrap")}>
          {value}
        </p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mt-3">{label}</p>
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
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
