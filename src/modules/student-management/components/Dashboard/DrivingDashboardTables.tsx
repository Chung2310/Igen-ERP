import { LuxuryCard } from '../ui/LuxuryCard';
import { cn } from '../../lib/utils';
import { Calendar, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStudents } from '../../hooks/useStudents';
import { useAuth } from '../../../../context/AuthContext';
import { useExams } from '../../hooks/useExams';
import { ExamStatus, DrivingStudent } from '../../types';
import React, { useState } from 'react';
import { useEntityLabel } from '../../hooks/useEntityLabel';

interface MockRegistration {
  fullName: string;
  rank: string;
  status: string;
}

interface DrivingDashboardTablesProps {
  onSelectStudent: (student: DrivingStudent | MockRegistration) => void;
  onNavigate: (view: 'Students' | 'Exams') => void;
  selectedCenter?: string;
}

const parseDateString = (dateStr: string) => {
  if (!dateStr) return new Date(8640000000000000); // Far future if no date
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

export function DrivingDashboardTables({ onSelectStudent, onNavigate, selectedCenter }: DrivingDashboardTablesProps) {
  const { students, loading: studentsLoading } = useStudents(selectedCenter === 'all' ? undefined : selectedCenter);
  const { exams, loading: examsLoading } = useExams(selectedCenter === 'all' ? undefined : selectedCenter);
  const { userProfile: user } = useAuth();
  const entityLabel = useEntityLabel();
  const isEducation = entityLabel.preset === 'student';
  
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const getExamStatusColor = (status: ExamStatus) => {
    switch (status) {
      case 'Đã hoàn thành': return 'text-emerald-500';
      case 'Sắp diễn ra': return 'text-amber-500';
      case 'Đã xác nhận': return 'text-cyan-500';
      case 'Đã hủy': return 'text-rose-500';
      default: return 'text-slate-500';
    }
  };

  const upcomingExams = exams.filter(exam => {
    const examDate = parseDateString(exam.officialDate || exam.tentativeDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(now.getDate() + 7);
    
    return examDate >= now && examDate <= sevenDaysLater;
  }).sort((a, b) => {
    const dateA = parseDateString(a.officialDate || a.tentativeDate).getTime();
    const dateB = parseDateString(b.officialDate || b.tentativeDate).getTime();
    return dateA - dateB;
  });

  const mockRegistrations = [
    { fullName: 'Cao Văn Long', rank: 'Vị trí A', status: 'Nộp hồ sơ' },
    { fullName: 'Đặng Văn Giang', rank: 'Vị trí B', status: 'Phỏng vấn' },
    { fullName: 'Phạm Thị Dung', rank: 'Vị trí C', status: 'Đã nhận' },
    { fullName: 'Mai Thị Kiều', rank: 'Vị trí A', status: 'Nộp hồ sơ' },
    { fullName: 'Bùi Thị Lan', rank: 'Vị trí B', status: 'Từ chối' },
  ];

  const getStatusInfo = (status: string) => {
    const map: Record<string, string> = {
      'Đang thi': 'bg-teal-100 text-teal-700',
      'Đã đậu': 'bg-emerald-100 text-emerald-700',
      'Đang học': 'bg-sky-100 text-sky-700',
      'Chờ KSK': 'bg-amber-100 text-amber-700',
      'Thi lại': 'bg-rose-100 text-rose-700',
      'Đã KSK': 'bg-emerald-100 text-emerald-700',
      'Đã nộp HS': 'bg-cyan-100 text-cyan-700',
      'Nợ học phí': 'bg-orange-100 text-orange-700',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  const loading = studentsLoading || examsLoading;

  const recentStudents = students.filter(student => {
    const regDate = parseDateString(student.registrationDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return regDate >= sevenDaysAgo && regDate <= now;
  }).sort((a, b) => {
    const dateA = parseDateString(a.registrationDate).getTime();
    const dateB = parseDateString(b.registrationDate).getTime();
    return dateB - dateA;
  });

  const totalPages = Math.ceil(recentStudents.length / pageSize);
  const paginatedRecentStudents = recentStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className={cn("grid grid-cols-1 gap-6", isEducation && "lg:grid-cols-2")}>
      {isEducation && (
        <LuxuryCard padding="none" className="bg-white">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Calendar className="w-4 h-4 text-brand-primary" /> Lịch thi sắp tới (7 ngày)
            </h3>
            <button onClick={() => onNavigate('Exams')} className="text-xs text-slate-400 hover:text-slate-600 font-medium">Xem tất cả</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Đợt thi</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Hạng</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ngày thi</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">HV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && user ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs italic">Đang tải dữ liệu...</td>
                  </tr>
                ) : upcomingExams.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs italic">Không có lịch thi trong 7 ngày tới.</td>
                  </tr>
                ) : upcomingExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{exam.name}</p>
                      <p className={cn("text-[10px] flex items-center gap-1", getExamStatusColor(exam.status))}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" /> {exam.status}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded text-[10px] font-bold border border-cyan-100">
                        {exam.rank}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-sm font-medium text-slate-600">
                      {exam.officialDate || exam.tentativeDate}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-800">{exam.studentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LuxuryCard>
      )}

      <LuxuryCard padding="none" className="bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Users className="w-4 h-4 text-brand-primary" /> {isEducation ? "Đăng ký gần đây (7 ngày)" : `${entityLabel.titleCase} mới đăng ký (7 ngày)`} {user && `(${recentStudents.length})`}
          </h3>
          <button onClick={() => onNavigate('Students')} className="text-xs text-slate-400 hover:text-slate-600 font-medium whitespace-nowrap ml-2">Xem tất cả</button>
        </div>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Họ tên</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Hạng</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Ngày ĐK</th>
                <th className="px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && user ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs italic">Đang tải dữ liệu...</td>
                </tr>
              ) : !user ? (
                mockRegistrations.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => onSelectStudent(item)}>
                    <td className="px-5 py-3 text-sm font-bold text-slate-800">{item.fullName}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded text-[10px] font-bold border border-cyan-100">{item.rank}</span>
                    </td>
                    <td className="px-3 py-3 text-center text-[10px] text-slate-400 font-medium">-</td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap", getStatusInfo(item.status))}>{item.status}</span>
                    </td>
                  </tr>
                ))
              ) : paginatedRecentStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs italic">Không có {entityLabel.singular} đăng ký trong 7 ngày qua.</td>
                </tr>
              ) : paginatedRecentStudents.map((item) => (
                <tr 
                  key={item.id} 
                  className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => onSelectStudent(item)}
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-bold text-slate-800">{item.fullName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{item.phone}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded text-[10px] font-bold border border-cyan-100">
                      {item.rank}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 whitespace-nowrap">{item.registrationDate}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap", getStatusInfo(item.status[0] || 'Đang học'))}>
                      {item.status[0] || 'Đang học'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {user && totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Trang {currentPage} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Trang trước"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Trang sau"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </LuxuryCard>
    </div>
  );
}
